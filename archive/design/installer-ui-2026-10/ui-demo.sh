AKARI_INSTALL_LIB=1 . /src/scripts/install.sh
set -eu
LOG=/tmp/demo.log; : >$LOG; LOG_READY=1 UI_LOG=$LOG
ui_locale_setup "${1:-zh}"; ui_init
ui_banner "$(msg banner_subtitle 1.2.3)"
INTERACTIVE=1
menu MODE install_mode 1 docker=install_mode_docker bare=install_mode_bare
ask_valid DOMAIN main_domain_dns_pointing_here_empty "" ok_domain invalid_domain
confirm continue y
steps 2
step downloading_and_verifying_akari v1 amd64
run sleep 2
note cannot_read x
step starting_panel
run sh -c 'echo hi; sleep 1'
MODE=$MODE; ADMIN_CREATED=1 ADMIN=a@b.c ADMIN_PW=secret HTTP_PORT=80 HTTPS_PORT=443 GRPC_PORT=8443
card_open installation_complete
card_blank
card_row lbl_console "https://x/y/app"
card_row lbl_password "pw"
card_text shown_only_this_once_save_it
card_close
warn https_check_through_caddy_did_not 80 443
run false || die backup_failed
