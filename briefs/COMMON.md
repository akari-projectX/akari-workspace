# Common rules for every Akari v0.4 worker (read fully before starting)

## Read first
- <workspace>/CLAUDE.md (workspace), akari-panel/CLAUDE.md + the sub-CLAUDE.md of every dir you touch (src/, portal/, admin/, migrations/, proto/), akari-agent/CLAUDE.md if you touch the agent.
- <workspace>/PLAN-next.md (open items) and <workspace>/briefs/ENGINEERING.md. The v0.4 decisions D1–D12 and the relay spec are history now: `archive/PLAN-v0.4.md` (the per-repo CLAUDE.md files carry the rules that still apply).
- <workspace>/research/db-schema-review.md (approved 2026-10-05) and the tail of <workspace>/SPRINT.md (rulings incl. "阶段 0 通过" Q1–Q4 and R43). These are binding.
- <workspace>/briefs/DEFECT-CHECKLIST.md (risk tiers + defect checklist) — go through it before opening the PR and state in the PR body that you did.

## Code quality (hard)
- No unwrap/expect/todo!/unimplemented! in non-test Rust; clippy -D warnings; no dead or commented-out code.
- New features ship with tests: unit + real-DB tests; new/changed HTTP endpoints get assertions in smoke.sh.
- Billing core coverage ≥90% stays; new money/auth modules are added to the coverage gate (scripts/coverage-gate.py).
- When removing/changing a feature, delete the now-unused code, tables, columns, settings, i18n keys and docs in the same PR. No tech debt left behind.
- **No compatibility layers (user rule 2026-10-27: new project, no tech debt).** Never add migration/conversion of old data, legacy code paths, fallbacks for old versions, deprecated aliases or "kept for old clients" branches. Replace = delete the old thing in the same PR. The only exception is the agent⇄panel wire protocol across the CURRENT released agent (nodes upgrade after the panel); anything older is dropped. If you think compatibility is needed, stop and ask the lead.
- Anything an operator might reasonably choose is a setting/switch, not hardcoded.
- Keep invariants from akari-panel/CLAUDE.md: SQL-only billing, byte-identical deny responses, `errors.*` error codes, CSP 'self', audit for admin mutations.
- Keep frontend changes to what the feature needs; the admin console (`admin/`) and the portal (`portal/`) are the only UIs. Document every new/changed endpoint in `docs/REFERENCE.md`.

## Migrations / proto
- The schema is `migrations/0001_baseline.sql`; new migrations are `NNNN_<topic>.sql` numbered last + 1 (rules in `akari-panel/migrations/CLAUDE.md`). Never edit a merged migration. Fresh dev/smoke databases only; never touch other workers' DBs.
- Proto: change akari-panel/proto/agent.proto first, `make -C akari-agent sync-proto`, use only your field-number block, `make -C akari-agent check-proto`. Panel PR merges first, then agent PR (agent rebases).

## Agent performance (if you change the agent)
Do nothing in agent user space that the panel or the kernel/xray can do. Every agent PR includes before/after benchmarks: CPU, RSS, per-connection overhead, report bandwidth. >5% regression on any = not mergeable.

