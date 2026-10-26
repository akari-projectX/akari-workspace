# 代码体检 批次 4：akari-panel 其余部分（只读审计）

日期 2026-10-26 · 基线 akari-panel main `04dfb4a` · 范围：批次 1–3 之外的全部后端（`grpc`、`entitle`、`servers`/`nodes`/`entrances`、`enforce`、`reaper`、`rollout`/`updates`、`protocols/**`、`sub/**`、`mail/**`、`alerts/**`、`markdown`、`csvx`/`export`、`tickets`、`cleanup`/`erase` 等）、迁移、`scripts/install.sh`、`backup.sh`/`restore.sh`、`nodeinstall.sh`、Dockerfile/deploy、`portal/src` 与 `admin/src`（死代码与首屏）。

状态：**部分完成**。主路径（收敛决策、授权对账、订阅渲染、邮件发件箱、Markdown/CSV 净化、安装器信任链、备份/恢复）已读到代码级；其余模块只做了抽查或脚本扫描，未覆盖范围见末尾。无代码改动；为做 EXPLAIN 在开发栈 PG 上建了临时库 `audit4core`，已删除。

## 摘要

| 严重度 | 数量 |
|---|---|
| P0 | 0 |
| P1 | 0 |
| P2 | 4 |
| P3 | 18 |

没有发现收敛错误（该发 Snapshot 却发了 UserDelta）、撤权缺口、锁序反转、重复发信/漏发告警或净化绕过。4 个 P2 都不是资金/越权类：两个是订阅输出缺陷（其中一个是任一管理员可向全部用户的客户端配置注入内容）、一个是执行 pass 的故障连坐、一个是备份只防损坏不防篡改。

## P2

### P2-1 入站 TLS/REALITY 字段（`serverName`、`serverNames[0]`、`publicKey`、`shortId`）不校验字符集，原样写进 Clash YAML 与分享链接
- 位置：校验缺口 `src/protocols/transport.rs::check`（只查 path/host/mode/serviceName）、`src/protocols/validate.rs::check`、`src/api.rs::validate_inbound`（只调 `check_inbound`）；输出点 `src/sub/clash.rs:61,85,93,95`（`sni:`/`servername:`/`public-key:`/`short-id:` 未加引号，对比同文件的 `yaml()` 用于 path/password）、`src/sub/links.rs:19,22,25,123`（`sni=`/`pbk=`/`sid=` 未做百分号编码）。
- 类别：注入 / 输出渲染
- 推理（读代码确认，未在真库复现）：`net_of`（`sub/proxy.rs`）把 `ib.security.sni()`、`Reality.public_key`、`short_id` 原样放进 `Net`；`xray::check` 对这些字段没有任何检查（`rg serverName|publicKey|shortId src/protocols` 只有 parse/render）。`PUT /nodes/{id}/inbound` 只需普通管理员（不是所有者）。把 `serverName` 设成 `"a\n    udp: true\nrules: [...]"`、`"x: y"` 或带 `#`/空格的值，所有持有该节点入口的用户的 Clash 配置就被注入/损坏；`links` 里 `sni=a&flow=...` 可追加参数。对比：路由/DNS（`sub/dns.rs`）、path/host/service name 都有严格校验，这里是遗漏。
- 影响：（1）任一管理员可改写全体用户的客户端配置（加代理、改规则、改 DNS），超出“管理员能指定入口地址”的既有能力（后者只能重定向流量，不能改客户端其余配置）；（2）无恶意时，一个手滑的空格/冒号也会让该节点所有 Clash 订阅解析失败，且没有任何校验提示。
- 修法：在 `security` 校验里加 `Fault::SniInvalid/RealityKey/ShortId`（sni 复用 `valid_host`，public key = base64url ≤64，short id = hex ≤16 偶数位）；渲染端对所有写进 YAML 的字符串一律过 `yaml()`，链接参数一律 `encode_fragment`（防御纵深，旧数据也安全）。补测试：含换行/`#`/`&` 的 serverName 被拒；渲染器遇脏值仍输出合法 YAML。

