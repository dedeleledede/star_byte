# starbyte-client Release

`starbyte-client` is the Tauri desktop app installed by Windows and Linux users. It contains React UI assets plus the Tauri shell, connects to constellation over HTTPS/WSS, and receives signed updates through the Tauri updater.

It must not bundle `starbyte-server`, SQLite, uploads, or source-of-truth Room/User/Thread/Whisper/Message data. Local storage is limited to client state such as auth token, theme, window state, and temporary cache.

## Release Rule

A normal push to `main` may run CI, but it must not create a desktop release, edit `latest.json`, deploy constellation, or update clients.

Backend deploy is independent from desktop release. Deploying `starbyte-server` must not change the desktop client version or updater manifest.

Desktop release is deliberate:

1. Bump to a new version.
2. Commit the version bump.
3. Create and push matching tag `v<version>`.
4. GitHub Actions builds artifacts and creates a GitHub Release.
5. The operator smoke tests artifacts.
6. The operator explicitly publishes from the constellation host.
7. Only the publish command atomically updates `/var/lib/starbyte/releases/latest.json`.

A GitHub Release alone does not activate auto-update. Clients see the update only after `latest.json` is updated on constellation.

## Versioning

The root `package.json` version is the logical source for project versioning. Do not edit individual version files manually unless you are repairing a failed version bump.

Check synchronized versions:

```bash
npm run version:check
```

Set a new desktop version:

```bash
npm run version:set -- 0.1.1
npm run version:check
```

The version must be `MAJOR.MINOR.PATCH`; prerelease versions are intentionally not supported yet.

Tracked files:

- `package.json`
- `apps/server/package.json`
- `apps/web/package.json`
- `apps/web/src-tauri/tauri.conf.json`
- `apps/web/src-tauri/Cargo.toml`
- `apps/web/src-tauri/Cargo.lock`
- `package-lock.json`

Do not change the current `0.1.0` version unless you are intentionally preparing a new release commit.

## Build Environment

Desktop production builds must point to constellation, not localhost:

```dotenv
VITE_API_BASE_URL=https://starbyte.example.com
VITE_WS_BASE_URL=wss://starbyte.example.com
```

Or configure one domain:

```dotenv
STARBYTE_DOMAIN=starbyte.example.com
```

The desktop build helper derives HTTPS/WSS URLs from `STARBYTE_DOMAIN`. Release builds reject localhost, `.local`, non-HTTPS API URLs, and non-WSS WebSocket URLs.

## Signing

Signed Tauri updater artifacts are required. The public updater key is committed in `apps/web/src-tauri/tauri.conf.json`. Never commit the private signing key.

GitHub Secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, if the key is password-protected

GitHub Variables, choose either one domain or explicit URLs:

- `STARBYTE_DOMAIN`
- `VITE_API_BASE_URL`
- `VITE_WS_BASE_URL`

No SSH key or constellation deploy secret is needed in GitHub Actions.

## CI

`.github/workflows/ci.yml` runs on push/PR:

```text
npm ci
npm run version:check
npm test
npm run build
```

This workflow does not sign updater artifacts, create releases, upload binaries to constellation, or edit `latest.json`.

## Test Build

Use the `desktop-release` workflow with `Run workflow` for a manual test build.

This produces GitHub Actions artifacts only. It does not create a GitHub Release and does not publish an update to clients.

Local build commands are still useful for debugging:

```bash
npm ci
npm run build
npm run tauri:build --workspace @starbyte/web -- --bundles appimage,deb
```

Windows NSIS build on Windows:

```powershell
npm run tauri:build --workspace @starbyte/web -- --bundles nsis
```

The NSIS installer uses `bundle.windows.nsis.installMode = "perMachine"`, so Windows installs under `Program Files` and requires elevation. This is separate from `plugins.updater.windows.installMode`, which controls updater behavior and remains passive.

## New Desktop Release

Use a new version for every desktop client change. Do not overwrite a previously published version.

```bash
npm run version:set -- 0.1.1
npm run version:check
git add package.json package-lock.json apps/server/package.json apps/web/package.json apps/web/src-tauri/tauri.conf.json apps/web/src-tauri/Cargo.toml apps/web/src-tauri/Cargo.lock
git commit -m "Release star_byte 0.1.1"
git tag v0.1.1
git push
git push origin v0.1.1
```

For tag builds, `.github/workflows/desktop-release.yml` validates that `v0.1.1` matches the project version `0.1.1`. A mismatch fails before release creation.

The release job runs only for tags and only after required builds finish. It creates a GitHub Release with these public assets:

```text
star_byte_<version>_x64-setup.exe
star_byte_<version>_x64-setup.exe.sig
star_byte_<version>_portable_x64.zip
star_byte_<version>_amd64.AppImage
star_byte_<version>_amd64.AppImage.sig
star_byte_<version>_amd64.deb
star_byte-<version>-1-x86_64.pkg.tar.zst
```

Intermediate AppDir or bundle debug output may exist as Actions artifacts, but only final normalized files are attached to the GitHub Release.

## Windows Portable

The portable artifact is `star_byte_<version>_portable_x64.zip`. It contains the built Tauri client executable and does not install into `Program Files`.

It does not contain the backend, server SQLite database, uploads, or Room/User/Thread/Whisper/Message data. It may require the Microsoft WebView2 runtime on machines where WebView2 is not already installed.

The portable build is not the updater target. `downloadAndInstall` continues to use the signed NSIS setup executable on Windows. Portable users may be shown that a new version exists, but the portable artifact should be downloaded explicitly rather than silently converted into an installed NSIS app.

