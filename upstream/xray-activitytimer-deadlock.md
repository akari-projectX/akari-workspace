# Upstream PR to XTLS/Xray-core (to open from the user's GitHub account)

Branch with the change: `akari-projectX/xray-core` → `akari/v26.10.21` (commit `ce7424b`, on top of v26.10.21
`1b1647c`). Patch file: `xray-activitytimer-deadlock.patch` (same directory). Open the PR against `XTLS/Xray-core`
`main` ("compare across forks"); if `main` has moved, cherry-pick the commit onto it first.

**Title**

```
common/signal: fix ActivityTimer self-deadlock in SetTimeout
```

**Body**

```
`ActivityTimer.SetTimeout` holds `t.mu` and calls `newCheckTask.Start()`. `task.Periodic.Start` runs `Execute`
(= `t.check`) once synchronously. If a check of the task being replaced is still in flight (its timer fired just
before `CloseIfExists` stopped it), that old check can consume the token that `t.Update()` just posted. The
synchronous check then finds no token and calls `t.finish()`, which does `t.mu.Lock()` — while the same goroutine
already holds `t.mu`. The goroutine blocks forever.

`SetTimeout` is called from the deferred end of both copy tasks of a proxied connection (e.g. trojan, vmess,
shadowsocks_2022, freedom), so the stuck goroutine keeps the connection's handler, its other task and the socket
alive indefinitely. Under sustained connection churn we measured 77 stuck handlers per hour (goroutines and file
descriptors never released, the old instance kept reachable after a core rebuild). In an isolated stress test it
reproduces roughly once per 10^4 aimed trials.

Fix: make the synchronous first run of the new periodic task only drain the token and never call `check`; later
runs come from the timer after `t.mu` is released. Semantics are otherwise unchanged (the first synchronous check
used to consume the token posted by `Update` anyway).

Found with a soak test of an xray-based node agent; happy to adjust the approach (e.g. starting the task after
releasing `t.mu` instead).
```
