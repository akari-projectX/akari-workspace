> **可以从 v2.1.0 原地升级**（`akari-ctl upgrade`，无需重装）：本版只在基线迁移之后追加了 0002–0007，升级前安装器会先备份。详见文末「升级说明」。
>
> **节点：agent 不强制升级，但「允许访问本机内网」开关需要 agent v0.6.2。** 协议号仍为 8，v0.6.0 / v0.6.1 的 agent 照常工作。若节点上设置过环境变量 `AKARI_ALLOW_PRIVATE_DESTINATIONS`，升级到 v0.6.2 后它不再生效，请改用面板里的开关。

## 安装

```
curl -fsSL https://github.com/akari-projectX/akari-panel/releases/download/v2.2.0/install.sh | sh
```

支持 Debian 12/13、Ubuntu 22.04/24.04；Docker 部署见 `docs/DEPLOY.md`，镜像（`deploy/.env` 的 `AKARI_IMAGE`）：

```
ghcr.io/akari-projectx/akari-panel:2.2.0@sha256:6b45108a39e2483afb376ff7a9d1a7519b23f63dc093ea39f4b8557f627d9f03
```

使用前请按 `docs/DEPLOY.md`「Verify a release」校验签名。

---

## 新功能

### 每台服务器可单独允许访问本机内网 / 回环地址
- 服务器设置新增「访问范围」卡片：**允许用户访问本机内网/回环地址**（默认关闭）。开启前会弹出确认框，说明风险：云厂商元数据地址 169.254.169.254、只监听回环的本机服务、同一内网里的其他主机、同机其他租户。
- 修改后自动下发到该服务器的 agent（配置版本加一，agent 重建内核一次）；变更写入审计。
- 取代 agent 的环境变量 `AKARI_ALLOW_PRIVATE_DESTINATIONS`（agent v0.6.2 起环境变量不再生效）。**需要 agent v0.6.2**；agent 较旧时，开关打开后节点和服务器列表会显示警告「agent 过旧：不支持“允许用户访问本机内网/回环地址”，设置未生效」。

### 管理员操作会通知用户（邮件）
- 新增 6 种邮件，默认开启，发信设置里各有开关，模板可在后台编辑（中英文）：
  - 账号被封禁 / 解封；
  - 套餐变更（分配、续期、延长、取消、重置流量）；
  - 提现通过 / 拒绝；
  - 邀请返佣到账（不含被邀请人信息）。
- 只发给已验证邮箱，按收件人语言，与对应操作在同一事务里入队；邮件发送失败不影响操作本身。用户自己的购买仍用原有的付款回执，退款（含部分退款）仍发退款通知。
- 管理员收到的邮件（如新工单）不再带后台链接。

### 商店与订单
- **切换离开永久套餐需要确认**：从没有到期时间的套餐切换到别的套餐，剩余部分作废（不折抵、不退余额）。门户的确认框用大白话说明并要求勾选；接口要求 `accept_forfeit: true`，否则返回 409 `order.forfeit_unconfirmed`。
- **余额 / 抵扣 / 优惠券已完全覆盖金额的订单，不再需要可用的支付方式**：没有配置任何支付方式时商店照常打开；仅靠余额才能支付的套餐会提示需要勾选「使用余额」。

### 安全响应头与跨站防护
- 在可信 https 反代（`web.trusted_proxies` 或可信 Cloudflare）之后、且 `web.cookie_secure` 为真时，主域名与订阅域名的正常响应带 `Strict-Transport-Security: max-age=31536000`；拒绝响应和通行密钥中心域名永不带。安装器生成的 HAProxy 配置同步加上该头。
- 带会话 cookie 的写请求如果 `Sec-Fetch-Site: cross-site`，返回 403 `request.cross_site`（门户与后台均有中英文提示）；订阅、安装链接、支付回调不受影响。

### 注册页提示
- 后台注册设置页强提示：建议开启邮箱验证（默认仍为关闭）。

## 改进

