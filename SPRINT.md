# Phase 0.5 进度看板

> Lead 维护。缺陷编号对应 `REVIEW-2026-09-30.md`，范围见 `akari-panel/PLAN.md` Phase 0.5。
> 流程：Worker 在功能分支上实现 → Red team 先独立出攻击方案（A），再实测攻击 diff（B）→ Lead 裁决 → 修正 → 合并 main。
> 同一时间最多 2 个 subagent。开发环境（PG/Valkey/端口 8080、8443）同一时刻只能一方使用。

## Sprint 1（2026-09-30 开始）· 分支 `akari-panel:fix/p0-sprint1`

| # | 项 | 负责 | 状态 |
|---|---|---|---|
| P0-1 | SPA 登录/登出路径 | worker | 进行中 |
| P0-2 | 计费会话错位（重连/重启重复计费）— 已并入 P0-6 的 Hello/session 部分，跨仓 | worker | 进行中（R1 改范围） |
| P1-10 | flush 失败丢增量 | worker | 进行中 |
| — | 攻击方案 A（只读，独立推导） | red team | ✅ 完成 |
| — | 攻击 B（实测 diff） | red team | 待 worker 交付 |
| — | Lead 裁决 / 合并 | lead | 待定 |

## Sprint 2（计划）
P0-3 删除用户时序、P0-4 禁用节点、P0-5 到期执行。这三项都集中在 api.rs/grpc.rs，适合一起做。

## Sprint 3（计划）
P0-6 UserDelta 下发 + agent 重建后重发 Hello（跨仓：proto 不变，agent 与 panel 两侧都要改）。

## Sprint 4（计划）
P1-7 ~ P1-15 与 CI、文档去漂移。

## 裁决记录
- **R1（2026-09-30）** 采纳 red team 的结论：首次 Snapshot 后 agent 不重发 Hello，导致记账 session 永久错位，只要重连就会重复计费。只改面板的修复被否决。新方案：`TrafficReport.session_id` 由 CoreManager 在 Rebuild 时原子生成；面板在 SQL 内用 PG18 `RETURNING OLD/NEW` 算 delta（同一事务、按行加锁），内存中不保留 pending；#10 的验收改为"下次上报能完整补回"。另外采纳：u64 溢出防护（列为 P1 安全项）、登出失败必须对用户可见、REVIEW 行号勘误。#12 SIGTERM 降级为运维项。
