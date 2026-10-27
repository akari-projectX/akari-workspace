# Compatibility-code cleanup, 2026-10 (inventory)

Brief: `briefs/compat-cleanup.md`. Wire floor: panel main <-> released agent v0.6.x (protocol 8) and agent main (protocol 8).

## Agent (akari-agent, branch `compat-cleanup`)

### Removed

| # | Location | What it was for | Why safe now | Goes with it |
|---|---|---|---|---|
| A1 | `config.go` (`IdentityConfig.CertPEM/KeyPEM`, "go together" check), `identity.go` (`source "config"`, load of the config key), `enroll.go` ("or a v1 key" message) | v1 bootstrap file: panel-generated cert+key inside the config, replaced at first renewal | The panel has issued only v2 bootstrap files (no private key, enrollment token) since M1-8; an unknown `cert_pem`/`key_pem` key is now refused like any unknown key | `TestV1ConfigIdentity`, fuzz `FuzzLoadConfig` v1 invariant, README/CLAUDE.md text |
| A2 | `enroll.go` `renewTick` | 1 h renewal back-off when the panel answers `Unimplemented` (panel without `Renew`) | Every panel that speaks protocol >= 2 implements `Renew`; panel main floor is 8 | doc comment "(protocol 2)" |
| A3 | `update_agent.go` `permanentFetchError` | `codes.Unimplemented` counted as a permanent `FetchArtifact` failure (panel without self-update) | Panel floor 8 implements `FetchArtifact` | - |
| A4 | `update.go` (`bin/` cleanup in `newUpdater`, doc about "exec-launcher era" state fields), `update_agent.go` comment | State left by the v0.3/v0.4 exec launcher | Launcher agents are gone (cannot update to anything; the noexec state dir never ran them) | test case "exec-era state loads" reduced to "stale request and download removed" |
| A5 | `updater_linux.go` `installUnits` EROFS branch (`units NOT refreshed … predates unit refresh`) | Updater units from before W23 had a read-only `/etc/systemd/system`; the update went on without refreshing units | Released v0.6.x updater units are W23+; a read-only unit dir is now a normal failure (update refused, rolled back) | subtest "pre-W23 updater unit (read-only unit dir)", doc paragraph |
| A6 | `scripts/systemd-test/` scenario 1/1b/2 (pre-W23 units, update that cannot refresh units, one-time reinstall) and `w18-units/` fixtures | Tested A5 and the pre-W23 metrics behaviour | A5 gone | scenario 1 now installs the shipped units (`-print-unit`) and checks metrics/not stale; `LEGACY`, `v0` build removed |
| A7 | `Makefile` `sync-units`/`check-units`, CI step "The panel's copy of the units equals ours" (`ci.yml` proto job), `units.go` comment | Byte-compare with the panel's `deploy/systemd/` copy (the panel installer's fallback for releases without `-print-unit`) | Panel is dropping the copies and the fallback (panel PR); embedded units are the only source | CLAUDE.md rows/commands |
| A8 | Comments only: `lease.go` ("a panel that predates leases"), `blockrules.go` ("an old panel"), `proto_ss2022.go` (protocol 5-7 tombstones), `core.go` ("older xray", "before W29"), CLAUDE.md (旧面板, v0.3/v0.4 exec launcher, W23-before updater) | History narration of removed behaviour | - | - |

### Kept, ask lead

