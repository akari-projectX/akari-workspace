# 门户验收清单：新门户（Akari-theme 并入 akari-panel/spa）对照面板用户功能

> 初版 2026-10-06（只读差距分析，面板 `d907f52` + 主题 W36-a）。**本版 2026-10-07：W36-b PR2 前按面板 main `db41630`（阶段 A 全部合并：PR① 资金与套餐、PR② 节点与订阅、PR③ 入口与账号）复核**，
> 并改写成验收清单：每一行写明新门户怎么做的、由哪个端到端用例覆盖。主题侧依据 `mwnydev/Akari-theme` main `fa7136d`（W36-b PR1，接口层与缺失功能补齐）+ PR2 在面板仓库里的改动。
> 验收规则（SPRINT 2026-10-06「功能完整性要求」）：每一行都要有 e2e（Playwright，真实面板 + 真实 CSP，桌面与手机各跑一遍，任何 CSP 违规或页面异常即失败），全部通过才合并、才删除旧门户。
> 用例在 `akari-panel/spa/e2e/`（`../scripts/e2e-portal.sh`，CI job `e2e`），用例标题里的 `#n` 就是下表的编号。接口省略前缀；门户在主域名 `/`（D11）。

**结论**：面板 60 项用户功能 + 阶段 A 新增的 11 项，新门户全部覆盖，每项都有 e2e。初版的 22 项缺失、35 项需改已在主题 PR1 与本 PR 里完成；主题独有的 20 项按裁决删除（1.8）。
需要面板配合的只读字段与接口（lead 已批）：`/me`、`/auth/options` 的 `timezone`；`MyOrderView` 的 `action` 与退款去向字段；条款 / 隐私的公开接口 `GET /api/v1/pages/{terms|privacy}`（读 W33-b 加的 `kb_articles.slug`，W33-b 合并后接入；在此之前页面显示中性缺省文案，e2e 覆盖的就是缺省这一支）。

e2e 列：`A` = auth.spec.ts，`C` = account.spec.ts，`S` = subscription.spec.ts，`B` = shop.spec.ts，`W` = wallet.spec.ts，`T` = support.spec.ts。

## 1. 对照表

### 1.1 认证与注册（公开页）

| # | 面板功能 | 面板接口 | 新门户 | e2e |
|---|---|---|---|---|
| 1 | 邮箱 + 密码登录（D1），失败统一 401 | `POST /auth/login {email,password,guard}` | cookie 会话，无令牌；统一提示「邮箱或密码错误」 | A #1 |
| 2 | 按账户范围分流：full / renewal（R21）/ banned（W28-c）；管理员（D4） | 登录答复、`GET /me` | `scopeOf` + `PAGE_SCOPES`；门户上管理员登录 = 错误密码的回答，同一浏览器的管理员会话 = 404 → 按未登录处理；门户里没有后台地址 | A #2，C #18 #19 |
| 3 | 通行密钥登录（可发现凭据） | `POST /auth/passkey/options` → `/auth/passkey/login` | 真实 WebAuthn；入口只在 `/auth/options.passkey` 时显示 | A #3（虚拟认证器，经 TLS 前端的 https 主域名） |
| 4 | 密码登录后引导绑定（`passkey_prompt`，可选「以后只用通行密钥」） | 登录答复 → `/me/passkeys/options` → `POST /me/passkeys` | 登录后弹窗 | A #4 |
| 5 | 仅通行密钥账户用密码登录 → 403 `auth.passkey_required` | `POST /auth/login` | 提示并突出通行密钥按钮 | A #5 |
| 6 | 注册（邮箱验证开）：发码再注册 | `/auth/register/code` → `/auth/register` | `code`、`locale`、`guard` | A #6（Mailpit 取码） |
| 7 | 注册（邮箱验证关，默认）：工作量证明 | `/auth/register/challenge` → `register {pow}` | `api/pow.ts` | A #7 |
| 8 | 注册开关、邀请码必填、邮箱域名白名单、找回密码开关 | `GET /auth/options` | 关注册 → 暂停注册页；白名单提示；`reset=false` 隐藏「忘记密码」 | A #8 |
| 9 | 邀请链接预填 | `?invite=`，前缀 `/me/invite-codes.link_base` | 注册页读 `invite`；邀请页用服务端 `link_base` | A #9，W #55 |
| 10 | 注册赠送试用套餐的提示 | `register` 答复 `trial` | 「已赠送试用套餐」 | A #10 |
| 11 | Turnstile（登录/注册/找回分别开关） | `guard.turnstile`，`auth.captcha_*` | 动态加载；**面板只在开启时给门户页面放行 challenges.cloudflare.com**（`web::CSP_TURNSTILE`，本 PR） | A #11（CSP 头开/关、假 Turnstile 脚本、错误码文案）；面板 `w36_tests` |
| 12 | 蜜罐 + 最短提交时间 | `guard.form_token/form_min_secs/honeypot` | `website` 输入框（屏幕外、`aria-hidden`、`tabindex=-1`）；等够最短时间才提交 | A #12（种子与用例的登录都走真实 guard） |
| 13 | 找回密码：申请 → 邮件链接 → 设新密码（其他会话结束） | `/auth/password-reset/request` → 邮件 `/reset#token=` → `/auth/password-reset` | BrowserRouter，`/reset` 读 `#token=` 后立即从地址栏抹掉 | A #13（Mailpit 取链接，链接在主域名、无 `/app`）；坏链接一例 |
| 14 | 站点名、LOGO、favicon、页脚文字与链接、条款 / 隐私链接 | `/auth/options.site_name/branding`，`/brand/{name}` | 版权署站点名；配了外链页脚直接指向外链 | T #14 |
| 15 | 客户端下载（管理员配置） | `branding.client_downloads` | 订阅区「下载客户端」 | T #15 |
| 16 | 退出登录（结束**所有**会话） | `POST /auth/logout` | 菜单写明「所有设备」 | A #16（另一台设备随后被送回登录页） |

