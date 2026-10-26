# Brief: restore the v1.4.0 portal look in the Svelte portal (shared by every portal-restore PR)

User decisions (2026-10-23, SPRINT): "我觉得还是上个版本的门户好看 … 恢复使用上个版本的门户 UI，用新框架重构，不重新设计"; "默认 logo 用新的"; "还有后台 logo 也是"; first priority.

## What
The portal (`akari-panel/portal/`, Svelte 5 + Vite + Tailwind 4, shipped in v2.0.0 with the "克制排版风" redesign) must look and feel **exactly like the v1.4.0 React portal** again — layout, navigation (仪表盘 / 商店 / 文档 / 邀请 / 工单 / 更多▾ with the v1.4.0 dropdown and mobile menu), colours, typography, spacing, components (cards, dialogs, tables, badges, toasts, skeletons, spinner), charts, motion, copy texts and empty/error/loading states. **Do not redesign anything and do not "improve" visuals.**

## Keep from v2 (non-visual)
- The Svelte architecture: plain Vite + small router, lazy routes, **route prefetch** (`portal/src/lib/prefetch.ts`) and all performance work — the restored portal must not be slower than v2.0.0 (perf harness `portal/e2e/perf`, numbers in the PR).
- Behaviour fixes made during v2: commission clawback display, `alertdialog` for confirmations, ticket counter on phones, long order numbers wrapping, mobile menu focus ring only for keyboard, chart focus ring only for keyboard, 30-day traffic chart reading `/me/traffic`, everything else in the v2 PR bodies.
- USDT on-chain payment stays removed (#151). USDT withdrawals stay.
- Dependencies latest (user rule), CSP rules, colour tokens only in `portal/src/styles/tokens.css` (+ colour-literal lint) — the token VALUES become the v1.4.0 values.
- The e2e suite (every scenario keeps passing; selectors/screenshots updated), i18n checks, error-code checks.

## Default logo
The new L3 lowercase "akari" wordmark + icon stays the **default** (backup: `design/brand-backup-2026-10/akari-l3-logo/`; already in `portal/src/components/{Logo,Wordmark}.svelte`, favicon/apple-touch-icon), placed where v1.4.0 showed the logo (top-left nav, boot splash, login page, favicon); an operator-uploaded PNG logo/favicon still wins (as in v1.4.0). The gap between logo and nav menu = v1.4.0's.

## Visual source of truth
1. **Code**: read-only checkout of tag `v1.4.0` at `/home/lam/projectX/akari-workspace/.work/ref-v1.4.0/` — `spa/src/` (React components, `index.css` tokens/motion, Tailwind classes, layout/nav, pages under `spa/src/pages/`, shared components, `spa/CLAUDE.md` design notes). Port markup structure and class names 1:1 where possible (Tailwind classes translate directly; Radix/shadcn → bits-ui/shadcn-svelte equivalents with the same look; recharts → hand-written SVG that reproduces the v1.4.0 chart's appearance).
2. **Screenshots**: `/home/lam/projectX/akari-workspace/design/portal-v1-reference-2026-10/screens/` (v1.4.0 release CI `portal-screens`: dashboard, chart + tooltip, docs, invite, nav, account/dashboard/orders/privacy/tickets pages, pay-success, shop + shop cards, wallet + ledger + withdrawals, loading skeleton; USDT shots are obsolete). For pages without a shot, follow the v1.4.0 source exactly.
3. **Acceptance**: the new portal's screenshot set must include a same-name counterpart for every reference shot (same seed data where possible, same viewport/theme); put side-by-side comparison images (reference | restored) in `design/portal-restore-2026-10/<pr>/compare/` and list every remaining difference with its reason in the PR body (acceptable reasons: logo, removed USDT, v2 behaviour fixes, data differences).

## Delivery (user rule 2026-10-26: one feature = one PR)
PR 1 (shell, #157) is done. **Everything else is ONE PR** (branch `portal-restore`), one commit per page group, in this order — the lead accepts each commit (compare images + diff) as it lands:
1. Auth + legal pages.
2. Dashboard (incl. the v1.4.0 「近 7 日流量趋势」 chart look).
3. Shop, confirm order, orders, order detail, payments (balance / Alipay / EPay).
4. Wallet, invite, withdrawals; nodes; traffic.
5. Docs/help + articles, announcements, tickets, account & settings.
6. Wrap-up: full comparison report `design/portal-restore-2026-10/REPORT.md`, perf re-run vs v2.0.0 (not slower), page-transition fade-out of the old page and dialogs following the soft keyboard (v1.4.0 behaviour), cleanup of v2-only styles/components, `portal/CLAUDE.md` and docs.
Use prefixed class names (a generic `.top` collided with `.li.top` in PR 1). Workers that hit the context cap hand off; the next worker continues the same branch/PR.

## Rules
Follow `briefs/COMMON.md`, `briefs/DEFECT-CHECKLIST.md`, and for any Rust change `briefs/RUST-STYLE.md`. One agent = one PR; no helper agents; context cap 350k (push, HANDOFF.md, report "HANDOFF"). **Context economy**: never Read whole large docs (akari-panel/CLAUDE.md ~60k tokens, portal/CLAUDE.md, spa/CLAUDE.md in the ref checkout) — grep/sed what you need. Worktree under `.work/<branch>/akari-panel`. Local fast checks only; never `make smoke`; never read `akari-panel/data/` or `~/secrets`. Don't merge, bump or tag. Wrap `gh` in `timeout 60` and retry (local proxy flaky); `npm audit` "audit endpoint returned an error" = npm outage → `gh run rerun <id> --failed`. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Don't push again while a run is in progress unless something failed; batch fixes; rebase onto the latest main right before the final push.
