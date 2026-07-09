# Desktop Release Overview

star_byte has two separate release targets:

- `starbyte-server`: the constellation backend deployment for hosts/admins.
- `starbyte-client`: the Tauri desktop app installed by Windows and Linux users.

The React frontend exists because Tauri uses web assets. star_byte is not intended to be primarily a public web app.

## starbyte-server

`starbyte-server` contains the Fastify API, WebSocket server, SQLite access, uploads storage, release metadata/update endpoint, auth, Rooms, Room Passes, Threads, Sections compatibility data, Whispers, Messages, and notifications.

It is never distributed to normal users. It owns all source-of-truth data and must preserve the existing database, uploads, and release artifacts across updates.

Use [server-install.md](./server-install.md) for installation, update, backup, restore, and rollback.

## starbyte-client

`starbyte-client` contains the React UI assets and Tauri shell. It connects to constellation over HTTPS/WSS and receives signed updates through the Tauri updater.

It contains no source-of-truth Room/User/Thread/Whisper/Message database. It may store only local client state such as auth token, theme, window state, and temporary cache.

Use [client-release.md](./client-release.md) for Windows/Linux installer builds, signing, updater metadata, artifact publishing, and client smoke tests.

## Release Model

Pushes to `main` are CI-only for desktop release purposes. They must not create a GitHub Release, edit constellation `latest.json`, or update installed clients.

Server deploy and desktop release are separate operations:

- Backend deploy: run the server deploy script manually on constellation.
- Desktop test build: run the `desktop-release` workflow manually and inspect Actions artifacts.
- Desktop release: bump version, push matching `vMAJOR.MINOR.PATCH` tag, let GitHub create the Release, then explicitly publish from constellation after smoke testing.

The GitHub Release is not the updater activation point. Installed clients receive an update only after `/var/lib/starbyte/releases/latest.json` is atomically updated by the constellation-side publisher.

## Boundaries

- Do not use Electron.
- Do not bundle `starbyte-server` or SQLite inside `starbyte-client`.
- Do not move Room/User/Thread/Whisper/Message data into the Tauri client.
- Do not erase, recreate, or reset the live database.
- Any database change must be incremental and compatible with the current live DB.
- Store installer binaries and updater artifacts in `/var/lib/starbyte/releases`, not SQLite.
- Never give GitHub Actions SSH access to constellation for automatic deploys.
- Never overwrite artifacts for a version that has already been published.
