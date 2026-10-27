# Brief: subscription templates (xboard-style), replacing the routing page

User 2026-10-27 (screenshot of xboard "订阅模板"): "订阅分流感觉不是很好，能不能像 xboard 一样". Rulings:
- **Templates replace the routing page** (one way to do it): per-client editable config templates with placeholders;
  the current routing settings (`PUT /settings/subscription` `routing`, migration 1107, `sub::routing`, `sub::groups`
  service groups, `sub::catalog`, hosted rule sets `sub::rulesets` + `/{sub_path}/rules/{id}.json`, migration 1108)
  are removed (code, API, admin page, docs, smoke, fuzz target). **No conversion** (user 2026-10-27: new project, no
  compatibility): sites start from the built-in default templates.
- **Clients**: sing-box, Clash (mihomo; **Stash uses the Clash output** — UA `Stash` → clash), **Surge**, **Surfboard**
  (new formats), plus the plain share-links format (no template). Tabs in the admin page: Sing-box · Clash · Surge ·
  Surfboard.

## Storage and API
- Table `sub_templates (format TEXT PK CHECK IN ('sing-box','clash','surge','surfboard'), body TEXT, version, updated_at,
  updated_by)`; a missing row = the built-in default (`src/sub/templates/<format>.tmpl`, include_str!). Writes only via
  `sub::templates::apply_set/apply_reset` (optimistic `version`, same-transaction audit
  `settings.sub_template.update/reset`, body length + sha in the audit, never the body). Body ≤ 256 KiB.
  Any admin may edit (like the old routing settings); read is admin-only.
- Admin API: `GET /sub-templates` (all four: body, is_default, version, placeholders help),
  `PUT /sub-templates/{format}` `{version, body}` → validated (below) or 400 with `field/line/column` params (like the
  mail-template errors), `DELETE /sub-templates/{format}` = reset to default, `POST /sub-templates/{format}/preview`
  `{body, user_id?}` → rendered output for a sample user (built-in sample data) or a chosen real user (audited
  `user.sub_token.read`-style? no token is shown: the preview never includes the user's subscription URL — use a
  placeholder URL).
- No one-time conversion: the migration drops the old routing/rule-set storage; the default templates apply.

## Template language (xboard-compatible names, so an operator can paste an xboard template)
- **Clash / sing-box: structural, not text substitution.** Parse the template (YAML / JSON), inject, re-serialise:
  - Clash: the user's proxies are appended to `proxies:`; in `proxy-groups`, a group whose `proxies` list contains the
    token `$proxies` gets it expanded to all proxy names; mihomo-native `include-all-proxies` / `filter` groups need no
    expansion. sing-box: proxy outbounds appended to `outbounds`; in selector/urltest outbounds, `"{all}"` expands to all
    proxy tags and `"{all:<regex>}"` to the matching ones (same as xboard). Empty expansions → the group gets `DIRECT`
    (Clash) / `direct` (sing-box) so the config stays valid.
  - String placeholders inside values: `$subs_link`, `$subs_domain`, `$site_name`.
- **Surge / Surfboard: text templates** with `$proxies` (one proxy line per entrance), `$proxy_group` (comma-separated
  names), `$subs_link` (the `#!MANAGED-CONFIG` line), `$subscribe_info` (`upload=…, download=…, total=…, expire=…`
  for the `[Panel]` line). Substituted values are escaped for the INI-ish format (no newlines, `,`/`=` safe names).
- Validation on save: parse; render with sample data; Clash: group names unique, every referenced proxy/group exists,
  rule targets exist; sing-box: tags unique, referenced outbounds exist, JSON shape of known top-level keys; Surge/Surfboard:
  required sections present, each `[Proxy Group]` member exists. Errors carry line/column.
- Default templates = today's recommended behaviour (block → direct → service groups → default proxy, region url-test
  groups, recommended DNS), rewritten as templates; CI tests render them for sample users and run `mihomo -t` and
  `sing-box check` (existing smoke tooling) on the outputs; Surge/Surfboard defaults are syntax-checked by our parser and
  reviewed against the official docs (manual.nssurge.com, getsurfboard.com docs) — cite the doc pages in comments.

## New formats: Surge and Surfboard
- `sub::Format::{Surge, Surfboard}`, ids `surge`, `surfboard` join `FORMATS` (format switches: new formats default
  **on** only for sites that never customised the switch list — the existing rule), UA detection (`Surge`, `Surfboard`
  → its format; `Stash` → clash) with golden tests (`w30_client_formats.golden`), `?format=surge|surfboard`.
- Proxy line renderers (`sub/surge.rs`, shared with Surfboard where syntax matches): per protocol what each client
  supports per its docs (Surge: ss incl. 2022, vmess (ws, tls), trojan, hysteria2, tuic; Surfboard: ss, vmess, trojan …
  verify). Unsupported combos (VLESS, REALITY, xhttp, gRPC where unsupported) are omitted with an info log, never a
  broken line (existing rule). Portal import buttons: `surge:///install-config?url=…`, `surfboard:///install-config?url=…`
  (respect the own-client-only switch and format switches).
- Subscription response headers unchanged (`subscription-userinfo`, quota headers rules, canonical rejection).

## Admin page
- Replaces the routing page: "订阅模板 · 配置各个客户端的订阅模板", tabs Sing-box | Clash | Surge | Surfboard, a code editor
  with line numbers and syntax highlighting (CodeMirror 6, bundled — CSP `'self'`, lazy-loaded so the console bundle stays
  small; check the admin bundle budget), a placeholder cheat-sheet beside it, buttons 预览 (side panel with the rendered
  sample output), 恢复默认 (confirm), 保存 (version conflict → reload prompt), inline error markers from the 400 params.
  zh/en like the rest of the admin. Admin e2e + screenshots (desktop/mobile, light/dark).

## Removal checklist
`sub::routing`, `sub::groups`, `sub::catalog`, `sub::rulesets` (+ fetch, parse, daily refresh loop, system-status task
`rule_sets`), `/{sub_path}/rules/…` route and `access::PUBLIC_ONLY` entry, `PUT /settings/subscription` `routing` field,
fuzz target `rule_sets`, admin routing page, smoke sections, CLAUDE.md bullets (rewrite the subscription bullet),
docs. `outbound.rs` stays (other callers). Keep `sub::detect_format`, format switches, own-client-only.

## Split
PR 1 (backend): templates storage/API/validation/rendering, Surge+Surfboard formats, removal of
routing/rulesets, smoke + tests + fuzz (`sub_templates` parse/render fuzz target). PR 2 (admin page + portal import
buttons + e2e). Each `full-ci`.
