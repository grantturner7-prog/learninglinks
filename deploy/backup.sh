#!/usr/bin/env bash
# One backup: a compressed database dump plus the profile photos, then delete copies older than KEEP_DAYS.
# Environment: PG* variables for the database (PGHOST, PGUSER, PGPASSWORD, PGDATABASE), BACKUP_DIR, UPLOAD_DIR, KEEP_DAYS.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:?BACKUP_DIR is required}"
UPLOAD_DIR="${UPLOAD_DIR:-}"
KEEP_DAYS="${KEEP_DAYS:-14}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

tmp="$BACKUP_DIR/.db-$stamp.sql.gz.part"
pg_dump --no-owner --no-privileges | gzip -9 > "$tmp"
# A dump that is suspiciously small means something went wrong: keep nothing rather than a bad backup.
if [ "$(stat -c %s "$tmp")" -lt 200 ]; then rm -f "$tmp"; echo "backup too small, discarded" >&2; exit 1; fi
mv "$tmp" "$BACKUP_DIR/db-$stamp.sql.gz"

if [ -n "$UPLOAD_DIR" ] && [ -d "$UPLOAD_DIR" ]; then
  tar -czf "$BACKUP_DIR/uploads-$stamp.tar.gz" -C "$UPLOAD_DIR" .
fi

find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.sql.gz' -o -name 'uploads-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
echo "backup $stamp done"
