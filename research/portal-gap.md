# 门户差距分析：Akari-theme 对照面板用户功能（W36-b 准备）

> 日期：2026-10-06。只读分析，没有改动任何仓库。
> 面板依据：`akari-panel` origin/main `d907f52`（阶段 A PR① 已合并），包括 README 的 API 表、`src/`（web.rs、signup/、passkey.rs、billing/、trafficlog.rs、nodestat.rs、announcements.rs、kb.rs、tickets.rs）、现有门户 `spa/src`（app.tsx、portal-views.tsx 及 dashboard/subscription/purchase/wallet/tickets/help/announcements/portal*/login/register/reset 页面）。
> 主题依据：`mwnydev/Akari-theme` main（W36-a 已合并，浅克隆，读完已删除），主要看 `src/api/index.ts`、`src/api/types.ts`、`src/pages/**`、`src/components/**`、`src/lib/**`。
> 计划依据：PLAN-v0.4.md §2/§3、SPRINT.md 末尾的裁决、research/ops-logic-review.md 批次 D。
> 文中主题文件路径相对于主题仓库根目录，面板接口省略 `/{prefix}` 前缀。

**结论**：共对照面板 60 项用户功能。**有且匹配 3 项，有但需改 35 项，缺失 22 项**。另有 20 项是主题有、面板没有的，基本按裁决删除，其中订单类型列需要面板补一个只读字段。主题的界面外壳比较完整，但接口层完全按 xboard 设计：Bearer 令牌、数字 id、Unix 秒、前端自行算价、佣金与余额分账。所以"有但需改"基本都需要重写数据层。缺失项主要集中在四块：账户状态（封禁、续费范围）、注册防护（Turnstile、蜜罐、PoW）、钱包（流水、提现记录）、商店规则（折算、余额抵扣、拒绝原因）。

---

## 1. 功能对照表

状态：✅ 有且匹配　🟡 有但需改　❌ 缺失。主题有、面板没有的功能见 1.7。

### 1.1 认证与注册（公开页）

| # | 面板功能 | 面板接口 | 主题状态 | 主题文件 | 说明 |
|---|---|---|---|---|---|
| 1 | 邮箱 + 密码登录（D1） | `POST /auth/login` `{email,password,guard?}` | 🟡 | `pages/auth.tsx` Login、`lib/auth-provider.tsx`、`api/index.ts` passport.login | 面板用 httpOnly + SameSite=Strict 的会话 cookie，没有 Bearer 令牌：删掉 `AuthData.auth_data/token`，请求一律 `credentials:'same-origin'`。所有失败都是统一的 401。要带上 `guard` |
| 2 | 登录结果分流：`expired`/`quota_exhausted` 进续费范围（R21），`banned` 进门户范围（W28-c），`role=admin` | 同上返回体、`GET /me` | ❌ | — | 主题登录后一律进仪表盘。D4 要求前台不出现后台地址：管理员只显示"请使用后台地址"，不给链接（现有门户会跳 `/admin`，③ 之后不能再跳） |
| 3 | 通行密钥登录（可发现凭据、无用户名） | `POST /auth/passkey/options` → `POST /auth/passkey/login` `{state,credential}` | 🟡 | `pages/auth.tsx` usePasskeyLogin | mock 传 `credential:null`，要补真正的 `navigator.credentials.get` 和 base64url 的 JSON 编解码。入口只在 `/auth/options.passkey === true` 时显示（需要 https 主域名） |
| 4 | 密码登录后引导绑定通行密钥（`passkey_prompt`，可勾选"以后只用通行密钥" `disable_password`） | 登录返回 `passkey_prompt` → `POST /me/passkeys/options` → `POST /me/passkeys` | ❌ | — | 主题的做法是"迁移登录"插件流程（见 1.7），要改成面板的模型 |
| 5 | 仅通行密钥账户：用密码登录返回 403 `auth.passkey_required` | `POST /auth/login` | 🟡 | `pages/auth.tsx` PasskeyOnlyLogin | 主题按站点开关整页切换，并带"邮箱验证码登录 / 迁移"兜底。面板是按账户判断的，前端只需要提示错误并突出通行密钥按钮。丢失通行密钥由管理员用 `reset-login` 处理 |
| 6 | 注册（开启邮箱验证）：发码，再注册 | `POST /auth/register/code` → `POST /auth/register` `{email,code,password,invite_code?,locale?,guard?}` | 🟡 | `pages/auth.tsx` Register、passport.sendEmailVerify/register | 字段名不同（`email_code`→`code`），并且要带 `locale`、`guard`。发码接口对任何地址都返回 `{"ok":true}`，不能据此判断邮箱是否已注册 |
| 7 | 注册（关闭邮箱验证，默认）：工作量证明 | `GET /auth/register/challenge` → `register {pow:{challenge,nonce}}` | ❌ | — | 默认配置下**不实现就无法注册**。可以移植面板 `spa/src/lib/pow.ts` |
| 8 | 注册开关、邀请码必填、邮箱域名白名单、找回密码开关 | `GET /auth/options` `{register,invite_required,email_domains,reset,email_verify}` | 🟡 | `lib/site.ts` registerClosed、`api/types.ts` GuestConfig | 字段要映射：`is_invite_force`→`invite_required`，`email_whitelist_suffix`→`email_domains`。`reset=false` 时要隐藏找回密码入口 |
| 9 | 邀请链接预填 | `?invite=CODE`，链接前缀由 `/me/invite-codes.link_base` 给出 | 🟡 | `pages/auth.tsx`（读 `?code=`）、`pages/dash/referral.tsx`（自己拼链接） | 参数名改为 `invite`。链接用服务端给的 `link_base`，不要用 `portalLink()` 自己拼 |
| 10 | 注册赠送试用套餐的提示 | `register` 返回 `trial` | ❌ | — | S |
| 11 | Cloudflare Turnstile（登录、注册、找回密码可以分别开启） | `/auth/options.guard.turnstile{site_key,login,register,reset}`，错误码 `auth.captcha_failed/unavailable` | ❌ | — | 需要动态加载 challenges.cloudflare.com 的脚本。**面板 CSP 要放行**（SPRINT 已把这项划给 W36-b），主题的 `check-dist` 也要相应放宽 |
| 12 | 蜜罐 + 最短提交时间 | `guard.form_token/form_min_secs/honeypot`，表单带 `guard:{form_token,website:""}` | ❌ | — | 要加一个隐藏的 `website` 输入框，并在 `form_min_secs` 之后才提交（参照面板 `lib/api.ts` 的 formGuard）。被拦截时返回的是普通失败 |
| 13 | 找回密码：申请后通过邮件链接设新密码 | `POST /auth/password-reset/request` → 邮件链接 `…/app/reset#token=…` → `POST /auth/password-reset {token,password}` | 🟡 | `pages/auth.tsx` Forgot（验证码 + 新密码放在同一页） | 流程不同：要拆成"申请页"和"按令牌重置页"。**主题的 HashRouter 与 `#token=` 冲突**，见 §3.3 |
| 14 | 站点名、LOGO、favicon、页脚文字和链接、条款和隐私链接 | `/auth/options.site_name/branding`，`GET /brand/{name}` | 🟡 | `lib/site.ts` SiteConfig、`components/logo.tsx`、`site-footer.tsx` | README 已经约定 `SiteConfig` 映射 `/auth/options`。`logo_url` 是相对前缀的路径 |
| 15 | 客户端下载（7 个平台，管理员配置） | `branding.client_downloads[{platform,label,url}]` | 🟡 | `pages/dash/guide.tsx`（读 `client_bridge.downloads`，只有 3 个平台）、`data/platforms.ts` | 平台列表对齐 windows/macos/linux/android/ios/harmony/other |
| 16 | 退出登录 | `POST /auth/logout`（会结束该账户的**所有**会话） | 🟡 | `lib/auth-provider.tsx` signOut、`components/user-menu.tsx` | 要真正调用接口，并在文案里说明"所有设备都会退出" |

