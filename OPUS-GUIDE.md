# Akari 工作指导（面向 Claude Opus 5.5）

> 编写：2026-10-01（基于三仓 `main`：panel `5e69940`、agent `7e1cb79`、client `41d1bd1`）。
> 读者：接手本工作区的 Opus 5.5 会话（lead 或 worker）。本文回答四个问题：**先读什么、代码现状如何、接下来做什么、怎样做才算合格**。
> 本文是导读与裁决汇总，不替代各仓 `CLAUDE.md` 的不变量；两者冲突以各仓 `CLAUDE.md` 为准，并把差异记回本文。

---

## 0. 三十秒速览

| 项 | 现状 |
|---|---|
| 产品 | 代理控制面板（对标 xboard/sspanel），刻意**不兼容** V2Board/XrayR 协议 |
| 仓库 | `akari-panel`（Rust+React，私有，契约正本）· `akari-agent`（Go+xray-core，公开 MIT）· `akari-client`（Go+mihomo 子进程，GPL-3.0，**已暂停**） |
| 里程碑 | M0 质量基线 ✅ · M1 可生产部署 ✅ · M2 性能 ✅ · M3 运营模型 ✅ · M4 客户端 MVP ✅（随后暂停）· **下一步 M6 agent 签名自动更新 → M7 商业化** · M5 席位绑定随客户端暂缓 |
| 规模 | panel 约 32k 行（Rust 约 27k + SPA 约 3k + SQL/proto/smoke）· agent 约 5k 行 · client 约 7k 行 |
| 质量门 | panel：`make check`（fmt/clippy/tsc/auth-paths/vitest）+ `make lint test deny` + `make smoke`；agent：`make ci` + `check-proto`；client：`make ci` |
| 流程 | v3：不再做 red team；质量 = CI 必需检查 + smoke + lead 代码审查（非测试代码不得出现 `unwrap/expect/todo`）|
| 已实测 | VPS 升级演练通过；100 用户并发计费 100/100 分毫不差；浏览器验收通过（CSP 缺陷已修） |

---

## 1. 阅读顺序（按角色）

### 1.1 任何会话都先读（约 20 分钟）

1. 工作区根 `CLAUDE.md` — 三仓关系、跨仓规则、三条**不可推翻**的战略决策。
2. 本文 §2（现状评估）与 §3（路线）。
3. `SPRINT.md` 的「裁决记录」R1–R17 — 每条都是一次踩坑后的产品/技术决定，**改相关代码前先查有没有裁决**。
4. 目标仓的 `CLAUDE.md`（panel 还要读 `src/`、`migrations/`、`proto/`、`spa/` 四份子文档）。

### 1.2 按任务追加

| 任务类型 | 追加阅读 |
|---|---|
| 改控制协议 / agent | `akari-panel/proto/CLAUDE.md` → `proto/agent.proto` 全文（注释即规范）→ `akari-agent/CLAUDE.md`「须知」 |
| 改计费 / 流量 | `akari-panel/src/CLAUDE.md` 的 `traffic.rs` 行（最长的一行，逐句读）→ `migrations/CLAUDE.md` 的 `traffic_counters`/`traffic_sessions` → `docs/PERF.md`「What changed」 |
| 改授权 / 套餐 | 根 `CLAUDE.md`「授权模型（M3）」→ `src/entitle.rs`、`src/plans.rs` 头注释 → PLAN.md 决策表最后三行 |
| 改认证 / 2FA / 审计 | 根 `CLAUDE.md`「会话吊销」「管理员双因素」「审计」→ `src/auth.rs`、`src/account.rs`、`src/audit.rs` |
| 部署 / 运维 | `docs/DEPLOY.md`（含「agents BEFORE the panel」升级顺序）→ `docs/BACKUP.md` → `deploy/` |
| 性能 | `docs/PERF.md` → `bench/`（独立 crate，不进发布二进制） |
| 前端 | `spa/CLAUDE.md` → `spa/src/lib/api.ts`（手工镜像后端 View，改后端字段必须同步） |
| 客户端（恢复开发时） | `akari-client/CLAUDE.md` → `docs/DECISIONS.md` D1–D9 → `docs/PACKAGING.md` |
| 历史背景 | `REVIEW-2026-09-30.md`（接手时的缺陷清单，已基本关闭）→ `akari-panel/HANDOVER.md`（踩坑，部分陈述已过时，见 §5.3） |

### 1.3 文档地位（谁说了算）

```
各仓 CLAUDE.md（不变量，与代码同 PR 更新）
  > SPRINT.md 裁决记录（产品/技术决定，只追加）
  > ROADMAP.md / PLAN.md（计划，里程碑结束时修订）
  > 本文（导读与汇总）
  > README / HANDOVER / REVIEW（叙述与历史，允许滞后但须标注）
```

---

## 2. 架构与质量评估

（§2.1–§2.4 由 2026-10-01 的四路代码审查汇总；每条结论都能在代码中定位，未经验证的猜测不写。）

### 2.0 总体判断

- **核心不变量设计扎实且有测试背书**：幂等计费（差值在 SQL 内用 `RETURNING old/new` 算）、"写库 + bump + 通知 + 审计"同事务、全局锁序、DB 触发器守护（版本变化即通知、`session_ver`、最后管理员、`enabled ⇔ disabled_reason`）。M0–M3 把 REVIEW 中 15 项 P0/P1 全部关闭，M2 性能指标全部达标并有复现脚本。
- **主要债务是体量与重复，不是正确性**：panel 四个大文件（api/grpc/traffic/plans 合计 13k 行）、SQL 片段多处拷贝、前端覆盖的 API 面小于后端。
- **本次审查未发现 P0 缺陷，面板后端与 agent 无 P1**；P1 共 3 个：面板前端 F1（跨节点误写 inbounds）、客户端 C1（KDE 清掉用户代理）、C2（规则透传触发内核联网）。P2 以 agent 的最终计数丢失窗口（G1/G3）最值得在 M6 前修。
- **本地门禁实测**（2026-10-01，本容器）：panel `cargo fmt --check` ✅、`cargo clippy --all-targets -D warnings` ✅；agent `gofmt`/`go vet`（含 canary tag）✅；client `gofmt`/`go vet` ✅。真库测试与 smoke 需要 PG/Valkey，本容器未跑；CI 最近一次（M3 合并 + CSP 修复）为绿。

### 2.1 akari-panel 后端（Rust，约 24k 行，其中约 11k 为测试）

**架构**