### P2-2 `links` 格式不给 IPv6 字面量加方括号，该入口的分享链接无法解析
- 位置：存储 `src/entrances.rs:355-366`（`clean_host` 丢掉 `[]`，`valid_host` 接受 `IpAddr`）；输出 `src/sub/links.rs:63-66,71-74,115-120,123-127`（`@{server}:{port}`）。
- 类别：bug（订阅渲染）
- 推理：管理员给入口填 `2001:db8::1`（接口明确允许）→ 存为无括号小写形式；`vless://uuid@2001:db8::1:443?...` 与 `ss://…@2001:db8::1:8388` 在 v2rayN/Shadowrocket 里无法区分主机与端口，该行直接失效。Clash（`server: 2001:db8::1`）与 sing-box（JSON）不受影响；vmess 链接是 JSON，不受影响。待确认：个别客户端对无括号 IPv6 的容错，但 RFC 3986 要求方括号。
- 修法：渲染分享链接时 `if server.contains(':') { format!("[{server}]") }`（集中在 `links.rs` 的一处 helper）；补 IPv6 入口的黄金样例。

### P2-3 `enforce::run_all` 任何一个 pass 出错就跳过其后所有 pass（含流量上限）
- 位置：`src/enforce.rs:120-141`（`let r = run_pass(...); ...; r?;`），调用方 `src/traffic.rs:1782`（每 5 秒一次，所有实例）。
- 类别：错误处理 / 故障隔离
- 推理：顺序是 PlanExpiry → Resets → Limits → Expiry → Commissions → ServerQuota。前两个 pass 在 `plans.rs` 里会把 `ApiError` 转成 `anyhow` 错误；只要某一行数据让它们确定性失败（约束、不可开通的重置、外键竞争之外的坏数据），之后的 `Limits`（超流量停用）、`Expiry`、佣金入账、服务器额度重置每 5 秒都被跳过，直到人工修数据。目前没有看到会确定性失败的路径，但这是单点连坐，且 `flush_once` 只 `warn`。
- 修法：循环里收集错误，所有 pass 都跑一遍，最后返回第一个错误（指标 `enforcement_pass` 已按 pass 记录，不用改）。补测试：注入一个失败的 pass，断言 `Limits` 仍生效。

### P2-4 备份只防损坏不防篡改：`SHA256SUMS` 与密文放在同一目录，age 公钥加密无认证，恢复会装入攻击者的 CA / jwt.key / master.key
- 位置：`scripts/backup.sh:139-142`（`SHA256SUMS` 只算 `.age` 文件）、`scripts/restore.sh:38-41`（`sha256sum --check`，报错文案写 “tampered with”）、`scripts/install.sh:1248-1250`（`check_restore_dir` 同样）。
- 类别：备份安全
- 推理：age 的收件人是公钥——任何能写备份目录/对象存储的人（只读备份主机的凭据不够，但备份桶写权限常独立泄露）都能用公钥加密自己的 `data.tar`（含 `ca.key`、`jwt.key`、`master.key`）和 `db.dump`，再重算 `SHA256SUMS`。灾难恢复时 `restore.sh`/`akari-ctl backup --restore` 会照单全收：攻击者持有 jwt.key 即可铸造管理员会话，持有 CA 即可冒充任意 agent。校验和只能证明“与同目录的清单一致”。
- 修法：对 `MANIFEST`+`SHA256SUMS` 做分离签名（`ssh-keygen -Y sign` / minisign，私钥与备份写入凭据分开存放；恢复时用公钥验），或至少在文案里去掉 “tampered” 的承诺并在 docs/BACKUP.md 写明威胁模型。安装器 `--restore` 同步验签。

## P3

