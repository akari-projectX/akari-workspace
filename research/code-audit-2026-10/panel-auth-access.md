# 代码体检 批次 2：akari-panel 认证、会话与前门（只读审计）

日期 2026-10-26 · 基线 akari-panel main `55fd330` · 范围 `src/access.rs`、`src/web.rs`（front / prefix_gate / security_headers / redacted_path / CSP）、`src/reject.rs`、`src/auth.rs`、`src/api.rs`（login / logout / finish_login / revoke_sessions / 管理员用户 mutator 的 `owner::guard_target`）、`src/owner.rs`、`src/passkey.rs`、`src/signup/**`、`src/botguard.rs`、`src/client_ip.rs`、`src/login_limit.rs`、`src/rate.rs`、`src/console.rs`、`src/spa.rs`、`src/sub/mod.rs`（token 哈希/AEAD、拒绝路径、格式开关、仅自研客户端）、`src/masterkey.rs`、`src/request_id.rs`、`src/settings.rs`（Host 闸门、域名角色、写入者的授权）、`src/outbound.rs`、`src/nodeinstall.rs`（token 路径）、`src/enroll.rs`、`src/account.rs`、`src/mailhook.rs`，以及 0009 `users_bump_session_ver` 触发器与 1013/1105 的约束。

状态：**主路径已完成**，无代码改动。未做真库/真进程复现（磁盘 17 GB 与 120 k 行 crate 的调试构建不划算）；P1/P2 结论都是"静态证据 + 推理"，每条给出可直接照做的复现步骤，标"待确认"的是依赖外部行为的点。`src/sub/{clash,singbox,links,proxy,routing,dns,groups}.rs` 的渲染、`mail/` 发信内部、`alerts/` 评估、`tickets.rs` 业务、`billing/` 的认证面只做了入口级检查，未逐行读（见"方法与未覆盖"）。

## 摘要

| 严重度 | 数量 |
|---|---|
| P0 | 0 |
| P1 | 1 |
| P2 | 4 |
| P3 | 27 |

前门核心（`access::route` 的纯分发、`front` 的 Host 角色与白名单、`prefix_gate`、字节同构拒绝、`redacted_path`、指标标签、`AuthUser` 系列提取器、会话吊销触发器、enrollment token 烧毁、订阅拒绝路径、SSRF 的地址判定）都核对通过，没有发现前缀泄漏或拒绝不同构（见末尾"已核对正确"）。问题集中在**授权边界**（所有者模型被"任何管理员都能改的设置"绕过）、**通行密钥的敏感操作无二次验证**、**SSRF 防护只覆盖了一处出站**，以及**无认证端点对 argon2 队列和 16 连接池的放大**。

## P1

