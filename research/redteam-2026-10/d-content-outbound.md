# Red team 2026-10 — Area D: content, outbound, exports, resource use

Target: akari-panel main a74a41b (v2.2.0 + docs). Method: white-box read of each code path, then unit and route-level
tests on a local PG 18 / Redis stack (`testdb::http`, the in-process Cloudflare mock `src/dns/mock.rs`, loopback axum
servers for outbound). No external host was contacted. Branch `rt-d-content-outbound` (one panel PR, label `full-ci`).

## Summary

| # | Severity | Finding | Status |
|---|---|---|---|
| A-3 | medium (lead decision) | Any admin could rewrite / delete / add DNS records of names the panel depends on and run `/dns/link*` | fixed: owner-only, test `dns::tests::panel_records_and_linking_are_owner_only` |
| A-5 | low (lead decision) | Mail template HTML could put `{code}` / `{link}` in `<img src>`, `style`, `srcset`, … (auto-fetched by mail clients) | fixed: new 400 `mail_template.html_secret_placement`, test `mail::templates::tests::secret_placeholders_stay_in_text_and_links` |
| D-1 | low | HTML-source sanity check bypassed by character references and CSS escapes (`jav&#x61;script:`, `javascript&colon;`, `@\69mport`, `expression&lpar;`, `http&#45;equiv`) | fixed, test `mail::templates::tests::encoded_script_urls_are_refused` |
| D-2 | low | A relative record name (`panel`, `@`) skipped the "panel uses this record" confirmation (Cloudflare qualifies it to the main domain) | fixed with A-3 (`dns::qualified`), tests `dns::tests::dangerous_records_need_confirmation`, `record_names_are_qualified_like_cloudflare` |
| D-3 | info | Public `GET /brand/{logo,favicon}` reads the whole PNG (≤256 KiB) from PG on every request, also for a 304; unthrottled | not changed, options below |
| D-4 | info | Resend errors echo ≤200 chars of the response body; EPay test-connection echoes the gateway's `msg` | not changed (fixed vendor host / owner-set URL) |
| D-5 | info | Caddy probe in `/system/status` connects to the main domain outside `outbound` | not changed (owner-set host, only status + cert expiry returned) |
| D-6 | info | Surge/Surfboard `safe_name` maps Cc controls but not U+2028/U+2029 | not changed (only admin-controlled strings reach it) |
| D-7 | info | CSV: full-width `＝＋－＠` and leading-space formulas are not prefixed | not changed (no evidence a spreadsheet evaluates them) |

No critical or high finding.

## Scope and verdicts

### 1. Outbound / SSRF — holds
Callers: `billing::http` (payment gateways, Telegram, webhook, Resend, Turnstile), `updatecheck`, `dns::cloudflare`. All go
through `outbound::target` + `outbound::send` + `outbound::read_capped`.
- DNS rebinding: `addresses()` resolves once, checks every address, connects to the checked `SocketAddr` (no second lookup);
  TLS verifies the host name. Holds.
- Address spellings (new test `outbound::tests::private_address_spellings_are_refused`): decimal `2130706433`, octal
  `017700000001`, hex `0x7f000001`/`0x7f.1`, short `127.1`, `0`, `0.0.0.0`, `[::]`, `localhost.`, IPv4-mapped/compatible,
  NAT64, `3232235777`, `0xa9fea9fe` — all refused before a connection (the resolver reads them like `inet_aton`, then the
  every-address-public rule blocks; musl does the same or fails to resolve). Plain http only for a literal
  `localhost`/loopback IP, and then every resolved address must be loopback (`localhost.`, numeric spellings and
  `::ffff:127.0.0.1` fail the parser). Userinfo and fragments refused.
- Redirects: not followed by `billing::http`/`dns`; `updatecheck` re-runs `target()` and the host allow-list per hop
  (relative `Location` stays on the same authority; https→http only possible on loopback). Holds.
- Size caps: billing 256 KiB, Cloudflare `MAX_RESPONSE`, updatecheck per-file caps; compressed bodies refused. Holds.
- Error bodies: alerts report status only (`by_status`); `outbound` errors never carry URL/body; DNS carries Cloudflare's
  short error message only. D-4: Resend falls back to 200 chars of the raw body, but the host is the constant
  `https://api.resend.com`; EPay `test_connection` shows the gateway's JSON `msg` — the URL is owner-only
  (`methods::apply_update` → `owner::require` when config changes). Info.
- Test switches: `AKARI_TEST_LIMITS` is environment-only, bounded by `Limits::TEST_TUNABLE`, logged and warned at start
  (`config_check`); the only outbound one is `cloudflare_mock_port` (loopback http to 127.0.0.1). `turnstile_verify_url`
  is not tunable from the environment. `rule_set_fetch_loopback` no longer exists. Holds.
