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

## Boundaries

- Do not use Electron.
- Do not bundle `starbyte-server` or SQLite inside `starbyte-client`.
- Do not move Room/User/Thread/Whisper/Message data into the Tauri client.
- Do not erase, recreate, or reset the live database.
- Any database change must be incremental and compatible with the current live DB.
- Store installer binaries and updater artifacts in `/var/lib/starbyte/releases`, not SQLite.
