# Phase E red team (2026-10-28, user: "发版后对面板进行红队全面攻击测试")

Authorized security assessment of our own code (akari-panel v2.2.0 = main dc08c0a+, akari-agent v0.6.2).
Every worker reads briefs/COMMON.md, akari-panel/CLAUDE.md (hard invariants) and src/CLAUDE.md first.

## Rules
- Targets: only our repositories and test stacks we start ourselves (cargo tests with the local dev PG/Valkey,
  route-level tests via testdb::http, fake_agent harness, local panel binary on 127.0.0.1). Never touch any
  external host, real payment gateway, real Cloudflare, or GitHub beyond reading our repos. No `make smoke` locally.
- White box: read the code path end to end, write down the trust boundary, then try to break it with concrete
  inputs. A finding counts only with a reproduction: a failing test (route-level/unit/fuzz seed) or an exact
  request sequence against a local binary.
- Severity: critical (money loss, auth bypass, remote code execution, cross-tenant data), high, medium, low, info.
  Record also "checked, holds" for each item in scope (so the report shows coverage, not just bugs).
- Fix: for each confirmed finding write the regression test first (fails on main), then the minimal fix in the
  owning module (no new compat layers; keep invariants in CLAUDE.md true; update CLAUDE.md/docs if behaviour
  changes; new error codes in src/error_codes.txt + portal/admin copy). Money/auth fixes keep the coverage gate.
  Anything that needs a product decision: do not fix, describe options in the report.
- Report: research/redteam-2026-10/<area>.md in the workspace (do not commit it; the lead commits): scope list,
  per item verdict, findings with severity, reproduction, root cause, fix, test name. Keep exploit detail to what
  a reviewer needs to verify; no weaponised payloads beyond the test.
- Delivery: one panel PR per area (agent PR if the issue is in the agent), label `full-ci`, not merged; PR body
  lists findings by severity. Lean disk (separate CARGO_TARGET_DIR under .work/, delete after). Commit trailer
  and PR footer as in COMMON.md. GraphQL is unavailable: open PRs with `gh api -X POST repos/.../pulls --input`.

## Lead decisions on area A (2026-10-28)
- A-3 (any admin can repoint a panel-critical DNS record): record writes on names the panel depends on
  (`records::managed`: main/sub/node/passkey domains, server tls_domain, entrance connect_host) and
  `POST /dns/link` / `/dns/link/server/{id}` become owner-only (403 `user.owner_only`, like the token writes);
  other records stay open to every admin. Done in area D's PR.
- A-4 (stolen session adds a passkey and disables password): no re-auth step (R18); the security_notice mail stays the
  mitigation. No change.
- A-5 (mail template HTML can carry a one-time code into an external URL): secret placeholders (codes, reset/verify
  links, tokens) may appear only in text and in `<a href>`; any other attribute (src, style, srcset, background, …)
  → 400. Done in area D's PR.
- Info items: `__Host-` cookie prefix and same-site writes, admin routes answering 401/403 on the portal entry,
  unlocked role read in guard_target — record only. CLAUDE.md lines about hosted rule sets: remove in area D's PR.
