# Akari 详细开发计划（ROADMAP）

> 制定：2026-09-30（lead）。本文件是**执行层**计划；战略决策见 `akari-panel/PLAN.md`，当前 sprint 状态见 `SPRINT.md`，缺陷依据见 `REVIEW-2026-09-30.md`。
> 最终目标：**高性能 · 高安全 · 高质量 · 生产级**的代理控制面板。下面每条目标都给出可验证的标准，不写空口号。

---

## 0. 生产级的定义（出口标准）

| 维度 | 标准（全部可测） |
|---|---|
| 性能 | 单面板实例支撑 **200 节点 / 50k 用户**；单节点 10k 用户的快照构建 < 200 ms；5 万行流量 flush < 1 s；管理 API p99 < 50 ms（本地 PG）；订阅端点 p99 < 30 ms；用户变更到 agent 生效 < 2 s |
| 安全 | REVIEW 中 P0/P1 全部关闭；管理员 TOTP 双因素；审计日志；agent 私钥不离开节点（CSR）；证书可吊销；`cargo-deny`/`govulncheck`/`npm audit` 在 CI 中无高危；所有拒绝响应字节同构、无指纹；关键解析器做 fuzz |
| 质量 | 三仓 CI 为合并必需项；panel 单测 + 真库测试 + fake-agent 集成测试 + smoke；计费核心路径覆盖率 ≥ 90%；每个 sprint 经过 red team 对抗验证 |
| 运维 | 按文档 30 分钟内完成全新生产部署（反代 TLS + systemd/容器）；备份与恢复演练通过；Prometheus 指标 + 结构化日志 + 告警规则；迁移只进不退，升级有回滚预案 |
| 计费正确性 | 任意重启、重连、重试、乱序、多实例的组合下**不多计**；少计的上界是每次实例重建 ≤ 10 s 流量，并有文档说明 |

---

## 1. 团队与工作流

- **Lead**（主会话）：排期、裁决、合并、对用户汇报（只报里程碑与需要决策的事项）。
- **Worker**（subagent 1）：在功能分支或 worktree 上实现，自带测试。
- **Red team**（subagent 2）：A 阶段独立推导不变量与攻击面；B 阶段实测攻击 diff，结论为 MERGE / MERGE-WITH-FIXES / REJECT。
- 同时最多 2 个 subagent；开发环境（PG/Valkey/8080/8443）同一时刻只归一方使用，由 lead 调度。
- 分支：`fix/*`、`feat/*` → PR → 合并 `main`（四个仓库的 `main` 都要求走 PR、禁止强推）。
- **Definition of Done**（每个任务）：代码 + 测试 + 相关 CLAUDE.md/README 更新 + 全部门禁绿 + red team 放行 + lead 在 SPRINT.md 记下裁决。

## 2. 质量门禁（逐步收紧）

| 仓库 | 现在 | M0 结束时 |
|---|---|---|
| panel | fmt、clippy -D warnings、tsc、check-auth-paths、cargo test、smoke（手动） | + CI 必需；+ cargo-deny（许可证与漏洞）；+ fake-agent 集成测试；+ smoke 在 CI 中跑（docker service） |
| agent | vet、gofmt、check-proto | + `go test -race`；+ govulncheck；+ CI 中检出 panel 做 check-proto |
| client | — | 开工时即带 CI |

---

## 3. 里程碑总览

以周为单位，W1 = 2026-10-01 那一周。估算基于"worker 实现 + red team 验证"这套串行流水线，误差 ±30%。