## Process
- `git fetch`; work ONLY in worktrees under <workspace>/.work/<task>/ (`git -C <workspace>/<repo> worktree add <workspace>/.work/<task>/<repo> -b <task>-<slug> origin/main`). Never switch branches in the main checkouts — other workers run in parallel. Remove your worktrees at the end.
- Local: fast checks only (panel `make lint check`, `cargo test --locked`; agent `make vet fmt-check test`). NEVER run `make smoke` locally (it deletes akari-panel/data/). Push and let GitHub Actions run smoke/e2e/installer (W37 tiered CI). Do the WHOLE batch locally with fast checks, then push (don't push work-in-progress repeatedly). Intermediate pushes run tiered CI only; add the `full-ci` label only for the final pre-merge run of T1 PRs (money, auth, protocol, concurrency). Iterate until every check is green.
- **One feature = one PR** (user rule 2026-10-26, replaces the 2026-10-13 "split into many PRs" rule): make one commit per page group / module on the feature branch (each commit builds and passes the fast checks), so the lead can accept commit by commit; open the PR as a draft early and keep pushing commits to it. Only very large programmes are split into 2–3 phase PRs, and only when the brief says so. PR body: what / why / evidence (tests, CI links, benchmarks); update CLAUDE.md files and docs (operator docs in Chinese) in the same PR. Merging goes through the merge queue; the lead enables auto-merge. Fold security/dependency fixes into the in-flight feature PR when the lead asks, instead of a separate PR.
- Other workers run in parallel on main; rebase onto main before asking for review; resolve conflicts preserving both sides' intent.
- PR body ends with: 🤖 Generated with [Claude Code](https://claude.com/claude-code). Commit messages end with: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- **Do not merge.** The lead reviews (T1 line by line) and merges. Never SSH to any server.
- Communicate in English. Final report ≤25 lines: PR URLs, CI status, what was deferred and why, questions for the lead.

## Environment
- /tmp is a 7.7G RAM tmpfs: cargo targets (set CARGO_TARGET_DIR under your .work dir), logs, downloads go under <workspace>/.work/<task>/.
- Secrets only in ~/secrets; never read or print them. akari-panel/data/ holds the CA key, jwt.key, master.key: never print, copy or commit.
- WSL has HTTP_PROXY: use `curl --noproxy '*'` for local services.

## Fail fast on CI (user rule 2026-10-06)
Watch your PR's checks while they run. As soon as ANY check fails, read its log, fix, and push — do not wait for the remaining checks to finish (pushing cancels the stale run). Never sit waiting on a run that already has a red check.

## Context limit and handoff (user rule 2026-10-12)
One feature = one PR, possibly worked on by several agents in turn: at the context cap you push, write HANDOFF.md and stop; the next agent continues the SAME branch and PR. Never open a second PR for the same feature.
An agent's context must stay under 500k tokens. When you estimate you are near ~450k, stop at a clean point: commit and push your work (a WIP commit is fine), write `<workspace>/akari-workspace/.work/<task>/HANDOFF.md` (done, remaining, open problems, CI state, exact next steps), and report to the lead with "HANDOFF" in the first line. The lead starts a fresh agent that continues from the note.

## Agent count (user rule 2026-10-13)
Do not spawn helper or sub-agents; do the task yourself, sequentially. The lead runs at most two workers at a time.

- Rust 代码遵循 `briefs/RUST-STYLE.md`、Go 代码遵循 `briefs/GO-STYLE.md`（Google 规范，2026-10-22 用户决定）；brief 涉及对应语言时必须附上。

## Merge queue is rebase-only (2026-10-26)
The panel's merge queue merges by rebase: every commit of the PR is replayed onto main. A conflict resolved inside a merge commit cannot be replayed, the PR becomes `rebaseable: false`, and the queue silently refuses it. So: start from the latest `origin/main`; to catch up later, `git rebase origin/main` BEFORE the PR is opened; after it is open, only merge main if the merge has no conflicts — if it would conflict, stop and tell the lead (the lead re-bases it onto a new branch). Check `rebaseable` in `GET /repos/akari-projectX/akari-panel/pulls/<n>` before reporting a PR as ready. After resolving any conflict, compile (`cargo clippy --all-targets`) before pushing — a hand-merged test file once lost three lines (#171).

## Generated protobuf code (agent `pb/`)
CI regenerates `pb/` with buf (latest) and protoc-gen-go v1.36.12 / protoc-gen-go-grpc v1.6.2 **built with the go.mod toolchain** (go1.27.3) and fails on any diff. Build the plugins the same way before `make sync-proto`/`make proto`: `GOTOOLCHAIN=$(awk '/^toolchain/{print $2}' go.mod) go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.12` (and the grpc plugin) — another Go version formats doc comments differently.
