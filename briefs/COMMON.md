# Common rules for every Akari v0.4 worker (read fully before starting)

## Read first
- /home/lam/projectX/CLAUDE.md (workspace), akari-panel/CLAUDE.md + the sub-CLAUDE.md of every dir you touch (src/, spa/, migrations/, proto/), akari-agent/CLAUDE.md if you touch the agent.
- /home/lam/projectX/PLAN-v0.4.md: §1 rules, §2 decisions D1–D12, your task card in §3, §5 relay spec.
- /home/lam/projectX/research/db-schema-review.md (approved 2026-10-05) and the tail of /home/lam/projectX/SPRINT.md (rulings incl. "阶段 0 通过" Q1–Q4 and R43). These are binding.
- /home/lam/projectX/OPUS-GUIDE.md §4.4 defect checklist — go through it before opening the PR and state in the PR body that you did.

## Code quality (hard)
- No unwrap/expect/todo!/unimplemented! in non-test Rust; clippy -D warnings; no dead or commented-out code.
- New features ship with tests: unit + real-DB tests; new/changed HTTP endpoints get assertions in smoke.sh.
- Billing core coverage ≥90% stays; new money/auth modules are added to the coverage gate (scripts/coverage-gate.py).
- When removing/changing a feature, delete the now-unused code, tables, columns, settings, i18n keys and docs in the same PR. No tech debt left behind.
- Anything an operator might reasonably choose is a setting/switch, not hardcoded.
- Keep invariants from akari-panel/CLAUDE.md: SQL-only billing, byte-identical deny responses, `errors.*` error codes, CSP 'self', audit for admin mutations.
- Phase A is backend + API. Touch the existing SPA only as much as needed to keep it compiling and e2e green (remove UI for deleted features, adapt changed fields). Do NOT build new UI: the admin console is rewritten in W33-b and the portal replaced in W36-b. Document every new/changed endpoint in the API docs so W33-b/W36-b can consume it.

## Migrations / proto
- History was squashed: baseline `migrations/1000_baseline.sql`. Use ONLY your task's number block (see PLAN §3 table), increasing within it. Never edit 1000_baseline.sql.
- Old dev/smoke databases created before the squash are refused by the startup guard: create your own fresh DB (e.g. akari_<task>) or rely on per-schema test DBs; never touch other workers' DBs.
- Proto: change akari-panel/proto/agent.proto first, `make -C akari-agent sync-proto`, use only your field-number block, `make -C akari-agent check-proto`. Panel PR merges first, then agent PR (agent rebases).

## Agent performance (if you change the agent)
Do nothing in agent user space that the panel or the kernel/xray can do. Every agent PR includes before/after benchmarks: CPU, RSS, per-connection overhead, report bandwidth. >5% regression on any = not mergeable.

## Process
- `git fetch`; work ONLY in worktrees under /home/lam/projectX/.work/<task>/ (`git -C /home/lam/projectX/<repo> worktree add /home/lam/projectX/.work/<task>/<repo> -b <task>-<slug> origin/main`). Never switch branches in the main checkouts — other workers run in parallel. Remove your worktrees at the end.
- Local: fast checks only (panel `make lint check`, `cargo test --locked`; agent `make vet fmt-check test`). NEVER run `make smoke` locally (it deletes akari-panel/data/). Push and let GitHub Actions run smoke/e2e/installer (W37 tiered CI). Do the WHOLE batch locally with fast checks, then push (don't push work-in-progress repeatedly). Intermediate pushes run tiered CI only; add the `full-ci` label only for the final pre-merge run of T1 PRs (money, auth, protocol, concurrency). Iterate until every check is green.
- Small focused PRs; a large task may be a short series of PRs (each green and coherent on its own). PR body: what / why / evidence (tests, CI links, benchmarks). Update CLAUDE.md files and docs (operator docs in Chinese) in the same PR.
- Other workers run in parallel on main; rebase onto main before asking for review; resolve conflicts preserving both sides' intent.
- PR body ends with: 🤖 Generated with [Claude Code](https://claude.com/claude-code). Commit messages end with: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- **Do not merge.** The lead reviews (T1 line by line) and merges. Never SSH to any server.
- Communicate in English. Final report ≤25 lines: PR URLs, CI status, what was deferred and why, questions for the lead.

## Environment
- /tmp is a 7.7G RAM tmpfs: cargo targets (set CARGO_TARGET_DIR under your .work dir), logs, downloads go under /home/lam/projectX/.work/<task>/.
- Secrets only in ~/secrets; never read or print them. akari-panel/data/ holds the CA key, jwt.key, totp.key: never print, copy or commit.
- WSL has HTTP_PROXY: use `curl --noproxy '*'` for local services.

## Fail fast on CI (user rule 2026-10-06)
Watch your PR's checks while they run. As soon as ANY check fails, read its log, fix, and push — do not wait for the remaining checks to finish (pushing cancels the stale run). Never sit waiting on a run that already has a red check.
