# research/：研究报告与验收清单

只读分析的产出。结论以 `SPRINT.md` 的裁决为准；报告本身不随代码更新，除非注明"已复核"。

| 文件 | 用途 | 日期 | 状态 |
|---|---|---|---|
| [`db-schema-review.md`](db-schema-review.md) | 阶段 0 数据库架构评审：局部重构方案、Q1–Q4（迁移编号部分已过时：迁移已压缩为 `0001_baseline.sql`） | 2026-10-05 | 已全部落地，作为设计依据保留（代码注释引用） |
| [`ops-logic-review.md`](ops-logic-review.md) | 运营逻辑审查：从运营者和付费用户角度走业务流程，21 项发现 | 2026-10-06 | 批次 A/B/C 已落地；低优先项在 `briefs/round-2026-10-28.md` |
| [`code-audit-2026-10/`](code-audit-2026-10/) | 代码体检 4 份报告（agent、面板认证、资金、其余核心） | 2026-10-26 | P1/P2 已修，P3 待定项见 `PLAN-next.md` 与当前轮次 brief |
| [`agent-soak-2026-10.md`](agent-soak-2026-10.md) | agent 稳定性浸泡测试设计与结果（数据在 `agent-soak-2026-10-data/`） | 2026-10-27 | 完成；agent CLAUDE.md 引用 |
| [`singbox-spike/`](singbox-spike/README.md) | sing-box 第二内核技术验证：补丁、原型、结论 | 2026-10-02 | 用户决定暂缓（R29）；重启前先读 |

已完成并归档的报告（验收清单、测试部署、倍率调查、兼容清理、压测原始输出、旧 UI 走查）在 `../archive/research/`。
