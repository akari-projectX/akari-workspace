# Go style for Akari (adopted 2026-10-22)

User decision (2026-10-22): Go code in `akari-agent` (and `akari-client` when it resumes) follows the
**Google Go Style Guide** — https://google.github.io/styleguide/go/ (Guide → Decisions → Best Practices,
in that order of authority), on top of Effective Go and gofmt. New/changed code follows it now; existing
code is brought into line by the conformance PRs below. Reviewers (lead, T1) check it.

Google-internal specifics are mapped to the open-source equivalents: internal `flag` → standard `flag`
(or our existing CLI parsing), internal `log` → our existing logger (`log/slog` or what the agent uses),
Bazel/nogo items don't apply. xray-core and other vendored/third-party code is out of scope.

## Rules we apply (summary — the guide is the source of truth)

Naming
- MixedCaps, no underscores in identifiers (except `TestX_y` style test names if already used, generated code, cgo/OS).
- Package names short, lowercase, one word; no `util`, `common`, `helper`, `model`, `misc`.
- Receivers: 1–2 letters, consistent across a type's methods, never `this`/`self`.
- Constants MixedCaps (no `ALL_CAPS`, no `k` prefix), named by role.
- Initialisms keep case: `URL`, `ID`, `DB`, `TLS`, `GRPC`/`gRPC`, `userID`, `serverURL`.
- No `Get` prefix on getters; `Fetch`/`Compute` for slow/remote work.
- Name length scales with scope; no dropped letters; no type words in names (`users`, not `userSlice`); no stutter (`relay.New`, not `relay.NewRelay`).

Commentary
- Every exported name has a doc comment: full sentence starting with the name. Non-obvious unexported things too.
- One package comment per package, directly above `package`; `main` packages start with the binary name.
- Named results only when they add clarity; naked returns only in tiny functions.

Imports
- Groups: standard library / third-party / protobuf / side-effect. No renames unless collision or a bad name (proto packages end in `pb`). No dot imports. Blank imports only in `main` and tests (and `embed`).

Errors
- `error` is the last result; exported functions return `error`, not concrete error pointer types.
- Error strings lowercase, no trailing punctuation; wrap with `%w` and add context (`fmt.Errorf("load config %q: %w", path, err)`); use `errors.Is/As`, never string matching.
- Never drop an error with `_` without a comment saying why it's safe.
- No in-band sentinels (`-1`, `""`); return `(T, bool)` or `(T, error)`.
- Handle errors first and return early; no `else` after an error return.

Language
- Composite literals with field names for other packages' types; `var s []T` for empty slices; check emptiness with `len`.
- Don't wrap `if`/`for`/`switch` lines; extract booleans into named variables; no Yoda conditions.
- Never copy `sync.Mutex`, `bytes.Buffer` or types whose methods take `*T`.
- No `panic` for ordinary errors; `Must…` helpers only at init/startup and in tests.
- **Every goroutine has an evident lifetime** (context cancellation, `WaitGroup`/`errgroup`, or a documented exit); no leaks.
- Interfaces defined by the consumer, small, only when needed; return concrete types; no interfaces or back doors just for tests.
- Generics only for a real need. Pointer receivers when mutating / non-copyable / large; consistent per type.
- No redundant `break` in `switch`; labelled `break` for loops. Prefer synchronous APIs.
- `type T1 = T2` aliases only for migrations; `%q` for strings in messages; `any` instead of `interface{}`.

Common libraries
- `context.Context` is the first parameter; never stored in structs; no `context.Background()` in library code (only `main`, init, tests via `t.Context()`).
- `crypto/rand` for anything secret; never `math/rand` for keys/tokens.
- Flags only in `main`; libraries are configured through their API.

Tests
- Failure messages diagnosable without reading the test: `Func(%v) = %v, want %v`, got before want, diffs as `(-want +got)`.
- No assertion libraries; use `github.com/google/go-cmp/cmp` (`cmp.Diff`) for structs, `==` for scalars; compare semantics, not serialized JSON.
- `t.Error` to keep going, `t.Fatal` only when continuing is pointless; table-driven tests with subtests (`t.Run`); `t.Fatal` never from a non-test goroutine; helpers call `t.Helper()`.

## Machine enforcement (CI)
`gofmt -s`, `go vet`, plus golangci-lint (pinned, latest) with: staticcheck, revive (var-naming with initialisms, receiver-naming, error-strings, error-return, context-as-argument, dot-imports, blank-imports, exported, package-comments, indent-error-flow, unused-receiver), errcheck, errorlint, goimports (import grouping), unconvert, usestdlibvars, contextcheck, copyloopvar, govet copylocks. **As landed (akari-agent `.golangci.yml`, golangci-lint v2.15.0, 2026-10-26):** contextcheck is OFF (CoreManager's xray calls must finish atomically under applyMu, so they use a detached context), govet `fieldalignment`/`shadow` are off, misspell has no locale (British spelling in code and docs), `revive exported` does not fire in `package main` (doc comments there are a review item); tests are exempt from errcheck on Close/SetDeadline and from nilerr in fake-panel handlers. See akari-agent/CLAUDE.md "Lint".
Rules no linter covers (goroutine lifetimes, interface placement, test message quality, naming quality) are review items in `briefs/DEFECT-CHECKLIST.md`.

## Conformance PRs (existing code, akari-agent ~27k lines in 83 files)
1. golangci-lint config + CI job + the mechanical fixes it forces (split by package if large).
2. Review-only rules (goroutine lifetimes, error wrapping/context, test failure messages → cmp, doc comments, naming) package by package.
No behaviour changes; anything that looks like a bug goes into a separate fix PR. Proto/contract unchanged.
