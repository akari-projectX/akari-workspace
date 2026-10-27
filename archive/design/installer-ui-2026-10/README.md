# Installer UI redesign: terminal captures (2026-10-27)

PR: https://github.com/akari-projectX/akari-panel/pull/183 (draft). Captures are plain text from `docker run -t` / `script`;
"raw" files contain the ANSI escapes and carriage returns (view with `cat` in a UTF-8 colour terminal, or `less -R`).
The spinner shows as many frames on one line in a file; on a terminal it is one line that is overwritten.

Real runs of the real scripts (Debian 13 container; no release is reachable from the sandbox, so the panel installer
stops at "cannot determine the latest release" after the base-tools step):
- `panel-help-zh.txt`, `panel-help-en.txt`: `--help`.
- `panel-install-zh-raw-minimal-debian-installs-locale.txt`: minimal Debian, no zh_CN: English line about installing the locale, then Chinese run.
- `panel-install-zh-NO_COLOR-minimal-debian.txt`: same with `NO_COLOR=1`.
- `panel-install-en-raw-lang-en.txt`: `--lang en`.
- `panel-install-en-raw-locale-install-fails.txt`: apt refuses `locales`: English with the reason line.

Complete node install (systemd Debian 13 container, throw-away fake panel + fake agent; real script, real units, real nftables install):
- `node-install-zh-raw-first-run-installs-locale.txt` (first run installs the locale), `node-install-zh-raw-reinstall.txt`,
  `node-install-zh-NO_COLOR.txt`, `node-install-en-raw.txt` (`--lang en`),
  `node-uninstall-zh-raw.txt` (`akari-agent-uninstall --yes`), `node-uninstall-en-NO_COLOR.txt`.

Synthetic (the real install needs a signed release): `ui-demo.sh` sources the real `install.sh` functions and drives the prompts
(menu, validation + re-ask, [Y/n]), two numbered steps with spinner, the summary card, a warning and a failure:
- `ui-demo-prompts-card-zh-raw.txt`, `ui-demo-prompts-card-zh-NO_COLOR.txt`, `ui-demo-prompts-card-en-raw.txt`.

Not captured: the ASCII fallback banner on a non-UTF-8 locale (visible in the code, `ui_banner`), a full panel install/upgrade (CI installer-bare/host cover it).
