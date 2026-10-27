# Portal system fonts (PR #179)

## Changes
- Self-hosted fonts removed (Noto Sans SC slices, Inter, fonts.ts, language-switch prefetch, fonts-src, subset scripts, licences). admin/ untouched.
- `--font-ui` is a system stack, Latin first: -apple-system, BlinkMacSystemFont, "Segoe UI", then CJK (PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans CJK SC, Noto Sans SC, Source Han Sans SC), system-ui, Roboto, Helvetica Neue, Arial, sans-serif.
- Weights are only `--fw-regular` (400) and `--fw-strong` (600). Old 500/600/700 all map to 600; 300 and below map to 400. `npm run check:weights` (part of `npm run check`) fails on any other weight under portal/src.
- Hierarchy comes from colour tokens (tokens.css only), size and the two weights. Units, tag chips and counters are regular weight. tabular-nums is explicit on prices, traffic numbers and tables (Inter's tnum was relied on before).
- Stat grid redesign (own commit): all page-header stat blocks use one component (`StatRow`: dashboard, orders, traffic, nodes, tickets). It was a flex-wrap with a 72px gap and auto widths, so columns drifted between rows. Now `display:grid; repeat(4, minmax(0,1fr))`, gap 40/48. At <=900px it is 2 columns (gap 32/24), a 3-item block gets 3 columns and a 2-item block 2 (no lopsided hole). Cards are flex columns, so rows stretch to equal height. Descriptions are muted, limited to 2 lines (line-clamp). Value size steps 36, 32, 28 (<=640) and 24 (<=380) so a long amount fits two phone columns. Copy shortened: "已付款且未退款" (Paid and not refunded), "超时自动关闭" (Closes automatically on timeout). The wallet balance pane and node-preview counters are different layouts and were left alone.

## Perf (CI portal-perf, median of 5, ms; before = merge-queue run 40402726223 at main 73cfa2d, after = PR run 40406696423)
| metric | desktop before | desktop after | mobile-mid before | mobile-mid after |
|---|---:|---:|---:|---:|
| login FCP | 80 | 92 | 540 | 548 |
| login LCP | 192 | 176 | 1968 | 1752 |
| login content ready | 219 | 200 | 2425 | 1802 |
| dashboard FCP | 84 | 88 | 532 | 544 |
| dashboard LCP | 340 | 296 | 4044 | 2852 |
| dashboard TTI | 132 | 95 | 4235 | 3039 |
| dashboard content ready | 407 | 355 | 4820 | 3151 |
Route switches are within noise except traffic on mobile (620 to 375). The report has no CLS or byte metrics.
Bytes (local `vite build` of main vs branch, portal/dist/app): 2,362,491 B in 285 files to 896,253 B in 165 files (fonts alone were 1,387,212 B; the branch ships none). CSS gzip 41.5 KB to 26.5 KB; JS gzip 242.2 KB to 243.2 KB (the stat-grid commit adds almost nothing).

## CI
Full suite green on 8283d5b (label full-ci): rust, portal, admin, cargo-deny, shellcheck, release keys, coverage, smoke, build, docker, three installer jobs, e2e shards and perf. `rebaseable: true`; main did not move.

## Caveat
The CI runner is Linux: Latin falls to DejaVu Sans and CJK to whichever Noto CJK weights are installed. Screens therefore do not show PingFang, Segoe UI or Microsoft YaHei. On the runner the CJK face looks regular where 600 is requested (headings such as "我的订单", "仪表盘" look lighter than before); this is a runner font limitation, but the lead should confirm on a real Mac and Windows machine.

## Image pairs to look at (before/ vs after/ screens)
- Stat grids: mobile-orders-dark/light, page-orders-{desktop,mobile}-{light,dark}, page-dashboard-{desktop,mobile}-{light,dark}, page-traffic-{desktop,mobile}-{light,dark}, page-nodes-*, page-tickets-*, mobile-dashboard-renewal-*, mobile-dashboard-banned-*
- Weight and hierarchy: page-login-*, page-account-*, shop-cards-*, wallet-*, docs-article-*
- Chips and units: mobile-announcements-tags-*, mobile-nodes-*, mobile-order-paid-*
- Latin vs CJK mix: nav-desktop-*, mobile-menu-*