### 1.2 账户

| # | 面板功能 | 面板接口 | 主题状态 | 主题文件 | 说明 |
|---|---|---|---|---|---|
| 17 | 账户概览（邮箱、是否已验证、流量、到期、订阅链接） | `GET /me` | 🟡 | `api/types.ts` UserInfo/Subscribe、`lib/auth-provider.tsx` | 结构不同：主题的 info/subscribe/config 三个接口要合成 `/me` + `/me/plan` |
| 18 | 封禁视图：显示原因，只能看仪表盘和工单 | `GET /me.banned/ban_reason/banned_at`；其他接口返回 403 `account.banned` | ❌ | `pages/dash/settings.tsx` 只有一个"已封禁"徽章 | 要整站收窄导航，并显示封禁说明页 |
| 19 | 续费范围（到期或流量用完）：只能用商店、订单、钱包、工单、帮助、账户；显示续费横幅 | `GET /me.expired/quota_exhausted` | ❌ | `layouts/dash-layout.tsx` | 节点、流量、订阅接口对这类账户会拒绝，所以要按范围隐藏导航和区块（参照面板 `portal-views.tsx` 的 `viewsFor`） |
| 20 | 绑定或更换邮箱（当前密码 + 邮件验证码） | `POST /me/email/code {email,password}`、`POST /me/email/verify {code}` | ❌ | — | M |
| 21 | 引导验证邮箱（中-8：未验证的地址收不到到期、流量和收据邮件） | `me.email_verified` | ❌ | — | 只改门户即可 |
| 22 | 修改密码（其他会话会结束） | `POST /me/password {current_password,new_password}` | ✅ | `pages/dash/settings.tsx` | 只需要映射接口和错误码（`account.invalid_password` 等）。没有密码的账户（`password_set=false`）不显示这一区块 |
| 23 | 邮件语言跟随界面语言 | `PUT /me/locale {locale}` | ❌ | `i18n/provider.tsx` | S：切换语言时顺手调用一次 |
| 24 | 管理通行密钥：列表、添加、重命名、删除 | `GET/POST /me/passkeys`、`POST /me/passkeys/options`、`PATCH/DELETE /me/passkeys/{id}` | 🟡 | `pages/dash/settings.tsx` PasskeySection | 要补真正的 `navigator.credentials.create`。字段对齐：面板有 `current/available/max/rp_id`，没有 `synced`。名称最多 64 个字符，每个账户最多 10 个 |
| 25 | 账户自己的"仅通行密钥"开关 | `PUT /me/password-login {enabled}`（关闭前必须有当前可用的通行密钥，否则 409 `account.passkey_required`） | ❌ | — | S |
| 26 | 自助注销（删除个人数据，财务记录匿名化保留） | **未合并**（③ W27） | ❌ | — | 要等 ③ 的接口，见 §4 |