1. **ACME 目录/邮箱改动不会重发给 agent**：`src/settings.rs:1064-1085` 的 `reload` 在 `acme_directory_url/acme_email` 变化时 `wake_all()` 并写“sessions re-read and re-send”，但 `grpc.rs::SyncState::decide`（`held == desired` → `None`）不会因 ACME 变化发 Snapshot（ACME 不进版本号、不进 state hash）。`apply_update_node_ops` 文档写“ACME on the next Snapshot”，所以实际行为是下次任何配置变更或 agent 重连才生效（例如从 staging 切到正式目录要等）。修法：改注释并在后台设置页提示，或让该变更 bump 有证书需求的服务器的 `config_version`。
2. **Markdown 行内强调的两个小问题**（`src/markdown.rs:332-345,364-380`）：（a）单下划线/星号在词中也触发强调，`foo_bar_baz`、粘贴的 `https://x/a_b_c` 会被渲染成斜体并吞掉下划线（知识库文章里常见）；（b）`find_emph_close` 在 `* * * * …`（64 KiB 单行）上对每个标记扫到行尾，按代码估算约 5×10⁸ 次循环迭代、秒级 CPU（待确认，未实测）；只有管理员可写正文。修法：按 CommonMark 规则要求 `_` 两侧非字母数字；找不到闭合就记住“此标记无闭合”避免重复扫描。净化本身（见“已核对”）没有问题。
3. **强制执行 pass 的候选查询每 5 秒全表扫描 `users`**：`OVER_LIMIT`/`EXPIRED AND NOT expiry_enforced` 在 10 万用户的种子库上 `EXPLAIN ANALYZE` 各约 22–25 ms（Seq Scan，过滤掉 100000 行），每实例每 5 秒两次；百万用户约 0.25 s/次。修法：部分索引 `users (id) WHERE role='user' AND enabled AND traffic_limit_bytes IS NOT NULL AND traffic_used_bytes > traffic_limit_bytes`（谓词需与 `OVER_LIMIT` 一致）与 `users (expires_at) WHERE role='user' AND expires_at IS NOT NULL AND NOT expiry_enforced`；注意 `traffic_used_bytes` 每次 flush 都变，索引谓词含它会让更新失去 HOT，需先量（`migrations/CLAUDE.md` 已提到该约束）。
4. **CSV 导出的 REPEATABLE READ 事务没有总时限**：`src/export.rs:80,313`（`mpsc::channel(1/4)` + 逐页读）——客户端停读但连接不断时，快照事务与池连接一直占用，钉住 xmin 影响 `servers` 心跳等高更新表的清理。修法：给 producer 加整体 `timeout` 与单次 `send` 超时。
5. **托管规则集 304 也读完整 `body`**：`src/sub/rulesets/mod.rs:396-420` 先 `SELECT body, etag`（body 上限 16 MiB）再比 `If-None-Match`。已有按 IP 限速，但命中 304 的请求仍从 PG 取全量。修法：先取 etag，匹配则直接 304，不匹配再取 body。
6. **重复实现 / 多个事实来源**：（a）LIKE 转义 3 份（`kb.rs:547`、`tickets.rs:1002`、`billing/api.rs:1040 like_contains`）；（b）主机名校验 5 份且规则不同（`entrances::valid_host`（允许 `_`、IPv6）、`protocols/transport::valid_host`（允许 `[]:` 任意位置，`"::::"` 通过）、`nodetpl::valid_hostname`、`mail/mod.rs::valid_host`、`blockrules::valid_domain`）；（c）令牌哈希 3 份（`enroll::hash_token`、`signup/reset::token_hash`、`sub::hash_token`，返回类型都不同）。修法：各合并成一个函数，分歧点（是否允许 IPv6/下划线）显式参数化。
7. **死代码**：Rust 4 个 `pub` 函数全仓只出现一次——`config.rs::from_pairs`（注释“for tests”但无人调用）、`entitle.rs::servers_of_users`、`protocols/mod.rs::vless_flow`、`settings.rs::main_host`；依赖 `data-encoding`（Cargo.toml:21）在 `src/`、`build.rs`、`fuzz`、`bench` 均无引用（仍作为传递依赖存在）。前端（脚本按名字出现次数扫描，非 knip，可能漏掉间接使用）：admin 23 个无引用导出——`console/pages/ledger.tsx` 的 `LedgerTable`/`useColumns`/`ScrollX`、`shared/ui/stat.tsx` 的 `KpiCard`/`TrendChip`、`console/pages/order-status.tsx::OrderChip`、`console/pages/node-common.tsx` 的 `ApplyError`/`GroupPicker`/`entranceState`/`healthText`/`sameSet`/`splitTags`、`console/kit.tsx` 的 `Stat`/`StatusBadge`、`console/pages/users.tsx::UserStatusBadge` 等；portal 4 个（`lib/attention.svelte.ts` 的 `nodesUp`/`unreadAnnouncements`、`shared/lib/node.ts::rateTone`、`shared/lib/traffic.ts::weekAxis`）。portal 词典 537 个键全部在代码里出现、无重复键（脚本检查）。
8. **规范偏差（抽样 + 脚本统计，排除内联 `mod tests`）**：生产代码 `.unwrap()` 约 0 处（很干净）、`panic!/todo!` 0 处、`unsafe` 2 处且都有 SAFETY 注释；glob 导入约 10 处（`use fred::prelude::*` ×8：`login_limit.rs`、`sysstatus/mod.rs`、`valkey_util.rs`、`passkey.rs`、`rate.rs`、`state.rs`、`signup/register.rs`、`api.rs`；`protocols/manifest.rs` 的 `use …::*` ×2）；吞中毒互斥锁 37 处（`grpc.rs::lock_or_recover` 28 处、`nodestat.rs` 3、`tlsserver.rs` 2、`enroll.rs` 2、`settings.rs`/`mail/transport/smtp.rs` 各 1），与 RUST-STYLE “不碰中毒互斥锁”冲突（`lock_or_recover` 有明确设计说明，改成 `tokio::sync::Mutex` 或接受 panic 传播需单独决定）；`#[allow(` 8 处；`Cargo.toml` 尚无 `[lints.clippy]`，clippy 统计未跑（磁盘不足以做完整构建）。
9. **节点安装脚本的“备用下载”只靠 TLS**：`src/nodeinstall.sh:150-153` 的 `SHA256SUMS` 与二进制取自同一源，未验 cosign 签名（面板安装器 `install.sh` 验）。首个 agent 之后的更新有 Ed25519 把关，但首次安装信任 = 备用源的 TLS。修法：把官方发布的 cosign 验证搬进脚本，或在面板侧记录/下发预期哈希（有发布时不走此路径，影响面小）。
10. **Dockerfile 基础镜像按标签而非摘要固定**：`node:24-alpine`、`rust:1.99-alpine`、`alpine:3.22`、`distroless/static-debian13:nonroot`（Dockerfile:35-37,99）；发布构建会随上游标签漂移（CI 的“逐字节相同”检查只对同一次构建有效）。修法：`@sha256:` 固定并交给 Dependabot docker 生态更新。
11. **邮件发件循环串行且单封超时 60 s**：`src/mail/sender.rs:225-250` 每实例每 tick 最多 50 封、逐封 `await`；SMTP 对端黑洞时一个 tick 最长 50 分钟，期间同实例的验证码（10 分钟有效）全部过期、通知/公告批次也停摆（多实例可部分缓解）。修法：有限并发（`buffer_unordered(4)`）或把连续超时当熔断（本轮停止认领）。
12. **外键缺索引**（执行 `pg_constraint` 查询）：`email_codes.user_id`、`orders.credit_order_id`、`payment_events.payment_method_id`、`balance_ledger.withdrawal_id`/`commission_id`、`commissions.ledger_id`、`signup_settings.trial_plan_id`。均为低频删除，被引用表小或只追加，现在不影响；`entrances (node_id, server_id)` 复合外键没有以该顺序开头的索引（`node_id` 单列索引可用，待确认）。无重复索引；除 `traffic_daily_pending`（设计如此）外每表都有主键。
13. **`reaper::reap_loop` 一个循环串行做所有事**：服务器二阶段删除、rollout tick、流量暂存折叠、保留清理、月度 rollup、审计清理都在同一个 `loop`（`src/reaper.rs:60-130`）；`rollup_pass`/`audit::prune` 变慢时 5 秒节拍的删除/灰度推进随之变慢。修法：把重活拆到各自 `tokio::spawn` 的循环。
14. **删节点不写 `entrance_users_departed`**（`src/nodes.rs:789-818`，注释已承认“最多一个上报间隔的流量不计，只会少计”）：与 CLAUDE.md “撤权必须写 departed”总则不一致，只是文档里没把“删节点”列为例外。建议在 CLAUDE.md 的“撤权的尾部计费”一条里补一句。
15. **sqlx 事务靠 Drop 延迟回滚**：大量 `apply_*` 在 `?` 出错路径上直接丢弃事务，行锁要等连接归还池时的异步回滚才释放（`alerts/mod.rs:1029-1033` 的注释已踩到一次并改成显式 `rollback`）。窗口很短，但对 `FOR UPDATE` 热行（`servers`、`panel_settings`）的错误路径值得在 handler 层统一显式回滚或用包装器。
16. **依赖重复版本**：`cargo tree -d` 显示 `x509-parser 0.16`（经 webauthn-rs）与 `0.18` 并存，另有 `digest`/`base64`/`getrandom`/`const-oid` 多个大版本并存，增加二进制体积与审计面；跟踪上游升级即可。
17. **迁移编号陷阱与大表锁**：`1054–1059` 排在已合并的 `1060/1070` 之前，靠 `DO` 块兼容两种顺序（`1057`）；`1090` 在 `entrance_users` 上换主键并 `ADD CONSTRAINT … CHECK`（整表校验，持 ACCESS EXCLUSIVE），`1033` 把 `traffic_daily` 整表搬进分区表。目前没有需要保留的生产库所以无害；v1 发布前建议压成新基线，避免之后有人在已部署库上执行。
18. **备份脚本零碎**：`backup.sh` 被 SIGKILL 后遗留的 `akari-<ts>.partial` 目录不会被保留策略清理（`find` 只匹配 `akari-????????T??????Z`）；保留按目录 mtime 判断（`-mtime`），备份内容被后续检查修改时间会延长寿命。

