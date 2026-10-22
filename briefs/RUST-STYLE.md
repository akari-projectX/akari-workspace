# Rust style for Akari (adopted 2026-10-22)

User decision (2026-10-22): the Rust code in `akari-panel` (root crate, `bench/`, `fuzz/`) follows the
**Google Rust Style Guide** — https://google.github.io/styleguide/rustguide.html — on top of the
official Rust Style Guide and the Rust API Guidelines. Every new or changed Rust line follows it from
now on; existing code is brought into line by the conformance PRs below. Reviewers (lead, T1) check it.

`akari-panel` is **application code**: the guide's API-design rules are strong recommendations, and
simplicity beats speculative reusability. Items tagged [chrome] / [Fuchsia] in the guide do not apply.

## Rules we apply (summary — the guide is the source of truth)

Organisation
- Files and leaf modules named after their primary item; non-leaf modules hold only `mod`/re-exports (small glue allowed).
- **No glob imports** (`use x::*`), except `use super::*` in inline `mod tests`, enum variants inside an enum-focused function, and `pub use` re-exports. No preludes of our own.
- One module per `use` statement: `use a::b::{C, D};`, never `use a::{b::C}`.
- Traits used in one function are imported inside that function.
- Call free functions module-qualified (`mem::take(x)`, `fs::read(p)`); use types unqualified (`Regex`), except ambiguous names (`io::Error`, or rename with `as`).

Formatting
- `cargo fmt` (style_edition 2024, max width 100). `#[rustfmt::skip]` only for deliberate alignment or generated code.

Ownership / functions / types
- Prefer borrowing to cloning; `Arc` is fine where the async runtime/axum state needs shared ownership (that is the "alternative is unreasonably complex" case) — not as a habit.
- Take `&str`, `&[T]`, `&T`, `Option<&T>` — never `&String`, `&Vec<T>`, `&Box<T>`, `&Option<T>`.
- No unclear `bool` parameters: use an enum, or at least an inline `/* name= */` comment at call sites.
- Errors: `Option` for obvious absence, `Result` for recoverable failure, `panic!` only for bugs / broken invariants. Production paths never panic on input, I/O, DB or network errors.
- Newtypes for values that are easy to confuse (ids, amounts in different units, secrets); named fields over tuples (except one-field newtypes / very local tuples).

Traits
- Implement standard traits (`FromStr`, `Display`, `From`, `Default`…) instead of ad-hoc methods; `#[derive]` whenever possible.
- Define a trait only for generic code / `impl`·`dyn Trait` / extension traits (`…Ext`), never to "organise" code.
- `PartialEq`/`PartialOrd` unless total equality/order is actually needed; options-bag structs implement `Default`.

Concurrency
- Never reach inside a poisoned mutex (no `.lock().unwrap_or_else(|e| e.into_inner())` tricks); prefer tokio primitives in async code.

Macros
- Plain Rust first, then `macro_rules!`; proc macros only with a strong reason.

Naming
- std conventions (`as_`/`to_`/`into_`, `new`/`try_new`/`from_x`, `x()`/`x_mut()`/`set_x()`/`take_x()`/`replace_x()`), descriptive lifetimes, short meaningful generics, **no abbreviations** beyond well-known terms (id, url, http, tls, db, cfg are fine; `usr`, `cnt`, `amt`, `req2` are not).

Documentation
- `///` on every `pub` item that is not self-explanatory; `//!` at module tops; document panics and `unsafe` invariants; no comments that restate the name; correct capitalisation and punctuation. (Comment language follows the existing file.)

Other features
- `unsafe` only when unavoidable, wrapped in a small safe abstraction, with a `// SAFETY:` comment and a justification.
- No unstable features; no code before `main` (`ctor`); no `panic::catch_unwind`.
- Pair `len()` with `is_empty()`; `#[must_use]` on functions whose result must not be ignored (unless the return type already is) and on lazy/handle types; operator overloading only for real mathematical meaning; `const fn` only if it will stay const.

Implementation
- Annotate types where inference hides them (`.parse()`, `.into()`, `.collect()`), preferring a variable annotation to a turbofish.
- `if let` / `let … else` instead of check-then-`unwrap`; **`expect("why this cannot fail")` instead of `unwrap()`** outside tests.
- Assertions carry a context message explaining why the condition must hold (tests included, when not obvious).
- Iterator chains short and readable; no chain built inside a `for` header; no `for_each` without reason.
- `format!` / `write!` for joining more than two strings or substituting; not `str::replace` for templating.

Testing
- Plain `#[test]` / `#[tokio::test]` (the gtest/fuchsia rules don't apply).

## Machine enforcement (CI, `cargo clippy -D warnings`)
Set in `Cargo.toml [lints.clippy]` (and `clippy.toml`), applied to root, bench and fuzz. Starting list (the conformance PR measures each lint's hit count and drops any that is mostly noise, saying so in the PR):
`wildcard_imports`, `unwrap_used` (with `allow-unwrap-in-tests = true`), `ptr_arg` (default), `fn_params_excessive_bools`,
`undocumented_unsafe_blocks`, `mem_forget`, `rc_buffer`, `manual_string_new`, `redundant_clone`, `needless_pass_by_value`,
`must_use_candidate` is NOT enabled (too noisy for application code) — `#[must_use]` is a review item.
Rules that can't be linted (naming, abbreviations, trait design, docs quality, enum-vs-bool) are review items in
`briefs/DEFECT-CHECKLIST.md`.

## Conformance PRs (existing code)
1. Lints + config + the mechanical fixes they force (globs, `unwrap` → `expect`/`?`, `&String`/`&Vec` params…), split by module group so each PR stays reviewable and green in 1–2 CI runs.
2. Review-only rules (naming/abbreviations, bool params → enums, newtypes for confusable values, docs, assertion messages, poisoned-mutex handling) module by module.
No behaviour changes in these PRs; anything that looks like a bug goes into a separate fix PR.
