# 阶段 0：数据库架构评审（面板 v0.4）

> 日期：2026-10-05 · 范围：`akari-panel/migrations` 0001–0168（52 个文件）· 只读分析，未改动任何代码
> 证据：在独立的一次性容器（`postgres:18-alpine`，库 `akari_schema_review`）里按顺序执行全部迁移，导出 `pg_dump --schema-only`，结果保存在 `/home/lam/projectX/.work/phase0/schema.sql`（3868 行），列清单在同目录的 `columns.txt`。分析结束后该容器已删除。
> 本文所有"未使用"的结论都附有 grep 证据。grep 范围是 `src/` 的非测试代码（排除 `*tests*`、`testdb`），必要时也查了 `spa/src`、`bench/src`。

---

## 1. 结论

**不需要整体重新设计，做"一次基线压缩 + 局部重构"就够了。**

- **核心部分质量高，原样保留**：用户/套餐/授权、计费流水（`FLUSH_SQL` 只在 SQL 里结算）、余额账本（触发器保证余额等于明细之和、账本只追加）、订单金额拆分的 CHECK、各类设置单行表、证书墓碑、两阶段删除。这些部分的不变量都由数据库强制，测试覆盖也充分，重写只会带来风险。
- **需要重构的是"节点—接入—流量"这一块**：D2（一个节点一个入站）、§5（落地节点 → 入口、派生入站、按入口计数）、D9（入口倍率）、D5（节点额度）都会改这部分的主键和关联：`node_users`、`node_users_departed`、`node_group_members`、`traffic_counters`、`traffic_daily*`，以及 `nodes` 上的倍率、地址等列。这是 W28 的工作，不影响其他领域。
- **身份部分按 D1/D7 删减**：删 `users.login`，删 TOTP 的两张表和一列；新增通行密钥表，以及 Turnstile、清理账号等配置列。属于 W27。
- **压缩迁移历史：建议做，而且在阶段 A 开工前单独做一个 PR**。基线编号用 **1000**，这样新旧编号区间不重叠，"这是 v0.3 的库"可以用一条规则判断（详见 §7）。代价：v0.3.2 不能原地升级到 v0.4，必须全新安装。测试环境本来就要清空，生产的 v0.3.2 也没有真实用户，这个代价可以接受。但必须加一道启动守卫，并调整 CI 的安装器升级测试（详见 §7.3）。

**开工前需要用户或 lead 拍板的 4 个问题**（详见 §10）：
- **Q1 服务器实体**：D2 要求"同一台服务器建多个节点"，这需要新建 `servers` 表，即"一台机器 = 一个 agent 身份"。这一项决定 W28 的规模。
- **Q2 D5 额度挂在哪一层**：服务器还是节点。
- **Q3 日界线**：流量明细和月重置现在用 UTC 划分，D9 用 Asia/Shanghai。要不要统一？
- **Q4 注销后财务快照里的个人信息怎么处理**：`balance_ledger` 只允许追加，这和"匿名化保留"冲突。

---

## 2. 现状概览

| 指标 | 数量 |
|---|---|
| 表 | 64 张（63 张有主键；`traffic_daily_pending` 是暂存表，按设计不建主键） |
| 索引 | 146 个 |
| 约束 | 外键 62、CHECK 273、UNIQUE 12、NOT NULL 419 |
| 自定义函数 / 触发器 | 15 / 15 |
| 枚举类型 | 2 个（`user_disabled_reason`、`user_plan_status`），其余枚举都用 `TEXT + CHECK` |
| 单行设置表 | 7 张：`panel_settings`、`signup_settings`、`smtp_settings`、`alert_settings`、`commission_settings`、`agent_update_settings`、`site_branding`，迁移里会插入种子行 |
| 时间类型 | 全部是 `timestamptz`，没有不带时区的 `timestamp`；`day`/`month` 是 UTC 的 `date` |
| 金额类型 | 全部用 `bigint`，单位是"分"（`*_cents`）；没有币种列，默认单一币种 |

**各领域的表**：
- **节点/agent**（17 张）：`nodes`（**54 列**）、`node_enrollments`、`revoked_certs`、`traffic_sessions`、`node_metrics_1m/1h`、`node_latency`、`node_alert_rules`、`node_alerts`、`alert_notifications`、`alert_settings`、`agent_releases`、`agent_release_chunks`、`rollouts`、`rollout_nodes`、`agent_update_settings`、`grpc_server_names`
- **授权**（7 张）：`node_users`、`node_users_departed`、`node_groups`、`node_group_members`、`plans`、`plan_groups`、`user_plans`
- **流量**（6 张）：`traffic_counters`、`traffic_daily_pending`、`traffic_daily`、`traffic_node_daily`、`traffic_monthly`，以及上面列出的 `traffic_sessions`
- **用户/身份**（10 张）：`users`、`user_totp`、`user_recovery_codes`、`email_codes`、`password_resets`、`invite_codes`、`user_notices`、`signup_settings`、`smtp_settings`、`mail_outbox`
- **资金**（12 张）：`orders`（39 列、22 个 CHECK）、`payment_events`、`payment_methods`、`plan_period_prices`、`coupons`、`coupon_batches`、`coupon_redemptions`、`user_balances`、`balance_ledger`、`commissions`、`commission_settings`、`withdrawals`
- **运营**（11 张）：`tickets`、`ticket_messages`、`announcements`、`announcement_reads`、`kb_categories`、`kb_articles`、`site_branding`、`mail_templates`、`admin_batch_jobs`、`admin_batch_items`、`audit_log`
- **其他**：`panel_settings`、`legacy_config_imports`

**结构性观察**：
1. **`nodes` 是一张 54 列的宽表，混了三类数据**：
   - 机器/agent 状态：证书、会话、版本、失败记录、租约、GCRA 计费时钟、测速认领；
   - 展示/协议：名称、地区、排序、标签、`xray_inbounds`、`server_addr`、`connect_overrides`；
   - 计费：`traffic_rate_permille`、`traffic_raw_bytes`、`traffic_billed_bytes`。

   D2 和 §5 的改造正好可以把它拆开。
2. **流量管线的设计是对的**：
   - 计数基线 `traffic_counters` 用 fillfactor 80 + HOT 更新；
   - 明细先 append 到无索引的暂存表，30 秒压缩一次进入日表；
   - 超过 400 天的日表行汇总进月表。

   问题在于日表 DELETE 汇总的长期代价，详见 §6。
3. **资金领域的约束最严密**：金额拆分等式 CHECK、账本触发器、部分唯一索引（例如每个用户最多一张待支付订单、最多一笔待处理提现）。

---

## 3. 按决定逐项的改动清单

> 标注说明：**加** / **改** / **删**；括号里写归属的任务。

### D1 邮箱身份（W27）
- **删** `users.login`，以及 `users_login_key`、`users_login_prefix` 两个索引。代码影响面大：35 个非测试文件里有 369 行出现 `login`。重点位置：
  - `api.rs:218` 登录查询 `u.login = $1 OR (u.email = lower($1) AND verified)`；
  - `api.rs:806-814` 用户搜索；
  - `tickets.rs:951` 的 `u.login ILIKE`；
  - `audit.rs:149-155` 用户快照里的 `'login'`；
  - `login_limit.rs` 的按登录名限速；
  - CLI `admin add <login>`，以及安装器 `install.sh` 的 `create_admin`；
  - `bench/src` 下的 4 个文件。
