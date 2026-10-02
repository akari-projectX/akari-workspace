import base64, os
exec(open("seed.py").read().split("A = S()")[0])
A = S(); A.login("admin", "ux-admin-pass-123")
nodes = {n["name"]: n["id"] for n in A.req("GET", "/nodes")}
for name, port in [("hk-01", 21443), ("jp-tokyo-02", 22443)]:
    A.req("PUT", f"/nodes/{nodes[name]}/inbounds", {"inbounds": [
        {"tag": "vless-tcp", "listen": "127.0.0.1", "port": port, "protocol": "vless",
         "settings": {"clients": [], "decryption": "none"}, "streamSettings": {"network": "tcp"}},
        {"tag": "ss-2022", "listen": "127.0.0.1", "port": port + 1, "protocol": "shadowsocks",
         "settings": {"method": "2022-blake3-aes-128-gcm", "clients": [], "network": "tcp,udp"}}]})
st = A.req("GET", "/settings")
print(A.req("PUT", "/settings", {"version": st["version"], "main_domain": "127.0.0.1:8190", "sub_domain": None, "node_domain": None, "trust_cloudflare": None}))
sg = A.req("GET", "/settings/signup")
print(A.req("PUT", "/settings/signup", {"version": sg["version"], "register_enabled": True, "invite_required": False,
      "invite_single_use": False, "invite_codes_per_user": 5, "email_domains": [], "trial_plan_id": None, "trial_days": 3, "reset_enabled": True}))