| Item | Location | Why kept |
|---|---|---|
| `stale-units` status flag (`staleUnits`, `capStaleUnits`, Hello capability, WARN log) | `units.go`, `main.go`, `agent.go` | Panel main still reads it (`servers.rs stale_units_warning`) and **panel smoke.sh asserts it** (hand-edited unit -> capability appears, reinstall clears it; lines ~4436-4473). Removing it in the agent first breaks the panel's smoke on agent main. Panel first: drop `stale_units_warning`, the smoke segment and the proto comment; then the agent drops `staleUnits`/`capStaleUnits` and the OpenRC "expired scripts" part of `openrc-test`. |
| Capability reporting `metrics`, `latency`, `updater`, `metrics-presence`, `block-rules`, `source-filter` | `agent.go agentCapabilities` | Brief: keep reporting the panel still reads. Every protocol-8 agent has all six; once the panel drops its `need_agent cap:` gates / `legacy_presence` / warnings, they can go in a follow-up (smoke compares `agentCapabilities` with the panel API). |
| `Hello.protocol_version` history comment (1..8) in `agent.go` | `agent.go` | Documents the wire numbering; protocol stays 8 |
| Lease armed only by the first `LeaseGrant` | `lease.go` | Real state machine (before the first grant there is nothing to enforce), not an old-panel branch. Making it armed-at-start would change behaviour. |
| `LeaseGrant.remove_mode` REBUILD (`removeRebuild`) | `agent.go`, `core.go` | Operator setting in the panel (系统设置 -> 节点通信 -> 撤权方式), not compat |
| `/proc/meminfo` `MemFree+Buffers+Cached` fallback when `MemAvailable` missing | `sysstat.go` | Kernel < 3.14 support rather than panel/agent version compat; covered by fuzz/tests. Delete if the lead wants a kernel floor. |
| `min_panel_protocol` check, `PanelProtocol` in apply requests | `release/`, `updater_linux.go` | Real feature (new agent refuses panels that are too old) |
| `logMetricsAvailability` hint "an old systemd unit with ProcSubset=pid hides /proc" | `sysstat.go` | Still the only diagnostic for hand-edited units; tied to `stale-units` decision |
| `scripts/systemd-test` header mention of v0.4.0 exec launcher | `run.sh`, `ci.yml` | Explains why the noexec state dir is reproduced; not code |

### Proto items for the panel (agent must not change proto; panel first, then `make sync-proto`)

All are comments in `proto/agent.proto` (no field/wire change, so no agent code depends on them):
1. `Hello.protocol_version` revision list: lines "Protocol 1 agents are served as before", "Older agents run … unthrottled", "Older agents get a Snapshot for any removal there", "Older agents ignore both", "Older agents limit and count each user_id on its own", "Agents 5..7 keep the tombstone rule" – become false once the panel floor is 8.
2. `Hello.capabilities` text: "older agents send none, the panel serves them as before", "agents without it fail every update … (the panel tells the admin to reinstall once)", the `stale-units` paragraph (after the stale-units decision above).
3. `Heartbeat`/`NodeMetrics`: "for older agents unset means 0" (line ~180), "unset from older agents" (~195, ~198).
4. `Hello`: nothing is deprecated/reserved in the proto, so no field removals are pending.
Also in the panel: `deploy/systemd/*` copies and `nodeinstall.rs include_str!` fallback, the agent-side CI job that compares panel units against agent main (panel CI "release keys match akari-agent main" style units check) must go in the same panel PR; the agent no longer checks them.

## Panel (akari-panel, branch `compat-cleanup`, PR akari-projectX/akari-panel#187)

Facts used: agent `v0.6.0` already reports protocol 8 and all six capabilities (`metrics latency updater
metrics-presence block-rules source-filter`), so every capability the panel reads is present on every protocol-8 agent.
The panel no longer reads `stale-units` at all (the NodeView warning is gone), so the agent may drop that flag.

### Removed (phase 1, in the PR)