### 1.2 账户

| # | 面板功能 | 面板接口 | 新门户 | e2e |
|---|---|---|---|---|
| 17 | 账户概览 | `GET /me`（+ `timezone`，本 PR）、`/me/plan` | 账号页；日期按站点时区 | C #17 |
| 18 | 封禁视图：原因 + 只能工单 | `/me.banned/ban_reason`；其余 403 `account.banned` | 封禁说明页；其余路由回到它 | C #18 |
| 19 | 续费范围（到期 / 流量用完）：横幅，只剩商店、订单、钱包、工单、帮助、账户 | `/me.expired/quota_exhausted` | 横幅 + 缩减导航；商店预选（流量用完 → 重置包，中-1） | C #19（两种） |
| 20 | 绑定 / 更换邮箱（密码 + 验证码） | `/me/email/code`、`/me/email/verify` | 账号页 | C #20 |
| 21 | 未验证邮箱的引导（中-8） | `me.email_verified` | 仪表盘横幅「去验证」 | C #21 |
| 22 | 修改密码（其他会话结束） | `POST /me/password` | 安全设置页签 | C #22 |
| 23 | 邮件语言跟随界面语言 | `PUT /me/locale` | 切换语言即同步 | C #23（库里 `locale` 变为 en） |
| 24 | 管理通行密钥 | `/me/passkeys*` | 安全设置页签 | A #24 |
| 25 | 账户自己的「只用通行密钥」开关 | `PUT /me/password-login` | 安全设置页签 | A #25 |
| 26 | 自助注销（删除个人数据，财务记录匿名化保留） | `GET /me/delete-impact`、`POST /me/delete {confirm,password?}`（PR③） | 影响摘要（含「匿名保留 / 整个删除」）；有待付订单 / 待审提现时直接说明并禁用按钮；只用通行密钥的账户不要密码 | C #26 |

### 1.3 订阅与节点

| # | 面板功能 | 面板接口 | 新门户 | e2e |
|---|---|---|---|---|
| 27 | 订阅链接：复制、二维码 | `me.sub_url`（D11 随机订阅路径、D8 订阅域名 / 按用户随机） | 只用 `sub_url`（相对地址补本站 origin），从不按令牌拼；二维码本地生成，中心标是静态文件（CSP） | S #27（复制的地址 = 随机路径，直接请求面板可用） |
| 28 | 订阅格式选择（自动 / clash / sing-box / links） | `?format=`；`me.sub_formats`（PR② §5 开关） | 只列开着的格式 | S #28 |
| 29 | 一键导入（W30） | `me.sub_import_clients` | 按面板给的客户端 id 与顺序拼 scheme（Shadowrocket 用 URL 安全 base64） | S #29 |
| 30 | 重置订阅（新链接 + 凭据轮换 + 断线） | `POST /me/sub-token` | 确认框写明所有设备断线 | S #30（旧路径随即 404） |
| 31 | 当前套餐（额度、重置周期、下次重置、到期、限速） | `GET /me/plan` | 账号页 | S #31 |
| 32 | 可用入口（每个入口一行） | `GET /me/nodes` | 节点页（直连 + 中转入口） | S #32 |
| 33 | 倍率：D9 分时段 | `/me/nodes.rate` = 此刻生效的倍率（SQL `akari_entrance_rate`） | 显示此刻倍率（时段规则不对用户展开，lead 裁决） | S #33（全天 0.5× 的规则 → 显示 ×0.5） |
| 33a | D5 服务器流量额度用完 | 该服务器的入口不出现在 `/me/nodes` | 不显示，不另加「已暂停」 | S #33（额度用完后入口消失） |
| 34 | 流量明细（站点时区日界、按节点） | `GET /me/traffic` | 流量页 | S #34 |

