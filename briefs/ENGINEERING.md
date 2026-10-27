# Akari engineering rules

Rules for every change in `akari-panel`, `akari-agent` (and `akari-client` when it resumes). Language style is NOT repeated here:
Rust → `RUST-STYLE.md`, Go → `GO-STYLE.md`. Process (worktrees, PR flow, CI, merge queue) → `COMMON.md`.
Risk tiers and the pre-PR checklist → `DEFECT-CHECKLIST.md`. Where this file and a repo's `CLAUDE.md` invariants disagree, `CLAUDE.md` wins
(and the disagreement is a bug to fix in the same PR). Each rule: **what** — why (example / audit finding).

## 1. Single source of truth
- **One definition per fact.** Before writing a constant, predicate, SQL fragment, validator, limit or string, grep for it; reuse or move it, never copy. — Two copies drift; every drift is a future bug.
  Examples: `grpc::SERVER_SERVES` (the only "is this server serving" predicate), `nodestat::online_sql` (online = same everywhere), `signup::check_password` (one password rule), `sub::catalog` (service catalog), `protocols.toml`.
- **No second implementation of a computation.** Money, time, rates and entitlement are computed in one place (SQL function or one Rust function) and every reader calls it. — Audit billing P2-1: a dead "new row cap" branch in `FLUSH_SQL` went unnoticed (code that does not do what its name says); refund preview must use the same code as the refund (`refund::effect`).
- **Generated beats hand-written.** If a doc, matrix, schema or table can be derived (protocol matrix and admin form schema from `proto/protocols.toml`, THIRD_PARTY_LICENSES, `error_codes.txt`), generate it and make CI fail when stale. Never hand-edit generated files.
- **Contracts have one home.** `akari-panel/proto/agent.proto`, `protocols.toml`, `state_hash_vectors.json`, `update_vector.json` are authored in the panel; the agent holds byte-identical copies (`make sync-proto` / `check-proto`). Shared test vectors are read by both sides.
- **Constants, not literals.** A number used twice (limits, TTLs, retry counts) is a named constant with a unit in the name; operator-tunable values are settings (COMMON.md), not constants.
- **Facts in docs live once.** A rule is stated in one doc and linked from the others; counts, versions and dates that rot are not written into prose.
- **The database is the source of truth; Valkey/memory are hot state.** Never keep correctness-relevant state only in a process (multi-instance, DEFECT 8).

## 2. Module boundaries and layering
- **Panel request path is a straight line:** HTTP handler (parse, authorize via extractor, map errors) → `apply_*(&mut PgConnection, &Actor, …)` (one transaction: write + version bump + audit) → SQL (functions/triggers hold invariants). Handlers contain no business rules and no SQL beyond calling `apply_*`/read helpers; `apply_*` never touch `axum` types.
- **State changes only through `apply_*`.** A mutator that is not an `apply_*` (no `&Actor`, no audit, no bump) is a defect. New mutators are added to `api::tests::every_access_change_bumps_affected_nodes`.
- **Invariants live in the database where possible** (CHECK, triggers, unique/partial indexes, deferred constraints): they hold for CLI, hand-written SQL and future code paths. — Examples: owner uniqueness, `users_erased`, balance ≥ 0 via `balance_ledger`.
- **Billing core is a closed set** (`billing/`, `plans.rs`, `entitle.rs`, `traffic.rs`): the only payment path is `orders::apply_mark_paid`; the only balance writer is `ledger::apply_entry`; the only rate computation is the SQL `akari_*rate*` functions. New code calls them; it does not re-derive.
- **Adapters at the edge.** Kernel specifics only in `protocols::xray`; payment gateways only behind `billing::provider::PaymentProvider`; mail services behind `mail::transport::Provider`; DNS only via `dns::cloudflare::Client`. Neutral models in, adapter out. Adding a variant = new module + one registry line, no edits in callers.
- **All outbound HTTP goes through `outbound`/`billing::http`** (see §8); no ad-hoc `reqwest` clients.
- **Agent layering:** `agent.go` (session lifecycle, stream I/O, no xray knowledge) → `core.go` (`CoreManager`: xray instance, users, counters, applyMu) → `gate.go`/`ratelimit.go`/`blockrules.go` (per-connection enforcement) → protocol modules (`proto_*.go`). The agent does only what the panel or kernel cannot (COMMON.md "Agent performance"); policy is decided in the panel and sent down.
- **Dependencies point one way.** Lower layers never import upward; shared helpers go to the lowest layer that needs them, not into a "util" module. No cyclic knowledge: the portal never knows the admin prefix, the admin bundle shares nothing with the portal (`check-bundles`).
- **Module size is a smell, not a rule:** a file doing two jobs is split along the job boundary in the PR that touches it, not in a drive-by refactor.

