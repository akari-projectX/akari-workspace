# 测试环境部署与升级测试（2026-10-06 → 10-07）

状态：**完成**。面板现为 v0.4.0-rc.2（经 `akari-ctl upgrade` 从 rc.1 升级），两节点 agent v0.5.0-rc.2。发现的两个后端 bug（B1、B2）已由 lead 修复（#87、#88）并在测试环境复验通过。

## 部署内容

| 角色 | 主机 | 版本 / 配置 |
|---|---|---|
| 面板 | 89.106.76.46（Debian 13） | **v0.4.0-rc.1**（GitHub 预发布，release.yml run 37504448291 全绿），一键安装器裸机模式（PostgreSQL 18 + Valkey 9.0.6 + Caddy）；主域名 `akari.cc`（Cloudflare 橙色，Full strict） |
| node1 | 95.40.55.149（Lightsail HK） | agent **v0.5.0-rc.1**（面板手动上传后一键安装）；节点 `hk-node1` = VLESS + REALITY + Vision :443；中转入口 `HK中转`（派生入站 :20443，来源白名单 18.162.147.173，倍率 2x，组「中转」）；审计规则开启 |
| node2 | 18.162.147.173（Lightsail HK） | 先以 **v0.4.4**（GitHub latest 回退下载）安装，再经灰度升级到 v0.5.0-rc.1；节点 `hk-node2` = Hysteria 2 :443（节点域名 `18-162-147-173.sslip.io`，agent 自动 ACME）；同时作为中转机：nftables DNAT `:30443 → 95.40.55.149:20443` + masquerade（`/etc/nftables-relay-test.nft`，`/etc/sysctl.d/91-relay-test.conf`） |

agent 发布：`v0.5.0-rc.1`（run 37502577329 全绿，预发布）、`v0.5.0-rc.2`（同一提交的无改动版本，用于升级测试）。

面板配置：订阅域名 `akari-subscription-service.911920.xyz`，节点通信域名 `edge-node-communication.911920.xyz`（:8443），信任 Cloudflare 开，站点时区 Asia/Shanghai，站点名 Akari Test；开放注册（无邮箱验证，PoW）；支付宝当面付（沙箱）；节点组「直连」「中转」；套餐 `Pro 测试`（100 GB/月，两个组，¥10/月）、`Basic 测试`（10 GB/月，仅直连，¥5/月）；佣金开启（测试值：50%、0 天冻结、最低提现 ¥1，USDT 汇率 7.20）。

测试账号：owner@akari.cc（所有者）、alice@akari.cc（Pro）、bob@akari.cc（Basic，后台分配）、carol@akari.cc（alice 邀请）。

## 检查结果

