# UI/UX audit — 2026-10-02 (W19)

**Target:** akari-panel main d989441, run locally with seeded data (two real agents, mock Alipay, Mailpit).
**Coverage:**
- 229 page states at 1440×900 and 390×844.
- User pages in zh and en; admin in zh, plus one pass in an en-US browser.
- Tickets (W17) were not merged yet and are not covered.

Screenshots and reproduction scripts are in the session scratchpad (`ux-audit/`, 84 MB, not committed). The crawl scripts (`crawl.mjs`, `flow2.mjs`, `seed*.py`, `start.sh`) are copied next to this file.

**Clean results:**
- No CSP violations, page errors or 5xx responses.
- No page-level horizontal scroll on phone.
- No unlabeled form controls.
- Every page loaded in under 0.9 s.
- No untranslated UI strings on user pages.
- Every destructive action probed asks for confirmation.
- The Alipay QR, polling and cancel flow works in both locales.

## BLOCKER

**B1. Users never see their subscription link; getting one breaks every device already using it.**
- Location: `spa/src/pages/portal.tsx:87-138`; same problem for admins in `admin-users.tsx:47` ("只显示这一次").
- Why: the server stores only `sub_token_hash`. The link exists only once, right after `POST /me/sub-token`, which rotates it, so every new device costs a rotation that cuts off the others.
- Fix:
  1. Store the token encrypted at rest (key in `data/`), and keep the hash for lookup.
  2. Return `sub_url` from `/me` and show it permanently, with Copy (with feedback), a QR code, and import buttons: `clash://install-config?url=`, `shadowrocket://add/sub://`, `sing-box://import-remote-profile?url=`.
  3. Keep "reset link" as a secondary action behind a confirmation.
  4. Add "复制订阅链接" to the admin user panel.

## MAJOR

- **M1. The portal is a single page of 12 stacked cards with no navigation.** It is about 3 100 px tall on desktop and about 5 200 px on phone, and the shop sits below the account cards.
  - Fix: split it into views with a top nav (bottom tabs on phone): 仪表盘 / 购买套餐 / 节点 / 订单 / 邀请与钱包 / 账户设置.
  - Give the shop a deep link `/app/shop` so emails can link to it.
- **M2. A quota-exhausted user is offered the wrong purchase.**
  - What happens: the plan preselects 月付, which is refused, so the user sees a disabled button. The reset pack — the right action — is not preselected, and the refusal text appears twice.
  - Cause: `purchase.tsx` falls back to `offers[0]`.
  - Fix: preselect `reset` when `me.quota_exhausted`, otherwise the first offer that can actually be bought. Add a call-to-action in the banner.
- **M3. The admin users list has no search, filter, total count or sort.**
  - Fix: `GET /users` accepts `q`, `plan_id`, `status`, `sort` and returns `total`. Add a search box and filter chips, and move "新建用户" into a dialog.
- **M4. Admin tables are cramped at 1440 px.** Badges and headers wrap one character per line, and the lease time is shown vertically.
  - Cause: the console is `max-w-6xl` and `Badge` lacks `whitespace-nowrap`.
  - Fix: add nowrap, use a wider or full-width layout, trim the node columns, and move row actions into a "⋯" menu.
- **M5. Admin tables are unusable on phone.** Action buttons are off-screen, the scroll container has no visual hint, and the nav clips "更新".
  - Fix: show rows as cards below `sm`, or make the first and action columns sticky. Add fade edges to show more content is off-screen.
- **M6. English server text leaks into the Chinese console and user pages.**
  - About 123 server error literals exist; only about 50 are mapped (`ADMIN_KNOWN` 10, `KNOWN` about 40).
  - The install TLS warning is in English, a node button reads "bootstrap", and the audit view shows raw action codes and JSON.
  - Fix:
    - Return error codes with parameters and map them in the SPA, or write admin-facing server messages in Chinese.
    - Add a CI check for unmapped strings.
    - Rename the button to "手动引导文件".
    - Give the audit view Chinese action labels and a field-level diff.