## 3. Naming
- Language rules: RUST-STYLE / GO-STYLE (no abbreviations, initialisms, no `Get` prefix…). Added here:
- **Names say the role and the unit:** `amount_cents`, `*_bytes`, `*_secs`, `*_permille`, `*_at` (timestamptz), `*_day` (site-timezone date). No bare `amount`, `size`, `time`.
- **One word per concept across layers.** Server (machine/agent identity) vs node (an inbound) vs entrance (how clients reach a node) are never interchanged in code, SQL, API, UI or docs. Same for plan/subscription, ban/disable.
- **SQL:** tables plural snake_case; functions `akari_*`; triggers `<table>_<what>`; constraints name the rule (`users_owner_enabled_admin`); migration files `NNNN_<subject>.sql` in the task's number block.
- **Rust fns:** `apply_*` = transactional mutator, `peek_*`/`check_*` = read-only validation, `*_async` = wraps blocking work, `*_for_test` only under `cfg(test)`.
- **Error codes** are `namespace.name`, never renamed or reused (§4); API fields snake_case; routes kebab-case.
- **Booleans read true-positive** (`enabled`, not `disabled`); no negated names; no flag whose two values are not both meaningful (use an enum).

## 4. Error handling
- **Never swallow.** No `let _ =`, `.ok()`, `_ = err`, empty `catch`, or `if err != nil { return nil }` without a comment saying why dropping is safe and what the observable effect is. Log-and-continue only for best-effort side effects (notification mail in a savepoint), and then it logs.
- **API errors only via `bad_request!` / `conflict!` / `api_error!`** (`auth.rs`): every error carries `{error, code, params}`. Codes are API: registered in `src/error_codes.txt`, never renamed/reused; an unused code is deleted (§12). Portal codes need zh+en copy (`check-error-codes.mjs`).
- **Transient ≠ business.** A transient failure (serialization, deadlock, lock timeout, connection, 57014, Valkey down) must fail the whole operation so it is retried/reconciled; a business failure may be recorded. — Audit billing P2-2: a transient DB error during fulfilment was recorded as permanent "paid, not fulfilled" and the gateway got `success`. Use `ApiError::is_transient`.
- **Fail closed for security, fail open only where documented.** Rate limiters, Turnstile, SSRF checks, agent-side verification fail closed; fail-open (e.g. ticket limits when Valkey is down) is listed in CLAUDE.md or it is a bug.
- **Errors carry context, not secrets:** what failed and which id, never the URL with token, remote response body, SQL with values, or credentials (`alerts::channels::by_status` classifies, it does not echo).
- **Enumerations are exhaustive:** `match` on error/status enums without `_ =>` so adding a variant is a compile error (`mail::diagnose::Code`).
- **Partial failure is explicit:** batch/loop code (`enforce::run_all`) must not let one failing step skip the rest silently — audit panel-core P2-3 — each step reports its own error and the loop continues, then fails at the end.
- **Go:** wrap with `%w` + context; `errors.Is/As`; deliberate drops are `_ =` with a comment or `closeRO`/`closeFd`; `//nolint` needs a reason.
- **Agent failures never advance state:** apply failure keeps the held version, Ack `ok=false` is not convergence (DEFECT 12).

