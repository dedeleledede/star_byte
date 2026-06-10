# Desktop Release

star_byte desktop releases are Tauri client bundles only. The Fastify constellation server and SQLite database stay on the server, and the live database must not be erased or recreated during a desktop release.

## Version Bump

Update the release version in these files:

- `package.json`
- `apps/web/package.json`
- `apps/web/src-tauri/tauri.conf.json`
- `apps/web/src-tauri/Cargo.toml`

The Tauri `productName` must remain `star_byte` and the identifier must remain `com.zavan.starbyte`.

## Release Environment

Desktop release builds need constellation URLs that do not point at localhost:

```dotenv
VITE_API_BASE_URL=https://constellation.example.com
VITE_WS_BASE_URL=wss://constellation.example.com
```

You can set those directly in CI or locally, or set `STARBYTE_DOMAIN=constellation.example.com` and let the build scripts derive the HTTPS and WSS URLs. The checked-in `apps/web/.env.desktop-production` is a fallback for local release builds.

The Tauri updater endpoint is injected during `npm run tauri:build --workspace @starbyte/web` as:

```text
https://<STARBYTE_DOMAIN>/api/desktop/updates/{{target}}/{{arch}}/{{current_version}}
```

## Signing

Tauri v2 signed updates require a public key in `apps/web/src-tauri/tauri.conf.json` and a private signing key at build time. The private key must never be committed.

Required CI secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, if the private key is password-protected

Generate the keypair from `apps/web` when bootstrapping release signing:

```bash
npm run tauri -- signer generate -w ~/.tauri/star_byte-updater.key
```

Store the private key and password in an encrypted secret store and in GitHub Secrets. Tauri’s updater signatures are generated during release builds when `bundle.createUpdaterArtifacts` is enabled and the signing env vars are present.

## Local Builds

Install dependencies and compile the workspace:

```bash
npm ci
npm run build
```

Build Linux bundles on Linux:

```bash
npm run tauri:build:linux --workspace @starbyte/web
```

Build Windows bundles on Windows:

```powershell
npm run tauri:build:windows --workspace @starbyte/web
```

The generic command also works and accepts Tauri build flags:

```bash
npm run tauri:build --workspace @starbyte/web -- --bundles appimage,deb
```

## Artifacts

Installer and updater artifacts are generated under:

```text
apps/web/src-tauri/target/release/bundle/appimage/
apps/web/src-tauri/target/release/bundle/deb/
apps/web/src-tauri/target/release/bundle/nsis/
```

Expected launch artifacts:

- Linux AppImage: `*.AppImage`
- Linux AppImage signature: `*.AppImage.sig`
- Linux Debian installer: `*.deb`
- Windows NSIS installer: `*-setup.exe`
- Windows NSIS signature: `*-setup.exe.sig`

For Tauri v2 updater metadata, point Linux updates at the AppImage and Windows updates at the NSIS `.exe`. The `.deb` is published for manual installation, not as the primary updater target.

## GitHub Actions

The workflow at `.github/workflows/desktop-release.yml` builds on Linux and Windows runners. Configure one of these repository variable sets:

- `STARBYTE_DOMAIN`
- `VITE_API_BASE_URL` and `VITE_WS_BASE_URL`

The workflow uploads the generated bundle directories as Actions artifacts. It reads updater signing material from GitHub Secrets and does not print the private key.

## Constellation Release Storage

Do not store installers or updater binaries in SQLite. Upload them to persistent constellation storage, for example:

```text
/var/lib/star-byte/releases/
  latest.json
  star_byte/0.1.1/
    star_byte_0.1.1_amd64.AppImage
    star_byte_0.1.1_amd64.AppImage.sig
    star_byte_0.1.1_amd64.deb
    star_byte_0.1.1_x64-setup.exe
    star_byte_0.1.1_x64-setup.exe.sig
```

Back up this release directory with the SQLite database and uploads directory.

Set `DESKTOP_RELEASES_MANIFEST=/var/lib/star-byte/releases/latest.json`, or let the server use its default `releases/latest.json` beside `DB_PATH`.

Example `latest.json`:

```json
{
  "version": "0.1.1",
  "notes": "Release notes shown before the user installs the update.",
  "pub_date": "2026-06-10T00:00:00.000Z",
  "platforms": {
    "linux-x86_64": {
      "url": "https://constellation.example.com/releases/star_byte/0.1.1/star_byte_0.1.1_amd64.AppImage",
      "signature": "contents-of-AppImage.sig"
    },
    "windows-x86_64": {
      "url": "https://constellation.example.com/releases/star_byte/0.1.1/star_byte_0.1.1_x64-setup.exe",
      "signature": "contents-of-setup-exe.sig"
    }
  }
}
```

The public update route is:

```text
GET /api/desktop/updates/:target/:arch/:currentVersion
```

It returns `204 No Content` when no update is available, or Tauri-compatible JSON when the manifest contains a newer version for the requested platform.

## Testing Updates

Install an older signed desktop build, publish a newer `latest.json`, then use the account menu in the app:

1. Click `Check for updates`.
2. Confirm `Update available`, version, and release notes appear.
3. Click `Install update`.
4. Confirm the app relaunches into the new version.
5. Log in, confirm WebSocket connection, send a message, and upload a small image.

Also test the no-update path by setting `currentVersion` equal to `latest.json.version` and confirming the app shows `star_byte is up to date.`

## User Release Notes

For the MVP announcement path, create a normal Room named `system` and a Thread named `star_byte updates`. The host/admin posts release notes there before publishing each desktop update. Users read those notes through the same server-backed messages as all other chat data, so no Room/User/Message data becomes local desktop source-of-truth.
