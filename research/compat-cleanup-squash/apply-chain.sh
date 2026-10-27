#!/bin/sh
# Apply a directory of numbered migrations to a fresh scratch database on the
# dev PostgreSQL 18 container, the way sqlx does (version order, one
# transaction per file). Usage: apply-chain.sh DBNAME MIGRATIONS_DIR [CONTAINER]
set -eu
db=$1 dir=$2 c=${3:-subtpl-postgres-1}
psqlc() { docker exec -i "$c" psql -X -q -v ON_ERROR_STOP=1 -U akari "$@"; }
psqlc -d postgres -c "DROP DATABASE IF EXISTS $db WITH (FORCE)" -c "CREATE DATABASE $db"
for f in $(ls "$dir"/*.sql | sort); do
	psqlc -d "$db" -1 <"$f" >/dev/null || { echo "FAILED: $f" >&2; exit 1; }
done
echo "applied $(ls "$dir"/*.sql | wc -l) files to $db"