### P1-1 所有者（R47）边界可被任何管理员经"设置写入者"绕过：改邮件 / 域名 / 注册设置 → 重置所有者密码
- 位置：`src/mail/mod.rs:578 put_mail_settings`、`src/signup/mod.rs:431 put_signup_settings`、`src/settings.rs:3376 put_settings`（主/订阅/节点域名、`trust_cloudflare`）、`:1700 put_passkey_domain`、`:2455 put_security`、`src/botguard.rs:682 put_settings`、`src/alerts/mod.rs:605`、`src/updatecheck.rs:1050`——全部只有 `user.require_admin()`。静态证明：`grep -rn "owner::" src` 的非测试命中只在 `access.rs`（前缀/白名单）、`api.rs`（用户 mutator）、`auth.rs`、`billing/methods.rs`（支付密钥）、`nodeops.rs`、`passkey.rs`、`signup/profile.rs`、`web.rs`；设置类写入者一个也没有。
- 类别：安全 / 授权（权限提升）
- 推理（完整攻击链，只需一个**非所有者**管理员会话）：
  1. `PUT /settings/mail` 把 SMTP（或 Resend 的 API 基址不可改，则用 SMTP）指向攻击者自己的服务器（`apply_update_mail` 无所有者检查）；
  2. `PUT /settings/signup` 打开 `reset_enabled`（需 SMTP 已启用 + 主域名，二者此时都满足）；
  3. 公开表单 `POST /auth/password-reset/request {email: <所有者邮箱>}`：`reset.rs:120 MAY_RESET` 只要求"已验证 + 启用"，**不排除管理员角色**；`admin add` 建的所有者邮箱恒为已验证；重置链接经攻击者的 SMTP 送达；
  4. `POST /auth/password-reset {token, password}` 换掉所有者密码（0009 触发器踢掉其会话），攻击者在后台前缀（管理员自己知道）登录。`guard_target` 在这条路径上从未被调用，因为重置不是"管理员 mutator"。
  - 变体（不需要邮件）：把**主域名**改成攻击者域名 → `Effective::public_origin()` 变成重置链接/验证邮件的域名，链接 `https://evil/reset#token=…` 的 fragment 由攻击者页面脚本读取；把**订阅域名**改成攻击者域名 → 用户导入的订阅链接（含 token，等于节点凭据）发给攻击者；`put_security` 的 `cloudflare_ranges` 接受任意 CIDR（`0.0.0.0/0` 通过，`settings.rs:2373-2395`），配合 `trust_cloudflare` 后任何客户端都能用 `CF-Connecting-IP` 伪造来源地址，**绕过所有者专属的管理员 IP 白名单**和全部按地址限速；`botguard::put_settings` 可关掉 Turnstile/蜜罐/`passkey_only_admins`，`put_passkey_domain` 换中心域名 = 让全体通行密钥失效（降级回密码）。
  - 影响：CLAUDE.md 与 `owner.rs` 头注释宣称"只有所有者能改其他管理员账户、前缀与白名单、支付密钥"，上述路径使"非所有者管理员 → 接管所有者"成立，R47 的隔离名存实亡。前提是一个被攻破/恶意的次级管理员；若运营者只有一个管理员则无影响。
- 复现（待在测试库执行）：建所有者 O 与普通管理员 A；以 A 登录；对一个本地 SMTP 接收器（`python3 -m aiosmtpd` 或自写 25 端口）依次 PUT mail、PUT signup（`reset_enabled=true`）；公开请求重置 O；从接收器取链接并重置；用新密码登录 O。
- 建议修法：把"改变信任根或信任通道"的设置统一变为所有者专属：邮件/发信方式、注册与找回开关、主/订阅/节点/通行密钥中心域名、`trust_cloudflare` 与 Cloudflare 网段、安全页（审计保留/额外公钥）、人机验证与通行密钥策略、告警通道 URL、更新源；用一个 `owner::require` 包装 + 表驱动测试（枚举所有 `PUT /settings/*`，非所有者管理员得 403 `user.owner_only`）。同时让 `MAY_RESET` 排除 `role = 'admin'`（管理员只能经 CLI/所有者重置）或要求所有者显式开启。

## P2

### P2-1 通行密钥的新增 / 删除 / 关闭密码登录只需会话，无二次验证（持久后门）
- 位置：`src/passkey.rs:763 register_options`、`:869 register`、`:1028 delete`、`:1070 set_password_login`（提取器都是 `ShopUser`；对比 `confirm_holder` 只用于"改邮箱 / 删账号"）。
- 类别：安全 / 会话
- 推理：会话被盗（恶意扩展、共享电脑、被盗 cookie）后，攻击者可 `POST /me/passkeys/options` → 用自己的认证器 `POST /me/passkeys {disable_password:true}`。之后：受害者改密码、"踢下线"都无法收回访问（攻击者用通行密钥重新登录，`login` 路径不受 `session_ver` 影响），且密码登录被关（右密码也 403 `auth.passkey_required`）。同类的"账户邮箱 / 密码"变更都已要求当前密码或通行密钥，唯独这条凭据面没有。管理员账户同样适用。`account::change_own_password` 对已有密码的账户要求当前密码，反衬出缺口。
- 建议修法：新增 / 删除通行密钥与切换 `password-login` 前走 `passkey::confirm_holder`（密码或已有通行密钥），首次添加（账户尚无任何通行密钥且只有会话）至少要求当前密码；这些操作成功后 bump `session_ver`（或至少让其他会话失效）。补测试：无确认 → 400 `account.password_required`。