- D-5: `sysstatus::probe` does a raw `HEAD /` to the main domain (owner-set) for the Caddy check; returns only the
  status code and cert expiry. Info.

### 2. Subscription rendering — holds
- No user-controlled string reaches another user's config: rows come from admin-set node/entrance names, tags, hosts;
  the user's own data is the token (in `$subs_link`) and quota numbers.
- Clash / sing-box are structured (parse template → append proxies → serialize; credentials never substituted as text);
  YAML parsing uses serde-saphyr's default `Budget` (alias/anchor ratio, depth 64, node caps: no alias bomb); `{all:<re>}`
  uses the linear `regex` crate with `size_limit(1 MiB)`.
- Links: every query value through `encode_fragment`; host bracketed for IPv6.
- Surge/Surfboard text: `safe_name` (no `,`/`=`/controls/leading `#;/[$`), `value()` quotes or refuses, `one_line` for
  context values, single-pass `fill`. D-6: U+2028/U+2029 are not mapped, but only admins (who can rewrite the whole
  template) control those strings. Info.
- Rejections: every failure path in `sub::subscription` is `reject::not_found()`; quota headers only after success;
  per-IP limit before any DB work, per-user after the lookup. Template failure falls back to the built-in template.

### 3. Markdown, mail templates, announcements / KB — A-5 and D-1 fixed; Markdown holds
- `markdown.rs`: all text and attribute values escaped; links only `https:`/`http:`/`mailto:`/`/…`/`#…` with
  whitespace, quotes, backtick, backslash, `<>` and `//` refused; images https or same-origin. Raw HTML is text. Portal
  inserts it only via `RichHtml`. Holds.
- Admin preview of mail HTML: `<iframe sandbox="" srcDoc>` under the console's `'self'` CSP — no script in the panel
  origin even if the sanity check is bypassed. So D-1 matters only for what a mail client does with the mail: low.
- D-1 reproduction (fails on main): `validate_html("register_code", "<a href=\"jav&#x61;script:alert(1)\">{code}</a>")`
  is `Ok`; same for `&#106;avascript:`, `&#0000106&#0000097vascript:`, `javascript&colon;`, `java&Tab;script:`,
  `vbscript&#58;`, `data&colon;text/html`, `@\69mport`, `@&#92;69mport`, `e\78pression(`, `expression&lpar;`,
  `http&#45;equiv`. Root cause: the scheme / `@import` scan read raw source. Fix: `forbidden_html` scans a copy with
  numeric and URL-relevant named character references decoded (`char_refs_decoded`) and then CSS escapes decoded
  (`css_unescaped`), whitespace/controls squeezed, offsets mapped back to the source for `line`/`column`.
- A-5 (lead decision) implemented: secret placeholders = `templates::SECRET_PLACEHOLDERS` = `code` (register / email /
  login codes) and `link` (password reset), derived from `templates::spec` (the only one-time secrets; `login_url` /
  `portal_url` are not secret). `secret_safe_ranges` follows the HTML tokenizer conservatively: allowed = element text
  (incl. `<title>`/`<textarea>` RCDATA) and the value of `href` on `<a>`; refused = tag/attribute names, every other
  attribute (`src`, `style`, `srcset`, `background`, `poster`, `data-*`, `action`, `ping`, `<area href>`…), `<style>`
  content (end tag must be followed by space, `/` or `>`), comments / bogus comments, anything inside `<svg>`/`<math>`,
  unterminated tags. 400 `mail_template.html_secret_placement` with `params` {name, field: "html_source", line, column};
  registered in `src/error_codes.txt`, admin copy in `admin/src/shared/errors.gen.ts`, editor hint updated. Lookup of
  ranges is a binary search (sources up to 100k chars).
- Announcements / KB: bodies go through `markdown.rs`; ids and visibility were covered by area A.

### 4. CSV export — holds (D-7 info)
- `Cell::Text` drops controls other than tab/LF/CR, then prefixes `'` and quotes when the first char is `= + - @ TAB CR`;
  `;` also forces quotes. Every `Cell::Raw` value is panel-formatted (ids, numbers, RFC 3339 dates, enum columns with
  CHECKs: role/status/period/paid_via/disabled_reason, panel-generated `out_trade_no`); gateway `trade_no`, coupon codes,
  emails, names, reasons are `Text`.
- D-7: full-width `＝`, `＋`, `－`, `＠` and `" =…"` are not prefixed; neither Excel nor LibreOffice is known to
  evaluate them on CSV import (not verifiable here). Option if wanted: extend `formula_lead` to those and to a leading
  run of spaces — cheap, only adds an apostrophe.

