### Portal performance (report only, not a gate)

Median of 5 runs, ms. desktop = no throttling; mobile-mid = Pixel 7 viewport, 4× CPU slowdown, 150 ms RTT, 1.6 Mbps down. Cold = fresh context (empty cache). TTI = end of the last long task after FCP (simplified). Route switch = client navigation to content ready, page transition included.

react = the React portal before the cutover (same harness, CI run 39818662219, b3c92fe); v2.0.0 = the Svelte portal as released (CI run 39868263494, v2.0.0); svelte = this run.

| metric | desktop · react | desktop · v2.0.0 | desktop · svelte | Δ vs v2.0.0 | mobile-mid · react | mobile-mid · v2.0.0 | mobile-mid · svelte | Δ vs v2.0.0 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| login cold · FCP | 188 | 60 | 92 | +53% | 3744 | 1128 | 548 | −51% |
| login cold · LCP | 204 | 148 | 176 | +19% | 4100 | 3284 | 1752 | −47% |
| login cold · TTI | 188 | 60 | 92 | +53% | 3748 | 1190 | 1270 | +7% |
| login cold · content ready | 533 | 133 | 200 | +50% | 5820 | 3467 | 1802 | −48% |
| dashboard cold · FCP | 236 | 52 | 88 | +69% | 4296 | 1124 | 544 | −52% |
| dashboard cold · LCP | 576 | 340 | 296 | −13% | 6636 | 4120 | 2852 | −31% |
| dashboard cold · TTI | 236 | 52 | 95 | +83% | 8005 | 3879 | 3039 | −22% |
| dashboard cold · content ready | 658 | 218 | 355 | +63% | 8234 | 4946 | 3151 | −36% |
| route switch → /nodes | 127 | 5 | 118 | +2260% | 224 | 197 | 145 | −26% |
| route switch (without the fade-out) → /nodes | — | — | 27 | — | — | — | 51 | — |
| route switch → /orders | 116 | 12 | 117 | +875% | 162 | 142 | 120 | −15% |
| route switch (without the fade-out) → /orders | — | — | 30 | — | — | — | 36 | — |
| route switch → /shop | 141 | 17 | 122 | +618% | 367 | 74 | 141 | +91% |
| route switch (without the fade-out) → /shop | — | — | 40 | — | — | — | 56 | — |
| route switch → /traffic | 237 | 18 | 140 | +678% | 990 | 637 | 375 | −41% |
| route switch (without the fade-out) → /traffic | — | — | 66 | — | — | — | 288 | — |
| route switch → / | 161 | 13 | 122 | +838% | 263 | 50 | 168 | +236% |
| route switch (without the fade-out) → / | — | — | 52 | — | — | — | 81 | — |

| bundle (KiB, gzip) | react | v2.0.0 | Δ vs v2.0.0 |
|---|---:|---:|---:|
| first-load JS | 155.4 | 42.9 |
| first-load CSS | 24.3 | 9.6 |
| total JS | 436.9 | 232.0 |
| total CSS | 37.3 | 39.3 |

