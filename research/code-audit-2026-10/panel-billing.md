# 代码体检 批次 1：akari-panel 资金核心（只读审计）

日期 2026-10-26 · 基线 akari-panel main `eeed5b6` · 范围 `src/billing/**`、`src/plans.rs`（订阅/续费/换套餐/重置/退款撤销/到期与周期重置 pass）、`src/entitle.rs`（仅计费调用处）、`src/traffic.rs`（FLUSH_SQL / 保留 / 压缩）、`src/trafficlog.rs`（抽查）、`src/rates.rs`，以及 `akari_split / akari_prorate / akari_coupon_discount / akari_period_end / akari_next_reset / akari_withdrawable_part / akari_entrance_*` 与账本触发器。

状态：**本批主路径已完成**；`alipay.rs` 的签名/密钥细节、`methods.rs`、`provider.rs`、`trafficlog.rs` 的查询函数、`billing/tests.rs` 只抽查，未逐行读（见「方法说明」）。无代码改动。

## 摘要

| 严重度 | 数量 |
|---|---|
| P0 | 0 |
| P1 | 0 |
| P2 | 5 |
| P3 | 16 |

没有发现会多收钱、多开通、负余额的缺陷：付款唯一路径 `apply_mark_paid` 的幂等、余额账本触发器、优惠券预占、佣金追回、FLUSH_SQL 的向下取整都核对通过（见末尾「已核对正确」）。5 个 P2 都是「异常路径下卡死 / 未知结果被当成失败 / 上限分支失效 / 锁序」，不是常态下的错账。

## P2

### P2-1 `FLUSH_SQL` 新行上限分支是死代码，新会话行按整个突发窗口计上限
- 位置：`src/traffic.rs:856-860`（`per_row.cap` 的 `COALESCE(GREATEST(extract(epoch FROM statement_timestamp() - GREATEST(old_at, floor)),0) + $10, LEAST(GREATEST(age_secs,$9), …))`）
- 类别：bug / 文档与实现不一致（计费上限）
- 推理与验证：文档（`traffic.rs:711-717`）说新行上限 = 速率 ×（自首次出现起的时间，至少 `$9`=60s，至多 `now-floor`）。但 `GREATEST(old_at, floor)` 在 `old_at` 为 NULL（本语句新插入的行，`ins` 的 `old.*` 为 NULL）时返回 `floor`（PG 的 GREATEST 忽略 NULL，仅全 NULL 才返回 NULL），所以第一个参数永远非 NULL，`COALESCE` 的第二分支永不触发。SQL 级验证（审计库）：`select coalesce(greatest(extract(epoch from now()-greatest(null::timestamptz, now()-interval '120s')),0)+15, 999)` → `135`。结果：新会话行单行上限 = key 速率 ×（突发窗口 120s + 15s），`age_secs`（缓冲区算好整列传入）对新行完全无效。
- 影响：被攻陷的 agent 对单个用户新建会话行可在一次 flush 里多记到 ~2.25 倍文档上限（仍受服务器级 GCRA 约束；默认 key 速率 = 服务器速率时被 GCRA 掩盖，所以现有测试 `minting_for_assigned_user_is_clamped` 发现不了；管理员给某服务器调大 `traffic_max_rate_bytes_per_sec` 后才暴露）。仅恶意 agent 场景，故 P2。
- 修法：`CASE WHEN old_at IS NULL THEN <age 分支> ELSE <old_at 分支> END`；补测试：key 速率 ≪ 服务器速率，新会话行 `age_secs=0` 时计费 ≤ key×60。

### P2-2 开通阶段的瞬时 DB 错误被记成永久「已付款未开通」，通知仍回 success
- 位置：`src/billing/orders.rs:319-364`（`fulfil`）+ `src/billing/api.rs:1728-1761`（`handle_notify` 回 `true`）
- 类别：错误处理吞错 / 幂等性
- 推理：`fulfil` 在 savepoint 里跑 `retake_balance + grant`；任何错误（含 `sqlx::Error` 转成的 `ApiError`，如死锁 `40P01`、锁超时 `55P03`、序列化失败）都被 `sp.rollback()` 吞掉，写 `fulfil_error`（`internal error`），付款事务照常提交，`handle_notify` 回 `Ok(true)` → 支付宝收到 `success`，不再重发。`grant` 会取 servers/nodes/users 行锁（`apply_set_user_plan` → `apply_reconcile`），与 flush（servers→nodes→users）、周期重置等并发，死锁可能发生。`AUTO_REFUND` 只覆盖五个业务码，`internal error` 不在其中 → 付了钱的订单停在「已付款未开通」，直到管理员手工重试。
- 修法：`fulfil` 区分业务错误（4xx `ApiError`：落 `fulfil_error`）与基础设施错误（SQLSTATE 40xxx/55P03/57014/连接类）：后者向上传播使整个事务回滚、通知不 ack（网关会重发，对账也会重查）。补测试：在 grant 中注入死锁/超时，断言订单仍 pending 且通知未 ack。