### 1.3 订阅与节点

| # | 面板功能 | 面板接口 | 主题状态 | 主题文件 | 说明 |
|---|---|---|---|---|---|
| 27 | 订阅链接：显示、复制、二维码 | `me.sub_url`（`sub_token`；`sub_legacy` 表示旧链接，重置后才能显示） | 🟡 | `components/subscribe.tsx` | 要处理 `sub_url=null` 和 `sub_legacy`。③ 之后订阅路径是随机的，**只能用服务端给的 `sub_url`，前端不能自己拼**。二维码中心的 LOGO 是 `data:` 图片，**会被 CSP 拦截**，见 §3.4 |
| 28 | 选择订阅格式（自动 / clash / sing-box / links） | `/sub/{token}?format=` | ❌ | — | S |
| 29 | 一键导入客户端 | 面板现有：Clash Verge/mihomo、Shadowrocket（`sub://` + base64 的 links 格式）、sing-box、Stash、Hiddify，每个客户端带上自己的 `format` | 🟡 | `components/subscribe.tsx` CLIENTS（Clash、Shadowrocket、sing-box、Surge、Loon、V2rayN） | Surge 和 Loon 面板没有对应格式，要删。URL scheme 以 ② W30 的定稿为准 |
| 30 | 重置订阅（新链接 + 所有入口的凭据轮换 + 断开现有连接，每小时 5 次） | `POST /me/sub-token` | ✅ | `components/reset-subscription.tsx` | 接口映射即可。确认文案要补一句"所有设备会立即断线"（高-3） |
| 31 | 当前套餐：额度、重置周期、下次重置时间、到期时间、限速、可用节点 | `GET /me/plan`（`next_reset_at` 带全站时区的偏移） | 🟡 | `pages/dash/settings.tsx`、`pages/dash/plans.tsx`、`components/plan-specs.tsx` | 主题的 `reset_day`（距下次重置的天数）要从 `next_reset_at` 推算。重置周期用 `monthly / days-N / none`，不再用 `reset_traffic_method` |
| 32 | 可用入口列表（每个入口一行：节点名、入口名、地区、标签、倍率、在线、延迟） | `GET /me/nodes` | 🟡 | `pages/dash/nodes.tsx`、`pages/dash/dashboard.tsx`、`lib/node.ts` | 面板不返回协议、版本、负载、在线人数，所以协议筛选和负载列都要删。要加入口名、地区、延迟和测速时间（`probe_interval_secs`） |
| 33 | 倍率显示（W28-a 按入口；D9 分时段倍率） | `/me/nodes.rate`；D9 **未合并**（②） | 🟡 | `pages/dash/nodes.tsx` 倍率排序 | 现在可以先接入口的基础倍率；当前时段倍率和时段规则等 ② 合并后再接 |
| 34 | 流量明细（按全站时区的日界，每天上行、下行、计费；按节点汇总；保留期） | `GET /me/traffic?from&to` → `{timezone,daily_since,total,days[{day,up_bytes,down_bytes,billed_bytes}],nodes[{name,…}]}` | 🟡 | `pages/dash/traffic.tsx`、`week-chart.tsx`、`lib/traffic.ts` | 面板没有按倍率分档的数据：主题的"计费倍率分布"图要改成按节点分布，或者用"计费 ÷ 原始"算出有效倍率。范围默认"本月"，按接口返回的时区计算 |

### 1.4 商店与订单

