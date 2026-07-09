#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${STARBYTE_APP_DIR:-/opt/starbyte/server}"
SERVICE_NAME="${STARBYTE_SERVICE_NAME:-starbyte-server}"
BACKUP_DIR="${STARBYTE_BACKUP_DIR:-/var/backups/starbyte}"
DATA_DIR="${STARBYTE_DATA_DIR:-/var/lib/starbyte}"
DB_PATH="${STARBYTE_DB_PATH:-$DATA_DIR/starbyte.db}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "Repository not found at $APP_DIR" >&2
  exit 1
fi

timestamp="$(date +%F-%H%M%S)"
backup_path="$BACKUP_DIR/$timestamp"

echo "Creating backup at $backup_path"
mkdir -p "$backup_path"

if [[ -f "$DB_PATH" ]]; then
  sqlite3 "$DB_PATH" ".backup '$backup_path/starbyte.db'"
else
  echo "Database not found at $DB_PATH" >&2
  exit 1
fi

if [[ -d "$DATA_DIR/uploads" ]]; then
  tar -C "$DATA_DIR" -czf "$backup_path/uploads.tgz" uploads
fi

if [[ -d "$DATA_DIR/releases" ]]; then
  tar -C "$DATA_DIR" -czf "$backup_path/releases.tgz" releases
fi

cd "$APP_DIR"

echo "Updating repository"
git pull --ff-only

echo "Installing dependencies"
npm ci

echo "Running server tests"
npm run test --workspace @starbyte/server

echo "Building server"
npm run build --workspace @starbyte/server

echo "Restarting $SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo "Checking health"
curl -fsS http://127.0.0.1:3001/health

echo "Backend deploy complete. Backup kept at $backup_path"
