// Mock panel API for local visual comparison of the v1.4.0 React portal (ref-spa) and the Svelte portal.
import http from 'node:http';
const now = Date.now();
const iso = (d) => new Date(now + d * 864e5).toISOString();
const day = (d) => iso(d).slice(0, 10);
const GB = 1024 ** 3;
const branding = { version: 1, logo_url: null, favicon_url: null, footer_text: 'Akari', footer_links: [{ label: '帮助中心', url: 'https://help.example.com' }], tos_url: null, privacy_url: null,
  client_downloads: [], updated_at: iso(-3) };
const options = { register: true, invite_required: false, invites: true, email_domains: [], reset: true, email_verify: true, site_name: 'Akari', branding,
  guard: { form_token: null, form_min_secs: 0, honeypot: true, turnstile: null }, passkey: true, passkey_rp: 'localhost', passkey_register: true, timezone: 'Asia/Shanghai', mail: true };
const me = { id: 'u1', role: 'user', email_pending: false, traffic_used_bytes: 38.4 * GB, traffic_limit_bytes: 200 * GB, expires_at: iso(21), expired: false, quota_exhausted: false,
  banned: false, ban_reason: null, banned_at: null, email: 'user@e2e.test', email_verified: true, locale: 'zh', sub_token: 'abcdef', sub_url: 'https://sub.example.com/s/abcdef', sub_legacy: false,
  sub_formats: ['clash', 'sing-box', 'links'], sub_import_clients: ['clash-verge', 'stash', 'shadowrocket'], sub_own_client: false, probe_interval_secs: 60, timezone: 'Asia/Shanghai' };
const plan = { plan: { name: '标准套餐', traffic_quota_bytes: 200 * GB, period: 'monthly', speed_limit_mbps: 500, device_seats: 5, starts_at: iso(-9), expires_at: iso(21),
  period_anchor: iso(-9), last_reset_at: iso(-9), next_reset_at: iso(21) }, traffic_used_bytes: 38.4 * GB, traffic_limit_bytes: 200 * GB, expires_at: iso(21),
  nodes: [{ name: 'hk-1', tags: ['IEPL'], region: 'HK' }] };
const nodes = [
  { entrance: '香港 01', region: 'HK', tags: ['IEPL', '流媒体'], rate: 1, online: true, status: 'online', load: 'low', probe_ms: 32, latency_ms: 38, latency_status: 'ok', latency_measured_at: iso(0) },
  { entrance: '日本 东京', region: 'JP', tags: ['BGP'], rate: 1.5, online: true, status: 'online', load: 'medium', probe_ms: 70, latency_ms: 88, latency_status: 'ok', latency_measured_at: iso(0) },
  { entrance: '美国 洛杉矶', region: 'US', tags: ['CN2'], rate: 2, online: false, status: 'offline', load: null, probe_ms: null, latency_ms: null, latency_status: 'unknown', latency_measured_at: null },
  { entrance: '新加坡', region: 'SG', tags: [], rate: 1, online: true, status: 'maintenance', load: 'high', probe_ms: 120, latency_ms: 150, latency_status: 'timeout', latency_measured_at: iso(0) },
];
const tb = (n) => ({ up_bytes: n * 0.1 * GB, down_bytes: n * 0.9 * GB, billed_bytes: n * GB });
const traffic = (n) => ({ from: day(-n + 1), to: day(0), timezone: 'Asia/Shanghai', daily_since: day(-60), total: tb(38.4),
  days: Array.from({ length: n }, (_, i) => ({ day: day(-n + 1 + i), ...tb([2.1, 5.4, 0.8, 7.2, 3.3, 9.1, 4.6][i % 7]) })),
  entrances: [{ name: 'hk-1', entrance: '香港 01', rate: 1, rules: [], ...tb(20) }, { name: 'jp-1', entrance: '日本 东京', rate: 1.5, rules: [{ weekdays: [1,2,3,4,5], start: 0, end: 480, rate: 1 }], ...tb(18.4) }] });