## Publish To Constellation

Run publication only on the constellation host after testing the GitHub Release artifacts.

Dry run:

```bash
sudo -u starbyte node \
  /opt/starbyte/server/deploy/release/publish-from-github.mjs \
  0.1.1 --dry-run
```

Publish:

```bash
sudo -u starbyte node \
  /opt/starbyte/server/deploy/release/publish-from-github.mjs \
  0.1.1
```

Optional status check:

```bash
cd /opt/starbyte/server
sudo -u starbyte npm run release:status -- 0.1.1
```

Publication uses the public GitHub Release. It does not require a private token for public repositories, though `GITHUB_TOKEN` may be set for rate-limit headroom.

Environment on constellation:

```dotenv
STARBYTE_RELEASES_DIR=/var/lib/starbyte/releases
STARBYTE_DOMAIN=starbyte.example.com
# or STARBYTE_RELEASES_PUBLIC_BASE_URL=https://starbyte.example.com/releases
```

The publisher:

1. Validates the version.
2. Fetches GitHub Release metadata for `v<version>`.
3. Validates required asset names.
4. Downloads into a staging directory.
5. Verifies updater `.sig` files are present and nonempty.
6. Refuses to overwrite an existing version directory.
7. Promotes artifacts into `/var/lib/starbyte/releases/star_byte/<version>/`.
8. Validates public updater URLs.
9. Updates stable aliases.
10. Writes and validates `latest.json.tmp`.
11. Renames `latest.json.tmp` to `latest.json` on the same filesystem.

If publication fails before the final rename, the previous `latest.json` remains active and clients keep seeing the previous release.

Stable aliases created in `/var/lib/starbyte/releases`:

```text
star_byte_latest_x64-setup.exe
star_byte_latest_portable_x64.zip
star_byte_latest_amd64.AppImage
star_byte_latest_amd64.deb
star_byte_latest_arch.pkg.tar.zst
```

## latest.json

The updater manifest remains compatible with the existing backend endpoint:

```text
GET /api/desktop/updates/:target/:arch/:currentVersion
```

Generated shape:

```json
{
  "version": "0.1.1",
  "notes": "Release notes from the GitHub Release.",
  "pub_date": "2026-07-08T00:00:00.000Z",
  "platforms": {
    "linux-x86_64": {
      "url": "https://starbyte.example.com/releases/star_byte/0.1.1/star_byte_0.1.1_amd64.AppImage",
      "signature": "contents-of-AppImage.sig"
    },
    "windows-x86_64": {
      "url": "https://starbyte.example.com/releases/star_byte/0.1.1/star_byte_0.1.1_x64-setup.exe",
      "signature": "contents-of-setup-exe.sig"
    }
  }
}
```

The portable ZIP, `.deb`, and Arch package are download artifacts only. They are not added to updater platforms.

## Backend Deploy

Backend deployment is separate from desktop release.

Normal code flow:

```bash
git push
```

On constellation:

```bash
sudo /opt/starbyte/deploy-server.sh
```

Install that wrapper from the repository if needed:

```bash
sudo install -m 755 /opt/starbyte/server/deploy/server/deploy-server.sh /opt/starbyte/deploy-server.sh
```

The deploy script backs up `/var/lib/starbyte`, pulls with `git pull --ff-only`, runs server tests/build, restarts systemd, and checks `/health`. It must not wipe DB, uploads, release artifacts, env files, or `latest.json`.

## Hotfix

Backend-only hotfix:

1. Commit and push backend fix.
2. Run `sudo /opt/starbyte/deploy-server.sh` on constellation.
3. Do not bump desktop version.
4. Do not create a desktop tag.
5. Do not publish `latest.json`.

Desktop hotfix:

1. Bump patch version, for example `0.1.0` to `0.1.1`.
2. Create tag `v0.1.1`.
3. Build and publish using the normal desktop release flow.
4. Never overwrite the `0.1.0` artifacts.

## Rollback

Backend rollback should prefer code rollback without restoring data if the live DB is healthy. Restore `/var/lib/starbyte` only if data was corrupted and only from a verified backup.

Desktop updater rollback is controlled by `latest.json`. To stop a bad update, atomically restore the previous `latest.json` from backup or replace it with a manifest pointing to a previous version whose artifacts still exist under `/var/lib/starbyte/releases/star_byte/<version>/`.

Do not delete users, Rooms, Threads, Whispers, Messages, uploads, or release artifacts as part of rollback.

## User-Facing Release Notes

MVP release notes are posted as normal messages:

1. Create a Room named `system` or equivalent host-owned room.
2. Create a Thread named `star_byte updates`.
3. Host/Admin posts release notes there before publishing the desktop update.

The GitHub Release notes are also copied into `latest.json` and shown by the in-app updater before install.

## Smoke Test

Before publishing `latest.json`:

1. Install Windows NSIS build and confirm it installs under `Program Files` with elevation.
2. Run Windows portable ZIP and confirm it does not install or create server data.
3. Run Linux AppImage.
4. Install Linux `.deb`.
5. Install Arch `pkg.tar.zst` on Arch and confirm it uses system WebKitGTK.
6. Log in against constellation.
7. Confirm Room list loads from server.
8. Send, edit, and delete a message.
9. Check WebSocket delivery.
10. Open account/settings and manually check for updates from an older installed client.
11. Confirm update version and notes display.
12. Install update only after the user clicks `Install update`.