### P2-3 原路退款：网关「系统错误」被判为 `failed`（未动账），随后换路径可能重复退（待确认）
- 位置：`src/billing/refund.rs:738-757`（`Err(CallError::Business{..})` → `state="failed"`）、`src/billing/alipay.rs:675-690`（`refund`）、`parse_response`（`code != 10000` 一律 `Business`）
- 类别：幂等性 / 状态迁移
- 推理：`settle_original` 把所有 `Business`（code≠10000）当作「网关明确拒绝、什么都没动」。支付宝的 `20000 服务不可用 / ACQ.SYSTEM_ERROR / isp.unknow-error` 同样走 `Business`，其官方语义是「结果未知，请用相同参数重试」。记为 `failed` 后，管理员可以用**不同金额**重发（`begin_original` 对不同金额分配新请求号 `R2`），或改走「退到余额 / 记录手工退款」，而 `R1` 实际已在支付宝执行 → 顾客收到两次钱。模块文档写的是「未知 = pending + 退避」，实现在这类错误上与文档不一致。需对照支付宝 `alipay.trade.refund` 当前错误码表确认（沙箱难复现）。
- 修法：白名单明确拒绝码（`ACQ.REFUND_AMT_NOT_EQUAL_TOTAL`、`ACQ.TRADE_NOT_ALLOW_REFUND`、`ACQ.SELLER_BALANCE_NOT_ENOUGH`、`ACQ.REASON_TRADE_BEEN_FREEZEN`、`ACQ.TRADE_NOT_EXIST` 等）→ failed；其余 Business（含 `20000`/`SYSTEM_ERROR`/未签名）→ pending 并保留同一请求号；`begin_original` 在上次为非明确拒绝的 failed 时禁止换金额。补测试：mock 网关回 `ACQ.SYSTEM_ERROR`，断言仍 pending。

### P2-4 原路退款确认后 `apply_refund` 失败 → 永远 pending，管理员也无法改走其它路径
- 位置：`src/billing/refund.rs:680-725`（Refunded 分支：先把请求置 done 再 `apply_refund`，任何 `?` 回滚整个事务，状态仍 pending）+ `refundable()` 对 pending 一律 409 `refund_in_progress`
- 类别：失败路径 / 状态机
- 推理：支付宝已确认退款后，若 `apply_refund` 确定性失败 —— 例如用户已删除但订单有 `held` 的余额部分（`credit>0 && user=None` → `order_admin.refund_user_gone`），或并发把订单标成了已退款 —— 则事务回滚，`refund_request` 仍是 pending，`refund_tick` 每 5 分钟重查网关并再次失败，永不结束；同时管理员既不能「记录手工退款」也不能撤销该请求。钱已退给顾客，面板里订单仍显示未退款。
- 修法：失败时用单独事务把请求标 `needs_attention`（保存错误），`refundable` 对该状态放行手工记录。补测试：用户被删除且有 held 余额部分时走原路退款。

### P2-5 `release_holds` 违反文档锁序（余额先于优惠券），与建单/迟到付款可死锁
- 位置：`src/billing/orders.rs:401-432`（先 `ledger::apply_entry`＝余额行锁，后 `coupons::release`）；对比建单 `api.rs:729-748`（券 → 余额）、付款 `orders.rs:187/326`（`coupons::redeem` → `retake_balance`）。文档 `docs/PAYMENTS.md`「Lock order」与 `ledger.rs` 头注释：orders → coupons → commissions → user_balances。
- 类别：并发锁序
- 推理：`end_order`（对账/取消/新建订单时顺带结束旧单）不取 `entitle::lock`，只有 订单行 → 余额 → 券。迟到付款（持 entitle 锁，先锁券再要余额）与同一用户另一张订单的 `release_holds`（先锁余额再要同一张券）会成环。条件苛刻（同一用户、同一优惠码、一张迟到付款一张刚好过期/取消），后果是 PG 中止其中一个事务（通知被重发、对账下轮重试），不错账。推理结论，未做真库复现。
- 修法：`release_holds` 先 `coupons::release` 再退余额；补「迟到付款 × 并发 release_holds」双线程测试。

## P3