const offer = (period, price, extra = {}) => ({ period, days: null, price_cents: price, amount_cents: price, discount_cents: 0, credit_cents: 0, forfeited_cents: 0, balance_cents: 0, coupon_refusal: null, action: 'renew', refusal: null, ...extra });
const shop = { enabled: true, methods: [{ id: 'm1', kind: 'alipay', display_name: '支付宝', icon: null }, { id: 'm2', kind: 'epay', display_name: '易支付', icon: null }], current: { plan_id: 'p1', name: '标准套餐', expires_at: iso(21) },
  credit_cents: 1200, balance_cents: 3500, coupon: null, plans: [
  { plan_id: 'p1', name: '标准套餐', description: '适合日常使用', traffic_quota_bytes: 200 * GB, period: 'monthly', speed_limit_mbps: 500, device_seats: 5, current: true, remaining: null, sold_out: false, recommended: false,
    offers: [offer('month', 2900), offer('quarter', 7900), offer('year', 28800)] },
  { plan_id: 'p2', name: '高级套餐', description: '大流量，多设备', traffic_quota_bytes: 1000 * GB, period: 'monthly', speed_limit_mbps: null, device_seats: null, current: false, remaining: 5, sold_out: false, recommended: true,
    offers: [offer('month', 5900, { action: 'switch' }), offer('year', 59800, { action: 'switch' })] },
  { plan_id: 'p3', name: '体验套餐', description: '', traffic_quota_bytes: 20 * GB, period: 'none', speed_limit_mbps: 100, device_seats: 1, current: false, remaining: 0, sold_out: true, recommended: false,
    offers: [offer('onetime', 900, { action: 'new', refusal: 'sold_out' })] },
] };
const order = (i, status, extra = {}) => ({ id: 'o' + i, out_trade_no: '20261020' + String(100000 + i), plan_id: 'p1', plan_name: '标准套餐', amount_cents: 2900, period: 'month', period_days: null, list_price_cents: 2900,
  credit_cents: 0, discount_cents: 0, coupon_code: null, balance_cents: 0, refunded_at: null, status, qr_code: status === 'pending' ? 'https://qr.alipay.com/xxx' : null, pay_url: status === 'pending' ? 'https://pay.example.com/x' : null,
  payment_method_id: 'm1', payment_method_name: '支付宝', created_at: iso(-i), expires_at: iso(-i + 0.02), paid_at: status === 'paid' ? iso(-i) : null, fulfilled: status === 'paid', action: 'renew',
  refund_route: null, refund_balance_cents: null, refund_external_cents: null, refund_pending: false, refund_effect: null, ...extra });
const orders = [order(0, 'pending'), order(3, 'paid'), order(35, 'paid', { amount_cents: 7900, period: 'quarter', balance_cents: 500 }), order(70, 'expired'), order(80, 'cancelled')];
const entry = (id, kind, amt, bal, d, extra = {}) => ({ id, kind, amount_cents: amt, balance_after_cents: bal, order_id: null, out_trade_no: null, commission_id: null, withdrawal_id: null, reason: null, created_at: iso(d), ...extra });
const balance = { balance_cents: 3500, withdrawable_cents: 2000, entries: [entry(5, 'commission', 580, 3500, -1), entry(4, 'order_payment', -500, 2920, -35, { out_trade_no: '20261020100002' }), entry(3, 'admin_adjust', 1000, 3420, -40, { reason: '活动赠送' }), entry(2, 'withdrawal', -1000, 2420, -50), entry(1, 'commission_clawback', -290, 3420, -60)] };
const withdrawals = [
  { id: 'w1', amount_cents: 1000, chain: 'trc20', address: 'TXyz1234567890abcdefghijklmnopqrstu', memo: null, status: 'approved', usdt_amount: '1.38', txid: '0xabc', note: null, decided_at: iso(-49), created_at: iso(-50) },
  { id: 'w2', amount_cents: 2000, chain: 'polygon', address: '0x1234567890abcdef1234567890abcdef12345678', memo: null, status: 'pending', usdt_amount: null, txid: null, note: null, decided_at: null, created_at: iso(-1) },
  { id: 'w3', amount_cents: 1500, chain: 'trc20', address: 'TXyz1234567890abcdefghijklmnopqrstu', memo: null, status: 'rejected', usdt_amount: null, txid: null, note: '地址有误', decided_at: iso(-10), created_at: iso(-11) }];
