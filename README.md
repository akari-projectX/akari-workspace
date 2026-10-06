# Akari 工作区

工作区元仓库 `akari-workspace`：只含工作区文档（交接、裁决、计划、研究报告、worker brief）；`./bootstrap.sh` 会把下面三个独立仓库兄弟检出到本目录：

| 目录 | 仓库 | 说明 |
|---|---|---|
| `akari-panel/` | 控制面板 | Rust 后端 + React 前端（`spa/` 用户门户、`admin/` 管理后台）+ 契约所有者（`proto/agent.proto`）+ 集成冒烟 `smoke.sh` |
| `akari-agent/` | 节点 agent | Go，内嵌 xray-core，出站 mTLS 接面板 |
| `akari-client/` | 自研客户端 | mihomo 作为独立子进程（M4 MVP 已合并，暂停中） |

约定：

- **兄弟检出**：三目录放在同一父目录下（`../akari-panel`、`../akari-agent`），
  面板的 smoke 测试和 agent 的契约同步都依赖这个相对路径。
- 契约正本在 `akari-panel/proto/agent.proto`；agent 仓 vendor 副本，
  `make -C akari-agent sync-proto` 同步并重新生成，`check-proto` 校验漂移。
- 从哪里开始读：`CLAUDE.md` 的"权威文档"，第一份是最新的 `HANDOVER-*.md`。