| # | 检查 | 结果 | 证据 |
|---|---|---|---|
| 0 | 两仓 main CI 全绿后打 tag，release.yml 自动发布为预发布 | 通过 | 面板 f9533f3 ci 37502395222 ✓；agent 7a6dead ✓；两个 Release `isPrerelease=true` |
| 1 | 一键安装器（`--version v0.4.0-rc.1 --mode bare --domain akari.cc`） | 通过（有 bug，见 B1） | cosign 校验通过；`akari-ctl status` 全部 active、healthz ok；橙色云下首张证书直接签发成功（无需切灰） |
| 1 | 域名 / 时区 / 支付配置（API） | 通过 | `PUT /settings`、`/settings/site`；支付宝「测试连接」= `keys_ok`（沙箱验签通过） |
| 1 | 邮件 | **跳过** | 面板机 25/465/587 出站均通，但没有可用的 SMTP 账号 / Resend 密钥 |
| 2 | node1 旧 agent 卸载无残留 | 通过 | 见上一轮记录（10-06） |
| 2 | 两节点一键安装 + BBR | 通过 | 均输出 `SUCCESS`；`tcp_congestion_control=bbr`、`default_qdisc=fq`；node2 未装 curl/wget（见 P3） |
| 2 | 中转入口来源白名单（nftables） | 通过 | node1 `table inet akari_sources`：`tcp dport 20443 ct state new ip saddr != @s0_4 drop`；面板机直连 95.40.55.149:20443 超时，经 node2:30443 可连 |
| 2 | 中转入口健康检查 | 通过 | `health_ok=true` |
| 3 | 门户注册（PoW）/ 登录 | 通过 | `/auth/register/challenge` + `/auth/register` 200；门户 `/auth/login` 会话可用 |
| 3 | 支付宝沙箱下单 | 部分 | precreate 成功返回二维码，取消订单成功；**无法完成付款**（需沙箱版支付宝 App 扫码）→ 改用余额 / 手动订单 |
| 3 | 余额购买 / 手动订单 / 后台分配套餐 | 通过 | alice 余额买 Pro `paid, fulfilled`；carol 手动订单；bob `PUT /users/{id}/plan` |
| 3 | 订阅（订阅域名）：Clash/mihomo、sing-box、base64 | 通过 | UA 识别正确（clash-verge→YAML、sing-box→JSON、v2rayN→text）；响应填充到 8192 字节；`subscription-userinfo` 正确；Basic 用户订阅不含中转入口 |
| 3 | 真实客户端（面板机上 mihomo v1.19.32、sing-box 1.14.2） | 通过 6/6 | node1 直连、node1 中转 2.0x、node2 hy2 各用 mihomo 与 sing-box：出口 IP 正确、generate_204 正常；`mihomo -t` 与 `sing-box check`（原始配置去掉 TUN）通过 |
| 3 | 按入口计费（中转 2x） | 通过 | 经中转下载 50 MB：原始 +50,115,761 B → 计费 +100,231,522 B（2.000x）；直连 30 MB：原始 +30,069,393 B → 计费 +30,069,393 B（1x） |
| 3 | 凭据隔离 | 通过 | bob 的直连凭据、alice 的直连凭据指向中转端口均无法连接 |
| 3 | 审计规则拦截计数 | 通过（有 bug，见 B2） | 直连入口访问 example.org 被拦截（000），`hits=2`（2026-10-07，按站点时区）；**经中转入口访问未被拦截** |
| 3 | 退款（refund-preview → keep_plan=false） | 通过 | 预览 `effect.kind=cancel`、`balance_part_cents=1000`；退款后套餐取消、节点权限撤销（客户端立即失败）、余额退回 |
| 3 | USDT 提现申请 / 审批 | 通过 | 邀请 → 被邀请人付费订单产生佣金 250 分 → 可提现；无效 TRC20 地址被拒（`withdrawal.address_invalid`）；申请 200 分 → 审批（usdt_amount + txid）→ `approved` |
| 3 | 服务器流量额度超额 → 停止 → 提高额度 → 恢复 | 通过 | node2 额度 125 MB 超额：告警 `traffic_quota` firing、订阅中 node2 消失、UDP 443 监听消失、客户端失败；调高额度约 3 s 内监听恢复、客户端通过、告警 resolved |
| 3 | 后台前缀不可从门户 / 订阅域名访问；订阅域名统一 404 | 通过 | 订阅域名上 `/`、`/healthz`、`/<前缀>/app`、`/api/v1/me`、`/install/x`、`/pay/x/notify`、垃圾路径：全部 404 空体；主域名 `/<前缀>`、`/<前缀>/`、`/<错误前缀>/app`、`/<前缀>/sub/x` 均 404 空体；门户 HTML 与 JS 中不含前缀 |
| 4 | 灰度升级 v0.4.4 → v0.5.0-rc.1（node2，含 unit 刷新） | 通过 | rollout `completed {"healthy":1}`，8 s；更新器日志 `installed the new release's systemd units`、`passed its self-check`；升级期间 hy2 客户端 11 次下载中 2 次失败（一次断线窗口） |
| 4 | 「检查更新」 | 通过（正式版）/ 不适用（rc） | 默认源存入 v0.4.4（两平台）；预发布被拒 `agent_update.prerelease`（即使源指向 `/releases/tags/v0.5.0-rc.1`）——rc 版只能手动上传（已用 API 上传 rc.1） |
| 4 | 灰度升级 v0.5.0-rc.1 → rc.2（两台，waves [50,100]） | 通过 | rollout `completed {"healthy":2}`：node2 第 0 波 19:00:49→56，node1 第 1 波 19:00:59→19:01:05；两节点 `akari-agent.prev` 保留、单进程、更新器 path 单元 active，无残留暂存文件 |
| 4 | 升级期间在线连接（每 0.5 s 探测） | 通过（TCP）/ 观察（hy2） | node1 直连与中转：各 1 个断线窗口（19:01:04–19:01:13，约 9 s，即 xray 重启 + 客户端重连）；node2 Hysteria 2（mihomo）：升级窗口 19:00:57–19:01:26 约 29 s，另有升级前后各 1–2 s 的零星失败（QUIC/UDP 本身抖动，升级前 19:00:43 也有） |
| 4 | 计费连续 | 部分 | 升级前后用户计费字节单调增加、无回退；未做逐字节对账（agent 的 `finals.json` 机制未单独验证） |
| 4 | 故意坏版本 v0.5.0-rc.3（启动即退出；本地临时分支构建，用正式发布密钥签名，**未推送、未发 GitHub Release**，经 API 手动上传） | 通过 | rollout `halted`：`1 failed / 1 finished > max_failure_ratio 0.2`；node1 `rolled back (v0.5.0-rc.3): the new agent stopped 3 times without passing its self-check`，16 s 内回到 rc.2 且客户端正常；node2 保持 `pending` 未被下发；随后中止 rollout 并删除面板中的 rc.3 发布 |
| 4 | 面板升级 rc.1 → rc.2（`akari-ctl upgrade --version v0.4.0-rc.2 --yes`） | 通过 | cosign 校验 → 升级前备份 `/var/backups/akari/akari-20261006T193608Z`（db.dump 84 MB、data.tar、config.tar、SHA256SUMS；未加密警告）→ 切换 → 健康检查通过；本次无新迁移（`_sqlx_migrations` max 1070） |
| 4 | 面板回滚路径（无迁移情形，按 DEPLOY §6 手动） | 通过 | `akari.prev` 换回 → 2 s 后 healthz ok（0.4.0-rc.1）→ 再换回 rc.2 → 2 s healthz ok；「升级失败自动回滚」需要一个坏的面板发布，未实测 |
| 复验 | B2 修复（rc.2）：中转入口也被拦截 | 通过 | node1 直连与中转（mihomo + sing-box）访问 example.org 均为 000，计数 `hits=10`；`in_sync=true` |
| 复验 | B1 修复：`valid_node_addr`（main 的 install.sh）在 Debian 13 dash + GNU grep 3.11 下 | 通过 | 接受 `edge-node-communication.911920.xyz[:8443]`、`1.2.3.4[:8443]`、`[2001:db8::1]:8443`、`[::1]`；拒绝 `bad host`、`a;b`、`x.y:99999`、`-a.com`。未做整机重装验证 |

