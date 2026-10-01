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
| 历史背景 | `REVIEW-2026-09-30.md`（接手时的缺陷清单，已基本关闭）→ `akari-panel/HANDOVER.md`（踩坑，部分陈述已过时，见 §2.5） |

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

<!-- REVIEW_SECTIONS -->

---

## 3. 后续开发路线

<!-- ROADMAP_SECTION -->

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

<!-- DRIFT_TABLE -->