- **改** `users.email`：
  - 改为 `NOT NULL`；
  - 唯一性从"只对已验证的地址唯一"（部分唯一索引 `users_email_verified`）改为**全量唯一**，新索引 `users_email_key UNIQUE (email)`。原因是"注册需要验证邮箱"默认关闭后，未验证的地址也是登录名，必须唯一；
  - `users_email_prefix` 改为非部分索引，等值查询和前缀搜索都能用；
  - `api.rs:1055` 硬编码了约束名 `users_email_verified`，必须同步改。这是全仓唯一按约束名分支的代码。
- **改** 快照列（共 9 列）：
  - `*_login` 列：`orders.user_login`、`withdrawals.user_login`、`balance_ledger.user_login`、`admin_batch_items.user_login`、`commissions.inviter_login`、`commissions.invitee_login`、`ticket_messages.author_login`；
  - `actor_login` 列：`audit_log`、`balance_ledger`、`coupon_batches`、`admin_batch_jobs`。

  改动后这些列存的是邮箱，即个人信息。建议统一改名为 `*_label`（只做展示用的快照），并按 Q4 的结论决定注销时怎么处理，详见 D10。
- **改** `signup_settings.email_verify`：从"`NULL` = 自动（SMTP 启用时验证）"的三态，改为 `boolean NOT NULL DEFAULT false`。`invite_required` 已经是 `NOT NULL DEFAULT false`，保持不变。这两个开关互相独立。

### D2 一个节点一个入站（W28）
- **改** `nodes.xray_inbounds`：从 `jsonb` 数组改为单个对象，例如 `inbound jsonb NOT NULL`，加 CHECK `jsonb_typeof = 'object'`。
- **改** `node_users.credentials`：从数组 `[{inbound_tag, protocol, account}]` 改为单个凭据对象。CHECK `node_users_credentials_array` 改为 `object`。这张表会被 §5 的 `entrance_users` 取代，见下文。
- **删** `nodes.connect_overrides`（按 inbound tag 覆盖 host/port）。一个节点只有一个入站以后，覆盖地址就是入口的"连接地址和端口"，归到 §5 的 `entrances`。`nodes.server_addr` 同理移到入口上。代码位置：`sub/proxy.rs:170`、`nodemeta.rs`。
- **加 · 待 Q1 决定** 服务器实体。"同一台服务器跑多种协议 = 建多个节点，后台按服务器分组"有两种落地方式：
  - **方案 A（推荐）**：新建 `servers` 表，一台机器对应一个 agent 身份。把 `nodes` 上的机器级列搬过去：`cert_serial`、`prev_cert_serial`、`cert_not_after`、`enrolled_at`、`server_name`、`agent_*`（8 列）、`online_session`、`lease_expires_at`、`last_seen_at`、`status`、`last_error*`、`failed_*`（6 列）、`deleting_at`、`delete_acked_at`、`config_version`、`user_version`、`traffic_tat`、`traffic_credit_*`、`traffic_max_rate_bytes_per_sec`、`probe_requested_at`、`panel_probe_next_at`。
    - 以下表的外键改为指向 `servers`：`node_enrollments`、`revoked_certs`、`traffic_sessions`、`node_metrics_*`、`node_latency`、`rollout_nodes`、`node_alert_rules`；
    - `nodes` 只保留协议和展示列，再加 `server_id`；
    - 期望状态 = 这台服务器上所有节点的入站，再加上派生入站。agent 本来就支持多入站，`xray_inbounds` 现在就是数组，所以 **agent 侧几乎不用改**；
    - 好处：一台机器只有一个 xray、一套 nftables 和 BBR、一份监控指标、一次 rollout，和 W32、阶段 C 的模型一致；
    - 代价：`grpc.rs`、`enroll.rs`、`rollout.rs`、`nodestat.rs`、`alerts`、`reaper.rs`、`notify.rs` 里所有按 `nodes` 查 agent 状态的 SQL 都要改。SQL 是手写字符串，没有编译期检查，需要逐条审。
  - **方案 B**：保留"节点 = agent"，加一个分组字段（例如 `nodes.server_label`）。同一台机器上装多个 agent 实例。
    - 问题：agent 的安装路径、服务名、updater 都是单实例设计；两个 xray 抢 BBR 和 nftables 的配置；D5 额度和机器监控指标会被重复计算。
    - **不推荐。**

### D3 删除手动分配（W28）
- **删** `node_users.manual`，以及 `entitle.rs:9-20` 和 `api.rs` 里 assign/unassign/set_inbounds 的手动行逻辑，还有 `GET/PUT /users/{id}/nodes` 一族接口。
- 0020 之前遗留的 `manual DEFAULT TRUE` 语义随之消失。`node_users` 只由 `entitle::apply_reconcile` 写入。

### D4 后台独立前缀（W27）
- 路由前缀现在存在 `data/state.json`（`install.rs:120 ensure_state`），每个实例一个文件，只能用 CLI `secrets rotate-prefix` 轮换。D4 要求在后台轮换，还要加 IP 白名单，并且多实例要立即生效，所以**建议改为存库**：
  - **加** `panel_settings.admin_prefix text NOT NULL`（CHECK 格式与长度）；
  - **加** `panel_settings.admin_allow_cidrs cidr[]`（`NULL` = 不限制）；
  - 沿用 0060 的语句级 `pg_notify('akari_change','settings')` 触发器，多实例即时生效；
  - 轮换写审计（action `settings.admin_prefix.rotate`，快照只记"已更换"，不记明文）。
- `state.json` 里的 `route_prefix` 在 D11 之后只剩后台在用。全新安装时直接生成到数据库，`state.json` 可以删掉。

### D5 节点流量额度（W28，挂在哪一层待 Q2 决定）
加在 `servers` 上（方案 A，推荐，VPS 的流量额度是按机器算的）或 `nodes` 上：
- `traffic_quota_bytes bigint NULL CHECK (> 0)`：`NULL` 表示不限；
- `traffic_quota_mode text NOT NULL DEFAULT 'both' CHECK IN ('both','up','down')`；
- `traffic_quota_period text CHECK IN ('monthly','days','none')`，加 `traffic_quota_period_days`。直接沿用 `plans.reset_period`/`reset_days` 的形状，并复用 `akari_next_reset()` 函数；
- `traffic_quota_anchor timestamptz`、`traffic_quota_next_reset_at timestamptz`；
- `traffic_quota_used_bytes bigint NOT NULL DEFAULT 0 CHECK (>= 0)`：在 `FLUSH_SQL` 现有的 `advanced` CTE（`traffic.rs:897`）里按模式累加。上下行已经能拆开：`charged` CTE 里有 `up_acc`；
- `traffic_quota_exceeded_at timestamptz`：非空时期望状态为空，效果同禁用，但**不动 `enabled`**，这样恢复时不会误开管理员手动禁用的节点；
- 一个部分索引 `(traffic_quota_next_reset_at) WHERE traffic_quota_next_reset_at IS NOT NULL`，供重置 pass 使用。

