# Phase 0.5 进度看板

> Lead 维护。详细计划与里程碑见 `ROADMAP.md`（M0–M7），本看板只跟踪当前 sprint。缺陷编号对应 `REVIEW-2026-09-30.md`，范围见 `akari-panel/PLAN.md` Phase 0.5。
> 流程：Worker 在功能分支上实现 → Red team 先独立出攻击方案（A），再实测攻击 diff（B）→ Lead 裁决 → 修正 → 合并 main。
> 同一时间最多 2 个 subagent。开发环境（PG/Valkey/端口 8080、8443）同一时刻只能一方使用。

## Sprint 1（2026-09-30 开始）· 分支 `akari-panel:fix/p0-sprint1`

| # | 项 | 负责 | 状态 |
|---|---|---|---|
| P0-1 | SPA 登录/登出路径 | worker | ✅ ae47845 |
| P0-2 | 计费会话错位（重连/重启重复计费）— 已并入 P0-6 的 Hello/session 部分，跨仓 | worker | 面板侧 ✅ 0759c3c；agent/proto 侧已获用户授权，进行中（worktree：wt-panel / wt-agent） |
| P1-10 | flush 失败丢增量 | worker | ✅ 0759c3c（SQL 幂等） |
| — | 攻击方案 A（只读，独立推导） | red team | ✅ 完成 |
| — | 攻击 B（实测 diff） | red team | ✅ MERGE-WITH-FIXES（H1/H2/M1/M3 必修） |
| — | Sprint 1b 实现（R1 + R2 + SEC-1） | worker | ✅ panel fd99556 / agent 709b4f5；smoke ⛔ 等用户执行 |
| — | 终验 Phase C | red team | ✅ MERGE |
| — | 合并 | lead | ✅ panel PR#1 → main 2ca0dc3；agent PR#1 → main 2863bbe（rebase 合并） |

## Lead 待办
- Sprint 3b 合并后、下一轮 worker 启动前：提醒用户升级 WSL 3.0.1；升级后重跑 agent 测试和 smoke。

## 新增（仓库全部公开后，2026-09-30）
- **SEC-1 伪装站可被指纹识别** → 按用户决定（2026-09-30）**删除伪装站**：所有拒绝统一为空 body 的 404，不带安全头，字节同构；提前到 Sprint 1b 由 worker 执行。原问题：：`decoy.html` 已公开，扫描器可以用它的字节哈希识别出所有 Akari 部署，"零指纹"的前提不再成立。改为每个安装使用运营方提供或随机生成的伪装内容，404 同字节的约束不变。优先级 P0，放进 Sprint 2。
- REVIEW 中未修复缺陷的细节已公开；P0 修复要尽快合并。

## Sprint 2 ✅ 已合并（2026-09-30）· panel PR#3 → main 0adc14c；agent PR#2 → main 2b3e7e3
S2-1 状态变更与版本 bump 同事务 · S2-2 禁用节点 = 下发空状态（不再在连接时拒绝）· S2-3 到期执行（新迁移加幂等标记）· S2-4 assign 校验与事务 · S2-5 孤儿凭据 + Ack 失败时记录 last_error · S2-6 PATCH 语义 · S2-7 离线状态按代数判断写入。
- 追加 F1（Phase C，中危）：节点可伪造 session 给任意用户记账 → 只对 node_users 中存在的 (node,user) 对计费、限制每节点活跃 session 数及新建速率、对单次增量做合理性上限。
- 裁决 R3：禁用节点的期望状态定义为"无 inbound、无用户"，连接照常接受并推送空快照。原因：当前的连接期拒绝会让 agent 一直带着旧配置运行。

## Sprint 3 · 3a ✅ 已合并（panel PR#4 → a0399e0，agent PR#3 → 482b535）；3b 进行中（分支 `feat/s3b-notify`）
- **3a 协议与 agent**
  - F3：新流开始前先 join 旧的读协程。
  - UserDelta：带 base/target 版本，base 不匹配时拒绝并回退到 Snapshot，重复下发按无操作处理；采用 REPLACE 语义；移除用户前先上报其最终计数；核实 xray 重新添加用户后计数器是否重置。
  - Hello 和 Ack 携带用户集的内容哈希，用于检测分歧。
  - `Hello.protocol_version`：版本过低时下发空配置并在节点状态中标出，不拒绝连接。
  - 失联租约：面板读到期望状态后才下发 LeaseGrant；使用 CLOCK_BOOTTIME；默认 24h，最低 1h；租约到期时拆除 xray 并把持有版本重置为 (0,0)，保留最终计数；DB 不可用时不续约；心跳在 50%/90% 时预警。