| # | Where | What it was for | Why safe now | Went with it |
|---|---|---|---|---|
| 1 | `settings.rs` `import_legacy`, `ImportReport`, `Imported`, `legacy_value`, `import_tx` (`main.rs` call) | one-time import of moved panel.toml keys into 系统设置 on the first start of an upgraded install | no upgraded installs; the database is the only source | tests `obsolete_keys_are_imported_once`, `import_edge_cases`; audit action `settings.import` (still used by the payment import, phase 2); DEPLOY "Upgrading: obsolete keys"; smoke W25 section rewritten to seed settings (node domain via `settings set node`, probe URL, ACME CA, test release key, Telegram API via SQL); e2e.sh no longer writes obsolete keys |
| 2 | `SettingsView.obsolete_config_keys`, admin overview card "panel.toml 里有 N 个已废弃的键", `Attn.copy` | showed leftover keys | nothing to show | admin `settings-data.ts`, test fixtures, SET-25 e2e assertion, smoke assertion |
| 3 | `settings::legacy_nodes`, `removal_blocker(source=="config")`, `SettingsView.legacy_nodes`, `grpc_server_names.source='config'` | servers enrolled before 0060 (server name unknown) and cert names that came from panel.toml | enrollment always records the server name; 'config' was only written by the import | smoke D8 assertion; CHECK value `'config'` goes at the squash |
| 4 | `install.rs` `LEGACY_MASTER_KEY`, `totp.key` -> `master.key` rename at start, test `legacy_totp_key_is_renamed_once` | v0.3 install that still had totp.key | no v0.3 installs | docs: BACKUP, REFERENCE, CLAUDE.md |
| 5 | `grpc.rs` `MIN_AGENT_PROTOCOL` 1 -> 8 | floor | agents below 8 still get the empty state (kept degrade mode) | all `hello_v`/protocol args in tests; `fake_agent::hello_v` removed, `hello_as` lost its protocol arg |
| 6 | `grpc.rs` `SS_TOMBSTONE_PROTOCOL`(5), `SS_NATIVE_REMOVE_PROTOCOL`(8), `SetDigest.shrink_unsafe`, `has_shadowsocks`, `rotates_credential_digest`, the protocol branch in `SyncState::delta_base` | SS2022 tombstone rules for agents 5-7 | all agents are 8: SS removal/rotation are plain deltas | test `shadowsocks_node_shrinks_by_snapshot` -> `shadowsocks_node_changes_are_deltas`; `remove_mode=rebuild` (operator setting, `drops_credential*`) kept |
| 7 | `grpc.rs` `SPEED_LIMIT_PROTOCOL`, `ACME_PROTOCOL`, `ACCOUNT_KEY_PROTOCOL`; `servers.rs` `unenforced_speed_limits` (+SQL), `entrance_warnings`, `updater_warning`, `stale_units_warning`, `acme_needs_newer_agent`, `refuse_acme_for_old_agent` (called from `nodes.rs`, `servers.rs`), protocol arms of `tls_domain_warnings`/`cert_warning` | NodeView warnings and write-time refusal for agents without those features | every protocol-8 agent has them | error code `node.acme_agent_too_old` (`error_codes.txt`, admin `errors.gen.ts`); tests in `servers/tests.rs`, `nodeinstall/tests.rs` |
| 8 | `nodestat::legacy_presence`, `Session.metrics_presence` | pre-W23 agents send unread values as 0 | protocol 8 has `metrics-presence` | test `legacy_presence_means_zero`; heartbeat test now expects null |
| 9 | `enroll::note_legacy_expiry`, `peer_cert` returning `not_after`, test `v1_certificate_and_protocol_1_agent_unaffected` | backfilled `servers.cert_not_after` for v1 bootstrap files (key in the file) | v1 bootstrap does not exist any more | |
| 10 | `updates::MIN_UPDATE_PROTOCOL`, UpdateOffer gate in `grpc.rs`, `rollout` skip "agent protocol < 3", `offer_for(protocol)`, `updatecheck` `agent_protocol >= 3` filter, `HelloInfo.protocol` | agents < 3 cannot self-update | offers go to every connected agent (a pre-protocol-3 agent ignores the unknown message) | rollout/updatecheck tests |
| 11 | `rollout::failure_hint` pre-W18 `permission denied` branch | hint for launcher-era agents | none exist | test case |
| 12 | `deploy/systemd/akari-agent.service`, `akari-agent-update.{service,path}`; `nodeinstall.rs` `include_str!` copies + `@@UNIT*@@` placeholders; `nodeinstall.sh` fallback block and message `units_from_installer`; CI steps "agent units match akari-agent main" (job `release keys match akari-agent main` keeps only the release-key compare) | install units for agent releases without `-print-unit` | the agent's embedded units are the only source; installer now `die`s (`no_service_units`, replaces `no_openrc_support`) when `-print-unit` fails | test `updater_units_fit_the_agent_unit` (unit content belongs to the agent repo), unit asserts in the script test; agent `make check-units` / `sync-units` become obsolete (agent worker) |
| 13 | `smoke.sh` `need_agent`/`agent_has`/`SKIPPED`/`smoke_finish`, `SMOKE_REQUIRE_AGENT` in `ci.yml`; all 17 gates; the W7 "agent cannot enforce speed limits" else-branch; the stale-units UI assertion; "installer fell back to its own unit copies" assertion | skip-loudly gates for agents lacking a capability | every protocol-8 agent has all gated capabilities | the source-vs-recorded protocol/capability check stays |
| 14 | `proto/agent.proto` comments, `proto/CLAUDE.md` | revision history 1-7, "older agents" notes | comments only, no field/number change | **agent must `make sync-proto` (pb/ comments change)** |
| 15 | portal `/invite` redirect (`REDIRECTS`, `R.invite`, `access::PORTAL_PAGES`/`RESERVED` entries `invite`, `plan`), `?tab=security` -> `#security` | old e-mail/bookmark addresses | no old links | portal e2e (`shell`, `wallet`, `zz-screens`) use `/wallet?tab=invite`; `routes.test.ts` |
| 16 | admin: `/settings/<old tab>` + `?section=` + `?outbox` redirects (`OLD_IDS`), `/finance/settings`, `/alerts/settings`, `/alerts/notifications`, orders `?email=`/`?no=`/`?unfulfilled=` mapping (callers now use `?q=@email`, `?status=unfulfilled`), `Dialog` `wide` prop | old admin addresses | no old links | admin vitest "redirects", e2e assertions, `settings-legacy-redirect` screenshot |
| 17 | installer: `disable_caddy_apt_source`, `CADDY_APT_RE`, messages; `AKARI_PREFIX` written to caddy.env / compose `.env`; `get_bundle` fallback to the installer's own release | hosts configured by older installers; Caddyfile/compose of releases before D4/D11; releases without a bundle | none exist | bare-e2e fake Cloudsmith source and its assertions; DEPLOY "已配置 Cloudsmith 源的旧主机" |
| 18 | docs | | | CLAUDE.md (root, src/, proto/), DEPLOY (obsolete-keys upgrade section, old-agent upgrade notes, unit fallback, metrics-presence note, protocol <6 / <3 notes), BACKUP, REFERENCE |