注意：这里计的是"agent 接受的用户字节数"，不是网卡字节，两者有差距（TLS/协议开销、中转回程）。文档要写清楚；如果要按网卡计，可以改用 `node_metrics` 的 rx/tx。

### D6 / §5 中转 = 落地节点的入口（W28）
**加的表**：

- **`entrances`**：
  - 列：`id uuid PK`、`node_id → nodes ON DELETE CASCADE`、`kind text CHECK IN ('direct','relay')`、`name`、`connect_host`、`connect_port`（即订阅里的地址）、`listen_port int NULL`（派生入站端口；`direct` 为 `NULL`，用主入站的端口）、`relay_source_cidrs cidr[]`（中转机出口 IP，只用于 `relay`）、`rate_permille int NOT NULL DEFAULT 1000`（D9 的基础倍率）、`enabled`、`sort`；
  - 健康检查列：`probe_ok bool`、`probe_at`、`probe_failures int`、`hidden_since`；
  - 约束：
    - 部分唯一索引 `(node_id) WHERE kind='direct'`，每个节点最多一个直连入口；
    - 端口冲突用 `UNIQUE (server_id, listen_port)` 或在应用层校验（方案 A 下按服务器维度）；
    - CHECK：`kind='relay'` 时必须有 `listen_port` 和 `relay_source_cidrs`。
  - 建议再加一列 **`wire_no smallint`**，在节点内唯一，作为 agent 计数标识里的短编号，例如 `email = <user uuid>#<n>`。这样不会把 36 字节的入口 UUID 拼进每个统计键，避免违反"agent 开销回退不超过 5%"的规则。具体格式由 W28 的 proto 设计决定。
- **`entrance_group_members (group_id, entrance_id)`**：取代 `node_group_members`，实现"套餐 → 节点组 → 入口"。`(entrance_id)` 上要建索引，两个外键都级联删除。
- **`entrance_users (entrance_id, user_id, account jsonb)`**：取代 `node_users`，PK `(entrance_id, user_id)`，`(user_id)` 上建索引。每个用户在每个入口上一份独立凭据。加锁顺序改为 `entitle::lock → servers/nodes → users → entrance_users`。
- **`entrance_users_departed (entrance_id, user_id, departed_at, billed_bytes)`**：取代 `node_users_departed`。§5 要求的"从一个入站移除，不影响另一个入站"靠它实现。

**改的表**：

- **`traffic_counters`**：主键从 `(node_id, user_id, session_id)` 改为 `(node_id|server_id, entrance_id, user_id, session_id)`。agent 会话属于机器，所以第一列是 agent 身份。
- **`traffic_daily_pending` / `traffic_daily` / `traffic_monthly`**：
  - 加 `entrance_id`；
  - 主键改为 `(user_id, day|month, entrance_id)`；
  - `node_id` 保留为冗余列（历史表不加外键，删了节点也能聚合）。
- **`traffic_node_daily` → `traffic_entrance_daily (entrance_id, day, node_id, up, down, billed, users)`**：节点汇总 = 对它的几个入口求和。行数只多几倍，不必另建一张表。
- **`FLUSH_SQL`**：
  - 准入条件从 `node_users` 改为 `entrance_users` / `entrance_users_departed`；
  - `nf` CTE（`traffic.rs:721`）里取 `n.traffic_rate_permille` 的地方，改为按入口取"当前生效倍率"（见 D9）；
  - GCRA 仍按 agent 身份（机器）计算。

**删的列**：`nodes.traffic_rate_permille`（移到入口）、`nodes.server_addr`、`nodes.connect_overrides`。

**告警**：`node_alerts.kind` 的 CHECK 加 `entrance_down`，并加 `entrance_id uuid NULL → entrances ON DELETE CASCADE`。`node_alerts_one_firing` 改为 `(node_id, kind, entrance_id) NULLS NOT DISTINCT WHERE firing`（PG15+ 支持）。

### D7 通行密钥，移除 TOTP（W27）
- **删** 表 `user_totp`、`user_recovery_codes`。
- **删** 列 `panel_settings.require_admin_2fa`。
- **删** 代码：`src/totp.rs` 的 TOTP 部分、`account.rs` 的绑定和恢复码、`api.rs:231-271` 登录时的验证码检查、`auth.rs:321/424/527` 的 `require_admin_2fa` 注册会话、`nodeops.rs:545` 的 `admin reset-2fa`、`config.rs`、`export.rs`、`spa.rs`，以及 `spa/src` 下 24 个文件、`bench/src` 下 4 个文件。
- **加** `webauthn_credentials`：
  - 列：`id bytea PK`（credential id）、`user_id → users ON DELETE CASCADE`、`passkey jsonb NOT NULL`（webauthn-rs 序列化的 Passkey，含公钥和 counter）、`name text`、`aaguid uuid`、`backup_eligible bool`、`created_at`、`last_used_at`；
  - `(user_id)` 上建索引。

  注册和认证的 challenge 放 Valkey（短期、可丢），不建表。
- **加** `users.password_login_disabled_at timestamptz`：非空表示这个用户只能用通行密钥登录。
- **加** 全站设置（`signup_settings`，或新建 `auth_settings` 单行表）：`passkey_only bool`、`passkey_prompt bool`、`disable_password_after_passkey bool`，默认值按 D7 定。
- **改名 `totp.key` → `master.key`，保证派生密钥不变**。`totp::Keys::from_material`（`totp.rs:159-186`）从同一个根 HMAC 派生 6 个子密钥，各自用途如下：

| 标签（字节必须原样保留） | 用途 | 处理 |
|---|---|---|
| `akari/totp-secret-aead/v1` | TOTP 密文。**同时**用于 SMTP 密码（`smtp_settings.password_enc`，AAD 是 `mail/mod.rs:41` 的 `SMTP_AAD`）、Telegram token 和 webhook secret（`alert_settings.*_enc`，AAD 是 `alerts/mod.rs:71-72` 的常量） | **必须保留**。字段可以改名，例如 `secrets_aead`，但标签字节不能变，否则 SMTP 和告警通道的密钥都打不开 |
| `akari/recovery-code-hmac/v1` | 恢复码哈希 | 删除 |
| `akari/mail-code-hmac/v1` | 邮件验证码 HMAC（`email_codes.code_hash`） | 保留 |
| `akari/sub-token-aead/v1` | `users.sub_token_enc` | 保留 |
| `akari/payment-secrets-aead/v1` | `payment_methods.secrets_enc` | 保留 |
| `akari/signup-pow-hmac/v1` | 注册 PoW | 保留 |

  - `Keys` 从 `totp.rs` 移到新模块（例如 `crypto.rs`）。
  - `install.rs:74 ensure_totp_key` 改为 `ensure_master_key`，规则如下：
    - 有 `master.key` 就用它；
    - 只有 `totp.key` 时原子 rename 过去；
    - 两个都在且内容不同时报错，绝不覆盖；
    - 损坏的文件照旧报错，不自动重建。
  - 还要同步改：`scripts/backup.sh`、`scripts/restore-drill.sh`（第 15、108、138-139、160 行：它用 TOTP 登录来证明 `totp.key` 随备份恢复了，需要换成"SMTP 密码能解开"之类的证据）、`install.sh:35/1497`、`deploy/systemd/akari-panel.service:30`、`deploy/docker-compose.yml:43`、`config_check.rs:233`、`DEPLOY.md`、`BACKUP.md`、`PAYMENTS.md`、`README.md`、`spa/src/lib/admin-errors.ts`，以及各处 "data/totp.key changed?" 的错误文案：`alerts/channels.rs:220`、`sub/mod.rs:381`、`billing/alipay.rs:1150`、`billing/methods.rs:105/504/643`、`mail/sender.rs:149`。
  - 如果采用压缩迁移，v0.3 的数据目录理论上不会再用于 v0.4。但 D7 明确要求保留迁移逻辑，rename 的回退也只有几行代码，**建议保留**。