### P2-2 SSRF 防护只覆盖规则集下载；其余管理员可配置的出站地址都没有地址检查（任何管理员可用）
- 位置：`src/outbound.rs`（有完整的公网地址判定，仅被 `sub/rulesets/fetch.rs` 使用）；未设防的出站：`src/alerts/channels.rs:274,321`（webhook URL、`telegram_api_url`，校验仅 `alerts/mod.rs:301` 的"https 或回环 http"）、`src/updatecheck.rs:225-260`（自带第三个 HTTP 客户端，更新源地址）、`src/mail/diagnose.rs:543-600`（SMTP 诊断：DNS/TCP/TLS/问候）、`src/billing/epay.rs`/`alipay.rs` 网关地址（这两个是所有者写，较轻）。
- 类别：安全（SSRF，经授权者）
- 推理：这些地址的写入者是任意管理员（见 P1-1，无所有者检查）。webhook 对 `https://<内网主机>:<端口>` 或 `http://127.0.0.1:<端口>` 发 POST；失败时 **响应体前 200 字节写进 `alert_notifications.last_error`**（`channels.rs:329-333`），管理员可读 → 对内网 HTTP(S) 服务是"半盲" SSRF（可读非 2xx 响应首 200 字节，可探测端口）；更新源是 GET + 要求 JSON；邮件诊断是 TCP 端口探测 + SMTP 问候横幅回显。云元数据（169.254.169.254、`fd00:ec2::254`）被 https-only 挡住，但内网 TLS 服务、回环服务（panel 自己的 metrics 监听、Caddy admin 若未关）可达。
- 建议修法：出站统一走 `outbound::send`（webhook / Telegram / 更新源 / 邮件诊断的 DNS 与连接前都过 `public_address`，回环例外仅留给测试开关），删除 `billing::http` 与 `updatecheck` 里各自的 `send`/`target`（见 P3-22）；这些地址的写入限所有者。补测试：webhook 指向 `127.0.0.1`/`10.0.0.1`/DNS 解析到私网的名字 → 422。

### P2-3 argon2 队列无上限 + 16 连接共享池：无认证端点可放大成全站不可用（含 agent 会话）
- 位置：`src/auth.rs:289-310`（`argon2_gate` 信号量 `acquire_owned().await` 无界排队，登录 / 注册 / 重置 / 改密共用）；`src/main.rs:261`（`max_connections(16)`，web、gRPC 会话、flush、LISTEN 共用）；无认证端点逐请求访问数据库：`signup/mod.rs:450 options`（约 5 次查询，无限速）、`spa.rs:index`（每个门户页面 1 次 `botguard::load`）、`login`（`check_form` 每次 acquire + 查设置）。
- 类别：性能 / 可用性 / DoS
- 推理：
  1. 登录对不存在的账户也跑一次 argon2（设计如此，为了防存在性 oracle），限速是"每 /64 失败 20 次 / 每名 50 次"；换不同地址和不同名字的攻击者不受限，每个请求在队列里占一个排队任务（内存 + 请求不超时），正常登录和**所有**经 `verify_password_async` 的功能被拖到超时；
  2. 注册（验证码模式）`register.rs:557+` 与重置 `reset.rs:247+` 在**校验验证码 / token 之前**就先 `hash_password_async`（只被每 /64 30 次 / 15 分钟的 `limit_complete` 限制），同样吃满队列；
  3. `account.rs:114 change_password_inner` 在持有事务（连接 + `FOR UPDATE` 行锁）期间做两次 argon2（排队时间也算），登录洪峰时迅速占满 16 连接，连带阻塞 agent 会话与 flush；
  4. `/auth/options` 与门户页面是无限速、每次读库的公开端点（设计决定"每请求读库无缓存"，换来了多实例即时一致，代价是未认证放大）。
- 建议修法：argon2 加有界等待（`try_acquire` + 短超时 → 503/429，或队列长度上限），把"校验在前、哈希在后"（先查验证码 / token 再哈希）；`change_password_inner` 把哈希移出事务；公开设置读取用实例内 1–2 s 缓存 + 现有 `pg_notify` 失效；考虑把池大小做成可配置。待确认：实际打满所需并发（用 `akari-bench http` 对 `/auth/options` 与 `/auth/login` 压测）。

