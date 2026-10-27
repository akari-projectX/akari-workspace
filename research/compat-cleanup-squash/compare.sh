#!/bin/sh
# Compare two migrated databases: schema (normalised pg_dump diff) and seed rows.
# Usage: compare.sh OLD_DB NEW_DB   (both on the dev PostgreSQL 18 container)
set -eu
here=$(cd "$(dirname "$0")" && pwd)
c=${CONTAINER:-subtpl-postgres-1}
mkdir -p "$here/out"
# The old chain's dump is round-tripped (restored into a scratch database and
# dumped again, after the intentional renames of constraint/sequence names that
# kept a pre-rename table name): the parser flattens nested AND chains and
# PostgreSQL sorts constraints by name, so both sides go through the same
# canonical form. The new baseline's dump is compared as dumped.
docker exec "$c" pg_dump -U akari --schema-only --no-owner --no-privileges "$1" >"$here/out/old.raw.sql"
sed -E 's/node_alerts_/server_alerts_/g; s/node_latency_/server_latency_/g; s/node_metrics_/server_metrics_/g; s/node_enrollments_/server_enrollments_/g; s/rollout_nodes_/rollout_servers_/g; s/ CONSTRAINT [A-Za-z0-9_]+ NOT NULL/ NOT NULL/' \
	"$here/out/old.raw.sql" | grep -v '^\\' >"$here/out/old.renamed.sql"
docker exec "$c" psql -X -q -U akari -d postgres -c "DROP DATABASE IF EXISTS cmp_roundtrip WITH (FORCE)" -c "CREATE DATABASE cmp_roundtrip" >/dev/null
docker exec -i "$c" psql -X -q -v ON_ERROR_STOP=1 -U akari -d cmp_roundtrip <"$here/out/old.renamed.sql" >/dev/null
docker exec "$c" pg_dump -U akari --schema-only --no-owner --no-privileges cmp_roundtrip >"$here/out/old.schema.sql"
docker exec "$c" pg_dump -U akari --schema-only --no-owner --no-privileges "$2" >"$here/out/new.schema.sql"
for k in old new; do
	python3 "$here/normalise.py" "$here/out/$k.schema.sql" >"$here/out/$k.norm.sql"
done
docker exec "$c" psql -X -q -U akari -d postgres -c "DROP DATABASE cmp_roundtrip WITH (FORCE)" >/dev/null
if diff -u "$here/out/old.norm.sql" "$here/out/new.norm.sql" >"$here/out/schema.diff"; then
	echo "SCHEMA: identical ($(grep -c '^## ' "$here/out/new.norm.sql") objects)"
else
	echo "SCHEMA: DIFFERENT, see out/schema.diff"; head -80 "$here/out/schema.diff"; exit 1
fi
seed() { # DB: one JSON line per row of every non-empty table, timestamps masked, ids of random-uuid tables masked
	docker exec "$c" psql -X -At -U akari -d "$1" -c "
	DO \$\$ BEGIN END \$\$;
	SELECT t || ' ' || r FROM (
	  SELECT 'access_settings' t, to_jsonb(x)::text r FROM access_settings x UNION ALL
	  SELECT 'agent_update_settings', to_jsonb(x)::text FROM agent_update_settings x UNION ALL
	  SELECT 'alert_settings', to_jsonb(x)::text FROM alert_settings x UNION ALL
	  SELECT 'auth_settings', to_jsonb(x)::text FROM auth_settings x UNION ALL
	  SELECT 'cleanup_settings', to_jsonb(x)::text FROM cleanup_settings x UNION ALL
	  SELECT 'commission_settings', to_jsonb(x)::text FROM commission_settings x UNION ALL
	  SELECT 'mail_settings', to_jsonb(x)::text FROM mail_settings x UNION ALL
	  SELECT 'panel_settings', to_jsonb(x)::text FROM panel_settings x UNION ALL
	  SELECT 'signup_settings', to_jsonb(x)::text FROM signup_settings x UNION ALL
	  SELECT 'site_branding', to_jsonb(x)::text FROM site_branding x UNION ALL
	  SELECT 'block_rules', to_jsonb(x)::text FROM block_rules x UNION ALL
	  SELECT 'announcement_tags', (to_jsonb(x) - 'id')::text FROM announcement_tags x
	) s ORDER BY 1" | sed -E 's/"(updated_at|created_at)": "[^"]*"/"\1": "TS"/g'
}
seed "$1" >"$here/out/old.seed.txt"
seed "$2" >"$here/out/new.seed.txt"
if diff -u "$here/out/old.seed.txt" "$here/out/new.seed.txt"; then
	echo "SEED: identical ($(wc -l <"$here/out/new.seed.txt") rows in 12 tables)"
else
	echo "SEED: DIFFERENT"; exit 1
fi
# Tables that must be empty in both.
for db in "$1" "$2"; do "$here/counts.sh" "$db" | tr '\n' ';'; echo; done
