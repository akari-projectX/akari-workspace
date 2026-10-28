# Red team 2026-10, area B: money

Base: akari-panel origin/main a74a41b. PR: akari-projectX/akari-panel#227 (branch `rt-b-money`, label `full-ci`, not merged).
Method: white-box read of src/billing/*, plans.rs refund paths, migrations (ledger/withdrawable SQL), docs/PAYMENTS.md; adversarial route-level tests against the local PG/Valkey and the existing mock gateways. No external host contacted.

## Findings (fixed in the PR, one commit each, test fails on main)

| id | sev | summary | test |
|---|---|---|---|
| B-2 | medium | Coinbase `webhook_secret` / CoinPayments `client_secret` accepted any length (docs: "fill in anything for now"). The secret is the HMAC key of the webhook; a guessed key forges `checkout.payment.success` / `InvoiceCompleted` for an order the attacker owns (order number, cents and the fiat amount are visible to the buyer). Fix: `crypto::hmac_secret_ok` (>= 16 chars) in validate, build and the `_readable` view; error text and admin copy updated; docs. Existing stored short secrets become "unreadable" (owner re-enters). | `redteam::webhook_secrets_must_be_long_enough` |
| B-3 | medium | Refund A (money only, A already replaced by switch B), then refund B: `refund::effect` restored subscription A. Customer keeps refunded plan A for free. Fix: no restore when an order with `fulfil_result.user_plan_id = prior` and kind new/switch is refunded, unless that refund's effect was `keep_plan`; B's subscription is then just ended. | `redteam::refunding_the_switch_does_not_resurrect_a_refunded_plan` |
| B-1 | low | Notify body > 2 MiB (axum default limit of the `Bytes` extractor) answered 413, not the canonical 404, and wrote no event. Fix: route reads the body itself (`to_bytes`, 16 KiB + 1), records `oversized`. smoke.sh gets a 64 KiB assertion. | `redteam::oversized_notify_is_the_canonical_rejection` |

## Findings needing a product decision (not fixed)

**B-4 (medium): terms frozen at order creation can be redeemed arbitrarily late on gateways that cannot close an order.**
Root: `apply_mark_paid` honours payment of an ended order with its stored coupon discount, switch credit and price (documented: "Alipay took the money"). Alipay closes the trade so the window is small; EPay (`Close::NotClosable` always) and crypto in-flight invoices keep a payable link indefinitely.
- Coupon: the user creates order 1 with a single-use / per-user-limited coupon, then order 2 with the same code (creating it ends order 1 and releases the reservation, so the check passes), and so on (20 orders/hour). Paying the stale EPay links later: the first re-reserves, the rest are `redeemed` with `over_limit = true` and still discounted. Limits `max_uses` / `per_user_limit` are unenforceable on such gateways. Existing test `coupon_release_on_expiry_and_late_payment` pins the over_limit behaviour.
- Credit: a switch order created on day 1 (credit ~ full value of plan A), left unpaid, paid on day N: same subscription id so `prior_user_plan_id` check passes; the user used A for N days and still gets the day-1 credit.
Options: (a) a late payment (order ended before payment) whose coupon cannot be re-reserved, or that carries `credit_cents > 0`, goes through `refund_unfulfillable` to the balance (new `AUTO_REFUND` code, like `order_admin.superseded`); (b) a setting "late payment grace minutes" after which any late payment is refunded to balance; (c) leave and document that limited promos need a closable gateway. Recommend (a).

**B-5 (medium, admin-triggered): refunding a credit-source order.** Order A (1000) -> switch to B (3000, credit 1000, pays 2000). Refunding A is "money only, not active" and returns the full 1000 while B (which A's credit paid for) stays. Net collected 2000 for a 3000 plan. `refund-preview` does not warn. Options: preview warning when a later order has `credit_order_id` = this order; cap the refund at unspent value; refuse and ask to refund B first.

**B-6 (info, insider):** manual non-gift orders create invite commissions (documented) although no gateway money came in; a non-owner admin can create them for an alt invitee and the inviter withdraws USDT. Options: owner-only for non-gift manual orders, or skip commission for `paid_via = manual` unless flagged.

**B-7 (info):** batch coupon codes may be 6 characters (32^6); with 5000 codes a distributed guesser (limits are 30/10 min/user, 120/10 min per /24) has a non-zero hit rate. Option: minimum length 8 for batches.

**B-8 (info):** rate limits on notify, orders, coupons fail open when Valkey is down; unverified `payment_events` are never pruned when audit retention is 0 (forever), and the per-/64 limit does not bound many-/64 floods. A notify to a disabled method leaves no event (nothing to attribute); pending orders of a disabled method cannot be settled by notify or reconcile until re-enabled or marked paid manually.

## Coverage: holds, with the proving test

1. Notifications
 - Alipay: signature (incl. empty-value fallback), app_id, seller_id, method binding (`payment_method_id = $2`), amount exactness (`parse_amount` strict), replay (conditional UPDATE), canonical 404 + event: `notify_rejections_are_canonical`, `concurrent_duplicates_fulfil_once`, `two_methods_are_isolated`, `notify_url_follows_the_main_domain`.
 - EPay: MD5 constant-time verify, pid, GET/POST, binding: `epay_purchase_flow`, `epay_and_alipay_are_isolated` (same merchant on two methods cannot cross-settle), `epay_concurrent_notifies_fulfil_once`, `epay_late_notify_after_expiry_fulfils`.
 - CoinPayments/Coinbase: HMAC constant time, 300 s skew, URL-bound (CoinPayments), terminal state only, exact currency + minor-unit amount via `Pricing`, echoed cents: `coinpayments_purchase_flow`, `coinbase_purchase_flow`, `crypto_methods_are_isolated`, `*_concurrent_notifies_*`, `coinpayments_query_settles_without_a_webhook`. Weak-secret gap = B-2. A rate change after invoice creation leaves a paid invoice unsettled (documented, by design; admin marks paid).
 - Every refusal before the method is resolved (rate limit, bad id) is 404 without event by design; after that 404 + event (B-1 closed the remaining gap).
2. Order creation: client sends only `{plan_id, period, coupon?, use_balance?, method_id?, accept_forfeit}` (deny_unknown_fields; `http_purchase_flow`); amounts from `akari_split` + CHECK; coupon reserve under `entitle::lock` (`coupon_last_use_race_and_per_user_limit`); capacity holds (`capacity_race_for_the_last_slot`); one pending per user (`one_open_order_per_user`); zero-amount (`orders_the_balance_covers_need_no_payment_method`); duplicates (`concurrent_duplicates_fulfil_once`, `commission_exactly_once_under_duplicates`). Staleness = B-4.
3. Ledger / commissions / withdrawals: `balance_ledger_invariants`, `every_money_movement_writes_one_ledger_row_and_audit`, `commission_lifecycle`, `commission_clawback_after_the_hold`, `partial_refund_is_proportional`, `banned_inviters_commission_waits`, `spent_commission_is_not_withdrawable`, `withdrawals`, `usdt_withdrawal_chains`, `usdt::tests::addresses`. Read-through of `akari_withdrawable_part`, `Share::of` (i128), `credit_due` debt netting: no defect. IDOR on withdrawals is 404; admin endpoints all `require_admin` (counted per file).
4. Refunds: balance / original / record-only, partial and full, pending and confirmed states, effects: `tests/refund.rs` (all), `original_route_*`, `confirmed_refund_that_cannot_be_recorded_is_resolved_by_the_admin`; manual orders `manual_order_*`, `concurrent_manual_renewals_exactly_once_each`; batch coupons `batch_codes_unique_revoke_and_export`, `batch_code_redemption_race`. Gaps = B-3, B-5, B-6, B-7.
5. Credit / renewals: `switch_credit_*`, `renewal_of_a_no_reset_plan_starts_a_fresh_quota`, `month_end_anchor_survives_renewals`, `refunding_a_renewal_restores_the_cleared_usage`, `late_payment_never_replaces_a_newer_plan`. Reconcile/close: `reconcile_expires_and_catches_late_payments`, `end_order_outages_and_races`, `cancel_works_when_the_method_was_disabled`.
6. Locks and transactions: gateway calls (`create`, `query`, `close`, `refund`, `refund_query`) all happen outside DB transactions (checked every call site in orders.rs, api.rs, refund.rs); entitle lock first in create_order, apply_mark_paid, apply_refund, manual; orders -> coupons -> commissions -> balances -> withdrawals consistent (`release_holds_and_late_payment_do_not_deadlock`). `refund_tick` / `settle_original` re-check state under the row lock.

## Notes
- Full lib run: 863 passed; `updatecheck::tests::api_status_settings_and_check` failed once only because another worker shares the dev database (global advisory lock) and passes alone.
- gh token invalid here; PR opened through the GitHub MCP tool.

## Follow-up (lead decisions, PR akari-projectX/akari-panel#229, branch `rt-b-money-2`, based on `rt-b-money`)
- B-4 done as option (a): `orders::stale_terms` in `apply_mark_paid`: a late payment (order was expired/cancelled) goes through `refund_unfulfillable` (`order_admin.stale_terms`) when the coupon use is over its limit, or the switch credit's subscription is not the current one / is worth < 95% of the credit. Test `late_payment_on_a_stale_switch_credit_goes_to_the_balance`; `coupon_release_on_expiry_and_late_payment` updated. CLAUDE.md and PAYMENTS.md updated.
- B-5: `refund-preview.credit_used_by` + admin dialog warning (no block). Test `refund_preview_warns_when_a_later_switch_used_the_credit`.
- B-6: `Via::Manual` creates no commission (includes "mark paid"). Test `manual_payments_earn_no_invite_commission`.
- B-7: batch code length min 10 (API, admin form, docs, test).
- B-8: unverified payment events are pruned after 90 days when audit retention is 0 (test `prune_events_keeps_money_records` updated). Rate limits left failing open.
- Renewal variant of B-3: yes, it was real (A came back with the refunded renewal's term). Fixed by taking the refunded renewals' terms off the restored expiry (`Revoke::Restore.expires_at`); a restore whose adjusted expiry is past ends the new subscription instead. Test `restored_plan_loses_the_term_of_a_refunded_renewal`.
- The four new behavioural tests were run against the unfixed code and failed; 868 lib tests pass; clippy/fmt clean. Admin tsc not run (no node_modules). Build used rt-a's target dir (disk), cleaned for the panel crate afterwards.
- Slip: I set the `full-ci` label on #228 (area A's PR) by mistake; it already showed `full-ci` only, so nothing else was removed as far as I can see.