### P2-4 任何管理员可把审计保留期设为 1 天（证据销毁）
- 位置：`src/settings.rs:2355 security_values`（`audit_retention_days` 只校验 `<= 36500`，正数下限为 1）→ `reaper.rs:121 audit::prune`。
- 类别：安全 / 审计完整性
- 推理：`PUT /settings/security {audit_retention_days: 1}`（`require_admin` 即可，见 P1-1）后，reaper 按设置删除一天以前的 `audit_log`，包括这次修改本身，管理员的任何越权操作一天后无迹可查。对比 `traffic_daily_retention_days` 有 32 天下限，审计却没有。
- 建议修法：审计保留设下限（如 ≥ 90 天或 ≥ 默认值），改小须所有者；删除审计行时写一条不可删的"保留期变更"摘要。

## P3

1. **所有者专属功能的"目标检查"有 TOCTOU 且遗漏一处**：`owner::guard_target`（`owner.rs:70`）读 `role` 不加锁；`api.rs:1912 regenerate_sub_token`（`POST /users/{id}/sub-token`）既不调用 `guard_target` 也不检查 `role='user'`/未注销，`sub::apply_reset` 会给别的管理员或已匿名化账户写 `sub_token_hash/enc` 并轮换凭据（对管理员无服务影响，但违反"针对用户账户的管理员 mutator 必须调用 guard_target"）；`user_subscription`（`:549`）对已注销账户也会 `ensure_token` 签发。修法：补 `guard_target` + `refuse_erased`。
2. **`PATCH /users/{自己}` 可不带当前密码改自己的密码**（`api.rs:1599/1230`，`require_admin` 即可）：被盗的管理员会话可立即设新密码取得持久访问；对比 `/me/password` 要求当前密码。修法：自己的账户走 `/me/password`，PATCH 拒绝 `id == actor`。
3. **管理员 `login-method/reset` 与通行密钥删除不 bump `session_ver`**（`passkey.rs:1136 apply_reset_login`、`:1028 delete`）：该操作的典型场景是"凭据泄露 / 丢失"，已有会话仍存活。0009 触发器只监听 `password_hash/role/enabled/expiry_enforced`，`email` 变更、通行密钥增删、`password_login_disabled_at` 都不触发。修法：这些路径显式 bump。
4. **删除最后一个通行密钥会让"无密码"账户无法登录**：通行密钥注册的账户 `password_hash IS NULL`，`delete`（`passkey.rs:1028`）不检查账户是否还有别的登录方式；邮箱未验证（`email_verify` 关闭时）则连邮件重置也没有，只能管理员 `login-method/reset` 也无密码可恢复。修法：删除最后一个且无密码时 409。
5. **管理员账户可经邮件链接重置密码**（`reset.rs:120 MAY_RESET` 不含角色条件）：邮箱即管理员凭据；结合 P1-1 是链条的一环。修法见 P1-1。
6. **后台前缀被写进给管理员的邮件**（`mailhook.rs:30-37 Links::of`：`<主域名>/<前缀>/admin`，新工单 / 告警邮件）：前缀是"全站唯一的秘密"，邮件经第三方 SMTP/Resend、收件人邮箱和 `mail_outbox`（死信保留正文）扩散。修法：邮件里只放门户链接，或让用户自己输入前缀。
7. **缺少 HSTS 与更完整的 CSP 指令**：`web.rs` 的 `security_headers` 与 `deploy/` 的 Caddyfile 都没有 `Strict-Transport-Security`（全仓 grep 无命中）；`CSP = default-src 'self'; style-src 'self' 'unsafe-inline'` 不含 `base-uri 'none'`、`form-action 'self'`、`frame-ancestors 'none'`（`X-Frame-Options: DENY` 已盖住 framing）。修法：在 Caddyfile / `security_headers`（仅 https 响应）补齐。
8. **登出会结束该账户全部设备的会话**（`api.rs:327 logout` 直接 bump `session_ver`）：手机登出把桌面也踢掉；是文档决定（"复制的 cookie 随登出失效"），记为 UX 代价，建议改为"登出只清当前 cookie，另提供全部登出"。
9. **按名字的登录限速可被用来锁定已知邮箱**（`login_limit.rs`：`PER_LOGIN=50`/15 分钟，名字桶跨地址共享）：任何人用 50 次失败可让所有者 / 任意用户 15 分钟无法用密码登录（通行密钥不受影响）。属权衡；可在 `reserve` 里让"已通过登录的地址"绕过名字桶，或对管理员账户提示通行密钥。
10. **蜜罐表单 token 可重放**（文档已声明，`botguard.rs:trap_reason`）、**PoW 不绑定地址 / 邮箱且只有 18 位**（`signup/pow.rs`，单核约 0.1 s，GPU 瞬间），实际防线是每 /64 5 次/小时；**Turnstile 校验失败不占登录限速名额**（`login`：`Err(e) => attempt.release`），公开端点可无限触发对 Cloudflare 的出站校验（每次一个 5 s 超时的 HTTPS 调用 + 一次 `pg.acquire`），建议给 Turnstile 失败单独计数限速。
11. **密码长度检查重复 5 处且口径不一**：`signup::check_password`（8–256 字节）、`account.rs:42`、`api.rs:1007`、`api.rs:1250`、`nodeops.rs:118` 只检查下限；消息写"characters"实际按字节。修法：统一到 `check_password`。
12. **`change_password_inner` 持有事务和行锁做 argon2**（见 P2-3），属违反本仓"先哈希后取锁"约定（`apply_update_user` 的注释）。
13. **`PendingUser` 不检查 `banned`/`restricted`**（`auth.rs`）：被封禁且尚未绑定邮箱的通行密钥注册账户仍可绑定地址；无实际利益，但与"封禁只能到 PortalUser 范围"的描述不一致。
14. **未验证注册模式下邮箱被抢注**（`email_verify` 默认关）：任何人可用别人的邮箱注册未验证账户，真正的主人之后无法注册（`signup.unavailable`）也无法找回（未验证邮箱不收重置邮件）；文档已列为残留风险。建议默认开启验证，或允许"已验证持有者"通过验证码回收未验证占位。
15. **邮箱规范化**（`signup/email.rs`）：`+tag` 别名与 `*@pending.invalid`（占位域名）都被接受，`+tag` 使"每地址 5 次/小时"无法限制同邮箱多账户（试用套餐刷取）；`pending.invalid` 真实账户不会触发 CHECK（CHECK 单向）。修法：试用 / 邀请滥用另设按规范化主地址（去 `+tag`）的约束，并在 `parse` 里拒绝 `.invalid`。
16. **验证码重发会重置错误计数**（`signup/mod.rs issue_code ON CONFLICT … attempts = 0`）：每地址每小时 5 次发信 × 每码 5 次猜测 = 25 次/小时的猜测额度；6 位码空间下风险很低，仅记录。
17. **按目标地址的发信额度可被他人耗尽**（`limit_send` 三个窗口都计数）：攻击者每小时 5 个请求即可让受害者收不到重置 / 验证邮件，且响应对所有人一致（无 oracle）。属权衡。
18. **订阅响应没有 `Cache-Control: no-store`**（`sub/mod.rs:subscription`，响应含节点凭据）；若前面有"缓存一切"的 CDN 规则会被缓存。控制台资源声明了 `ETag` 却不处理 `If-None-Match`（`console.rs file_response`，永远 200），且每次请求 `a.data = f.data.to_vec()` 复制整个文件、`spa::index` 每次 `into_owned` 复制 index。
19. **`ensure_state` 在读 `state.json` 任何错误时重写**（`install.rs:ensure_state`，含权限 / 瞬时 IO 错误）、`ensure_jwt_key` 对短文件静默重新生成、`rotate_jwt_key` 在事务提交前写盘（提交失败时磁盘已是新钥而 `session_ver` 没 bump，旧会话因签名失效而同样作废，所以无害但顺序可以反过来）。
20. **会话 cookie 名 `sid`，无 `__Host-` 前缀**；Strict + HttpOnly + Secure(默认) 已就位。无 `Origin`/`Sec-Fetch-Site` 校验，无请求体的 POST（`/auth/logout`、`/me/sub-token`）与 `DELETE` 依赖 SameSite=Strict；同一注册域的兄弟子域（订阅域名常与面板同注册域）属于 same-site。可加一层 `Sec-Fetch-Site: cross-site|same-site` 拒绝（纵深防御）。
21. **IP 判定的小缺口**（`outbound.rs:82 public_v6`）：IPv4-translated `::ffff:0:0:0/96` 与 Azure WireServer `168.63.129.16`（公网地址空间）未列入；两者都需要内网路由才有意义，且出站强制 https，故仅作加固项。
22. **出站 HTTP 客户端重复实现 3–4 套**：`outbound.rs`、`billing/http.rs`、`updatecheck.rs`（自带 `target`/`send`/`request`）、`sysstatus`/`mail/diagnose` 各自的 TLS 连接；P2-2 的根因。合并后 SSRF 策略只需维护一处。
23. **"客户端地址 → 限速桶"样板代码重复 6+ 处**（`user.ip.map(bucket).unwrap_or("unknown")` 在 `account.rs`/`passkey.rs`/`profile.rs`），`ip == None` 时所有人共用 `"unknown"` 桶；应抽成 `AuthUser::bucket()`。
24. **无请求级超时 / 并发上限层**（`web.rs` 无 `TimeoutLayer`/`ConcurrencyLimitLayer`，`main.rs` 直接 `axum::serve`）：慢速请求头 / 慢速请求体的防护完全交给前置反代。待确认：axum 0.8 + hyper 的默认头读取超时是否生效（需要 Timer）；文档应写明必须有反代。
25. **gRPC `Enroll` 按 TCP 对端地址限速**（`enroll.rs:345`，`request.remote_addr()`）：gRPC 端口前面如果有 L4 代理（HAProxy 未开 PROXY 协议），所有 agent 共用一个桶；部署文档需说明。
26. **主密钥无版本 / 轮换机制**（`masterkey.rs`，只有 `SEAL_VERSION=1`，无 key id）：master.key 泄露或更换只能"全部重新输入秘密"；随机 96 位 nonce 的 AES-GCM 在此体量下安全，记录即可。
27. **测试缺口**：没有"所有路由的认证覆盖表测试"（我用脚本静态核对了 263 条路由，见下，但应进 CI）；没有"设置写入者须所有者"的测试（P1-1）；没有"通行密钥新增须二次验证"测试（P2-1）；没有 argon2 队列上限 / 连接池耗尽测试；`guard_target` 没有"目标在检查后被升为管理员"的并发测试。

