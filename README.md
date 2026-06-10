# Star Byte

Private desktop-first community chat built with Fastify, SQLite, React, Vite, and Tauri.

The constellation server is authoritative for users, Rooms, Room Passes, Threads, Whispers, messages, uploads, embeds, notifications, and desktop update metadata. The Tauri application is a client shell. Do not bundle the Fastify server or SQLite database into installers.

## Features

- JWT login and registration
- Rooms, Room Pass invites, Threads, and Whispers
- Message create, edit, soft delete, replies, and mentions
- WebSocket updates with polling fallback
- Profile and chat image uploads
- Bounded link previews with SSRF protections
- PWA frontend and optional Tauri desktop window

## Development

Use a current supported Node release. Node 22 LTS is recommended.

```bash
cp apps/server/.env.example apps/server/.env
npm install
npm run dev
```

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`

To run the Tauri desktop shell against a development server, start the backend and desktop frontend separately:

```bash
npm run dev --workspace @starbyte/server
npm run tauri:dev --workspace @starbyte/web
```

## Build

```bash
npm run build
npm run build:tauri --workspace @starbyte/web
cd apps/web/src-tauri && cargo check
```

`build:tauri` always injects the production desktop endpoints from `apps/web/.env.desktop-production`:

```dotenv
VITE_API_BASE_URL=https://constellation.servebeer.com
VITE_WS_BASE_URL=wss://constellation.servebeer.com
```

It fails if those endpoints do not use HTTPS/WSS on constellation. Desktop release assets never fall back to localhost.

## Production Environment

Set these server variables explicitly:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3001
TRUST_PROXY=true
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_ORIGIN=https://chat.example.com
DB_PATH=/var/lib/star-byte/starbyte.db
```

Build the browser frontend with:

```dotenv
VITE_API_BASE_URL=https://chat.example.com
VITE_WS_BASE_URL=wss://chat.example.com
```

Production startup rejects missing `DB_PATH`, missing `CLIENT_ORIGIN`, and the default or missing `JWT_SECRET`.

Build and start the server:

```bash
npm run build --workspace @starbyte/server
npm run start --workspace @starbyte/server
```

## Reverse Proxy

Serve the web build from `apps/web/dist`. Forward `/api/*`, `/ws`, and `/health` to Fastify. WebSocket forwarding must preserve upgrade headers.

Example Nginx configuration:

```nginx
server {
    listen 443 ssl;
    server_name chat.example.com;

    root /srv/star-byte/apps/web/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /releases/ {
        alias /var/lib/star-byte/releases/;
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

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Terminate HTTPS at the proxy. Do not expose Fastify directly to the public internet.
Set `TRUST_PROXY=true` only when Fastify is reachable exclusively through your trusted reverse proxy. This lets rate limits use forwarded client IP addresses safely.

## SQLite Persistence And Backups

`DB_PATH` must point to persistent storage. Uploaded images are stored in an `uploads` directory next to the SQLite database, so back up both paths.

Example backup:

```bash
mkdir -p /var/backups/star-byte
sqlite3 /var/lib/star-byte/starbyte.db \
  ".backup '/var/backups/star-byte/starbyte-$(date +%F-%H%M%S).db'"
cp -a /var/lib/star-byte/uploads /var/backups/star-byte/uploads
```

Example restore:

```bash
cp /var/backups/star-byte/starbyte-YYYY-MM-DD-HHMMSS.db /var/lib/star-byte/starbyte.db
cp -a /var/backups/star-byte/uploads /var/lib/star-byte/uploads
```

Stop the server before restoring. Test restore procedures before inviting users.

## Desktop Installers

Tauri builds installers without bundling the server or database. Install dependencies with `npm ci`, compile the repository with `npm run build`, then build the platform bundles:

```bash
# Linux runner
npm run tauri:build:linux --workspace @starbyte/web

# Windows runner
npm run tauri:build:windows --workspace @starbyte/web
```

Generated installers and signed updater artifacts are written below:

```text
apps/web/src-tauri/target/release/bundle/appimage/
apps/web/src-tauri/target/release/bundle/deb/
apps/web/src-tauri/target/release/bundle/nsis/
```

The repository workflow `.github/workflows/desktop-release.yml` runs `npm ci`, `npm run build`, and the platform-specific Tauri build on Linux and Windows runners. It uploads the generated bundle directories as CI artifacts.

## Signed Desktop Updates

The Tauri updater checks constellation without requiring login:

```text
GET /api/desktop/updates/:target/:arch/:currentVersion
```

The server reads update metadata from `DESKTOP_RELEASES_MANIFEST`, or from `desktop-releases.json` beside `DB_PATH` by default. Copy `apps/server/desktop-releases.example.json` to persistent storage and update it when publishing a release. Installer archives live under `/var/lib/star-byte/releases`; never store binaries or signing keys in SQLite.

The public updater key is committed in `apps/web/src-tauri/tauri.conf.json`. Store the private key content or its path only in the deployment secret `TAURI_SIGNING_PRIVATE_KEY`. If the key is password-protected, also set `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Losing the private key prevents existing clients from accepting future updates.

After generating the initial keypair, store the protected private key and password in the repository secrets without printing them:

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY < /tmp/star_byte-updater.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD < /tmp/star_byte-updater.password
```

Back up both values in an encrypted secret store before removing the temporary files. The Linux updater metadata should point to the generated `.AppImage`; the `.deb` remains available as an installer. Windows updater metadata should point to the generated NSIS `.exe`.

## Desktop Release Process

1. Update the version in `apps/web/src-tauri/tauri.conf.json`, `apps/web/src-tauri/Cargo.toml`, `apps/web/package.json`, and the root `package.json`.
2. Run the `desktop-release` workflow with `TAURI_SIGNING_PRIVATE_KEY` configured as a CI secret.
3. Download the Linux `AppImage` and `.deb`, Windows NSIS `.exe`, and generated `.sig` files from the workflow artifacts.
4. Upload installers and updater archives to `/var/lib/star-byte/releases/star_byte/<version>/` on constellation.
5. Update the persistent `desktop-releases.json` using `apps/server/desktop-releases.example.json` as the shape. Use the updater archive URLs and generated `.sig` contents.
6. For the first release, create a normal Room named `system` and a Thread named `star_byte updates`. Post release notes there from the Host account for every release.
7. Smoke test from an older installed client: check for updates in the account menu, install, restart, log in, confirm the displayed version, confirm WebSocket connection, and send a message.

The signing key generated during initial setup must be moved from `/tmp/star_byte-updater.key` into the CI/deployment secret store and removed from `/tmp` after that transfer. Never commit it.

## Launch Smoke Test

Run this with two accounts before each release:

1. Register and log in.
2. Edit profile and upload an avatar.
3. Create a Room and a Thread.
4. Generate a Room Pass and join from the second account.
5. Send, reply to, edit, and delete messages.
6. Upload a chat image.
7. Send a mention and confirm the notification.
8. Create a Whisper.
9. Reload both clients and confirm session restoration.
10. Restart the backend and confirm WebSocket reconnection or polling recovery.

## Known Deferred Work

- Room Passes currently use plaintext storage while the schema still contains `room_pass_hash`. Migrate this carefully without wiping live data.
- Sections are not implemented beyond the existing `section_id` compatibility column.
- The IRC bridge remains a no-op adapter.