- **订单搜索**：后台订单按订单号 / 渠道交易号 / 用户邮箱搜索改用 trigram 索引，20 万订单下从约 76 ms 降到 1 ms 以内。
- **节点 / 服务器列表**：相关子查询改成分组联接，200 节点 / 5 万用户的种子数据下，`GET /nodes` 查询耗时 p50 约 11 ms → 8 ms，摘要视图约 9 ms → 5.5 ms。
- **会话**：不再按 Hello 里的能力清单限制下发延迟测试配置、审计规则与拦截计数（协议 8 的 agent 都具备）；`GET /nodes/{id}/block-rules` 不再返回 `agent_supported`；系统状态里的 `proc_hidden` 诊断删除。
- **退款**：续费订单退款时，把续费时清零的已用流量加回（不超过订阅的额度快照）；退款预览显示该项。
- **月末锚定**：日历月套餐按首次购买日续期，31 日购买的套餐依次到期 1/31 → 2/28 → 3/31，不再永久漂到 28 日（延期续费仍按其自己的日期）。
- **部分退款**：网关实际退款金额小于实付时，默认**保留套餐**（显式要求才撤销），返佣按比例追回或减少，不释放优惠券使用次数；全额退款行为不变。`GET /orders/{id}/refund-preview?gateway_cents=N` 与后台退款对话框同步显示。
- **被封禁的邀请人**：到期的返佣保持待入账，解封后再入账。
- **套餐字段**：移除从未使用的套餐字段 `device_seats`（接口、审计快照、门户 / 后台类型）。
- **安装器**：以管道方式非 root 运行时，不再二次下载 `install.sh` 并交给 sudo（那份字节没有签名保护）；改为提示使用 `curl … | sudo sh`。保存成文件再运行的方式仍会经 sudo 重新执行该文件。
- **镜像固定摘要**：Dockerfile、生产 / 开发 compose、CI 与测试用到的每个容器镜像都固定为 `名称:标签@sha256:…`；新增检查脚本，未固定即 CI 失败；Dependabot 同时更新标签与摘要。
- **代码质量门禁**：CI 新增死代码与一致性检查（cargo-machete、knip、jscpd、路由与鉴权对照表）。

## 安全

- **节点安装脚本的「备用下载地址」已删除**：它只靠 TLS 信任同一台主机上的 `SHA256SUMS`，没有签名保护。设置项 `install_fallback_url` 与后台表单行一并删除；面板里没有已签名发布时，脚本会停下并提示先在「更新」页检查更新或上传。
- 安装器里所有下载（cosign、Valkey、Caddy、apt 密钥、发布文件、节点 agent）逐项审计，均有固定摘要 / 指纹或签名校验。
- 容器镜像全部固定摘要（见上）。
- HSTS 与 `Sec-Fetch-Site` 防护（见上）。
- 修复 `inbounds` 模糊测试发现的问题：入站 JSON 中出现 serde_json 保留键（`$serde_json::private::…`）时，保存后无法再读回；现在在任意层级拒绝这类键。

## 修复

- 修复 CI 中偶发失败的测试与流程（连接池中断 `BEGIN` 的测试、测试库共享 `entitle` 咨询锁导致的 55P03、后台性能预算受 runner 速度影响、cosign 在 Rekor 返回 409 时的重试）；按 schema 区分 `entitle` 咨询锁，默认 `public` 的键不变，滚动升级时仍与旧版本互斥。
- 内部清理：用枚举替换计费代码中的布尔参数，合并重复的 token 摘要 / LIKE 转义 / 客户端网段函数，去掉中毒互斥锁的恢复分支，把清理循环拆开；不改变行为。
- 测试：新增门户 e2e，覆盖同一通行密钥经通行密钥中心域名在两个主域名登录、通行密钥注册 + 绑定邮箱流程，并实测了 Chromium 关联来源的标签数上限。
- 文档：删除过时文档，对照安装器和 CLI 重新核对 `docs/DEPLOY.md`；README / REFERENCE 订正。

## 依赖更新

- Rust：`webpki-roots` 1.0.11、`uuid` 1.29.0；容器基础镜像：Node 26、Alpine 3.24（构建用，不影响运行时）。安装器测试的 Ubuntu 镜像保持 24.04 LTS，Dependabot 只更新其摘要。

## 升级说明

**从 v2.1.0 原地升级**：可以，`akari-ctl upgrade` 即可，**不需要**重装。v2.2.0 没有改动 `0001_baseline.sql`，只在其后追加迁移 0002–0007，面板启动时自动执行：

| 迁移 | 内容 |
|---|---|
| 0002 | 月末锚定的周期函数；放宽返佣追回的约束 |
| 0003 | 删除 `plans.device_seats` |
| 0004 | 启用 `pg_trgm` 扩展，为订单号 / 渠道交易号 / 用户邮箱建 GIN 索引 |
| 0005 | 删除 `panel_settings.install_fallback_url` |
| 0006 | 邮件设置增加 4 个通知开关（默认开），放宽邮件种类约束 |
| 0007 | `servers.allow_private_destinations`（默认关） |