- `lib.rs` 平铺模块，`main.rs` 只做 CLI 与装配（M2 拆库是为了让 `bench/` 驱动真实代码路径）。
- 请求链：`web::router`（`/{prefix}` 路由 + 常数时间 `prefix_gate` + 最外层重铸拒绝响应）→ 薄 handler → `apply_*(&mut PgConnection, &Actor, …)`。`apply_*` 是事实上的"service 层"：校验 → `entitle::lock`（触及授权表时）→ 按全局锁序取行锁 → 写 → reconcile → bump → `audit::record`。CLI 与周期 pass 复用同一批函数。
- 四条运行时主线：会话（`grpc.rs`，纯逻辑 `SyncState::decide/on_ack` 与运行时 `Session` 分离，22 个纯单测直接覆盖下发状态机——这是仓库里最好的设计决定）、通知（`notify.rs`，0007 触发器 → 专用 LISTEN 连接 → 按节点 watch 通道，无进程内捷径）、计费（`traffic.rs`，5s flush 单条 CTE 链 `FLUSH_SQL`，随后 `enforce::run_all` 四个 pass）、授权（`entitle.rs`/`plans.rs`，advisory lock → nodes → users → node_users 的 reconcile）。
- REVIEW 中"handler 含业务逻辑、无 service 层"的批评**字面上已不成立**，但"无 repo 层、SQL 散落"**仍成立**：11 个文件里用 `AssertSqlSafe(format!)` 拼 SQL；同一条 bump SQL 写了 5 遍（`api.rs:701/710/924`、`enforce.rs:40`、`entitle.rs:335`、`plans.rs:976`）；"锁节点"4 遍；"节点是否删除中"3 遍；列名与 `FromRow` 结构没有编译期校验。

**测试**：`#[test]` 87 + `#[tokio::test]` 97 = 184（traffic 52、grpc 33、api 22、config_check 12、plans 9、totp 8……）。三种夹具：`testdb::TestDb`（每测试一个 schema 跑全部迁移）、`testdb/http.rs` 路由级客户端、`FakeAgent`（进程内驱动 `session()`）与 `testdb/fake_agent.rs::PanelHarness`（真 tonic + TLS）。`api::tests::every_access_change_bumps_affected_nodes` 对 26 个 mutator 做表驱动断言（bump、每节点恰一次 NOTIFY、恰一行审计）——**新增 mutator 必须加进去**。

**非测试代码的 unwrap/expect/panic**：无 `panic!/todo!/unimplemented!`；`unwrap` 仅用于 `std::sync::Mutex::lock()`（毒化传播，可接受）；`expect` 仅两个启动点（`main.rs:137` rustls provider、`shutdown.rs:33` SIGTERM）。符合 v3 流程要求。

**P2 问题（均可解释失效场景，已在源码核实）**

| # | 问题 | 位置 | 失效场景 |
|---|---|---|---|
| B1 | Hello 时 `set_online_row` 失败后永不重试 | `grpc.rs:1391-1429`，`state.rs:190` | DB 瞬断恰在 Hello → 整个流生命周期 `status='offline'`、`online_session` 旧值；删除阶段 1 的节点会被 reaper 按"离线"提前删行，丢最终计数窗口；本会话也检测不到被取代（`grpc.rs:1702` 依赖 `marked_online`） |
| B2 | 损坏的 `credentials` JSON 被静默吞掉 | `grpc.rs:1614` `unwrap_or_default()`、`sub.rs:220` | 用户以零 inbound 进快照 → 被 `user_set` 直接删除 → 用户无感知地从节点消失；而 `api.rs:1646/1823`、`entitle.rs:267` 对同一数据返回 500——三条路径三种语义 |
| B3 | `apply_delete_user` 不取 `entitle::lock`，且在锁用户行前取节点快照 | `api.rs:903-943` | 与并发 reconcile 竞争时对未锁节点越序 bump → 偶发死锁 → 500（重试即可，无数据错误）。`plans.rs:1092` 读 role 不加锁有同类问题 |
| B4 | 错误 `let _ =` 无日志吞掉 | `grpc.rs:1213/1409/1418/1799`、`enroll.rs:536` | 1418 丢失会让 `retention_pass` 永远不退休该节点的会话（M2-5 排空证明）；536 续期限速查询失败放行且不记日志 |
| B5 | `login` 用 axum `Json` 而非 `ApiJson`，`LoginReq` 无 `deny_unknown_fields` | `api.rs:56` | 坏 body 得到 axum 的 422/415 文本响应，是 `src/CLAUDE.md` 约定的唯一例外 |
| B6 | `traffic::prune` 每 5s 全量重建索引、`snapshot` 全量遍历 | `traffic.rs:446-468, 513-567` | 200 节点 × 1 万用户 = 每 5s 两次 O(2M) 遍历 + 分配，`retain` 期间持 shard 写锁阻塞上报；PERF.md 未记录此成本 |
| B7 | 缺 CHECK 约束 | `0001:8,26` 等 | `users.role`、`nodes.status` 自由文本；计数列无 `>= 0`；`credentials` 无 `jsonb_typeof='array'`。app 层校验齐全，CLI/手写 SQL 不受保护 |
| B8 | 重复实现 | `api.rs:1971` vs `entitle.rs:292-300`（departed upsert）；`sub.rs:22-42` vs `enroll.rs:53-69`（token 生成/哈希，输出类型还不同） | 漂移面 |

**可维护性风险**

- 文件过大：`api.rs` 4215、`grpc.rs` 3219、`traffic.rs` 3129、`plans.rs` 2891；唯一超 200 行的非测试函数是 `grpc::session`（270 行），`sync_if_stale` 147 行。
- 隐藏耦合：`FLUSH_SQL` ↔ 迁移 0007/0008/0012/0013 的列 ↔ `grpc::set_online_row` 的额度语义 ↔ PG18 `RETURNING old/new`，参数按位置 `$1..$13` 绑定；`enforce::EXPIRED/SERVED/OVER_LIMIT` 以别名 `u` 的字符串嵌入 `auth.rs:305`、`api.rs:155`、`sub.rs:540`、`grpc.rs:1603`（改别名即静默失配）；`state_hash` ↔ `state_hash_vectors.json` ↔ agent。
- 仅靠约定的不变量：全局锁序无运行时断言；"不缓存 `AuthUser`"；`SetDigest` 与完整集的等价只靠一个测试。
- **新人最可能踩的坑**：新 handler 用 `Json` 而非 `ApiJson`；给 users/nodes 加列忘改 `USER_VIEW_COLS`/`create_user` 的 RETURNING/`audit::*_snapshot_sql`；在 `apply_*` 里先取行锁再取 `entitle::lock`；改 `FLUSH_SQL` 参数顺序；在 `grpc.rs` 持 std Mutex 跨 `.await`。

