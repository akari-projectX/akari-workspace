# 下一版本待办（v0.4.0 之后）

> 2026-10-07 用户决定："把当前待办全部并入下一个版本"。v0.4.0 / v0.5.0 只发布 main 上已合并的内容；以下全部在下一版本处理。来源：SPRINT.md、REVIEW / research 各报告。

## 本版本继续完成（未并入下一版本）
- **akari-panel #92 性能修复**：继续在本地跟进到全绿后合并，随 v0.4.0 发布（用户：正在工作的不要停）。

## 阶段 C：性能与稳定性
- agent 24 小时以上稳定性压测（大量连接、频繁增删用户、限速、撤权、中转、断线重连；pprof 内存 / goroutine）。
- 面板压测（登录洪水、订阅高并发、管理 API、大量节点重连、结算），瓶颈分析与优化。
- 单节点容量（各协议在线设备 / 连接数，有无中转对比），写入 PERF.md。
- Alpine 节点的后台下发升级实测（Debian 已测）；面板升级失败自动回滚路径实测。

## 阶段 D：代码质量与技术债（计划在云端会话做）
- 面板仓库旧文档：`akari-panel/PLAN.md`、`akari-panel/HANDOVER.md`（2026-09-30）已过时，在下一个面板文档 PR 中归档或删除。
- 后台用户详情的流量明细目前只按节点分组（USR-23），按入口分组（R43）待补。
- 全仓审查（面板后端 + spa/ + admin/ + agent + 安装器 + CI + 文档）→ REVIEW 文档 → 分批修复。
- CodeQL 既有提示约 118 个：误报标记"不适用"写理由，真问题修复（src/auth.rs:380/391 insecure-cookie 重点确认；src/plans.rs、src/signup/pow.rs、src/account.rs、src/api.rs 的 hard-coded crypto；bench 明文传输）。
- `akari-agent-uninstall --help` 会直接卸载、无确认。
- 安装器纯 IP 安装多余等待（check_proxy 3×60 s、wait_health 120 s），约 4 分钟。
- smoke 改为"跑完全部再报告"模式 + 拆成并行任务。
- nodestat::tests::history_unknown_values 分钟边界的毫秒级竞态。
- 测试部署低优先发现中未处理的（如有）；DEPLOY 文档复核。

## 阶段 E：Red team
- 后台前缀探测、订阅路径 / 令牌猜测；认证（通行密钥、Turnstile、蜜罐、会话）；支付回调与资金逻辑；节点 mTLS 与注册；中转隔离；一键安装链接；审计规则绕过；DoS；安装脚本供应链。修复 + 回归测试 + 复测。

## 功能与运营
- 批次 D 剩余：通知邮件（封禁、退款、改 / 取消套餐、提现结果、佣金入账）中新前台 / 后台尚未覆盖的部分；ops-logic-review 低优先项（低-3/5/6/7/8/9）。
- 发信实测（需 SMTP 账号或 Resend）；支付宝沙箱完整付款实测（需沙箱 App）。
- 图形客户端实测导入（Clash Verge、Shadowrocket、Hiddify、Stash、SFA/SFI 等）。
- xray-core GHSA-5wf9-h793-w73c：等上游正式版后升级（附基准 + 全量 CI）。
- 可选：USDT 以外的提现方式 / 自动打款（用户已决定暂不做）；更多支付渠道（易支付等，按 R40 插件方式）。
- 自研客户端 akari-client（暂停中，席位绑定制）；sing-box 第二内核（暂缓）。