1. **P3-1 退款后新鲜额度不收回**（待确认，需业务裁决）：`plans.rs:1666-1682` 续费 `fresh_quota` 清零用量；`refund.rs` 的 `Effect::Rollback` 只回退到期，已清零的用量不恢复 → 买一次性/无周期重置套餐的续费、用完新额度、再退款，额度白得。修法：`fulfil_result` 记 `fresh_quota`，Rollback 时加回/拒绝。
2. **P3-2 `akari_prorate` 是死 SQL 函数 + 第二个事实来源**：生产路径 `catalog::switch_credit`（`catalog.rs:542-581`）把折算整段内联，从未调用 `akari_prorate`；只有 `billing/tests.rs:1778` 在测该函数 → 该测试不覆盖真实折算。修法：删函数与测试，折算测试改对 `switch_credit`。
3. **P3-3 模块文档过期**：`catalog.rs:28-31` 仍写「pending orders reserve nothing … the other stays paid with fulfil_error」，实际 中-2 已有 `taken_sql` 预占 + 自动退款。
4. **P3-4 `list_balances` 每行重放账本**：`ledger.rs:306-320` 对最多 500 行各调一次 `akari_withdrawable_part`（plpgsql 重放该用户全部账本）。修法：默认 limit 缩小，或把 W/N 两桶做成触发器维护的列。
5. **P3-5 `akari_period_end` 月末漂移**（待确认）：`1033_site_timezone_partitions.sql:111-135`：1/31 买月付 → 2/28，续费从 2/28 起算 → 3/28（非 3/31），每次续费逐步少给天数（对顾客不利的取整方向）。需裁决是否以首次购买日为锚。
6. **P3-6 回溯平均倍率按 10 秒分箱**：`traffic.rs:912-918` `date_bin('10 seconds', start)` 令平均区间最多多 10s，方向不固定（不满足「只少计」）；仅失联补扣且入口有时段规则时出现，影响极小。
7. **P3-7 EPay 查询对 `out_trade_no` 缺省宽容**：`epay.rs:253` `is_some_and(|o| o != …)`，应答缺该字段即通过，凭 `status=1`+`money` 判已付；应要求字段存在且一致（与支付宝 `query` 一致）。
8. **P3-8 手工订单对「无到期的同套餐持有者」静默成功**：`manual.rs` 不经 `catalog::decide`；`orders::grant` 的 `Some((_,p,None)) if p==plan` 分支返回 `fulfilled:true, note:"plan has no expiry"` 但什么都没做，非赠送时仍记收入。修法：复用 `decide`，至少对 NoExpiry 返回 409。
9. **P3-9 部分原路退款按整单退款处理**（待确认产品意图）：`apply_refund` 对任意 `cents ≤ amount` 的原路退款都撤销订阅（除 `keep_plan`）、整笔佣金追回、释放整张券；佣金/券没有开关（方向对商家有利、对邀请人不利）。
10. **P3-10 优惠码猜测限速只按用户**：`api.rs:46 COUPON_RATE=30` 键为 `akari:rl:coupon:{user}`；开放注册时可多账号并行。批量码默认长度 10（50 位）安全，`length=6` 仅 30 位；建议加 IP 维度并在后台对 `length<8` 提示。
11. **P3-11 `cancel_order` 在支付方式被停用时直接 503**：`api.rs:999-1001`，用户取消不了自己的待付订单；应走 `end_order` 的无网关路径。
12. **P3-12 `traffic_sessions` 行永不删除**：保留任务只设 `purged_at`，每次 agent 重启一行；量小但无上界。
13. **P3-13 全局 `entitle::lock` 串行化所有建单/付款/退款/续费**：设计如此（CLAUDE.md），但付款通知路径持锁时间含 `apply_reconcile`；建议在 PERF.md 记一个「每秒订单」基线（`make bench` 目前不覆盖）。
14. **P3-14 手写 Keccak-256**：`usdt.rs` 自带 keccak_f（有 SHA3 对拍测试），仅为 EIP-55 校验；若依赖里已有 `sha3`/`tiny-keccak` 应复用，否则是 ~100 行维护负担（风险低：失败只会拒绝混合大小写地址）。
15. **P3-15 风格偏差（抽样）**：`traffic.rs:247,259,271,282,291` 共 5 处 `lock().unwrap_or_else(PoisonError::into_inner)`（RUST-STYLE「并发」明确禁止）；`orders.rs:113` `record_event` 9 个参数 + `#[allow(clippy::too_many_arguments)]`；不明确的 bool 参数：`end_order(…, force)`、`refundable(…, lock)`、`sync_users_from_plan(…, fresh)`、`Refund{to_balance, keep_plan}`；`Effect::to_json`/`store()` 用 `unwrap_or(Value::Null)` 吞序列化错误。本批文件非测试代码无 `unwrap()`、无 glob 导入（合规）。
16. **P3-16 `reconcile_tick` 顺序执行最多 20 个订单的网关调用**：`orders.rs:915-950` 逐个 await，网关慢时单个 tick 可超 10s 间隔（`MissedTickBehavior::Delay` 不堆积）；可小并发（4）处理。

