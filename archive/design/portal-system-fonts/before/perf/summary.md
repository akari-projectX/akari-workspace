### Portal performance (report only, not a gate)

Median of 5 runs, ms. desktop = no throttling; mobile-mid = Pixel 7 viewport, 4× CPU slowdown, 150 ms RTT, 1.6 Mbps down. Cold = fresh context (empty cache). TTI = end of the last long task after FCP (simplified). Route switch = client navigation to content ready, page transition included.

react = the React portal before the cutover (same harness, CI run 39818662219, b3c92fe); v2.0.0 = the Svelte portal as released (CI run 39868263494, v2.0.0); svelte = this run.

| metric | desktop · react | desktop · v2.0.0 | desktop · svelte | Δ vs v2.0.0 | mobile-mid · react | mobile-mid · v2.0.0 | mobile-mid · svelte | Δ vs v2.0.0 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| login cold · FCP | 188 | 60 | 80 | +33% | 3744 | 1128 | 540 | −52% |
| login cold · LCP | 204 | 148 | 192 | +30% | 4100 | 3284 | 1968 | −40% |
| login cold · TTI | 188 | 60 | 85 | +42% | 3748 | 1190 | 1283 | +8% |
| login cold · content ready | 533 | 133 | 219 | +65% | 5820 | 3467 | 2425 | −30% |
| dashboard cold · FCP | 236 | 52 | 84 | +62% | 4296 | 1124 | 532 | −53% |
| dashboard cold · LCP | 576 | 340 | 340 | −0% | 6636 | 4120 | 4044 | −2% |
| dashboard cold · TTI | 236 | 52 | 132 | +154% | 8005 | 3879 | 4235 | +9% |
| dashboard cold · content ready | 658 | 218 | 407 | +87% | 8234 | 4946 | 4820 | −3% |
| route switch → /nodes | 127 | 5 | 124 | +2380% | 224 | 197 | 142 | −28% |
| route switch (without the fade-out) → /nodes | — | — | 27 | — | — | — | 49 | — |
| route switch → /orders | 116 | 12 | 115 | +858% | 162 | 142 | 120 | −15% |
| route switch (without the fade-out) → /orders | — | — | 26 | — | — | — | 35 | — |
| route switch → /shop | 141 | 17 | 122 | +618% | 367 | 74 | 168 | +127% |
| route switch (without the fade-out) → /shop | — | — | 40 | — | — | — | 76 | — |
| route switch → /traffic | 237 | 18 | 140 | +678% | 990 | 637 | 620 | −3% |
| route switch (without the fade-out) → /traffic | — | — | 45 | — | — | — | 537 | — |
| route switch → / | 161 | 13 | 124 | +854% | 263 | 50 | 156 | +212% |
| route switch (without the fade-out) → / | — | — | 56 | — | — | — | 81 | — |

| bundle (KiB, gzip) | react | v2.0.0 | Δ vs v2.0.0 |
|---|---:|---:|---:|
| first-load JS | 155.4 | 42.9 |
| first-load CSS | 24.3 | 9.6 |
| total JS | 436.9 | 232.0 |
| total CSS | 37.3 | 39.3 |

