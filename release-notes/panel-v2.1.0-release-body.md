> **⚠️ 只支持全新安装。** v2.1.0 把数据库迁移压缩成了一个新基线。v2.0.0 及更早版本建的数据库**不能**用 `akari-ctl upgrade` 原地升级：升级会在启动迁移时失败，安装器随即自动回滚到原版本。请全新安装 v2.1.0；需要保留的数据请在旧版本上导出后手工迁移。
>
> **⚠️ 节点需要 agent v0.6.0 或更新（推荐 v0.6.1）。** 面板现在只接受协议 8 的 agent；v0.5.x 及更早的节点连上后会收到空配置并停止服务，节点列表中会标出原因。在节点上重新运行面板给出的安装命令即可装上新 agent。

## 安装

```
curl -fsSL https://github.com/akari-projectX/akari-panel/releases/download/v2.1.0/install.sh | sh
```

支持 Debian 12/13、Ubuntu 22.04/24.04；Docker 部署见 `docs/DEPLOY.md`，镜像（`deploy/.env` 的 `AKARI_IMAGE`）：

```
ghcr.io/akari-projectx/akari-panel:2.1.0@sha256:38a66dc22b94bf39265bfef33729f89ecf1173a7e0722b562ff2761fd94873f2
```

使用前请按 `docs/DEPLOY.md`「Verify a release」校验签名。

---

## 新功能

### 订阅模板（取代「分流」页）
- 系统设置 → **订阅模板**：Sing-box、Clash、Surge、Surfboard 各一份可编辑的完整配置模板，占位符与 xboard 同名，xboard 的模板可直接粘贴使用。
- 编辑器带行号与语法高亮；可插入占位符、用示例数据或指定真实用户预览（真实用户预览记入审计）、恢复默认；保存时的错误直接标在出错的行与列上；两人同时编辑会提示冲突。
- Sing-box / Clash 模板按结构解析后注入节点（凭据从不经文本替换）；Surge / Surfboard 为文本模板，所有值都做转义，无法写入的节点整条省略而不是输出坏配置。
- 内置默认模板延续原来的推荐分流（拦截 → 直连 → 服务分组 → 默认代理，地区自动选择组，推荐 DNS）。
- 原「分流」设置、服务分组与面板托管的远程规则集已删除，**不做转换**。

### 新订阅格式：Surge 与 Surfboard
- 按客户端 UA 自动识别，也可用 `?format=surge|surfboard` 指定；Stash 使用 Clash 格式。
- 用户门户新增 Surge / Surfboard 一键导入按钮，遵循现有的格式开关、导入按钮开关和「仅自研客户端」开关。
- 这两个客户端不支持的组合（VLESS、REALITY、xhttp、gRPC，以及 Surfboard 的多用户 SS2022）不输出。

### 加密货币收款：CoinPayments 与 Coinbase
- 两种托管收银台支付方式，不需要自建节点或 RPC。
- 只有网关的「已到账」终态才算付款；未确认、少付、过期、退款等一律只记录事件。
- 回调严格验签（含时间窗防重放），币种与金额必须与订单精确一致；对账走网关查询接口。
- 订单仍按人民币计价，发票币种与汇率由运营者在后台设置。

### DNS 管理（Cloudflare）
- 后台新增 DNS 页面：管理多个 Cloudflare 令牌下所有区域的记录，支持批量操作。
- 面板依赖的域名（主域名、订阅域名、节点域名、通行密钥中心域名、服务器证书域名、入口连接地址）被改动或删除前需要确认。
- 「指向本面板」/「改为灰云」一键操作；服务器换 IP 时可批量更新相关记录。
- 令牌只有所有者能写，加密存储，从不出现在日志和审计里。

### 公告标签
- 公告标题前可加彩色标签（活动、维护、新功能、优惠等，预置 8 个），门户支持按标签筛选。

### 安装器
- 全新的终端界面：AKARI 横幅、编号步骤、进度与耗时、摘要卡片；面板安装器和节点安装脚本使用同一套界面。
- **中英双语**：默认中文；系统无法安装 zh_CN.UTF-8 时自动改用英文，也可用 `--lang zh|en` 指定。从不修改系统默认语言。
- **多实例部署**（裸机）：`akari-ctl expose-data` 通过 TLS 与私有 CA 共享 PostgreSQL / Valkey，`join-bundle` 生成加密的加入包，`install.sh --join` 加入新实例，`lb-config` 生成 Caddy / HAProxy / nginx 负载均衡配置，`upgrade --rolling` 滚动升级。
- 节点卸载脚本先询问再删除，支持 `--help`、`--yes`。

