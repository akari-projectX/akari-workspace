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