## 测试缺口（建议补）
- `settle_original` 失败分支：Business 系统错误、`apply_refund` 失败卡死（P2-3/P2-4）。
- `fulfil` 注入瞬时 DB 错误（P2-2）。
- `FLUSH_SQL` 新行上限在 key 速率 ≪ 服务器速率时的断言（P2-1）。
- 迟到付款 × `release_holds` 并发（P2-5）；`akari_withdrawable_part` 与 `commission_clawback`/`refund_to_balance` 交错的属性测试（现有多为单序列）。
- `switch_credit`：目前只测 SQL 函数（P3-2），缺「周期重置 + 流量用尽 + 两张续费订单叠加」的端到端用例。

## 已核对正确（覆盖范围）
- `apply_mark_paid`：条件 `UPDATE … WHERE status <> 'paid'` 恰好一次；先取 `entitle::lock`；开通走 savepoint；`order.paid` 审计同事务；券兑现/返利/回执同事务；迟到付款重占券与重扣余额（余额不足不会为负）。
- 通知端点：未知/停用/他方订单/金额不符/验签失败全部 `reject::not_found()` 且落 `payment_events`；`app_id`、`seller_id`、`pid` 校验；重放得 `duplicate`；错误不 ack（网关重发）。
- 网关调用均在持锁事务之外：建单 precreate、`end_order` 的 query/close、`settle_original` 的 refund/query。
- 金额均在 SQL 内算（`akari_split`/`akari_coupon_discount`/`switch_credit`），取整方向均为 floor（折抵、百分比券、返利、倍率 `floor(billed×permille/1000)`、GCRA 比例缩放）；`parse_amount` 精确到分、拒绝多于 2 位小数。
- 余额：只能经 `balance_ledger` 插入；触发器在行锁下 `balance+amount>=0` 条件更新，负数 → AK003/409；`apply_entry` 每笔一行审计；建单锁序 entitle→券→余额一致。
- 佣金：`order_id` 唯一 + 条件翻转 → 只建一次；`first_order_only` 排除已退款；`credit_due` SKIP LOCKED + 条件更新；追回（余额够扣、欠款与后续佣金相抵）与 `WITHDRAWABLE_SQL` 三重上限、`akari_withdrawable_part` W/N 桶逻辑读通；提现申请在余额锁下检查并立即扣款，驳回/撤销退回。
- 优惠券：锁券行后在锁内复查全部规则，`used < max_uses` 条件 UPDATE；未付结束释放、退款释放（over_limit 不计数）、迟到付款满额仍付款并标记。
- 库存：`taken_sql` = 生效订阅 + 他人未过期待付 new/switch 订单，建单（锁内）与开通（权威）都复查，满额自动退余额。
- 退款（非原路）：一次性（`refunded_at`），余额/网关部分拆分与 `refund_*_cents` 一致，订阅效果（Cancel/Rollback/Restore）同事务，锁序 entitle→订单→节点/用户→佣金→余额；原路退款请求号幂等，`refund_tick` 认领。
- `FLUSH_SQL`：计数器只前移（GREATEST）、会话墓碑、成员准入、per-row/per-pair/per-server 上限均向下取整；历史暂存与结算同语句；`write_rows` 锁序 servers→nodes→users；毒行逐行回退；保留任务只删可证明已死的行；`COMPACT_SQL` 的 `DELETE … RETURNING` 恰好一次。
- 倍率：`akari_entrance_rate/settle_rate/mean_rate` 与 `rates::apply_set_rules`（改规则记录 prev）一致；`ef` 对无规则/无近期变更直读基础倍率，与函数结果等价。
- 周期重置/到期 pass：一条语句推进标记（错过的周期合并为一次）、只重新启用 `quota`、锁序 servers→users、审计 actor system。
- 本批所有 `apply_*` 均有同事务审计。

## 方法说明
静态阅读，加在独立库（`audit1_billing`，已删除）上对 PG 语义（`GREATEST` 对 NULL、`akari_*` 函数定义）的 SQL 级验证。未运行仓库测试（完整编译耗时过长，已中止）；P2-2…P2-5 为推理结论，未做真库复现，已在各条标明；P2-3 标「待确认」。本批未覆盖或仅抽查：`alipay.rs` 签名与密钥处理、`methods.rs`（热重载）、`provider.rs`、`trafficlog.rs` 查询、`billing/tests.rs`、`entitle::apply_reconcile` 内部（属后续批次）。
