# Brief: installer multi-instance support (`akari-ctl`)

User 2026-10-27: "安装器支持多实例 这个可以做了" (PLAN-next 部署 item, scheduled 2026-10-13). The panel binary already
runs as several instances (shared PostgreSQL + Valkey + identical `data_dir`; HTTPS reverse proxy + gRPC L4
pass-through; docs/DEPLOY.md "Several panel instances"). `akari-ctl` only installs a single box. Do this AFTER the
installer UI PR (briefs/installer-ui.md) has merged, on top of it.

## Lead design decisions
1. **Topology**: instance 1 is a normal install. `akari-ctl expose-data --allow <cidr>[,…]` turns its PostgreSQL and
   Valkey into shared services: listen on the private address only, firewall/`pg_hba` limited to the given CIDRs,
   TLS on both (self-signed CA generated and stored under `/etc/akari/`; clients verify it), strong generated
   passwords. Alternative at install time: `--database-url` / `--valkey-url` to use operator-provided managed
   services (then nothing is installed locally for them). Never expose either on a public address (refuse a
   non-private `--allow`, explain why).
2. **Join without a network secret channel**: on instance 1 `akari-ctl join-bundle` writes ONE file =
   age-encrypted (passphrase, scrypt) tarball of `data_dir` secrets (CA key/cert, jwt.key, master.key, state.json),
   DB/Valkey URLs + their CA, panel version; the passphrase is generated and printed once (not logged). The
   operator copies the file (scp). On the new machine `install.sh --join <file>` (prompts for the passphrase on
   /dev/tty or `AKARI_JOIN_PASSPHRASE`), installs the same version, writes panel.toml (R39 keys only), checks
   DB/Valkey reachability + TLS, runs `config check`, starts, waits healthz. Bundle file is deleted after a
   successful join (and the installer warns to delete the copy on instance 1). Bundles expire (embedded
   created_at, refused after 24 h).
3. **Load balancer**: `akari-ctl lb-config caddy|haproxy|nginx --instances a,b,…` prints a ready config: HTTPS
   reverse proxy for web (health check `/healthz`) and L4 TCP pass-through for gRPC (agents' mTLS must reach the
   panel untouched). `web.trusted_proxies` on every instance must include the LB address — `lb-config` prints the
   exact `akari-ctl set-trusted-proxies` command. Caddy on-demand TLS `ask` stays per instance.
4. **Upgrades**: `akari-ctl upgrade` on a joined instance refuses unless `--rolling` and states the order:
   migrations are forward-only and run on the first upgraded instance, so upgrade instances one at a time, first
   instance first, and keep old instances running only if the release notes say the schema change is
   backward-compatible (add a `compat` flag to the release bundle metadata: `schema_compat_previous=true|false`;
   when false, `upgrade --rolling` tells the operator to stop the others first). Backups only on the instance that
   owns the database.
5. **Status**: `akari-ctl info` shows role (single / primary / joined), peers seen in Valkey
   (`akari:status:instances`, already published), shared-service endpoints.
6. **Tests (containers only, no real VPS — user ruling)**: extend `scripts/installer-test/` with a two-container
   e2e on a docker network: install A → expose-data → join-bundle → install B with --join → both healthy, a session
   from A works on B (shared jwt.key), an agent enrolled via A converges via B's gRPC, rolling upgrade A then B,
   refusal of a public `--allow` and of an expired bundle. New CI job in the `installer` group.
7. Docs: DEPLOY §4 rewritten around the commands; CLAUDE.md installer bullet updated.