### Phase 2 (after the lead says the subscription-templates and crypto-gateway PRs merged)

Blocked by the hard constraint (do not touch `src/sub/**`, `src/billing/**`, no squash yet):

- **panel.toml obsolete keys, whole machinery**: `config::OBSOLETE`, `Fate`, `Legacy`, `PanelConfig.legacy`, `Legacy::extract`, `KEPT_SECTIONS`, `config_check::obsolete_warnings`, `main.rs` warning call, `config check` listing, tests (`config.rs`, `config_check.rs`, `billing/tests.rs:1565`). Blocked because `billing/methods.rs` reads `cfg.legacy` (`payments.*`). After: unknown keys fail `deny_unknown_fields`. Docs: root CLAUDE.md "panel.toml 最小化" bullet, src/CLAUDE.md `config.rs`/`config_check.rs` rows, DEPLOY §1.
- **`[payments.alipay]` import** (`billing/methods.rs` `LegacyPayments`/`LegacyAlipay`/`legacy_request`/`import_legacy`, `main.rs` call, tests in `billing/tests/w24.rs`), audit action `payment_method.import`, e2e.sh `[payments.alipay]` block (and the admin e2e that expects the imported method), PAYMENTS.md/DEPLOY lines about it.
- **Old payment notify path `/pay/alipay/notify`** and "pre-0140 order attribution" (`payment_method_id IS NULL` orders) in `billing/**`, `access::route` + test table, smoke assertions.
- **Subscription token `Stored::Legacy`** (`sub/mod.rs`), `api.rs` `sub_legacy`/`legacy: true` responses (`/me`, admin read), portal `sub_legacy` (types, `Access.svelte`, `Account.svelte`, dict strings), `w20_tests.rs`, the 0120 trigger branch; DEPLOY/CLAUDE.md text. Also the "old format" copy in the portal dictionary.
- **Migration squash** (last): `1000_baseline.sql` + 1010..latest -> one new baseline; remove `db::migrate`'s "version < 1000 refuses" logic and the matching installer `refuse_pre_baseline` (+ `database_from_v0_3_x_fresh`), the bare-e2e `PREV_TAG` refused-upgrade flow; per-task numbering ranges in `migrations/CLAUDE.md` and the root CLAUDE.md; tests use the new baseline. Schema pieces that go in the squash: table `legacy_config_imports`; `grpc_server_names.source` value `'config'`; `nodes.tags` (legacy node labels shown nowhere since 1104: API field `tags` in `nodes.rs`, audit snapshot, nodemeta); `node_enrollments.panel_addr/server_name` NOT NULL (then `nodeinstall.rs` "Links issued before 0060" branch and `Link` options go); `servers.server_name` for enrolled servers; any column/trigger branch whose only writer is removed above (`users.sub_token_enc` trigger branch for hash-only tokens, `orders.payment_method_id` nullability).

