# Agent soak test, 2026-10 (akari-agent PR #42)

**Verdict: the requested 60-minute run was NOT completed.** It was started (00:10 UTC) and stopped at 7.5 minutes of load on the lead's instruction, so no 30/60-minute pprof snapshots and no end-of-run drain exist for it. What exists: two complete runs (3 min and 5 min of load, each followed by clients-stop, accounting check, removal of all users, a 150 s drain and an empty Snapshot) plus 7.5 minutes of samples of the aborted long run. Everything below is stated for those durations; nothing here proves anything about 30-60 minutes. The harness itself is ready: `make soak` (60 min default).

## Setup
- Parent process: the real `Agent` (session, gate, rate limits, traffic loop, checkpoint, finals queue) against an in-process fake panel over gRPC. The fake panel accounts like the real one (max per session and user) and compares the Ack state hash with its own model after every delta and snapshot (0 mismatches).
- Child process: real xray clients, 5 live users x 6 inbounds = 30 slots (VLESS+REALITY+Vision, VMess, Trojan/TLS, SS2022 multi-user, Hysteria 2, relay-derived `e1` with users `<id>#1`), one long connection (echo every 1-2 s, 512 KiB bulk every ~10th) plus continuous short connections (0.5-48 KiB) per slot. Clients are out of process, so agent numbers are the agent's (the parent also hosts the fake panel and a TLS echo for REALITY: a few MiB of the RSS).
- Churn: 3000-user ghost pool (delta add/remove/rotate/inbound-set/speed-limit, 40 ops per 1-3 s), 10 fresh never-seen ids per batch living 20-60 s, one live user revoked/rotated/dropped/restored/re-limited every few seconds, Snapshot (xray rebuild) every 5 min (shortened in the short runs), stream killed every 3 min (shortened), leases. SS2022 removal and rotation are plain deltas (protocol 8).
- Host: 4 vCPU, 15 GB, Go 1.27.3, xray v26.10.21.

## Results (all assertions passed in both complete runs, 0 violations)
| | 3 min load (run-3m) | 5 min load (run-5m) |
|---|---|---|
| Revocation: slots revoked / with live conn / proven cut / new conn refused | 13 / 12 / 12 / 13 | 34 / 33 / 33 / 34 |
| Untouched live connections lost during others' revocation | 0 of 11 | 0 of 31 |
| Hash mismatches / non-OK acks | 0 / 0 | 0 / 0 |
| Stream kills survived (in-sync resync, no snapshot) | yes | 3 kills, 3 in-sync |
| Accounting: client wrote vs accounted up | 532.4 MB vs 530.6 MB (0.34 % unaccounted) | 309.3 MB vs 309.1 MB (0.085 %) |
| Accounting: client read vs accounted down | 531.2 vs 531.3 MB (+0.013 %) | 310.25 vs 310.38 MB (+0.04 %) |
| Baseline goroutines / fds / heap | 43 / 24 / 8.8 MiB | 43 / 24 / 8.9 MiB |
| After drain + empty Snapshot | 43 / 27 / 5.1 MiB | 47 / 29 / 9.9 MiB |
| Peaks | 771 goroutines, 363 fds, 26.7 MiB heap, 103 MiB RSS | 932, 435, 25.8 MiB, 103 MiB |

Accounting bounds asserted: accounted up <= bytes written, accounted up >= bytes read back through non-TLS slots, accounted down >= bytes read; the tolerance for the gap (3 %, only above 50 MiB) is in-flight messages cut by a revocation or Snapshot. Measured gaps are 0.1-1.4 % per user.