## 5. SQL, money, time, billing
- **SQL is authoritative for money and time.** Prices, discounts, credits, rates, period ends, reset times, entitlement and expiry are computed in SQL (`akari_split`, `akari_coupon_discount`, `akari_period_end`, `akari_next_reset`, `catalog::switch_credit`); Rust passes inputs and reads results. The client never submits an amount. Expiry is judged by the DB clock; "today" is `settings::site_clock`, never `Utc::now().date_naive()`.
- **Integers only.** Money is integer cents, traffic is integer bytes; rounding is floor and only ever under-charges (`floor(billed × permille / 1000)` per row).
- **Idempotent by construction.** Every state change that can be replayed (gateway notify, reconcile tick, agent report, mail send, batch item) is a conditional UPDATE / `INSERT … ON CONFLICT` / claim-with-token so that replay, concurrency and multi-instance yield exactly one effect (`apply_mark_paid`, `orders` unique `order_id` on commission, `claim token` on mail_outbox).
- **Lock order is global:** `entitle::lock` → servers (`ORDER BY id FOR UPDATE`) → nodes → users → entrance_users; billing: entitle → orders → coupons/redemptions → commissions → user_balances → withdrawals. A function that takes locks documents its position. — Audit billing P2-5: `release_holds` took balances before coupons and could deadlock with order creation.
- **Audit in the same transaction.** Every `apply_*` writes `audit::record` before commit (rollback = no audit row); snapshots go through the whitelist helpers; secrets are logged as `"changed"`. Not in a spawned task, not after commit (exception: failed-login audit, documented).
- **Version bump + notification in the same transaction** as the state change; delivery is a DB trigger (`pg_notify`), never a post-commit call.
- **Append-only ledgers** (`balance_ledger`, `entrance_users_departed`, `payment_events`): corrections are new rows, with guard triggers refusing other writes.
- **No transaction (or row lock) across argon2, network calls, gateway calls or user-controlled streams.** Do the slow work outside, then re-lock and re-check inside (`change_password_inner`; `refund::begin_original` → gateway → `settle_original`). Pool is 16 connections: a held transaction is a global outage.
- **Cheap checks before expensive ones** (peek the code, then argon2; limit before DB) — and the cheap check is never the authoritative one.
- **Migrations:** only in your number block; never edit the baseline; a column/table/function that stops being used is dropped in the same PR. No data migration of legacy shapes (§13).
- **Queries are bounded:** every list has a LIMIT/page, every loop a batch size, every per-node/per-user structure a cap (DEFECT 4). New hot queries come with `EXPLAIN` evidence and an index, and no per-request full scans.
- **Prefer `RETURNING old/new` over read-modify-write** for counters; never keep pending amounts in memory.

## 6. Concurrency
- **Assume N panel instances and M agents.** Rate limits, replay protection, online state, claims and leases live in DB/Valkey. Background work is claimed with `FOR UPDATE SKIP LOCKED` + lease + claim token, or an advisory try-lock for singleton jobs.
- **Document the locking position and what is read under which lock** in the function comment when taking more than one lock.
- **Ticket before read** for anything that pushes DB state to a stream (stale read overwriting a newer write, DEFECT 2); reads and sends for one session are serialized.
- **Bounded everything async:** channels have capacity and a stall policy (agent send queue 256 + `sendStall`), tasks have a lifetime, queues a max wait (argon2 `ARGON2_WAIT`), external calls a timeout and size cap.
- **Every goroutine/task has an evident owner and exit** (context, WaitGroup/errgroup, documented); `session()` joins children before returning (F3).
- **No process-local state that must agree across instances** (caches of auth, settings with different TTLs). `AuthUser` stays uncached because revocation must be immediate.
- **Tokio:** no blocking calls on the runtime (`spawn_blocking` for argon2/crypto/file I/O); no `std::sync::Mutex` guard across `.await`.
- **Go:** `applyMu` rules in agent CLAUDE.md; shared data guarded or atomic with a comment naming the guard; tests for concurrency run with `-race` (except the documented canary exceptions).