## 已核对正确（覆盖范围）

- **收敛决策（`grpc.rs`）**：`desired_state` 在单个 REPEATABLE READ 只读快照里读版本与用户集；`SyncState::decide/delta_base/on_ack` 的条件——读票据防旧读覆盖、`pending` 去重、UserDelta 仅在 `bv.0 == desired.0` 且 `inbounds` 摘要相同、SS2022 `shrink_unsafe` 按协议号分流（≥5 删除走 delta、轮换走 Snapshot）、`remove_rebuild`、Hello 哈希验证后才建立 `acked`、失败版本退避——逐段读过，没有发现该发 Snapshot 却发 UserDelta 的路径。限速变化进 `SetDigest.limits` 而不进凭据摘要，符合文档。
- **授权对账（`entitle.rs`）**：`apply_reconcile` 的 `lock → 锁服务器(ORDER BY id) → 用户 FOR KEY SHARE → entrance_users FOR UPDATE` 顺序、撤销时 `record_departed`、重新授权时清 departed、只 bump 行真正变化的服务器；`apply_rotate_user` 的锁序与 bump；`api::apply_delete_user`（entitle 锁 → 服务器 → 用户 → 级联删 → bump）；`apply_delete_node`（bump 配置版本）。`enforce.rs` 三个 pass 的锁序与幂等；`reaper.rs` 二阶段删除的 `DUE` 谓词、墓碑与重复调用安全。
- **授权面**：用脚本枚举所有带 `AuthUser/ShopUser/PortalUser` 参数的 `pub async fn` handler，没有 `require_admin` 的 35 个全是 `/me/*`、`/me/tickets*` 一类按 `user.id` 取数的端点（`rollout.rs` 的 pause/resume/abort 经 `action()` 里的 `require_admin`）；工单所有查询带 `user_id = $2` 或走 `reject::not_found()`。
- **订阅端点（`sub/mod.rs::subscription`）**：先按 IP 限速、再按令牌哈希查 `SERVED` 用户、再按用户限速；节点查询带 `SERVER_SERVES`、入口 `enabled AND hidden_since IS NULL`、节点 `enabled AND visible`；失败一律 `reject::not_found()`，配额头只在成功路径；`choose_format` 的格式开关与“仅自研客户端”分支。DNS 自定义项（`sub/dns.rs`）校验严格。
- **Markdown 净化**（`markdown.rs`）：全部输入转义；链接仅 `https/http/mailto/` 同源（拒绝 `//host`、`javascript:`、控制字符/空白/引号/反斜杠），图片仅 https/同源；嵌套深度封顶 8；无内联属性来源。**CSV**（`csvx.rs`/`export.rs`）：`Cell::Text` 前缀 `'` 防公式，所有 `Cell::raw` 的来源都是面板自己格式化的数字/枚举/订单号，未发现把用户文本放进 `Raw`。**邮件模板 HTML 校验**（`mail/templates.rs::forbidden_html`）：禁用标签、`on*=`、脚本 URL（忽略空白/控制字符）、`@import`、`http-equiv`；替换值一律 `esc`，只有公告正文（已净化）原样放入。
- **邮件发件箱**（`mail/sender.rs`）：认领 `FOR UPDATE SKIP LOCKED` + 租约 180 s > 发送超时 60 s、结算以 `claim_token` 为条件、发送成功/死信清空正文、地址不进日志、过期的验证码不会迟发。告警通知用同一模式。
- **SQL 拼接**：全仓 199 处 `AssertSqlSafe`，抽查所有插值非常量的位置（`enforce.rs`、`rollout.rs`、`nodestat.rs`、`mail/notices.rs`、`branding.rs`、`plans.rs`、`erase.rs`），插入的都是模块常量、整数或枚举白名单；`traffic.rs` 里含 `{tz}`/`{ago}` 的在测试里。
- **安装器 `install.sh`**：SHA256SUMS 必须过 cosign（身份 = `release.yml@refs/tags/<tag>`），二进制/镜像引用/部署包都按它校验，`AKARI_COSIGN_KEY` 仍是签名校验；`fetch` 用 stdin 传 URL、`--proto =https --tlsv1.2`；PG 密码走 stdin、Valkey 配置 0600、管理员密码只走环境变量/`ask_secret`、日志 0600 且 `run` 不接受秘密参数；`become_root` 保留的环境变量不含秘密之外的内容。**节点安装脚本**：令牌与 URL 走 stdin、`-k` 只与 `--pinnedpubkey` 同时出现、二进制按 SHA-256 校验后才运行。
- **更新链（`updates.rs`/`rollout.rs`）**：manifest 原样存储、用编进面板的公钥 + 额外公钥提前验签、二进制流式入库并核对大小与 SHA-256、版本比较与 agent 一致的实现；灰度 `should_halt`、波次推进、超时判失败。
- **数据库**：在 PG 18 上依次执行全部 50 个迁移无错误；无重复索引；`users` 其余过滤查询见 P3-3。
- **前端**：portal 的 `sessionStorage` 缓存不含订阅令牌且登出清空并带“代”号防串号；portal 源码里没有后台前缀或 `/admin` 跳转；admin 有性能预算文件与双向标记检查脚本（未构建，未实测首屏数字）。