| # | 面板功能 | 面板接口 | 主题状态 | 主题文件 | 说明 |
|---|---|---|---|---|---|
| 35 | 商店目录：每个周期都按"现在下单"由服务端算好价，带动作和拒绝原因 | `GET /me/shop` → `plans[{offers[{action new/renew/switch/reset, refusal, amount_cents,…}]}]` | 🟡（L） | `pages/dash/plans.tsx`、`components/plan-content.tsx` | **主题在前端自己算价**（`price()`、`buyTotal`），要整体改成展示服务端给的报价。面板现有门户的 `preselect` 规则（流量用完时默认选重置包，到期时默认选续费）要搬过来，否则中-1 的前端保护会丢 |
| 36 | 周期类型：month…three_year、`days`（N 天，可以有多档）、`onetime`（可以带天数）、`reset` | `offers[].period/days` | 🟡 | `api/types.ts` PlanPeriodKey、`lib/format.ts` PERIOD_LABEL | 主题的 `Plan.prices` 是按周期名做键的对象，表达不了多档 `days`。要改成数组 |
| 37 | 换套餐折算和作废金额（PR①：按实付金额、按剩余时间和剩余流量的比例，排除已退款订单） | `offers[].credit_cents/forfeited_cents`、`shop.credit_cents` | ❌ | — | 要显示"折算抵扣 X，作废 Y"。从永久套餐换出、或有作废金额时，要二次确认（低-3） |
| 38 | 续费、换套餐的规则和拒绝原因：`renewal_only`、`no_switch`、`not_for_sale`、`sold_out`、`reset_needs_subscription`、`no_expiry`；一次性套餐续费给新额度（中-1）；下架后仍可续费（中-6） | `offers[].refusal`、`action` | ❌ | — | 每个拒绝原因都要有中英文案 |
| 39 | 流量重置包 | `action=reset` | 🟡 | `pages/dash/plans.tsx` resetPrice | 改为从商店报价里取，不再单独查当前套餐 |
| 40 | 优惠券（服务端按每个周期校验） | `GET /me/shop?coupon=CODE` → `coupon.refusal`、`offers[].discount_cents/coupon_refusal`；下单时带 `coupon` | 🟡 | `pages/dash/plans.tsx` applyCoupon、`api` coupon.check | 不再有单独的校验接口，也不再在前端按 `type/value` 算折扣 |
| 41 | 用余额抵扣 | `?use_balance=true`、下单时带 `use_balance` → `offers[].balance_cents` | ❌ | — | S–M |
| 42 | 选择支付方式（多于一种时必须选） | `shop.methods[{id,kind,display_name,icon}]`，下单时带 `method_id` | 🟡 | `components/payment-method-picker.tsx` | 面板没有手续费，`paymentFee` 要删。`shop.enabled=false` 表示没有可用的支付方式 |
| 43 | 下单（一次调用；金额在 SQL 里算；全额抵扣时立即付款） | `POST /me/orders {plan_id,period,coupon?,use_balance?,method_id?}` → 订单（`qr_code`/`pay_url`） | 🟡 | `pages/dash/plans.tsx` submit（主题是 save 再 checkout 两步） | 合成一步。错误码有 `order.in_progress`、`order.method_required` 等 |
| 44 | 付款页：支付宝二维码或跳转，轮询状态（服务端会主动向支付宝查单） | `GET /me/orders/{id}` | 🟡 | `pages/dash/order-detail.tsx` | 二维码组件可以保留。"换一种支付方式"要改成"取消后重新下单" |
| 45 | 取消待支付订单 | `POST /me/orders/{id}/cancel` | ✅ | `pages/dash/orders.tsx`、`order-detail.tsx` | 接口映射即可 |
| 46 | 订单列表和状态（pending/paid/expired/cancelled，再加 `refunded_at`、`fulfilled`） | `GET /me/orders`（最近 50 笔） | 🟡 | `pages/dash/orders.tsx`、`api/types.ts` Order | 主题的状态是 xboard 的 0–4，类型是 1–4。面板的用户订单视图**没有 action 字段**，见 1.7 |
| 47 | 退款显示（P1 退款同时撤销订阅效果；退款通知邮件） | `refunded_at`；余额流水的 `refund_to_balance` | ❌ | — | 订单要标"已退款"，并说明"对应套餐已撤销或回退" |
| 48 | 售罄和库存（未付订单会占用库存，中-2） | `remaining/sold_out` | 🟡 | `api/types.ts` capacity_limit | 字段映射 |
| 49 | 已付款但无法开通时自动退回余额（中-2、低-4） | `fulfilled=false`、余额流水 | ❌ | — | 订单详情要说明"款项已退到余额" |
| 50 | 设备数 | `device_seats`（面板不执行，决策 3） | 🟡 | `components/plan-specs.tsx`、`pages/dash/settings.tsx` | 按低-9 **隐藏** |

### 1.5 钱包与邀请

| # | 面板功能 | 面板接口 | 主题状态 | 主题文件 | 说明 |
|---|---|---|---|---|---|
| 51 | 余额和流水（佣金、管理员调整、订单支付、退款到余额、提现、提现退回、佣金追回） | `GET /me/balance?before&limit` → `{balance_cents,withdrawable_cents,entries[]}` | ❌ | 主题只在仪表盘和订单页显示一个余额数字 | M，需要新页面或新区块（续费范围的账户也能看） |
| 52 | 申请提现 | `POST /me/withdrawals {amount_cents,method alipay/wechat/bank/other,account}`（立即从余额扣除；不超过可提现金额；有最低额） | 🟡 | `pages/dash/referral.tsx` withdraw（走 `ticket.withdraw`，没有金额） | 已有裁决：接面板的提现接口。要加金额输入（按元解析，服务端再校验）；方式改成固定枚举 |
| 53 | 提现记录和撤回待审的申请 | `GET /me/withdrawals`、`POST /me/withdrawals/{id}/cancel` | ❌ | — | S–M |
| 54 | 邀请计划：比例、是否只返首单、冻结天数、最低提现额；待入账 / 已入账 / 已追回合计；返佣明细 | `GET /me/invite` | 🟡 | `pages/dash/referral.tsx`、`api` invite.stat/details | 主题的 `stat` 是 xboard 的五元组，要改成具名字段。明细显示 `invitee_label`，不显示对方邮箱 |
| 55 | 邀请码管理：列表（使用次数）、新建（有上限）、删除；注册关闭时只显示说明 | `GET/POST /me/invite-codes`、`DELETE /me/invite-codes/{code}` | 🟡 | `pages/dash/referral.tsx` invite.create | 缺删除、上限、`single_use`、`register_enabled` 判断。`pv`（访问量）面板没有 |
| 56 | 佣金追回（中-4：可能让余额变成负数，下次结算时抵扣） | 流水 `commission_clawback` | ❌ | — | 并入 #51，余额要能显示负数 |