### 1.4 商店与订单

| # | 面板功能 | 面板接口 | 新门户 | e2e |
|---|---|---|---|---|
| 35 | 商店目录：服务端按「现在下单」报价 | `GET /me/shop` | 前端不算价 | B #35 |
| 36 | 周期（月…三年、N 天、一次性、重置包） | `offers[].period/days` | 时长选择 | B #36 |
| 37 | 换套餐折算与作废（PR① 实付价值） | `offers[].credit_cents/forfeited_cents` | 金额明细；有作废时必须勾选确认 | B #37（折算抵扣、作废需确认两例） |
| 38 | 续费 / 换套餐规则与拒绝原因 | `offers[].refusal`；仅续费的套餐不卖给新用户 | 每个拒绝原因中英文案 | B #38 |
| 39 | 流量重置包 | `action=reset` | 当前套餐下的重置包 | B #39 |
| 40 | 优惠券（服务端逐周期校验） | `?coupon=` | 整码拒绝的文案；折扣逐项列出 | B #40 |
| 41 | 用余额抵扣 | `?use_balance=true` | 开关；全额抵扣当场付清 | B #41 |
| 42 | 选择支付方式（多于一种时必须选） | `shop.methods`，`method_id` | 未选不能付款 | B #42（加第二个支付方式） |
| 43 | 一次调用下单 | `POST /me/orders` | — | B #43 |
| 44 | 付款页：二维码、轮询 | `GET /me/orders/{id}` | 模拟网关付款后页面自己变成已付款 | B #44 |
| 45 | 取消待支付订单 | `POST /me/orders/{id}/cancel` | — | B #45 |
| 46 | 订单列表、状态、类型 | `GET /me/orders`（+ `action`，本 PR） | 类型列总是显示 | B #46 |
| 47 | 退款显示：**三种去向**（PR③：原路退回 / 退到余额 / 渠道后台退款后登记）与 P1 套餐效果 | `MyOrderView.refund_route/refund_balance_cents/refund_external_cents/refund_pending/refund_effect`（本 PR） | 订单详情写明去向、金额与套餐效果；原路退款等渠道确认时显示「退款处理中」 | B #47（三种各一单）；面板 `billing::tests::refund`、smoke |
| 48 | 售罄与库存 | `remaining/sold_out` | 「已售罄」 | B #48 |
| 49 | 付了款却开通不了 → 自动退到余额（中-2） | 退款去向 balance、效果 none | 同 #47 的显示；仍未退时说明会退到余额 | B #47 |
| 50 | 设备数（不执行，决策 3） | `device_seats` | 隐藏 | — （不显示的东西不测） |

### 1.5 钱包与邀请

| # | 面板功能 | 面板接口 | 新门户 | e2e |
|---|---|---|---|---|
| 51 | 余额与流水 | `GET /me/balance` | 钱包页（续费范围也能看） | W #51 |
| 52 | 申请提现：**R46 只付 USDT** | `POST /me/withdrawals {amount_cents, chain, address, memo?}`；`/me/invite.usdt_chains/usdt_rate_cents` | 网络只列后台开着的；每个网络的地址格式提示；TON 才有 Memo；参考汇率「约 N USDT」；通过后显示实付 USDT 与交易哈希（可复制） | W #52（错网络地址的文案、TON + Memo、通过后的哈希） |
| 53 | 提现记录与撤回 | `GET /me/withdrawals`、`POST …/cancel` | — | W #53 |
| 54 | 邀请计划与返佣明细（不显示对方邮箱） | `GET /me/invite` | 邀请页 | W #54 |
| 55 | 邀请码管理 | `/me/invite-codes` | 生成、删除、链接用 `link_base` | W #55 |
| 56 | 佣金追回（中-4） | 流水 `commission_clawback`；余额不够只扣到 0，差额记欠款（余额永不为负） | 流水里显示追回 | W #56 |