| 里程碑 | 周 | 主题 | 出口标准 |
|---|---|---|---|
| **M0 质量基线** | W1–W3 | 修完 REVIEW P0/P1，建 CI | P0/P1 清零；CI 为必需检查；fake-agent 测试进 CI |
| **M1 可生产部署** | W4–W6 | 部署、可观测性、安全加固 | 按文档 30 分钟完成部署；恢复演练；2FA、审计、CSR |
| **M2 性能与规模** | W6–W8 | 压测、优化、多实例 | 达到 §0 性能指标；双实例部署通过测试 |
| **M3 运营模型** | W8–W10 | 套餐、节点组、周期流量、自助 | 按套餐授权取代逐节点分配 |
| **M4 akari-client MVP** | W10–W15 | mihomo 内嵌客户端（Win 优先） | PLAN Phase 2 的验收 |
| **M5 席位绑定 + 订阅退役** | W15–W17 | 设备注册，下线第三方格式 | PLAN Phase 3 的验收 |
| **M6 agent 自动更新** | W17–W18 | 签名分发、灰度 | 按百分比灰度，校验失败拒绝替换 |
| **M7 商业化** | W19+ | 订单、支付、工单、邀请 | PLAN Phase 5 的验收 |

M4 起开始有并行需求（client 与 panel 同时推进），届时评估是否临时调整两个 subagent 的分工（worker 做 client，red team 兼顾 panel 回归）。

---

## 4. M0 质量基线（W1–W3）

### Sprint 1 · 计费正确性 + 登录 + 去伪装（进行中）
| ID | 仓库 | 任务 | 验收 |
|---|---|---|---|
| S1-1 | panel | SPA 登录/登出路径（P0-1）；登出失败可见；登出后跳转 | check-auth-paths + smoke 断言 ✅ |
| S1-2 | panel | 计费重写：SQL 内算增量（PG18 RETURNING old/new），内存不存 pending；删除 epoch 机制 | 单测 + 真库测试；red team 的 rt1–rt5 全部通过 |
| S1-3 | proto+agent | `TrafficReport.session_id`；CoreManager 原子生成 session；重建后重发 Hello；重建前最后上报一次流量 | `go test -race`；首次快照后重连只计增量 |
| S1-4 | panel | 启动时检查 PG ≥ 18；SQLSTATE 分类；批量排序防死锁 | 在 PG17 上拒绝启动 |
| S1-5 | panel | SEC-1：删除伪装站，所有拒绝统一为空 body 404，405 也归一，安全头只加在真实响应上 | smoke 对 7 类拒绝做 sha256 同构断言 |
| S1-6 | — | red team Phase C 终验 → 合并 main、推送 | MERGE 结论 |

### Sprint 2 · 停用语义（"关掉就真的关掉"）
| ID | 任务 | 验收 |
|---|---|---|
| S2-1 | 状态变更统一为"写库 → bump → notify"并放进同一事务，修 `delete_user` 竞态（P0-3） | 删除用户后 agent 用户集不含该用户（集成测试） |
| S2-2 | 禁用节点：关闭它的流并拒绝重连（P0-4） | 禁用后 1 s 内断流，xray 停止 |
| S2-3 | 到期执行（P0-5）：快照过滤、登录拒绝、到期扫描 bump | 到期后 ≤ 扫描周期内从节点移除 |
| S2-4 | `assign_user` 校验协议与 inbound 一致、用户不存在返回 404、放进事务（P1-8） | 并发分配不丢更新 |
| S2-5 | `set_inbounds` 清理孤儿凭据；Ack `ok=false` 不算收敛，并在节点状态中暴露错误（P1-9） | 删除 inbound 后 agent 不报错 |
| S2-6 | PATCH 语义：空更新返回 400、字段可清空（double_option）（P1-7） | 清空 server_addr 返回 200 |
| S2-7 | 会话清理按代数判断再写 offline（P1-13） | 重连不闪断 offline |

### Sprint 3 · 下发效率（性能前置）
| ID | 任务 | 验收 |
|---|---|---|
| S3-1 | 用户集变更走 `UserDelta`（面板计算差集），只有 inbound 变更才发 Snapshot（P0-6） | 增删用户不断开其他用户的连接 |
| S3-2 | 定向通知：`notify_change` 从"唤醒全部会话"改为按 node_id 定向（watch → 每节点一个 channel），避免 N 个节点对每次变更都查库 | 200 节点下单次变更只产生受影响节点的查询 |
| S3-3 | 删除节点 API 与证书吊销（删除即拒绝接入，并断开现有流） | 删除后旧证书无法连接 |
| S3-4 | 心跳补全 connections/uptime；agent 在密钥无效时于启动阶段报错退出，不再运行中 panic | — |