### Time series (3 min load, then drain), run-3m
| t (min) | heap live MiB | heap inuse MiB | RSS MiB | goroutines | fds | gate conns | counted | gone | issued | stale | unique users | agent CPU s | short ms | moved MiB |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.0 | 8.8 | 12.8 | 53.3 | 43 | 24 | 0 | 1510 | 0 | 3933 | 0 | 1510 | 0 | 0.0 | 0 |
| 0.5 | 21.9 | 30.9 | 90.5 | 750 | 356 | 183 | 1915 | 114 | 5340 | 328 | 1915 | 6 | 2.8 | 92 |
| 1.0 | 23.7 | 33.8 | 93.3 | 734 | 344 | 177 | 2278 | 303 | 6704 | 1082 | 2278 | 13 | 3.3 | 184 |
| 1.5 | 23.4 | 36.9 | 95.5 | 543 | 290 | 131 | 2132 | 52 | 6049 | 220 | 2596 | 18 | 3.6 | 265 |
| 2.0 | 24.9 | 39.7 | 101.3 | 623 | 310 | 158 | 2482 | 345 | 7354 | 1356 | 2899 | 23 | 3.4 | 337 |
| 2.5 | 26.1 | 40.6 | 102.3 | 649 | 314 | 159 | 2795 | 611 | 8596 | 2428 | 3171 | 29 | 3.4 | 418 |
| 3.0 | 25.4 | 40.2 | 103.0 | 215 | 111 | 42 | 2267 | 16 | 6398 | 62 | 3467 | 34 | 3.7 | 500 |
| 3.5 | 16.3 | 31.2 | 78.9 | 43 | 27 | 0 | 2340 | 70 | 6686 | 271 | 3518 | 35 | 0.0 | 508 |
| 4.0 | 13.0 | 26.9 | 74.9 | 43 | 27 | 0 | 2340 | 2340 | 6686 | 6686 | 3518 | 35 | 0.0 | 508 |
| 4.5 | 13.0 | 26.9 | 71.5 | 43 | 27 | 0 | 2340 | 2340 | 6686 | 6686 | 3518 | 35 | 0.0 | 508 |
| 5.0 | 13.0 | 26.9 | 71.4 | 42 | 27 | 0 | 2340 | 2340 | 6686 | 6686 | 3518 | 35 | 0.0 | 508 |
| 5.5 | 13.0 | 26.9 | 71.4 | 42 | 27 | 0 | 2270 | 2270 | 6686 | 6686 | 3518 | 36 | 0.0 | 508 |
| 6.0 | 12.9 | 26.9 | 71.4 | 42 | 27 | 0 | 0 | 0 | 6686 | 6686 | 3518 | 36 | 0.0 | 508 |
| 6.4 | 5.1 | 11.2 | 69.4 | 43 | 27 | 0 | 0 | 0 | 0 | 0 | 3518 | 36 | 0.0 | 508 |
slope heap_live: whole load +207.94 MiB/h; second half +98.47 MiB/h; mean 22.8, max 26.7
slope rss: whole load +563.13 MiB/h; second half +124.82 MiB/h; mean 93.6, max 103.0
slope goroutines: whole load -1159.12 /h; second half -10429.71 /h; mean 582.5, max 771.0
slope fds: whole load -316.48 /h; second half -5664.00 /h; mean 285.0, max 363.0
slope child_rss: whole load +172.19 MiB/h; second half -80.60 MiB/h; mean 61.7, max 67.4
agent CPU per MiB written: first quarter 0.0711 s/MiB; last 0.0687 s/MiB

### Time series, run-5m (first complete run; includes the drain)
| t (min) | heap live MiB | RSS MiB | goroutines | fds | gate conns | counted | gone | issued | unique users |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.0 | 8.9 | 56.0 | 43 | 24 | 0 | 1510 | 0 | 3926 | 1510 |
| 1.0 | 17.6 | 85.9 | 701 | 331 | 169 | 1696 | 65 | 4542 | 1696 |
| 2.0 | 20.2 | 89.2 | 698 | 332 | 170 | 2009 | 201 | 5678 | 2009 |
| 3.0 | 23.1 | 95.2 | 696 | 337 | 172 | 1889 | 143 | 5255 | 2084 |
| 4.0 | 25.1 | 103.1 | 859 | 407 | 212 | 2014 | 210 | 5703 | 2203 |
| 5.0 | 25.8 | 102.2 | 819 | 388 | 200 | 1876 | 72 | 5703 | 2203 |
| 6.0 | 12.9 | 69.6 | 46 | 29 | 0 | 1820 | 1820 | 5703 | 2203 |
| 7.0 | 12.9 | 67.8 | 46 | 29 | 0 | 1804 | 1804 | 5703 | 2203 |
| 8.0 | 12.8 | 67.8 | 46 | 29 | 0 | 0 | 0 | 5703 | 2203 |
| 8.5 | 9.9 | 64.1 | 47 | 29 | 0 | 0 | 0 | 0 | 2203 |
### Aborted long run (7.5 min of load)
| t (min) | heap live MiB | heap inuse MiB | RSS MiB | goroutines | fds | gate conns | counted | gone | issued | stale | unique users | agent CPU s | short ms | moved MiB |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.0 | 9.1 | 12.7 | 52.5 | 43 | 24 | 0 | 1510 | 0 | 3887 | 0 | 1510 | 0 | 0.0 | 0 |
| 1.0 | 22.9 | 33.7 | 97.8 | 726 | 343 | 175 | 2285 | 301 | 6706 | 1060 | 2285 | 14 | 2.8 | 195 |
| 2.0 | 17.8 | 27.7 | 84.1 | 251 | 120 | 49 | 2990 | 775 | 9453 | 3206 | 2990 | 25 | 2.6 | 330 |
| 3.0 | 30.2 | 41.7 | 104.6 | 690 | 319 | 160 | 3322 | 1062 | 11613 | 5266 | 3480 | 37 | 6.2 | 475 |
| 4.0 | 28.3 | 40.8 | 108.2 | 703 | 336 | 164 | 3370 | 1059 | 13776 | 7190 | 3924 | 51 | 6.6 | 659 |
| 5.0 | 28.4 | 42.5 | 105.8 | 704 | 349 | 175 | 3359 | 1036 | 15646 | 9067 | 4291 | 65 | 6.9 | 830 |
| 6.0 | 28.8 | 43.9 | 111.8 | 577 | 275 | 132 | 2879 | 558 | 8800 | 2213 | 4655 | 77 | 7.8 | 980 |
| 7.0 | 31.5 | 46.6 | 112.8 | 530 | 253 | 119 | 3397 | 1046 | 11090 | 4362 | 5000 | 86 | 8.0 | 1090 |
| 7.5 | 37.2 | 52.7 | 123.2 | 892 | 423 | 216 | 3429 | 1100 | 12116 | 5438 | 5163 | 94 | 3.0 | 1181 |
slope heap_live: whole load +130.28 MiB/h; second half +93.72 MiB/h; mean 26.0, max 37.2