### 登录与账户
- 只开了通行密钥登录的账户，在通行密钥不可用时可以用「密码 + 发到已验证邮箱的一次性验证码」登录（审计并发送安全提醒邮件）。
- 登录方式、通行密钥、密码、登录邮箱发生变化时，向账户的已验证邮箱发送安全提醒；管理员重置登录方式会同时让该账户下线。

### 备份
- 备份默认签名：安装器生成签名密钥，`akari-ctl info` 显示验证公钥；恢复时可强制验证签名。

## 改进

- **用户门户**：恢复 v1.4.0 的外观（仪表盘、商店、订单、流量图表、钱包、邀请、工单、帮助、设置等全部页面）；改用系统字体，去掉自带字体文件，首屏更快，中文标题在系统字体无粗体时仍保持层次。
- **性能**：PostgreSQL 连接关闭 JIT，后台列表请求省掉 80–100 ms 的编译开销；登录在口令哈希队列已满时直接返回「繁忙」，不再先占用数据库和 Valkey；门户首屏加载恢复到 v2.0.0 水平或更快。
- **SS2022 节点**：配合 agent 协议 8，移除用户和轮换凭据都只下发增量，不再重建整个内核、断开节点上的全部连接。
- **签名回滚**：agent 的回滚发布绑定被替换的确切版本，并带有效期。
- **审计日志**保留期最短 90 天。

## 安全

- **数据库连接池**：修复请求在 `BEGIN` 途中被取消时，连接带着未结束的事务回到池里的问题。此前这会让下一个请求的写入落进一个永远不会提交的事务（表现为偶发的「只读事务中不能执行 UPDATE」报错，或写入静默丢失）。现在从池里取连接时会检查，带事务的连接直接丢弃（指标 `akari_db_connections_discarded_total`）。
- **信任根设置只有所有者能改**：发信设置、全部域名设置、安全设置、登录方式与人机验证。
- **SSRF 防护**：面板访问运营者填写的地址（告警 webhook、Telegram、更新源、支付网关、Resend、Turnstile、Cloudflare）一律只连公网地址，不跟随重定向，不回显远端内容。
- **CSP** 增加 `frame-ancestors 'none'`、`base-uri 'none'`、`form-action 'self'`。
- **登录限速**按（账号，客户端网段）计，他人无法通过大量失败登录锁住你的账户。
- 订阅响应 `Cache-Control: private, no-store`；优惠码猜测按用户和客户端网段双重限速；`PATCH /users` 不能修改当前管理员自己的密码；通行密钥注册、且没有设置密码的账户不能删除最后一个通行密钥。
- **CI**：手动联调其他 agent 分支时不再写入 main 的构建缓存（CodeQL 缓存投毒告警）。
- 依赖更新：`ctutils` 0.4.5（RUSTSEC-2026-0385）、admin `zod` 4.6.7（GHSA-mrhx-c7xc-m3w5）。

## 修复

- 退款：网关确认退款但面板无法入账时，交由管理员处理，不再卡住；只有网关的明确拒绝才判退款失败。
- 开通套餐时遇到临时数据库错误，付款整体失败并重试，不会出现「已付款未开通」。
- 支付方式被停用后，用户仍可取消该方式的待付订单；易支付的查询应答必须带本订单号才算已付。
- 修改 ACME 目录或邮箱会立即下发到节点。
- 订阅：IPv6 地址在分享链接里加方括号、在 Clash 里加引号；保存入站时校验 TLS / REALITY 字段。
- Markdown 正文里单词内的下划线不再被当成强调。
- 发信：中继无响应时，一批连续 3 次超时即停止本批，不拖住后续邮件。
- CSV 导出：没人读取的导出 10 分钟后中断，不长期占用数据库连接。

## 移除（不兼容变更）

- **数据库**：全部迁移压缩为 `migrations/0001_baseline.sql`，只能从空库建起（见文首）。
- **panel.toml**：已废弃的配置项不再导入，`panel.toml` 中出现任何多余的键都会导致启动失败（升级前可用 `akari config check` 检查）。
- **旧支付宝回调地址** `/pay/alipay/notify` 已删除，只保留 `/pay/{支付方式 id}/notify`。
- **旧 agent 支持**：面板只服务协议 8（v0.6.0 起）的 agent，旧协议的特殊处理与警告、面板自带的 systemd 单元副本全部删除；单元只来自 agent 二进制本身。
- **订阅令牌**：去掉仅有哈希、没有密文的旧令牌模式。若数据目录的 `master.key` 被更换，链接照常可用，门户与后台会提示「无法显示，重置后可查看」。
- **后台与门户**：旧地址与旧参数的跳转、设置页按旧名称搜索的别名、节点级标签（标签在入口上）已删除。
- 订阅「分流」设置与远程规则集托管（由订阅模板取代）。