- 迁移只进不退。升级前安装器会先备份；升级失败会自动回滚二进制，但若迁移已执行，旧二进制无法再启动，需要用升级前的备份恢复（见 `docs/DEPLOY.md`）。
- **0004 需要 `pg_trgm`**：PGDG 的 `postgresql-18` 包与官方 `postgres:18` 镜像自带，数据库所有者即可创建（受信任扩展）。使用外部 / 托管 PostgreSQL 的，请先确认可用，必要时由管理员预先执行 `CREATE EXTENSION pg_trgm;`。
- 多实例滚动升级：`upgrade --rolling` 按 `deploy/release.meta` 的 `schema_compat_previous` 判断；本版迁移删除了旧版本仍会读写的列（0003、0005），`deploy/release.meta` 中 `schema_compat_previous=false`：升级第一台前必须先停掉其他实例，安装器会强制这一点。
- **节点与 agent**：协议号仍为 8，v0.6.0 / v0.6.1 的 agent 与 v2.2.0 面板完全互通，不升级也能正常服务。新的「允许访问本机内网」开关需要 **agent v0.6.2**（能力 `private-destinations`）。
  - 推荐顺序：先把节点升级到 agent v0.6.2（可在 v2.1.0 面板的「更新」页灰度），再升级面板，最后按需在服务器设置里打开开关。两个顺序都安全：新 agent 配旧面板时，开关不可用，行为等同默认值（拦截内网）。
  - 旧 agent（≤ v0.6.1）连上 v2.2.0 面板：开关保持默认关闭时没有任何差别；若在面板上打开开关，下发的新字段会被旧 agent 忽略（内网仍被拦截），节点和服务器列表显示「agent 过旧……设置未生效」警告。
  - **依赖环境变量的节点**：此前在 agent 上设置了 `AKARI_ALLOW_PRIVATE_DESTINATIONS=1` 的，升级到 agent v0.6.2 后该变量被忽略，内网访问会重新被拦截；请在面板对应服务器上打开「允许用户访问本机内网/回环地址」。
- **接口变化**（只影响自行调用 API 的脚本）：
  - `PUT /settings/mail` 必须带齐 `notify_ban`、`notify_plan_change`、`notify_withdrawal`、`notify_commission`、`notify_refund` 五个开关；
  - `PUT /settings/nodes` 不再接受 `install_fallback_url`（未知字段返回 400）；
  - `POST /me/orders` 切换离开永久套餐须带 `accept_forfeit: true`；
  - 套餐的 `device_seats` 字段已删除；`GET /nodes/{id}/block-rules` 不再返回 `agent_supported`；
  - `PATCH /servers/{id}` 新增布尔字段 `allow_private_destinations`；`GET /me/shop` 对没有支付方式的用户也可访问，报价新增 `payable`、`balance_only`、`forfeits_permanent`。
- 以管道方式运行安装器时，非 root 用户请使用 `curl -fsSL … | sudo sh`。

## 对应的 agent 版本

推荐配合 [akari-agent v0.6.2](https://github.com/akari-projectX/akari-agent/releases/tag/v0.6.2) 使用：支持按服务器的「允许访问本机内网」设置，并移除环境变量开关。

---

## What's Changed
* docs: reference briefs/ENGINEERING.md from CLAUDE.md by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/200
* Docs: remove outdated documents, review DEPLOY against the installer by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/201
* e2e: passkeys across main domains, passkey registration + e-mail binding, related-origin label limit by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/202
* Money A: renewal-refund usage, month-end anchor, partial original refunds, banned inviter by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/203
* Auth/core: HSTS, Sec-Fetch-Site guard, no console link in mail, sign-up verification hint by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/206
* Simplify sessions, faster node list, trigram order search by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/207
* Auth/core: no unsigned downloads in the installers, container images pinned by digest by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/208
* Mail customers about admin actions (ban, plan change, withdrawal, commission) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/210
* Money B: permanent-plan switch confirmation, orders without a payment method, drop device_seats by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/211
* CI: dead-code and consistency gates (machete, knip, jscpd, route auth table) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/212
* Per-server setting: allow users to reach the machine's private addresses by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/213
* plans: share the admin plan handlers' mail-and-view tail (fix main jscpd) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/214
* deps(docker): bump the docker-minor group across 2 directories with 1 update by @dependabot[bot] in https://github.com/akari-projectX/akari-panel/pull/215
* deps(docker): bump the docker-major group across 2 directories with 2 updates by @dependabot[bot] in https://github.com/akari-projectX/akari-panel/pull/216
* deps(rust): bump the cargo-minor group across 3 directories with 2 updates by @dependabot[bot] in https://github.com/akari-projectX/akari-panel/pull/217
* smoke: turn on allow_private_destinations via the API, drop the agent env var by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/218
* installer-test: back to Ubuntu 24.04 LTS; Dependabot only moves OS digests (fix main) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/219
* Close deferred audit P3 items (billing P3-15, auth P3-23, core P3-6/8/13) by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/220
* Fix inbounds fuzz crashes: refuse serde_json reserved keys by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/222
* Deterministic CI: db cancel test, per-schema entitle lock, perf host factor, cosign retry by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/223
* release: v2.2.0 by @mwnydev in https://github.com/akari-projectX/akari-panel/pull/224


**Full Changelog**: https://github.com/akari-projectX/akari-panel/compare/v2.1.0...v2.2.0