### D8 多域名（W27）
- **加** `site_domains`：
  - 列：`name text PK`（小写 DNS 名，可带端口）、`kind text CHECK IN ('main','sub','node')`、`preferred bool NOT NULL DEFAULT false`、`created_at`；
  - 部分唯一索引 `(kind) WHERE preferred`，每类最多一个首选；
  - 行级触发器复用 `akari_settings_notify()`。
- **删** `panel_settings.main_domain`、`sub_domain`、`node_domain`（以及 `testdb.rs:66` 写 `node_domain` 的测试夹具）。
- `grpc_server_names` 保留，语义仍是证书 SAN 只增不减。节点通信域名加入时同时写这张表。
- `node_enrollments.panel_addr`、`server_name`（发 token 时固化下来的值）保留。
- "每个用户随机分配一个订阅域名"：**建议不加列**，用 `hash(user_id) mod 订阅域名列表` 确定性地派生。代价是列表变化时部分用户的域名会变，删除前的影响提示里要包含这一点。如果要求分配后永不变化，再加 `users.sub_domain text NULL`（不加外键，域名被删后回落到首选域名）。

### D9 分时段倍率（W28）
- **加** `entrance_rate_rules`：
  - 列：`id`、`entrance_id → entrances ON DELETE CASCADE`、`days smallint NOT NULL CHECK (days BETWEEN 1 AND 127)`（周一到周日的位掩码）、`start_time time`、`end_time time`、`rate_permille int CHECK (0..100000)`、`sort`；
  - CHECK `start_time <> end_time`；`start > end` 表示跨零点；
  - `(entrance_id)` 上建索引。
- **加** 时区设置 `panel_settings.timezone text NOT NULL DEFAULT 'Asia/Shanghai'`，CHECK 用 `now() AT TIME ZONE` 校验合法。D9 只说"默认 Asia/Shanghai"，所以建议做全站设置而不是每个入口单独设置。
- **加** SQL 函数 `akari_entrance_rate(entrance_id, ts) STABLE`：规则是：有规则命中时，取所有命中规则里倍率最高的一条（规则的倍率可以低于 base，比如闲时折扣）；没有规则命中时用 base。重叠时取最高，符合 D9。
  - `FLUSH_SQL` 的 `nf` CTE 在 `statement_timestamp()` 调用它；
  - 门户、订阅节点名、流量明细调用同一个函数，保证"显示的倍率 = 结算的倍率"。
- 规则变更写 `audit_log`（target_type `entrance`）。

### D10 清理从未使用的账号（W27）
- **加** `users.last_login_at timestamptz`：用于"最后登录早于"筛选。
  - 登录时 UPDATE 一次；不和计费的 HOT 更新冲突，因为 `traffic_used_bytes` 上没有索引，`last_login_at` 也不建索引，后台筛选走扫描即可。
- **加** `users.cleanup_notice_at timestamptz`：删除提醒邮件发出的时间。用户登录一次就清空。
- **加** 设置：`account_cleanup_enabled bool DEFAULT false`、`account_cleanup_days int DEFAULT 30`、`account_cleanup_notice bool`、`account_cleanup_notice_days int`（放在 `signup_settings`）。
- **改** `mail_outbox.kind` 和 `mail_templates.kind` 的 CHECK，加 `account_cleanup`。这两份枚举现在是重复维护的（0155/0168 两边都列），见 §4.4。
- **"从未使用"的判定**由以下几项组成，都需要索引支撑：
  - `user_plans`：已有 `user_plans_user` 索引；
  - `orders`：已有 `orders_user`；
  - `balance_ledger`：已有 `balance_ledger_user`；
  - `tickets`：已有 `tickets_user`；
  - 流量历史：`traffic_daily` / `traffic_monthly` 的主键首列就是 `user_id`；
  - `user_balances`：主键；
  - **`withdrawals` 缺 `(user_id)` 全量索引**，现在只有 pending 的部分唯一索引；
  - **`commissions` 缺 `(invitee_id)` 索引**。
- **批量删除时的外键扫描**：删用户会触发以下**没有索引**的外键（SET NULL 或 CASCADE），每删一个用户就全表扫描一次。批量删除前必须先补索引，见 §4.1。
  - `mail_outbox.user_id`
  - `coupon_redemptions.user_id`
  - `commissions.invitee_id`
  - `email_codes.user_id`
  - `ticket_messages.author_id`
  - `node_users_departed.user_id`
- **匿名化和账本只允许追加的冲突（Q4）**：
  - `balance_ledger_append_only`（`0106_balance.sql:86-96`）只允许"`user_id` 置 NULL、其他列都不变"这一种 UPDATE。D1 之后 `user_login` 快照就是邮箱，注销以后会**永久留在账本里**，无法匿名化；
  - 同类的个人信息还有：`orders.user_login`、`withdrawals.user_login` / `account`（收款账号）、`commissions.*_login`、`admin_batch_items.user_login`、`payment_events.params`（支付宝通知里的 `buyer_logon_id`）、`audit_log.before/after` 里的用户快照（`audit.rs:151` 含 `login`）；
  - 建议二选一：
    - (a) 快照列只存不含个人信息的标签，例如 `u-<uuid 前 8 位>`，展示时实时 JOIN `users`；
    - (b) 放宽账本触发器，额外允许把 `user_login` 改写成固定的匿名值。

    推荐 (a)：一次改到位，不在资金表上开 UPDATE 口子。审计日志按 365 天保留，注销时不追溯改写，在隐私说明里写明即可。
- **流量历史**：`traffic_*` 表没有外键，按设计删用户时不会级联。注销或清理时要显式删除这个用户的 `traffic_daily`、`traffic_monthly`、`traffic_counters` 行；或者把 user_id 保留为不可关联的 UUID，即 Q4 的统一口径。

### D11 前台无前缀、订阅路径随机（W27）
- **加** `panel_settings.sub_path text NOT NULL`：安装时随机生成，CHECK 字符集和长度。修改时写审计（二次确认在接口层做）。
- 门户放到根路径以后，`state.json` 的 `route_prefix` 不再用于门户，见 D4。

### D12 用户管理只通过套餐（W28）
- `users.traffic_limit_bytes`、`expires_at`、`expiry_enforced` **保留**：它们是 `enforce::SERVED`（`enforce.rs:23`）这类热路径谓词的物化值，非测试代码里有 72 行引用 `traffic_limit_bytes`。改为只允许套餐路径（`plans.rs`）写入，删除 `PATCH /users` 里直接设置它们的分支。
- 用户详情页的"当前订阅"由 `user_plans` JOIN `plans` 得到，**不加表**。"重置套餐流量"复用 `user_plans.last_reset_at` / `next_reset_at`。
- **管理员封禁（W28）**：
  - **加** `users.disabled_note text NULL`（CHECK 长度不超过 500，且只在 `disabled_reason='admin'` 时允许非空），门户显示这段原因；
  - `disabled_reason` 枚举的 `'expiry'` 值从未使用，见 §5，在基线里删掉。

