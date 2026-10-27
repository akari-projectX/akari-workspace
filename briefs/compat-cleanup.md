# Brief: full compatibility-code cleanup (panel + agent)

User 2026-10-27: "不要留下技术债务，否则导致项目越来越臃肿" → "做一遍全面的兼容代码清理". New project: no deployed data
or nodes to stay compatible with, EXCEPT the agent⇄panel protocol must keep working between the panel on main and
the CURRENT released agent (v0.6.x, protocol 8) and the agent on main (v0.6.1 to be, protocol 8). Everything that
exists only for older panels, older agents, older configs, older databases, older URLs, older clients or older
installs is deleted. Only deletions (and the minimal edits that deletion forces); behaviour for current versions
unchanged. When in doubt whether something is compatibility or a real feature, list it under "kept, ask lead".

## Method
1. **Inventory first** (commit it as `research/compat-cleanup-2026-10.md` in akari-workspace, not in the repo):
   grep both repos for legacy/compat/old/deprecated/obsolete/fallback/pre-NNNN/v0.x/protocol checks/capability
   gates/"older"/"until"/migrations of old data/renames on startup/redirect aliases, and read CLAUDE.md files for
   documented compat behaviour. For each item: location, what it is for, why it is safe to delete now, what else
   goes with it (tests, smoke sections, docs, error codes, i18n keys, settings, columns/tables, CI steps).
2. Delete in focused commits by area. Each commit compiles and its tests pass.
3. Update every doc that described the removed behaviour (CLAUDE.md files, DEPLOY, REFERENCE, PAYMENTS, PERF notes
   if they reference removed paths) — remove, don't annotate "removed".

## Known candidates (verify each; the list is not exhaustive)
Panel:
- panel.toml obsolete keys: `config::OBSOLETE`, `Legacy` parsing, `settings::import_legacy`,
  `legacy_config_imports` table, `[payments.alipay]` import, `install.public_url` import; `config check` listing.
  (Unknown keys in panel.toml then simply fail `deny_unknown_fields` — that is the desired behaviour.)
- `totp.key` → `master.key` rename at startup.
- `data/state.json` prefix import on first start (`access::ensure`) — if the installer can write the prefix to the DB
  directly (or the panel generates it on first start), remove state.json; keep only what a fresh install needs.
- Old payment notify path `/pay/alipay/notify` (keep `/pay/{method_id}/notify`), pre-0140 order attribution.
- Subscription token `Stored::Legacy` (hash-only tokens from before 0120) and the 0120 trigger branch for it.
- Agent protocol floor → 8: `MIN_AGENT_PROTOCOL` = 8; delete SS2022 tombstone rules for protocol 5–7
  (`SS_TOMBSTONE_PROTOCOL`, `drops_credential_digest`/`rotates_credential_digest` old branches, shrink_unsafe paths),
  protocol <3 UpdateOffer gating, <4 speed-limit warnings, <6 ACME refusal (`refuse_acme_for_old_agent`),
  `nodestat::legacy_presence`, `stale-units` warning + updater W23 fallback (panel `deploy/systemd/` copies and the
  `nodeinstall.rs` include_str fallback for releases without `-print-unit` — the agent's embedded units are the only
  source; drop the agent CI/panel CI byte-compare jobs for those copies), Alpine "old release without OpenRC script"
  refusal, smoke `need_agent` gates whose capability every protocol-8 agent has.
- Migrations: squash `1000_baseline.sql` + 1010…latest into ONE new baseline (new project, no existing DBs); remove
  the "version < 1000 refuse" logic and the per-task numbering ranges in migrations/CLAUDE.md; tests use the new
  baseline. Do this LAST in the panel PR (after all other deletions settle the schema), and only after the
  subscription-templates and crypto-gateway PRs (which add migrations) have merged — coordinate via the lead.
- Portal: redirects of old addresses (`/invite`, `?tab=security`), React-era storage keys/migrations, any
  "React portal" compat. Admin: same kind of leftovers.
- Installer: v0.3.x refusal, Cloudsmith source disabling for old hosts, "old release without bundle" fallback,
  `AKARI_SOURCE_DIR` only if it is a compat path (it is a dev path — keep if used by tests).
- Docs mentioning `panel/` old paths, REVIEW-2026-09-30 links, etc.
Agent:
- bootstrap v1 format (cert/key in the config), state fields from the old launcher era, Renew `Unimplemented` 1 h
  back-off for old panels, "old panel never sends LeaseGrant" branches, capabilities kept only for old panels
  (keep capability *reporting* the panel still reads), `metrics-presence` pre-W23 behaviour, any proto fields marked
  deprecated (proto changes = panel first, `make sync-proto`).

## Constraints
- Panel PR and agent PR are separate; proto changes follow "panel first" (agent CLAUDE.md).
- Areas being changed by in-flight PRs: `src/sub/**` (subscription templates, branch sub-templates) and
  `src/billing/**` (crypto gateways, branch crypto-gateways). Do NOT touch them until the lead says those PRs merged;
  then rebase and finish those items (and the migration squash).
- `full-ci` label; the lead reviews; CI green; rebase-only (no merge commits), no force-push.
