# 待办（v1.0.0 之后）

> 2026-10-13 起只列**未完成**的事项；已完成的从本文件删除（用户："已经完成工作 清除它"），完成记录在 `SPRINT.md` 与 git 历史里（v1.0.0 之前的完整清单见本文件 2026-10-13 之前的版本）。
> 做法：大改动拆成可单独合并的 PR（SPRINT `pr-size-1013`）。

## ✅ 已完成（2026-10-27，进入面板 v2.1.0 / agent v0.6.1）
- 订阅模板：后端与 Surge / Surfboard 格式（#193）、后台编辑页与门户导入按钮（#194）；旧分流与规则集托管删除，不做转换。
- 支付：CoinPayments + Coinbase（#186）；fuzz 框架比较方式修正（#196）。
- 兼容代码清理：面板（#189、#198：panel.toml 废弃键、旧支付回调、最低 agent 协议 8、单元副本、旧跳转、`Stored::Legacy`、迁移压缩为 `0001_baseline.sql`）、agent（agent#45、agent#46：v1 引导格式、旧面板分支、`stale-units`）。
- 连接池事务泄漏修复（#192）；压测修复（#188：argon2 繁忙提前返回、`jit = off`）。
- agent 撤权漏切 / 资源泄漏：xray ActivityTimer 自锁，改用 fork 修复（agent#43），浸泡测试复跑通过（`research/agent-soak-2026-10.md`）。
- 安装器：新界面 + 中英双语（#183）、多实例（#184）、CodeQL 缓存投毒加固（#197）。
- 发版：面板版本号 2.1.0（#199）；发版说明 `release-notes/`。

## 发版收尾（v2.1.0 / v0.6.1）
- agent `v0.6.1` tag 已推，发版流程运行中；面板 `v2.1.0` tag 待用户推（提交 `3a14832`）。
- 两个 Release 生成后：正文换成 `release-notes/` 的说明（保留自动生成的安装命令与镜像，删去「`akari-ctl upgrade` 升级」），核对资产与签名。
- CodeQL 告警 #170（缓存投毒）：#197 已加固；若重扫后仍报，用户在 GitHub 上以 Won't fix 关闭（理由见 #197）。

## 跟进
- xray-core fork 长期维护（上游 2026-10-27 拒绝 ActivityTimer 修复）：每次升级 xray 按 agent README「xray-core 分支」手动把补丁带到新分支并更新 replace。
- 兼容清理遗留的待定项（不是旧版本兼容，但可简化）：会话代码里按能力的闸门（`latency`、`block-rules`、`source-filter` 上报）与 `GET /nodes/{id}/block-rules` 的 `agent_supported` 字段（协议 8 的 agent 都有，删除要改大量假 agent 测试与一个后台字段）；sysstatus 的 `proc_hidden` 诊断；smoke 的「旧 agent（协议 0）收到空状态」段（对应 `MIN_AGENT_PROTOCOL` 以下的降级模式，建议保留）。
- 压测遗留（PERF.md 阶段 C）：订单搜索用 `pg_trgm`（待定）；节点列表的相关子查询改写。

## 代码规范：立规矩（体检第 2 步剩余）
体检 4 份报告的 P1/P2/P3 已修，clippy（#181）与 golangci-lint（agent#41）已进 CI。剩余：
- 工程规范 `briefs/ENGINEERING.md`（单一事实来源、模块边界、命名、错误处理、SQL 与计费规则、前端数据层约定、测试要求、文档同步），各仓 CLAUDE.md 引用。
- CI 机器检查：重复代码 jscpd（设阈值）、未用依赖与死代码（cargo-machete、前端 knip、Go staticcheck unused）、入口集合 / 错误码表 / 路由鉴权覆盖表的一致性测试。
- `briefs/DEFECT-CHECKLIST.md` 加「是否复用已有实现 / 是否引入第二个事实来源」「是否留下无用代码」「性能影响」。
- agent `lint (golangci-lint)` 设为必需检查（需用户在仓库设置里操作）。

## 体检 P3 待定项（#180 留下，lead 下一轮给建议后做）
- 资金：续费退款是否收回续费时清零的流量（billing P3-1）；月底续费锚定（P3-5）；原路部分退款的语义（P3-9）。
- 认证：管理员找回密码邮件、管理员邮件里的后台链接、HSTS、`Sec-Fetch-Site` 校验、邮箱验证默认开启。
- 核心：安装脚本的未签名备用下载、Docker 基础镜像按 digest 钉住。
- 延后：billing P3-15、auth P3-22/23、core P3-6/8/13/15、前端死导出。

## 小项（随时可做）
- **xray 私有地址放行做成设置**：v26.10.21 起 freedom 默认拦截用户访问私有/回环地址，目前只有环境变量 `AKARI_ALLOW_PRIVATE_DESTINATIONS`；若有运营者需要（内网落地），做成节点级设置。
- CI 偶发：后台性能预算（一次 932 ms > 900 ms）、后台手机端用户列表 e2e、发版签名 Rekor 409——观察，复现就修。
- 安装器多实例只支持裸机；Docker 多实例未做（有需求再做）。
- 测试部署低优先发现中未处理的（如有）；DEPLOY 文档复核。

## 通行密钥（ROR，#110）遗留
- 补测试：e2e 两个主机名上同一把通行密钥登录（需再加一个主机名和中心域名）；通行密钥注册 → 弹窗绑定邮箱的整条流程（Chromium 虚拟认证器）。
- 浏览器行为未实测：Chrome 是否把 RP 自己计入 5 个标签上限；新增主域名后 well-known 的浏览器缓存生效延迟；Firefox 稳定性（曾有 140 版 `OpaqueResponseBlocking` 反馈）。

## 阶段 E：Red team（2026-10-27 用户：搁置）
- 后台前缀探测、订阅路径 / 令牌猜测；认证（通行密钥、Turnstile、蜜罐、会话）；支付回调与资金逻辑（含新的加密网关）；节点 mTLS 与注册；中转隔离；一键安装链接；审计规则绕过；订阅模板注入；DoS；安装脚本供应链。修复 + 回归测试 + 复测。

## 需要用户的账号 / 设备才能做的实测
- CoinPayments / Coinbase：注册商户账号，真实小额订单走通付款与回调。
- 发信实测（需 SMTP 账号或 Resend）；支付宝沙箱完整付款实测（需沙箱 App）。
- 图形客户端实测导入订阅模板：Clash Verge、Stash、SFA/SFI、Surge、Surfboard、Shadowrocket、Hiddify。
- 门户系统字体在真实 Mac / Windows 上的观感。

## 功能与运营
- 批次 D 剩余：通知邮件（封禁、退款、改 / 取消套餐、提现结果、佣金入账）中新前台 / 后台尚未覆盖的部分；ops-logic-review 低优先项（低-3/5/6/7/8/9）。
- 可选：USDT 以外的提现方式 / 自动打款（用户已决定暂不做）；更多支付渠道（按 R40 插件方式）。
- 自研客户端 akari-client（暂停中，席位绑定制）；sing-box 第二内核（暂缓）。

## 仓库整理（用户操作）
- 删除已合并的远程分支（会话代理禁止删除分支；命令已给用户）。
