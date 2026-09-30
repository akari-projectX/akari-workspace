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
| — | Lead 裁决 / 合并 | lead | 待定 |

## 新增（仓库全部公开后，2026-09-30）
- **SEC-1 伪装站可被指纹识别** → 按用户决定（2026-09-30）**删除伪装站**：所有拒绝统一为空 body 的 404，不带安全头，字节同构；提前到 Sprint 1b 由 worker 执行。原问题：：`decoy.html` 已公开，扫描器可以用它的字节哈希识别出所有 Akari 部署，"零指纹"的前提不再成立。改为每个安装使用运营方提供或随机生成的伪装内容，404 同字节的约束不变。优先级 P0，放进 Sprint 2。
- REVIEW 中未修复缺陷的细节已公开；P0 修复要尽快合并。

## Sprint 2（计划）
P0-3 删除用户时序、P0-4 禁用节点、P0-5 到期执行。这三项都集中在 api.rs/grpc.rs，适合一起做。

## Sprint 3（计划）
P0-6 UserDelta 下发 + agent 重建后重发 Hello（跨仓：proto 不变，agent 与 panel 两侧都要改）。

## Sprint 4（计划）
P1-7 ~ P1-15 与 CI、文档去漂移。

## 裁决记录
- **R1（2026-09-30）** 采纳 red team 的结论：首次 Snapshot 后 agent 不重发 Hello，导致记账 session 永久错位，只要重连就会重复计费。只改面板的修复被否决。新方案：`TrafficReport.session_id` 由 CoreManager 在 Rebuild 时原子生成；面板在 SQL 内用 PG18 `RETURNING OLD/NEW` 算 delta（同一事务、按行加锁），内存中不保留 pending；#10 的验收改为"下次上报能完整补回"。另外采纳：u64 溢出防护（列为 P1 安全项）、登出失败必须对用户可见、REVIEW 行号勘误。#12 SIGTERM 降级为运维项。
- **R2（2026-09-30）** 采纳 Phase B 的结论。H1：乱序的旧值会触发新 epoch 并重复计费，而且每翻转一次就再多计一次 → **整个删除 epoch 机制**（生产环境没有旧 agent，不留兼容）；缺 session_id 的上报直接丢弃；会话内出现更低的值忽略即可（由 GREATEST 保底）。H2：启动时强制检查 PG ≥ 18（否则会静默地计 0）。M1：按 SQLSTATE 区分瞬时错误与数据错误。M2：批量写入前排序，避免死锁。M3：登出后界面停在原页，改用 removeQueries + resetQueries。SEC-1 追加：405 响应会暴露前缀是否正确，所有不匹配一律返回空 404。L1：traffic_counters 的行是计费基线，清理任务只能删除已确认结束的会话。合并目标改为 `fix/p0-sprint1b`，它包含 1 的全部内容。