## 未覆盖 / 只抽查（后续批次可接）

`mail/transport/*` 与 `mail/diagnose.rs`；`alerts/eval.rs`/`channels.rs`（只看了投递与确认）；`blockrules.rs` 解析与编译；`rates.rs`；`trafficlog.rs` 查询函数；`dashboard.rs`；`sysstatus`；`settings.rs` 非认证部分只看了 ACME/节点运维块；`config_check.rs`；`nodestat.rs` 大部分；`nodetpl.rs`；`sub/routing*.rs`/`groups.rs`/`singbox.rs` 渲染细节；`sub/rulesets/parse.rs`/`fetch.rs`（批次 2 已覆盖 SSRF）；`install.sh` 的升级/迁移/卸载流程与 `installer-test`；`deploy/` 的 compose 与 systemd 单元；`announcements.rs`/`kb.rs` 的写路径；`erase.rs`/`cleanup.rs` 的批量删除令牌。**未做**：`desired_state` 与订阅渲染在种子化的服务器/节点数据上的 `EXPLAIN`（只在 10 万用户的 `users` 表上量了 P3-3）、`cargo clippy`/`cargo udeps`（磁盘约 7 GB，没有做完整构建）、knip/jscpd（用名字出现次数的脚本近似）、对 P2-1 的真库复现（读代码确认）。

## 方法说明

读代码为主；脚本（均在 scratchpad）：导出名出现次数（前端死导出）、`pub fn` 单次出现（Rust 死函数）、生产代码（排除 `mod tests`）的 `unwrap`/glob/中毒锁/`allow` 统计、handler 授权枚举、`pg_constraint`/`pg_index` 目录查询、portal 词典键使用检查。数字均为 2026-10-26 基线。