### W29 节点审计规则
- 命名：`audit_*` 和现有的 `audit_log`（操作审计）会混淆，**建议叫 `block_rules`**。
- **加** `block_rules`：
  - 列：`id`、`kind text CHECK IN ('builtin','domain','ip','protocol')`、`builtin_key text`（内置规则集：`bittorrent`、`bt_tracker`、`xunlei_pt`）、`pattern text`、`enabled bool`、`sort`、`created_at`、`updated_at`；
  - CHECK：`builtin` ⇔ `builtin_key` 非空、`pattern` 为空；
  - 部分唯一索引 `(builtin_key) WHERE kind='builtin'`。
- **加** 节点开关 `nodes.block_rules_enabled bool NOT NULL DEFAULT false`（默认关闭），或者在方案 A 下放到 `servers`。
- **加** 拦截计数 `node_block_daily (node_id, day, rule_id, hits bigint)`，PK 是前三列，保留 90 天，复用 `nodestat` 的清理 pass。按约定不记录用户访问明细。

### W30 / W31 / W33 / W36
- **W30**：加 `sub_rule_templates`，列 `id`、`name`、`body`（模板文本）、`is_default`，部分唯一索引 `(true) WHERE is_default`，再加 `version`、`updated_at`。
- **W31**：`smtp_settings` 改名为 `mail_settings`，加 `provider text CHECK IN ('smtp','resend')`、`api_key_enc bytea`（用主密钥的 `secrets_aead` 加密，新 AAD 常量）。CHECK 改为"provider = smtp 时 host 必填，resend 时 api_key 必填"。系统状态页的"每个面板实例的状态"建议放 Valkey 心跳（带 TTL），不建表。
- **W33 / W36**：预计不需要新表。如果新后台要"按对象看历史"，需要给 `audit_log (target_type, target_id, id)` 加索引。现在只有测试代码按 `target_id` 查（`account.rs:513`、`enroll.rs:695`、`nodemeta.rs:522`，均在 `#[cfg(test)]` 内）。

---

## 4. 一致性问题清单

### 4.1 外键缺索引（`pg_constraint` 与 `pg_index` 前缀比对的结果）

| 外键 | ON DELETE | 影响 | 建议 |
|---|---|---|---|
| `mail_outbox.user_id` | SET NULL | 每删一个用户扫一遍 outbox（保留 30–90 天）。D10 批量删除时放大 | 加 `(user_id) WHERE user_id IS NOT NULL` |
| `alert_notifications.alert_id` | CASCADE | 告警保留 pass 每删一条已恢复告警就扫一遍通知表 | 加索引 |
| `commissions.invitee_id` | SET NULL | 删用户时扫表；D10 判定也要用 | 加索引 |
| `coupon_redemptions.user_id` | SET NULL | 删用户时扫表 | 加索引（现有 `(coupon_id, user_id)` 首列不对） |
| `ticket_messages.author_id` | SET NULL | 删用户时扫表 | 加索引 |
| `email_codes.user_id` | CASCADE | 表很小（过期 1 天后删） | 可以不加 |
| `node_users_departed.user_id` | CASCADE | 表很小（宽限期后清理） | 随 D6 改表时加 |
| `tickets.node_id` / `tickets.order_id` | SET NULL | 删节点（reaper）或订单时扫工单表 | 加部分索引 |
| `orders.plan_id` / `coupon_id` / `credit_order_id` | SET NULL | 删套餐或优惠券时扫订单表（删除很少） | 低优先级；`coupon_id` 建议加，`coupons.rs:732` 的"是否被用过"查询走的是 `coupon_redemptions`，没问题 |
| `payment_events.payment_method_id` | SET NULL | 删支付方式时扫表 | 低优先级 |
| `balance_ledger.commission_id` / `withdrawal_id`、`commissions.ledger_id` | 无动作 | 只在删佣金或提现时触发，而这两类不删 | 不加 |
| `signup_settings.trial_plan_id` | SET NULL | 单行表 | 不加 |
| `orders.payment_method_id` | 无动作 | `methods.rs:440` 的 `EXISTS (… WHERE payment_method_id=$1)` 不限状态，只能用 pending 的部分索引，所以会全表扫描 | 改成全量索引，替换掉 `orders_payment_method_pending` |
| `withdrawals.user_id` | SET NULL | 只有 pending 的部分唯一索引；删用户时，以及 D10 的"有无财务记录"判定都会扫表 | 加 `(user_id)` |

### 4.2 ON DELETE 语义
- **资金表一律 SET NULL 并保留快照**，方向正确。但和 D10 匿名化存在冲突，见 D10 和 Q4。
- **`tickets.user_id` 是 CASCADE**：删用户会删掉工单和全部消息。工单可能涉及订单纠纷，属于"财务相关记录"。建议改为 SET NULL，正文随注销清空；或者在 D10 里把"有工单"列为永不自动清理，D10 已经把"没有工单"作为前提。
- **`plan_groups` / `user_plans.plan_id` 是 CASCADE**：删套餐会级联删除 `user_plans` 的历史行，`replaced`/`expired` 状态的行也会被删。资金表那边是 SET NULL 保留，两边口径不一致。建议改为"有 `user_plans` 历史的套餐只能下架、不能删"（RESTRICT），或者 SET NULL 并保留套餐名快照。
- **`audit_log.actor_id` 和流量表不加外键**：这是有意的设计（历史记录比实体活得久），保持。

### 4.3 CHECK / NOT NULL
- **37 个匿名 CHECK** 叫 `<表>_check`、`<表>_check1` 这类自动生成的名字，例如 `orders_check` 到 `orders_check3`、`commissions_check` 到 `commissions_check3`、`alert_settings_check2`、`withdrawals_check1`，完整清单在 `.work/phase0/anon_checks.txt`。这些名字取决于约束的声明顺序，错误日志里看不出是哪条规则，以后迁移也很难精确 DROP。**基线里统一命名为 `<表>_<规则>`**。代码只按名字引用过一个约束（`users_email_verified`，`api.rs:1055`），而它不是匿名约束，所以改名零风险。
- **`users.email` 可以为空**，D1 之后要改为 NOT NULL。
- **`plans.device_seats`** 有 CHECK 但从不执行，见 §5。
- **`commission_settings` 没有 `version` 列**。其余 6 张单行设置表（`panel_settings`、`signup_settings`、`smtp_settings`、`alert_settings`、`agent_update_settings`、`site_branding`）都用 `version` 做乐观并发。建议补上。

