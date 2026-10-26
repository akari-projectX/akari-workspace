# Portal restore: v1.4.0 look in the Svelte portal (PR #160)

Reference = `design/portal-v1-reference-2026-10/screens/` (v1.4.0 React portal). Restored = the CI screenshot set `portal-screens` (`portal/e2e/zz-screens.spec.ts`, real seed data, same viewports 1440x900 / 390x844 @2x, same themes).
Every compare image below is **reference (left) | restored (right)**, taken from the CI artifact of the PR run. Obsolete USDT payment shots (`usdt-*`) have no counterpart on purpose (the flow they show was removed).

## Geometry check (text-anchored diff)

For every page the local harness (v1.4.0 Vite dev server next to the new app, same mock API) compares each text block's position, size, font and colour. `N / M` = blocks that differ / blocks compared. 0 means pixel-identical text layout.

| page | diff |
|---|---|
| page-dashboard | 1 / 131 (a width of the "计费" label, data dependent) |
| dashboard-chart | covered by the dashboard run |
| shop | 0 / 64 |
| shop-cards | 0 (plan grid) |
| page-orders | desktop 1 / 72 (3 px on a link button), mobile 0 / 43 |
| pay-success | dialog, 0 after the flow-dialog header fix |
| wallet | desktop 3 / 60 (table column drift 3 px, auto table layout), mobile 0 / 50 |
| invite | same page as wallet (invite tab) |
| wallet-ledger | 0 / 47 desktop, 0 / 40 mobile |
| wallet-withdrawals | 2 / 45 desktop, 2 / 40 mobile (column drift) |
| page-tickets | 5 / 36 (the unit "张" of a stat is 4 px wider in the new page; screen-reader text is not in the old one) |
| page-account | 1 / 51 (2 px on one value) |
| docs | 0 / 27 desktop and mobile; search results bar 0 / 29 |
| docs-article | 0 / 18 desktop, 0 / 15 mobile |
| page-privacy | 0 (legal pages) |
| nav | the shell; only the logo differs |
| loading-skeleton | visual only |
| page-nodes | 0 / 59 desktop, 0 / 44 mobile |
| page-traffic | 6 / 210 (split text nodes of the donut legend), same on mobile |
| page-announcements | 1 / 17 (4 px on the unread counter) |
| dashboard-chart-tip | chart tooltip |
| page-login | 9 / 11 (about 2 px in y; new logo) |
| page-register | 13 / 20 (about 2 px in y) |
| page-forgot | 2 / 6 |

Dialogs (new ticket, ticket thread, announcement, flow dialogs) are within 0 diffs of the reference after this PR (the earlier 2-3 px centring difference came from the flow dialog header padding, now 24 px like v1.4.0).

## Remaining differences and why

- **Logo**: the new akari wordmark replaces the old AKARI box (user decision, not restored).
- **Login / register**: about 2 px vertical offsets in the auth card (different font metrics of the new wordmark above the form).
- **v2-only items removed for v1 parity**: the 7/30 day toggle and the low-traffic notice on the dashboard, and the visible subscription link text (the copy button stays).
- **Table column widths** (wallet withdrawals, orders): 3-5 px drift because the table layout is automatic and depends on the data.
- **Select popovers** are drawn by bits-ui (v1.4.0: Radix); same size and spacing, item hover animation not identical.
- **Charts** are hand-written SVG reproducing the recharts look; tick label rounding matches, the hover tooltip animation is simpler.
- **Page transition**: the old page now fades out for 100 ms (v1.4.0 behaviour); the CI perf harness counts it in "switch" times.
- **Dialogs** follow the soft keyboard on phones (visualViewport), as in v1.4.0.

## Performance vs v2.0.0 (CI perf harness, same specification)

PERF_PLACEHOLDER

## Compare images

### dashboard-chart

![dashboard-chart-desktop-dark](compare/dashboard-chart-desktop-dark.png)

![dashboard-chart-desktop-light](compare/dashboard-chart-desktop-light.png)

![dashboard-chart-mobile-dark](compare/dashboard-chart-mobile-dark.png)

![dashboard-chart-mobile-light](compare/dashboard-chart-mobile-light.png)

### dashboard-chart-tip

![dashboard-chart-tip-desktop-dark](compare/dashboard-chart-tip-desktop-dark.png)

![dashboard-chart-tip-desktop-light](compare/dashboard-chart-tip-desktop-light.png)