const invite = { enabled: true, rate_percent: 10, first_order_only: false, hold_days: 7, min_withdrawal_cents: 1000, usdt_chains: [{ id: 'trc20', name: 'TRON (TRC20)' }, { id: 'polygon', name: 'Polygon' }], usdt_rate_cents: 725,
  invited_count: 3, pending_cents: 290, credited_cents: 1160, reversed_cents: 290, balance_cents: 3500, withdrawable_cents: 2000, commissions: [
  { id: 'c1', invitee_label: 'a***@gmail.com', base_cents: 2900, rate_percent: 10, amount_cents: 290, status: 'pending', available_at: iso(5), credited_at: null, reversed_at: null, created_at: iso(-2) },
  { id: 'c2', invitee_label: 'b***@qq.com', base_cents: 5800, rate_percent: 10, amount_cents: 580, status: 'credited', available_at: iso(-3), credited_at: iso(-3), reversed_at: null, created_at: iso(-10) },
  { id: 'c3', invitee_label: 'c***@163.com', base_cents: 2900, rate_percent: 10, amount_cents: 290, status: 'reversed', available_at: iso(-30), credited_at: null, reversed_at: iso(-28), clawback_cents: 290, created_at: iso(-40) }] };
const inviteCodes = { code: { code: 'AK7X9Q', uses: 3, created_at: iso(-30) }, register_enabled: true, user_invites: true, invite_required: false, single_use: false, invited: 3, link_base: null };
const ticket = (id, subject, status, unread) => ({ id, subject, category: 'technical', priority: 'normal', status, messages: 2, created_at: iso(-3), updated_at: iso(-1), unread });
const tickets = [ticket('t1', '节点连接超时', 'answered', true), ticket('t2', '发票申请', 'open', false), ticket('t3', '如何导入订阅', 'closed', false)];
const ticketDetail = { ...ticket('t1', '节点连接超时', 'answered', true), order_id: null, order_no: null, node_id: null, node_name: null, closed_at: null, closed_by: null,
  messages: [{ id: 1, staff: false, body: '香港 01 今天晚上一直连不上，麻烦看看。', created_at: iso(-3) }, { id: 2, staff: true, body: '已检查，线路已恢复，请再试一下。', created_at: iso(-1) }] };
const ann = { unread: 1, announcements: [
  { id: 'a1', title_zh: '线路升级公告', title_en: 'Line upgrade', html_zh: '<p>本周六凌晨将升级香港线路，预计中断 10 分钟。</p>', html_en: '<p>HK maintenance.</p>', pinned: true, created_at: iso(-1), read: false },
  { id: 'a2', title_zh: '新套餐上线', title_en: null, html_zh: '<p>高级套餐现已开售。</p>', html_en: null, pinned: false, created_at: iso(-8), read: true }] };