## 对应的 agent 版本

推荐配合 [akari-agent v0.6.1](https://github.com/akari-projectX/akari-agent/releases/tag/v0.6.1) 使用：修复 xray 计时器自锁导致的连接与资源泄漏、撤权时直接关闭客户端连接、关闭 xray 访问日志。

---

## What's Changed
* dependabot: hold TypeScript 7 (admin, portal) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/153
* deps: fix new advisories (ctutils, zod); justified ignore for crypto-bigint 0.5 by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/158
* admin: default logo is the L3 akari wordmark + icon by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/156
* deps(portal): bump bits-ui from 2.20.0 to 2.20.1 in /portal in the portal-minor group by @dependabot[bot] in https://github.com/akari-projectX/akari-panel/pull/154
* deps(admin): bump @tanstack/react-virtual from 3.14.21 to 3.14.22 in /admin in the admin-minor group by @dependabot[bot] in https://github.com/akari-projectX/akari-panel/pull/155
* portal restore 1/7: v1.4.0 shell (tokens, nav, account card, dialogs, toasts, skeleton) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/157
* ci: merge queue tiers (fast PR, full merge_group, light main) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/159
* portal: wallet title follows the locale (flaky mobile ledger e2e) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/161
* deps(npm): bump bits-ui from 2.20.1 to 2.20.2 in /portal in the npm-minor group across 1 directory by @dependabot[bot] in https://github.com/akari-projectX/akari-panel/pull/162
* ci: bump docker/login-action from 4.6.0 to 4.7.0 in the actions group by @dependabot[bot] in https://github.com/akari-projectX/akari-panel/pull/163
* ci: speed-up (e2e shards, smoke report-all, flaky tests) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/164
* Billing audit batch 1: five P2 fixes (money core) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/165
* Record xray-core v26.10.21 in the protocol manifest (agent upgrade, merge first) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/166
* ci: e2e apt mirror fallback by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/167
* Security audit batch 2: owner boundary, security notices, SSRF, argon2 bounds, audit retention by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/168
* portal restore: remaining pages in the v1.4.0 look by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/170
* audit fixes (batch 1–4 follow-ups) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/171
* Audit fixes 2: signed backups by default, CSP hardening, login lockout, one host-name validator by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/173
* DNS management: manage Cloudflare DNS from the admin console by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/172
* Bind signed rollback manifests to a version and an expiry (agent audit P2-2) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/174
* Send SS2022 removal and rotation as deltas to protocol 8 agents (tombstone teardown, panel side) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/175
* Announcement tags (solid coloured label before the title) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/176
* Small items and passkey leftovers: passkey-only fallback, uninstall helper confirmation, installer IP-only waits, passkey tests, old docs by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/178
* portal: system fonts and a two-weight scale (400 / 600) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/179
* Audit fixes PR 4: remaining P3 findings (billing, auth, core) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/180
* Rust style: enable the RUST-STYLE clippy lints (root, bench, fuzz) and fix all hits by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/181
* Installer UI redesign: banner, numbered steps, zh/en tables, zh_CN locale step by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/183
* installer: several panel instances (expose-data, join bundle, lb-config, rolling upgrade) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/184
* ci(fuzz): free runner disk before restoring the fuzz build cache by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/185
* billing: CoinPayments and Coinbase payment methods by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/186
* Panel load test (stage C): login busy before DB work, JIT off, bench tooling by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/188
* Compatibility cleanup (panel): remove code that only served older versions by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/189
* db: never hand out an idle pool connection that is inside a transaction by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/192
* Subscription templates (PR 1, backend): per-client templates, Surge and Surfboard, routing removed by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/193
* Subscription templates PR 2: admin editor, portal Surge/Surfboard import by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/194
* fuzz: fix false positives in coinbase_notify and coinpayments_notify by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/196
* ci: smoke saves caches only when it builds agent main by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/197
* Compat cleanup phase 3: sub-token legacy mode, one migration baseline by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/198
* release: v2.1.0 by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/199


**Full Changelog**: https://github.com/akari-projectX/akari-panel/compare/v2.0.0...v2.1.0