### 1.6 工单、公告、帮助、仪表盘

| # | 面板功能 | 面板接口 | 主题状态 | 主题文件 | 说明 |
|---|---|---|---|---|---|
| 57 | 工单：列表（带未读标记）；新建时选分类（5 种）和优先级（4 种），可关联订单；详情、回复、关闭；每小时 5 张，最多 5 张未关闭，标题 120 字，正文 5000 字 | `GET/POST /me/tickets`、`GET /me/tickets/{id}`、`POST …/replies`、`POST …/close` | 🟡 | `pages/dash/tickets.tsx`、`lib/read-state.ts` | 主题的 `level` 只有 3 档，也没有分类。未读改用服务端的 `unread`，删掉 localStorage 里的已读记录。状态是 open/answered/closed。被封禁账户也能用 |
| 58 | 公告：中英两份、服务端渲染的 HTML、置顶、按受众和时间窗显示、服务端记录已读 | `GET /me/announcements` → `{announcements[],unread}`、`POST /me/announcements/{id}/read` | 🟡 | `pages/dash/announcements.tsx`、`components/announcement-dialog.tsx`、`lib/read-state.ts` | 面板不分页；没有 `img_url/tags`；已读改为服务端记录 |
| 59 | 知识库：分类、搜索、文章（中英两份、服务端 HTML） | `GET /me/help?q=`、`GET /me/help/{id}` | 🟡 | `pages/dash/guide.tsx`、`lib/doc-categories.ts` | 结构变为 `{categories[{name_zh,name_en,articles}],uncategorized}`。按界面语言选择 `title_zh/title_en`、`html_zh/html_en`，不再传 `language` 参数 |
| 60 | 仪表盘汇总（套餐、剩余天数、剩余流量、订阅、公告、续费横幅） | `/me`、`/me/plan`、`/me/announcements`、`/me/traffic` | 🟡 | `pages/dash/dashboard.tsx` | 依赖公开节点状态的负载卡片要删；7 日走势改用 `/me/traffic` |

### 1.7 主题有、面板没有的功能（按裁决删除，或需要面板支持）

| 主题功能 | 主题文件 | 处理 |
|---|---|---|
| 客户端"在浏览器中登录"交接页（`clientBridge`） | `pages/handoff.tsx`、`api` clientBridge | **删除**（已裁决） |
| 登录会话 / 设备列表，下线单个会话 | `pages/dash/settings.tsx` sessions 标签页、`api` sessions/sessionsDetailed/removeSession | **删除**（已裁决）。"全部下线"用 `/auth/logout` 代替 |
| 公开节点状态（负载、在线人数） | `api` guest.serverStatus、`lib/prefetch.ts`、`components/load-meter.tsx`，仪表盘和节点页的负载 | **删除**（已裁决） |
| 邮件登录链接 `token2Login`（`?verify=`） | `pages/auth.tsx` | 删除 |
| 邮箱验证码登录（`passkey.emailLogin`） | `pages/auth.tsx` PasskeyOnlyLogin | 删除（面板没有免密码的邮件登录） |
| 注册时直接创建通行密钥 | `pages/auth.tsx` Register、`api` passkey.registerOptions/Verify | 删除，改为"先注册，再按 `passkey_prompt` 绑定" |
| 用账号密码验证后迁移到通行密钥 | `api` passkey.migrateOptions/Verify | 删除，改用 #4 |
| 把佣金划转为余额（`user.transfer`）；佣金和余额两本账 | `pages/dash/referral.tsx`、`dashboard.tsx`、`settings.tsx` | 删除。面板只有一个余额：佣金入账就进余额，`withdrawable_cents` 是其中可以提现的部分 |
| 用户级邮件提醒开关（`remind_expire/remind_traffic`） | `pages/dash/settings.tsx` notify 标签页 | 删除。面板只有站点级的提醒开关。如果要按用户关闭，需要新增面板功能，由 lead 决定 |
| Telegram、`uuid`、`discount`、个人返佣比例、`last_login_at` | `api/types.ts` UserInfo、`settings.tsx` | 删除 |
| 未登录时看套餐价格（`guest.plans`） | `lib/cache.ts`、`lib/prefetch.ts` | 删除（商店需要登录） |
| 货币配置（currency/currency_symbol） | `lib/auth.ts` useCurrency、`lib/site.ts` | 固定为 CNY / ¥（面板所有金额都是人民币分） |
| 支付手续费 | `lib/format.ts` paymentFee、`api/types.ts` PaymentMethod | 删除 |
| 节点协议、版本筛选 | `pages/dash/nodes.tsx` | 删除 |
| Surge、Loon 一键导入 | `components/subscribe.tsx` | 删除（等 W30 定稿后再决定） |
| 公告配图和标签 | `api/types.ts` Notice | 删除 |
| 邀请链接访问量 `pv` | `pages/dash/referral.tsx` | 删除 |
| `SiteConfig` 的 hero、legal 邮箱、logoDark、background | `lib/site.ts` | 面板没有这些字段：用主题默认值或删除。不为此加面板字段 |
| 订单"类型"列（新购 / 续费 / 换套餐 / 重置） | `pages/dash/orders.tsx` | **需要面板小改动**：`orders.action` 列已存在（迁移 1058），只是 `MyOrderView` 没有返回。建议加一个只读字段，否则只能删掉这一列 |
| 主题内置的条款、隐私、帮助静态页 | `pages/terms.tsx`、`privacy.tsx`、`help.tsx`、`data/faqs.ts` | 面板只有 `branding.tos_url/privacy_url`。建议：配置了外链就跳外链，没配置就用主题内置页（不需要接口）。由 lead 决定是否保留 |

