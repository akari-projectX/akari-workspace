# SPRINT：裁决记录与进度日志

> Lead 维护，**只追加**：新裁决、合并说明一律追加在文末。旧条目不删、不改写；被取代或撤回的条目在开头加〔…〕标注。
> 先读下面的"当前有效裁决索引"，需要细节再点锚点看原文。PLAN-v0.4 的决定 D1–D12 原文在 [`PLAN-v0.4.md` §2](PLAN-v0.4.md#2-已确认的决定)；下一版本待办在 [`PLAN-next.md`](PLAN-next.md)。
> 2026-10-01 以前的流程描述（red team 三阶段、最多 2 个 subagent、ROADMAP / REVIEW 引用）已过时，相关文件在 `archive/`。

## 当前有效裁决索引（2026-10-07 整理）

**身份与登录**
- D1 全员邮箱登录，"注册需验证邮箱""注册需邀请码"两个独立开关（[PLAN §2](PLAN-v0.4.md#2-已确认的决定)）；邮箱验证可选（[R38](#r38)）。
- D7 通行密钥，可设"仅通行密钥"；**TOTP 2FA 已移除**，`totp.key` 改名主密钥（[PLAN §2](PLAN-v0.4.md#2-已确认的决定)，依赖裁决 [W27](#w27-deps)）；管理员仅通行密钥不强制 2 个密钥（[W33-a ⑤](#w33a)）。
- R47 唯一"所有者"，只有所有者能管理管理员、后台前缀 / 白名单、支付密钥、主密钥（[R47](#r47)，修复见 [PR③](#pa3)）。
- D4 后台独立秘密前缀 + IP 白名单；前台不出现后台地址（[PLAN §2](PLAN-v0.4.md#2-已确认的决定)）。
- 到期用户可登录门户但不能用订阅（[R21](#r21)）；封禁用户只能看封禁原因与工单（[W33-a ③](#w33a)）；管理员不是代理用户（[R6 L6](#r6)）。
- D10 从未使用账号清理（默认关）；自助注销：有财务记录则匿名化保留（[D10](#d10)、[PR③](#pa3)）。
- 安全不能给管理员和用户增加多余步骤（[R18 第 4 项原则](#r18)）。

**节点 / 中转 / 计费**
- 计费只在 SQL 里做、只会少计不会多计；session_id + `RETURNING OLD/NEW`（[R1](#r1)、[R2](#r2)）。R1–R14 的结论已沉淀为 `akari-panel/CLAUDE.md` 不变量与 [`briefs/DEFECT-CHECKLIST.md`](briefs/DEFECT-CHECKLIST.md)。
- 禁用 / 超额 = 下发空配置，不拒绝连接（[R3](#r3)，D5 同理）；departed 宽限期（[R10](#r10)）。
- D2 一个节点一个入站，按服务器分组；Q1 `servers` 表 = 一台机器一个 agent（[阶段 0](#phase0)）。
- D3 无手动分配，权限只来自 套餐 → 节点组 → 入口。
- D6 / §5 中转 = 落地节点下的入口，只做外部中转，托管中转暂缓（[R42 修订 2](#r42-rev2)）；计数标识 = 用户 UUID + 入口 ID（[R43](#r43)）。
- nftables 来源白名单由 root 更新服务应用，agent 不拿 CAP_NET_ADMIN（[R44](#r44)）。
- D5 流量额度挂在服务器上、按网卡流量计（[阶段 0 Q2](#phase0)、[W33-a ②](#w33a)）。
- D9 分时段倍率设在入口上（时段重叠取最高），结算取"现在"与"30 秒前"的较低倍率、只少计（[PLAN §2](PLAN-v0.4.md#2-已确认的决定)、[PR②](#pa2)）。
- 日流量、月重置、套餐周期结束按站点时区（[阶段 0 Q3](#phase0)、[period_end](#period-end)）。
- 审计规则按节点开关、默认关、热更新不断线（[W33-a ⑩](#w33a)）；agent 性能优先，改 agent 必须附基准、回退 >5% 不合并（[原则](#agent-perf)）。
- 不做 IP 数设备限制，席位绑定随客户端（[R25](#r25)）；sing-box 第二内核暂缓（[R28](#r28)、[R29](#r29)）。
- 节点证书 ACME 自动申请（[R30](#r30)）；gRPC 传输固定在 grpc-go 上游修复提交（[R26](#r26)）；xray GHSA-5wf9 等上游正式版（[xray](#xray-ghsa)）。
- agent 二进制按 GPL-3.0-or-later 组合作品分发（[R19](#r19)）。

**资金与套餐**
- 支付 = 内置 trait 插件（方案 A），首个渠道支付宝当面付，配置只存数据库；更多渠道待用户启动（[R40](#r40)、[R38](#r38)）。
- 支付宝用密钥模式即可（[签名模式](#alipay-keymode)）。
- 退款撤销订阅效果（[P1](#p1-refund)）；退款三选一：原路退回 / 退到余额 / 仅登记，"允许原路退款"开关（[原路退款](#alipay-refund)、[补充](#refund-options)）。
- 运营逻辑批次 A/B/C（折算、库存预占、条款快照、下架只停新购、删用户影响预览等）（[审查](#ops-review)、[PR① 取舍](#pa1)）。
- 佣金提现只支持 USDT，管理员在 OKX 手动打款回填 txid；链含 Plasma（[R46](#r46)、[补充](#r46-plasma)）。
- 资金表快照列只存不含个人信息的标签，账本只追加（[阶段 0 Q4](#phase0)）。

**订阅**
- 第三方订阅按格式 / 按客户端由后台开关决定，默认全开；关闭的格式统一 404（[订阅格式开关](#sub-format-switch)、[战略决策 2](#strategy2)）。
- D11 订阅路径安装时随机、全站共用、后台可改；**改后旧路径立即失效**，需二次确认 + 审计 + 可邮件通知（[D11](#d11)、[补充](#d11-sup)、[W33-a ⑥](#w33a)）。
- D8 主域名 / 订阅域名 / 节点通信域名均为列表，各类域名只能访问规定内容；每用户随机订阅域名默认关（[PLAN §2](PLAN-v0.4.md#2-已确认的决定)、[W33-a ①](#w33a)）。
- 安装链接用首选主域名，不含后台前缀（[撤回节点网关](#install-link)）；纯 IP 面板的安装命令用 `-k --pinnedpubkey`（[R20](#r20)）。
- 所有拒绝统一为空 body 404、字节同构（[SEC-1](#sec1)）。

**前后台**
- 门户在主域名 `/`（D11）；后台是独立应用 `admin/`，挂在 D4 前缀下；门户产物不得含后台代码（[R23](#r23)、[W33-b](#w33b)、[W36-b](#w36b)）。
- 门户中英双语；后台只做中文（[R18 第 1 项](#r18)）。
- 新前台 / 新后台必须覆盖后端全部功能，验收清单 = `research/portal-gap.md` / `research/admin-inventory.md`，每行有 e2e（[功能完整性](#feature-parity)）。
- 门户细节裁决：BrowserRouter、二维码 logo 静态化、Turnstile CSP 只在开启时放行（[差距分析](#portal-gap)）；条款 / 隐私页读 KB（[W36-b PR1](#w36b-pr1)）；首屏 JS 预算、不保留页面切换丢输入（[#89](#w36b-wait)）。
- 后台设计裁决 ⑦⑧⑨（批量删除、手机卡片列表、其余页面套新外壳）（[W33-a](#w33a)）。

**部署与运维**
- panel.toml 只放启动项，后台可设的一律不进文件（[R39](#r39)）。
- 发布签名密钥与流程（[R27](#r27)）；root 更新服务保持 W^X，updater 随签名二进制刷新 unit（[R34](#r34)、[R37](#r37)）。
- CI 不绿不打 tag（[规程](#tag-on-green)）。
- 测试部署发现的后端 bug 发现即修，每个 bug 一个小 PR（[修订](#deploy-bugs-now)）。
- v0.4.0 / v0.5.0 只发 main 上已合并内容，未开始的待办全部进 PLAN-next；进行中的任务不停（[并入下一版本](#next-version)、[更正](#dont-stop)）。
- 阶段 D 届时在云端会话做（[执行方式](#d-cloud)）；CodeQL 提示归入阶段 D（[CodeQL](#codeql)）。

**开发流程**
- 串行：面板 + agent 同一时间只有一个打开的 PR（成对 proto PR 算一个），不堆叠；strict 分支保护开启（[开发节奏](#serial-1005)、[串行队列](#serial-queue)）。
- 改 proto：先合面板再合 agent，两个 PR 紧挨着合并（[规则](#proto-merge-rule)）。
- W37 分级 CI：本地只跑快速检查，重型检查只在 Actions；整批做完再推，合并前最后一次加 `full-ci`（[W37](#w37)、[队列压缩](#queue-3pr)）；CI 提速（[#81](#ci-speedup)）。
- CI 失败立即修（fail fast，见 `briefs/COMMON.md`）。
- 不派 red team 做日常 PR 审查，质量门 = CI + 测试 + lead 审查（[R16](#r16)）；阶段 E red team 已排进 PLAN-next。
- 依赖例外：webauthn-rs MPL-2.0、vendored OpenSSL 仅用于通行密钥（[W27](#w27-deps)）；govulncheck 白名单须核实暴露面（[R15](#r15)）。

---

## 历史看板（2026-09-30 起，Phase 0.5）

> 〔历史，已过时〕Lead 维护。详细计划与里程碑见 `ROADMAP.md`（M0–M7），本看板只跟踪当前 sprint。缺陷编号对应 `REVIEW-2026-09-30.md`，范围见 `akari-panel/PLAN.md` Phase 0.5。
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
- ▶ 2026-10-02 用户恢复并取消 2 个 subagent 的上限，要求加快进度。并行进行三路：M2 收尾（Sonnet，`feat/m2-perf`）、M3 运营模型（Opus，`feat/m3-plans`，基于 M2）、M4 akari-client MVP（Opus，akari-client `feat/m4-mvp`）。
- ✅ WSL 3.0.1 已升级（2026-10-01，内核 6.18.40）；agent 测试含撤权金丝雀、cargo test 92/92、smoke 全绿。

## 新增（仓库全部公开后，2026-09-30）
- <a id="sec1"></a>**SEC-1 伪装站可被指纹识别** → 按用户决定（2026-09-30）**删除伪装站**：所有拒绝统一为空 body 的 404，不带安全头，字节同构；提前到 Sprint 1b 由 worker 执行。原问题：：`decoy.html` 已公开，扫描器可以用它的字节哈希识别出所有 Akari 部署，"零指纹"的前提不再成立。改为每个安装使用运营方提供或随机生成的伪装内容，404 同字节的约束不变。优先级 P0，放进 Sprint 2。
- REVIEW 中未修复缺陷的细节已公开；P0 修复要尽快合并。

## Sprint 2 ✅ 已合并（2026-09-30）· panel PR#3 → main 0adc14c；agent PR#2 → main 2b3e7e3
S2-1 状态变更与版本 bump 同事务 · S2-2 禁用节点 = 下发空状态（不再在连接时拒绝）· S2-3 到期执行（新迁移加幂等标记）· S2-4 assign 校验与事务 · S2-5 孤儿凭据 + Ack 失败时记录 last_error · S2-6 PATCH 语义 · S2-7 离线状态按代数判断写入。
- 追加 F1（Phase C，中危）：节点可伪造 session 给任意用户记账 → 只对 node_users 中存在的 (node,user) 对计费、限制每节点活跃 session 数及新建速率、对单次增量做合理性上限。
- <a id="r3"></a>裁决 R3：禁用节点的期望状态定义为"无 inbound、无用户"，连接照常接受并推送空快照。原因：当前的连接期拒绝会让 agent 一直带着旧配置运行。

## Sprint 3 ✅ 已合并 · 3a（panel PR#4、agent PR#3）· 3b（panel PR#5 → dd1b935，agent PR#4 → c0565a1）
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

## M1 可生产部署（2026-10-01 开始，v3 流程）
- **M1a ✅ 已合并（panel PR#9、agent PR#6）**：M1-1 发布制品（panel 静态二进制 + distroless 镜像，agent 多架构，版本号与 git sha 注入，release 工作流，SBOM + cosign 签名）；M1-2 部署模板与文档（systemd、生产 compose、Caddy/nginx 反代示例）；M1-3 启动时配置校验；M1-4 Prometheus `/metrics`（独立的内网端口）+ 请求 ID + 告警规则样例；M1-5 备份恢复脚本与演练文档。
- <a id="m1b"></a>〔TOTP 已被 D7 移除〕 **M1b ✅ 已合并（panel PR#10）**：M1-6 管理员 TOTP 双因素（管理员必须启用）；M1-7 审计日志（谁、何时、改了什么、前后值）+ 管理端查询；M1-9 秘密轮换（route prefix、jwt 密钥、用户自助重置订阅 token）；M1-10 订阅端点限速，token 不写入日志。
- **M1c ✅ 已合并（panel PR#11、agent PR#7）**：CSR 注册（节点本地生成 P-256 私钥 + 一次性令牌）、证书续期（协议 2）、管理员首次 2FA 注册码、agent 侧拒收 grpc 传输、心跳补全。
- **M1 完成（2026-10-01）**：panel main 与新 agent 一起跑 CI 全绿（含 smoke）。未完成：在真实 VPS 上按 DEPLOY.md 计时部署（需要用户提供 VPS）；SPA 尚未在真实浏览器中验证。

## Sprint 4（2026-10-01 开始，v2 快速模式）
- **4a ✅ 已合并**（panel PR#6/#7，agent PR#5，workspace PR#2）。CI 已上线；main 必需检查：panel = rust、spa、cargo-deny；agent = go、govulncheck、check-proto；smoke 连续跑绿后再设为必需。
- 原计划 4a（T2，Sonnet worker）：三仓 CI（fmt/clippy/test/tsc/cargo-deny/govulncheck/check-proto/smoke）并设为必需检查、fake-agent 集成测试 harness、文档去漂移、state.json 权限改 0600、gRPC 错误不泄露 DB 细节。分支 `chore/s4a-ci`。
- **4b ✅ 已合并**（panel PR#8 → 28e7c23）。
- 原计划 4b（T1，Opus worker + red team 单轮 B）：S4-1 反代（trusted_proxies、cookie_secure、只计失败登录）、S4-2 会话吊销（pwd_ver）与最后一个管理员保护、S4-3 SIGTERM 优雅退出加最终 flush、R14 N1 面板侧 flush 故障期间的额度补偿、N2 监听器 PID 守卫、N3 Hello 之前的流量拒收。分支 `feat/s4b-hardening`。

### 原计划
P1 的剩余项（S4-1 反代与限速、S4-2 会话吊销、S4-3 SIGTERM）、CI（设为必需检查）、fake-agent 测试 harness、文档去漂移；外加 R14 跟进：面板侧 flush 故障期间的额度补偿（N1）、监听器 PID 守卫（N2）、Hello 之前的流量拒收（N3）、L4b 评估。

## 裁决记录
- <a id="r1"></a>**R1（2026-09-30）** 采纳 red team 的结论：首次 Snapshot 后 agent 不重发 Hello，导致记账 session 永久错位，只要重连就会重复计费。只改面板的修复被否决。新方案：`TrafficReport.session_id` 由 CoreManager 在 Rebuild 时原子生成；面板在 SQL 内用 PG18 `RETURNING OLD/NEW` 算 delta（同一事务、按行加锁），内存中不保留 pending；#10 的验收改为"下次上报能完整补回"。另外采纳：u64 溢出防护（列为 P1 安全项）、登出失败必须对用户可见、REVIEW 行号勘误。#12 SIGTERM 降级为运维项。
- <a id="r2"></a>**R2（2026-09-30）** 采纳 Phase B 的结论。H1：乱序的旧值会触发新 epoch 并重复计费，而且每翻转一次就再多计一次 → **整个删除 epoch 机制**（生产环境没有旧 agent，不留兼容）；缺 session_id 的上报直接丢弃；会话内出现更低的值忽略即可（由 GREATEST 保底）。H2：启动时强制检查 PG ≥ 18（否则会静默地计 0）。M1：按 SQLSTATE 区分瞬时错误与数据错误。M2：批量写入前排序，避免死锁。M3：登出后界面停在原页，改用 removeQueries + resetQueries。SEC-1 追加：405 响应会暴露前缀是否正确，所有不匹配一律返回空 404。L1：traffic_counters 的行是计费基线，清理任务只能删除已确认结束的会话。合并目标改为 `fix/p0-sprint1b`，它包含 1 的全部内容。
- **R4（2026-09-30）** Phase C 结论 MERGE。smoke 发现错误方法的拒绝仍带 `allow` 头（axum 的 MethodRouter 在中间件外追加）→ lead 修复（`5e14d77`：把整个路由包成一个服务，最外层重新生成拒绝响应），red team 复核确认。F1 → Sprint 2；F2 发布顺序：**先升级 agent 再升级面板**；F3（agent 读协程未 join）→ Sprint 3；F4 已写入文档。
- **R5（2026-09-30）** 采纳 Sprint 2 Phase A 的结论，要点如下：
  - 启用和禁用都要 bump config_version。
  - agent 应用失败时保留原来持有的版本（防止失败在下次 Hello 时被当成已收敛）；面板把 last_error 和失败版本持久化，并设退避与重发抑制，避免重建风暴。
  - 所有写操作在同一事务内完成，按全局锁序 nodes → users → node_users；每个会话 60 s 对账一次。
  - 到期判断统一用一个谓词，只用数据库时钟，并加幂等标记；已签发的 JWT 也要拦截已到期用户。
  - online_session 列解决多实例下的在线状态；F1 上限规则要保护诚实节点。
  - 暂缓：用 pg_notify 做按节点定向的通知（Sprint 3，同时满足多实例需求）；agent 断联后的失效租约（Sprint 3，默认 24h，可配置；可用性优先，同时保留控制力的上界）。
  - 否决：内容寻址版本号，改为保留版本计数器，并用表驱动测试保证每次改动都 bump。
- <a id="r6"></a>**R6（2026-09-30）** Sprint 2 Phase B 结论：修复后可合并（MERGE-WITH-FIXES）。
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
- <a id="r10"></a>**R10（2026-09-30）** Sprint 3a Phase B：修复后可合并。没有多计费或访问泄露；Vision/TLS 和 Trojan 的在线连接撤销实测有效。**保留 gate**：如果改成"删除时重建"，每次禁用、到期都会断开所有人的连接。必修 F1：刚被取消分配的用户，其最终计数被丢弃 → 新增 departed 表，给 15 分钟宽限期。一并完成：状态哈希 v2 覆盖 inbounds（F2）、非 ASCII 测试向量、拒绝 fakedns（F4）、各协议的撤销金丝雀测试进入 agent 测试套件、`remove_mode=rebuild` 应急开关。
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
- **R14（2026-10-01）** Sprint 3b Phase C 结论 MERGE，已合并（合并时遇到 GitHub 网络超时，已确认两个 PR 都是 MERGED 状态，并重新同步了本地 main）。N1–N3 纳入 Sprint 4。**M0 进度：Sprint 1–3 完成，剩 Sprint 4。**
- <a id="r15"></a>**R15（2026-10-01）** 4a 走中风险流程，由 lead 审查后合并。审查发现 worker 以"agent 只拨出"为由把 govulncheck 的 GO-2026-6443（grpc 服务端在缺少 :authority 时 panic）加入白名单，但 xray 的 gRPC 传输 inbound 会在公网暴露 grpc 服务端，任何人都能远程打崩 agent → 在 grpc ≥1.85 发布前，面板拒绝 `network: grpc/gun` 的 inbound（已追加到 4b），agent 侧拒收放到下一轮。CI 首次运行中 smoke 失败（agent 浅克隆，找不到固定的旧提交）→ 已修复（PR#7），smoke 首次在 GitHub 跑通。
- <a id="r16"></a>〔部分取代：阶段 E red team 已按用户要求（2026-10-04）恢复，现排在 PLAN-next〕 **R16（2026-10-01）** 用户决定：**不再进行 red team 对抗测试**，只验证代码可用、保证代码质量。4b 的 red team 已中途停止（未产出结论），残留已清理。4b 由 lead 验证：make lint/check、cargo deny、cargo test --locked 116/116、smoke（本地与 CI）全绿；代码审查无问题。已合并。**M0 质量基线完成**（Sprint 1–4）。流程改为 v3（见 ROADMAP §1）。
- **R17（2026-10-02）** M2（性能，全部 §0 目标达标，flush 5 万行 0.91s）+ M3（套餐/节点组/周期重置/自助）以合并分支 PR#14 合入 panel main；agent 基准 PR#8。M4 客户端 MVP 已合并（GPL-3.0，mihomo v1.19.32 独立进程），**客户端随后暂停**（用户：面板与 agent 先达生产级）。下一步：M6 agent 签名自动更新；之后 M7 商业化。
- **升级演练（2026-10-02，VPS）**：先备份（pg_dump + data 卷），再先升 agent（32f3bf3 → 7e1cb79，接旧面板正常），后升面板（M1c → main e05497e，原地执行迁移 0011–0020），新 compose 的 `AKARI_CONFIG` 生效；节点在线，REALITY 代理与计费正常，已有会话保持。✅
- **100 用户并发实测（2026-10-02）**：面板 95.40.55.149，节点 hk-1（18.162.147.173，Lightsail HK，2 vCPU），客户端在面板机（单个 xray 进程开 100 个 SOCKS 入口 + Go 单进程压测器）。100/100 成功，1049 MB 用时 2.9 s（聚合约 365 MB/s ≈ 2.9 Gbit/s）；hk-1 峰值 100 个连接，agent 内存 52 MB，CPU 约 35% 空闲；**逐用户计费 100/100，计费/下载 = 1.0000，无少计**；满负载下禁用 1 个用户约 1 s 内断流，其余 99 人不受影响；100 次分配用增量下发，5.1 s 完成。早先客户端与节点同机（95.40）时压测客户端被 OOM 杀掉，服务端组件无恙；结论：不要让压测客户端和节点挤在同一台 1 GB 的机器上。
- **浏览器验收（2026-10-02，无头 Chromium，部署环境）**：功能全部可用（登录 + TOTP、首登 2FA 注册、用户、节点、新节点 bootstrap 下载、套餐/节点组、审计筛选与分页、账户、用户门户、登出）。**阻断项：CSP 的 `style-src` 缺 `'self'`，导致界面在真实浏览器中无样式** → 已修复（PR#15），smoke 增加断言，已部署到 VPS。
- <a id="ui-backlog-1002"></a>〔已取代：后台由 W33-b、门户由 W36-b 整体重写〕 **UI 打磨待办（M6 合并后做，避免与 M6 的节点页冲突）**：删除用户、重发订阅 token 加二次确认；用户编辑上限/到期、吊销会话按钮、分页、管理端查看用户的节点权限；节点表显示租约剩余、region、按钮样式、名称不换行；错误提示友好化；视图可路由（URL 反映页面）；2FA 注册显示二维码（本地生成）；375px 宽度下 header 溢出；套餐取消后界面说明"沿用上一个套餐的上限"；CI 加 Playwright 端到端测试（使用真实 CSP，防止此类回归）。
- <a id="r18"></a>〔第 4 项的 2FA 部分已被 D7 取代（移除 TOTP）；"安全不能变成负担"原则仍有效〕 **R18（2026-10-02，用户需求与 lead 裁决）**：M6 双侧已合并（panel PR#16、agent PR#9；发布公钥未提交 → 自动更新暂不生效，等用户决定密钥保管）。OPUS-GUIDE.md（Fable 5.1 撰写）作为工作指导，其 §3.2 加固项 A1–A31 纳入下一轮。用户新需求：
  1. **i18n**：前台（登录、用户门户、购买）支持中英文（默认跟随浏览器，可切换）；后台管理只做中文。
  2. **新建节点 = 表单 + 一键安装**（对标 xboard）：管理员填地址、端口并选协议模板（VLESS+Reality / VLESS+WS+TLS / Trojan / VMess…），面板生成入站配置（REALITY 密钥对、shortId）；随后给出一行安装命令，节点 VPS 执行后自动下载 agent、注册并上线，不再手动下载 bootstrap 文件。
  3. **支付**：只接支付宝**当面付**（沙箱密钥在 ~/secrets/，不得入库），先做订单 → 预下单二维码 → 异步通知验签 → 幂等开通套餐。
  4. **安全不能变成负担**：管理员 2FA 改为可选但推荐（后台横幅提示）；去掉一次性注册码；绑定页显示二维码（本地生成）；恢复码可下载。配置项 `auth.require_admin_2fa` 默认 false，需要的部署可以打开。
  并行分工：W1 节点表单 + 一键安装（面板 + agent，Opus）；W2 i18n + 2FA 简化 + UI 打磨（Opus）；W3 支付宝当面付 + 订单（Opus）；W4 加固 A1–A10、A24–A31（Sonnet，只碰 grpc/traffic/sub/enroll 与 agent）。迁移编号分段：W1 0030+、W2 0035+、W3 0040+、W4 0050+。
- <a id="r19"></a>**R19（2026-10-02）** W4 已合并（agent PR#10、panel PR#17）。
  - **smoke 隔离**：`SMOKE_DB` 加上按库区分的 Valkey 逻辑库编号，并行的 worktree 不再互相干扰。
  - **面板加固**：A1–A4、A6、A9（流量缓冲：snapshot 64→28ms，prune 从每 5s 2.2s 降到每 60s 46ms）、A10、A18、A19。
  - **agent 加固**：A24–A29、A31。
  - **重要发现**：M6 的签名工具 `cmd/akari-sign` 源码从未提交（`.gitignore` 里的裸 `akari-sign` 规则把目录一起忽略了），W4 按命令行约定重写，并把 .gitignore 规则改为锚定写法。
  - **许可证裁决**：xray 静态链接了 `sagernet/sing*`（GPL-3.0-or-later），因此 agent **二进制**按 GPL-3.0-or-later 组合作品分发（源码公开，自有代码仍为 MIT）。在 README 和发布说明中注明（随下一个文档 PR）；不维护去掉 Shadowsocks 的 xray 补丁。
- <a id="r20"></a>**R20（2026-10-02）** W1（节点模板 + 一键安装）交付，PR#18。
  - 裁决：只有 IP、没有正规证书的面板，安装命令使用 `curl -k --pinnedpubkey sha256//…`。`-k` 只关闭 CA 链校验，公钥钉扎在握手阶段校验、早于 token 发出；绝不输出不带钉扎的 `-k`。R18 中"不用 -k"指的是无认证的 -k。
  - 需知：Caddy 内部 CA 证书续期后会换钥，钉扎命令会失效（失败是安全的，重新生成命令即可）。
  - CI 的 docker build 和 bench tooling 失败，已交给修复 worker；合并前必须全绿。
- <a id="r21"></a>**R21（2026-10-02）** W3（支付宝当面付，沙箱实测预下单/查询/关闭 + 验签通过）与 W2（i18n、管理员 2FA 可选、删除注册码、二维码、URL 路由、用户编辑/分页、ESLint/Prettier、Playwright e2e）交付。
  - 裁决（对齐 xboard）：**到期的普通用户可以登录**，但只开放门户、商店、订单、改密码、登出、切换语言；订阅、换订阅 token、代理访问仍然阻断；被禁用的用户仍然完全无法登录。
  - 合并顺序：W1 → W3 → W2，由一个集成 worker 依次变基，并把 W3 的计费文案接入 W2 的 i18n 字典、实现 R21。
- <a id="r22"></a>〔已被 D8 多域名列表取代〕 **R22（2026-10-02，用户需求）** 后台"系统设置"，配置三个域名：
  - **主域名**：后台、门户、安装链接、支付宝回调使用。
  - **订阅域名**：可经过 Cloudflare 橙色云朵代理；可选"信任 Cloudflare"，用内置 CF 网段识别真实客户端 IP。
  - **节点通信域名**：灰色云朵，不经过 CF，gRPC/mTLS 直连。若该域名解析到 CF 网段则阻止保存（可强制覆盖）；服务端证书 SAN 只增不减，保证已注册节点不断连。
  - 设置存 DB，修改带审计，多实例通过通知同步。Caddy 用 on-demand TLS 加面板 `ask` 端点，自动为已配置的域名签发证书。
  - 由 W5 实现。部署：akari.cc（→ 95.40.55.149）的正规证书真实测试由部署 worker 进行。
- <a id="r23"></a>〔路径部分已被 D4 / D11 取代；"门户产物不含后台代码"仍有效〕 **R23（2026-10-02，用户质疑"前台也加载后台文件"）** 推翻 M3 的"单 SPA 双角色"决定，**前后台拆分打包**：
  1. Vite 双入口：用户门户 `/{prefix}/app`（登录、门户、购买、中英文）与管理后台 `/{prefix}/admin`（仅中文）各自独立打包，门户产物中不出现任何后台代码（CI 用 grep 断言）。
  2. 后台的 index 与资源需要管理员会话才提供，否则返回统一的拒绝 404（与 R6/拒绝同构一致）；后台登录页放在一个极小的独立入口里。
  3. 后台只能从主域名访问；在订阅域名上访问后台路径同样返回拒绝 404（配合 R22）。
  在 W3 → W2 合并之后由新 worker（W6）实现；PLAN.md 的前端形态决策行加更正。
- **R24（2026-10-02，用户质疑"套餐创建不完善、协议下发是否完善"）** 现状评估：套餐只有额度、周期、组、单一价格；限速和设备数字段没有执行；协议只有 VLESS/VMess/Trojan + TCP-REALITY/WS/TLS，缺 Vision、SS2022、HTTPUpgrade、XHTTP。
  - **W8**（协议矩阵，现在开工）：Vision、SS2022、HTTPUpgrade、XHTTP、完整的三格式订阅映射、按协议的撤权金丝雀、支持矩阵文档；gRPC 仍禁用（GO-2026-6443）；不支持的协议（若 xray 无 Hysteria2/TUIC 服务端）只做文档说明。
  - **W7**（套餐完善，等 W3/W2 合并后开工）：多周期定价（月/季/半年/年/两年/三年/一次性/重置包）、描述与卖点、按用户执行限速（agent 端 gate 限速）、续费/升级补差价规则、库存与限购。设备数限制待用户决定（R18：席位绑定随客户端；可选临时方案是按在线 IP 数限制）。
- <a id="r25"></a>**R25（2026-10-02，用户选 B）** 设备数限制：**不做 IP 数限制**，等客户端恢复后做席位绑定（维持 R18 / 战略决策 3）；套餐里的 `device_seats` 字段保留但不执行，UI 标注"客户端上线后生效"。
- <a id="r26"></a>**R26（2026-10-02，用户："GO-2026-6443 已修复"）** 核实结果：grpc-go 尚无 v1.85.0 正式版，修复只在上游 `v1.85.0-dev.0.20260825072537-93e31b48545e`。裁决：agent 固定到这个上游修复提交，重新开放 gRPC 传输（面板校验、agent 拒收、模板、三格式订阅、撤权金丝雀全链路），从 vulncheck 白名单移除该条；v1.85.0 正式发布后改用正式版。由 W8 实施。
- **akari.cc 上线（2026-10-02）**：Let's Encrypt 证书、main 8bc8b79、hk-1 用真实一键安装（https://akari.cc，无 -k、无 pin）、订阅三格式、REALITY 代理、计费误差 0.03%。
  - **发现前缀探测缺陷**：Caddy 2.11 会给转发的响应加 `Via: 1.1 Caddy`，前缀内外的 404 因此不一样，可借此探测前缀。已在服务器上修复，代码修复在 PR#20（同时把其他 Host 的默认 200 改为 404）。
  - 阻断项：agent 从未发布过正式版本 → R27。
- <a id="r27"></a>**R27（2026-10-02，lead 依据用户授权决定）** 生成生产用的 Ed25519 发布密钥：私钥存 `~/secrets/akari-release-signing.key`（0600）并设为 GitHub secret `AKARI_RELEASE_SIGNING_KEY`，公钥提交到 `release-keys.txt`；发布 agent v0.2.0；akari.cc 配置 `updates.release_keys` 与安装回退地址，并把 v0.2.0 上传到面板的"更新"。由发布 worker 执行。
- **R27 已完成**：发布密钥 `f2ad18a8bb718a1a`（公钥已固定在 agent 仓库，PR#11；面板文档 PR#21）；agent **v0.2.0** 已发布（linux amd64/arm64、Ed25519 manifest、cosign、SBOM、SHA256SUMS 全部验证通过）。akari.cc 已配置 `updates.release_keys` 与安装回退地址，并上传了 v0.2.0 amd64。后续：vps-1/hk-1 的 agent 是未固定公钥的旧构建，需各手工重装一次才能自动更新（放到下一轮部署做）；arm64 版本也要上传到面板。
- <a id="r28"></a>**R28（2026-10-02，Xboard-Node 研究结论）** Xboard-Node 用的是 cedar2025 的 sing-box fork（GPL-3.0），给入站加了 `UpdateUsers`，做法是整表替换。它的问题：已删用户的现有连接、mux 和 QUIC 会话**不会被切断**，删除后新开的流**不计费、不限速**；用户身份是下标，删除后会错位，所有 sing-box 协议都存在下标竞争，TUIC/Hysteria2 的 QUIC 会话可能串号或让进程 panic；UDP 上下行计数反了；重启内核会丢流量。
  - **不借鉴**它的删除路径，Akari 的 gate 撤权更强。
  - **不引入** sing-box 内核：GPL、没有上游热更新 API、没有 gate 那样的钩子。只有当 TUIC/AnyTLS 成为硬需求时，再考虑作为隔离的第二内核。
  - **借鉴两点**：
    1. W7 限速：在 gate 只包写端；每用户一个稳定的限速对象，原地改参数；burst 不小于 MultiBuffer；上下行分桶；核实 Vision/splice 不会绕过（已发给 W7）。
    2. **W9 候选**：SS2022 删除改为"墓碑"——不调用 xray `RemoveUser`，由 gate 撤权并保留表项，下标就不会移动，删除用户不再需要重建节点；下次 Snapshot 时压缩；重新添加/轮换仍然走 Snapshot。需要金丝雀验证。
- <a id="r29"></a>**R29（2026-10-02，sing-box 第二内核技术验证结论）** **用户决定：暂不做**（2026-10-02）。完整结论、补丁与原型存档于 `research/singbox-spike/`。如果以后重启，按以下结论进行：有条件立项，排在 M8；**不维护长期通用 fork**。
  - **事实**：
    - 上游 v1.14.2 只用公开 API（tracker + 自定义 gate outbound），就做到了撤权、计费、限速，6 种协议实测通过。
    - 但 QUIC（Hy2/TUIC）用户新增必须打补丁：否则每次加用户，全部 QUIC 用户约 30s 黑洞。
    - 最小补丁约 450 行（指针身份 + 原子快照）；在 -race 下跑 17,706 次换表，0 串号。
    - 上游维护者明确拒绝此类钩子（#2621/#852/#3022，相关 PR 均未合并）；一年内 5 次破坏性接口变更；cedar 的 fork 从未变基。
    - 上游自带的 SSM `UpdateUsers` 同样有下标竞争，0.16s 内就 panic。
    - slim 构建 22MB / 空闲 23MB RSS，比 xray agent 更轻。
    - **sing-box 许可证附加条款**：衍生作品不得使用其名称，二进制不能叫 `*-singbox`。
  - **立项条件**：
    1. 有 xray 无法满足的产品需求（TUIC/AnyTLS）；
    2. 命名合规；
    3. 先把 sing-quic 的小修复提给上游。
  - 估计 22–26 人日，另加每月 1–2 天变基；每内核一个独立 Go module，两套 xray/sing 依赖互不影响。
- **合并（2026-10-02）**：W6 前后台拆分（panel#26）、W9 Hysteria2 续费可重连 + SS2022 墓碑删除（panel#27、agent#14，agent 协议 5）。
- <a id="r30"></a>**R30（2026-10-02，用户问 TLS 协议支持）** VLESS/Trojan/VMess 的 WS、gRPC、HTTPUpgrade、XHTTP、TCP + TLS 已支持（W8），但节点证书需要手动用 certbot 申请。裁决：**W10** 由 agent 内置 ACME 自动申请并续期证书（HTTP-01 / TLS-ALPN-01，pebble 测试），热加载不断连，节点页面显示证书状态与可操作的错误提示。
- <a id="r31"></a>〔节点倍率已被 D6 / D9 入口倍率取代〕 **R31（2026-10-02，用户需求）** **W11**：
  - 节点表单对标 xboard：显示名称、排序、显示/隐藏、标签、**倍率**（整数千分比，只在 SQL 计费中生效）、连接地址/端口映射、节点组。
  - agent 实时上报机器状态：CPU、负载、内存/swap、磁盘、网速、socket 数、在线用户、RSS。最新值存 Valkey；历史按分钟保留 48h、按小时保留 90d；节点详情页用自绘 SVG 图表。
  - 类 Clash Verge 的延迟测试：agent 每 5h 测 generate_204（url-test 语义，取 3 次中位数），面板测各入站 TCP 可达性，可"立即测速"；用户门户只展示延迟、在线状态、倍率、标签。
  - proto 字段号分配：W10 用 10–19，W11 用 20–49；迁移号：W10 用 0080–0084，W11 用 0085–0089。
- **合并（2026-10-02）**：W11（panel#29、agent#16）、W10（panel#30、agent#15，agent 协议 6）。W10 采用"先面板、后 agent"的合并顺序打破跨仓 CI 互等。main 的 smoke 偶发失败（`| grep -q` 在 pipefail 下 Broken pipe），重跑后变绿，由 W12 统一清理。
- **生产级收尾计划（对照 ROADMAP §0 的缺口）**：
  1. 进行中：W12 smoke 能力门控 + R19 许可声明 + 延迟测试配置 UI；W13 关键解析器 fuzz + 计费核心覆盖率 ≥90% 门禁 + npm audit；部署 worker：agent v0.4.0 + akari.cc + M6 灰度实测 + hk-1 真实 Let's Encrypt。
  2. 下一批：面板首个 tag/release（ghcr 镜像 + cosign，生产改用镜像仓库，A20）；按文档在全新环境 30 分钟部署演练；在 W7/W11 之后重测 §0 性能指标（200 节点 / 5 万用户）；备份恢复演练复测。
  3. 之后 M7 剩余项（对标 xboard）：邮件（SMTP：找回密码、到期/流量提醒）、工单、优惠券、邀请返利；告警阈值 + Grafana 面板（W11 的后续）。
- **合并（2026-10-02）**：W12（panel#31、agent#17：smoke 能力门控 + 清理 50 处管道写法、R19 THIRD_PARTY 许可清单随发布、延迟测试设置进系统设置）；W13（panel#32、agent#18：面板 10 个 + agent 12 个 fuzz 目标；修复 7 个缺陷，其中 agent 有一项安全问题：SS2022 键名只差大小写时退化为单用户、撤权失效；计费核心覆盖率 ≥93%，agent ≥91%）。
- <a id="r32"></a>〔必需检查已由 W37 分级 CI 更新〕 **R32（lead）** 必需检查收紧：
  - 面板增加 coverage、smoke、e2e、docker build；
  - agent 增加 coverage、reproducible build；
  - fuzz 只作参考，另每晚跑一轮。
  - 待办：面板 `check_inbound` 应拒绝只差大小写的重复 JSON 键（agent 已做权威检查，面板这边是纵深防御）。
- **W14 合并（panel#33）**：
  - 面板正式发布流水线：多架构镜像 + cosign + SBOM；PR 上可干跑整个发布流程；compose 按 tag+digest 固定镜像。
  - 全新部署演练：人工约 27 分钟，满足 ≤30 分钟。
  - 性能复测：§0 指标全部通过。发现"用户变更生效最慢 2.01s"，原因是各会话的 60s 对账同相位，已改为随机相位，修复后 p99 0.75s。`GET /nodes` 在 16 并发下处于临界值，后续做轻量列表视图。
  - 恢复演练通过，演练改用独立数据库，不再波及其他 worker。
  - `check_inbound` 拒绝只差大小写的重复键。
  - 打 tag：面板 v0.2.0。
- **R33（lead，M7 商业化核心）** 面板没有自助注册和找回密码，无法对外售卖。
  - **W15**：注册（默认关闭；邮箱验证码；可选"必须邀请码"；域名白名单；无账号存在性 oracle；关闭时返回统一的拒绝 404）、找回密码、SMTP（发件箱表 + 后台发送，多实例安全）、中英文邮件模板（验证码、重置、支付回执、到期提醒、流量 80%/100%）、邀请归属（`users.inviter_id`、`invite_codes`）。
  - **W16**：优惠券（竞争安全的用量控制）、余额与只追加账本、邀请返佣（冻结期后入账，退款撤销）、提现由人工审批。
  - 仍待办：工单、告警阈值与 Grafana、节点列表轻量视图。
- **合并 W16（panel#34）**。W15 改用迁移号 0110–0114，复用 0105 的 `inviter_id`。W17（工单、告警、节点列表轻量视图）已开工。
- **部署 v0.4.0（2026-10-02）部分完成**：
  - agent v0.4.0 已发布并校验通过；面板在 7508294 部署成功。
  - **M6 自更新在 Debian 13 上失败**：systemd 把 DynamicUser 的 StateDirectory 挂成 noexec，暂存在其中的二进制无法执行。rollout 已 halt/abort，两节点仍在 v0.3.0，在线正常。
  - 面板镜像 ghcr 包仍是私有，需用户在网页上改为 Public。
- <a id="r34"></a>**R34（lead）** 不采用"给可写目录加 ExecPaths"的方案（削弱 W^X，自动权限检查也已拦截）。**W18** 新增 root 一次性更新服务：`.path` 单元触发，只执行已安装的受信任二进制 `-apply-update`，先把暂存文件复制到 root 目录再验签（防 TOCTOU，O_NOFOLLOW），原子替换，失败回滚 `.prev`。现有节点需执行一次重装命令以安装新 unit。另外：面板不得把需要节点证书的入站下发给协议版本 <6 的 agent。CI 增加用真实 systemd 跑自更新的测试。
- **合并 W15（panel#35）**：自助注册、找回密码、SMTP 发件箱、中英文邮件、邀请码。deny.toml 允许 0BSD（lettre 依赖 quoted_printable，无任何条件）。
- 面板镜像 ghcr 包已由用户改为 Public：匿名拉取成功，cosign 验证通过（v0.2.0 = sha256:a3d59dba…）。
- **队列（W17/W18 合并后）**：
  1. Rust 1.98 → **1.99**（用户通知）：同步升级 rust-toolchain.toml、Dockerfile `RUST_IMAGE`、bench/fuzz 子 crate，修新 lint，`make bench` 确认无性能回退；edition 2024 迁移单独评估。
  2. 部署：面板改用 ghcr 镜像（tag+digest），agent 发布 v0.4.1+，两节点各执行一次重装命令以安装 updater unit（需要用户批准写入远程节点），然后补做 hk-1 真实 Let's Encrypt 测试与 W11 生产检查。
  3. 按 W19 UI 走查的问题清单安排修复。
- **W19 UI 走查（2026-10-02）**：报告存档于 `research/ux-audit-2026-10-02/REPORT.md`。1 个阻断、11 个主要、12 个次要问题，另附与 xboard 的功能差距。
- <a id="r35"></a>〔"不做其他支付渠道"已被 R40 取代；界面分工已被 W33-b / W36-b 取代〕 **R35（lead）** 走查修复的分工：
  - **W20（用户侧，现在开工）**：
    - B1：订阅令牌加密存储，链接常驻显示，提供复制、二维码和客户端一键导入；重置订阅链接降为次要操作。
    - M1：门户拆分为多个视图，加导航。
    - M2、M9。
    - 用户侧的次要/润色问题、对比度。
  - **W21（管理端，等 W17 合并后开工）**：
    - M3–M8、M11。
    - 服务端错误改为错误码 + i18n 映射，CI 检查未映射的字符串。
    - 管理仪表盘（营收、注册、待处理事项、节点健康）。
  - **之后**：M10 一键检查更新；公告、知识库、流量日志、余额充值、佣金转余额、手工建单、批量优惠券、站点品牌、可编辑邮件模板。
  - **不做**：除支付宝当面付外的其他支付渠道（用户决定）。
- **2026-10-03 合并**：
  - W18（panel#37、agent#19）：root updater unit，保持 W^X；agent 增加 systemd 自更新的必需检查。
  - W20（panel#38）：订阅令牌加密存储且常驻显示 + 一键导入；门户多视图；两步登录。
  - flaky 修复（panel#42：告警重试的行锁泄漏）。
- **合并中**：
  - agent#20：xray 计数器首连竞争导致漏计（真实少计缺陷）+ gate cutLink。
  - W22（panel#40）：流量日志（暂存表 + 30s 压缩；flush +10–15%）。后续：节点 top users 在 16 并发下 p99 55ms，需优化。
- **WSL 卡死（10-02 22:47）**：/tmp 是 7.7G tmpfs，被写满。改用 `.work/`，见记忆 scratchpad-tmpfs。
- **部署（用户已批准）**：agent v0.4.1 已发布；面板 v0.3.0 发布中 → 生产切换为 ghcr 镜像 → 两节点重装 → agent v0.4.2 做首次生产自更新灰度 → hk-1 LE 测试。
- <a id="r36"></a>〔已被 D11 取代：门户在根路径〕 **R36（2026-10-03，用户选 A）** 隐藏路由前缀保持现状：门户、后台、订阅、安装链接全部在 `/{prefix}` 下，前缀之外一律返回统一的拒绝 404（防主动探测）。不把门户挪到根路径。
- **R35 部署完成（2026-10-03）**：
  - 面板：v0.3.0（ghcr `0.3.0@sha256:6d7ffbb6…`），迁移到 0120，备份 20261002T193006Z。
  - 节点：两节点重装后装上 updater；**首次生产 M6 自更新** v0.4.1→v0.4.2 灰度（waves 50/100）约 10s 成功。
  - hk-1 Let's Encrypt：HTTP-01 8s 签发（sslip.io）；VLESS-WS-TLS、Trojan-TLS、Hy2 在开启证书校验下用 xray 和 mihomo 均连通。
  - lead 账号已重置，凭据在 `~/secrets/akari-lead.*`。
  - 用户 root 密码已重置（只给用户，未存储）。
  - 未完成：W17 告警的触发/恢复测试需重跑（停机 >6 分钟）。
  - 发现：unit 中的 `ProcSubset=pid` 导致机器指标全为 0。
- <a id="r37"></a>**R37（lead）** **W23**：
  - 去掉 `ProcSubset=pid`；读不到的指标显示"未知"而不是 0。
  - updater 随签名二进制下发并安装内嵌的 unit 文件（daemon-reload，回滚时一并恢复），以后改 unit 不再需要重装命令。
  - 修 root 主机的卸载提示；重装后清理残留的 update_status。
  - systemd CI 增加指标断言与 unit 刷新测试。
- 面板 v0.3.0 不含 PR#42、W22，随下一个面板版本发布。
- **合并 W21（panel#39）、W23（panel#44、agent#21）**。部署 v0.4.3/v0.3.1 + 最后一次重装 + 告警测试（用户已批准）进行中。
- **Rust 1.99（panel#45，就绪）**：只改两行，没有新 lint，A/B 测试无回退。等 v0.3.1 打 tag 后合并，避免打乱 release PR。
- **edition 2024 评估**：18 个文件、约 101 行，大头是 `gen` 成为保留字（`crate::gen` 要改成 `r#gen`，建议把生成模块改名为 `pb`）、3 处宏 `expr`、if-let rescope；需要人工审查的是尾表达式临时值的析构顺序（几处 sqlx Transaction）。约半天，低风险，待用户决定。
- <a id="r38"></a>**R38（2026-10-03，用户）** 支付宝配置进后台（W24，系统设置 → 支付，密钥加密存库）；注册时的邮箱验证改为可选开关（未配置 SMTP 时默认关闭）。
- <a id="r39"></a>**R39（2026-10-03，用户："panel.toml 没有必要就删除，不用后备"）** panel.toml 只保留启动必需项（数据库、Valkey、监听/端口、数据目录、日志、metrics 监听等进程级配置）。凡是后台可设置的项，一律从文件中删除，不留后备，不做优先级合并：
  - 支付宝：W24 实施。旧配置首次启动时导入数据库一次并告警，之后忽略。
  - **W25（W24 合并后开工）**：清理 R22 域名（install.public_url、web.sub_domain、grpc.advertise/server_name、trust_cloudflare、cloudflare_ranges）、probe、acme、updates.release_keys（改为内置）、install.* 等所有在后台已有或应进后台的项，用同样的"导入一次 + 告警 + 忽略"迁移方式。最终交付最小的 panel.toml 示例。
- **R37 部署完成（2026-10-03）**：
  - 面板 v0.3.1（`0.3.1@sha256:93f38219…`，迁移到 0135），agent v0.4.3。
  - 两节点做了最后一次重装：unit 与 `-print-units` 字节一致，机器指标真实非零。
  - 告警实测：hk-1 停机约 5 分 38 秒，离线告警按时触发，恢复后解除；用户此前自行配置的 Telegram 收到了触发和恢复两条通知。
- <a id="tag-on-green"></a>**规程（lead）**：
  - **CI 不绿不得打 tag**。这次 v0.4.3 是例外：失败的是测试脚本的竞争问题，与二进制无关；修复在 agent#22。
  - 已派人修复 updater 遇到 systemd start-limit 时回滚慢的问题。
- <a id="r40"></a>**R40（2026-10-03，用户："后面不只支付宝一个接口"；随后决定"先记录，现在不做"）** **已记录，暂缓**。届时按以下设计实施，支付改为**可插拔的支付方式**：
  - `PaymentProvider` trait：create / query / verify_notify / refund? / test_connection。
  - `payment_methods` 表：同一种渠道可配多个实例，配置加密存储，修改要审计，只存数据库。
  - 按支付方式区分回调地址 `/{prefix}/pay/{method_id}/notify`。
  - 订单记录 payment_method_id；付款路径和所有资金不变量保持不变。
  - 结账时可选择支付方式。
  - **备选方案（同日记录）**：
    - A：内置 trait 插件（核心）。
    - B：EPay/易支付兼容协议（一次对接覆盖聚合商的多个渠道；资金经第三方，有托管风险）。
    - C：外部网关 HTTP + HMAC Webhook 协议（不用发版也能接新渠道）。
    - D：运行时 WASM/Lua 插件（不推荐）。
    - E：卡密/兑换码/人工确认（无需对接，配合 W16 余额）。
    - **建议**：A 为核心，先做支付宝 + 通用 EPay，加上兑换码（E）；C 按需；D 不做。
    - **用户选定：A（内置 trait 插件），现在就做（2026-10-03）**。首个 provider 为支付宝当面付，由 W24 实施，同时完成 R38/R39 的支付宝部分。
  - 现阶段 W24 只做支付宝后台配置（只存数据库），代码保持自包含，便于以后抽象；框架和其他渠道等用户重新启动时再做。
- <a id="r41"></a>**R41（2026-10-03，用户确认方案、已排期，等用户说"开始"再动工）W26：协议层模块化**
  - **目标**（用户）：加协议快、少出错、为 sing-box 第二内核做准备、可维护性。
  - **架构**：
    - 能力清单 `protocols.toml` 作为唯一数据源，放在 proto 目录，同步给 agent，由 CI 校验两边一致。清单里定义字段、合法组合、各客户端和订阅格式的支持情况。由它生成：后台表单、校验规则、DEPLOY 支持矩阵、两边的表格驱动测试。
    - 协议模块（vless / vmess / trojan / ss2022 / hysteria2）× 传输模块（tcp / ws / grpc / httpupgrade / xhttp）× 安全模块（none / tls / reality），组合产出**内核无关的中立入站模型**。CI 禁止中立模型里出现内核专有字段。
    - 内核适配器：现在只实现 xray，sing-box 以后只需新增一个适配器。
    - 订阅渲染器基于中立模型生成。
  - **分阶段**（每阶段可单独合并）：
    1. P1：录制金标准快照（所有组合的三格式订阅 + xray 配置）。
    2. P2：能力清单 + 生成文档矩阵和测试表。
    3. P3：面板侧模块化 + xray 适配器，输出与金标准逐字节一致。
    4. P4：agent 按协议拆模块、按清单驱动金丝雀测试。
    5. P5：后台表单改为由清单生成（常用协议可定制）。
  - **估计**：约 4–5 个 worker 日；在 W24 和快照竞争修复合并之后进行。
- **REVIEW-2026-10-02 落地（2026-10-03，用户指派两个云端 agent）**：
  - **面板云端 worker**：C1（argon2 放到 spawn_blocking 并用信号量限并发）、C3 面板侧（gRPC 消息上限 64 MiB + snapshot 大小指标）、C4（TLS 握手并发上限）、W3（流量 key 改用 Uuid）、W4（复用摘要 / 借用 UserSet）、W5（has_shadowsocks 零拷贝）、W9（心跳管道化、毒化策略统一、限速器本地兜底）。不拆分 api.rs（W10），避免与进行中的分支冲突。
  - **agent 云端 worker**：C2（有界发送）、C3 agent 侧（接收上限 64 MiB）、W1/A（预解析计数器，只上报变化行）、W2（state hash scratch buffer）、W6（退避抖动）、W7（无锁在线计数）、W8（Rebuild 时跳过空移除）。
  - 两边互不依赖，无 proto 变更。合并前由 lead 审查；本地正在进行的 W24（支付）/ 竞争修复可能与之有轻微冲突，后合并的一方变基。
- <a id="pause-1003"></a>〔已恢复〕 **暂停（2026-10-03，用户）**：本地正在进行的 W24（支付插件 + 可选邮箱验证）和快照竞争修复完成后，**本地工作暂停**：不再开新的本地 agent，也不部署。W25、v0.3.2/v0.4.4 发版部署、运营功能等都等用户恢复。两个云端会话（REVIEW-2026-10-02）照常进行。
- **合并（2026-10-03）**：
  - panel#49（快照竞争修复）。
  - panel#48 W24（插件式支付框架 + 支付宝；可选邮箱验证；PoW 人机验证）。
  - agent#24（REVIEW-2026-10-02 agent 侧，云端会话完成）：
    - C2 有界发送，C3 64 MiB，W1 只上报变化行（闲置时 0.25 ms / 0 次分配），W2 / W6 / W7 / W8。
    - lead 核对：面板的 traffic_counters 只按会话墓碑清理，不受"闲置行不刷新"影响。
  - 待合并：面板侧云端会话的 PR。W25（精简 panel.toml）的提示词已交给用户，用户发到云端会话执行。
- **REVIEW-2026-10-02 全部落地（2026-10-03）**：
  - panel#50（squash 合并；分支内含合并提交，无法 rebase 合并）：
    - C1 argon2 改为 spawn_blocking + 信号量（许可在阻塞闭包内持有，取消请求不会突破上限）。
    - C3 AgentChannel 64 MiB / AgentEnrollment 64 KiB，并记录 snapshot 大小指标。
    - C4 握手上限 1024。
    - W3 session key 用 Arc<str>（不用 Uuid：协议允许任意 id，retention 按原文比对）。
    - W4 增量 diff 复用摘要（−40%）；W5；W9（心跳管道化、限速器本地令牌桶兜底）。
  - 删除了重复云端会话遗留的无 PR 分支 fix/review-1002-panel。
  - 两个云端会话的 routine 均为一次性，已执行完毕。
- **合并（2026-10-03，云端开发 + 本地集成）**：
  - panel#52 W25（R39，panel.toml 最小化）。
  - panel#51（一键检查 agent 更新、节点 top users 改用覆盖索引）。
  - panel#54（批量操作、CSV 导出、手工建单、批量优惠券；T1）。
  - panel#53（公告、知识库、站点品牌、可编辑邮件模板）。
  - 集成说明：
    - 0155 和 0168 两处 outbox kind CHECK 已互相补齐。
    - admin_notice 纳入可编辑模板体系（lead 认可）。
    - 遗留问题：signup 测试的 Valkey 限速键没有按测试库隔离，共享开发 Valkey 时反复跑会失败；CI 不受影响，待修。
- 下一步：会话 D（rustfmt 2024 风格）提示词已交给用户，由用户发到云端会话执行。发版部署（v0.3.2 / v0.4.4）等用户批准。
- **W26 协议层模块化完成（2026-10-04，云端会话）**：
  - panel#56：P1 金标准快照 + P2 `proto/protocols.toml` 能力清单与生成器。
  - agent#25：P4 按协议拆分模块，金丝雀场景由清单驱动；清单中的 xray 版本必须与 go.mod 一致。
  - panel#57：P3 中立模型 + xray 适配器 + 由模型渲染订阅；P5 由清单生成后台表单。
  - 金标准逐字节一致；无 proto/状态哈希变更；订阅渲染快 3–15%。sing-box 适配器所需工作见 #57 正文。
  - 同期合并：panel#55 rustfmt 2024 风格（lead 反向格式化验证：只有格式变化）。
- **合并（2026-10-04）**：
  - panel#58 面板一键安装器：
    - 裸机 / Docker 交互式安装，cosign 校验；`akari-ctl` 支持升级（失败自动回滚）、卸载、裸机⇄Docker 迁移、换机。
    - CI 在 Debian 13、Ubuntu 24.04 systemd 容器中做端到端测试，并测了带真实 agent 的迁移。
  - panel#59：测试用假 Telegram token 换掉。密钥扫描告警 #1 已标为 used_in_tests 关闭。
- **待决**：akari.cc 是旧方式部署的 Docker compose，需评估能否纳入 `akari-ctl` 管理；面板 v0.3.2 / agent v0.4.4 的发版部署等用户批准。
- <a id="vps-reinstall-1004"></a>〔已被 PLAN-v0.4 §4 测试环境取代〕 **2026-10-04 用户决定**：两台 VPS 用 bin456789/reinstall 重装 Debian 13（重装前已备份到本机 `~/secrets/backup-before-reinstall/`）。**面板和 agent 由用户自己用 v0.3.2 一键安装器安装并测试**；lead 不再执行 akari.cc 部署，只负责发布 v0.3.2 并提供安装命令，按用户的测试反馈修复问题。
- **发布（2026-10-04）**：
  - agent v0.4.4（tag 在 8645d61）。
  - 面板 v0.3.2（tag 在 5c5b331；镜像 `0.3.2@sha256:1669fac2…`）。首个带 `install.sh` 的正式版本。
  - lead 校验：SHA256、cosign（8 个资产 + 镜像）、匿名拉取镜像 manifest（200）、latest/download/install.sh 与 v0.3.2 资产一致、二进制版本为 0.3.2。发布说明已补。
  - 用户将在重装后的 95.40.55.149 / 18.162.147.173 上自行安装测试。
- **2026-10-04 用户实测反馈 → 开发计划 `PLAN-v0.4.md`（待用户批准）**：
  - 19 条反馈（原文无 5、6 两条）拆成：
    - 阶段 A：W27 身份与登录、W28 节点与授权、W29 节点审计规则、W30 订阅兼容、W31 系统状态与 SMTP、W32 agent BBR 与 Alpine。
    - W33 后台重写（T0）。
    - 中转服务器设计 R42（需用户批准）。
    - 性能 / 稳定性 / 容量测试 → 代码质量 → red team（用户要求恢复）→ 面板 v0.4.0 / agent v0.5.0。
  - 待用户拍板 D1–D7。sing-box 和客户端继续搁置。
  - 测试服务器：面板 89.106.76.46；节点 95.40.55.149、18.162.147.173。全部清空重装，密码不落盘。
- <a id="r42"></a>〔已被 R42 修订 2 / D6 取代〕 **R42（2026-10-04，用户批准）中转节点**：
  - 节点类型分为直连 / 中转；中转支持外部中转（不装 agent）和托管中转（agent 托管 realm）两种模式。
  - 落地机为每个中转节点开专用入站，并设来源 IP 限制，确保低价套餐无法使用中转。
  - 按中转节点的倍率计费。已与 Xboard 的父节点做法对比。
  - 由 W34 实施。**用户要求：开发计划暂不实施，先审阅 PLAN-v0.4.md**（D1–D9 待确认）。
- <a id="r42-rev1"></a>〔并入修订 2；托管中转仍暂缓〕 **R42 修订（2026-10-04，用户）**：中转节点本期**只做外部中转**；托管中转（agent 托管 realm）暂缓。
- <a id="r42-rev2"></a>**R42 修订 2（2026-10-04，用户）**：中转改为落地节点下的"入口"，只管理一个落地节点，避免"一个节点两处管理"。权限按入口（节点组 → 入口）授权，倍率设在入口上；W34 与 W28 合并实现。
- **PLAN-v0.4.md 定稿（2026-10-04）**：D1–D9 已获用户确认（"没有问题了"）。中转已并入 W28。阶段顺序：A 后端 → B 后台重写 → C 性能 → D 代码质量 → E red team → 发版。**用户说"开始"后才实施。**
- <a id="d10"></a>**D10（2026-10-04 追加）**：自动清理从未使用的账号（默认关闭，N 天可配，可选删除前邮件提醒），后台增加"从未使用"筛选和批量删除。由 W27 实施，删除逻辑与自助注销一致。
- <a id="d11-risk"></a>〔已撤回，见下一条〕 **D11（2026-10-04，用户确认）订阅风控**：拉取信号和节点并发来源信号（中转入口可选 PROXY protocol）计算风险分，分级处置默认只告警，网段哈希短期保存。由 W35 实施（panel + agent）。
- **D11 撤回（2026-10-04，用户："不做了"）**：订阅风控（W35）不做，已从计划中移除。
- <a id="agent-perf"></a>**原则（2026-10-04，用户）**：agent 的性能优先，不再增加不必要的开销。改动 agent 的 PR 必须附上前后基准，回退超过 5% 不合并；能放在面板或内核做的不放在 agent 用户态。W29 审计规则按节点开关，默认关闭。
- <a id="d11-v1"></a>〔已被下方 D11 修订取代〕 **D11（2026-10-04，修订 R36）**：门户秘密前缀改为可选开关，默认开启。关闭后门户在主域名根路径提供；后台始终使用 D4 的独立前缀；订阅地址与前台前缀解耦，切换不影响已发出的链接。由 W27 实施。
- <a id="d11-v2"></a>〔已被下一条取代〕 **D11 修订（2026-10-04，用户）**：**取消前台秘密前缀**，门户直接在主域名根路径提供（取代 R36）；后台仍用 D4 的独立前缀。订阅、安装、支付回调改用安装时随机生成、全站共用的一段路径（不按用户随机）；修改后旧值继续有效。
- <a id="d11"></a>〔"旧值继续有效"已被 D11 补充取代〕 **D11 修订（2026-10-04，用户）**：**取消前台秘密前缀**，门户直接在主域名根路径提供（取代 R36）；后台仍用 D4 的独立前缀。订阅路径由固定的 `/sub/` 改为安装时随机生成（全站共用），后台可自定义；修改后旧值继续有效。
- <a id="d11-sup"></a>**D11 补充（2026-10-04，用户）**：订阅路径修改后，旧值立即失效，不再支持；修改前需要二次确认，并写入审计。
- **W36（2026-10-04，用户追加）前台替换为 Akari-theme**（mwnydev/Akari-theme，私有；用户已把 xboard API 改为 mock）。W36-a 在主题仓库中审查清理：删除混淆、违反 CSP 的内联脚本、xboard 遗留、旧浏览器和旧存储兼容代码、不当依赖，客户端 markdown 渲染改用服务端已消毒的 HTML。W36-b 整体替换现有门户并删除旧门户代码。
- <a id="w37"></a>**W37（2026-10-05，用户同意）CI 分级**：每个 PR 只跑快速检查；重型检查按改动范围触发；T1 的 PR 加 full-ci 标签跑全套；每晚和发版前跑全套。worker 不再在本地跑 smoke 和 e2e，全部交给 GitHub Actions。
- **PLAN-v0.4.md 重写为开发说明（2026-10-05）**：删除已撤回的内容；发信改为 SMTP（商家已开通端口）+ Resend API（不做 Gmail API）；结构调整为：开发规则 → 决定 D1–D12 → 任务卡（含依赖和验收）→ 测试环境 → 中转规格 → 执行顺序，方便 Claude Code 直接按卡开发。
- **PLAN-v0.4 开工（2026-10-05，用户："开始"）**：阶段 0（数据库架构分析）与 W37（CI 分级）并行启动；W37 只改 CI，不依赖阶段 0 结论。阶段 A 仍等用户审阅 `research/db-schema-review.md` 后开始。
- <a id="r43"></a>**R43（2026-10-05，用户确认）中转计数标识**：每个入站的用户条目以"用户 UUID + 入口 ID"为 xray 计数标识（email 字段），面板按入口 ID 取倍率结算。**不按来源 IP 计数**：直连入口无固定 IP；中转出口 IP 可能共用或变更；按 IP 统计需要 agent 用户态逐连接查表，违反 agent 性能原则。来源 IP 只用于 nftables 白名单。由 W28 实施。
- **交接遗留项归属（2026-10-05）**：signup 测试 Valkey 限速键未按测试库隔离 → W27；安装器 arm64 端到端 CI → 阶段 D。
- <a id="phase0"></a>**阶段 0 通过（2026-10-05，用户："按建议"）**：`research/db-schema-review.md` 结论为局部重构、不整体重设计。Q1：新建 `servers` 表，一台机器 = 一个 agent；Q2：D5 流量额度挂在服务器上，超额时该服务器所有节点下发空配置；Q3：日流量与套餐月重置改用全站时区（`panel_settings.timezone`，默认 Asia/Shanghai，与 D9 共用）；Q4：资金表快照列只存不含个人信息的标签，展示时 JOIN users，账本保持只追加。**压缩迁移历史**：0001–0168 合为 `1000_baseline.sql`，单独 PR 先于阶段 A；v0.3 库启动即拒绝（需全新安装）。迁移编号：W27 1010–1029、W28 1030–1059、W29 1060–1064、W30 1065–1069、W31 1070–1074、W32 1075–1079、W33 1080–1084、W36 1085–1089、阶段 C–E 修复 1090–1099；proto 字段号不变。
- **云端任务（2026-10-05）**：W33-a 后台设计稿、W36-a 主题审查清理交给两个云端会话（与本地仓库无文件交集）。
- **W37 已合并（2026-10-05）**：panel #62、agent #26。实测只改文档的 PR 约 7.5 分钟全绿；改后端触发 smoke（约 12 分钟）；`full-ci` 约 18 分钟。发版前 release.yml 以 workflow_call 跑全套 ci + fuzz，通过才发布。agent 的跨仓 smoke 已加入必需检查。遗留：面板夜间 fuzz 10-04 在 90 分钟超时被取消 → 阶段 D 调整（提高超时或缩短每目标时长）。
- <a id="w33a"></a>**W33-a 设计稿通过（2026-10-05，用户："按建议"）**：workspace PR #5。设计问题裁决：①每用户随机订阅域名默认关；②服务器流量额度按网卡流量计（与服务商账单一致）；③封禁用户可登录门户，只看封禁原因和工单；④"延长 N 天"只用于周期套餐，不用于一次性流量包；⑤管理员仅通行密钥登录不强制 2 个密钥，提示风险，丢失后服务器命令行恢复；⑥改订阅路径时提供"邮件通知所有用户"，默认勾选；⑦批量删除支持"勾选的"和"全部匹配的"（显示数量 + 二次确认）；⑧手机表格改卡片列表；⑨其余页面 W33-b 直接套新外壳，不补设计稿；⑩审计规则内容经 xray 路由 API 热更新、不断线，只有开关节点审计时重建该节点入站。
- <a id="w36a"></a>**W36-a 已合并（2026-10-05）**：mwnydev/Akari-theme PR #1（去内联脚本、去 xboard 遗留、依赖 325→99、markdown 改服务端 HTML、体积预算与 CI）。W36-b 接入裁决：提现映射到面板已有的提现接口；通行密钥登录保留（W27 提供接口）；会话 / 设备管理、公开节点状态页、`clientBridge` 删除（不新增面板接口）；`SiteConfig` 映射 `/auth/options`。主题按旧的 `/{prefix}/app` 前缀做了相对路径适配，D11 后门户在根路径，W36-b 可重新开启 modulePreload 并简化 check-dist。
- **迁移压缩已合并（2026-10-05）**：panel #65，基线 `1000_baseline.sql`，v0.3 库启动即拒绝。阶段 A 派发：本地 W27、W28-a、W28-c（W32 已在做）；云端 W29、W31。W28-b（D9 倍率、D5 额度按网卡流量）与 W30 等 W28-a 合并后再派。
- **合并（2026-10-05）**：panel #69（smoke 等 Caddy 主域名证书，修竞态）、agent #30（klauspost/compress 1.18.7，GO-2026-5841）、agent #29（CA 拒绝 ARI replaces 时同次续期去掉重下）。W31 panel #67、W29 panel #68 审查通过，排队合并。W29 跟进项：`node_block_daily` 按 UTC 日，W28-a 合并后改用全站时区（Q3）；`maybe_send_block_policy` 每次唤醒按节点查库编译策略，节点多时改为全局编译缓存（阶段 C 视压测结果）。
- **W32 已合并（2026-10-05）**：panel #66（节点安装器 Alpine/OpenRC + BBR/fq，`--no-bbr` 可关，卸载恢复原值）、agent #28（OpenRC 服务与更新器，`-init openrc`）。基准无回退（二进制 +0.07%）。OpenRC 已知差距见 DEPLOY §3h（更新器无沙箱、agent 无 syscall 沙箱、日志为文件）。agent 必需检查新增 "openrc self-update"。W31 panel #67 已合并。W28-c #71 审查通过（`{confirm:true}` 用于单用户确认，认可），rebase 中。
- <a id="xray-ghsa"></a>**xray-core GHSA-5wf9-h793-w73c（2026-10-05，用户："不管它，等上游更新"）**：agent Dependabot #1（pinnedPeerCertSha256 的客户端 TLS 校验缺陷）。agent 只跑入站 + freedom/blackhole 出站，不发起 TLS 连接，不用 pinnedPeerCertSha256，不受影响。修复仅在上游主干（2026-07-10），未发正式版；等 xray 下个正式版再升级（附基准与全量 CI），警告保持 open 不 dismiss。
- <a id="strict-off-1005"></a>〔已取代：strict 于 2026-10-06 恢复〕 **分支保护（2026-10-05，用户执行）**：panel 与 agent 的 main 关闭 "Require branches to be up to date"（strict=false），其余保护不变。无冲突的 PR 直接合并（仍用 rebase 保持线性），main 合并后跑全套 CI 兜底；发版前 release.yml 再跑全套。
- <a id="serial-1005"></a>**开发节奏调整（2026-10-05，用户："太乱了，重复很多工作，太浪费时间，开发太激进"）**：
  - 收尾当前 PR：#68 → W27 系列（#70 → #74 → #75）→ W28-a 系列（#73 → #76 → #77）。W28-a 暂停到 W27 系列合并后再 rebase 一次。
  - 收尾后重新开启 main 的"合并前分支必须最新"（strict=true）。
  - 之后**串行开发**：面板同一时间只有一个 T1 任务（一个 worker），一个 PR 合并后才开下一个；不再做堆叠 PR；只有不碰面板 / agent 同一区域的任务（主题仓库、设计稿、纯文档）才可并行。
  - 后续顺序：W27 剩余（域名 / 前缀 / 订阅路径、D10 清理、自助注销）→ W28-a 剩余（时区与分区、agent PR）→ W28-b → W30 → W33-b → W36-b → 阶段 C/D/E。
- <a id="proto-merge-rule"></a>**W29 全部合并（2026-10-05）**：panel #68、agent #32（云端会话作者；本地 agent rebase + 修 XHTTP 切换的偶发 canary：明文 XHTTP 在开关切换时"可能"断线）。panel #78：fuzz 夜间 240s/目标、超时 150 分钟、超 120 分钟预算自动降秒数。跟进：DEPLOY §3h 改为"明文 XHTTP 可能断开"（随下个文档 PR）。规则补充：改 proto 的任务，面板与 agent 两个 PR 紧挨着合并，中间不插其他 PR（避免 agent main 的 check-proto 变红）。
- <a id="w27-deps"></a>**W27-1/2/3 合并（2026-10-06）**：#70（邮箱身份、删 TOTP、master.key、快照标签）、#74（注册开关、Turnstile、蜜罐 + 最短提交时间）、#75（通行密钥 + 登录方式策略，`akari admin reset-login`）。**依赖裁决（用户同意）**：webauthn-rs 家族 MPL-2.0（deny.toml 逐 crate 例外，不修改其源码）；面板二进制引入 vendored OpenSSL，仅用于通行密钥签名校验，TLS 仍为 rustls；OpenSSL 公告由 cargo-deny/Dependabot 跟踪。跟进：`totp` 模块与 `state.totp()` 改名为 master-key（W27 剩余部分）；Turnstile 组件与 CSP 放行 challenges.cloudflare.com、隐藏蜜罐输入框归 W36-b。顺序：W28-a（新 agent，先 rebase #73）→ W27 剩余（W27-4 本地分支 w27-paths、自助注销、D10、D8）。
- <a id="r44"></a>**R44（2026-10-06，用户选 B）nftables 来源白名单的权限**：agent 进程**不拿** `CAP_NET_ADMIN`。agent 只把解析、规整后的过滤规则写到状态目录的请求文件；由已有的 root 更新服务（systemd path 单元 / OpenRC 更新循环）校验后用 `nft -f` 应用，并把结果写回供 agent 在心跳里上报。生效延迟秒级可接受。agent #31 按此改造（去掉 unit 中的 CAP_NET_ADMIN，面板 #76 的单元副本同步）。
- **W28-a PR1/PR2 合并（2026-10-06）**：panel #73（一节点一入站、直连入口、只按套餐授权、按入口计费）、panel #76 + agent #31（中转入口、派生入站、按入口计数键 `<user>#<n>`、协议 7、R44 白名单由 root 更新服务应用）。GitHub Actions 10-05 19:45–22:00 UTC 故障期间大量任务被取消（非代码问题）。#77（入口健康检查）交给云端会话；PR4（时区与分区）与"服务器"拆分（Q1）随后串行。
- <a id="serial-queue"></a>**串行队列（2026-10-06，用户："切勿再发生 PR 冲突"）**：面板 + agent 同一时间只有一个打开的 PR（成对的 proto PR 视为一个）；下一个任务在上一个合并后才从最新 main 开分支；云端会话不再与本地并行改面板 / agent。#77 合并后恢复 strict 分支保护。队列：①W28-a PR4 时区与 traffic_daily 分区 → ②W28-a 服务器拆分（Q1，含 D5 额度挂服务器的结构准备）→ ③W27-4 门户根路径 / 后台前缀 + 白名单 / 订阅路径（本地分支 w27-paths）→ ④W27 D8 多域名 → ⑤W27 自助注销 + D10 清理 + totp 模块改名 → ⑥W28-b D9 时段倍率 + D5 额度 → ⑦W30 订阅兼容 → ⑧W33-b → ⑨W36-b → 阶段 C/D/E。每完成一个系列在 main 上跑一次完整检查。
- **#77 合并（2026-10-06）**：W28-a 入口健康检查（云端会话）。panel 与 agent 的 main 已恢复 strict（合并前分支必须最新）。本地开始队列 ①：W28-a PR4 时区 + traffic_daily 按月分区（单一 worker、单一 PR）。
- <a id="alipay-keymode"></a>**支付宝签名模式（2026-10-06）**：开放平台写明"密钥模式普遍适用；证书模式仅在使用现金红包、单笔转账到支付宝时必选"。当面付收款与退款（alipay.trade.refund）用密钥模式即可，面板现有实现无需改动。证书模式只在将来做"提现自动打款到支付宝"时才需要，届时随该功能实现。可选待办（低优先级）：面板内直接调用退款接口（密钥模式）。
- <a id="p1-refund"></a>**问题记录 P1（2026-10-06，用户报告）退款后订单开通的套餐未取消**：现状是设计如此（PAYMENTS.md "Refunds (admin)"：退款只退钱、撤销待结佣金，套餐不动，需管理员另去用户页取消），但运营上不合理——用户拿回钱仍可继续使用。修复方案（lead 决定）：退款同时撤销该订单带来的订阅效果，在一个事务内完成，写审计——①订单开通的新订阅：结束该订阅（status cancelled），用户踢线；②续费订单：把到期时间回退该订单增加的时长（不早于 now，回退后已过期则按过期处理）；③流量重置包：不回滚已用流量（无法撤销已用量），只退款；④升级补差价订单：恢复到升级前的套餐与到期时间。退款对话框显示"将撤销的订阅效果"预览，提供"仅退款、保留套餐"选项（默认不勾）。T1（资金）。排在队列 ① W28-a PR4 之后、② 服务器拆分之前。
- <a id="ops-review"></a>**运营逻辑审查（2026-10-06）**：`research/ops-logic-review.md`，21 项（高 3、中 9、低 9），均按 origin/main 代码核实。处理（lead 按用户授权"按你的建议"决定）：
  - **批次 A（T1，资金规则，与 P1 合并为一个任务）**：P1 退款撤销订阅效果 + 高-2 折算按实付金额（扣优惠券 / 赠送，排除已退款订单）+ 中-3 支付宝后台退款登记实际金额 + 中-4 佣金追回不受冻结期限制（已提现则记为负余额，下次结算抵扣）+ 低-2 退款释放优惠券次数、已退款订单不算首单 + 低-1 取消 / 退款后不再发到期提醒 + 退款通知邮件。
  - **批次 C（T1）**：高-3 重置订阅时同时轮换节点凭据并踢掉旧凭据的连接（smoke 验证）。
  - **批次 B（T1，套餐生命周期，默认值由 lead 定）**：高-1 换套餐折算 = 实付 × min(剩余时间比例, 剩余流量比例)，新套餐额度重新开始；中-1 一次性/不重置套餐续费 = 新周期新额度；中-2 下单时预占库存（待支付超时释放），付款时仍超卖则自动退到余额 + 邮件 + 管理员告警；中-5 套餐条款在购买时快照到订阅，改套餐只影响新购买，后台可选"同时应用到现有用户"并预览影响人数；中-6 下架只停止新购，现有用户可续费和买重置包（开关，默认允许）；中-7 删除用户前给出影响摘要（余额、待审提现、待付订单、有效套餐）并二次确认；低-4 迟到付款若用户已另购套餐则转为余额。
  - **批次 D（通知与体验）**：中-8 账户类通知发到登录邮箱，不要求已验证（营销类仍需验证）；中-9 封禁、退款、改 / 取消套餐、提现结果、佣金入账通知；低-3/5/6/7/8/9 并入 W33-b/W36-b 或阶段 D。
  - 队列调整：① W28-a PR4（#80）→ **A（含 P1）→ C → B** → ② 服务器拆分 → 其余不变；D 随 W33-b/W36-b。
- <a id="queue-3pr"></a>**队列压缩（2026-10-06，用户同意）**：阶段 A 剩余合为 3 个大 PR（按代码领域，不冲突）：**①资金与套餐**（批次 A 含 P1 + C 凭据重置 + B 套餐生命周期）→ **②节点与订阅**（服务器拆分 + W28-b D9/D5 + W30；面板 + agent 一对）→ **③入口与账号**（W27-4 路径/前缀/订阅路径 + D8 多域名 + 自助注销 + D10 + totp 改名）。之后 W33-b、W36-b 各 1–2 个，阶段 C/D/E 各 1 个，发版 2 个。**CI 规则**：worker 本地做完整批（只跑快速检查）再推送；中间推送只跑分级检查；合并前最后一次加 `full-ci`。PR 内按功能分提交，lead 按提交审查（资金部分逐行）。
- **W28-a 全部合并（2026-10-06）**：#80 时区（Q3）+ traffic_daily 按月分区（含 rollup 事务未提交的并发 bug 修复；安装器恢复改为先删库重建再无 --clean 恢复）。开始阶段 A PR①"资金与套餐"（单一 worker）。CI 提速 PR 并行（只改 workflows / Dockerfile / installer-test）。
- <a id="period-end"></a>**裁决（2026-10-06，lead）**：`akari_period_end`（套餐周期结束）按全站时区的自然月计算，与 Q3 的流量日界和月重置一致（否则 1 日凌晨购买的月付会在本地 29 日结束）。认可 #80 的做法。跟进：SPA 默认日期范围仍写死 Asia/Shanghai，改为用接口返回的 `timezone`（W33-b/W36-b）。
- <a id="ci-speedup"></a>**CI 提速合并（2026-10-06，#81）**：完整 CI 24.9 → 14.4–14.9 分钟（热缓存）。单一 build 任务编译一次、产物共享；`[profile.ci]`（无 LTO，16 codegen units，opt 3，仅 CI 用，发版不变）；Dockerfile 加 cargo-chef 依赖层 + GHA 层缓存（只有 main 写）；rust-cache 只由 main 保存；Alpine rustc 预载 mimalloc。发版产物逐字节一致。裁决：CI 保持 opt-level 3。跟进（阶段 D 或 smoke 分层时）：install.sh 在纯 IP 安装时 `check_proxy` 三次 60s 超时、`wait_health` 在故意损坏的版本上等满 120s，可再省约 4 分钟；smoke 拆分并行在①合并后做。
- <a id="pa1"></a>**阶段 A PR① 合并（2026-10-06，#83，rebase 合并保留 16 个按项提交）**：15 项全部完成（P1 退款撤销订阅效果、实付折算、外部退款登记实际金额、佣金追回、退款退还优惠券、退款通知、凭据随订阅重置轮换、折算计剩余流量、一次性套餐续费给新额度、预占库存与付款无法开通自动退余额、套餐条款购买时快照、下架只停新购、删用户影响预览 + confirm、迟到付款不替换新套餐）。新接口：`GET /orders/{id}/refund-preview`、`POST /plans/{id}/impact`、`GET /users/{id}/delete-impact`；`DELETE /users/{id}` 需 `?confirm=true`。lead 认可 worker 的 5 个取舍：①自动退余额覆盖售罄 / 套餐停用或删除 / 重置包对应套餐已不持有 / 迟到付款，管理员手工标记的付款不自动退；②周期重置套餐按当期剩余流量比例封顶折算（只会更低）；③apply_to_existing 复制套餐当前全部条款；④renew_off_sale 按套餐设置、默认开；⑤删用户用独立预览 GET + confirm。注：首个提交单独不全绿（第 3 个提交修复测试夹具），不影响 main。下一个：PR② 节点与订阅。
- <a id="portal-gap"></a>**前台差距分析（2026-10-06）**：`research/portal-gap.md`。面板 60 项用户功能对 Akari-theme：匹配 3、需改 35、缺失 22；主题独有 20 项（除已裁决删除的外，token2Login、邮箱验证码登录、通行密钥注册 / 迁移、佣金转余额、按用户的邮件提醒开关、手续费、Surge/Loon 导入等）一律删除。lead 裁决：主题改 BrowserRouter，路由表与 ③ 统一（兼容邮件里的 `/app/reset#token=` 等链接的迁移方案随 ③ 定）；二维码中心 logo 改为静态文件（CSP 禁 data:）；批准面板在 `/me`、`/auth/options` 返回 `timezone`，`MyOrderView` 增加 `action`；Turnstile 的 CSP 放行 challenges.cloudflare.com 只在开启 Turnstile 时生效。W36-b 拆为 2 个 PR：主题适配层 + 全部缺失功能；面板切换新门户 + 删除旧门户。**待用户决定**：主题仓库私有、面板公开，面板 CI 如何拿到门户源码。
- <a id="r45"></a>〔已被 R45 修订取代〕 **R45（2026-10-06，用户选 A）门户源码位置**：Akari-theme 并入面板仓库（`portal/` 目录，公开），之后在面板仓库开发；面板 CI 直接构建门户、跑 e2e。执行：W36-b PR1 先在主题仓库完成适配层 + 全部缺失功能（与面板改动无交集，可与 ② 并行）；W36-b PR2 把主题源码导入 `akari-panel/portal/`、切换门户、删除旧门户（排在 ③ 之后）。导入后主题仓库归档只读。
- <a id="r45-rev"></a>〔"旧后台挪到 admin/"已被 2026-10-07 前后台并行条取代〕 **R45 修订（2026-10-06，用户）**：不新建 `portal/` 目录，新前台**直接替换 `akari-panel/spa/` 里的原前台**（spa/ 成为门户应用，构建配置和依赖以主题为准）。spa/ 里现有的旧后台页面在 W36-b PR2 中原样移到独立的 `admin/` 应用（各自打包，满足 check-bundles"门户产物不含后台代码"），等 W33-b 重写后台时再替换。
- <a id="alipay-refund"></a>**支付宝原路退款（2026-10-06，用户："不要增加 PR"）**：后台退款时直接调用 `alipay.trade.refund`（密钥模式）原路退回，成功后自动登记金额、撤销订阅效果、通知用户；支持部分退款，带 `out_request_no` 幂等、失败可重试、对账。**并入 PR③**（③ 本来就要改支付回调使用首选主域名，D8）。"单笔转账到支付宝"（证书模式）暂不做，等用户决定。
- <a id="refund-options"></a>**补充（2026-10-06，用户）**：原路退回支付宝是**可选项**。退款对话框三选一：①原路退回支付宝（调接口）②退到余额 ③仅登记（已在支付宝商家平台手动退，填写实际金额）。支付渠道设置里有开关"允许原路退款"（默认开）；关闭或渠道不支持时只显示 ②③。
- <a id="r46"></a>**R46（2026-10-06，用户）佣金提现方式**：不做"单笔转账到支付宝"（证书模式）。佣金提现**只支持 USDT**，由用户选择链并填写地址，管理员在 OKX 手动打款后回填交易哈希。lead 定细节：可选链由管理员在设置里勾选，默认开启 OKX 上常用且手续费低的 TRC20（Tron）、Polygon、Arbitrum One、Solana、X Layer、TON；每条链按格式校验地址（TON 支持 memo/tag）；提现单记录链、地址、申请时的 CNY 金额；管理员审批时填写实际 USDT 金额与 txid（审计），可配置参考汇率仅作展示；地址只给本人和管理员看。现有其他提现方式代码删除。**并入 PR③**（不新增 PR）。
- <a id="r46-plasma"></a>**R46 补充（2026-10-06，用户）**：USDT 提现可选链加入 **Plasma**（USDT 专用链，EVM 兼容，地址按 0x 格式校验），默认开启。
- <a id="sub-format-switch"></a>**订阅格式开关（2026-10-06，用户）**：目前没有开关。并入 PR②（W30 部分）：后台"订阅"设置里按格式开关（Clash/mihomo、sing-box、通用 base64 / v2rayN、Shadowrocket、Stash、Hiddify 等），以及门户"一键导入"按钮按客户端开关；关闭的格式请求一律返回统一 404（不暴露"已关闭"）；默认全开。将来自有客户端（akari-client，席位绑定）完成后，运营者可关闭全部第三方格式，只保留自有客户端的 Clash 格式通道（呼应战略决策 2）。
- <a id="strategy2"></a>**战略决策 2 修订（2026-10-06，用户）**：原"订阅接口是过渡期产物，终态只保留给 akari-client 的 Clash 格式"改为"第三方客户端订阅由后台开关决定是否启用（按格式 / 按客户端，默认开），akari-client 完成后由运营者选择是否关闭"，保留弹性。已同步工作区 CLAUDE.md。
- <a id="w36b-pr1"></a>**W36-b PR1 合并（2026-10-06，Akari-theme #2，squash）**：主题接入真实接口（cookie 会话、UUID、RFC 3339 + 站点时区、分为单位、服务端报价），84 个用户错误码中英映射 + `check:errors`；登录 / 注册（邮箱码或 PoW）/ 重置 / 蜜罐 / 最短提交时间 / Turnstile / 真实 WebAuthn + passkey_prompt；账号状态（续费范围、封禁只看原因与工单）；商店、支付宝二维码轮询、退款显示、钱包（流水、提现）、邀请；邮箱变更与验证、订阅格式选择、按入口倍率、流量、工单、公告与知识库；删除全部主题独有功能；BrowserRouter + `VITE_PORTAL_MODE`；二维码 logo 静态化。e2e 22/22 对真实面板（d907f52）通过，无 CSP 违规。依赖 ②③ 的功能在 `VITE_PANEL_FEATURES` 标志后（`src/api/planned.ts`），PR2 核对接口形状；钱包提现按 R46（USDT + 链）在 PR2 调整。裁决：主题条款页写死的"订单一律不退款"与 P1 冲突——条款 / 隐私页改为读取后台可编辑内容（知识库固定 slug `terms`、`privacy`），缺省为中性文案；在 W36-b PR2 实现。
- <a id="r47"></a>**R47（2026-10-06，用户同意）所有者（超级管理员）**：安装时创建的账号为唯一"所有者"（`users.is_owner` 唯一约束或 panel_settings.owner_id）。只有所有者能：提升 / 降级 / 删除 / 封禁管理员；改后台前缀与 IP 白名单、支付渠道密钥、主密钥相关操作、所有者转让。所有者不能被删除 / 降级 / 封禁，只能主动转让给另一位启用的管理员（二次确认 + 审计）。普通管理员负责日常运营。命令行 `akari admin` 保留恢复（重设所有者、重置登录方式）。"至少一个启用管理员"规则保留并改为"所有者必须是启用的管理员"。同时排查用户报告：存在其他管理员时删除账号仍提示"需保留一个管理员"——检查被提升的管理员是否处于禁用 / 封禁（W28-c 改了 disabled 语义）或其他状态不一致。**并入 PR③**。
- <a id="pa2"></a>**阶段 A PR② 合并（2026-10-06，#84，rebase 合并 6 个提交）**：Q1 服务器拆分（`/servers` 按服务器 → 节点 → 入口分组，CLI `akari server …`）、D5 网卡流量额度（超额停止该服务器所有节点、不改 nodes.enabled，告警 `traffic_quota`）、D9 分时段倍率（`akari_entrance_rate`，结算取"现在"与"30 秒前"较低者，只少计）、W30 订阅兼容（真实客户端 UA 识别、可编辑分流模板 → Clash rule-providers / sing-box rule_set、sing-box 1.12+ 完整配置、Shadowrocket 深链修复）、订阅格式与一键导入开关。agent 无需改动。生成的配置经 mihomo v1.19 与 sing-box 1.14 真实加载验证；GUI 客户端未实测（列于 DEPLOY）。基准：flush 50k 最多 +5%，desired_snapshot 10k +8%（面板侧，阶段 C 复查）。CI 红 6 次均为 smoke 首个失败即停导致的逐个暴露 → smoke"跑完全部再报告"模式 + 并行拆分排在 ③ 之后。下一个：PR③ 入口与账号。
- <a id="pause-1006"></a>〔已恢复〕 **暂停（2026-10-06，用户）**：PR③ 的 worker 已停止；本地工作区 `.work/pa3/` 保留未提交的进度，未推送。GitHub 上无打开的 PR，main 干净（含 PR①②）。恢复时派新 agent 从该工作区接着做。
- <a id="install-link"></a>**撤回（2026-10-06，用户："安装链接改走节点通信域名，不用改"）**：安装链接保持 D8 原样，使用首选主域名；只要求安装路径不含、不泄露后台秘密前缀（D4/D11 后它是独立的公开路径）。节点网关不做。PR③ 第 3 项删除。
- <a id="feature-parity"></a>**功能完整性要求（2026-10-06，用户）**：新前台（W36-b）与新后台（W33-b）都必须覆盖后端全部功能，至少等于旧版前后台能做的一切，加上 v0.4 新增功能。验收依据：前台 = `research/portal-gap.md`（W36-b PR2 前按当时 main 复核一遍）；后台 = `research/admin-inventory.md`（盘点进行中）。两份清单逐项写成 e2e 验收，未全部覆盖不合并、不删除旧代码。
- <a id="pa3"></a>**阶段 A PR③ 合并（2026-10-06，#85，rebase 合并）——阶段 A 完成**：masterkey 改名、R47 所有者、D4/D11（门户在 `/`、后台前缀入库 + 白名单、随机订阅路径）、D8 域名列表、自助注销（有财务记录则匿名化保留）、D10 清理、支付宝原路退款（`orders.refund_request`：幂等 out_request_no，pending 由对账循环查询 / 重试，供应方确认后才写退款列）、R46 USDT 提现（按链校验地址，无新依赖）。安装链接 `/install/{token}` 在主域名，不含后台前缀。**用户报告的管理员 bug**：第二个管理员是在"因超额被禁用"状态下被提升的，提升后仍保持禁用（W28-c 之后没有路径重新启用管理员），旧的"至少一个启用管理员"触发器不计它 → 删除另一管理员被拒；修复：提升时重新启用（拒绝封禁账号），1013 修复已有数据，所有者模型取代该触发器，带回归测试。安装器兼容 v0.3.2 发布包（读取两种 info 标签、保留 AKARI_PREFIX）。跟进：自助注销接口形状与主题 `planned.ts` 对齐（W36-b PR2）。下一步：main 完整检查 → 测试环境部署（用户已授权部署 / 重装 / 升级测试，测试机密钥已装好）。
- <a id="fe-parallel"></a>**新前台 / 新后台并行开发（2026-10-07，用户："前后分开两个 agent 做"）**：W33-b 新后台建为独立应用 `akari-panel/admin/`（基于 design/admin-v0.4），面板在 D4 后台前缀下提供；W36-b PR2 用主题替换 `akari-panel/spa/`（门户）。文件归属：W33-b 拥有 `admin/` + 后台静态资源的服务路由；W36-b 拥有 `spa/` + 门户服务路由与门户所需的少量后端字段（`/me`、`/auth/options` 的 timezone，`MyOrderView.action`，Turnstile CSP）。合并顺序：**W33-b 先合**（新后台可用后），W36-b 再合并并删除 spa/ 里的旧后台页面（不再做"旧后台挪到 admin/"）；后合并的一方负责 rebase。两者都以清单为验收：后台 = W33-b 第一步产出的 `research/admin-inventory.md`；前台 = `research/portal-gap.md` 按当前 main 复核后的版本。测试环境部署照常（用 rc 预发布版），部署发现的 bug 记录，排在这两个 PR 之后修。
- <a id="deploy-bugs-now"></a>**修订（2026-10-07，用户）**：测试部署发现的后端 bug 不再排队，发现即修（每个 bug 一个小 PR，只改后端，不碰 `spa/`、`admin/` 及门户 / 后台服务路由；若必须碰这些文件，交给对应的前台 / 后台 worker）。前后台两个 PR 与 bug 修复并行；后合并的一方负责 rebase。
- **#86 合并（2026-10-07）**：版本 0.4.0-rc.1；site-day 测试改为与时刻无关（Pacific/Kiritimati vs Etc/GMT+12）；面板 CI 必需检查加入 agent 单元文件一致性（优先比对同名 agent 分支）。开始测试环境部署（rc 预发布版）。
- <a id="cde-pause"></a>〔已被"阶段 D 再次暂停"与"待办并入下一版本"取代〕 **阶段 C / D / E 暂停（2026-10-07，用户）**：新前台（W36-b PR2）与新后台（W33-b）合并后直接发版（面板 v0.4.0 + agent v0.5.0）。发版前仍保留：main 完整检查、测试环境全新部署验证、后台下发升级到 v0.5.0（正在进行的测试部署已覆盖）。积压的阶段 D 小项（卸载脚本 --help、安装器纯 IP 等待、smoke 跑完全部再报告与并行拆分、面板侧 desired_snapshot +8% 复查）与阶段 C 压测 / 容量、阶段 E red team 移到 v0.4.0 之后再排。
- <a id="d-resume"></a>〔已取代〕 **阶段 D 恢复（2026-10-07，用户："发版前启动阶段 D，其他还是暂停"）**：发版前做代码质量与技术债。先由全新会话对 panel 后端 + agent 做全仓审查（前端两个应用正在重写，合并后再审），产出 `REVIEW-2026-10-07.md`（带行号）；修复按领域合并为少量 PR（与前后台 PR 文件不重叠），连同积压项：卸载脚本 `--help`、安装器纯 IP 安装的多余等待、smoke"跑完全部再报告"+ 并行拆分、desired_snapshot +8% 复查、xray 安全公告（等上游）。阶段 C、E 仍暂停。
- <a id="d-timing"></a>〔已取代〕 **阶段 D 时机更正（2026-10-07，用户："发正式版前！"）**：阶段 D 不是现在开始，而是在前后台合并、正式发版之前做（审查范围届时包括新 spa/ 与 admin/）。已停止刚启动的审查会话。顺序：新后台 → 新前台 → 部署 bug 修复 → **阶段 D 全仓审查 + 修复** → 正式发版。
- <a id="d-cloud"></a>**阶段 D 执行方式（2026-10-07，用户）**：阶段 D 在云端会话做。时机到时（新后台、新前台、部署 bug 修复全部合并后），lead 给用户一份自包含的云端提示词（全仓审查 → REVIEW-2026-10-07.md → 分批修复 PR），本地届时不并行改面板 / agent。
- <a id="test-deploy"></a>**测试环境部署完成（2026-10-07）**：面板 v0.4.0-rc.1 → rc.2（akari-ctl upgrade，含手动回滚再前进）、agent v0.5.0-rc.1/rc.2；真实 mihomo 1.19.32 + sing-box 1.14.2 端到端全部通过（中转 2.000x 计费、凭据隔离 + 来源白名单、审计计数、退款撤销订阅、USDT 提现、服务器额度停服 / 恢复 + 告警、前缀与订阅域名统一 404）。升级：v0.4.4→rc.1、rc.1→rc.2 分两批健康；TCP 客户端断约 9 s、Hy2 约 29 s；坏版本 rc.3（仅本地签名上传）16 s 内自动回滚、rollout 停止。缺口：无 SMTP（发信未测）、支付宝沙箱无法完成付款（改用余额 / 手工单）。报告：`research/test-deploy-2026-10.md`。低级别发现 → 一个修复 PR：安装器默认节点域名 = 主域名（主域名橙云时 agent 连不上，应要求单独的节点域名）、面板自检证书只试 IPv6、Lightsail Debian 无 curl/wget（安装命令兼容或文档）、DEPLOY §3g 漏写 period、rollout 停止时安装链接仍提供坏版本（应提供最后一个正常版本）、备份包含数据库里的 agent 二进制 84 MB（改为可选 / 排除）。
- <a id="w36b-wait"></a>**W36-b PR2（#89）暂停等待 W33-b**：门户侧 CI 全绿（e2e 63 项、桌面 + Pixel 7、通行密钥端到端），smoke 只在旧控制台段落红（预期）。已删除主题里带虚假宣传的 FAQ / 条款 / 隐私页与 spa/ 里的旧门户和旧后台源码；`.gitignore` 的 `data/` 已锚定为 `/data/`。W33-b 合并后恢复：rebase、按 W33-b 处理 console.spec.ts 与 smoke R23、删 admin-protocols.gen.ts 与 /{prefix}/app 残留、加 `GET /api/v1/pages/{terms|privacy}`、full-ci。**lead 裁决**：主题"页面切换的前 ~140 ms 内输入会丢失"不保留，恢复时一并修掉（不能只在 e2e 里等待规避）；首屏 JS 144.3/145 KiB 接近预算，修复时不得超预算。合并后：归档主题仓库、删除分支 `pr-assets/w36b-kb`。
- <a id="w33b"></a>**W33-b 新后台合并（2026-10-07，#90）**：独立 `admin/` 应用（登录页 + 控制台两个包，不与门户共享代码，check-bundles 双向校验），验收清单 148 项界面功能全部有 e2e（34 × 桌面 / 手机 = 68 通过；另 16 项为不迁移 / 命令行 / 后端测试覆盖）；`/{prefix}/app` 为新后台登录页，`src/spa.rs` 只服务门户；迁移 1080 `kb_articles.slug`；用户列表加 last_login_at / balance_cents / passkeys。必需检查新增 `admin (tsc, lint, error codes, unit, build)`。下一步：新 agent 接手 W36-b #89 收尾。
- <a id="d-pause-again"></a>**阶段 D 再次暂停（2026-10-07，用户："还是直接发版吧"）**：W36-b #89 合并后直接发正式版（面板 v0.4.0 + agent v0.5.0）。发版前只做：main 完整 CI、版本号改为正式版、打标签走 release.yml、测试环境升级到正式版并冒烟验证（含通过后台下发把节点升到 v0.5.0）。阶段 C / D / E 全部移到 v0.4.0 之后。
- <a id="perf-early"></a>**性能修复提前（2026-10-07，用户）**：阶段 D 中只提前做"生成节点配置 +8%"（desired_snapshot）复查与优化，目标回到 PR② 之前的水平并对线上分散的数据布局稳健；顺带在安全的前提下优化结算的倍率查询和节点累计更新。只改后端，与 #89 并行。阶段 D 其余仍暂停。
- <a id="codeql"></a>**CodeQL 扫描结果（2026-10-07，记录，暂不处理，用户）**：仓库已开启 GitHub 代码扫描。main 上原有提示：96 × `rust/hard-coded-cryptographic-value`（大多在测试文件；非测试位置需逐个确认：src/plans.rs、src/signup/pow.rs、src/account.rs、src/api.rs、bench/）；2 × `rust/insecure-cookie`（src/auth.rs:380、391，确认是否为纯 IP / http 安装有意不加 Secure）；2 × `rust/cleartext-transmission`（bench/src/common.rs、load.rs，压测工具）。处理方式（v0.4.0 之后，归入阶段 D）：误报在 GitHub 标记"不适用"并写理由，真问题修复。#89 新增的 2 个提示（spa/scripts/check-dist.mjs 的正则过滤 HTML）由 #89 自己修。
- <a id="w36b"></a>**W36-b 新前台合并（2026-10-07，#89）——新前台与新后台全部完成**：主题接管 `spa/`（门户在 `/`），旧门户与旧后台源码全部删除；条款 / 隐私页读 KB slug（`GET /api/v1/pages/{terms|privacy}`）；页面切换前 ~140 ms 输入丢失已修复；check-dist 改用 parse5 解析（CodeQL 新增 0）；门户 e2e 覆盖 portal-gap.md 每一行（桌面 + 手机，真实 CSP，通行密钥）。主题仓库 mwnydev/Akari-theme 已归档只读，截图分支 pr-assets/w36b-kb 已删除。下一步：生成配置性能修复合并后直接发正式版。
- <a id="next-version"></a>**待办并入下一版本（2026-10-07，用户）**：所有未完成工作并入 `PLAN-next.md`（含 #92 性能修复、阶段 C/D/E、CodeQL、积压小项、未实测项）。v0.4.0 / v0.5.0 只发布 main 上已合并的内容。发版前唯一阻断：main 当前 e2e 红（admin 告警中心 ALR 用例，云端修复中）——必须修绿才能打正式版标签。
- <a id="dont-stop"></a>**更正（2026-10-07，用户："正在工作的不要停"）**：#92 性能修复继续在本版本完成（已重新派本地 agent 跟进），不并入下一版本；PLAN-next.md 已同步。原则：正在进行的任务不因"移到下一版本"而停止，只把尚未开始的待办移走。
- <a id="pr92"></a>**#92 性能修复合并（2026-10-07）**：entrance_users 覆盖主键（迁移 1090）、生成配置去 SQL 排序、结算对无时段规则入口直读倍率 + 单次 per_node 汇总（结果不变，仍只少计）。生成配置 19 → 16 ms（整齐）/ 31 → 19–21 ms（分散），结算略降。#92 的完整 CI（含 e2e）全绿，main 上告警中心 e2e 的失败未复现，疑似偶发，仍由云端会话确认根因。
- **正式发版（2026-10-07）**：面板 **v0.4.0**（标签于 main 28a9539，release.yml 37554848873 成功，16 个资产含 amd64/arm64、镜像、部署包、install.sh、SBOM、SHA256SUMS、许可证，均有 sigstore 签名）与 agent **v0.5.0**（标签于 main f670028，release.yml 37554848751 成功，18 个资产含签名的更新清单）同时发布，均为 Latest。测试环境升级、后台下发与冒烟由用户自己进行（测试面板当前仍为 rc.2）。之后按 PLAN-next.md 排下一版本。