### 4.4 命名与类型
- **索引命名**：只有 `idx_node_users_user` 用了 `idx_` 前缀，其余都是 `<表>_<用途>`。随 D6 删表时一起消失；如果先做基线，就在基线里改名。
- **单行设置表的主键形式不统一**：5 张用 `smallint CHECK (id=1)`，`commission_settings` 用 `integer`，`agent_update_settings` 用 `boolean CHECK (id)`。基线里统一成 `smallint DEFAULT 1 CHECK (id = 1)`，代码里对应的 `WHERE id = TRUE` 要同步改。
- **IP 列类型不一致**：`audit_log.ip`、`payment_events.ip` 是 `text`，`nodes.agent_addr` 是 `inet`。建议统一为 `inet`；写入时由 `client_ip` 统一解析，非法值写 NULL。
- **"操作者"列命名不一致**：`actor_login`、`created_by`、`decided_by`、`acked_by`、`updated_by`、`closed_by`、`author_login`、`inviter_login`。建议统一为 `<动作>_by_label text` + `<动作>_by_id uuid NULL`，配合 D1、Q4 一次改完。
- **枚举风格不统一**：2 个 PG ENUM、几十个 `TEXT + CHECK`。`mail_outbox.kind` 和 `mail_templates.kind` 两处 CHECK 列表重复，0155 和 0168 需要互相"把对方的值也列上"才能在任意顺序下得到相同结果。**建议统一成 TEXT + CHECK**：加值只需替换 CHECK，事务内可以完成；ENUM 加值有事务限制、删值做不到。共享的列表用 `DOMAIN` 定义一次，例如 `CREATE DOMAIN mail_kind AS text CHECK (...)`，两张表都引用它。基线里把 `user_disabled_reason` 和 `user_plan_status` 也转成 TEXT + CHECK；代码里的 `::user_plan_status` 强转要同步删掉。
- **时间与时区**：全部是 `timestamptz`，这一点做得好。但 `traffic_daily.day`、`traffic_monthly.month`（FLUSH 里写的是 `statement_timestamp() AT TIME ZONE 'UTC'`）和套餐月重置（`akari_next_reset` 按 UTC 月界）都按 **UTC 划分**；D9 用 Asia/Shanghai。中国用户看到的"今日流量"从北京时间 08:00 开始算。见 Q3。
- **金额**：统一用 `bigint` 分，没有浮点，好。`rollouts.max_failure_ratio` 是 `double precision`，但它不涉及金额，可以接受。

### 4.5 其他
- **pgcrypto 扩展**（`0001_init.sql:1`）**完全没用到**，证据见 §5。testdb 会在每个测试 schema 里执行 `CREATE EXTENSION IF NOT EXISTS`，扩展只装进第一个 schema，也是隐患。基线里删掉。
- **`nodes` 宽表的热更新**：每次 flush 都更新 `traffic_tat` 和 `traffic_*_bytes`（每个节点每 5 秒），心跳也更新 `last_seen_at`，但表上没有设 fillfactor。节点数量小（几百行），影响有限。方案 A 拆表后，在 `servers` 上设 `fillfactor=70`。

---

## 5. 无用的表和列（逐条 grep 核实）

| 对象 | 证据 | 处理 |
|---|---|---|
| 扩展 `pgcrypto` | `grep -rnE "\b(digest\|crypt\|gen_salt\|hmac\|pgp_[a-z_]+\|gen_random_bytes)\(" migrations src`：只命中 Rust 的 `Sha256::digest`；schema 里 `gen_random_uuid` 出现 0 次（ID 都在 Rust 里生成） | 基线删除 |
| 枚举值 `user_disabled_reason.'expiry'` | `grep -rn "'expiry'" src`（非测试）0 处；`0020_plans.sql:19` 注释写着"reserved"；`migrations/CLAUDE.md` 写着"expiry 预留未用——过期由谓词执行" | 基线删除 |
| 列 `announcement_reads.read_at` | `src` 和 `spa/src` 都是 0 处引用，只靠 DEFAULT 写入 | 删除，或在 W33 里真正用起来 |
| 表 `legacy_config_imports`（含 `handled_at`，0 处引用） | 唯一用途是 `settings.rs:2837 import_legacy` 一次性导入 v0.3 之前已废弃的 panel.toml 键（`:2904`、`:2997`）。v0.4 只支持全新安装，不再有旧 panel.toml | **压缩后连同 `import_legacy` 的代码一起删除** |
| 列 `plans.device_seats` | `plans.rs:27` 写明"stored for the client's"，即为 M5 预留、不执行；只在 `api.rs`、`plans.rs`、`billing/api.rs` 里原样读写。战略决定 3 是"设备限制现在不做" | 按"不留死代码"删除，M5 时再加 |
| 表 `user_totp`、`user_recovery_codes`，列 `panel_settings.require_admin_2fa` | 由 D7 废弃 | W27 删除 |
| 列 `users.login` | 由 D1 废弃 | W27 删除 |
| 列 `node_users.manual` | 由 D3 废弃 | W28 删除 |
| 列 `nodes.connect_overrides`、`server_addr`、`traffic_rate_permille` | 由 D2/§5 移到入口 | W28 删除 |
| 列 `panel_settings.main_domain`、`sub_domain`、`node_domain` | 由 D8 改成列表 | W27 删除 |
| 列 `signup_settings.email_verify` 的 NULL 三态 | 由 D1 改为二态 | W27 修改 |

**核实后确认仍在使用、不是无用的**（避免误删）：
- 非测试代码里只在一个文件出现的列，例如 `failed_held_*` 和 `failed_reason`（`grpc.rs:1619-1677, 2091`，期望状态里的 `DbFailure`）、`users.invite_autocreated`（`signup/invite.rs:161/176`）、`announcements.mail_cursor`、`orders.last_query_at`、`mail_templates.updated_by`、`traffic_sessions.*`（FLUSH 与保留 pass），都确认在用。
- `node_metrics_*` 里 `*_sum` 这类 SPA 不直接引用的列，在 `nodestat.rs` 的汇总和平均值计算里使用。

**未使用索引**：静态分析得不出结论（需要 `pg_stat_user_indexes`）。建议阶段 C 压测后在测试服务器上导出 `idx_scan = 0` 的索引，作为阶段 D 的输入。重点关注 `traffic_daily_day`（BRIN；如果改分区就可以删）、`orders_paid_via_paid_at`、`audit_log_at`。

---

## 6. 增长与保留策略

**现有保留策略**（来源：`reaper.rs`、`traffic.rs`、`nodestat.rs:61-62`、`alerts/eval.rs:18`、`mail/sender.rs:335`、`audit.rs:340`、`billing/orders.rs:911-918`）：

| 表 | 增长来源 | 保留 | 评价 |
|---|---|---|---|
| `traffic_counters` | (节点, 用户, 会话) | 能证明已死的会话行由 `retention_pass` 删除 | 合理；D6 后键加 `entrance_id`，行数随入口倍增 |
| `traffic_sessions` | 每个 agent 会话一行 | **永久**墓碑 | 每次 agent 重启一行，量很小，可以接受 |
| `traffic_daily` | 每天每个活跃的 (用户, 节点) 一行 | 超过 400 天（可设置）用 DELETE 汇总进月表 | **主要增长点**，见下文 |
| `traffic_monthly`、`traffic_node_daily` | — | 永久 | 量小，可以接受 |
| `node_metrics_1m` / `1h` | 节点 × 分钟 / 小时 | 48 小时 / 90 天 | 合理 |
| `audit_log` | 管理操作 | 365 天（可设置），按 id 分批 DELETE | 合理 |
| `payment_events` | 支付回调 | 未验签的按审计保留期删除，已验签的永久 | 合理（资金记录） |
| `mail_outbox` | 邮件 | 已发 30 天、死信 90 天 | 合理 |
| `node_alerts` / `alert_notifications` | 告警 | 90 天 / 30 天 | 合理；需要补 4.1 里的索引 |
| `orders`、`balance_ledger`、`commissions`、`withdrawals` | 资金 | 永久 | 正确 |
| `admin_batch_items` | 每个批量任务 × 用户数 | **没有保留策略** | 建议任务结束 90 天后级联删除 |
| `announcement_reads` | 用户 × 公告 | 没有保留策略（只随公告或用户删除） | 可以接受；如有需要，过期公告的已读行可以清理 |
| `ticket_messages` | 工单 | 永久 | 可以接受 |

