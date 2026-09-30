# Akari 工作区

工作区元仓库 `akari-workspace`：只含工作区文档；`./bootstrap.sh` 会把下面三个独立仓库兄弟检出到本目录：

| 目录 | 仓库 | 说明 |
|---|---|---|
| `akari-panel/` | 控制面板 | Rust 后端 + React 前端（管理台/用户门户）+ 契约所有者（`proto/agent.proto`）+ 集成冒烟 `smoke.sh` |
| `akari-agent/` | 节点 agent | Go，内嵌 xray-core v1.260327.0，出站 mTLS 接面板 |
| `akari-client/` | 自研客户端 | 内嵌 mihomo（规划中，见 akari-panel/PLAN.md Phase 2） |

约定：

- **兄弟检出**：三目录放在同一父目录下（`../akari-panel`、`../akari-agent`），
  面板的 smoke 测试和 agent 的契约同步都依赖这个相对路径。
- 契约正本在 `akari-panel/proto/agent.proto`；agent 仓 vendor 副本，
  `make -C akari-agent sync-proto` 同步并重新生成，`check-proto` 校验漂移。
- 战略与排期：`akari-panel/PLAN.md`；交接与踩坑：`akari-panel/HANDOVER.md`。
