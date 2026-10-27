# Brief: CoinPayments and Coinbase payment methods

User 2026-10-27: "支付方式支持 coinpayments、coinbase" — hosted gateways (no own node/RPC); must land **before** the
agent v0.6.1 + panel v2.1.0 release.

## Design (lead)
- Two new `provider::ProviderKind`s in the existing pluggable payment-method system (W24/R40, same as `epay`):
  `coinpayments` and `coinbase`. Files `src/billing/coinpayments.rs`, `src/billing/coinbase.rs`, registered in
  `provider::KINDS`. Everything else (orders, `apply_mark_paid` single payment path, reconciliation loop, notify route
  `/pay/{method_id}/notify`, canonical rejection, payment_events, sealed secrets, owner-only writes, version, audit) is
  reused unchanged. Read docs/PAYMENTS.md and the epay implementation first and mirror its structure and tests.
- **Amounts**: orders stay in integer CNY cents. Invoice/charge priced in CNY (fiat) — the gateway converts to crypto
  and carries the rate risk. If a gateway cannot price in CNY, use USD with an operator-set fixed rate field in the
  method config (like `usdt_rate_cents`) and record both amounts; prefer native CNY.
- **Settlement only on verified paid status**: the notify handler verifies the signature on the RAW body (never
  re-serialise), matches our order (out_trade_no/metadata we set, method id, amount and currency exactly), and only a
  terminal paid state (CoinPayments v2 `invoicePaid`/`invoiceCompleted` — pick the one that means funds are confirmed
  and say why; Coinbase `charge:confirmed`/checkout equivalent) calls `apply_mark_paid`. Underpaid/overpaid/expired/
  delayed states never pay; underpaid is recorded in payment_events and visible to the admin. Every rejection =
  `reject::not_found()` + payment_events row (existing rule).
- **Query** (reconciliation + `GET /me/orders/{id}` polling): fetch the invoice/charge by id via the gateway API and
  apply the same rules — webhooks lost ⇒ still settled.
- **Close**: cancel the invoice if the API supports it, else `NotClosable` (late payment still fulfils, existing rule).
- **Refund**: no original-route refund (`refunds()` false) — admin records balance/manual refunds as today.
- **Coinbase**: integrate the current Coinbase Business **Checkouts API** (docs.cdp.coinbase.com
  coinbase-business/checkout-apis) unless it cannot do server-side order + webhook flow, in which case Commerce charges
  API (api.commerce.coinbase.com, webhook `X-CC-Webhook-Signature` HMAC-SHA256 of the raw body with the shared secret).
  Decide from the official docs, cite them in code comments and the PR.
- **CoinPayments**: API v2 (a-docs.coinpayments.net): client id + client secret, request signing per their docs,
  invoices, webhook subscription + signature verification ("authenticating requests"). v1 (IPN HMAC-SHA512) only if v2
  lacks something essential — say so.
- **Outbound**: only via `billing::http` (SSRF policy `OPERATOR`), fixed official API hosts, timeouts, size caps; secrets
  only in headers/body, never in logs/URLs/errors; gateway error bodies never echoed (status + our classification).
- **Config schema** (`ProviderKind::schema`): ids/keys/webhook secret (sealed, write-only, `_set` + fingerprint),
  optional display name/icon; `test_connection` calls a cheap authenticated endpoint. Admin form comes from the schema
  (check the admin renders it; add zh labels). Portal shows the method with a default icon (`default_icon`).
- **Tests**: mock gateway servers (like epay's), signature vectors from the official docs where published, replay /
  concurrent duplicate notifies fulfil once, wrong signature / wrong amount / wrong currency / other method's order /
  underpaid / expired → canonical rejection, query-based settlement when no webhook arrives, fuzz the notify parsers
  (add to fuzz targets like the Alipay/EPay ones). Smoke: method create + order + mocked paid notify end to end.
- **Docs**: docs/PAYMENTS.md sections for both (setup steps in the gateway dashboard, webhook URL, what the operator
  must do), CLAUDE.md payments bullet updated, error codes registered.
- One PR, `full-ci`, money ⇒ the lead reviews line by line.