### Sprint 4 · 安全与工程基础
| ID | 任务 | 验收 |
|---|---|---|
| S4-1 | 反代部署：`web.trusted_proxies` + X-Forwarded-For；`web.cookie_secure` 显式配置；限速只计失败登录（P1-11） | 反代后面各 IP 独立限速 |
| S4-2 | 会话吊销：jwt 带 `pwd_ver`，改密码/禁用/登出后旧 token 失效；最后一个管理员保护（P1-12/14/15） | 登出后旧 token 返回 401 |
| S4-3 | SIGTERM 优雅退出 + 最后一次 flush（P1-12，已降级为运维项） | `docker stop` 不丢批次 |
| S4-4 | 三仓 CI：fmt/clippy/test/tsc/cargo-deny/smoke；agent 加 race/govulncheck/check-proto；设为必需检查 | PR 未过 CI 不能合并 |
| S4-5 | fake-agent 集成测试 harness（tonic 客户端 + bootstrap 证书）：计费、收敛、停用语义进 CI | 可稳定复现，无 flaky |
| S4-6 | 文档去漂移（`panel/` 旧路径、no-restart 声明等）；`state.json` 权限改为 0600；gRPC 错误不泄露 DB 细节 | — |

**M0 出口**：REVIEW 中 P0/P1 全部关闭；CI 为必需检查；red team 对 M0 整体做一次回归攻击，结论为 MERGE。

---

## 5. M1 可生产部署（W4–W6）

| ID | 任务 | 验收 |
|---|---|---|
| M1-1 | 发布制品：panel 静态链接二进制 + distroless 镜像；agent 多架构（amd64/arm64）二进制；版本号与 git sha 注入 | 在 CI 中构建 |
| M1-2 | 部署文档与模板：systemd unit、docker compose（prod）、Caddy/nginx 反代示例（TLS、只转发前缀路径）、防火墙建议 | 在一台新 VPS 上 30 分钟跑通 |
| M1-3 | 配置校验：启动时校验 panel.toml（地址、SAN、secure cookie 与反代的一致性），错误给出可读提示 | — |
| M1-4 | 可观测性：Prometheus `/metrics`（在前缀下，或绑定独立的内网端口）：在线节点、会话数、flush 延迟与失败、快照耗时、API 延迟直方图；请求 ID；告警规则样例 | Grafana 面板样例 |
| M1-5 | 备份恢复：PG 逻辑备份 + `data/`（CA、jwt.key）加密备份脚本；恢复演练文档 | 演练通过 |
| M1-6 | **管理员 TOTP 双因素**；登录审计 | 管理员账号必须启用 |
| M1-7 | **审计日志**表：谁在何时改了什么（前后值）；管理端可查询 | 所有管理写操作都有记录 |
| M1-8 | **agent CSR 注册**（从原 Phase 4 提前）：一次性 enrollment token，私钥只在节点生成；证书到期轮换 | bootstrap 文件不含私钥 |
| M1-9 | 秘密轮换命令：route prefix 轮换、jwt 密钥轮换（旧会话失效）、用户自助重置订阅 token | — |
| M1-10 | 订阅端点限速（按 token 和 IP）；token 不写进访问日志 | — |
| M1-11 | 供应链：`cargo-deny` 许可证白名单（专有 panel 与依赖许可证兼容性）、SBOM、Release 产物签名（cosign） | — |

## 6. M2 性能与规模（W6–W8）