![dashboard-chart-tip-mobile-dark](compare/dashboard-chart-tip-mobile-dark.png)

![dashboard-chart-tip-mobile-light](compare/dashboard-chart-tip-mobile-light.png)

### docs

![docs-desktop-dark](compare/docs-desktop-dark.png)

![docs-desktop-light](compare/docs-desktop-light.png)

![docs-mobile-dark](compare/docs-mobile-dark.png)

![docs-mobile-light](compare/docs-mobile-light.png)

### invite

![invite-desktop-dark](compare/invite-desktop-dark.png)

![invite-desktop-light](compare/invite-desktop-light.png)

![invite-mobile-dark](compare/invite-mobile-dark.png)

![invite-mobile-light](compare/invite-mobile-light.png)

### loading-skeleton

![loading-skeleton-desktop-dark](compare/loading-skeleton-desktop-dark.png)

![loading-skeleton-desktop-light](compare/loading-skeleton-desktop-light.png)

![loading-skeleton-mobile-dark](compare/loading-skeleton-mobile-dark.png)

![loading-skeleton-mobile-light](compare/loading-skeleton-mobile-light.png)

### nav

![nav-desktop-dark](compare/nav-desktop-dark.png)

![nav-desktop-light](compare/nav-desktop-light.png)

![nav-mobile-dark](compare/nav-mobile-dark.png)

![nav-mobile-light](compare/nav-mobile-light.png)

### page-account

![page-account-desktop-dark](compare/page-account-desktop-dark.png)

![page-account-desktop-light](compare/page-account-desktop-light.png)

![page-account-mobile-dark](compare/page-account-mobile-dark.png)

![page-account-mobile-light](compare/page-account-mobile-light.png)

### page-dashboard

![page-dashboard-desktop-dark](compare/page-dashboard-desktop-dark.png)

![page-dashboard-desktop-light](compare/page-dashboard-desktop-light.png)

![page-dashboard-mobile-dark](compare/page-dashboard-mobile-dark.png)

![page-dashboard-mobile-light](compare/page-dashboard-mobile-light.png)

### page-orders

![page-orders-desktop-dark](compare/page-orders-desktop-dark.png)

![page-orders-desktop-light](compare/page-orders-desktop-light.png)

![page-orders-mobile-dark](compare/page-orders-mobile-dark.png)

![page-orders-mobile-light](compare/page-orders-mobile-light.png)

### page-privacy

![page-privacy-desktop-dark](compare/page-privacy-desktop-dark.png)

![page-privacy-desktop-light](compare/page-privacy-desktop-light.png)

![page-privacy-mobile-dark](compare/page-privacy-mobile-dark.png)

![page-privacy-mobile-light](compare/page-privacy-mobile-light.png)

### page-tickets

![page-tickets-desktop-dark](compare/page-tickets-desktop-dark.png)

![page-tickets-desktop-light](compare/page-tickets-desktop-light.png)

![page-tickets-mobile-dark](compare/page-tickets-mobile-dark.png)

![page-tickets-mobile-light](compare/page-tickets-mobile-light.png)

### shop

![shop-desktop-dark](compare/shop-desktop-dark.png)

![shop-desktop-light](compare/shop-desktop-light.png)

![shop-mobile-dark](compare/shop-mobile-dark.png)

![shop-mobile-light](compare/shop-mobile-light.png)

### shop-cards

![shop-cards-desktop-dark](compare/shop-cards-desktop-dark.png)

![shop-cards-desktop-light](compare/shop-cards-desktop-light.png)

![shop-cards-mobile-dark](compare/shop-cards-mobile-dark.png)

![shop-cards-mobile-light](compare/shop-cards-mobile-light.png)

### wallet

![wallet-desktop-dark](compare/wallet-desktop-dark.png)

![wallet-desktop-light](compare/wallet-desktop-light.png)

![wallet-mobile-dark](compare/wallet-mobile-dark.png)

![wallet-mobile-light](compare/wallet-mobile-light.png)

### wallet-ledger

![wallet-ledger-desktop-dark](compare/wallet-ledger-desktop-dark.png)

![wallet-ledger-desktop-light](compare/wallet-ledger-desktop-light.png)

### wallet-withdrawals

![wallet-withdrawals-desktop-dark](compare/wallet-withdrawals-desktop-dark.png)

![wallet-withdrawals-desktop-light](compare/wallet-withdrawals-desktop-light.png)