### 5. Resource exhaustion — holds (D-3 info)
- Bodies: axum's default 2 MiB for `Json`/`ApiJson` (no route raises it); raw-`Body` handlers bound their reads
  (`signup` 16 KiB before the setting check, branding `max+1`). serde_json recursion limit 128 for nested JSON (incl.
  `serde_json::Value` fields); `deny_unknown_fields` bodies fail fast.
- Query strings: `trafficlog::parse_query` strict (fuzzed), DNS `per_page` 5–100, list `limit` clamped (50/200, 100/500)
  everywhere; `offset` on `/users` is unbounded but admin-only (info).
- Batch jobs: snapshot target lists, chunks of 100/500, per-user savepoints, Valkey-limited mail. Exports: REPEATABLE
  READ, 1000-row pages, `MAX_EXPORT` 10 min. Holds.
- Regex: only the `regex` crate (linear time); template expressions size-limited; audit `~*` uses a constant pattern.
- Public per-request DB work: subscription (per-IP limit before the first query), `/.well-known/webauthn` (in-memory
  settings, no DB), `/auth/options` (four small single-row queries; needed by every login page; info), rule-set route
  gone (`/{sub_path}/rules/…` is the canonical rejection, `access::tests`).
- D-3: `branding::serve_image` selects the image bytea and its hash in one query before comparing `If-None-Match`, so a
  304 still moves up to 256 KiB out of PG, unthrottled. Options: (a) select the hash first and the bytes only on a miss;
  (b) keep the current image in memory keyed by its hash (refreshed by `settings::reload`-style notify); (c) rely on
  the `public, max-age=86400` cache at Caddy/CDN and document it. Not fixed (no failing test possible without
  instrumenting PG traffic).

### 6. DNS owner-only (lead decision A-3) — implemented
- `dns::owner_for_panel_names`: create / update / delete / batch → `owner::require_user` when any touched name
  (before and after, qualified the way Cloudflare does: `dns::qualified`, the zone name from the record or
  `GET /zones/{id}`) is in `records::managed`; checked before the confirmation and before any Cloudflare write.
  `POST /dns/link` and `POST /dns/link/server/{id}` call `owner::require_user` after `require_admin`;
  `GET /dns/link/server/{id}` stays admin.
- Reproduction on main: a plain admin `PUT …/records/{id}` `{type:A, name:"panel.example.test",
  content:"198.51.100.66", confirm:true}` → 200 and the mock record changed; now 403 `user.owner_only`, nothing written.
- Admin UI: record dialog read-only with the owner notice for records in use; cloud toggle disabled; bulk buttons disabled
  with a note when a selected record is in use; "point at this panel" / "switch to DNS only" hidden and the server DNS card
  read-only for non-owners.
- `owner::tests::trust_settings_are_owner_only` needs the Cloudflare mock for these routes, so the route tests live in
  `src/dns/tests.rs`; smoke's owner-only loop gained `POST dns/link` (refused before any Cloudflare call). The Rust mock,
  the e2e mock and the smoke mock now answer `GET /zones/{id}`; the Rust mock qualifies relative names like Cloudflare.

### 7. CLAUDE.md rule-set cleanup — verified
No code downloads or hosts rule sets (`sub::templates` replaced routing; no `rulesets` module; `/{sub_path}/rules/…` is
rejected by `access::route`). The front-door paragraph had already lost the `/rules/` mention on main; the SSRF text was a
sub-bullet of the protocol list: it is now a top-level "出站 SSRF 防护" bullet, states that the panel does not download
rule sets, and names `cloudflare_mock_port` as the only outbound test switch (`rule_set_fetch_loopback` was already gone).

### 8. DEPLOY §3h — done
Added "首次安装的信任起点": first install trusts the panel serving the script (install link + pinned key = trust anchor;
later self-updates only accept the release key compiled into the agent) and the gRPC size caps apply before the first
message is checked (`AgentChannel` 64 MiB, `AgentEnrollment` 64 KiB, enrolment rate-limited per /64 and globally).

## Tests added
- `dns::tests::panel_records_and_linking_are_owner_only` (fails on main: 200 for the plain admin)
- `dns::tests::record_names_are_qualified_like_cloudflare`; extra assertion in `dangerous_records_need_confirmation`
- `mail::templates::tests::secret_placeholders_stay_in_text_and_links` (fails on main), incl. a no-panic sweep over
  truncated non-ASCII markup
- `mail::templates::tests::encoded_script_urls_are_refused` (fails on main)
- `outbound::tests::private_address_spellings_are_refused` (coverage; passes on main)

## Not verified
- Behaviour of real mail clients / spreadsheets (D-1 impact, D-7) and of the real Cloudflare API for relative names
  (assumed per its documented behaviour; the mock now mirrors it).
- smoke / e2e (only on Actions); the fuzz target `content` was not run locally (`--cfg fuzzing` build untouched).