- **3b 面板**
  - pg_notify：通知按节点定向，在事务内发出；监听连接重连后唤醒全部本地会话；监控通知队列使用率；文档注明不支持 PgBouncer 的事务模式。
  - 删除节点：先推送空状态再关闭流；证书墓碑表在身份识别时最先检查；删除前先 flush；清理 Valkey 和内存残留；保留计费行。
  - L4：按节点汇总的流量上限，时间差取自 DB 的 traffic_flushed_at，超限时按用户比例缩放。
  - 服务端证书的 EKU 收紧为 ServerAuth。

## Sprint 4（计划）
P1-7 ~ P1-15 与 CI、文档去漂移。

## 裁决记录
- **R1（2026-09-30）** 采纳 red team 的结论：首次 Snapshot 后 agent 不重发 Hello，导致记账 session 永久错位，只要重连就会重复计费。只改面板的修复被否决。新方案：`TrafficReport.session_id` 由 CoreManager 在 Rebuild 时原子生成；面板在 SQL 内用 PG18 `RETURNING OLD/NEW` 算 delta（同一事务、按行加锁），内存中不保留 pending；#10 的验收改为"下次上报能完整补回"。另外采纳：u64 溢出防护（列为 P1 安全项）、登出失败必须对用户可见、REVIEW 行号勘误。#12 SIGTERM 降级为运维项。
- **R2（2026-09-30）** 采纳 Phase B 的结论。H1：乱序的旧值会触发新 epoch 并重复计费，而且每翻转一次就再多计一次 → **整个删除 epoch 机制**（生产环境没有旧 agent，不留兼容）；缺 session_id 的上报直接丢弃；会话内出现更低的值忽略即可（由 GREATEST 保底）。H2：启动时强制检查 PG ≥ 18（否则会静默地计 0）。M1：按 SQLSTATE 区分瞬时错误与数据错误。M2：批量写入前排序，避免死锁。M3：登出后界面停在原页，改用 removeQueries + resetQueries。SEC-1 追加：405 响应会暴露前缀是否正确，所有不匹配一律返回空 404。L1：traffic_counters 的行是计费基线，清理任务只能删除已确认结束的会话。合并目标改为 `fix/p0-sprint1b`，它包含 1 的全部内容。
- **R4（2026-09-30）** Phase C 结论 MERGE。smoke 发现错误方法的拒绝仍带 `allow` 头（axum 的 MethodRouter 在中间件外追加）→ lead 修复（`5e14d77`：把整个路由包成一个服务，最外层重新生成拒绝响应），red team 复核确认。F1 → Sprint 2；F2 发布顺序：**先升级 agent 再升级面板**；F3（agent 读协程未 join）→ Sprint 3；F4 已写入文档。
- **R5（2026-09-30）** 采纳 Sprint 2 Phase A 的结论，要点如下：
  - 启用和禁用都要 bump config_version。
  - agent 应用失败时保留原来持有的版本（防止失败在下次 Hello 时被当成已收敛）；面板把 last_error 和失败版本持久化，并设退避与重发抑制，避免重建风暴。
  - 所有写操作在同一事务内完成，按全局锁序 nodes → users → node_users；每个会话 60 s 对账一次。
  - 到期判断统一用一个谓词，只用数据库时钟，并加幂等标记；已签发的 JWT 也要拦截已到期用户。
  - online_session 列解决多实例下的在线状态；F1 上限规则要保护诚实节点。
  - 暂缓：用 pg_notify 做按节点定向的通知（Sprint 3，同时满足多实例需求）；agent 断联后的失效租约（Sprint 3，默认 24h，可配置；可用性优先，同时保留控制力的上界）。
  - 否决：内容寻址版本号，改为保留版本计数器，并用表驱动测试保证每次改动都 bump。
- **R6（2026-09-30）** Sprint 2 Phase B 结论：修复后可合并（MERGE-WITH-FIXES）。
  - 必修：H1（被攻陷节点可让面板内存无限增长 → 在 update() 中校验成员资格，并限制条目数量）；M1（旧的期望状态可能在新状态之后下发 → 读取票据单调递增）。
  - 一并修复：L1、L2、L3、L5，以及 online_session 的数据库测试。
  - L6 产品决定：**管理员账号不是代理用户**，不下发到节点、不出现在订阅、不能被分配，也不受流量限额影响。
  - L4（按节点汇总的流量上限）留作后续。