## 7. Security defaults
- **Canonical rejection.** Every refusal on a probe-able surface (unknown path/prefix/host, bad token, disabled feature, other user's id, missing asset, disabled format) is `reject::not_found()`: 404, empty body, no headers, byte-identical. New public routes are added to `access::route` and its test table; smoke asserts the bytes.
- **No existence oracles.** Same status, same body, same work (one query, one argon2) whether or not the account/code/order exists; work that branches on existence happens after the response.
- **Secrets never reach logs, traces, metrics labels, audit rows, error bodies or URLs on a command line.** That includes the admin prefix, subscription path/token, install/enrollment tokens, private keys, master-key derivatives, gateway `sign`. Log paths via `web::redacted_path`/route template; tests capture tracing output and assert absence (`w20_tests`).
- **Secrets at rest** are sealed with `masterkey::Keys` using a domain-separated label + AAD; APIs return `*_set` + fingerprint, never the value; secret inputs are write-only (`SecretInput`).
- **Untrusted input is parsed strictly:** `deny_unknown_fields`, size caps before parsing, case-fold duplicate-key rejection for JSON handed to xray, no re-serialization of signed bytes (manifests, gateway responses).
- **SSRF guard for every operator-supplied address** via `outbound` (https, all resolved addresses public, connect to the checked address, redirects not followed or re-checked, size/time caps, no response bodies in errors). A new outbound feature without it is a P2 finding (audit panel-auth P2-2).
- **Trust-root and notification-destination settings are owner-only** (`owner::require` / `require_user`; mail, domains, security, auth policy, payment keys, prefix/allow-list, DNS tokens). Add the route to `owner::tests::trust_settings_are_owner_only`. Any admin-targeting mutator calls `owner::guard_target`. — Audit panel-auth P1-1.
- **Persistence-granting changes notify the account** (`mailhook::security_notice`) and bump `session_ver` where they should end sessions. No extra confirmation steps (product rule).
- **Least privilege on nodes:** the agent holds no `CAP_NET_ADMIN`; anything root-ish goes through the root updater which re-validates untrusted agent-written files (O_NOFOLLOW, owner checks, strict decode, ports not owned by others). — Audit agent P2-1.
- **Cryptographic randomness only** (`OsRng`/`crypto/rand`); constant-time comparison for MACs/signatures; hashes for lookup tokens, AEAD for recoverable ones.
- **Security headers/CSP:** `'self'` only, no inline script; external origins only on the documented Turnstile pages; forms are `fetch`.
- **Retention and evidence:** audit retention has a floor; nothing an admin can set may destroy audit evidence quickly (audit panel-auth P2-4).
- **Dependencies:** new crate/npm/Go module needs a reason in the PR; licence list regenerated (`make third-party`); cargo-deny/govulncheck stay green.

## 8. Frontend data layer (portal, admin)
- **All HTTP goes through the app's API module** (`portal/src/shared/api`, `admin/src/shared`): typed request/response, one place that handles errors, 401/403, `no-store`, request ids. Components never call `fetch` directly and never build URLs by hand.
- **Types mirror the server.** API shapes are declared once in the API layer (generated or hand-written next to the endpoint); a server field rename breaks the type check, not production.
- **Error copy is keyed by `code`**, from the dictionaries (zh/en for the portal; zh for admin). No server message is shown raw; no hard-coded strings in components; `check-error-codes.mjs` and i18n key checks stay green. New server code = copy in the same PR.
- **Colors, spacing, radii only from tokens** (`portal/src/styles/tokens.css`, `admin/src/shared/index.css`). No hex/rgb literals in components; dark mode comes from the token layer.
- **Server state is fetched, not duplicated.** Derived values (prices, expiry, rates) come from the API; the client never recomputes money or time rules. Refresh policy is explicit (focus, interval, after mutation).
- **Framework-independent logic** (formatting, error mapping, dictionaries) lives in `shared/` and is unit-tested; pages stay thin.
- **Bundle isolation:** the portal never contains the admin prefix or admin code; the admin bundles share nothing with the portal (`check-bundles`). New routes update `access::PORTAL_PAGES` ↔ `routes.ts`.
- **No unused exports/components/i18n keys/CSS** (knip, §12). Accessibility basics: labels, focus, keyboard, contrast from tokens; mobile width works.

## 9. Testing
- **Every bug fix ships a regression test that fails without the fix** (named after the failure, in the module's test file). Fuzz-found crashes are committed as seeds (`fuzz/seeds/`, `testdata/fuzz/`). — Example: the W13 fuzz findings in `akari-agent/fuzz_regress_test.go`.
- **Every feature ships tests at three levels where they apply:** unit (pure logic), real-DB (route-level or `apply_*` with Postgres, per-schema test DB), and end-to-end (smoke.sh assertion for every new/changed endpoint; Playwright for UI flows, desktop + mobile). Agent-dependent smoke sections are gated with `need_agent`.
- **Test the rejection path and the bytes:** new refusals assert `reject::not_found()` byte-identity; new errors assert the `code`.
- **Money/auth/entitlement tests are table-driven and adversarial:** replay, concurrency (two tasks racing the last slot), multi-instance, rollback leaves no audit row, partial failure. Billing core coverage ≥ 90%; new money/auth modules join the coverage gate.
- **Parsers and validators of untrusted input get a fuzz target** (gateway responses/notifications, manifests, agent messages, subscription/templates, JSON handed to xray, CSV/Markdown/mail templates, `/proc` parsers) with an invariant, not just "does not crash".
- **Shared vectors for dual implementations** (state hash, update manifest, protocol matrix): both repos read the same file.
- **Consistency tests tie lists to code:** error codes ↔ source, routes ↔ auth extractor, portal routes ↔ `PORTAL_PAGES`, protocol manifest ↔ modules. When you add a list that must match code, add the test.
- **Tests are deterministic:** inject clocks/seams (`now`), no sleeps for ordering, no dependence on other tests' data, own DB/schema/port.
- **Assertions say why** (RUST-STYLE/GO-STYLE: `got/want`). Test code is held to the same dead-code rule as production code.
- **Local = fast checks; heavy suites run in CI.** Never `make smoke` locally.

## 10. Performance
- Hot paths (flush, snapshot build, subscription render, session tick, gate admit, agent report/heartbeat) are measured before and after when touched (`make bench`, `docs/PERF.md`; agent `make bench`, >5% regression not mergeable). The PR states the number or says "not on a hot path".
- Do not add per-request queries, per-connection allocations or per-user work in loops without a bound and a measurement. Cache only what revocation semantics allow.

## 11. Docs sync
- **The PR that changes behavior updates the docs that describe it**: the repo `CLAUDE.md` invariants (the most precise statement of the rule, in the section it belongs to), operator docs (`docs/DEPLOY.md`, `PAYMENTS.md`… Chinese), `src/error_codes.txt`, API docs, `docs/REFERENCE.md`, and the generated docs (regenerate, don't hand-edit).
- **Workspace docs:** a ruling goes in `SPRINT.md` (append-only, and add to its "current rulings" index if it changes a standing rule); open work goes in `PLAN-next.md`; remove the entry when done. Handover notes are replaced, not accumulated; superseded plans/briefs move to `archive/` (workspace) or are deleted (repos).
- **A CLAUDE.md entry is a rule or an invariant, not a changelog.** No dates-of-work narrative that does not constrain future code; delete statements that became false in the same PR (stale invariants mislead the next worker, e.g. the removed `panel/` prefix or TOTP text).
- **Comments explain why**, never restate code; a comment that becomes wrong is fixed or deleted with the code.

## 12. No dead code, no leftovers
- Removing or replacing a feature deletes, in the same PR: functions, routes, error codes, i18n keys, settings, flags, columns/tables, tests, docs and CLAUDE.md lines that only served it. Nothing is "kept for later" or commented out.
- No parameter, field, config key, CLI flag or API field that nothing reads. No `#[allow(dead_code)]` / `//nolint:unused` to hide it.
- No TODO/FIXME without an entry in `PLAN-next.md`.
- Tooling backs this, all in `make check` and the fast CI tier; a red tool is fixed, not silenced:
  - Rust: `cargo clippy -D warnings` (dead_code, unused) and `cargo machete` over the root crate, `bench/`, `fuzz/` (`make machete`; an exception is `[package.metadata.cargo-machete] ignored` with a comment saying why the tool cannot see the use).
  - TypeScript: `knip` in `portal/` and `admin/` (`npm run check` / `check:unused`; unused files, exports, types and packages; `knip.json` lists only entry points the bundler finds by other means, with a reason). Do not `export` for tests or "later".
  - Go: golangci-lint `unused` (enabled in `.golangci.yml`; nothing to add) in `akari-agent`.
  - Duplication: `scripts/jscpd.sh` (`make jscpd`) holds each tree (`src`, `portal/src`, `admin/src`) under its ceiling; the ceiling only goes down. A new copy of existing logic is a review finding even if the ceiling still passes.
  - Consistency tests: `auth::error_code_tests` (error codes ↔ `src/error_codes.txt` ↔ portal/admin copy scripts) and `auth::route_auth_tests` (every route in `src/route_auth.txt` with its auth class: add a line when you add a route).

## 13. No compatibility layers
- This is a new project with no installed base to carry. Never add: data conversion of old shapes, legacy code paths, fallbacks for old versions, deprecated aliases, "accept both" parsing, or panel.toml keys (§ R39).
- **The one exception is the agent⇄panel wire protocol** between the panel and the CURRENT released agent (nodes upgrade after the panel; `MIN_AGENT_PROTOCOL`, protocol gates). Anything older than that is dropped, not supported. The gate is removed when the older protocol is no longer in the field (e.g. the SS2022 protocol 5–7 rule).
- Replace = delete the old thing in the same PR. If you believe compatibility is needed, stop and ask the lead.

## 14. PR size and review
- **One feature = one PR**, one commit per module/page group, each commit building and passing fast checks. Keep a PR reviewable: if the diff needs a map, say so in the body; unrelated cleanups go in their own PR (conformance PRs have no behaviour change; a bug found there is a separate fix PR).
- **Tier it.** State T1/T2/T3 (DEFECT-CHECKLIST). T1 (money, auth, protocol, concurrency, certs, authorization): checklist gone through and stated in the PR body, `full-ci` before merge, lead reads line by line.
- **PR body:** what, why, evidence (tests added, CI links, benchmark numbers), docs updated, anything deferred and why. Commit messages say why in the body when not obvious.
- **Reviewer's first questions:** does it reuse what exists? what does it delete? where is the test that fails without it? what happens on replay, on two instances, on partial failure? what does an attacker/unauthenticated caller see?
- **Rebase, don't merge main** (merge queue is rebase-only); fix red CI immediately; never merge your own PR; never bypass hooks or checks.