### 1.6 工单、公告、帮助、仪表盘、条款

| # | 面板功能 | 面板接口 | 新门户 | e2e |
|---|---|---|---|---|
| 57 | 工单：分类、优先级、关联订单、未读、回复、关闭 | `/me/tickets*` | 工单页（封禁账户也能用） | T #57 |
| 58 | 公告：服务端 HTML、置顶、服务端已读 | `/me/announcements*` | 公告页与仪表盘 | T #58 |
| 59 | 知识库：分类、搜索、文章 | `/me/help?q=`、`/me/help/{id}` | 顶部重做（搜索独占一行、分类换行排开不截断、当前设备捷径；文章页与其它页同一页首 + 面包屑 + 元信息）；文章卡片保持原样 | T #59 |
| 60 | 仪表盘汇总 | `/me`、`/me/plan`、`/me/announcements`、`/me/traffic` | — | T #60 |
| 61 | 条款与隐私（R45 后裁决：读后台内容，缺省中性文案） | `GET /api/v1/pages/{terms\|privacy}`（知识库 slug `terms`/`privacy`，W33-b 加 slug 列，合并后接入） | 删除主题自带的条款 / 隐私 / FAQ 文本 | T「terms and privacy」 |

### 1.7 门户的边界（D4、D11、CSP）

| 项 | 新门户 | e2e / 测试 |
|---|---|---|
| 门户在 `/`，每个客户端路由返回 index，其余顶层路径是统一拒绝 | `access::PORTAL_PAGES` 与 `spa/src/lib/routes.ts` 由面板测试比对 | T「the portal's edges」；`access::tests::routes_match_the_portal`；smoke「SPA」段 |
| 门户从不请求后台、产物里没有后台代码 | `check-bundles.mjs`（标记自带样例）；smoke 对实际下发的全部分包再查 | T「the portal's edges」；CI `spa`、smoke |
| CSP 只允许 `'self'`（Turnstile 例外只在开启时、只给门户页面） | `check-dist.mjs`；每个用例收集 CSP 违规 | 全部用例（fixtures）；A #11；`w36_tests` |
| 邮件里的门户链接（无 `/app`） | `/shop`、`/reset#token=`、`/register?invite=` | A #13 |
| 错误码：用户可见命名空间全部中英映射；后台的码由后台应用检查 | `check-error-codes.mjs` 读面板错误码表 | CI `spa` |
| 中英双语：界面中文全部有英文、词典无死条目 | `check-i18n.mjs` | CI `spa`；C #23、A 若干 |

### 1.8 主题有、面板没有的功能（已删除）

客户端交接页（`clientBridge`）、会话 / 设备列表、公开节点状态与负载、邮件登录链接 `token2Login`、邮箱验证码登录、注册时直接创建通行密钥、迁移到通行密钥、佣金划转（两本账）、用户级提醒开关、Telegram / `uuid` / 个人返佣比例等字段、未登录看价格、货币配置、支付手续费、节点协议 / 版本筛选、Surge / Loon 导入、公告配图与标签、邀请链接访问量、`SiteConfig` 的 hero 等字段、旧路由别名（`/dashboard` 等）、
**主题自带的条款 / 隐私 / 常见问题页及其中的营销断言**（「Deloitte 独立审计」「一个账号 20 台设备同时在线」「支持信用卡 / 微信 / USDT 付款」「节点无盘运行」「5 分钟内摘除故障节点」「企业版 SSO、99.99% SLA」「适用香港法律、一律不退款」等，均非本站事实）、知识库页按平台写死的「接入步骤」与「极速无缝体验」文案、门户里的「管理员账户」提示页（管理员到不了门户）。

## 2. 依赖与后续

| 项 | 状态 |
|---|---|
| 条款 / 隐私读知识库 slug | 等 W33-b 合并（它加 `kb_articles.slug` 与编辑器字段）；本 PR rebase 后加公开接口与测试 |
| 删除旧后台页面（spa/ 里已全部删除）、`/{prefix}/app` 管理员登录页 | W33-b 提供新后台与登录页；本 PR rebase 后收尾 |
| 低-8 余额全额抵扣不依赖支付方式、低-3 作废折算转余额开关 | 未排期；门户按现状实现（作废需确认） |