### Kept, ask lead

1. **`data/state.json` admin-prefix seed** (`install::ensure_state`, `access::ensure`, `AppState::route_prefix`, `Access::boot`, installer `state.json` handling, smoke/e2e `info` before first start). It is the current install mechanism, not old-version compat. Removing it means the panel generates the prefix in `access::ensure`, `Install` loses `route_prefix`, and every test that relies on the `"test"` boot prefix needs a seeded `access_settings` row (large test churn, cannot be verified without a local build). Proposal: do it in a follow-up PR.
2. **Master-key labels** (`akari/totp-secret-aead/v1` now seals SMTP/alert secrets) and the test `derived_keys_are_unchanged` whose vectors came from v0.3 code. Renaming the label would invalidate existing sealed secrets of any running instance; with no data it is only a naming cleanup.
3. **`remove_mode=rebuild`** (系统设置 → 节点通信 撤权方式, `LeaseGrant.remove_mode`, `drops_credential*`): an operator fallback switch, not version compat.
4. **`PANEL_PROTOCOL = 3` / `min_panel_protocol` in signed manifests**: part of the signed release format shared with the agent (`proto/update_vector.json`), not agent-protocol gating.
5. **Admin settings search by old names** (`settings-ia.ts` `from`, `MOVED_OUT` pointer for the outbox): a search convenience for operators; no redirect depends on it.
6. **`rollout::failure_hint` first branch** (`updater unit missing` / updater did not pick up the request): the agent still emits these for a node whose updater unit was removed.
7. **`updatecheck`/GitHub "compatible source"** wording, `rate.rs`/metrics "fallback limiter" (Valkey outage fallback), `login_fallback.rs` (passkey-only mail code): real features, not compatibility.
8. **Agent capability reporting** (`stale-units` flag stays in `servers.agent_capabilities` and the smoke assertions that a fresh install does not report it).

### Not reviewed yet

- The long tail of `React`-era wording in portal comments ("同 React 门户 …", ~25 files): comment-only.
- `src/mail/templates.rs` (75 "legacy/compat" grep hits are placeholder names, not compat), `passkey` tests: grep noise, no compat found.
- `bench/` and `fuzz/` crates: not touched (no references to removed items found by grep).