## 发现的问题

| 编号 | 严重度 | 问题 | 建议 | 状态 |
|---|---|---|---|---|
| B1 | 中 | 安装器 `--node-address` 对任何正常值都报 `invalid node address`：`scripts/install.sh:1191` 的 `'^[A-Za-z0-9.:\[\]-]*$'` 在 POSIX ERE 中 `\` 在方括号内是字面量，括号在第一个 `]` 处结束，Debian 13 GNU grep 3.11 下只有形如 `a-` 的串能通过（本机 WSL 的 grep 是 ugrep，所以本地不复现） | 改为 `'^[][A-Za-z0-9.:-]*$'`，安装器测试加 `--node-address host` 与 `[v6]:port` | 已修复（#87），已复验 |
| B2 | 中 | 审计规则不作用于中转（派生）入站：`src/blockrules.rs` `server_policy` 只取 `kind='direct' AND enabled` 的入口生成 `inbound_tags`；用户走中转即可绕过；直连入口关闭时整个节点不拦截 | 包含拦截节点的全部启用入口（直连 + 中转），加回归测试 | 已修复（#88），已复验 |
| P1 | 低 | 安装器默认把节点通信域名设为主域名；主域名是橙色云时 agent 无法连接（本次用 `PUT /settings` 改为灰色云域名） | 安装器在主域名解析到 Cloudflare 时提示 / 要求单独的节点通信域名 | 记录 |
| P2 | 低 | 新建节点时面板探测自身 TLS 证书只试了 IPv6 地址（`connect [2606:4700:…]:443: Host is unreachable`），本机无 IPv6 路由，产生误导性警告 | 探测时 IPv4/IPv6 都试（happy eyeballs） | 记录 |
| P3 | 低（文档） | Lightsail Debian 13 镜像没有 curl 也没有 wget，安装命令直接失败（`curl: not found`） | DEPLOY §3 写明前置条件（`apt install curl`），或安装命令失败时提示 | 记录 |
| P4 | 低（文档） | DEPLOY §3g 写 `PUT /users/{id}/plan {"plan_id": …}`，实际必须带 `period`（`{"plan_id","period":"month"}`） | 更新文档 | 记录 |
| P5 | 信息 | 预发布 agent 不能通过「检查更新」拉取（设计如此），升级测试改用手动上传 | 如需 rc 灰度测试，可考虑后台开关「允许预发布」 | 记录 |
| P6 | 信息 | `/me/plan` 在退款取消套餐后仍返回旧的 `expires_at` 与 `traffic_limit_bytes`（`plan: null`、`nodes: []`） | 确认前台不会据此显示「生效中」 | 记录 |

| P7 | 低 | rollout 停止（halted）期间，坏版本仍是面板里「最新的完整发布」：此时新装 / 重装节点的一键安装会下载这个坏版本（本次在中止后手动删除了 rc.3） | 安装链接跳过在任何 rollout 中失败 / 回滚过的版本，或 halted 时在后台提示删除 | 记录 |
| P8 | 信息 | 面板备份包含 PostgreSQL 中存放的 agent 二进制：6 个二进制时 db.dump 已 84 MB | DEPLOY 已提示；可考虑清理旧发布的功能 | 记录 |
| P9 | 信息 | 本机经 WSL 代理的 SSH 会话会被远端断开（出口 IP 变化）；长时间操作在面板机上用 nohup 跑 | — | — |

（上一轮记录的 CI 不稳定测试、agent `check-units`、`akari-agent-uninstall --help`、xray-core GHSA 等问题见 git 历史中本文件的前一版；前两项已由 #86 / agent #33 修复。）

## 凭据位置（仅路径）

- 所有者：`~/secrets/akari-test-owner.email`、`~/secrets/akari-test-owner.pw`；后台前缀 `~/secrets/akari-test-prefix`；安装输出 `~/secrets/akari-test-install.log`（含一次性密码显示，0600）
- 测试用户：`~/secrets/akari-test-{alice,bob,carol}.{email,pw}`
- API 助手：`~/secrets/akari-test-api.py`（`-u <账号> -p` 门户；默认所有者 + 后台前缀）、注册助手 `~/secrets/akari-test-register.py`
- 节点创建响应（含一次性安装令牌，已使用）：`~/secrets/akari-test-node{1,2}-create.json`
- 面板机 `/root/clienttest/`：客户端二进制与测试脚本（`ct.py`、`dl.py`、`hold.py`），其中 *.clash.yaml / *.singbox.json 含测试用户凭据；`subs.txt` 已删除
- 发布签名密钥 `~/secrets/akari-release-signing.key`（仅用于签坏版本 rc.3，本地构建目录已删除）
