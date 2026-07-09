# star_byte

Private chat for a closed friend/community network.

The product is desktop-first. The web frontend exists because Tauri renders web assets; normal users should install the Tauri client, not treat this as a public web app.

## Targets

`starbyte-server`

- Fastify backend for the host/admin deployment.
- Owns auth, users, rooms, room passes, threads, whispers, messages, uploads, notifications, release metadata, updater artifacts, and SQLite data.
- Runs on the server only. Do not ship it to normal users.
- Must preserve `/var/lib/starbyte` across updates.

`starbyte-client`

- Tauri desktop app for Windows and Linux users.
- Contains the React UI assets and Tauri shell.
- Connects to the configured starbyte-server over HTTPS/WSS.
- Does not bundle the Fastify server, server SQLite DB, uploads, or source-of-truth chat data.

Hard lines: no Electron, no bundled server in the client installer, no local client database as source of truth, no destructive DB resets.

## Stack

- Server: Fastify
- DB: SQLite via `better-sqlite3`
- UI: React + Vite
- Desktop: Tauri v2
- Updates: Tauri updater with signed artifacts

## Local Development

Use Node 22 LTS.

```bash
cp apps/server/.env.example apps/server/.env
npm install
npm run dev
```

Local URLs:

- Server: `http://localhost:3001`
- Web shell: `http://localhost:5173`

Run the Tauri shell in development:

```bash
npm run dev --workspace @starbyte/server
npm run tauri:dev --workspace @starbyte/web
```

## Checks

```bash
npm run version:check
npm test
npm run build
npm run build:tauri --workspace @starbyte/web
```

`build:tauri` builds desktop web assets with production desktop endpoints. It rejects localhost/non-HTTPS release endpoints.

## Server Production

Required production env:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3001
TRUST_PROXY=true
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_ORIGIN=https://starbyte.example.com
DB_PATH=/var/lib/starbyte/starbyte.db
STARBYTE_RELEASES_DIR=/var/lib/starbyte/releases
```

Standard layout:

```text
/opt/starbyte/server
/etc/starbyte/starbyte.env
/var/lib/starbyte/starbyte.db
/var/lib/starbyte/uploads
/var/lib/starbyte/releases
/var/backups/starbyte
```

Build/start manually:

```bash
npm ci
npm run build --workspace @starbyte/server
npm run start --workspace @starbyte/server
```

Production startup rejects missing `DB_PATH`, missing `CLIENT_ORIGIN`, and missing/default `JWT_SECRET`.

For install, systemd, backup, restore, and rollback, see [docs/server-install.md](docs/server-install.md).

## Reverse Proxy

Terminate HTTPS at the proxy. Forward API, WebSocket, health, and release files:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /ws {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}

location /health {
    proxy_pass http://127.0.0.1:3001;
}

location /releases/ {
    alias /var/lib/starbyte/releases/;
}
```

Set `TRUST_PROXY=true` only when Fastify is reachable only through the trusted proxy.

## Desktop Endpoints

Desktop production builds need server URLs:

```dotenv
VITE_API_BASE_URL=https://starbyte.example.com
VITE_WS_BASE_URL=wss://starbyte.example.com
```

Or:

```dotenv
STARBYTE_DOMAIN=starbyte.example.com
```

Do not hardcode localhost for desktop release builds.

## Desktop Artifacts

Expected final release asset names:

```text
star_byte_<version>_x64-setup.exe
star_byte_<version>_x64-setup.exe.sig
star_byte_<version>_portable_x64.zip
star_byte_<version>_amd64.AppImage
star_byte_<version>_amd64.AppImage.sig
star_byte_<version>_amd64.deb
star_byte-<version>-1-x86_64.pkg.tar.zst
```

Windows installer: NSIS, per-machine install under `Program Files`.

Linux installers: AppImage and `.deb`.

Arch package: native `pkg.tar.zst` using system WebKitGTK.

The portable Windows ZIP does not install, does not write to `Program Files`, and is not the updater target.

## Release Flow

Normal push to `main`:

- runs CI;
- does not create a release;
- does not publish `latest.json`;
- does not update clients;
- does not deploy the server.

Backend deploy:

```bash
# on the server host
sudo /opt/starbyte/deploy-server.sh
```

Desktop test build:

```text
GitHub Actions -> desktop-release -> Run workflow
```

This uploads Actions artifacts only. It does not create a GitHub Release and does not update clients.

New desktop release:

```bash
npm run version:set -- 0.1.1
npm run version:check
git commit -am "Release star_byte 0.1.1"
git tag v0.1.1
git push
git push origin v0.1.1
```

GitHub creates the Release only for a matching tag. The tag version must match the project version.

Publish to clients only after smoke testing:

```bash
# on the server host
sudo -u starbyte node /opt/starbyte/server/deploy/release/publish-from-github.mjs 0.1.1 --dry-run
sudo -u starbyte node /opt/starbyte/server/deploy/release/publish-from-github.mjs 0.1.1
```

Only the second command updates `/var/lib/starbyte/releases/latest.json`. It downloads into staging, validates artifacts/signatures, promotes files, checks public URLs, then atomically renames `latest.json.tmp` to `latest.json`.

Full details: [docs/client-release.md](docs/client-release.md) and [docs/release-desktop.md](docs/release-desktop.md).

## Updater

Public endpoint:

```text
GET /api/desktop/updates/:target/:arch/:currentVersion
```

The backend reads `/var/lib/starbyte/releases/latest.json` by default. If there is no newer version, it returns no update. Installer binaries stay on disk under `/var/lib/starbyte/releases`; they are not stored in SQLite.

Updater signing private key must never be committed.

Required GitHub Secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, if needed

Required GitHub Variables:

- `STARBYTE_DOMAIN`, or
- `VITE_API_BASE_URL` and `VITE_WS_BASE_URL`

GitHub Actions does not need SSH access to your server.

## Backups

Back up the DB, uploads, releases, and env file:

```bash
sudo sqlite3 /var/lib/starbyte/starbyte.db \
  ".backup '/var/backups/starbyte/starbyte-$(date +%F-%H%M%S).db'"
sudo tar -C /var/lib/starbyte -czf /var/backups/starbyte/uploads.tgz uploads
sudo tar -C /var/lib/starbyte -czf /var/backups/starbyte/releases.tgz releases
```

Stop the service before restoring. Preserve file ownership and permissions. Treat copied env files as secrets.

## Smoke Test

Use two accounts before publishing a desktop update:

1. Register and log in.
2. Edit profile and avatar.
3. Create a Room and Text Thread.
4. Generate a Room Pass and join from a second account.
5. Confirm members update without reload.
6. Send, reply, edit, and delete a message.
7. Upload an image.
8. Send a mention and check notification.
9. Create a Whisper.
10. Restart backend and confirm reconnect.
11. From an older installed client, check for updates manually.
12. Confirm version/release notes, then install only after clicking `Install update`.

## More Docs

- [docs/server-install.md](docs/server-install.md): server install, deploy, backup, restore.
- [docs/client-release.md](docs/client-release.md): client release and publishing flow.
- [docs/release-desktop.md](docs/release-desktop.md): server/client boundaries.
- [docs/linux-packaging.md](docs/linux-packaging.md): AppImage, `.deb`, Arch notes.
- [docs/memory-measurement.md](docs/memory-measurement.md): desktop memory measurement.

## Deferred Work

- Room Passes still need a careful hash migration while preserving existing live data.
- Sections are limited to the existing compatibility column.
- IRC bridge remains a no-op adapter.
