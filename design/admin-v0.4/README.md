# Admin console design prototype (W33-a, panel v0.4)

Clickable design prototype for the new admin console. **Design only**: mock
data, no network calls, no backend. The real implementation (W33-b) starts
after the design is approved. The Chinese design write-up for review is
[`DESIGN.md`](DESIGN.md).

Stack matches the panel SPA: Vite 8 + React 19 + TypeScript 5.9 + Tailwind 4
(`@tailwindcss/vite`), `class-variance-authority`, `clsx`, `tailwind-merge`.
No router, icon or chart library; no inline scripts (works under the panel's
`script-src 'self'` CSP).

## Run

```bash
cd design/admin-v0.4
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc --noEmit + vite build → dist/ (gitignored)
npm run screenshots  # needs a build; starts vite preview, writes screenshots/
./scripts/compress.sh  # 256-colour PNGs (ImageMagick) to keep the folder small
```

`scripts/screenshots.mjs` uses Playwright with `/opt/pw-browsers/chromium` when
present (override with `CHROMIUM_PATH`).

### URL parameters

Every screen is linkable (and is how screenshots are taken):

| Param | Values | Effect |
|---|---|---|
| `page` | `login dashboard status users orders nodes plans settings` (+ placeholders) | current page |
| `theme` | `light` / `dark` | force theme (default: localStorage → OS) |
| `lang` | `en` / `zh` | UI language (Chinese first; the top-bar button toggles) |
| `state` | `loading` / `empty` / `error` | render the page in that state |
| `open` | user / order / entrance / plan id | open its detail drawer |
| `tab` | settings: `site security subscription signup mail block cleanup`; plans: `groups` | sub-page |
| `filter` | `never` (users) | "never used" + "registered before" filters |
| `mode` | `passkey` (login) | passkey-only policy |
| `demo` | `palette`, `bind`, `new-user`, `ban`, `bulk-delete`, `quota`, `rotate-prefix`, `delete-domain`, `sub-path`, `mail-test` | open a dialog |

Keyboard: `Ctrl/⌘ K` command palette, `Esc` closes drawers/dialogs.

## Design tokens (`src/index.css`)

Same token names as `akari-panel/spa/src/index.css` so W33-b can lift the file:
colours are CSS variables on `:root` and redefined under `.dark` (class on
`<html>`), mapped to Tailwind via `@theme inline`.

| Group | Tokens |
|---|---|
| Surfaces | `background`, `card`, `popover`, `muted`, `subtle`, `sidebar`, `sidebar-accent` |
| Text | `foreground`, `card-foreground`, `muted-foreground`, `sidebar-foreground` |
| Brand | `primary`, `primary-foreground`, `primary-soft`, `ring` |
| Status | `success`, `warning`, `info`, `destructive` (+ `-soft` background, `destructive-foreground`) |
| Lines | `border`, `input` |
| Charts | `chart-1` … `chart-4` |
| Radius | `sm .375rem` (badges/checkbox) · `md .5rem` (controls) · `lg .75rem` (cards) · `xl 1rem` (dialogs) |
| Elevation | `shadow-card` (resting), `shadow-pop` (drawer, dialog, popover, palette) |
| Type | Inter / system + PingFang SC / Microsoft YaHei / Noto Sans CJK; 13 px body in dense UI, 14 px forms, 20 px page title; tabular numbers |
| Spacing | 4 px grid; page gutter 16 px (phone) / 24 px; card padding 16/20 px; table row 40 px |

Status colours always come with text or an icon (never colour alone).

## Component inventory (`src/ui/`)

| Component | File | Notes |
|---|---|---|
| Button (primary/secondary/ghost/soft/destructive/destructive-soft/link × sm/md/lg/icon) | `primitives.tsx` | cva variants |
| Badge (neutral/primary/success/warning/danger/info/outline, optional dot) | `primitives.tsx` | |
| Card / CardHeader / CardBody, PageHeader, Callout, KV, SettingRow | `primitives.tsx` | |
| Input, Textarea, Select, Field, Switch, Checkbox (indeterminate), Segmented, Tabs | `primitives.tsx` | |
| Progress (+ `usageTone` 80 %/100 % thresholds), Dot, Kbd | `primitives.tsx` | |
| Skeleton, EmptyState, ErrorState | `primitives.tsx` | loading / empty / error |
| DataTable (column chooser, selection + bulk bar, card list below `md`), Pager, FilterChip | `table.tsx` | |
| Drawer, Dialog, ConfirmDialog (affected count + type-to-confirm), Toast, Popover/MenuItem | `overlays.tsx` | `useConfirm()`, `useToast()` |
| Sparkline, Bars, Ring | `charts.tsx` | dependency-free SVG |
| Icon (≈70 stroke icons) | `icons.tsx` | |
| Shell: collapsible sidebar, top bar, command palette | `../shell.tsx` | |

## Page map

| Page | File | Decisions shown |
|---|---|---|
| Login | `pages/login.tsx` | D1 email, D4 secret prefix, D7 passkey (+ passkey-only, bind prompt), Turnstile slot, no TOTP |
| Dashboard | `pages/dashboard.tsx` | cards, 14-day traffic, to-do list, latest orders, server quota bars |
| System status | `pages/status.tsx` | W31 host / PG / Valkey / Caddy / instances / jobs |
| Users | `pages/users.tsx` | D10 filters + bulk delete, D12 subscription card + plan actions, W28 ban with reason |
| Orders | `pages/orders.tsx` | amount breakdown, fulfil error, refund double confirm |
| Nodes | `pages/nodes.tsx` | D2 server → node → entrances, §5 relay entrances + probe, D9 rate windows + overlap + heatmap, D5 server quota + exceeded, W29 per-node toggle |
| Plans | `pages/plans.tsx` | D3 plan → node group → entrance |
| Settings | `pages/settings.tsx` | D8 domains, D4 prefix + allowlist, D7 policy, D11 path, W30 templates, W27 signup, W31 mail test, W29 rule sets, D10 cleanup |
| Coupons, finance, tickets, content, alerts, updates, audit, account | `pages/placeholder.tsx` | out of scope; migrated as-is in W33-b |

## Open questions

See [`DESIGN.md` §5](DESIGN.md#5-需要你决定的问题) (Chinese). Summary:

1. Random subscription domain per user: on or off by default?
2. Server quota counts xray-accepted user bytes or NIC bytes?
3. Should a ban keep portal login (to show the reason) — as designed — or block it?
4. Admin "extend N days" without an order: allowed for all plans, including one-time packs?
5. Passkey-only for admins: also require ≥ 2 passkeys before enabling?
6. Changing the subscription path: offer "email all users the new link"?
7. Bulk delete from a filter: delete all matching rows (as designed) or only the selected page?
8. Phone layout turns tables into card lists — acceptable, or keep horizontal scroll for some tables?
9. Do coupons / finance / tickets / content / alerts / updates / audit need a design pass before W33-b?
10. Block-rule changes rebuild xray (drops connections): fine, or schedule them?