- **R7（2026-09-30）** Sprint 2 Phase C 结论：修复后可合并。H1、M1、L1–L3、L6 已确认修复；新发现以下问题，本轮全部修复：
  - N1：条目达到上限后淘汰时，每插入一行都要全表扫描，面板 CPU 可被打满（阻断项）。
  - N2：大批量取消分配后，会把仍被分配的用户的报告也整份丢弃。
  - N3："未收到 Ack"被当作失败处理，导致至少 30 s 的访问泄露或停服。
  - N4：L5 实际未修好，锁的顺序仍然反转。
  - N5（按 agent 最低版本拒绝旧 agent）移到 Sprint 3。
- **R8（2026-09-30）** 采纳 Sprint 3 Phase A 的全部设计挑战，内容见上方 Sprint 3 计划。
  - EKU 审计（lead）：节点证书只有 ClientAuth 用途且不带 SAN，无法冒充服务端 ✅；服务端证书未设置 EKU，收紧为 ServerAuth。
  - 失联租约的产品决定：面板进程在但数据库不可用时**不续约**，因为此时面板已无法执行管控；兜底是 24h 的默认租约。
- **R9（2026-09-30）** C2 发现按节点索引在并发下会漂移 → 更新索引时持有条目锁，并在 prune 时重建索引自愈；smoke 的 pkill 改为精确匹配完整命令行。lead 亲自验证：压力测试连续 11 次通过，53 个测试通过。**Sprint 2 合并**：旧分支的合并基准过期导致冲突，改为 cherry-pick 到新 main（文件树与测试过的提交一致）后 rebase 合并，没有改写历史。
- **R10（2026-09-30）** Sprint 3a Phase B：修复后可合并。没有多计费或访问泄露；Vision/TLS 和 Trojan 的在线连接撤销实测有效。**保留 gate**：如果改成"删除时重建"，每次禁用、到期都会断开所有人的连接。必修 F1：刚被取消分配的用户，其最终计数被丢弃 → 新增 departed 表，给 15 分钟宽限期。一并完成：状态哈希 v2 覆盖 inbounds（F2）、非 ASCII 测试向量、拒绝 fakedns（F4）、各协议的撤销金丝雀测试进入 agent 测试套件、`remove_mode=rebuild` 应急开关。
- **R11（2026-09-30）** Sprint 3a Phase C 结论 MERGE，已合并。3b 追加：L1 fakedns 检查收窄为只看 `sniffing.destOverride`；L2 departed 宽限期内只接纳该用户在取消分配前已见过的 session。两个 subagent 的上下文都已超过 40 万，3b 换一对新的 worker 和 red team（同时在线仍只有 2 个）。
- **R12（2026-09-30）** Sprint 3b Phase A 结论：发现两个 main 上已有的缺陷，本轮修复。
  - P1：同一会话的读取和下发没有串行化，节点可能被回滚到旧配置 → 整个 sync 过程加会话级互斥锁，并加终止标志。
  - P2：证书序列号首字节为 0 时存储值与解析值不一致，约 1/256 的节点永远无法认证 → 统一规范化，并用迁移修正已有数据。
  - 设计变更：
    - 通知改为由 DB 触发器发出，不会漏发；监听器用独立连接，断线后先重新 LISTEN 再唤醒全部会话；按节点的 watch 通道。
    - 删除节点分两阶段：先禁用并下发空状态、计完最后的流量，再写墓碑并删除。已吊销的证书仍接受连接，只下发空状态后关闭。
    - L4 改用 GCRA 虚拟时钟，逐行 floor，不会除以零，NULL 不再等于不限。
    - departed 宽限改为时间窗规则，新增 first_seen_at 列。
    - fakedns 在面板做大小写和形式无关的检查，agent 在 xray 解析之后再做权威检查。
  - 暂缓：L4b（按节点+用户的汇总上限）、按证书限速。
- **R13（2026-10-01）** Sprint 3b Phase B：修复后可合并。
  - 已验证：触发器、监听器、按节点通知、发送串行化、序列号规范化、两阶段删除、吊销证书的处理、fakedns 检查。
  - 必修 1：GCRA 窗口 W = 租约时长会让节点上限对突发流量失效（约 108TB 可一次性灌给单个用户）→ 常规突发窗口改为 300 s；只有 DB 记录到的真实断连才给一次性补偿，补偿上限为 min(断连时长, 租约)。
  - 必修 2：departed 宽限窗口会随 flush 次数成倍放大 → 按用户对持久化累计已计量。
  - 一并修复：发送加超时，终止会话不再依赖 send_lock；refresh_members 也纳入读许可；时间戳单调；forget_node 移出监听任务；UNLISTEN 加超时；reaper 单个节点出错后继续处理其余节点；删除中的节点显示为 deleting。
