#!/usr/bin/env python3
"""Seed the UX-audit panel with realistic data through the admin API (+ a few DB time-travel tweaks)."""
import json, os, subprocess, sys, time, urllib.parse, urllib.request, http.cookiejar

UX = "/tmp/claude-1000/-home-lam-projectX/4078da57-e661-4797-999a-0f6d1eb80fe8/scratchpad/ux-audit"
DIR = UX + "/run"
PREFIX = open(DIR + "/prefix").read().strip()
BASE = f"http://127.0.0.1:8190/{PREFIX}"
os.environ["NO_PROXY"] = "*"
GiB = 1 << 30


def psql(sql):
    return subprocess.run(["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "akari", "-d", "akari_uxaudit",
                           "-tAc", sql], cwd="/home/lam/projectX/akari-panel", capture_output=True, text=True,
                          check=True).stdout.strip()


class S:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.ProxyHandler({}),
                                              urllib.request.HTTPCookieProcessor(self.jar))

    def req(self, method, path, body=None, ok=(200, 201, 202, 204), base=None):
        url = (base or BASE + "/api/v1") + path
        data = None if body is None else json.dumps(body).encode()
        r = urllib.request.Request(url, data=data, method=method)
        if data is not None:
            r.add_header("Content-Type", "application/json")
        try:
            resp = self.op.open(r)
            code, raw = resp.status, resp.read()
        except urllib.error.HTTPError as e:
            code, raw = e.code, e.read()
        if code not in ok:
            print(f"!! {method} {path} -> {code} {raw[:300]!r}", file=sys.stderr)
            return None
        return json.loads(raw) if raw else {}

    def login(self, login, pw):
        return self.req("POST", "/login", {"login": login, "password": pw}, base=BASE + "/auth")


A = S()
assert A.login("admin", "ux-admin-pass-123") is not None
nodes = {n["name"]: n["id"] for n in A.req("GET", "/nodes")}
HK, JP = nodes["hk-01"], nodes["jp-tokyo-02"]


def inb(port):
    return {"inbounds": [
        {"tag": "vless-tcp", "listen": "127.0.0.1", "port": port, "protocol": "vless",
         "settings": {"clients": [], "decryption": "none"}, "streamSettings": {"network": "tcp"}},
        {"tag": "ss-2022", "listen": "127.0.0.1", "port": port + 1, "protocol": "shadowsocks",
         "settings": {"method": "2022-blake3-aes-128-gcm", "network": "tcp,udp"}}]}


for nid, port, region, addr, disp in [(HK, 21443, "香港", "hk1.example.com", "香港 01 | IPLC"),
                                      (JP, 22443, "日本", "jp2.example.com", "日本 东京 02")]:
    if A.req("PUT", f"/nodes/{nid}/inbounds", inb(port)) is None:
        A.req("PUT", f"/nodes/{nid}/inbounds", {"inbounds": inb(port)["inbounds"][:1]})
    A.req("PATCH", f"/nodes/{nid}", {"region": region, "server_addr": addr})
    A.req("PATCH", f"/nodes/{nid}", {"display_name": disp, "tags": ["流媒体", "IPLC"], "traffic_rate": 1.5})

# A wizard-created node that never connects (install link pending), with a TLS domain.
us = A.req("POST", "/nodes", {"name": "us-lax-03", "region": "美国", "server_addr": "203.0.113.7",
                              "tls_domain": "us3.example.com", "install": {"origin": "http://127.0.0.1:8190"}})
print("us node:", json.dumps(us)[:300])

g1 = A.req("POST", "/node-groups", {"name": "基础线路", "node_ids": [HK, JP]})["id"]
g2 = A.req("POST", "/node-groups", {"name": "高级线路", "node_ids": [HK, JP] + ([us["id"]] if us and "id" in us else [])})["id"]

desc = "适合日常浏览与 1080p 视频\n- 香港 / 日本节点\n- 每月 100 GiB 流量\n- 支持 Clash / Shadowrocket"
lite = A.req("POST", "/plans", {"name": "Lite 轻量", "traffic_quota_bytes": 100 * GiB, "period": "monthly",
                                "group_ids": [g1], "description": desc, "sort": 1})["id"]
pro = A.req("POST", "/plans", {"name": "Pro 专业版 · 超长名称用于测试换行与溢出效果", "traffic_quota_bytes": 500 * GiB,
                               "period": "monthly", "speed_limit_mbps": 500, "group_ids": [g1, g2],
                               "description": "全部节点\n- 500 GiB / 月\n- 限速 500 Mbps\n- 优先客服", "sort": 2,
                               "capacity": 50})["id"]
unl = A.req("POST", "/plans", {"name": "不限量（内部）", "period": "monthly", "group_ids": [g2], "sort": 3})["id"]
A.req("PUT", f"/plans/{lite}/prices", {"on_sale": True, "prices": [
    {"period": "month", "price_cents": 1500}, {"period": "quarter", "price_cents": 4200},
    {"period": "half_year", "price_cents": 7800}, {"period": "year", "price_cents": 14400},
    {"period": "reset", "price_cents": 500}]})
A.req("PUT", f"/plans/{pro}/prices", {"on_sale": True, "prices": [
    {"period": "month", "price_cents": 3990}, {"period": "year", "price_cents": 39900},
    {"period": "days", "days": 7, "price_cents": 990}]})