---

## 2. 缺失功能清单（规模和是否需要新设计）

规模：S 半天以内；M 一到两天；L 三天以上。"新设计"指主题里没有现成的布局可以套，需要新的页面或区块设计。

| 缺失功能 | 对应编号 | 规模 | 新设计 |
|---|---|---|---|
| 账户状态分流：续费范围、封禁视图、管理员提示（导航收窄、横幅、封禁说明页） | 2、18、19 | M | 是（封禁说明页、续费横幅） |
| 工作量证明注册（移植 pow.ts） | 7 | S | 否（只是提交时的等待状态） |
| Turnstile 组件（动态加载，三个表单按开关启用）+ 面板 CSP 放行 | 11 | M | 否（嵌入表单） |
| 蜜罐 + 表单令牌 + 最短提交时间（公共表单的统一封装） | 12 | S | 否 |
| 密码登录后引导绑定通行密钥（可选"以后只用通行密钥"） | 4 | M | 是（登录后的引导弹窗） |
| 真正的 WebAuthn 流程（create/get、base64url 编解码，登录和绑定共用） | 3、24 | M | 否 |
| 账户的"仅通行密钥"开关 | 25 | S | 否（安全标签页加一个开关） |
| 绑定或更换邮箱（密码 + 验证码两步） | 20 | M | 是（设置页新区块） |
| 邮箱验证引导（未验证横幅，购买后提示） | 21 | S | 是（小横幅） |
| 邮件语言同步 | 23 | S | 否 |
| 注册赠送试用的提示 | 10 | S | 否 |
| 订阅格式选择 | 28 | S | 是（小选择器） |
| 商店：折算和作废金额、拒绝原因、余额抵扣、作废时二次确认 | 37、38、41 | L（和 #35 的商店重写一起做） | 是（报价明细、拒绝原因的表现） |
| 退款和自动退回余额的显示 | 47、49 | S | 否（订单状态和说明文字） |
| 钱包：余额流水（含佣金追回、负余额） | 51、56 | M | **是（新页面或新标签页）** |
| 提现记录和撤回 | 53 | S–M | 是（并入钱包页） |
| 自助注销（等 ③） | 26 | M | 是（影响摘要 + 二次确认，参照后台的 delete-impact） |

合计：L 1 项、M 7 项、S–M 1 项、S 8 项（按上表 17 行计；#47/#49 合并、#51/#56 合并）。

---

## 3. 主题需要按面板规则改造的地方

### 3.1 数据模型

- **身份与会话**：删掉 `AuthData`（`token/auth_data/is_admin`）和"令牌放在本地存储"的假设。会话是 httpOnly、SameSite=Strict 的 cookie；登录状态以 `GET /me` 是否返回 401 为准。`lib/cache.ts` 用 sessionStorage 缓存账户数据：可以保留，但 `/me` 带着订阅凭据，**`sub_token/sub_url` 不能写进 sessionStorage**（面板对这个响应加了 `no-store`）。
- **id 是 UUID 字符串**（用户、订单、工单、公告、文章、通行密钥、提现），不是数字。订单页用 `id`（面板路由 `/me/orders/{id}`），`out_trade_no` 只用来显示。
- **时间是 RFC 3339 字符串**，不是 Unix 秒。`api/types.ts` 的头注释和 `lib/format.ts` 都要改。
- **流量**：面板全部是字节（套餐额度 `traffic_quota_bytes` 也是），主题套餐侧的 GB 换算要删。账户已用流量是计费后的值（`traffic_used_bytes`），上下行拆分只在 `/me/traffic` 里有。
- **金额**：两边都用分，这一点一致。但面板是单一余额：`balance_cents` 中包含 `withdrawable_cents`。用户唯一需要手输的金额是提现金额，按元解析（参照面板 `parseYuan`），服务端会再校验。显示时用两位小数和 ¥。
- **枚举**：订单状态 pending/paid/expired/cancelled；工单状态 open/answered/closed，分类 5 种，优先级 low/normal/high/urgent；提现方式 alipay/wechat/bank/other；流水类型 7 种；重置周期 `monthly / days-N / none`。主题里所有 xboard 的数字枚举都要换掉。
- **周期价格**：`Plan.prices`（对象）改成 `offers[]`（数组，带 `days`）。
- **按入口而不是按服务器**：`/me/nodes` 每行是"节点 + 入口"，没有 id、地址或机器指标。

### 3.2 错误码与多语言