| ID | 任务 | 验收 |
|---|---|---|
| M2-1 | 基准套件：criterion 覆盖快照构建、订阅渲染、流量聚合；oha/k6 覆盖 API 与订阅；fake-agent 群压测（200 连接 × 10 s 上报） | 结果进 CI 工件，回归 > 20% 告警 |
| M2-2 | 查询与索引审查：`EXPLAIN ANALYZE` 覆盖所有热点查询；补索引（如 `users(sub_token_hash)` 已有 UNIQUE、`node_users(user_id)` 已有；审查 traffic_counters 的访问模式） | 达到 §0 延迟目标 |
| M2-3 | `AuthUser` 每请求回查 DB → 短 TTL 缓存（与会话吊销的 pwd_ver 配合） | — |
| M2-4 | **多实例**：变更通知走 Valkey pub/sub；agent 注册表按实例分片；流量 flush 已经幂等，可以多实例同时写（M2 双实例测试） | 双实例 + 负载均衡通过全部集成测试 |
| M2-5 | `traffic_counters` 保留策略：只删除确认已结束的会话（遵守 L1 约束） | 表行数有界 |
| M2-6 | agent 侧：流量采集与心跳的开销测量；xray 实例重建耗时 | 记录基线 |

## 7. M3 运营模型（W8–W10，对应 PLAN Phase 1）

| ID | 任务 |
|---|---|
| M3-1 | 数据模型：`plans`（流量额度、周期、速率上限、节点组、设备席位预留字段）、`node_groups`、`user_plans`（生效/到期） |
| M3-2 | 授权计算：用户可用节点 = 套餐节点组；账号自动签发与回收（取代手工逐节点分配） |
| M3-3 | 周期流量重置（按自然月或购买日）、到期处理，配合审计 |
| M3-4 | 用户自助：改密码、查看和重置订阅、用量明细 |
| M3-5 | 管理台：套餐、节点组、用户详情（设备与用量）；前端补测试（vitest + Testing Library） |
| M3-6 | 前端形态定案：单 SPA 双角色 vs 拆分（PLAN 的决策点） |

## 8. M4–M7 概要

- **M4 akari-client MVP**（W10–W15）：W10 spike（库内嵌 vs 子进程，pin mihomo 版本）→ 注册与登录 → 拉取配置 → 内核生命周期 → 系统代理 → 托盘 → Windows 打包 → macOS。验收沿用 PLAN Phase 2（5 分钟可用、断网自愈、内核崩溃自动拉起）。
- **M5 席位绑定**（W15–W17）：`devices` 表、`/client/v1/*`、席位上限、踢出设备；订阅退役按 PLAN Phase 3 执行（含 1–2 个月公告期）。
- **M6 agent 自动更新**（W17–W18）：签名清单、按节点百分比灰度、失败回滚。
- **M7 商业化**（W19+）：订单、支付（Stripe + 易支付）、优惠券、邀请佣金、工单、邮件；建立在 M3 的套餐模型之上；对账脚本。

---

## 9. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| xray-core / mihomo 升级引入破坏性变更 | agent/client 功能回归 | pin 版本；升级必须过 smoke 和集成测试；关注 prerelease 标签 |
| 仓库全部公开 | 实现细节可被研究，缺陷细节已暴露 | 尽快关闭 P0；去除指纹（SEC-1）；安全不依赖代码保密 |
| 串行流水线吞吐有限（最多 2 个 subagent） | 排期延后 | 每个 sprint 限制在同一组文件；red team A 阶段与 worker 实现并行 |
| PG18 特性依赖（RETURNING old/new） | 部署环境受限 | 启动时检查版本；文档写明最低版本 |
| 面板只在 WSL 上验证过 | 生产环境差异 | M1-2 在真实 VPS 上演练 |
| UI 从未在浏览器中验证过 | 前端缺陷漏网 | M0 结束前人工走查一遍；M3 引入前端测试 |

## 10. 汇报节奏

- 只在以下情况向用户汇报：里程碑完成、需要用户决策（授权、付费、范围）、阻塞、发现严重安全问题。
- 每个 sprint 的裁决记录写在 `SPRINT.md`；本文件在每个里程碑结束时修订一次。
