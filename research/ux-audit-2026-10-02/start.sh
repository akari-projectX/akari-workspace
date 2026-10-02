#!/usr/bin/env bash
# UX audit environment: own DB, own valkey index, own ports. Run while holding the smoke lock.
set -euo pipefail
UX=/tmp/claude-1000/-home-lam-projectX/4078da57-e661-4797-999a-0f6d1eb80fe8/scratchpad/ux-audit
PANEL=$UX/target/release/akari
DIR=$UX/run
DB=akari_uxaudit; VDB=13; PORT=8190; GRPC=8553
export DATABASE_URL="postgres://akari:akari-dev@localhost:5432/$DB"
export VALKEY_URL="redis://127.0.0.1:6379/$VDB"
cd /home/lam/projectX/akari-panel
psql_admin() { docker compose exec -T postgres psql -U akari -d postgres -qc "$1" >/dev/null; }
psql_admin "DROP DATABASE IF EXISTS \"$DB\" WITH (FORCE)"
psql_admin "CREATE DATABASE \"$DB\""
docker compose exec -T valkey valkey-cli -n $VDB flushdb >/dev/null
rm -rf "$DIR"; mkdir -p "$DIR/pay"
cat >"$DIR/panel.toml" <<TOML
data_dir = "$DIR/data"
[web]
bind = "127.0.0.1:$PORT"
advertised_names = ["localhost", "127.0.0.1"]
cookie_secure = false
[grpc]
bind = "127.0.0.1:$GRPC"
advertise = "127.0.0.1:$GRPC"
TOML
docker rm -f akari-ux-mailpit >/dev/null 2>&1 || true
docker run -d --name akari-ux-mailpit --network host -e MP_SMTP_BIND_ADDR=127.0.0.1:11126 \
  -e MP_UI_BIND_ADDR=127.0.0.1:18126 axllent/mailpit:v1.27 >/dev/null
PREFIX=$("$PANEL" -c "$DIR/panel.toml" info | awk '/route prefix/{sub(/^\//,"",$3); print $3}')
PAY=$DIR/pay
for k in app alipay; do
  openssl genrsa -out "$PAY/$k-key.pem" 2048 2>/dev/null
  openssl rsa -in "$PAY/$k-key.pem" -pubout -out "$PAY/$k-pub.pem" 2>/dev/null
done
cat >>"$DIR/panel.toml" <<TOML
[payments.alipay]
enabled = true
app_id = "2021000000000001"
seller_id = "2088000000000001"
app_private_key_file = "$PAY/app-key.pem"
alipay_public_key_file = "$PAY/alipay-pub.pem"
gateway_url = "http://127.0.0.1:18189/gateway.do"
notify_url = "http://127.0.0.1:$PORT/$PREFIX/pay/alipay/notify"
TOML
# mock alipay gateway (copied from smoke.sh)
sed -n '/^cat >"\$PAY\/mock.py" <<.PY.$/,/^PY$/p' smoke.sh | sed '1d;$d' | sed 's/18089/18189/' >"$PAY/mock.py"
sed -n '/^cat >"\$PAY\/notify.py" <<.PY.$/,/^PY$/p' smoke.sh | sed '1d;$d' >"$PAY/notify.py"
python3 "$PAY/mock.py" "$PAY" >"$DIR/mock.log" 2>&1 &
echo $! >"$DIR/mock.pid"
# 204 latency target
python3 -c '
import http.server
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(204); self.end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(("127.0.0.1", 18304), H).serve_forever()' >/dev/null 2>&1 &
echo $! >"$DIR/probe.pid"
"$PANEL" -c "$DIR/panel.toml" serve >"$DIR/panel.log" 2>&1 &
echo $! >"$DIR/panel.pid"
for _ in $(seq 1 60); do
  [ "$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/$PREFIX/healthz")" = "200" ] && break; sleep 0.5
done
AKARI_ADMIN_PASSWORD="ux-admin-pass-123" "$PANEL" -c "$DIR/panel.toml" admin add admin >/dev/null
"$PANEL" -c "$DIR/panel.toml" node add hk-01 --out "$DIR/boot-hk.toml" >/dev/null
"$PANEL" -c "$DIR/panel.toml" node add jp-tokyo-02 --out "$DIR/boot-jp.toml" >/dev/null
echo "$PREFIX" >"$DIR/prefix"
echo "base http://127.0.0.1:$PORT/$PREFIX"