- 面板错误体是 `{error, code, params}`。主题要**按 `code` 映射**中英文案，不能显示 `error` 原文，也不能按英文消息匹配（主题现在到处是 `toast.error(e.message)`，要统一经过一个 `errorText(err)`）。门户会遇到的码大约 85 个：`account.*` 12、`auth.*` 6、`signup.*` 8、`invite.*` 3、`coupon.*` 9、`shop.*` 7、`order.*` 6、`balance.*` 2、`withdrawal.*` 6、`ticket.*` 11、`request.*` 13、`kb.query_long`。完整列表见面板 `src/error_codes.txt`。
- 面板现在的 `spa/scripts/check-error-codes.mjs` 要求 SPA 对**每一个**码都有映射。W36-b 删掉旧门户后，这个检查要拆开：后台检查全部码，主题检查"用户可见码"清单（建议在主题 CI 里加一个同类脚本，清单从面板生成）。
- 404 是统一的拒绝响应，没有内容，前端不能从中区分原因（README 已写明）。被封禁账户访问其他接口时返回 403 `account.banned`，要统一跳到封禁视图。
- 中英双语：主题的 `tr('中文原文')` 加英文词典这套机制可以保留。服务端内容（公告、文章、知识库分类）按语言取 `*_zh/*_en`，英文为空时回退中文（参照面板的 `pick()`）。

### 3.3 路由与地址（等 ③）

- 主题现在是 `HashRouter` 挂在 `/{prefix}/app` 下。面板邮件里写死的是**路径式**链接：`/app/shop`（到期提醒）、`/app/reset#token=…`（重置密码）、`/app/register?invite=`（邀请）。在 HashRouter 下，`#token=` 会被当成路由。D11 之后门户在根路径，建议 W36-b **改用 BrowserRouter**，由面板对门户路由返回 index.html；同时和 ③ 约定一份路由表（`/shop`、`/reset`、`/register?invite=`、`/orders/:id` 等），面板的邮件链接、`link_base` 和主题路由使用同一份。主题现在的路由名（`/app/plans`、`/app/referral`、`/app/guide`、`/app/settings`）要么改名，要么加别名。
- API 和认证的基础路径（现在是 `/{prefix}/api/v1`、`/{prefix}/auth`）以 ③ 的定稿为准，只在 `src/api` 里配置一次。
- 订阅链接只用 `me.sub_url`（③ 之后是随机路径，D8 之后可能是按用户随机的订阅域名）。删除前端拼地址的兜底代码。
- W36-a 时为了旧前缀做了相对路径适配（关闭 modulePreload、禁止 CSS 拆分、`renderBuiltUrl`）。根路径部署后可以恢复，`check-dist` 也可以简化（SPRINT 已记录）。

### 3.4 CSP

- 面板 CSP 是 `default-src 'self'; style-src 'self' 'unsafe-inline'`，另外有 `X-Frame-Options: DENY` 和 `Referrer-Policy: no-referrer`。
- `components/subscribe.tsx` 的二维码中心 LOGO 用的是 `data:image/svg+xml`（`MARK` → qrcode.react 的 `imageSettings`）。`img-src` 只允许 `'self'`，**这张图会被拦截**；`check-dist` 只检查产物文件，查不到运行时拼出来的字符串。要改成带哈希的静态资源，或者去掉中心 LOGO。
- Turnstile：要在面板 CSP 里加 `script-src https://challenges.cloudflare.com` 和 `frame-src https://challenges.cloudflare.com`（最好只在开启时、只对门户页面加）。主题只在 `guard.turnstile` 非空时才动态插入脚本。这是 W36-b 里唯一需要改面板安全头的地方，要在 PR 里写明理由。
- LOGO 和 favicon 来自 `/brand/{name}`，属于同源，没有问题。客户端下载链接是外链，`<a target=_blank rel=noopener>` 不受 CSP 限制。

### 3.5 时区

- 面板的日界、月重置和自然月周期都按全站时区（`panel_settings.timezone`，默认 Asia/Shanghai，Q3）。现在只有 `/me/traffic.timezone` 返回时区名，`/me/plan.next_reset_at` 带时区偏移；`/me` 和 `/auth/options` **都不返回时区**。
- 建议：面板在 `/auth/options`（或 `/me`）里加 `timezone`（S，需要 lead 批准，理由是 SPRINT 2026-10-06 的跟进项"SPA 默认日期范围改用接口返回的 timezone"）。在此之前，主题所有日期显示和"本月 / 近 N 天"范围都按 `/me/traffic.timezone` 计算，不用浏览器本地时区。主题 `lib/format.ts` 的 `formatDate/daysLeft` 要接受时区参数。

### 3.6 其他

- **构建与托管（要先定）**：主题仓库是**私有**的，面板仓库是公开的。面板 CI 和发版需要拿到门户产物，有几种做法：主题转公开、用部署密钥、或者把产物或源码引入面板仓库。这需要用户或 lead 决定，否则 W36-b 的面板 PR 无法在 CI 上构建。
- 不再显示设备数（低-9）。
- 商店的默认选中规则（流量用完时默认选重置包，到期时默认选续费）要保留（中-1）。
- 门户产物里不能出现后台代码，也不能出现后台地址（D4、check-bundles）。
- 余额可能是负数（佣金追回），显示时不能截成 0。

---

