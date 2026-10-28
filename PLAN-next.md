# 待办（面板 v2.1.0 / agent v0.6.1 之后）

> 只列**未完成**的事项；已完成的从本文件删除（用户："已经完成工作 清除它"），完成记录在 `SPRINT.md` 与 git 历史里。
> 做法：大改动拆成可单独合并的 PR（SPRINT `pr-size-1013`）。本轮裁决见 `briefs/round-2026-10-28.md`。

## 本轮（2026-10-28）已完成，进入面板 v2.2.0 / agent v0.6.2
- 资金：续费退款加回清零的流量、月底锚定、原路部分退款、封禁邀请人的返利（#203）；永久套餐切换确认、无支付方式也能用余额下单、删除 `device_seats`（#211）。
- 认证 / 安全：HSTS、`Sec-Fetch-Site` 跨站写请求拦截、管理员邮件不含后台链接、注册验证提示（#206）；安装器去掉未校验的下载、镜像按摘要钉住（#208）。
- 简化与性能：会话的按能力闸门删除、节点列表改写、订单搜索 `pg_trgm`（#207）。
- 节点内网 / 回环访问改为服务器开关（#213、agent#50），环境变量删除（#218、agent#51）。
- 通知邮件：封禁 / 解封、管理员改套餐、提现结果、返利入账（#210）。
- 通行密钥 e2e：两个主域名同一把密钥、注册 → 绑定邮箱全流程、Chromium 关联来源标签上限实测（#202）。
- 规范与 CI：`briefs/ENGINEERING.md`、缺陷清单（#200、agent#48）；cargo-machete、knip、jscpd、路由鉴权覆盖表（#212）。
- 文档清理：仓库删除过时文档、DEPLOY 复核（#201、agent#49）；工作区旧文档归档到 `archive/`。
- xray-core fork 长期维护写进 agent README（agent#47）。
- 修 main：重复率超门槛（#214）、安装器测试误升 Ubuntu 25.10 → 改回 24.04 LTS，Dependabot 只更新系统镜像摘要（#219）。

## 发版（面板 v2.2.0 + agent v0.6.2）
- [x] #220 体检延后项、#222 fuzz 崩溃（`inbounds` 保留键）、#223 偶发失败修复（替代 #221）、#224 版本号：已合并。
- [x] agent v0.6.2：已发布并核对（`ae1b41a`；两平台二进制与清单对得上 `SHA256SUMS`，`-version` = v0.6.2，xray fork `ce7424b`）。用户把正文换成 `release-notes/agent-v0.6.2-release-body.md`。
- [x] 面板 v2.2.0：已发布并核对（`dc08c0a`）。

## 阶段 E 红队（2026-10-28 完成）
- 四个区域（A 前门与认证、B 资金、C 节点与供应链、D 内容与外发）全部测完，无严重/高危；修复已合并：面板 #227 #228 #230 #231 #233、agent #53。报告在 `research/redteam-2026-10/`，裁决在 `briefs/redteam-2026-10.md`。
- 门户细节修复（用户截图）#234 已合并。

## 小的后续（不阻塞）
- `/brand/*` 的 304 不读图片字节（红队 D-3）；CSV 防公式注入加全角 `＝＋－＠` 与前导空格（D-7）。
- 下载名额：N 台被攻破的服务器仍可各占一个名额（C-2 残留，接受）。

## 跟进
- xray-core fork：每次升级 xray 按 agent README「xray-core 分支」把补丁带到新分支并更新 replace。
- agent 的 `release.yml` 签名循环同样没有重试（未出过错）；面板 #221 合并后照搬。
- 已接受、不再处理：`grpc::lock_or_recover`（规范的唯一例外）、请求中断时事务回滚的窗口（连接池钩子已覆盖）、3 处参数偏多的函数（SPRINT 2026-10-28）。

## 需要用户操作
- 把 agent v0.6.1、面板 v2.1.0 的 Release 正文换成 `release-notes/` 里的版本（会话代理不能改 Release）。
- 设为必需检查：agent `lint (golangci-lint)`、面板 `dead code (cargo-machete, jscpd)`。
- 关闭告警：CodeQL「`src/token.rs` 用 SHA-256 哈希密码」（误报：哈希的是 256 位随机令牌，选 False positive）；Dependabot deepmerge 低危（构建期依赖，选 Risk is tolerable）；CodeQL #170 若仍在（Won't fix，理由见 #197）。
- Dependabot 大版本 PR 先交 lead 看，不直接合并。
- 删除已合并的远程分支（会话代理不能删分支）。

## 需要用户的账号 / 设备才能做的实测
- CoinPayments / Coinbase：注册商户账号，真实小额订单走通付款与回调。
- 发信实测（SMTP 或 Resend）；支付宝沙箱完整付款。
- 图形客户端导入订阅模板：Clash Verge、Stash、SFA/SFI、Surge、Surfboard、Shadowrocket、Hiddify。
- 通行密钥：Firefox 未实测（关联来源上限、稳定性）；新增主域名后 well-known 的浏览器缓存延迟。
- 门户系统字体在真实 Mac / Windows 上的观感。

## 搁置 / 暂不做
- Docker 多实例（用户移出本轮；有需求再做）。
- USDT 以外的提现方式 / 自动打款；更多支付渠道（按 R40 插件方式）。
- 自研客户端 akari-client（暂停，席位绑定制）；sing-box 第二内核（暂缓）。
  - 恢复客户端时先修：客户端仍按旧的 `/<prefix>/sub/<token>` 规范化订阅地址，面板现在是 `/<订阅路径>/<token>`（文档已注明，代码未改）。