A.req("PUT", "/commission-settings", {"enabled": True, "rate_percent": 10, "first_order_only": False, "hold_days": 7,
                                      "min_withdrawal_cents": 1000})
A.req("POST", "/coupons", {"code": "WELCOME10", "name": "新用户九折", "kind": "percent", "value": 10, "max_uses": 100})
A.req("POST", "/coupons", {"code": "MINUS5", "name": "立减 5 元", "kind": "fixed", "value": 500,
                           "plan_ids": [lite], "min_amount_cents": 1000})
A.req("POST", "/coupons", {"code": "YEAR30", "name": "年付七折", "kind": "percent", "value": 30, "periods": ["year"]})

# Probe settings: the local 204 target.
st = A.req("GET", "/settings")
A.req("PUT", "/settings/probe", {"version": st["version"], "interval_secs": 300,
                                 "urls": ["http://127.0.0.1:18304/generate_204"], "panel_tcp": True})

# Signup + SMTP (Mailpit).
sg = A.req("GET", "/settings/signup")
A.req("PUT", "/settings/signup", {"version": sg["version"], "register_enabled": True, "invite_required": False,
                                  "invite_single_use": False, "invite_codes_per_user": 5, "email_domains": [],
                                  "trial_plan_id": None, "trial_days": 3, "reset_enabled": True})
ml = A.req("GET", "/settings/mail")
A.req("PUT", "/settings/mail", {"version": ml["version"], "enabled": True, "host": "127.0.0.1", "port": 11126,
                                "security": "none", "username": None, "from_addr": "noreply@akari.test",
                                "from_name": "Akari", "notify_order_paid": True, "notify_expiry_days": 3,
                                "notify_expired": True, "notify_quota": True})

users = {}
for login in ["alice", "bob-expired", "carol-quota", "dave-inviter", "erin", "very.long.username.overflow-test_2026",
              "frank-noplan"]:
    u = A.req("POST", "/users", {"login": login, "password": "user-pass-123"})
    users[login] = u["id"]
for i in range(1, 56):
    A.req("POST", "/users", {"login": f"user{i:03d}", "password": "user-pass-123", "traffic_limit_bytes": 50 * GiB})
for login in ["alice", "bob-expired", "carol-quota", "dave-inviter", "very.long.username.overflow-test_2026"]:
    A.req("PUT", f"/users/{users[login]}/plan", {"plan_id": lite if login != "dave-inviter" else pro})
psql(f"UPDATE users SET traffic_used_bytes = {37 * GiB + 123456789} WHERE id='{users['alice']}'")
psql(f"UPDATE users SET traffic_used_bytes = {101 * GiB} WHERE id='{users['carol-quota']}'")
psql(f"UPDATE users SET expires_at = now() - interval '2 days' WHERE id='{users['bob-expired']}'")
psql(f"UPDATE users SET inviter_id='{users['dave-inviter']}' WHERE id='{users['erin']}'")
A.req("POST", f"/users/{users['alice']}/balance", {"amount_cents": 5000, "reason": "活动赠送"})
A.req("POST", f"/users/{users['erin']}/balance", {"amount_cents": 300, "reason": "补偿"})

# Erin buys Lite (month) via Alipay mock -> commission for Dave.
E = S(); E.login("erin", "user-pass-123")
o = E.req("POST", "/me/orders", {"plan_id": lite, "period": "year"})
print("erin order:", o and {k: o.get(k) for k in ("id", "amount_cents", "out_trade_no", "status")})
if o:
    body = subprocess.run(["python3", DIR + "/pay/notify.py", DIR + "/pay", o["out_trade_no"],
                           "%.2f" % (o["amount_cents"] / 100), "TRADE_SUCCESS"], capture_output=True, text=True).stdout
    r = urllib.request.Request(BASE + "/pay/alipay/notify", data=body.encode(), method="POST")
    r.add_header("Content-Type", "application/x-www-form-urlencoded")
    print("notify:", urllib.request.build_opener(urllib.request.ProxyHandler({})).open(r).read())
    time.sleep(1)
    psql(f"UPDATE commissions SET available_at = now() - interval '1 second' WHERE order_id='{o['id']}'")
# Alice: one pending (unpaid) order and one cancelled.
Al = S(); Al.login("alice", "user-pass-123")
o2 = Al.req("POST", "/me/orders", {"plan_id": pro, "period": "month"})
o3 = Al.req("POST", "/me/orders", {"plan_id": lite, "period": "quarter"})
if o3:
    Al.req("POST", f"/me/orders/{o3['id']}/cancel", {})
# Dave: wait for commission credit then request a withdrawal.
D = S(); D.login("dave-inviter", "user-pass-123")
for _ in range(40):
    b = D.req("GET", "/me/balance")
    if b and b.get("withdrawable_cents", 0) >= 1000:
        break
    time.sleep(1)
print("dave balance:", b)
psql(f"UPDATE commissions SET amount_cents = amount_cents WHERE true")
w = D.req("POST", "/me/withdrawals", {"amount_cents": 1000, "method": "alipay", "account": "dave@example.com 张三"})
print("withdrawal:", w)
print("users:", json.dumps(users))
json.dump({"users": users, "plans": {"lite": lite, "pro": pro, "unl": unl}, "nodes": {"hk": HK, "jp": JP}},
          open(DIR + "/seed.json", "w"))