## 4. 依赖尚未合并的面板功能

队列：②节点与订阅 → ③入口与账号 → W33-b → **W36-b**。② 和 ③ 都会在 W36-b 之前合并，所以主题侧的大部分工作可以先在主题仓库里做（主题仓库和面板、agent 没有文件交集），面板侧的替换必须等 ③。

| W36-b 内容 | 依赖 | 原因 |
|---|---|---|
| 节点页的当前倍率、时段规则（D9） | ② W28-b | `/me/nodes` 的字段会变 |
| 超额服务器的节点在门户里隐藏或提示（D5） | ② | 隐藏的规则和提示字段由 ② 决定 |
| 一键导入的客户端列表、scheme、格式，分流规则模板（W30） | ② W30 | `sub-links` 以 W30 定稿为准 |
| 门户挂在根路径、路由表、API 基础路径、邮件链接格式（D11） | ③ W27-4 | 决定 Router、`link_base`、重置链接、面板对 index 的回退 |
| 随机订阅路径（D11）、多域名和按用户订阅域名（D8） | ③ | 只能用 `sub_url`；通行密钥的 RP 是主域名，门户只在主域名提供 |
| 自助注销 | ③ W27 | 接口和影响摘要都还没有 |
| 管理员不再从门户跳到后台（D4） | ③ | 现有门户会跳 `/admin` |
| 订单的 `action` 字段、`timezone` 字段 | 新的面板小改动（需要 lead 批准） | 可以放进 W36-b 的面板 PR |
| 低-8：余额全额抵扣的订单不依赖支付方式 | 未排期（批次 B 或 D） | 会改变 `shop.enabled` 的含义；W36-b 先按现状实现 |
| 低-3：作废折算转为余额的开关 | 未排期 | 门户先做二次确认，开关以后再接 |
| 中-9 新增的通知邮件 | 批次 D（面板） | 门户不需要界面，只影响文案（例如"已发邮件通知"） |

**现在就可以在主题仓库开工的**（不依赖 ②/③）：§1.1 除路由外的全部内容、账户状态分流、通行密钥、邮箱绑定、商店和订单、钱包和提现、邀请、工单、公告、知识库、流量明细、错误码映射、CSP 二维码修复。

---

## 5. 建议的 W36-b 拆分（2 个 PR）

**PR 1：主题仓库 `mwnydev/Akari-theme`，接口层与功能补齐**（可以在 ②/③ 合并前开工，③ 合并后 rebase 收尾）
- 用真实请求替换 `src/api/index.ts`：同源 fetch、cookie 会话、`{error,code,params}` 封装成 `ApiError`、字段映射。`types.ts` 按 §3.1 改成面板的结构，页面只改必要的地方。
- 认证：guard（表单令牌、蜜罐、最短提交时间）、Turnstile、PoW、链接式找回密码、WebAuthn 登录和绑定、`passkey_prompt` 引导、仅通行密钥开关。删除 handoff、token2Login、邮箱验证码登录、迁移流程、注册时创建通行密钥。
- 账户：续费范围和封禁分流、邮箱绑定、验证引导、邮件语言同步。删除会话列表和通知偏好。
- 商店和订单按 `/me/shop` 重写（报价、折算、作废、拒绝原因、优惠券、余额、支付方式、一步下单），显示退款和自动退回余额。
- 钱包：流水、提现记录和撤回；邀请改为单一余额模型，补邀请码删除。
- 节点、流量、工单、公告、知识库改用新结构，删除公开节点状态和负载。
- 错误码映射表和 CI 检查脚本，时区处理，二维码中心 LOGO 修复，隐藏设备数。
- ③ 合并后：BrowserRouter 和路由表、`sub_url`、自助注销、恢复 modulePreload、简化 check-dist。
- 验收：typecheck、lint、build、体积预算、check-dist。用一个本地面板手工走通全部流程（按 CLAUDE.md，重型检查只在 CI 上跑）。

**PR 2：面板仓库 `akari-panel`，门户替换**（在 PR 1 合并、③ 合并之后）
- 门户产物的引入方式按 §3.6 的决定执行（固定到主题的某个提交）。门户在根路径提供，面板对门户路由返回 index。
- **删除旧门户代码**：`spa/src/app.tsx`、`portal-views.tsx`、`main.tsx`、`mount.tsx`，门户页面（dashboard、subscription、purchase、orders、wallet、tickets、help、announcements、portal*、login、register、reset），以及只有门户用的 lib 和 i18n 命名空间。后台用到的部分（如 `lib/billing.ts` 的后台类型）保留。
- CSP 只对门户页面放行 Turnstile。`check-error-codes` 拆成后台和门户两部分。check-bundles 确认门户产物里没有后台代码。
- 小接口：`MyOrderView.action`，`/auth/options.timezone`（如果 lead 批准）。
- e2e：在桌面和手机两种视口下，用真实浏览器跑通注册（PoW 和验证码两种模式）、登录（密码和通行密钥两种）、购买和付款状态、订阅、工单、提现、封禁和续费范围。smoke 增加门户页面和新字段的断言。加 `full-ci` 标签（涉及认证和资金）。
- 文档：README 的 API 表、DEPLOY（门户根路径、CSP 说明）、CLAUDE.md。