(Heap live = HeapAlloc right after a forced GC.) Regression slopes over such short runs are meaningless (load phases and snapshots dominate); raw CSVs are in `agent-soak-2026-10-data/`.

## pprof (run-5m, inuse_space; `heap-*.pb.gz` kept under .work/agent-soak/run-5m)
- start (9 MiB): runtime.mallocgc 2.0 MB, addUserLocked 4.7 MB cumulative (1510 initial users), vmess user map, stats counters.
- mid / end of load (22 / 25 MiB): SS2022 `NewStreamWriter` 2.7 -> 3.8 MB (per live connection), `bytespool` 1.5 MB, `addUserLocked` cumulative 8.1 -> 8.6 MB, gate `Allow` 1.05 MB.
- drained (15 MiB total in the profile): `addUserLocked`/`applyOpLocked` 6.8 MB cumulative = the `issued` entries kept for removed users (see finding 2).
- final, after the empty Snapshot (12 MiB): only startup/runtime items; connection-scaled allocations gone. (`startChild` 1.2 MB is the harness's scanner buffer.)
Goroutine profiles (`goroutine-*.txt`): 236 lines at start, 585 at end of load, 263 after drain/final; the residual goroutines are the same stacks as at start (grpc, heartbeat/traffic/lease/checkpoint loops).

## Findings
1. **Real bug (fixed in the PR, commit 1): xray's console access log was on.** With a `log` section in the config xray prints one line per accepted connection (`from <client> accepted tcp:<destination> email: <user id>`) to stdout, i.e. the node's journal, at any log level. Seen as ~9500 lines in a 90 s run. It leaks which hosts a user visits into the node journal and costs a write per connection. Fix: `"access":"none"`; `TestAccessLogIsOff` fails without it. Operators who relied on those lines for debugging lose them (nothing in the repo reads them).
2. **Not a leak, but a memory cost to know: `issued` retains removed users' credentials for 24 h** (`staleIssuedTTL`). After the drain, 5703-6686 retained entries cost 7.7-8 MiB, about 1.2 KiB per (user, inbound) entry; they vanish at the next Snapshot or after 24 h. At the harness's churn (~10 new ids per 2 s) this grows by ~100 MB/day; real churn is orders of magnitude lower. Also xray never unregisters stats counters, so `counted` entries leave only via `SweepGone` (2 min) but xray's own counter objects stay until the next Rebuild.
3. **No leak observed in 3-5 minutes**: `counted`/`gone` return to 0 after the 2-minute grace, gate maps (`allowed`, `live`, `limits`) and gate connections are 0 after all users are removed, goroutines return to baseline (43 -> 43 / 47) and fds to +3 / +5 (slack allowed 8) after an empty Snapshot, live heap returns to 5-10 MiB vs 9 MiB baseline. The slight residual in run-5m (+4 goroutines, +5 fds) did not grow between the drain and the rebuild samples; a longer run is needed to tell constant from slowly growing.
4. Revocation behaves as designed on all six inbounds: every revoked live connection was cut, every revoked credential refused (SS2022/VMess refuse by silently draining, so the client waits; the harness treats a 3 s no-relay as refusal), no collateral cuts, rotation of a subset of inbounds leaves the others connected. Stream kills reconnect with an in-sync Hello and no Snapshot.
5. Agent CPU ~0.07-0.08 CPU-s per MiB relayed through six protocols (flat between quarters).

## What is missing / next
- The 30 and 60 minute pprof snapshots and the long drain. Run `make soak` on a quiet machine (about 66 min); thresholds are in `assertEnd` (goroutines/fds +8, heap +24 MiB after rebuild, 2 KiB per distinct user-inbound pair at the end of load) and were calibrated from these short runs only.
- Harness caveat: the end-of-load heap bound is generous; recalibrate after one full run.

## Suggested PERF.md lines
- Agent soak (akari-agent PR #42, `make soak`, 4 vCPU, xray 26.10.21): 30 live xray clients over six inbounds plus ~3 MiB/s relayed, user churn ~25 ops/s, 3-5 minute runs: revocations cut and refused 100 % (45/45 live connections), accounting within 0.1-1.4 % per user (never above the bytes written, never below the bytes read), baseline 43 goroutines / 24 fds / 9 MiB heap returns to 43-47 / 27-29 / 5-10 MiB after drain and an empty Snapshot. Peak 930 goroutines, 435 fds, 26 MiB live heap, 103 MiB RSS at ~175 concurrent proxied connections. 60-minute result pending.
- Retained credentials of removed users: about 1.2 KiB per (user, inbound) for 24 h.

## Full 60-minute run (2026-10-27, `run-60m-full`) and what it found

`make soak SOAK_DURATION=60m` on the PR #42 harness: 3811 s of samples (load 60 min + 2.5 min drain), data in `agent-soak-2026-10-data/run-60m-full/`.

| | |
|---|---|
| streams / kills / snapshots / deltas | 21 / 20 / 13 / 2273, 0 ack-not-ok, 0 state-hash mismatches |
| ghost churn | 1788 batches, 71 520 ops, 20 890 distinct users installed (102 012 user x inbound pairs) |
| live transitions | 485 batches (129 rotations, 40 restores, 103 limit changes) |
| revocation | 817 slots revoked, 804 with a live connection beforehand, **801 proven cut, 3 "not cut"**, 817/817 new connections refused |
| collateral | 844 untouched live connections checked, 0 lost |
| baseline -> drained -> rebuilt | heap 8.9 -> 84.0 -> **76.2 MiB**; goroutines 43 -> 185 -> **186**; fds 24 -> 93 -> **93**; RSS 52 -> 179 -> 172 MiB |
| peaks | heap 102 MiB, RSS 258 MiB, 1070 goroutines, 506 fds |

Passed: accounting, hashes, leases, gate/applied/counted maps empty after the drain. Failed: the three "not cut" (all `<user>#1|e1`) and the goroutine / fd / heap residue.

### 1. The three "not cut" connections are not a revocation bypass

`e1` is plain VLESS over TCP (no TLS, no flow). The instrumented rerun (40 min) printed, for each such event: `0 tracked dispatches left for the key, 0 bytes counted for the user since the delta's ack; client: echoes completed since the revocation=0, bytes read=0, deaths=0, alive=true`. A captured hang (in-process reproduction, a few hundred revoke cycles with the harness's ping pattern) showed the socket states: the agent's side `FIN_WAIT2` (closed by the agent), the client xray's outbound `CLOSE_WAIT`, its local connection `ESTAB`. The agent cut the relay and closed its socket; the xray *client* in the soak's child process did not close its side after the server's clean EOF. Only plain VLESS produces a clean EOF at revocation (the other protocols raise a decryption/TLS error that the client tears down at once), which is why it is always e1. ~1-2% of e1 revocations. Close latency of the 99% that did close: p50 ~2.0 s, max ~2.06 s for every protocol (hy2 p50 0.9 s), against the 6 s the harness allows.

Harness change: a connection still open after 6 s is a violation only if something crossed (echo completed after the delta, > 64 KiB counted for the user, dispatch still tracked); otherwise it is counted as `stalled`. Agent change (hardening, not the cause): `liveConn.kill` also closes the client connection.

### 2. The residue is a real leak, caused by an upstream xray bug

Goroutine diff (start vs final): +143 = 77 goroutines blocked in `RWMutex.Lock` under `ActivityTimer.finish <- check <- Periodic.Start <- SetTimeout` (trojan 33, SS2022 23, freedom 11, vmess 10) + 66 `task.Run` waiters; fds +69 = the sockets of those 66 handlers. 29 stuck at 20 min, 63-77 at 40-60 min (about 1.5/min at ~85 connections/s). They survive the Rebuild and keep the old instance's users, counters and ciphers reachable (heap-final: `GetOrRegisterCounter`, `ToMemoryUser`, `aes.New`, `sync.Map` nodes; plus ~10 MiB of the harness's own seen-user set, now hashed). `issued` is not a leak: Rebuild clears it (0 in the last samples); its 16 020 entries x 508 B = 8.1 MiB before the Rebuild are the 24 h retention by design.

Mechanism: xray `common/signal/timer.go` `SetTimeout` holds `t.mu` while `Periodic.Start` runs the first check synchronously; if a check of the replaced task takes the token `Update()` just posted, that synchronous check calls `finish()`, which locks `t.mu` again. Reproduced in isolation (1 hang per ~10^4 aimed trials), unfixed on xray main. Not fixable inside the agent (`go build -overlay` cannot replace module-cache files); the patch (drain the token in the synchronous run instead of calling `check`) needs a fork + `replace` or an upstream PR. `assertEnd` thresholds were not changed; the failure message now states the number of deadlocked handlers. A canary `TestXrayActivityTimerSelfDeadlock` SKIPs while the bug reproduces.

### 3. Rerun with the branch `soak-fixes` (PR akari-agent#43)

(filled in below when the run finishes)

## Rerun with the xray fork (agent#43, 2026-10-27) — PASS

`make soak SOAK_DURATION=60m` on branch soak-fixes with `replace github.com/xtls/xray-core => github.com/akari-projectX/xray-core` (ActivityTimer self-deadlock fixed). Data: `agent-soak-2026-10-data/run-60m-fork/`.

- Revocation: 809 slots revoked, 796 had a live connection; 795 proven cut, 1 left open by its client with nothing relayed (client-side, harness classifies as stalled); 809/809 new connections refused. Collateral: 898 untouched live connections checked, 0 lost.
- Deltas 2270, snapshots 13, ack-not-ok 0, state-hash mismatch 0. Users installed 20 790 (101 499 user×inbound pairs).
- Resources: baseline goroutines 43 / fds 24 / heap 8.9 MiB → after drain + empty Snapshot: 43 / 27 / 9.5 MiB (unpatched run: 186 / 93 / 76 MiB). xray ActivityTimer deadlocks: 0 (unpatched: 77/h). Peaks: goroutines 934, fds 443, heap 38 MiB, RSS 127 MiB.
- `issued` after drain: 15 953 entries × ~601 B (by design, cleared by Rebuild).
- Conn-close on kill (gate.go): xray sets `session.Inbound.Conn` only for the accepted per-client stream (TCP worker), per-session XHTTP `splitConn`, per-stream gRPC/Hysteria conns; UDP inbounds leave it nil — closing never affects another user (lead review of xray v26.10.21 source).

## GC tuning measured (2026-10-28, agent main 44801b7)

Four 10-minute soak runs, same seed, parent process only (clients unchanged); all soak assertions passed.

| Run | GC cycles | GC CPU s | Process CPU s | GC share | CPU ms / MiB moved | heap-in-use avg/peak MiB | RSS avg/peak MiB |
|---|---|---|---|---|---|---|---|
| default | 314 | 8.7 | 139.6 | 6.2% | 86.2 | 49.7 / 72.2 | 105 / 124 |
| default (repeat) | 337 | 9.7 | 152.2 | 6.4% | 87.6 | 50.5 / 73.8 | 106 / 123 |
| GOGC=200 | 156 | 4.6 | 141.8 | 3.2% | 88.1 | 65.1 / 99.1 | 132 / 153 |
| GOGC=200 + GOMEMLIMIT=256MiB | 159 | 4.8 | 148.5 | 3.2% | 86.0 | 66.6 / 103.4 | 133 / 157 |

GOGC=200 halves GC work, but total CPU per MiB moved is within the run-to-run noise (~1.6%): about two thirds of the default GC CPU is idle mark workers on otherwise idle cores; the part competing with traffic is ~2% of process CPU. It costs ~+26 MiB RSS on average (+30 MiB peak). GOMEMLIMIT=256MiB never engaged. Decision: no GC setting in the unit, the OpenRC script or main.go. If a CPU-bound node ever needs it, set `GOGC=200` per node in a unit drop-in / conf.d rather than in code.
