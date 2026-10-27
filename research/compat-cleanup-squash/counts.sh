#!/bin/sh
# Row counts of every table (non-empty ones are the seed rows). Usage: counts.sh DB
c=${2:-subtpl-postgres-1}
docker exec -i "$c" psql -X -At -U akari -d "$1" -c "
SELECT format('%I', c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND NOT c.relispartition AND c.relname <> '_sqlx_migrations' ORDER BY 1" |
while read -r t; do
	n=$(docker exec "$c" psql -X -At -U akari -d "$1" -c "SELECT count(*) FROM $t")
	[ "$n" = 0 ] || echo "$t $n"
done