**`traffic_daily` 的规模估算**：
- 单行大小：堆约 92 B，fillfactor 80 后约 115 B；主键约 50 B；覆盖索引 `traffic_daily_node_cov` 约 75 B。**合计约 240 B/行**。D6 加 `entrance_id` 后约 280 B/行。
- 1 万活跃用户 × 平均 2 个入口/天 × 400 天 = 800 万行，约 **2.2 GB**。
- 5 万活跃用户 × 3 个入口/天 × 400 天 = 6000 万行，约 **17 GB**。

两个代价：
1. **汇总靠 `DELETE … RETURNING`**（`ROLLUP_SQL`，`traffic.rs:1485`），每天删除一天的行，堆和两个 B-tree 索引都会持续产生死元组和索引膨胀，要靠 autovacuum 追。
2. **0151 的覆盖索引让当天行的压缩 UPDATE 无法走 HOT**，PERF.md 里已经记录了这个取舍。当天行每 30 秒累加一次，所以覆盖索引的膨胀集中在最近几天。

**建议（W28 顺带完成，因为 D6 本来就要改 `traffic_daily` 的键）**：
- `traffic_daily` 按 `day` **按月 RANGE 分区**：
  - 主键 `(user_id, day, entrance_id)` 包含分区键，满足分区表对主键的要求；
  - 汇总改为"`INSERT INTO traffic_monthly SELECT … FROM <整月分区> GROUP BY …` 加 `DROP TABLE <分区>`"，在同一个事务里完成，不产生死元组；
  - reaper 提前建好后 2 个月的分区，另设一个 DEFAULT 分区兜底；
  - 分区名要带当前 schema，保证 testdb 每个测试一个 schema 的模式仍然可用；
  - BRIN 索引 `traffic_daily_day` 可以删掉，分区裁剪已经覆盖了它的用途。
- 规模更小的方案：不分区，只把 `traffic_daily_retention_days` 的默认值从 400 降到 100 左右（门户只展示最近 30–90 天，更早的看月表）。规模估算按比例降到 1/4。**如果分区放不进 W28 的周期，至少先做这一步。**
- `traffic_daily_pending` 无索引、低阈值 autovacuum 的设计保持不变。

---

## 7. 迁移方案

### 7.1 建议：阶段 A 之前，单独一个 PR 压缩基线

**做法**：
1. 在 `migrations/` 里删掉 0001–0168 共 52 个文件，新建 **`1000_baseline.sql`**。生成步骤：
   - 用 `pg_dump --schema-only --no-owner --no-privileges` 从 0168 的库导出；
   - 去掉 `public.` 前缀和 `SET` / `set_config('search_path', '', false)`。这一步是必须的：testdb 让每个测试在自己的 schema 里跑迁移（`testdb.rs:46-63`），带 `public.` 限定或清空 search_path 都会让测试串到别的 schema；
   - 去掉 `CREATE EXTENSION pgcrypto` 和它的 `COMMENT`；
   - 补上 7 个单行设置表的种子 `INSERT`，`--schema-only` 不会导出数据；
   - 按领域分节，把各个迁移里关键的设计注释搬过来，例如触发器的不变量、fillfactor 的理由、"计费基线不是日志"。
2. 同一个 PR 里只做**不需要改业务代码**的清理：
   - 删除 pgcrypto；
   - 删除枚举值 `'expiry'`；
   - 37 个匿名 CHECK 改为有意义的名字；
   - `idx_node_users_user` 改名；
   - 补齐 §4.1 里"建议加"的外键索引；
   - 统一单行设置表的主键形式（涉及 `agent_update_settings` 的少量 SQL）；
   - 删除 `legacy_config_imports` 表和 `settings.rs:2837` 起的 `import_legacy` 代码。

   **不在这个 PR 里做**：删 `login`、TOTP、`manual`，以及其他任何需要业务代码配合的改动，这些归各自的任务。
3. **证据**：PR 正文附上 `pg_dump` 的对比。旧链（0001–0168）和新基线各导出一份，diff 只能出现第 2 步列出的改动。
4. **启动守卫**（`db::migrate`，在 `sqlx::migrate!` 之前执行）：如果 `_sqlx_migrations` 存在，并且有任何 `version < 1000` 的行，就拒绝启动，报错"这是 v0.3.x 创建的数据库，v0.4 需要全新安装（docs/DEPLOY.md）"。这一条规则同时覆盖开发库、smoke 库、bench 库和恢复出来的旧备份。不加守卫的话，sqlx 会报含义模糊的 `VersionMissing`。
5. **同步更新**：
   - 重写 `migrations/CLAUDE.md`："当前表"改为按基线描述，历史编号说明删除；
   - 源码和文档里大约 64 处（src）和 38 处（`CLAUDE.md`、`src/CLAUDE.md`、`docs/*.md`）"迁移 0007/0013/0151"之类的编号引用，改为引用基线的章节或对象名；
   - `install.sh`：`upgrade` 时如果 `migration_version` 在 1 到 999 之间，在备份之前就拒绝，提示需要全新安装；`install.sh:1021-1027` 的版本查询照旧可用。

**压缩的利弊**：

| 利 | 弊 |
|---|---|
| 阶段 A 的 6 个任务在一份可读的结构上开发，不用在 52 个文件里拼出某张表的现状 | v0.3.2 → v0.4 不能原地升级，只能全新安装。测试环境要清空，生产没有真实用户，**实际损失为零** |
| 删除只为兼容历史而存在的代码和数据，例如 `legacy_config_imports`、`ADD COLUMN IF NOT EXISTS` 的并行补丁、0155/0168 互相列出枚举值 | CI 的 `installer-bare` / `installer-host` 现在是"先装最新发布版（v0.3.2）再升级到本 PR"（`ci.yml:311-401`）。在 v0.4.0 发布之前必须改为两项：全新安装，加上"旧版升级被干净拒绝"的断言 |
| 匿名约束、命名、类型的统一只能趁这次做；以后做就是在线迁移 | 本地开发库和 smoke 库需要重建一次（守卫会提示） |
| 以后迁移链从 1000 起步，新旧编号不会混淆 | 带旧编号的历史文档（SPRINT 裁决、PLAN 等）对不上新文件，需要注明"0001–0168 已在 v0.4 压缩为 1000" |

说明：**压缩不是为了速度**。实测把旧链 52 个文件合在一次 psql 里执行用 0.34 秒，单个基线文件用 0.36 秒，差别可以忽略。testdb 每个测试的迁移开销主要是 sqlx 的逐文件事务和共享的 advisory lock，压缩后会略有改善，但这不是理由。