const hi = (id, cat, t) => ({ id, category_id: cat, title_zh: t, title_en: null, updated_at: iso(-5) });
const help = { categories: [{ id: 'c1', name_zh: '快速开始', name_en: null, articles: [hi('h1', 'c1', '如何导入订阅'), hi('h2', 'c1', 'Windows 客户端设置')] }, { id: 'c2', name_zh: '常见问题', name_en: null, articles: [hi('h3', 'c2', '连接不上怎么办')] }], uncategorized: [hi('h4', null, '服务条款说明')], total: 4 };
const article = { id: 'h1', category_id: 'c1', category_zh: '快速开始', category_en: null, title_zh: '如何导入订阅', title_en: null, html_zh: '<h2>步骤</h2><p>复制订阅链接，在客户端中选择「从 URL 导入」。</p><ul><li>Clash Verge</li><li>Stash</li></ul><pre><code>https://sub.example.com/s/abcdef</code></pre>', html_en: null, updated_at: iso(-5) };
const legal = { title_zh: '服务条款', title_en: 'Terms', html_zh: '<h2>1. 总则</h2><p>欢迎使用本服务。</p><h2>2. 使用规范</h2><p>请遵守当地法律法规。</p>', html_en: null, updated_at: iso(-30) };
const passkeys = { available: true, rp_id: 'localhost', passkeys: [{ id: 'k1', name: 'MacBook Touch ID', created_at: iso(-20), last_used_at: iso(-1), current: true }], password_set: true, password_login_disabled: false, password_login: true, max: 10 };
const state = { signedIn: true, scope: 'full' };
const route = (m, p, q) => {
  if (p === '/auth/options') return options;
  if (p === '/auth/register/challenge') return { challenge: 'x', bits: 1 };
  if (p.startsWith('/auth/')) return { ok: true, id: 'u1', email: me.email, role: 'user', expired: false, quota_exhausted: false };
  p = p.replace('/api/v1', '');
  if (p === '/me') { if (!state.signedIn) return [401, { code: 'errors.unauthorized' }]; return { ...me, expired: state.scope === 'expired', banned: state.scope === 'banned', ban_reason: state.scope === 'banned' ? '违反服务条款' : null,
    sub_url: state.scope === 'full' ? me.sub_url : null, sub_token: state.scope === 'full' ? me.sub_token : null }; }
  if (!state.signedIn) return [401, { code: 'errors.unauthorized' }];
  if (p === '/me/plan') return plan;
  if (p === '/me/nodes') return nodes;
  if (p === '/me/traffic') return traffic(Math.round((new Date(new URLSearchParams(q).get('to')) - new Date(new URLSearchParams(q).get('from'))) / 864e5) + 1);
  if (p === '/me/shop') return shop;
  if (p === '/me/orders') return m === 'POST' ? orders[0] : orders;
  if (p.startsWith('/me/orders/')) return orders.find((o) => o.id === p.split('/')[3]) ?? orders[0];
  if (p === '/me/balance') return balance;
  if (p === '/me/withdrawals') return withdrawals;
  if (p === '/me/invite') return invite;
  if (p === '/me/invite-codes') return inviteCodes;
  if (p === '/me/tickets') return tickets;
  if (p.startsWith('/me/tickets/')) return ticketDetail;
  if (p === '/me/announcements') return ann;
  if (p === '/me/help') return help;
  if (p.startsWith('/me/help/')) return article;
  if (p.startsWith('/pages/')) return legal;
  if (p === '/me/passkeys') return passkeys;
  if (p === '/me/delete-impact') return { email: me.email, balance_cents: 3500, withdrawable_cents: 2000, pending_withdrawals: 1, pending_withdrawal_cents: 2000, pending_orders: 1, unfulfilled_orders: 0, plan: { name: '标准套餐', expires_at: iso(21) }, pending_commission_cents: 290, pending_commissions: 1, invitees: 3, anonymized: false };
  return { ok: true };
};
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__mock') { Object.assign(state, JSON.parse(u.searchParams.get('s') ?? '{}')); res.end('ok'); return; }
  let r = route(req.method, u.pathname, u.search);
  let code = 200;
  if (Array.isArray(r) && typeof r[0] === 'number') [code, r] = r;
  if (u.pathname.startsWith('/brand')) { res.statusCode = 404; res.end(); return; }
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(r));
}).listen(18480, '127.0.0.1');
