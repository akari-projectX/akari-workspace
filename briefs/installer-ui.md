# Brief: installer UI redesign (panel `akari-ctl` + node install script)

User request 2026-10-27: "重新设计 panel 和 agent 的安装器，更现代的交互界面，AKARI logo 的 ASCII Art Banner".
Scope: `scripts/install.sh` (= `akari-ctl`, POSIX sh, ~2300 lines) and the node install script the panel serves
(`src/nodeinstall.sh` + `src/nodeinstall-uninstall.sh`, rendered by `src/nodeinstall.rs`). Presentation only:
**no change to what gets installed, verified or written** (trust chain, secrets handling, exit codes, flags,
env vars, non-interactive `--yes` behaviour all stay byte-for-byte equivalent in effect).

## Hard constraints (from akari-panel/CLAUDE.md, do not break)
- POSIX sh (dash, busybox ash on Alpine): no bash-isms, no `read -s`/`-n`, no `$'..'`; `shellcheck` clean; the
  portable-ERE rule for `valid_*` (installer-test/validators.sh runs under GNU and busybox grep).
- Whole script = functions + last line `main "$@"` (truncated download executes nothing).
- Secrets never on a command line or in the log; `/var/log/akari-install.log` must not gain escape codes
  (log plain text; colour only on the TTY).
- Interactive input only from `/dev/tty`; `curl … | sh` must keep working; `--yes` + flags/env = fully unattended.
- Node script: token never on a command line (URL via stdin), `nodeinstall::AS_ROOT` tail unchanged, smoke
  assertions on the script (`smoke.sh` R18-2/W32 sections, `nodeinstall/tests.rs`) keep passing — update the
  assertions only where they check presentation text, never security properties.

## Design
- **Banner**: AKARI in "ANSI Shadow" block letters, printed once at start, only when stdout is a TTY and
  `NO_COLOR` is unset; plain-ASCII fallback (`#`-based or figlet "standard") when the locale is not UTF-8
  (`LC_ALL`/`LC_CTYPE`/`LANG` lacks UTF-8) or `TERM=dumb`. Under it: one dim line `panel installer vX.Y.Z` /
  `node installer · <panel host>`. Colour: the brand blue accent (portal `--logo-dot`-like) on the letters with a
  subtle two-tone or a single accent — keep it tasteful; 256-colour escape with 16-colour fallback.
  ```
   █████╗ ██╗  ██╗ █████╗ ██████╗ ██╗
  ██╔══██╗██║ ██╔╝██╔══██╗██╔══██╗██║
  ███████║█████╔╝ ███████║██████╔╝██║
  ██╔══██║██╔═██╗ ██╔══██║██╔══██╗██║
  ██║  ██║██║  ██╗██║  ██║██║  ██║██║
  ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝
  ```
- **Steps**: numbered phases with a header `[2/7] Installing PostgreSQL 18`, each long command shows a spinner
  (background `run` + a small sh spinner reading its pid; on non-TTY just the line) and ends with `✓`/`✗` and the
  elapsed time; failures print the last 20 lines of that step's log section and the log path.
- **Prompts**: one consistent style — question, dim hint, default in brackets, validation message inline and
  re-ask; choices as a numbered list with the default marked (no arrow-key TUI: raw `stty` is fragile under
  `curl | sh` and busybox — numbered menus only); yes/no `[Y/n]`. Secret prompts keep `stty -echo` on `/dev/tty`.
- **Summary**: a boxed "done" card at the end (URLs, admin email, where the one-time password is shown, next steps,
  `akari-ctl info`), the one-time secrets printed exactly once as today.
- **Palette helpers** in one block at the top (`c_accent`, `c_dim`, `c_ok`, `c_warn`, `c_err`, `c_reset`), set
  to empty strings when not a TTY / `NO_COLOR` / dumb terminal; all output goes through `say`/`step`/`warn`/`die`.
- Same look in both scripts (copy the small helper block; the node script is self-contained by design).
- `--help` output tidied with the same style (no colour when piped).

## Verification
- `make shellcheck`; `installer-test/validators.sh`; `cargo test` for `nodeinstall`; CI full suite (`full-ci`):
  installer-bare (Debian domain, Ubuntu IP), installer-host (docker + migrate), smoke (node script incl. Alpine).
- Record a terminal session of a full interactive panel install and a node install as text captures
  (`script -q` / asciinema-style plain capture) into `akari-workspace/design/installer-ui-2026-10/` — with
  colour (raw) and with `NO_COLOR=1` — plus a non-UTF-8 run, for lead review.