**测试缺口**：`enforce.rs`、`state.rs`、`shutdown.rs`、`reject.rs`、`spa.rs` 无自有测试（靠间接覆盖）；`sub.rs` 只有 3 个测试（UA 分流、vmess payload、ws path/host、clash 转义、`pad` 分桶、`subscription-userinfo` 头均缺）；`prefix_gate` 的字节同构只在 smoke 里断言。

### 2.2 akari-panel 前端、smoke、CI 与部署

**前端（React 19，约 2.5k 行，7 页 + 6 个手拷组件）**：结构清晰，`api.ts` 与后端 View 逐字段核对**无不一致**。问题按严重度：

| # | 问题 | 位置 |
|---|---|---|
| **F1（P1）** | `NodeEditor` 无 `key`，切换节点后沿用上一节点的表单状态：先 Configure A 再点 B，"Push inbounds" 会把 A 的 inbounds 写入 B | `spa/src/pages/admin-nodes.tsx:214`（需 `key={node.id}`） |
| F2 | 删除用户无二次确认（节点/套餐删除都有） | `admin-users.tsx:76-84,210-212` |
| F3 | 节点启停无 try/catch，失败无提示 | `admin-nodes.tsx:184-187` |
| F4 | 保存地址的错误显示在 inbounds 表单旁 | `admin-nodes.tsx:314,325,425` |
| F5 | 路由名存实亡：`lib/router.ts:4 usePath` 无调用者，Tab 不改 URL，刷新/后退失效 | `app.tsx:51-53` |
| F6 | 用户列表无分页（服务端默认 50、上限 200），第 51 个用户起不可见 | `admin-users.tsx:28` |
| F7 | 加载白屏（`isPending` 返回 `null`）、无空态 | `app.tsx:56` |
| F8 | 可访问性：错误文本多无 `role="alert"`；`lang="en"` 且全部文案硬编码英文；`focus-visible:ring-ring` 引用未定义的 `--color-ring` | 多处 |
| F9 | `humanBytes` 用 1024 进制却标 KB/MB/GB，输入框标 GiB | `lib/utils.ts:185`、`admin-users.tsx:279` |
| F10 | UI 覆盖面小于后端：无用户改角色/限额/到期、无 revoke-sessions、套餐编辑仅配额+组、节点组不能改名、手工分配要手填用户 UUID | — |

测试：vitest 仅 9 个 `it`（AdminPlans 3、AdminUsers 2、Portal 3、helpers 1）；Login、App 会话分流（401 → `/me/totp` → `EnrollPage`）、TwoFactor、AdminNodes（含 F1）、Audit 全无。无 ESLint/Prettier。CSP 合规（无内联脚本、无 CDN）。

**smoke.sh**：1010 行、36 段、**282 处 `FAIL:` 断言**（HANDOVER 写的 "~30 项"差一个数量级），是本项目真正的验收门。脆弱点：起 panel 后固定 `sleep 2`（无健康等待）、agent 注册 `sleep 6`；TOTP 取码可能等下一 30s 步；固定端口与 `/tmp/akari-smoke`，不可并行；`set -e` 单脚本，前段失败后段全不跑。估算 4–8 分钟（不含构建），CI 冷缓存 15–25 分钟。**未覆盖**：vmess/trojan 端到端（仅 vless）、REALITY/WS 真实握手、`/me/totp/recovery-codes`、`PATCH /users/{id}/plan` 续期与套餐到期 pass、lease 失效 fail-closed、多实例变更传播（第二实例只用于续期）、浏览器级 SPA 行为。

**CI / 发布**：panel 必需检查 = rust / spa / cargo-deny；smoke 与 docker 非必需（计划连续绿 10 次后设为必需）。缺口：无前端 lint、无 `npm audit`、无 Playwright；Rust 工具链 CI 用 `@stable` 浮动而 Dockerfile 钉 `rust:1.98-alpine`，无 `rust-toolchain.toml`；`ci.yml` 第三方 action 浮动 tag 而 `release.yml` 已按 SHA 钉死；`Makefile` 的 `make spa` 用 `npm install` 而 CI 用 `npm ci`；smoke 的 agent 默认跟 `main`，跨仓漂移会把 panel PR 打红。`release.yml`（原生双架构、SBOM、cosign keyless、provenance）设计扎实，但**尚无任何 git tag**，`deploy/.env.example` 的 `AKARI_VERSION=0.1.0` 指向不存在的镜像。