### 7.2 不压缩的方案（对比用）
阶段 A 的各任务各自追加 DROP/ALTER 迁移，包括删 `login`、删 TOTP 表、删 `manual`、重建 `node_users` 和 `traffic_*` 的主键。结果：
- 迁移链会超过 70 个文件，其中有大量"建了又删"的历史；
- 匿名约束、单行表的形式、枚举风格只能带着走，或者额外写重命名迁移；
- 能换来的只有"v0.3.2 可以原地升级"，而这个能力目前没有使用者。

**不推荐。**

### 7.3 发版冻结时是否二次压缩
阶段 A 到 E 结束后，迁移会落在 1001–1099。v0.4.0 发布之前，可以再把 1000–10xx 合并成一个新基线（例如 `2000_baseline_v0_4.sql`），让 v0.4.0 发出去时只有一个文件。做法和证据要求同 7.1，守卫的阈值改为 2000。**建议由 lead 在发版冻结时决定**：如果 v0.4 期间测试服务器部署过需要保留的数据，就不做二次压缩。

---

## 8. 对各任务迁移编号的影响

PLAN §3 "编号预分配"的 0170–0219 作废，改为下表。proto 字段号不受影响，保持原来的分配。

| 任务 | 原编号 | 新编号 | 预计内容 |
|---|---|---|---|
| 阶段 0 基线 | — | **1000** | `1000_baseline.sql`（见 7.1） |
| W37 / 基线跟进 | — | 1001–1009（预留） | 基线 PR 评审后的修正 |
| W27 | 0170–0179 | **1010–1029** | D1 删 `login` 并改邮箱唯一性、快照列（Q4）；D7 删 TOTP、加 `webauthn_credentials` 和密钥相关设置；Turnstile、蜜罐设置；D4 `admin_prefix` 和白名单；D8 `site_domains`；D10 `last_login_at`、清理设置、邮件类型；D11 `sub_path`；自助注销。**比原来多 10 个号**：W27 有 7 个独立的数据变更点 |
| W28 | 0180–0189 | **1030–1059** | 方案 A 的 `servers` 拆分；`entrances`、`entrance_group_members`、`entrance_users`、`entrance_users_departed`；`traffic_*` 换主键并给 `traffic_daily` 分区；D5 额度；D9 规则表、时区设置和函数；D3 删 `manual`；D12 封禁原因。**比原来多 20 个号**：W28 是这次重构的主体 |
| W29 | 0190–0194 | 1060–1064 | `block_rules`、节点开关、`node_block_daily` |
| W30 | 0195–0199 | 1065–1069 | `sub_rule_templates` |
| W31 | 0200–0204 | 1070–1074 | `mail_settings` 改名，加 `provider` 和 `api_key_enc` |
| W32 | 0205–0209（预留） | 1075–1079（预留） | 预计不需要 |
| W33 | 0210–0214 | 1080–1084 | `audit_log (target_type, target_id, id)` 索引（如有需要） |
| W36 | 0215–0219（预留） | 1085–1089（预留） | 预计不需要 |
| 阶段 C/D/E 修复 | — | 1090–1099 | 性能和红队修复 |
| v0.4.0 之后 | — | 1100 起（如果做了 7.3，就从 2001 起） | — |

**规则调整**：
- "不得新增编号小于 main 上已有迁移的文件"这条规则，在 v0.4 开发期间（没有需要保留的部署库）**放宽为"只能在本任务的区间内递增"**。W27 和 W28 并行时，可能出现 1030 先合并、1012 后合并，sqlx 会照常执行未执行过的低编号迁移，CI 每次都从空库开始，不受影响。
- 如果后合并的迁移依赖先合并的迁移，比如 W28 和 W27 都要改 `users`，由后合并的一方 rebase 并核对。
- v0.4.0 发布后恢复原规则。

---

## 9. 风险

1. **方案 A（`servers` 拆分）的 SQL 改动面大**：SQL 是手写字符串，没有编译期检查（`migrations/CLAUDE.md` 已经提醒过）。缓解措施：
   - W28 的 brief 附上本文 D2 的列迁移表；
   - 用 `grep -n "FROM nodes\|JOIN nodes\|UPDATE nodes"` 列出所有点位，逐条审；
   - `api::tests::every_access_change_bumps_affected_nodes` 扩展为按服务器 bump；
   - smoke 全量通过。
2. **`FLUSH_SQL` 改主键和倍率**：这是计费核心，覆盖率门槛 90%，PERF.md 对 5 万行 flush 有 0.6 秒的预算。按入口准入和按入口算倍率会增加 JOIN，必须在 `make bench` 上对比前后数据。PG18 的 `RETURNING old/new` 依赖不变。
3. **派生密钥标签**：如果误删或改名 `akari/totp-secret-aead/v1`，SMTP 密码和告警通道的密钥会**全部打不开**，而且这个错误只在运行时出现。W27 必须加一个单元测试：固定根材料，断言 6 个标签派生出的密钥向量不变（删掉的恢复码标签除外）。
4. **压缩后 CI 的安装器测试**：v0.4.0 发布之前，`installer-*` 的"从上一个发布版升级"会失败。如果不先改成"断言被拒绝"，必需检查会一直红。这个调整应该和基线 PR 一起合并（或者放进 W37）。
5. **D1 改邮箱唯一性的时序**：在这之前，管理员给用户填的未验证地址可以重复。全新安装没有存量数据，不受影响；但 W27 的测试夹具和 bench 种子数据要改成邮箱唯一。
6. **Q4 匿名化**：如果不先定口径，W27 的自助注销和 D10 会在 `balance_ledger` 的只追加触发器上撞墙，或者被迫给资金表开 UPDATE 口子。
7. **bench crate 和 SPA 的连带修改**：`bench/src` 的 seed、load、explain 直接写 `node_users`、`user_totp`、`login` 等。W27 和 W28 的 PR 必须同时修改它们，CI 的 `bench-tooling` job 会拦截遗漏。

---

## 10. 需要决策的问题

| # | 问题 | 推荐 |
|---|---|---|
| **Q1** | D2 "同一台服务器建多个节点"：A 新建 `servers` 表，一台机器一个 agent；B 一台机器装多个 agent | **A**。agent 本来就支持多入站，改动集中在面板侧；机器级的额度、监控、rollout、nftables 都只有一份 |
| **Q2** | D5 额度挂在服务器上还是节点上 | **服务器**（VPS 的流量额度按机器算）。超额后这台服务器上的所有节点都下发空配置 |
| **Q3** | 流量明细的日界线和套餐月重置：继续用 UTC，还是改用全站时区（默认 Asia/Shanghai，和 D9 共用） | **改用全站时区**。`traffic_daily.day`、`akari_next_reset` 的月界都按 `panel_settings.timezone` 计算；正好 W28 要改这些表，没有存量数据要迁 |
| **Q4** | 注销和清理以后，资金表里的个人信息快照怎么处理 | 快照列只存不含个人信息的标签，展示时 JOIN `users`；账本触发器保持只允许追加 |
| **Q5** | 是否在阶段 A 之前压缩基线（编号 1000） | **是**，并同步调整 CI 的安装器升级测试 |
