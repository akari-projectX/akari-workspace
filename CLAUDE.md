# Akari 工作区（三仓库）

代理面板控制平面（对标 xboard/sspanel，但**刻意不兼容** V2Board/XrayR 协议——这是需求不是缺陷）。
工作区根目录不属于任何仓库；三个子目录是独立 git 仓库，必须**兄弟检出**（smoke 与契约同步依赖 `../akari-agent`、`../akari-panel` 相对路径）。

| 目录 | 语言 | 角色 | 子文档 |
|---|---|---|---|
| `akari-panel/` | Rust + React | 控制面板（`spa/` 门户、`admin/` 后台）、契约正本 `proto/agent.proto`、集成冒烟 `smoke.sh` | `akari-panel/CLAUDE.md` |
| `akari-agent/` | Go | 节点 agent，内嵌 xray-core，出站 mTLS gRPC | `akari-agent/CLAUDE.md` |
| `akari-client/` | Go（M4 MVP 已合并，**已暂停**） | 自研客户端，mihomo 作为独立子进程（GPL-3.0） | `akari-client/CLAUDE.md` |

## 权威文档（按顺序读）

1. `HANDOVER-2026-10-07.md` — **最新交接：现状、v0.4.0 内容、进行中的事、服务器与凭据位置、工作规程（先读这个）**
2. `SPRINT.md` — 裁决记录（只追加）；开头的"当前有效裁决索引"按主题列出仍有效的裁决
3. `PLAN-next.md` — 下一版本待办（阶段 C/D/E、CodeQL、未实测项等）
4. `PLAN-v0.4.md` — v0.4 决定 D1–D12、任务卡、中转规格；开头有执行状态
5. `briefs/COMMON.md`、`briefs/DEFECT-CHECKLIST.md` — worker / 云端会话通用规则，风险分级与缺陷清单（T1 brief 必附）
6. `research/README.md` — 研究报告与验收清单索引

已归档（`archive/`，只作历史）：旧交接、OPUS-GUIDE、ROADMAP、两份 REVIEW、GITHUB 清单。`akari-panel/PLAN.md`、`akari-panel/HANDOVER.md` 是 2026-09-30 的旧文档，以上面的文档为准。

## 已确认的战略决策（勿推翻）

1. 三仓库终态：panel / agent(xray-core) / client(mihomo)。
2. 第三方客户端订阅由后台开关决定是否启用（按格式 / 按客户端，默认开启）；akari-client 完成后运营者可自行选择关闭第三方订阅，不强制只保留自有客户端（2026-10-06 用户修订）。
3. 设备限制 = 客户端席位绑定制，随 akari-client 做，**现在不做**。

## 跨仓规则

- 改控制协议：先改 `akari-panel/proto/agent.proto` → `make -C akari-agent sync-proto` → 两边一起改代码 → `make -C akari-agent check-proto`。
- 任何改动的验收门（main 要求"合并前分支必须最新"（2026-10-06 恢复）；串行开发，同一时间只开一个 PR；CI 变红立即修）：本地只跑快速检查（`make -C akari-panel check`、`cargo test --locked`；agent 侧 `make vet fmt-check`），smoke / e2e / 安装器等重型检查只在 GitHub Actions 上跑（W37），CI 全绿才合并。
- 本机 WSL 有 HTTP_PROXY：curl 本地服务必须 `--noproxy '*'`。
- `akari-panel/data/` 含 CA 私钥与 jwt.key：不可提交、不可外发；`make smoke` 会删除它（仅限开发机）。
- 提交与推送仅在用户要求时进行；三仓远程均为 `git@github.com:akari-projectX/<repo>.git`。