## CodeQL 既有提示（本批范围内）

- `src/auth.rs` insecure-cookie（`session_cookie`/`cleared_cookie` 的 `.secure(state.cfg().web.cookie_secure)`）：**不适用（误报）**。`cookie_secure` 默认 `true`（`config.rs:111`），仅为仅 IP / 纯 HTTP 安装可关；`config_check.rs:177` 在非回环绑定且未配可信代理时警告。建议：保留，但把"关闭"限定在回环 / 显式 `allow_insecure_cookie` 并在 `/system/status` 标红。
- `src/signup/pow.rs`、`src/account.rs`、`src/api.rs` hard-coded crypto：**不适用**。`pow.rs` 是工作量证明（SHA-256 作难题函数，无密钥）；`account.rs`/`api.rs` 里没有硬编码密钥或盐，口令一律 argon2id（`Argon2::default()` = v19, m=19 MiB, t=2），订阅 / 注册 / 重置 token 是 256 位随机数的 SHA-256 摘要（高熵秘密不需要慢哈希）。`plans.rs` 不在本批范围。
- `bench` 明文传输：不在本批范围。

## 已核对正确（覆盖）

- **前门分发** `access::route`：管理员前缀常数时间比较（长度不同时提前返回，泄露的只是"前缀长度"，随机前缀长度本就公开）；裸前缀、前缀下的公共路径（`sub`/`sub-rules`/`install`/`pay`）、`//`、百分号编码的段名（路由按未解码字节匹配，不会等价）、`_` 内部前缀、`..` 都落到 `Route::Reject`；订阅路径只匹配 `/{sub_path}/{token}` 与 `/{sub_path}/rules/{file}`；`RESERVED` 覆盖全部 `PORTAL_PAGES`；轮换 / 自选前缀与 `sub_path` 互斥检查在 `apply_rotate_prefix`。
- **Host 角色与闸门** `front`/`host_role`/`request_host`：端口、末尾点、大小写、IPv6 括号、`user@host` 形式、缺 Host 头（闸门开启时拒绝）；订阅域名只放行 `Via::Sub`，节点域名什么都不放行，通行密钥中心域名只答 `/.well-known/webauthn`；管理员白名单在 `ConnectInfo` 缺失时按"非空即拒"处理。
- **拒绝同构**：`reject::not_found()` + `Rejected` 扩展，`security_headers` 对 `Rejected` 响应重新铸造（盖住 `Allow` 头），`method_not_allowed_fallback`/`fallback` 都回 `rejected`；`request_id` 层在闸门之内且跳过 `Rejected`；`ApiError::rejected()`（管理员会话在门户上）经 `IntoResponse` 变回规范拒绝；订阅所有失败路径（限速、坏 token、未启用格式、仅自研客户端）都是规范拒绝，成功头只在成功时发送；`console_index/console_asset/login_asset` 对非管理员 / 非 `Via::Admin` 一律规范拒绝；报告的"门户与管理员 API 同一路由表"只暴露 API 路径形状，不暴露前缀。
- **前缀不进日志 / 指标**：`redacted_path` 用于 5xx 日志；`request_id` 的 span 只记匹配到的路由模板；`metrics::track_http` 标签 = `MatchedPath` 或 `unmatched`；未发现 `uri()`/原始路径进入 tracing（grep 全仓）。
- **会话**：JWT HS256 固定算法、`exp` 校验、`sv` 必须、角色以数据库为准；`AuthUser` 每请求一次索引查询；禁用 / 注销 / 封禁 / 过期 / 超额度各自的范围正确；`PortalUser/ShopUser/AuthUser/PendingUser` 的分层与文档一致；管理员会话在门户上规范拒绝；`session_ver` 触发器覆盖 CLI 与手写 SQL 的密码 / 角色 / 禁用 / 到期变更。
- **登录**：邮箱大小写不敏感、不存在 / 无密码 / 被禁用 / 错密码同一 401 且同样一次 argon2（`scrub_password_async` 与真实校验同队列）；陷阱 / 蜜罐命中同构；凭据失败审计在响应之后 spawn；`passkey_required` 仅在密码正确后出现；限速 Lua 原子预留、名字桶哈希定长、过限不计数；失败的非凭据原因归还名额。
- **客户端地址** `client_ip`：非受信对端不读 XFF；右起第一个非受信跳；多条 XFF 合并；非 ASCII / 垃圾跳按最后一个真实跳处理；Cloudflare 模式只在整条链受信且末跳是 CF 时读唯一的 `CF-Connecting-IP`；IPv4-mapped 规范化；IPv6 /64 桶；`MAX_HOPS=32`。（我逐一想了"自己建 Cloudflare 区域转发到源站"的攻击：CF 会覆盖 `CF-Connecting-IP`，攻击者只能得到自己的真实地址，不成立。）
- **所有者模型**（除 P1-1/P3-1 外）：`protect`/`guard_target` 在 `update_user`/`ban`/`unban`/`delete`/`revoke_sessions`/`reset_login`/`admin_verify_email` 都被调用；转让在行锁下进行，延迟约束保证有且仅有一个所有者；`create_user` 建管理员须所有者；CLI / system 无账户行动者放行。
- **通行密钥**：状态在 Valkey 单次使用（`GETDEL`）、RP ID 随状态存储并与当前 RP 比对、登录是可发现凭据（无邮箱输入）、凭据按 (rp_id, cred_id, user_id) 锁行更新计数、统一 401；`reauth` 状态绑定账户；注册的 `exclude_credentials`、每账户 10 个上限在账户行锁下检查；中心域名 / ROR 的 Host 角色隔离。
- **注册 / 找回 / 邀请**：功能关闭时在读 body 之前规范拒绝；"发码 / 发重置"同步部分与账户是否存在无关，账户相关工作在 spawn 里；验证码 HMAC（长度前缀的域分隔）、5 次错误作废、单次使用、与目的 / 主体 / 邮箱绑定；重置 token 256 位 SHA-256、30 分钟、单次、绑定发送时的地址、fragment 传递、链接域名取自设置而非 Host；邀请码 10 位 32 字符表（≈50 位）、单次使用的 `uses = 0` 条件更新；地址所有权变更全部在 `lock_address` 咨询锁下；待绑定会话只到 `GET /me` 与绑定接口。
- **Turnstile 失败即关闭**：缺 token / 被拒 400，校验不可达 / 站点配置错误 503，密钥打不开 503 + ERROR；`classify` 对未知错误码按站点侧处理；日志只含错误码。
- **主密钥**：各用途独立标签派生（`derived_keys_are_unchanged` 钉住），AAD 绑定行 ID，篡改 / 他人行 / 他钥都打不开；`master.key` 不会被静默重生成，`totp.key` 改名逻辑安全。
- **订阅 token**：256 位、仅哈希查找、`plausible_token` 先于哈希、`ensure_token` 条件 UPDATE 不隐式轮换、`apply_reset` 锁序 entitle → 节点 → 用户；格式开关 / 仅自研客户端 / `?format=` 都落到规范拒绝。
- **enrollment**：CSR 校验先于 token；token 查询只匹配有效 token（未知 / 已用 / 过期 / 删除中同一答复）；烧毁是持有服务器行锁后的条件 UPDATE；重放与并发恰好一次；续期要求已验证证书、墓碑先检查、每服务器 20 次/小时；安装脚本 / 二进制端点只在 token 有效时回答，其余规范拒绝。
- **SSRF 判定** `outbound::public_address`：回环 / 私网 / 链路本地 / CGNAT / TEST-NET / 6to4 中继 / 基准 / 组播 / 保留，IPv6 的映射 / NAT64（仅 `64:ff9b::/96` 且内嵌地址公网）/ 6to4 / Teredo / ULA / 链路本地 / 文档 / ORCHID / SRv6；十进制 / 十六进制 / 八进制 IPv4 经 `getaddrinfo` 解析后按真实地址判定；一次解析、连接到已检查的地址（无 DNS rebinding）、TLS 校验域名、重定向由调用方逐跳复查。
- **路由认证覆盖**：用脚本枚举 `src/**` 中 263 条 `/{prefix}/…` 路由并检查处理函数签名，所有 `/api/v1/**` 路由都带 `AuthUser/ShopUser/PortalUser/PendingUser`，无认证路由仅有预期的公开集（auth/*、brand、assets、healthz、app、install、pay、sub、sub-rules、`/api/v1/pages/{slug}`）。

## 方法与未覆盖

- 读了上述范围的源码；追加的跨文件检查：全仓 `owner::` 命中表、`DefaultBodyLimit`/超时层、`TraceLayer`、`outbound::` 与 `billing::http` 调用方、路由 × 处理函数签名脚本（`/tmp/claude-0/…/scratchpad/audit2/routes.py`，一次性，不入库）。
- 未做：真进程请求级复现（P1-1/P2-1/P2-2/P2-3 都建议在 `make dev-up` 栈上按"复现"小节验证）；`cargo clippy`/覆盖率统计；`sub/` 渲染器、`mail/sender`、`alerts` 评估、`tickets.rs`、`billing/**` 认证面、`passkey/tests.rs`/`signup/tests.rs` 的逐条断言；`console.rs` 的 e2e；`portal/` 与 `admin/` 的前缀泄漏（由 `check-bundles.mjs` 覆盖，本批未复核）。
- 严重度口径：P1 = 已确认的授权边界被绕过（需要一个次级管理员）；P2 = 需要先有会话 / 管理员权限的持久化或放大问题，或可被匿名放大的可用性问题。