**deploy/ 与 docs/**：compose（read_only、cap_drop、internal 网络）、systemd 双单元（硬化齐全）、Caddy/nginx 只转发前缀且不记 URI、Prometheus 13 条告警的指标名已逐一核对存在。唯一未闭环：compose 场景下 Prometheus 抓取 panel metrics 的网络路径文档没写通。

### 2.3 akari-agent（Go，生产约 2.5k 行 + 测试约 2.3k 行）

**架构**（已对照 xray-core v1.260327.0 与 grpc-go v1.84.0 源码核实）

- `Run`：`ensureEnrolled` → 起 `leaseLoop`/`renewLoop` → 循环 `session`，指数退避。每条流 4 个 goroutine：单写者（所有上行经 `sendCh` 串行）、心跳、流量、读协程。F3 成立：`session` 的 defer 顺序保证任意时刻至多一个 `handleDown`；锁序 `applyMu → core.mu → gate.mu`、`applyMu → streamMu`、`applyMu → finals.mu`，未发现反序。
- `CoreManager`：`mu` 同时保护实例、`sessionID`、`applied`、`counted`，`TrafficSnapshot` 与 `Rebuild` 在同一把锁下配对 session 与计数；`liveGate` 原子指针让心跳不等 Rebuild。
- gate：在 app 列表原位替换 `dispatcher.Config` 成为唯一 Dispatcher，`Dispatch` 走自建 pipe + 后台 `inner.DispatchLink`，撤权靠 `*MemoryUser` 指针等价。
- **对 xray 内部的依赖（升级时逐条复核）**：`DefaultDispatcher.Init` 签名；`DispatchLink` 同步执行到 `handler.Dispatch`；vless/vmess/trojan validator 返回同一指针且 mux 子流保留 `User` 指针（"拒绝 mux 新子流"的前提）；只有 `AlwaysOnInboundHandler` 实现 `GetInbound`（带 `allocate.strategy=random` 的 inbound 会让 AddUser 全部失败）；`Instance.Close` 逐个 Close feature。另：`infra/conf` 的传递导入把全部 proxy/transport 都链接进了二进制，`core.go` 的 blank import 多数冗余。
- 身份/注册/续期状态机与租约实现与 proto 语义一致；崩溃窗口只损失一次重试。
- **单包是否合适**：现阶段可以。但测试大量触达私有字段，整体拆包成本高；建议只把 `gate.go` + `proto/gate.proto` 独立成 `internal/gate`（纯 xray 耦合面），M6 的更新器从第一天起放 `internal/update`。

**不变量复核**：失败 apply 不推进版本 ✅；移除/轮换先 Revoke 再 RemoveUser、最终计数先于 Ack ✅；gate 对撤权 key 断活连接 ✅；`refuseGRPCTransport` 存在且在 xray 解析后执行，面板侧 `api.rs:1497-1566` 同样拒绝 ✅。日志卫生：token、私钥、`InboundsJson` 均未进入 slog ✅。

**问题（已核实）**

| # | 级别 | 问题 | 位置 | 失效场景 |
|---|---|---|---|---|
| G1 | P2 | 最终计数在"流半死"窗口丢失 | `agent.go:303, 644-655, 199-203` | `finalQueue.confirm` 以"同一流存活一个流量周期（10s）"为送达依据，但 `sent` 只表示入队；keepalive 判死需 30s+10s，连接僵死后 10–40s 内会把只在内存通道里的最终报告删掉，流随后被判死，下一条流不再重发。违反"最终计数必须上报" |
| G2 | P2 | 本地校验失败会烧掉一次性 token | `enroll.go:359-364, 325-337` | Enroll RPC 成功后 `storeEnrolled` 失败（bootstrap `ca_pem` 与面板 CA 不一致、磁盘满）被包成 Internal 走重试；面板侧 token 已烧，第二次 PERMISSION_DENIED，进程以"token 无效"退出，掩盖真实原因 |
| G3 | P2 | 正常停机不上报最终计数 | `main.go:60-75`, `agent.go:145-176` | SIGTERM 后 `Run` 直接返回，不 `Teardown`、不发最终报告，`finalQueue` 随进程消失；每次重启丢 ≤10s 流量。**M6 自动更新会放大这一点** |
| G4 | P3 | 重连退避"稳定 >1min 重置"在睡眠后计时 | `agent.go:157-174` | 退避封顶 30s 时任何存活 >30s 的会话都重置为 1s |
| G5 | P3 | token 被拒但已有身份时每次重启再调一次 Enroll | `enroll.go:325-333` | marker 未写入；每次重启一次 PERMISSION_DENIED，可能触发面板按 IP 限速 |
| G6 | P3 | `refusedCert` 字符串匹配过宽；`core.go:377` 未检查的类型断言 | `enroll.go:487-495` | 自愈但多耗一次签发；风格不一致 |

**测试**：27 个测试函数（race 套件 25 + canary 2）+ 7 个基准；只需 loopback TCP，无需 root/外网。覆盖好：delta 决策表、remove_mode、F3、租约、注册/续期、gate 两条分发路径。**缺口**：vmess 零测试（无单测无 canary）；mux 子流拒绝无真实 mux 客户端 canary；重连退避、续期交替路径、`!Running()` → BASE_MISMATCH、delta 期间流死、`finalQueue.confirm` 丢弃均无测试。

**工程**：`ci.yml` 的 action 未钉 SHA（release.yml 已钉）；无 arm64 测试；`go.mod` 只有 `go 1.27` 没有 `toolchain` 行，日后用新补丁版重建无法复现 Release 的 SHA256SUMS——**这是 M6 信任链的实质缺口**；release 未跑 `make vulncheck`。`THIRD-PARTY-NOTICES.md` 缺 `golang.org/x/sys`，且二进制经 xray 链接了 `sagernet/sing*`（模块 LICENSE 为 GPL 样板）与 gvisor，MIT 仓库分发该静态二进制的许可证兼容性需要判断并声明；文件里"panel 为私有仓库"的表述与根文档不一致。

### 2.4 akari-client（Go，约 6.9k 行，M4 MVP，已暂停）

**架构**：`internal/core` 是唯一懂 mihomo 的包——全仓 grep 核实成立（`check-boundary` 守链接层，键级靠约定）。Supervisor 单 goroutine 期望状态环 + fake clock 可测；D2 白名单逐键核对：`proxies` 每个代理 map **原样透传**、`proxy-groups` 只剔除 `use/include-all*/filter`、`rules` **逐条原样**。设置页安全（Host 精确比对、同源、CSP `default-src 'none'`、无文件服务，无路径穿越面）；进程生命周期（job object / Pdeathsig / pid 文件 / 环境剥离）完整，macOS 无父死绑定（D1 已承认）。**日志卫生结论：订阅 URL/token 不会到达日志**（`fetch.go:100-106` 剥 `*url.Error`，有测试）。`go vet`、`go test -race` 全绿。

**问题（已核实）**

| # | 级别 | 问题 | 位置 | 失效场景 |
|---|---|---|---|---|
| C1 | **P1** | KDE 下 `Disable` 不判断"是否指向我们" | `sysproxy_linux.go:31-47`（只对 GNOME 读回过滤） + `app.go:159-164` | `SystemProxy=false` 时每次启动都调 `Disable`：KDE 用户手配的公司代理在启动 Akari 时被重置。违反 D8 |
| C2 | **P1** | `rules` 原样透传，`GEOIP/GEOSITE` 会让内核联网下载 geodata | `config.go:137` | `-t` 校验与运行时各下载一次；离线时 `-t` 超时 30s → 合法 profile 被拒；被攻陷的面板可令客户端访问外部 URL。当前面板只发 `MATCH,PROXY`，是潜在故障，但与 D2 安全声明直接冲突 |
| C3 | P2 | 组级 `url/interval` 透传 | `config.go:99-105` | 恶意面板发一个 `url-test` 组即可让客户端每 5 分钟访问任意 URL |
| C4 | P2 | `StdoutPipe` 后并发 `cmd.Wait()`，内核 fatal 行可能未被读到 | `engine.go:300-317` | 启动失败只剩"kernel exited during startup" |
| C5 | P2 | `Engine.Start` 持 `e.mu` 最长 25s，`Status()` 需同一把锁 | `engine.go:320-328, 459-466` | 托盘与设置页在每次退避重启时卡住 |
| C6 | P2 | 设置页秘密路径出现在 `xdg-open` 命令行 | `open.go:596-617` | 多用户 Linux 机上其他本地用户可读 `/proc/*/cmdline` 后 POST `login` 换掉订阅 |
| C7 | P2 | "恢复系统代理"实为"关闭"，不还原旧值 | `sysproxy_windows.go:432-464` 等 | 用户原有代理配置在一次 Enable 后丢失；D8 用词需改 |
| C8 | P3 | `heal` 在 netwatch goroutine 上同步执行约 28s，距 `SleepThreshold` 35s 仅 2–3s 余量 | `app.go:545-575`, `netwatch.go:708-745` | 越界被判"resumed"再次 heal → 循环 |

**测试**：54 个（app 7、subscription 9、core 8 其中 3 个需真实内核、supervisor 6、sysproxy 6……）。Windows/macOS 代码零运行验证：CI 只在 ubuntu 跑测试，Windows 仅交叉编译，macOS 只构建。

**与面板契约的耦合**：面板**不发 `ETag`**（客户端的 304 路径生产中永不触发，每次全量下载 ≥8KiB 填充体）；面板**完全不读 `X-Akari-Device`**；面板只输出 proxies + `PROXY` select + `MATCH,PROXY`，与 `core.PreferredGroup` 耦合；via-core 回退让面板看到出口节点 IP，多用户共享节点时会撞 per-IP 限流。

**首个公开发布的阻塞项**：Windows 手工测试矩阵从未执行；安装器与 Authenticode/Apple 签名；GPL §6 对应源码归档与书面要约；macOS `networksetup` 是否需提权未验证；C2 的 geodata 决策；D1 建议的法务评审。

---

## 3. 后续开发路线

### 3.1 当前位置与已定顺序

```
M0 质量基线 ✅ → M1 可生产部署 ✅ → M2 性能 ✅ → M3 运营模型 ✅ → M4 客户端 MVP ✅(暂停)
                                                                    ↓
                         [现在] 收尾与加固（§3.2） → M6 agent 签名自动更新（§3.3） → M7 商业化（§3.4）
                                                                    ↓
                         客户端恢复 → M5 席位绑定 + 订阅退役（§3.5，时间未定，需用户决定）
```

用户已决定（ROADMAP 2026-10-02 批注、R17）：客户端暂停，先把面板与 agent 做到生产级，再 M6、M7。M5 依赖客户端，随之暂缓；过渡期订阅三格式继续保留。**不要自行调整这个顺序。**

### 3.2 收尾与加固 sprint（建议作为 M6 开工前的一个 T2 sprint，Sonnet 可做大半）

按价值/风险排序；S/M/L 为估算。来源：§2 的审查结论 + SPRINT「UI 打磨待办」。

**面板后端（T1 项标 ★）**

| # | 任务 | 估算 |
|---|---|---|
| ★A1 | 统一 `credentials` 解析语义（B2）：`grpc.rs:1614`、`sub.rs:220` 改为记 error 并跳过，与 api/entitle 一致；加真库测试 | S |
| ★A2 | `set_online_row` 失败重试（B1）：在下一次 `sync_if_stale`/对账 tick 重试，或让 `persist_online` 刷新本实例 agents 中 `online_session IS NULL` 的行 | S |
| A3 | 给 `grpc.rs:1213/1409/1418/1799`、`enroll.rs:536` 的吞错加 `warn!`（B4） | S |
| A4 | 迁移 0021：`users.role`/`nodes.status` CHECK、计数列 `>= 0`、`credentials` 为数组（B7）。纯追加 | S |
| A5 | `login` 改用 `ApiJson` + `deny_unknown_fields`（B5）；注意 SPA `check-auth-paths.mjs` 与 smoke 的 `/auth/login` 断言 | S |
| ★A6 | `apply_delete_user` 与 `apply_set_user_plan` 先取 `entitle::lock`（B3） | M |
| A7 | 收敛重复 SQL：`lock_nodes`/`bump_nodes`/`refuse_if_deleting`/`record_departed` 抽到一处；`EXPIRED/SERVED/OVER_LIMIT` 改为接受别名参数（B8 与隐藏耦合） | M |
| A8 | 把 `#[cfg(test)] mod tests` 拆到 `src/<mod>/tests.rs`（api/grpc/traffic/plans 各减半），不改逻辑 | M |
| ★A9 | `traffic::prune` 增量化（B6）：`rebuild_index` 降频或按不一致触发，`snapshot` 只遍历 dirty 会话；先在 `make bench` 200×10k 上量化现状并记入 PERF.md | M |
| A10 | 补 `sub.rs` 三格式快照测试与 `prefix_gate` 字节同构单测；更新 `src/CLAUDE.md:49` | M |

**面板前端**

| # | 任务 | 估算 |
|---|---|---|
| **A11** | 修 F1：`NodeEditor` 加 `key={node.id}`，补 vitest 用例（**优先，数据误写**） | S |
| A12 | F2–F4：删除用户二次确认（SPRINT 待办也列了）、节点启停错误处理、错误归属 | S |
| A13 | 视图状态落 URL（用现成 `usePath/navigate`，F5）；用户列表分页（F6）；加载/空态（F7） | M |
| A14 | ESLint（typescript-eslint + react-hooks + jsx-a11y）+ Prettier 接入 `make check` 与 CI | S |
| A15 | 前端测试 9 → 25+：Login、App 会话分流、AdminNodes、TwoFactorCard | M |
| A16 | SPRINT「UI 打磨待办」其余项：用户编辑上限/到期、吊销会话按钮、节点表租约剩余/region、2FA 二维码本地生成、375px header 溢出、套餐取消说明、`humanBytes` 单位（F9） | L |
| A17 | Playwright 端到端（真实 CSP，跑在 smoke 之后复用同一 panel）：登录 → 2FA enroll → 建节点下载 bootstrap 三条路径 | L |

**工程**

| # | 任务 | 估算 |
|---|---|---|
| A18 | smoke 连续绿后设为必需检查（S4-4 遗留）；`sleep 2/6` 改轮询 `/healthz` 与 agent 日志 | S |
| A19 | `rust-toolchain.toml` 与 Dockerfile `rust:1.98` 对齐；`ci.yml` action 按 SHA 钉死（与 release.yml 一致）；`make spa` 改 `npm ci`；CI 加 `npm audit --audit-level=high` | S |
| A20 | 打第一个 tag（`v0.1.0`），验证 release.yml 全链路（镜像、SBOM、cosign），使 `deploy/.env.example` 指向存在的镜像 | S |
| A21 | smoke 补：vmess/trojan 端到端、`/me/totp/recovery-codes`、套餐到期 pass、lease 失效 fail-closed | L |
| A22 | 文档去漂移（§5.3 全表） | M |
| A23 | 在真实 VPS 上按 DEPLOY.md 计时部署（M1 唯一未完成验收，需用户提供 VPS） | — |

**agent（M6 的前置，T1 项标 ★）**

| # | 任务 | 估算 |
|---|---|---|
| ★A24 | `finalQueue.confirm` 的确认窗口 ≥ keepalive 判死时间（30s+10s+余量），或在写者 goroutine 标记真正 `Send` 成功（G1） | S |
| A25 | `storeEnrolled` 失败视为永久错误并报真实原因；token 被拒也写 marker（G2、G5） | S |
| A26 | 退避重置计时移到睡眠前（G4）；`core.go:377` 改带 ok 断言 | S |
| A27 | `go.mod` 加 `toolchain go1.27.x`；`ci.yml` 钉 SHA；release 加 `make vulncheck` | S |
| A28 | 补 vmess 单测 + canary、mux canary、退避测试、`!Running()` 与 delta-F3 分支 | M |
| ★A29 | 优雅停机（G3）：SIGTERM 时 `Teardown` → 最终计数入队 → 带超时尽力 flush；`finalQueue` 持久化到 state dir（重启后重发）。**M6 依赖此项** | M |
| A30 | 拆 `internal/gate`（含 gate.proto），把 xray 内部依赖清单写进该包文档 | M |
| A31 | `THIRD-PARTY-NOTICES.md` 补 `x/sys` 与传递 GPL 组件并做许可证判断；修"panel 为私有仓库"表述 | S |

### 3.3 M6 · agent 签名自动更新（T1，Opus）

目标（ROADMAP）：签名清单分发、按节点百分比灰度、校验失败拒绝替换、失败回滚。

设计要点（接手时的约束，非最终设计；开工前先写设计稿进 SPRINT 并取得裁决）：

1. **信任锚**：签名密钥独立于 CA 与 jwt.key（新 `data/release.key` 或离线密钥 + 面板只存公钥）；agent 内置公钥（随二进制发布，轮换需要一次手动升级）。清单含版本、各架构 sha256、最低面板协议、发布时间；agent 校验签名 → 校验 sha256 → 原子替换 → `execve` 自替换或由 systemd 重启。
2. **分发通道**：复用现有 mTLS 流（新 `PanelDown.update` 消息，protocol 3），二进制本体走面板的一个带前缀的 HTTPS 端点或外部对象存储 URL（清单内给出），**不要**把几十 MB 二进制塞进 gRPC 流。
3. **灰度**：`nodes.update_channel`/`update_percent` 或按 node id 哈希分桶；面板侧 `releases` 表记录清单、`node_updates` 记录每节点状态（offered/downloaded/verified/applied/failed/rolled_back）；管理 API + SPA 节点页显示进度（这是 SPRINT 把 UI 打磨推迟到 M6 后的原因——避免与节点页冲突）。
4. **回滚**：新二进制启动后在 N 秒内未能完成 Hello + 首次 Ack → 换回旧二进制（保留 `agent.prev`）；面板看到 `agent_version` 回退即标记 failed 并停止该百分比的继续推进。
5. **安全不变量**：校验失败绝不替换；下载走面板 CA 或系统 CA 验证的 TLS；清单重放防护（版本单调 + 过期时间）；私钥不进仓库、不进 CI 日志。
6. **验收**：fake-agent 测试覆盖签名错误/哈希错误/版本回退三类拒绝；smoke 加一段"旧 agent 二进制 → 面板发布 → 自替换 → 新版本 Hello"；`THIRD-PARTY-NOTICES`/release.yml 增加清单签名步骤。

**agent 侧具体触点**（审查结论）：

- proto（先改面板正本再 sync）：`PanelDown` 新增 `UpdateOffer`（版本、制品 URL/长度/SHA-256、签名、灰度 cohort），`AgentUp` 新增 `UpdateStatus`（下载/校验/切换/回滚结果）；Hello 已带 `agent_version`，灰度判定在面板侧完成。
- `agent.go` `handleDown` 新 case；下载走面板 CA 校验的 HTTPS；校验用离线 ed25519/minisign（比嵌入 sigstore TUF 根简单得多）；校验失败拒绝替换。
- systemd 单元（`akari-panel/deploy/systemd/akari-agent.service`）：`ProtectSystem=strict` + `DynamicUser` + `MemoryDenyWriteExecute` 下进程不能写 `/usr/local/bin`；需改为 `ExecStart` 指向 StateDirectory 中的受管副本并 `Restart=always`，或显式 `ReadWritePaths`。
- **硬依赖**：A29（不先持久化最终计数，每次灰度都丢流量账）与 A27（不钉工具链，运维无法独立复现制品哈希来交叉验证签名对象）。

### 3.4 M7 · 商业化（T1 + T2 混合）

建立在 M3 套餐模型上：订单、支付（Stripe + 易支付自研签名回调）、优惠券、邀请佣金、工单、邮件通知、对账脚本。开工前的前置条件：

- A7（SQL 收敛）与 A8（测试拆文件）先做，否则 `api.rs`/`plans.rs` 会突破 5k 行。
- 决定是否引入 service/repo 分层（REVIEW P2 "进入商业化前应当先分层"）；建议最小方案：新业务放进 `src/billing/` 子模块，不动现有热路径。
- 支付回调是新的公网入口：必须走同一个 `/{prefix}` 闸门与 `reject::not_found()`；回调签名验证失败也要字节同构 404。
- 审计、幂等（支付回调重放）、多实例（回调打到任一实例）三条不变量沿用现有模式。

### 3.5 客户端恢复与 M5（时间未定）

恢复时先读 `akari-client/docs/PACKAGING.md`（M4 剩余项全在那里）。M5 两侧改动：面板新增 `devices` 表与 `/client/v1/*`（注册/心跳/解绑，与订阅同门禁），`users.seat_limit`；客户端把 `X-Akari-Device` 升级为服务端签发的设备凭据；Clash 只对已绑定设备下发；订阅退役按 PLAN Phase 3 的公告期执行。

恢复开发时的第一个 sprint（按优先级，来源 §2.4）：

| # | 任务 | 估算 |
|---|---|---|
| K1 | 修 KDE `Disable` 过滤（C1）+ `fakeRunner` 测试 | S |
| K2 | `BuildConfig` 规则类型白名单（拒绝 `GEOIP/GEOSITE/RULE-SET/…`）与组级 `url/interval/lazy` 清洗（C2、C3）；更新 D2 文字。或随包预置 geodata 并把 geox-url 指向面板（M） | S |
| K3 | `pump`/`Wait` 顺序修正（C4）；清理过时注释（`main.go:1-3`、`supervisor.go:5-9`）与从未返回的 `ErrNotRunning` | S |
| K4 | `Status()` 改读缓存快照（C5）；`heal` 异步化（C8） | M |
| K5 | 系统代理快照/还原（C7）或改文档用词；设置页改一次性启动 nonce 换 cookie（C6） | M |
| K6 | CI 增加 windows-latest / macos-latest `go test`（含内核构建） | M |
| K7 | 先写 M5 契约文档（错误语义、凭据格式、`/sub` 去留、面板加 `ETag`）再动代码 | M |
| K8 | 打包与签名：NSIS/WiX、`.app` + notarize、AppImage、`release.yml`（`docs/PACKAGING.md` 全部未勾选） | L |

---

## 4. 工作方式（Opus 5.5 会话的操作规程）

### 4.1 会话角色

- **Lead**（主会话）：排期、裁决、合并、向用户汇报。只在里程碑完成、需要用户决策（授权、付费、范围）、阻塞、发现严重安全问题时汇报。
- **Worker**（子会话 / subagent）：在功能分支上实现一个 sprint 项；brief 必须附带 §4.4 的常见缺陷清单。
- 上下文纪律：每个 sprint 用全新 worker；上下文超过约 20 万 token 的会话不再复用（R11 的教训：重放开销是撞限额的主因）。
- 模型分级：设计型与 T1 高风险工作用 Opus；T2 机械性工作（CI、文档、脚手架）与修复验证可用 Sonnet。

### 4.2 一次改动的标准流程

```
1. 读：根 CLAUDE.md → 目标仓 CLAUDE.md → SPRINT.md 裁决 → 相关模块的头注释
2. 分支：fix/* 或 feat/*（四个仓的 main 都要求 PR，禁止强推）
3. 改契约时的硬顺序：
   akari-panel/proto/agent.proto → cargo build（protox 重生成）
   → make -C ../akari-agent sync-proto → 两侧一起改代码
   → make -C ../akari-agent check-proto → make smoke
   改 state hash 算法：先改 proto/testdata/gen_vectors.py，重生成 state_hash_vectors.json，同步到 agent/proto/
4. 实现 + 测试 + 更新对应 CLAUDE.md（同一 PR）
5. 门禁（全部本地跑绿再推）：
   panel : make check && make lint test deny && make smoke        # 需 make dev-up（PG 5432 / Valkey 6379）
   agent : make ci && make check-proto                            # ci = fmt-check vet test build vulncheck
   client: make ci                                                # 含真实内核集成测试
6. 自审：非测试代码无 unwrap/expect/todo/panic；改动范围不蔓延；文档已同步；新 API 在 smoke.sh 有断言
7. PR → CI 必需检查绿 → lead 审查 → 合并 → 把裁决/结论追加到 SPRINT.md
```

### 4.3 风险分级（决定走多严）

| 级别 | 范围 | 要求 |
|---|---|---|
| **T1** | 计费、控制协议、并发/收敛、认证鉴权、证书、安全边界、授权（entitle/plans） | Opus 实现；brief 附 §4.4；单测 + 真库测试 + fake-agent 集成测试；smoke 断言；lead 逐行审 |
| **T2** | 运维、CI、部署、API 小改、测试基础设施、前端 | 实现 → lead 审 diff + 跑门禁 → 合并 |
| **T3** | 文档、注释、配置默认值 | lead 直接改或随其他 PR 带上 |

### 4.4 常见缺陷清单（每个 T1 brief 必附；源自 R1–R14）

1. 提交前先通知（通知必须由 DB 触发器在同一事务内发出，handler 提交后什么都不用做）。
2. 旧读覆盖新写（读 DB 前取票据；同会话读与下发串行化）。
3. 锁序反转（全局：`entitle::lock` → nodes `ORDER BY id FOR UPDATE` → users → node_users）。
4. 被攻陷节点导致内存/计费无上界（成员资格校验、条目上限、每节点索引、不得全表扫描）。
5. 计费多计（只允许少计；差值只能在 SQL 里用 `RETURNING old/new` 算，内存不存 pending）。
6. 拒绝响应不同构（一切拒绝走 `reject::not_found()`：404、空 body、无安全头、无 `X-Request-Id`）。
7. 删除/禁用必须在所有路径生效（API、CLI、到期扫描、reconcile、手写 SQL——靠触发器兜底）。
8. 多实例下的进程内假设（防重放、限速、在线状态都走 DB/Valkey，不得用进程内缓存）。
9. 时间戳倒退（`now()` 是事务开始时间；到期判断只用 DB 时钟）。
10. NULL 让上限失效；取整超过上限（GCRA 逐行 floor）。
11. 秘密入日志（前缀、订阅 token、enrollment token、私钥、TOTP 秘密一律不进日志/trace/指标标签；路径用 `web::redacted_path`）。
12. 失败被当成收敛（agent 应用失败不前移持有版本；Ack `ok=false` 不算收敛）。

### 4.5 环境约束（本机）

- 开发环境（PG/Valkey/8080/8443）同一时刻只归一方使用，由 lead 调度；并行 worker 用 git worktree（`wt-*`，已 gitignore）但**不能同时跑 smoke**。
- 本机 WSL 有 HTTP_PROXY：curl 本地服务必须 `--noproxy '*'`；`pkill -f` 会自杀（smoke 已用锚定的完整命令行模式）。
- `akari-panel/data/` 含 CA 私钥、jwt.key、totp.key：不可提交、不可外发；`make smoke` 会删除它（仅限开发机）。
- 真库测试需 `make dev-up`；`AKARI_SKIP_DB_TESTS=1` 只在本地跳过，CI 必跑。advisory lock `akari.entitlement` 是全库一把，测试里持有它的事务要尽快结束。
- 兄弟检出是硬约定：`akari-panel/smoke.sh` 与 `akari-agent/Makefile` 写死 `../akari-agent` / `../akari-panel`。
- 提交与推送仅在用户要求时进行；远程 `git@github.com:akari-projectX/<repo>.git`。

### 4.6 何时必须停下来问用户

- 任何会推翻根 `CLAUDE.md` 三条战略决策或 SPRINT 裁决的方案。
- 需要付费/外部资源（VPS、证书、支付渠道、Apple/Windows 签名证书）。
- 范围变化：新里程碑开工顺序（M6 → M7 已定；M5/客户端恢复时间未定）。
- 发现严重安全问题（先修 P0，再汇报，不等排期）。
- 需要删除生产数据或改变计费语义（哪怕是"少计"方向）。

---

## 5. 文档引导：怎样维护这套文档

### 5.1 文档分工（谁写什么）

| 文档 | 内容 | 何时更新 | 谁 |
|---|---|---|---|
| 各仓 `CLAUDE.md` 及子文档 | **不变量**、模块地图、命令、"改动须知" | 与代码同一 PR；新模块/新配置项/新表/新契约字段必须落一行 | worker（lead 审） |
| `SPRINT.md` | 当前看板 + 裁决记录（只追加，编号 R18 起） | 每次裁决、每个 sprint 合并 | lead |
| `ROADMAP.md` | 里程碑与出口标准 | 里程碑结束时修订一次；§3 的表应与本文 §3 一致 | lead |
| `akari-panel/PLAN.md` | 战略与决策表 | 只在产品决定变化时 | lead（用户确认） |
| `README.md`（各仓） | 对外说明、API 表、设计说明 | API/行为变化时 | worker |
| `docs/DEPLOY.md`、`BACKUP.md`、`PERF.md` | 运维与度量 | 部署步骤/数字变化时 | worker |
| `HANDOVER.md`、`REVIEW-2026-09-30.md` | 历史 | 只加"更正"标注，不改写原文 | lead |
| 本文 `OPUS-GUIDE.md` | 导读与评估汇总 | 每个里程碑结束或评估结论变化时 | lead |

### 5.2 写 CLAUDE.md 的规则

- 写**不变量和改动须知**，不写流水账：读者是下一个改这段代码的人，要的是"动这里之前必须知道什么"。
- 每条可验证：引用测试名（如 `api::tests::every_access_change_bumps_affected_nodes`）、迁移号、配置键、裁决编号。
- 一个事实只写一处，其它地方引用；根 `CLAUDE.md` 讲跨模块不变量，`src/CLAUDE.md` 讲模块内细节。
- 过时陈述加 `**更正（日期）**` 标注，不删历史（REVIEW/HANDOVER/PLAN 已这样做）。
- 中文为主；代码标识符、命令、SQLSTATE、协议名保持原文。

### 5.3 已知文档漂移（接手时发现，建议随下一个文档 PR 一并修）

| 文件:行 | 过时陈述 | 现状 |
|---|---|---|
| 根 `CLAUDE.md` 表格 | "`akari-client/` Go（未开工）" | M4 MVP 已合并（GPL-3.0，mihomo 子进程），随后暂停 |
| 根 `GITHUB.md:11`、`PLAN.md:32,104,140`、`HANDOVER.md:113` | "mihomo = MIT，可闭源内嵌" | mihomo 为 **GPL-3.0**；akari-client 已改 GPL-3.0；采用子进程而非库内嵌（`akari-client/docs/DECISIONS.md` D1） |
| `HANDOVER.md:53` | `nodeops.rs` "bootstrap 文件含 agent 私钥（v1，Phase 4 改 CSR）" | M1-8/M1c：CSR + 一次性 token，文件不含私钥（`smoke.sh:61` 断言） |
| `HANDOVER.md:30-31` | "agent CSR 注册 + 签名自动更新 ⬜" | CSR 已完成；仅签名自动更新（M6）未做 |
| `HANDOVER.md:61` | `config.go` "身份三件套 PEM" | v2 = panel_addr / server_name / ca_pem / enrollment_token（v1 仍兼容） |
| `HANDOVER.md:34` | "`make smoke` 全绿（~30 项断言）" | 282 处 FAIL 断言、36 段 |
| `HANDOVER.md:41`、`:78-90` | CLI 只有 serve/info/admin add/node；API 速查 11 行 | 另有 `config check`、`secrets rotate-*`、`admin passwd/reset-2fa`、`node enroll-token/delete`；API 见 `README.md:161-190`（28 行） |
| `HANDOVER.md:47,123` | "Cookie Secure 回环自动关" | `web.cookie_secure` 显式配置，默认 true |
| `HANDOVER.md:65-66`、`:71-74` | 页面仅 4 个；数据模型 4 张表 | 另有 admin-plans/audit/two-factor；14 个迁移、15+ 张表（见 `migrations/CLAUDE.md`） |
| `HANDOVER.md:97`、`README.md:145` | "`make check` = fmt + clippy + tsc" | 还跑 `check-auth-paths.mjs` 与 `vitest run` |
| `HANDOVER.md:120` | "`[o]nyx` 括号技巧" | 项目已更名 akari；smoke 用锚定完整命令行 |
| `HANDOVER.md:128` | "未压测；未做多面板实例" | PERF.md 全部达标；DEPLOY.md §「Several panel instances」 |
| `PLAN.md:83` | "smoke 作为可手动触发的 workflow" | PR/push/nightly 自动跑 |
| `PLAN.md:88-94`、`:116-119`、`:126-129` | Phase 1 条目、Phase 4 CSR、后置池（Prometheus/备份/多实例）未勾 | 均已完成 |
| `PLAN.md:96-104` | Phase 2 客户端为"主线"、库内嵌"推荐" | 客户端已暂停；子进程方案已定 |
| `PLAN.md:50` | "client CI = 待建" | `akari-client/.github/workflows/ci.yml` 已存在 |
| `README.md:92`、`:247-249` | "Not yet: agent CSR enrollment"、"CSR enrollment is the planned upgrade" | 与同文件 54-60 行自相矛盾，CSR 已做 |
| `README.md:273-274` | "`Hello.protocol_version` (current: 1)" | 当前 agent 为 2；`MIN_AGENT_PROTOCOL=1` 是最低值 |
| `README.md:117`、`:470-472`、`:459` | SPA 页面列表；"Next: repo split → client MVP"；"authoritative plan lives in PLAN.md" | 另有 Plans/Audit/Account；拆分与 MVP 已完成；权威计划是 `ROADMAP.md`/`SPRINT.md` |
| `spa/CLAUDE.md:20` | CSP "`default-src 'self'; style-src 'unsafe-inline'`" | 代码为 `style-src 'self' 'unsafe-inline'`（`src/web.rs:177`，提交 5e69940） |
| `src/CLAUDE.md:49` | "sub 渲染、prefix gate 仍缺测试" | `sub.rs` 有 3 个测试（仅 REALITY fingerprint）；prefix gate 由 http 夹具与 smoke 间接覆盖；内容正确性测试确实仍缺 |
| `ROADMAP.md §3` 里程碑表 | M4 W10–W15、M5 W15–W17 仍按周排 | M4 已合并并暂停、M5 暂缓；下一步 M6 → M7（见本文 §3） |
