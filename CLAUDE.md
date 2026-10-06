# Akari 工作区（三仓库）

代理面板控制平面（对标 xboard/sspanel，但**刻意不兼容** V2Board/XrayR 协议——这是需求不是缺陷）。
工作区根目录不属于任何仓库；三个子目录是独立 git 仓库，必须**兄弟检出**（smoke 与契约同步依赖 `../akari-agent`、`../akari-panel` 相对路径）。

| 目录 | 语言 | 角色 | 子文档 |
|---|---|---|---|
| `akari-panel/` | Rust + React | 控制面板、契约正本 `proto/agent.proto`、集成冒烟 `smoke.sh` | `akari-panel/CLAUDE.md` |
| `akari-agent/` | Go | 节点 agent，内嵌 xray-core，出站 mTLS gRPC | `akari-agent/CLAUDE.md` |
| `akari-client/` | Go（M4 MVP 已合并，**已暂停**） | 自研客户端，mihomo 作为独立子进程（GPL-3.0） | `akari-client/CLAUDE.md` |

## 权威文档（先读）

- `HANDOVER-2026-10-04.md` — **最新交接文档：现状、待办、凭据位置、工作规程（先读这个）**
- `OPUS-GUIDE.md` — 接手导读：阅读顺序、三仓架构与质量评估（2026-10-01）、后续路线、工作规程、文档维护规则
- `ROADMAP.md` — 详细开发计划（里程碑 M0–M7、sprint 任务、生产级出口标准）
- `SPRINT.md` — 当前 sprint 看板与裁决记录
- `akari-panel/PLAN.md` — 阶段计划与决策记录（含 Phase 0.5 质量修复清单）
- `akari-panel/HANDOVER.md` — 交接与踩坑（依赖版本坑、axum 路由语义、WSL 运维坑）
- `REVIEW-2026-09-30.md` — 接手代码审查：架构评估 + 带行号的缺陷清单

## 已确认的战略决策（勿推翻）

1. 三仓库终态：panel / agent(xray-core) / client(mihomo)。
2. 第三方客户端订阅由后台开关决定是否启用（按格式 / 按客户端，默认开启）；akari-client 完成后运营者可自行选择关闭第三方订阅，不强制只保留自有客户端（2026-10-06 用户修订）。
3. 设备限制 = 客户端席位绑定制，随 akari-client 做，**现在不做**。

## 跨仓规则

- 改控制协议：先改 `akari-panel/proto/agent.proto` → `make -C akari-agent sync-proto` → 两边一起改代码 → `make -C akari-agent check-proto`。
- 任何改动的验收门（2026-10-05 起 main 不再要求"分支最新"，无冲突的 PR 不必 rebase 即可合并；main 每次合并后跑全套 CI）：本地只跑快速检查（`make -C akari-panel check`、`cargo test --locked`；agent 侧 `make vet fmt-check`），smoke / e2e / 安装器等重型检查只在 GitHub Actions 上跑（W37），CI 全绿才合并。
- 本机 WSL 有 HTTP_PROXY：curl 本地服务必须 `--noproxy '*'`。
- `akari-panel/data/` 含 CA 私钥与 jwt.key：不可提交、不可外发；`make smoke` 会删除它（仅限开发机）。
- 提交与推送仅在用户要求时进行；三仓远程均为 `git@github.com:akari-projectX/<repo>.git`。
