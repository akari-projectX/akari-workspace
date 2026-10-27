# Migration squash, 2026-10-27 (compat cleanup phase 3)

All of `akari-panel/migrations/1000_baseline.sql` … `1125` were replaced by ONE file,
`migrations/0001_baseline.sql` (version 1: `db::migrate` has no version guard any more, the next
number is last + 1). The file is produced, not hand-merged, and checked against the old chain.

## Steps

1. `apply-chain.sh chain_a <old migrations dir>`: the old chain (origin/main's migrations plus the
   cleanup migration `1125_compat_cleanup.sql` of the same PR: hash/ciphertext pair CHECK, trigger
   removal, `legacy_config_imports`, `grpc_server_names` 'config', `nodes.tags`, enrollment NOT NULL)
   applied to a scratch database on the dev PostgreSQL 18, one transaction per file like sqlx.
2. `pg_dump --schema-only` of it, then `gen-baseline.py out/chain_a.schema.sql <old migrations dir>` (the old files are read only for their comments) regroups the dump by domain (types,
   functions, 13 table groups with their constraints/indexes/triggers, foreign keys, seed rows),
   removes `public.`, removes NOT NULL constraint names that survived table renames
   (`node_alerts_id_not_null` on `server_alerts`), spells constraint/sequence names that kept a
   pre-rename table name correctly (`node_alerts_*` -> `server_alerts_*`, `node_latency_*`,
   `node_metrics_*`, `node_enrollments_*`, `rollout_nodes_*`), drops the month partitions (they are
   created by `SELECT akari_ensure_traffic_partitions(1, 2)` at the end, like 1033 did, plus the
   DEFAULT partition) and carries over the comments that explained an object in the migration that
   created it (column comments only when they name the column; anything mentioning migrations,
   workstream ids or removed objects is dropped). Seed rows: `seed.sql` (12 tables).
3. `apply-chain.sh chain_b out/newchain`: the new baseline on a second scratch database.
4. `compare.sh chain_a chain_b`:
   * schema: both dumps are normalised (`normalise.py`: header and SET lines removed, NOT NULL
     names removed, objects sorted by (type, name)). The OLD dump is first round-tripped (restored
     into a third scratch database after applying the intentional renames, dumped again) so that
     PostgreSQL's own canonical forms apply to both sides (it flattens nested `AND` chains in CHECK
     expressions and orders constraints by name). Result: **identical, 456 objects**.
   * seed rows: `to_jsonb` of every row of the 12 seeded tables, timestamps masked, announcement tag
     ids (random uuids) dropped. Result: **identical, 22 rows**. All other tables are empty in both.
   * non-vacuity: dropping an index or changing a seed row in `chain_b` makes the script fail.
5. `compare.sh chain_main chain_b` with `chain_main` = origin/main's chain WITHOUT the cleanup
   migration: the only differences are the intended cleanup (`main-chain-vs-baseline.diff`).
6. The panel's whole test suite (real-DB tests, one schema per test, migrated from the new baseline).

Differences accepted on purpose (all names, no behaviour): the constraint/sequence names listed in
step 2; NOT NULL constraints are default-named.

## Files

`apply-chain.sh`, `gen-baseline.py` (+ `seed.sql`), `normalise.py`, `compare.sh`, `counts.sh`,
`main-chain-vs-baseline.diff`. Needs the dev PostgreSQL 18 container (`docker exec`, container name
via `CONTAINER`, default `subtpl-postgres-1`) and `python3`.
