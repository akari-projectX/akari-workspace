# Panel load test, stage C (2026-10)

See akari-panel docs/PERF.md section 'Panel load test, stage C (2026-10-27)' (same numbers, reproduction commands). Raw outputs of this run (4-vCPU shared box):

## flood-before-256
```
-- idle baseline (probes only, 8s)
  admin_me   errors=0    n=161 p50=2.35 p90=4.04 p99=7.23 p99.9=8.97 max=8.97 ms
  healthz    errors=0    n=161 p50=0.26 p90=0.40 p99=1.10 p99.9=2.57 max=2.57 ms
  sub_clash  errors=0    n=161 p50=5.02 p90=11.89 p99=26.27 p99.9=31.26 max=31.26 ms
-- flood: 256 workers, 20% right password, 15s
flood: 22768 requests, 1465 req/s
  wrong 401        20 req/s  n=315 p50=1460.22 p90=1788.93 p99=2022.40 p99.9=2115.58 max=2115.58 ms
  wrong 503      1147 req/s  n=17828 p50=144.51 p90=175.10 p99=205.06 p99.9=228.99 max=246.66 ms
  right 200         5 req/s  n=82 p50=1567.74 p90=1911.81 p99=2146.30 p99.9=2146.30 max=2146.30 ms
  right 503       292 req/s  n=4543 p50=144.25 p90=174.34 p99=206.08 p99.9=226.81 max=243.58 ms
-- probes during the flood
  admin_me   errors=0    n=51 p50=135.94 p90=172.29 p99=181.25 p99.9=181.25 max=181.25 ms
  healthz    errors=0    n=51 p50=4.05 p90=8.38 p99=22.53 p99.9=22.53 max=22.53 ms
  sub_clash  errors=0    n=51 p50=145.79 p90=183.04 p99=242.94 p99.9=242.94 max=242.94 ms
```
## flood-after-256
```
-- idle baseline (probes only, 8s)
  admin_me   errors=0    n=161 p50=2.26 p90=3.83 p99=8.87 p99.9=9.86 max=9.86 ms
  healthz    errors=0    n=161 p50=0.27 p90=0.43 p99=1.03 p99.9=1.22 max=1.22 ms
  sub_clash  errors=0    n=161 p50=4.33 p90=9.07 p99=21.81 p99.9=28.19 max=28.19 ms
-- flood: 256 workers, 20% right password, 15s
flood: 192719 requests, 12536 req/s
  wrong 401        28 req/s  n=425 p50=1070.08 p90=1370.11 p99=1529.86 p99.9=1599.49 max=1599.49 ms
  wrong 503      9982 req/s  n=153458 p50=7.52 p90=25.31 p99=162.05 p99.9=226.56 max=308.48 ms
  right 200         7 req/s  n=100 p50=1108.99 p90=1340.41 p99=1553.41 p99.9=1603.58 max=1603.58 ms
  right 503      2520 req/s  n=38736 p50=7.59 p90=26.13 p99=163.58 p99.9=227.33 max=286.21 ms
-- probes during the flood
  admin_me   errors=0    n=94 p50=62.05 p90=142.85 p99=214.14 p99.9=214.14 max=214.14 ms
  healthz    errors=0    n=94 p50=7.48 p90=18.21 p99=25.77 p99.9=25.77 max=25.77 ms
  sub_clash  errors=0    n=94 p50=72.06 p90=148.22 p99=212.35 p99.9=212.35 max=212.35 ms
```
## flood-before-r1500
```
-- idle baseline (probes only, 8s)
  admin_me   errors=0    n=161 p50=2.23 p90=3.16 p99=5.53 p99.9=9.75 max=9.75 ms
  healthz    errors=0    n=161 p50=0.27 p90=0.35 p99=0.47 p99.9=1.05 max=1.05 ms
  sub_clash  errors=0    n=161 p50=4.23 p90=7.32 p99=21.31 p99.9=23.71 max=23.71 ms
-- flood: 256 workers, 20% right password, 15s
flood: 20176 requests, 1314 req/s
  wrong 401        43 req/s  n=664 p50=636.41 p90=720.38 p99=834.56 p99.9=946.69 max=946.69 ms
  wrong 503      1007 req/s  n=15464 p50=15.87 p90=50.08 p99=114.24 p99.9=178.56 max=272.38 ms
  right 200        11 req/s  n=163 p50=641.02 p90=729.60 p99=832.51 p99.9=894.46 max=894.46 ms
  right 503       253 req/s  n=3885 p50=15.45 p90=48.70 p99=115.78 p99.9=178.05 max=184.57 ms
-- probes during the flood
  admin_me   errors=0    n=301 p50=5.43 p90=28.16 p99=64.22 p99.9=168.70 max=168.70 ms
  healthz    errors=0    n=301 p50=0.51 p90=3.11 p99=5.41 p99.9=8.47 max=8.47 ms
  sub_clash  errors=0    n=301 p50=6.17 p90=25.34 p99=55.45 p99.9=92.22 max=92.22 ms
```
## flood-after-r1500
```
-- idle baseline (probes only, 8s)
  admin_me   errors=0    n=161 p50=2.24 p90=4.05 p99=10.60 p99.9=12.67 max=12.67 ms
  healthz    errors=0    n=161 p50=0.26 p90=0.37 p99=2.75 p99.9=4.92 max=4.92 ms
  sub_clash  errors=0    n=161 p50=4.44 p90=9.64 p99=18.40 p99.9=30.54 max=30.54 ms
-- flood: 256 workers, 20% right password, 15s
flood: 20061 requests, 1296 req/s
  wrong 401        43 req/s  n=670 p50=530.43 p90=851.46 p99=1208.32 p99.9=1329.15 max=1329.15 ms
  wrong 503       992 req/s  n=15351 p50=1.78 p90=21.55 p99=216.96 p99.9=313.60 max=341.50 ms
  right 200        12 req/s  n=191 p50=529.41 p90=957.95 p99=1243.13 p99.9=1307.65 max=1307.65 ms
  right 503       249 req/s  n=3849 p50=1.70 p90=20.30 p99=217.22 p99.9=329.73 max=420.10 ms
-- probes during the flood
  admin_me   errors=0    n=301 p50=3.12 p90=15.14 p99=63.01 p99.9=275.20 max=275.20 ms
  healthz    errors=0    n=301 p50=0.27 p90=2.22 p99=13.35 p99.9=17.65 max=17.65 ms
  sub_clash  errors=0    n=301 p50=5.26 p90=13.81 p99=67.84 p99.9=114.17 max=114.17 ms
```
## c1-jit-on
```
dashboard           21 req/s  errors=0  n=127 p50=44.67 p90=55.55 p99=83.01 p99.9=83.52 max=83.52 ms
nodes                7 req/s  errors=0  n=41 p50=144.90 p90=179.58 p99=219.52 p99.9=219.52 max=219.52 ms
nodes_summary        8 req/s  errors=0  n=49 p50=118.66 p90=142.08 p99=163.58 p99.9=163.58 max=163.58 ms
users_filtered       24 req/s  errors=0  n=143 p50=40.51 p90=50.08 p99=58.49 p99.9=77.76 max=77.76 ms
users_search       134 req/s  errors=0  n=806 p50=5.41 p90=15.37 p99=24.80 p99.9=31.36 max=31.36 ms
orders_q            11 req/s  errors=0  n=64 p50=90.24 p90=101.18 p99=200.83 p99.9=200.83 max=200.83 ms
orders             460 req/s  errors=0  n=2759 p50=2.07 p90=2.65 p99=4.32 p99.9=7.40 max=10.86 ms
traffic_node        31 req/s  errors=0  n=185 p50=30.06 p90=44.35 p99=57.05 p99.9=128.83 max=128.83 ms
traffic_summary      181 req/s  errors=0  n=1086 p50=5.09 p90=7.01 p99=11.17 p99.9=16.66 max=34.94 ms
```
## c1-jit-off
```
dashboard           20 req/s  errors=0  n=120 p50=45.60 p90=69.06 p99=86.59 p99.9=111.42 max=111.42 ms
nodes               24 req/s  errors=0  n=143 p50=39.23 p90=53.63 p99=66.17 p99.9=82.24 max=82.24 ms
nodes_summary       29 req/s  errors=0  n=177 p50=32.46 p90=42.59 p99=48.64 p99.9=73.86 max=73.86 ms
users_filtered       32 req/s  errors=0  n=194 p50=29.15 p90=39.33 p99=51.68 p99.9=57.47 max=57.47 ms
users_search       121 req/s  errors=0  n=726 p50=5.71 p90=17.82 p99=30.02 p99.9=36.86 max=36.86 ms
orders_q            10 req/s  errors=0  n=61 p50=89.98 p90=144.00 p99=191.23 p99.9=191.23 max=191.23 ms
orders             429 req/s  errors=0  n=2572 p50=2.17 p90=3.02 p99=5.21 p99.9=7.77 max=8.62 ms
traffic_node        29 req/s  errors=0  n=177 p50=31.89 p90=44.54 p99=63.45 p99.9=98.69 max=98.69 ms
traffic_summary      185 req/s  errors=0  n=1108 p50=5.01 p90=6.83 p99=11.42 p99.9=13.88 max=15.02 ms
```
## http-after
```
http load: 16 worker(s) x 5s per scenario against ["http://127.0.0.1:18080"]
healthz          36999 req/s  errors=0  n=185035 p50=0.32 p90=0.75 p99=2.27 p99.9=6.38 max=39.20 ms
me                2284 req/s  errors=0  n=11435 p50=6.56 p90=9.77 p99=15.35 p99.9=28.24 max=62.40 ms
users_page1        298 req/s  errors=0  n=1496 p50=54.11 p90=78.97 p99=104.19 p99.9=136.06 max=137.98 ms
users_deep         234 req/s  errors=0  n=1180 p50=65.06 p90=107.39 p99=161.41 p99.9=243.58 max=243.58 ms
user_patch         152 req/s  errors=0  n=774 p50=60.16 p90=257.66 p99=446.46 p99.9=901.12 max=901.12 ms
users_search       373 req/s  errors=0  n=1882 p50=28.77 p90=88.32 p99=236.29 p99.9=417.54 max=443.65 ms
users_filtered       60 req/s  errors=0  n=307 p50=259.84 p90=355.58 p99=419.84 p99.9=486.91 max=486.91 ms
dashboard           44 req/s  errors=0  n=231 p50=361.98 p90=446.46 p99=502.27 p99.9=514.30 max=514.30 ms
nodes               58 req/s  errors=0  n=296 p50=266.50 p90=408.06 p99=522.24 p99.9=574.98 max=574.98 ms
nodes_summary       69 req/s  errors=0  n=364 p50=226.56 p90=341.25 p99=439.81 p99.9=525.31 max=525.31 ms
nodes_etag          70 req/s  errors=0  n=361 p50=220.29 p90=340.22 p99=437.76 p99.9=512.51 max=512.51 ms
audit_page1        614 req/s  errors=0  n=3088 p50=22.88 p90=44.03 p99=74.11 p99.9=105.34 max=128.57 ms
audit_deep         698 req/s  errors=0  n=3507 p50=19.42 p90=39.58 p99=77.44 p99.9=102.53 max=112.83 ms
audit_prefix      1265 req/s  errors=0  n=6348 p50=11.27 p90=19.87 p99=36.38 p99.9=56.29 max=67.84 ms
sub_clash          982 req/s  errors=0  n=4924 p50=14.76 p90=23.25 p99=44.99 p99.9=103.61 max=155.39 ms
sub_links         1089 req/s  errors=0  n=5456 p50=13.99 p90=21.23 p99=31.76 p99.9=41.66 max=53.09 ms
sub_singbox       1074 req/s  errors=1  n=5405 p50=14.16 p90=21.12 p99=30.03 p99.9=40.70 max=50.27 ms
orders             923 req/s  errors=0  n=4644 p50=15.36 p90=26.37 p99=51.10 p99.9=99.52 max=251.13 ms
orders_deep        750 req/s  errors=0  n=3765 p50=19.65 p90=33.89 p99=53.25 p99.9=72.96 max=82.37 ms
orders_search     1759 req/s  errors=0  n=8804 p50=8.01 p90=14.21 p99=25.21 p99.9=53.38 max=107.71 ms
orders_q             3 req/s  errors=0  n=23 p50=4243.45 p90=6168.57 p99=6455.30 p99.9=6455.30 max=6455.30 ms
traffic_user      1096 req/s  errors=0  n=5489 p50=12.65 p90=22.66 p99=41.76 p99.9=88.38 max=183.81 ms
traffic_user_entrances      624 req/s  errors=0  n=3132 p50=20.93 p90=44.41 p99=87.81 p99.9=150.01 max=187.90 ms
traffic_node        21 req/s  errors=0  n=122 p50=732.16 p90=1212.41 p99=1538.05 p99.9=1653.76 max=1653.76 ms
traffic_summary      470 req/s  errors=0  n=2362 p50=29.84 p90=54.17 p99=95.23 p99.9=120.45 max=140.29 ms
traffic_me         450 req/s  errors=0  n=2265 p50=27.15 p90=65.92 p99=133.76 p99.9=371.71 max=512.51 ms
```
## swarm-storm-light
```
== cold=false
converged: 200 agents acked their first snapshot 19.23s after start (max snapshot 1310343 bytes)
storm 1: 200 agents back with a lease: p90 15.20s, all 16.68s; snapshots sent 0
storm 2: 200 agents back with a lease: p90 13.97s, all 15.68s; snapshots sent 0
change -> agent, per agent:     n=400 p50=2639.87 p90=4710.40 p99=7094.27 p99.9=7372.80 max=7372.80 ms
change -> agent, all holders:   n=10 p50=4112.38 p90=5050.37 p99=7372.80 p99.9=7372.80 max=7372.80 ms
  of which PATCH (commit):       n=10 p50=467.20 p90=1011.20 p99=3518.46 p99.9=3518.46 max=3518.46 ms
  commit -> agent, per agent:    n=400 p50=1996.80 p90=3287.04 p99=3997.70 p99.9=4163.58 max=4163.58 ms
snapshots=200 deltas=400 base_mismatch=0 reconnects=400 reports=1887 rows=2280309
billing: reported=521886601377 billed=521886601377 (exact)
final convergence: 200/200 agents match the desired state
== cold=true
converged: 200 agents acked their first snapshot 9.47s after start (max snapshot 1310343 bytes)
storm 1 (cold): 200 agents back with a lease: p90 12.26s, all 13.37s; snapshots sent 199
storm 2 (cold): 200 agents back with a lease: p90 12.19s, all 13.28s; snapshots sent 197
change -> agent, per agent:     n=400 p50=1786.88 p90=2701.31 p99=3411.97 p99.9=4089.86 max=4089.86 ms
change -> agent, all holders:   n=10 p50=2824.19 p90=3270.66 p99=4089.86 p99.9=4089.86 max=4089.86 ms
  of which PATCH (commit):       n=10 p50=115.20 p90=334.59 p99=591.36 p99.9=591.36 max=591.36 ms
  commit -> agent, per agent:    n=400 p50=1575.93 p90=2519.04 p99=3342.34 p99.9=4022.27 max=4022.27 ms
snapshots=600 deltas=400 base_mismatch=0 reconnects=400 reports=1161 rows=567911
billing: reported=320531070717 billed=320531070717 (exact)
final convergence: 200/200 agents match the desired state
```
## criterion-flush
```
   Compiling sqlx v0.9.0
   Compiling akari-panel v2.0.0 (/home/user/akari-workspace/.work/panel-load/akari-panel)
   Compiling cast v0.3.0
   Compiling criterion-plot v0.8.2
   Compiling regex v1.13.1
   Compiling ciborium v0.2.2
   Compiling tinytemplate v1.2.1
   Compiling page_size v0.6.0
   Compiling anes v0.1.6
   Compiling oorandom v11.1.5
   Compiling criterion v0.8.2
   Compiling akari-bench v0.1.0 (/home/user/akari-workspace/.work/panel-load/akari-panel/bench)
    Finished `bench` profile [optimized] target(s) in 4m 59s
     Running benches/panel.rs (/home/user/akari-workspace/.work/panel-load/target/release/deps/panel-fe72ac670eae14f5)
Benchmarking db/flush/50000
Benchmarking db/flush/50000: Warming up for 3.0000 s

Warning: Unable to complete 20 samples in 10.0s. You may wish to increase target time to 97.6s, or reduce sample count to 10.
Benchmarking db/flush/50000: Collecting 20 samples in estimated 97.588 s (20 iterations)
Benchmarking db/flush/50000: Analyzing
db/flush/50000          time:   [1.4430 s 1.5194 s 1.6074 s]
                        thrpt:  [31.106 Kelem/s 32.907 Kelem/s 34.651 Kelem/s]
Found 2 outliers among 20 measurements (10.00%)
  2 (10.00%) high mild

```
## Findings left open
- During an overloaded run (report-all, 2 M rows per report cycle) pooled connections were seen in an aborted / read-only transaction state (errors 'current transaction is aborted', 'cannot execute UPDATE in a read-only transaction') after cancelled tasks; not reproduced after restart with light load. Needs a separate look at cancel-safety of begin_with(READ ONLY) in grpc.rs:2248.
- orders?q= substring search needs pg_trgm (not changed).
- flush 50k 1.52 s here vs 0.58 s PERF reference: unchanged code, hardware difference unverified.