- **M7. Admin dates follow the browser locale, and expiry inputs are UTC.**
  - Locale: `toLocaleString()` is called without a locale in `admin-nodes.tsx`, `admin-node-status.tsx`, `admin-node-cert.tsx` and `line-chart.tsx`.
  - UTC: the expiry inputs are labelled "到期日（UTC）", so a date picked as 10/31 expires at 08:00 CST.
  - Fix: one zh-CN 24-hour formatting helper. Treat a picked date as local and expire it at 23:59:59.
- **M8. The admin status badge shows 正常 for an expired user.**
  - Fix: derive the badge from enabled, disabled_reason, expiry and quota: 正常 / 已到期 / 超出流量 / 已停用.
- **M9. Login always shows a TOTP field, and the first field is labelled 账号 although self-registered users sign in with email.**
  - Fix: show the code field only after a `totp_required` response, and label the first field "邮箱或账号 / Email or username".
- **M10. Agent updates are a manual 3-file upload from GitHub.**
  - Fix: add a "检查更新" button that fetches the latest signed release, verifies it against `release_keys` and creates the rollout. Show "有新版本" in the node list.
- **M11. Plan pricing is a separate step after creating a plan; the settings page is one long form with 5 save buttons; the deferred device-seat field is visible.**
  - Fix: one plan dialog including prices and on-sale, saved once. Settings in tabs: 站点 / 节点通信 / 测速 / 注册 / 邮件 / 失败邮件. Hide device seats.

## MINOR

1. The portal says latency updates "about every 5 h", but the probe actually runs every 10 min. Show the effective interval instead.
2. The withdrawal form is shown even when a request cannot succeed (a withdrawal is already pending, or the amount is below the minimum). Disable it and show the reason.
3. Ledger amounts are formatted as "¥+50.00". Use "+¥50.00" / "−¥10.00", with colour.
4. The switch confirmation shows "已抵扣 ¥0.00" when there is no credit. Omit it; better, add an in-page checkout summary.
5. The payment panel is not scrolled into view or focused; on phone, clicking 购买 shows no visible change.
6. The invite code has to be created manually. Auto-create the first one and show the link with Copy and QR.
7. A node that has never been installed shows "已到期" under lease, and the install-link expiry appears in the 证书 column. Merge both into the status cell.
8. The custom-days coupon period is labelled "? 天". Use "自定义天数".
9. The price summary on /orders is not sorted by period.
10. Confirmations use `window.confirm`, which shows English OK/Cancel on phone. Add one ConfirmDialog component with a destructive variant.
11. Disabling a coupon or plan applies immediately, with no confirmation or undo.
12. `<title>` is static. Set it per view, and make the site name configurable.

## POLISH / A11Y

- **Contrast:** white on emerald-600 badges is 3.65:1. The login page's 注册 links are 1.89:1 against the surrounding text; underline them.
- **Empty action-column headers:** add an sr-only "操作" label.
- **Headings:** the users panel jumps from h1 to h3, and the account view has no h1.
- **Install warnings:** `<ul role="alert">` with `<li>` children is invalid ARIA; wrap the list in a div with the alert role.
- **Phone scrollers:** add `tabIndex=0` and an aria-label to the table scroll containers.
- **Phone tap targets:** they are small; increase padding.
- **Wizard:** the placeholder is truncated.
- **Phone header:** the 2FA banner takes 190 px; make it one row with a close button.
- **English portal:** offer optional `name_en` / `description_en` for plans.

## Gaps vs xboard

**User side:**
- Permanent subscription link with import buttons, QR, client downloads and tutorials.
- Dashboard with announcements and remaining days.
- Knowledge base.
- Daily traffic log.
- Tickets (W17).
- Checkout summary.
- Balance top-up.
- Transfer commission into balance.
- Notification preferences, Telegram.
- Device/IP list (deferred by decision).

**Admin side:**
- Dashboard: revenue, sign-ups, pending withdrawals and tickets, online users, node health.
- User batch actions, CSV export, broadcast email.
- View a user's subscription.
- Manual paid-order creation.
- Batch coupon generation.
- Gift and redemption cards.
- Payment gateways beyond Alipay F2F. **Not planned:** the user decided on Alipay F2F only.
- Site branding: name, logo, ToS links, footer, app download links.
- Editable email templates.
- Clone nodes and sort them by drag.
- Per-user and per-node traffic and revenue statistics.
