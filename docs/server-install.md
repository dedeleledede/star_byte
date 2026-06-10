# starbyte-server Install

`starbyte-server` is the constellation backend for hosts and admins. It runs the Fastify API, WebSocket server, SQLite access, uploads storage, release metadata/update endpoint, auth, Rooms, Room Passes, Threads, Sections compatibility data, Whispers, Messages, and notifications.

`starbyte-server` is never distributed to normal desktop users. It owns all source-of-truth data and must preserve the existing SQLite database, uploads, and release artifacts across updates.

## Standard Layout

Use persistent server paths:

```text
/opt/starbyte/server
/etc/starbyte/starbyte.env
/var/lib/starbyte/starbyte.db
/var/lib/starbyte/uploads
/var/lib/starbyte/releases
/var/backups/starbyte
```

The server stores uploaded files next to `DB_PATH` in `uploads`. Desktop installer binaries and updater signatures live in `/var/lib/starbyte/releases`; they are not stored in SQLite.

## Environment

Create `/etc/starbyte/starbyte.env`:

```dotenv
NODE_ENV=production
PORT=3001
HOST=127.0.0.1
DB_PATH=/var/lib/starbyte/starbyte.db
STARBYTE_RELEASES_DIR=/var/lib/starbyte/releases
CLIENT_ORIGIN=https://starbyte.example.com
JWT_SECRET=replace-with-a-long-random-secret
TRUST_PROXY=true
```

Production startup rejects missing `DB_PATH`, missing `CLIENT_ORIGIN`, and a missing/default `JWT_SECRET`.

## Install With systemd

Install Node 22 LTS, Git, SQLite tools, and build dependencies for `better-sqlite3`.

Create a service user and directories:

```bash
sudo useradd --system --home /opt/starbyte --shell /usr/sbin/nologin starbyte
sudo mkdir -p /opt/starbyte/server /etc/starbyte /var/lib/starbyte/uploads /var/lib/starbyte/releases /var/backups/starbyte
sudo chown -R starbyte:starbyte /opt/starbyte /var/lib/starbyte /var/backups/starbyte
sudo chmod 750 /etc/starbyte
```

Deploy the repo to `/opt/starbyte/server`, then install and build:

```bash
cd /opt/starbyte/server
sudo -u starbyte npm ci
sudo -u starbyte npm run build --workspace @starbyte/server
```

Install the env and service examples:

```bash
sudo cp deploy/systemd/starbyte.env.example /etc/starbyte/starbyte.env
sudo editor /etc/starbyte/starbyte.env
sudo cp deploy/systemd/starbyte-server.service /etc/systemd/system/starbyte-server.service
sudo systemctl daemon-reload
sudo systemctl enable --now starbyte-server
```

## Service Commands

```bash
sudo systemctl start starbyte-server
sudo systemctl stop starbyte-server
sudo systemctl restart starbyte-server
sudo systemctl status starbyte-server
journalctl -u starbyte-server -f
```

Health check:

```bash
curl -fsS http://127.0.0.1:3001/health
```

## Reverse Proxy

Terminate HTTPS at Nginx or another trusted reverse proxy. Forward `/api/`, `/ws`, and `/health` to `127.0.0.1:3001`. Serve release artifacts from the persistent release directory:

```nginx
location /releases/ {
    alias /var/lib/starbyte/releases/;
}
```

Set `TRUST_PROXY=true` only when the Fastify server is reachable exclusively through the trusted proxy.

## Safe Server Update

Do not wipe `/var/lib/starbyte`. Server startup runs the existing incremental DB ensure logic and must be allowed to preserve current data.

1. Back up `/var/lib/starbyte` and `/etc/starbyte/starbyte.env`.
2. Pull the new code or deploy the new release to `/opt/starbyte/server`.
3. Run `npm ci`.
4. Run `npm run build --workspace @starbyte/server`.
5. Restart with `sudo systemctl restart starbyte-server`.
6. Check `curl -fsS http://127.0.0.1:3001/health`.
7. Smoke test login, Room list, message send, image upload, notification, and WebSocket reconnect.
8. Keep the backup until the release is verified.

Rollback is the same process in reverse: stop the service, restore the previous code build, restore data only if the bad release modified data incorrectly, then restart and smoke test. Prefer code rollback without data restore when the database is healthy.

## Backup

Use SQLite’s backup command so the service can stay online:

```bash
sudo mkdir -p /var/backups/starbyte
backup_dir="/var/backups/starbyte/$(date +%F-%H%M%S)"
sudo mkdir -p "$backup_dir"
sudo sqlite3 /var/lib/starbyte/starbyte.db ".backup '$backup_dir/starbyte.db'"
sudo tar -C /var/lib/starbyte -czf "$backup_dir/uploads.tgz" uploads
sudo tar -C /var/lib/starbyte -czf "$backup_dir/releases.tgz" releases
sudo cp /etc/starbyte/starbyte.env "$backup_dir/starbyte.env"
sudo chmod 600 "$backup_dir/starbyte.env"
```

Treat the copied env file as sensitive because it contains `JWT_SECRET`.

## Restore

Stop the service first:

```bash
sudo systemctl stop starbyte-server
```

Restore the selected backup:

```bash
backup_dir=/var/backups/starbyte/YYYY-MM-DD-HHMMSS
sudo cp "$backup_dir/starbyte.db" /var/lib/starbyte/starbyte.db
sudo tar -C /var/lib/starbyte -xzf "$backup_dir/uploads.tgz"
sudo tar -C /var/lib/starbyte -xzf "$backup_dir/releases.tgz"
sudo chown -R starbyte:starbyte /var/lib/starbyte
```

Restore `/etc/starbyte/starbyte.env` only when needed, and preserve its secret permissions:

```bash
sudo cp "$backup_dir/starbyte.env" /etc/starbyte/starbyte.env
sudo chmod 600 /etc/starbyte/starbyte.env
```

Restart and test:

```bash
sudo systemctl start starbyte-server
curl -fsS http://127.0.0.1:3001/health
```

Then verify login, Room list, message send, uploads, release metadata, and update checks.
