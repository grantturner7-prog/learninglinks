#!/usr/bin/env bash
# Restore a database dump made by backup.sh into the database named by the PG* variables.
# THIS REPLACES EVERYTHING IN THAT DATABASE. Usage: restore.sh /path/to/db-YYYYMMDDTHHMMSSZ.sql.gz
set -euo pipefail

file="${1:?usage: restore.sh <db-dump.sql.gz>}"
[ -f "$file" ] || { echo "no such file: $file" >&2; exit 1; }
db="${PGDATABASE:?PGDATABASE is required}"

echo "Restoring $file into database '$db' (this replaces its contents)."
psql -v ON_ERROR_STOP=1 -d "$db" -q -c "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;"
gunzip -c "$file" | psql -v ON_ERROR_STOP=1 -d "$db" -q
echo "Restore finished."
