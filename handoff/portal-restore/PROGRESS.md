# portal-restore progress (PR #160, branch portal-restore, worktree .work/portal-restore/akari-panel)

Local visual harness (not committed): .work/portal-restore/harness — mock.mjs (mock panel API :18480), vite dev servers
ref (v1.4.0 React, :5173) and new (:5174, PANEL_URL=http://127.0.0.1:18480), shot.mjs/cmp.sh (side-by-side ref|new), probe.mjs (computed styles),
../i18nfix.py (copies missing English strings from the v1.4.0 dict). Compare images come from this harness (mock data), not CI.

## 1. Auth + legal — commit "portal restore (1/6)"
Compare: design/portal-restore-2026-10/1-auth-legal/compare/ (login, register, forgot, reset, terms (guest) and privacy (signed in); desktop/mobile x light/dark).
Differences: logo (new akari wordmark instead of AKARI box), element positions verified identical via probe (login/register desktop+mobile).

## 2. Dashboard — commit "portal restore (2/6)" (pushed; CI run not yet checked)
Compare: design/portal-restore-2026-10/2-dashboard/compare/ (page-dashboard, dashboard-chart; desktop/mobile x light/dark; harness mock data).
New shared vocabulary (use it for groups 3-5): src/styles/flat.css + src/components/flat/{Section,PaneHead,Split,Row,StatRow,PageTitle,Pager}.svelte
(mirror v1 flat.tsx), Loading/LoadError/Empty = v1 data-state, ui/Menu.svelte = v1 dropdown look (+ sub/tail), Flag.svelte, NodeLegend.svelte,
`.btn.link-btn` = v1 link button, `.notice` = v1 notice card (auth alert is `.au-alert`).
Remaining differences (dashboard): logo; QR has no centre badge; chart section is ~6px taller than v1; the 30/7-day toggle and low-traffic notice of v2 were
removed on purpose (not in v1.4.0); the subscription link text is no longer shown (v1 shows only copy + QR). 
e2e: dashboard.spec.ts rewritten for the new markup (not run locally - CI only). lines.spec.ts / zz-screens still reference old pages (Traffic page etc. = group 4).

## 2b. Dashboard fixes (lead review) - commit "portal restore (2/6): QR centre badge, pending-order banner height"
QR centre badge restored (inline SVG, ECC H, excavated modules, --qr-mark/--qr-ink tokens); pending-order banner now the v1 box (no border, 16px/22px padding) = chart section no longer 6px lower.
Mobile/tablet breakpoints of v1 (statrow 36/48 + stat-v 32 at <=991, 28/40 at <=640, wk 180px) added; v2-only mobile overrides removed.

## 3. Shop, orders, order detail, pay result - commit "portal restore (3/6)"
Compare: design/portal-restore-2026-10/3-shop-orders/compare/ (shop, shop-cards, page-orders, order-detail, confirm-order; desktop/mobile x light/dark; mock data).
New vocabulary in flat.css: .bdg (Badge), .prog, .tabs-pill (components/flat/Tabs.svelte), .tbl/.tbl-w/.flat-head, plan-cols/plan-card, fstep/popt/pmeth/flow-* (confirm dialog), od-* (order detail), ResultDialog (ui/ResultDialog.svelte), .md-hide/.md-only.
Global fixes found with the geometry tool: h1-h4 tracking -0.022em (base layer), .btn padding 10px, mono font stack, .dlg title selector ([data-dialog-title]), --brand-ink token.
Tool: harness/geo.mjs <path> [--device=mobile] [--theme=dark] [--click=css] : text-anchored geometry+colour diff ref vs new (0 diffs = identical positions). Use it for every page.
Wallet flake (lead request): Wallet.svelte `const title = t(..)` was non-reactive; if the route component was created before the English dictionary arrived (reload with akari.locale=en) the h1 stayed Chinese. Now $derived (also `sub`). Grep found no other top-level non-reactive t() consts.
Remaining differences (group 3): logo; login page y offsets of 2px (auth, to revisit in group 6); dialog vertical centring 2-3px; "计费" trailing space width (dashboard).
e2e: shop.spec selectors rewritten for the new markup (not run locally). zz-screens: shop, shop-cards, pay-success added.

## 4. Wallet / invite / withdrawals + nodes - commit "portal restore (4/6, part 1)" (traffic NOT done yet)
Compare: design/portal-restore-2026-10/4-wallet-nodes-traffic/compare/ (wallet, invite, wallet-withdrawals, nodes). geo.mjs shows 0 diffs for nodes + wallet ledger; invite/withdrawals only 3-5px column drift from auto table layout (data-dependent).
Done: Wallet.svelte, components/wallet/{Ledger,Withdrawals,InviteDetails,InviteLink}, WithdrawDialog footer, Nodes.svelte; flat/Tabs gets idPrefix/px3/mb7/inline; classes .wtbl, .mini-stats, .sub-title, .cp-*, .nlegend.plain, .srch, .tp-sm.
Global fixes this round: .btn gap 6px (sm 4px), .btn.ghost = fg (removed v2 muted override in content.css; use .ghost.muted), h-sizes of NodeState (14px) vs legend/dashboard (12.5px), container-query for the import list, pinb height 20.
TODO group 4: Traffic.svelte (still v2 markup: .ph/.kpis/.sec/.sh/tbl). v1: pages/dash/traffic.tsx = StatRow + area chart (recharts, 300px, gradients) with Tabs range (month/7/30) + Split(donut pie of lines | billed bar chart) + tables via .tbl.flat-head + progress bars in the daily table. Charts must be hand-written SVG reproducing recharts look (existing components/dash/TrafficChart.svelte is the v2 30-day area chart - check/reuse). Then geo.mjs /traffic desktop+mobile, compare images, check.
TODO e2e selectors NOT yet updated for groups 3-4 leftovers: wallet.spec.ts (tabs now role=tab in flat/Tabs; classes .big/.mini/.cols gone -> .stat-v/.mini-stats; ledger rows .rows -> .md-hide; table rows .wtbl), support/account specs for group 5; lines.spec.ts (nodes: .rc/.mult/.st classes gone -> .nstate/.rate/.flag; Traffic page). CI is the judge - read failures from the e2e job log.
zz-screens still needs: docs, invite, wallet, wallet-ledger, wallet-withdrawals shots (names in design/portal-v1-reference-2026-10/screens), page-tickets/account exist.
Remaining differences (group 4): Select in withdraw dialog is the native <select> (v1 = shadcn Select popover); table column drift 3-5px; logo.

## 4b. Traffic + Select (commit "portal restore (4/6)") - DONE
Traffic.svelte = v1 (StatRow, area chart + range Tabs, donut | bar, tables). Hand-written SVG recharts look: components/charts/{AreaChart,BarChart,Donut,ChartTip,Legend}.svelte + lib/rechart.ts (nice ticks, monotone path, preserveEnd label mask). Chart class prefix .rch/.rc-*/.clg/.ctip in flat.css; tokens --chart-1..5 added. geo /traffic = only split-text diffs. Select popover: components/ui/Select.svelte (bits-ui) used in WithdrawDialog and NewTicket. Table link-btn border fixed (withdrawals columns now identical).
e2e (CI run of 688a9fd had 3 failures: auth register nav, dashboard copy toast (no clipboard grant), dashboard downloads) fixed; wallet/lines/support specs rewritten for new markup (NOT yet seen in CI: 36 tests "did not run" in that run because of max-failures).

## 5. Group 5 - partly done (commits 5/6 part 1,2,3)
DONE (geo ~0 diffs): Announcements (an-* classes), Tickets list (Row/StatRow/Section; dialogs unchanged), Account/settings (.settings-page, .set-row v1 values, seg pills, passkey list), Docs list (chips + cards, geo 0 diffs).
NOT DONE: help Article view (components/help/Article.svelte; v1 pages/dash/help.tsx ArticleView lines ~324-615: breadcrumb header, meta row, TOC rail, prev/next, copy-sub, 15.5px body) - geo /help?id=h1 18 of 18 diffs. Ticket dialogs (Thread/NewTicket body) not geo-checked (geo.mjs only sees page text; use --click on the row). Notification/other dialogs from group 3 keep 2-3px centring diff.

## Group 5 finished + group 6 (worker 4)
Commits after 8df577d: help article (v1.4.0 layout, geo 0 diffs desktop+mobile), reading dialogs (Dialog `reading` + `meta`; ticket thread + announcement geo ~0), new-ticket dialog geometry, flow header padding 24 (fixes the 2-3px centring diff of all flow dialogs), Select trigger 32px,
zz-screens extended (docs, docs-article, invite, wallet, wallet-ledger, wallet-withdrawals, page-nodes/traffic/announcements), page fade-out (App.svelte shown/leaving; router only scrolls to top itself for same-path changes), dialogs follow the soft keyboard (lib/visual-viewport.ts),
v2-only CSS removed (script: scratchpad prune.py logic = drop rules whose every selector has a class unused in markup), Placeholder.svelte + lib/lines.ts deleted, portal/CLAUDE.md updated, docs list mobile spacing + search result bar.
Later in the same worker: e2e fixes (lines/shop/orders/wallet/auth/support selectors), CSS split (pages.css = old content.css + flat.css pages part, imported by dash pages; initial CSS 19.4 -> 12.4 KiB gzip; v2.0.0 was 9.6), zz-screens pay-success + wallet tabs on phones fixed.
CI run 40274700026 (98b41e7): only the support thread meta test failed (fixed). Perf of that run vs v2.0.0 (scratchpad perf-v2 / perf-pr): desktop login.fcp 60->140, dashboard.fcp 52->160, switch 5-18 -> ~120 (includes the new 100 ms fade-out), mobile-mid login.fcp 1128->1768, dashboard.fcp 1124->1980 BEFORE the CSS split (run for 95dcca3 has it; compare again: portal-perf artifact).
REPORT: design/portal-restore-2026-10/REPORT.md (PERF_PLACEHOLDER to replace with the numbers), compare/ images built from portal-screens artifact with scratchpad sbs.mjs (node sbs.mjs <ref dir> <ci screens dir> <out>); regenerate from the final green run.
Geo summary (harness): see out/geo1.txt geo2.txt geo3.txt.
TODO: read final CI (run for latest push), if perf still clearly slower than v2.0.0 reduce initial CSS further (app.css 44 KB raw: dialogs, settings, auth pieces are lazily needed) and/or investigate FCP; fill REPORT perf, regenerate compare images; PR body perf numbers (gh pr edit 160 --body-file); gh pr ready 160.
