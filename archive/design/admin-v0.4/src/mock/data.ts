/*
 * Mock data for the W33-a prototype. Everything is fictional; shapes follow
 * PLAN-v0.4 decisions (D1–D12, §5 relay, W28–W31) and the phase-0 schema
 * review (servers table, server-level quota, entrance-level counting).
 */
import { GiB, TiB } from "../lib/format";

/* ---------------- Users (D1, D10, D12, W28) ---------------- */
export type UserStatus = "active" | "expired" | "quota" | "banned" | "no_plan";

export type Subscription = {
  plan: string;
  period: string;
  periodEn: string;
  expiresAt: string;
  used: number;
  total: number;
  nextReset: string | null;
  status: "active" | "expired" | "quota";
};

export type User = {
  id: string;
  email: string;
  verified: boolean;
  role: "user" | "admin";
  status: UserStatus;
  banReason?: string;
  sub: Subscription | null;
  balanceCents: number;
  registeredAt: string;
  lastLoginAt: string | null;
  neverUsed: boolean;
  passkeys: number;
  inviter?: string;
  online: number;
};

const sub = (plan: string, period: string, periodEn: string, expiresAt: string, used: number, total: number, nextReset: string | null, status: Subscription["status"] = "active"): Subscription => ({
  plan,
  period,
  periodEn,
  expiresAt,
  used,
  total,
  nextReset,
  status,
});

export const users: User[] = [
  { id: "u-7f3a2c", email: "lin.xiaoyu@qq.com", verified: true, role: "user", status: "active", sub: sub("标准 · 200G", "季付", "Quarterly", "2026-12-18 23:59", 86.4 * GiB, 200 * GiB, "2026-10-18"), balanceCents: 1250, registeredAt: "2026-03-02", lastLoginAt: "2026-10-04 09:12", neverUsed: false, passkeys: 2, online: 3 },
  { id: "u-19be04", email: "zhangwei.dev@gmail.com", verified: true, role: "user", status: "active", sub: sub("高级 · IPLC 500G", "年付", "Yearly", "2027-05-01 23:59", 412.7 * GiB, 500 * GiB, "2026-11-01"), balanceCents: 0, registeredAt: "2025-11-21", lastLoginAt: "2026-10-03 22:40", neverUsed: false, passkeys: 1, online: 2 },
  { id: "u-a04d91", email: "chen_jing@163.com", verified: true, role: "user", status: "quota", sub: sub("入门 · 50G", "月付", "Monthly", "2026-10-27 23:59", 50 * GiB, 50 * GiB, "2026-10-27", "quota"), balanceCents: 300, registeredAt: "2026-06-11", lastLoginAt: "2026-10-02 18:05", neverUsed: false, passkeys: 0, online: 0 },
  { id: "u-c2e870", email: "wang.hao@outlook.com", verified: true, role: "user", status: "expired", sub: sub("标准 · 200G", "月付", "Monthly", "2026-09-28 23:59", 133.2 * GiB, 200 * GiB, null, "expired"), balanceCents: 0, registeredAt: "2026-01-14", lastLoginAt: "2026-09-29 11:30", neverUsed: false, passkeys: 0, online: 0 },
  { id: "u-5d11f2", email: "liu.yang@foxmail.com", verified: true, role: "user", status: "banned", banReason: "共享账号给多人使用（工单 #1042 已告知）", sub: sub("标准 · 200G", "半年付", "Half-yearly", "2027-02-09 23:59", 190.1 * GiB, 200 * GiB, "2026-10-09"), balanceCents: 0, registeredAt: "2026-02-09", lastLoginAt: "2026-09-30 08:02", neverUsed: false, passkeys: 1, online: 0 },
  { id: "u-e6a3b7", email: "zhao.min@qq.com", verified: false, role: "user", status: "no_plan", sub: null, balanceCents: 0, registeredAt: "2026-08-17", lastLoginAt: null, neverUsed: true, passkeys: 0, online: 0 },
  { id: "u-0b72c4", email: "sun.li@126.com", verified: true, role: "user", status: "active", sub: sub("入门 · 50G", "月付", "Monthly", "2026-10-21 23:59", 12.3 * GiB, 50 * GiB, "2026-10-21"), balanceCents: 0, registeredAt: "2026-09-21", lastLoginAt: "2026-10-01 20:16", neverUsed: false, passkeys: 1, online: 1 },
  { id: "u-8c90aa", email: "zhou.tian@gmail.com", verified: true, role: "user", status: "active", sub: sub("高级 · IPLC 500G", "季付", "Quarterly", "2026-11-30 23:59", 96.0 * GiB, 500 * GiB, "2026-10-30"), balanceCents: 5600, registeredAt: "2025-08-30", lastLoginAt: "2026-10-04 07:55", neverUsed: false, passkeys: 3, inviter: "zhangwei.dev@gmail.com", online: 4 },
  { id: "u-3f4e19", email: "wu.yifan@icloud.com", verified: false, role: "user", status: "no_plan", sub: null, balanceCents: 0, registeredAt: "2026-07-03", lastLoginAt: "2026-07-03 14:20", neverUsed: true, passkeys: 0, online: 0 },
  { id: "u-d1c5e2", email: "xu.qing@163.com", verified: true, role: "user", status: "active", sub: sub("不限时 · 1T 流量包", "一次性", "One-time", "永久", 288.4 * GiB, 1 * TiB, null), balanceCents: 0, registeredAt: "2025-12-05", lastLoginAt: "2026-09-27 23:01", neverUsed: false, passkeys: 0, online: 1 },
  { id: "u-6a2f80", email: "huang.lei@proton.me", verified: true, role: "user", status: "active", sub: sub("标准 · 200G", "年付", "Yearly", "2027-03-15 23:59", 41.9 * GiB, 200 * GiB, "2026-10-15"), balanceCents: 880, registeredAt: "2025-03-15", lastLoginAt: "2026-10-03 13:47", neverUsed: false, passkeys: 1, online: 2 },
  { id: "u-b8e1d3", email: "ma.chao@qq.com", verified: false, role: "user", status: "no_plan", sub: null, balanceCents: 0, registeredAt: "2026-08-29", lastLoginAt: null, neverUsed: true, passkeys: 0, online: 0 },
  { id: "u-00a1f7", email: "ops@akari.example", verified: true, role: "admin", status: "active", sub: null, balanceCents: 0, registeredAt: "2025-01-01", lastLoginAt: "2026-10-04 10:02", neverUsed: false, passkeys: 2, online: 0 },
  { id: "u-4c3d22", email: "he.xin@gmail.com", verified: true, role: "user", status: "active", sub: sub("入门 · 50G", "季付", "Quarterly", "2026-12-02 23:59", 44.1 * GiB, 50 * GiB, "2026-10-02"), balanceCents: 0, registeredAt: "2026-04-02", lastLoginAt: "2026-10-04 08:30", neverUsed: false, passkeys: 0, online: 1 },
];
export const usersTotal = 4826;

/* ---------------- Servers → landing nodes → entrances (D2, D5, D6/§5, D9, W29) ---------------- */
export type RateRule = { days: number[]; start: string; end: string; multiplier: number };

export type Entrance = {
  id: string;
  kind: "direct" | "relay";
  name: string;
  host: string;
  port: number;
  multiplier: number;
  rules: RateRule[];
  groups: string[];
  egress: string[];
  probe: "up" | "down" | "unknown";
  latencyMs: number | null;
  hidden: boolean;
  enabled: boolean;
  users: number;
};

export type LandingNode = {
  id: string;
  name: string;
  protocol: string;
  transport: string;
  port: number;
  status: "online" | "offline" | "disabled" | "quota";
  users: number;
  online: number;
  blockRules: boolean;
  entrances: Entrance[];
};

export type Server = {
  id: string;
  name: string;
  region: string;
  flag: string;
  ip: string;
  agentVersion: string;
  online: boolean;
  cpu: number;
  mem: number;
  rateUp: number;
  rateDown: number;
  certDays: number | null;
  quota: { mode: "both" | "up" | "down"; limit: number; used: number; resetDay: number } | null;
  nodes: LandingNode[];
  alerts: number;
};

const weekdays = [1, 2, 3, 4, 5];
export const servers: Server[] = [
  {
    id: "s-hk1",
    name: "hk-hkt-01",
    region: "香港",
    flag: "HK",
    ip: "203.0.113.24",
    agentVersion: "v0.5.0",
    online: true,
    cpu: 38,
    mem: 61,
    rateUp: 18.4,
    rateDown: 212.6,
    certDays: 61,
    quota: { mode: "both", limit: 10 * TiB, used: 6.2 * TiB, resetDay: 1 },
    alerts: 1,
    nodes: [
      {
        id: "n-hk-reality",
        name: "香港 01",
        protocol: "VLESS",
        transport: "REALITY · Vision",
        port: 443,
        status: "online",
        users: 1842,
        online: 312,
        blockRules: true,
        entrances: [
          { id: "e-hk-direct", kind: "direct", name: "香港 直连", host: "hk1.node.akari.example", port: 443, multiplier: 1, rules: [], groups: ["基础线路", "高级线路"], egress: [], probe: "up", latencyMs: 38, hidden: false, enabled: true, users: 1842 },
          {
            id: "e-hk-iplc",
            kind: "relay",
            name: "香港 IPLC",
            host: "sz-iplc.relay.example",
            port: 31443,
            multiplier: 2,
            rules: [
              { days: weekdays, start: "19:00", end: "23:59", multiplier: 3 },
              { days: [0, 6], start: "00:00", end: "23:59", multiplier: 2.5 },
              { days: [5], start: "21:00", end: "23:59", multiplier: 3.5 },
            ],
            groups: ["高级线路"],
            egress: ["198.51.100.17", "198.51.100.18"],
            probe: "up",
            latencyMs: 12,
            hidden: false,
            enabled: true,
            users: 406,
          },
          { id: "e-hk-bgp", kind: "relay", name: "香港 BGP 中转", host: "gz-bgp.relay.example", port: 20443, multiplier: 1.5, rules: [], groups: ["高级线路"], egress: ["192.0.2.0/28"], probe: "down", latencyMs: null, hidden: true, enabled: true, users: 406 },
        ],
      },
      {
        id: "n-hk-hy2",
        name: "香港 01 · Hy2",
        protocol: "Hysteria 2",
        transport: "QUIC · TLS",
        port: 8443,
        status: "online",
        users: 1842,
        online: 74,
        blockRules: true,
        entrances: [{ id: "e-hk-hy2", kind: "direct", name: "香港 Hy2", host: "hk1.node.akari.example", port: 8443, multiplier: 1, rules: [], groups: ["基础线路", "高级线路"], egress: [], probe: "up", latencyMs: 41, hidden: false, enabled: true, users: 1842 }],
      },
    ],
  },
  {
    id: "s-jp1",
    name: "jp-iij-01",
    region: "日本",
    flag: "JP",
    ip: "198.51.100.71",
    agentVersion: "v0.5.0",
    online: true,
    cpu: 22,
    mem: 47,
    rateUp: 9.2,
    rateDown: 133.0,
    certDays: 74,
    quota: { mode: "up", limit: 4 * TiB, used: 4.02 * TiB, resetDay: 15 },
    alerts: 1,
    nodes: [
      {
        id: "n-jp-reality",
        name: "日本 01",
        protocol: "VLESS",
        transport: "REALITY · XHTTP",
        port: 443,
        status: "quota",
        users: 1531,
        online: 0,
        blockRules: false,
        entrances: [
          { id: "e-jp-direct", kind: "direct", name: "日本 直连", host: "jp1.node.akari.example", port: 443, multiplier: 1, rules: [], groups: ["基础线路", "高级线路"], egress: [], probe: "up", latencyMs: 61, hidden: false, enabled: true, users: 1531 },
          { id: "e-jp-iepl", kind: "relay", name: "日本 IEPL", host: "sh-iepl.relay.example", port: 40443, multiplier: 2, rules: [{ days: [0, 1, 2, 3, 4, 5, 6], start: "20:00", end: "23:00", multiplier: 2.5 }], groups: ["高级线路"], egress: ["203.0.113.200"], probe: "up", latencyMs: 29, hidden: false, enabled: true, users: 406 },
        ],
      },
    ],
  },
  {
    id: "s-sg1",
    name: "sg-dg-01",
    region: "新加坡",
    flag: "SG",
    ip: "192.0.2.88",
    agentVersion: "v0.4.2",
    online: false,
    cpu: 0,
    mem: 0,
    rateUp: 0,
    rateDown: 0,
    certDays: 12,
    quota: null,
    alerts: 2,
    nodes: [
      {
        id: "n-sg-trojan",
        name: "新加坡 01",
        protocol: "Trojan",
        transport: "WS · TLS",
        port: 443,
        status: "offline",
        users: 1531,
        online: 0,
        blockRules: false,
        entrances: [{ id: "e-sg-direct", kind: "direct", name: "新加坡 直连", host: "sg1.node.akari.example", port: 443, multiplier: 1, rules: [], groups: ["基础线路", "高级线路"], egress: [], probe: "down", latencyMs: null, hidden: true, enabled: true, users: 1531 }],
      },
    ],
  },
  {
    id: "s-us1",
    name: "us-lax-01",
    region: "美国",
    flag: "US",
    ip: "203.0.113.150",
    agentVersion: "v0.5.0",
    online: true,
    cpu: 9,
    mem: 33,
    rateUp: 2.1,
    rateDown: 28.7,
    certDays: 80,
    quota: { mode: "down", limit: 20 * TiB, used: 3.4 * TiB, resetDay: 1 },
    alerts: 0,
    nodes: [
      {
        id: "n-us-ss",
        name: "美国 01",
        protocol: "Shadowsocks 2022",
        transport: "TCP",
        port: 23456,
        status: "online",
        users: 1531,
        online: 41,
        blockRules: true,
        entrances: [{ id: "e-us-direct", kind: "direct", name: "美国 直连", host: "us1.node.akari.example", port: 23456, multiplier: 0.5, rules: [], groups: ["基础线路", "高级线路"], egress: [], probe: "up", latencyMs: 152, hidden: false, enabled: true, users: 1531 }],
      },
      {
        id: "n-us-vmess",
        name: "美国 01 · 备用",
        protocol: "VMess",
        transport: "WS · TLS",
        port: 2083,
        status: "disabled",
        users: 0,
        online: 0,
        blockRules: false,
        entrances: [{ id: "e-us-vmess", kind: "direct", name: "美国 备用", host: "us1.node.akari.example", port: 2083, multiplier: 1, rules: [], groups: [], egress: [], probe: "unknown", latencyMs: null, hidden: false, enabled: false, users: 0 }],
      },
    ],
  },
];

/* ---------------- Plans & node groups (D3, §5 permission) ---------------- */
export type NodeGroup = { id: string; name: string; entrances: string[]; plans: number };
export const nodeGroups: NodeGroup[] = [
  { id: "g-basic", name: "基础线路", entrances: ["e-hk-direct", "e-hk-hy2", "e-jp-direct", "e-sg-direct", "e-us-direct"], plans: 3 },
  { id: "g-premium", name: "高级线路", entrances: ["e-hk-direct", "e-hk-hy2", "e-hk-iplc", "e-hk-bgp", "e-jp-direct", "e-jp-iepl", "e-sg-direct", "e-us-direct"], plans: 1 },
];

export type Plan = {
  id: string;
  name: string;
  traffic: number;
  speedMbps: number | null;
  groups: string[];
  prices: { period: string; periodEn: string; cents: number }[];
  subscribers: number;
  capacity: number | null;
  onSale: boolean;
  resetMode: string;
};
export const plans: Plan[] = [
  { id: "p-entry", name: "入门 · 50G", traffic: 50 * GiB, speedMbps: 100, groups: ["基础线路"], prices: [{ period: "月付", periodEn: "Monthly", cents: 1500 }, { period: "季付", periodEn: "Quarterly", cents: 4000 }], subscribers: 1204, capacity: null, onSale: true, resetMode: "每月按订阅日" },
  { id: "p-std", name: "标准 · 200G", traffic: 200 * GiB, speedMbps: 300, groups: ["基础线路"], prices: [{ period: "月付", periodEn: "Monthly", cents: 2800 }, { period: "季付", periodEn: "Quarterly", cents: 7800 }, { period: "半年付", periodEn: "Half-yearly", cents: 14800 }, { period: "年付", periodEn: "Yearly", cents: 26800 }], subscribers: 1879, capacity: null, onSale: true, resetMode: "每月按订阅日" },
  { id: "p-pro", name: "高级 · IPLC 500G", traffic: 500 * GiB, speedMbps: null, groups: ["高级线路"], prices: [{ period: "季付", periodEn: "Quarterly", cents: 19800 }, { period: "年付", periodEn: "Yearly", cents: 68800 }], subscribers: 406, capacity: 500, onSale: true, resetMode: "每月按订阅日" },
  { id: "p-pack", name: "不限时 · 1T 流量包", traffic: 1 * TiB, speedMbps: null, groups: ["基础线路"], prices: [{ period: "一次性", periodEn: "One-time", cents: 9900 }], subscribers: 132, capacity: null, onSale: false, resetMode: "不重置" },
];

/* ---------------- Orders ---------------- */
export type Order = {
  id: string;
  no: string;
  user: string;
  plan: string;
  period: string;
  periodEn: string;
  listCents: number;
  discountCents: number;
  creditCents: number;
  balanceCents: number;
  amountCents: number;
  status: "paid" | "pending" | "expired" | "cancelled" | "refunded";
  via: "支付宝" | "余额" | "人工" | "抵扣" | "-";
  kind: "new" | "renew" | "switch" | "reset";
  createdAt: string;
  paidAt: string | null;
  fulfilError?: string;
  coupon?: string;
};
export const orders: Order[] = [
  { id: "o1", no: "AK20261004101233", user: "zhou.tian@gmail.com", plan: "高级 · IPLC 500G", period: "年付", periodEn: "Yearly", listCents: 68800, discountCents: 6880, creditCents: 4210, balanceCents: 0, amountCents: 57710, status: "paid", via: "支付宝", kind: "switch", createdAt: "2026-10-04 10:12", paidAt: "2026-10-04 10:13", coupon: "GUOQING10" },
  { id: "o2", no: "AK20261004094518", user: "sun.li@126.com", plan: "入门 · 50G", period: "月付", periodEn: "Monthly", listCents: 1500, discountCents: 0, creditCents: 0, balanceCents: 0, amountCents: 1500, status: "pending", via: "-", kind: "renew", createdAt: "2026-10-04 09:45", paidAt: null },
  { id: "o3", no: "AK20261004090102", user: "lin.xiaoyu@qq.com", plan: "标准 · 200G", period: "季付", periodEn: "Quarterly", listCents: 7800, discountCents: 0, creditCents: 0, balanceCents: 1250, amountCents: 6550, status: "paid", via: "支付宝", kind: "renew", createdAt: "2026-10-04 09:01", paidAt: "2026-10-04 09:02" },
  { id: "o4", no: "AK20261003231140", user: "chen_jing@163.com", plan: "入门 · 50G", period: "流量重置", periodEn: "Reset pack", listCents: 800, discountCents: 0, creditCents: 0, balanceCents: 300, amountCents: 500, status: "paid", via: "支付宝", kind: "reset", createdAt: "2026-10-03 23:11", paidAt: "2026-10-03 23:12", fulfilError: "plan.capacity_full：套餐库存已满，需人工处理" },
  { id: "o5", no: "AK20261003204409", user: "huang.lei@proton.me", plan: "标准 · 200G", period: "年付", periodEn: "Yearly", listCents: 26800, discountCents: 0, creditCents: 0, balanceCents: 26800, amountCents: 0, status: "paid", via: "余额", kind: "renew", createdAt: "2026-10-03 20:44", paidAt: "2026-10-03 20:44" },
  { id: "o6", no: "AK20261003181530", user: "wang.hao@outlook.com", plan: "标准 · 200G", period: "月付", periodEn: "Monthly", listCents: 2800, discountCents: 0, creditCents: 0, balanceCents: 0, amountCents: 2800, status: "expired", via: "-", kind: "renew", createdAt: "2026-10-03 18:15", paidAt: null },
  { id: "o7", no: "AK20261003120007", user: "xu.qing@163.com", plan: "不限时 · 1T 流量包", period: "一次性", periodEn: "One-time", listCents: 9900, discountCents: 0, creditCents: 0, balanceCents: 0, amountCents: 0, status: "paid", via: "人工", kind: "new", createdAt: "2026-10-03 12:00", paidAt: "2026-10-03 12:00" },
  { id: "o8", no: "AK20261002215812", user: "he.xin@gmail.com", plan: "入门 · 50G", period: "季付", periodEn: "Quarterly", listCents: 4000, discountCents: 0, creditCents: 0, balanceCents: 0, amountCents: 4000, status: "refunded", via: "支付宝", kind: "new", createdAt: "2026-10-02 21:58", paidAt: "2026-10-02 21:59" },
  { id: "o9", no: "AK20261002103321", user: "zhangwei.dev@gmail.com", plan: "高级 · IPLC 500G", period: "季付", periodEn: "Quarterly", listCents: 19800, discountCents: 0, creditCents: 0, balanceCents: 0, amountCents: 19800, status: "cancelled", via: "-", kind: "renew", createdAt: "2026-10-02 10:33", paidAt: null },
  { id: "o10", no: "AK20261001084455", user: "zhou.tian@gmail.com", plan: "高级 · IPLC 500G", period: "季付", periodEn: "Quarterly", listCents: 19800, discountCents: 0, creditCents: 0, balanceCents: 0, amountCents: 19800, status: "paid", via: "支付宝", kind: "new", createdAt: "2026-10-01 08:44", paidAt: "2026-10-01 08:45" },
];

/* ---------------- Dashboard ---------------- */
export const dashboard = {
  revenue: { today: 218_400, d7: 1_382_900, d30: 5_106_300, refunds30: 12_800, trend: [62, 71, 58, 80, 93, 77, 88, 95, 102, 84, 99, 110, 121, 118] },
  users: { total: 4826, new7: 143, activeSubs: 3621, online: 431 },
  nodes: { online: 6, offline: 1, quota: 1, disabled: 1, pending: 0, entrancesDown: 2 },
  todo: { tickets: 7, withdrawals: 2, mailFailed: 1, fulfilErrors: 1 },
  traffic14: [8.1, 9.4, 8.8, 10.2, 11.9, 12.4, 10.7, 9.9, 11.3, 12.8, 13.6, 12.1, 14.2, 15.0],
};

/* ---------------- System status (W31) ---------------- */
export const systemStatus = {
  host: { cpu: 23, load: [0.82, 0.71, 0.66], mem: { used: 3.1 * GiB, total: 8 * GiB }, disk: { used: 41.2 * GiB, total: 120 * GiB }, uptime: "21 天 4 小时" },
  services: [
    { name: "PostgreSQL 18.1", kind: "db", ok: true, detail: "连接 24 / 100 · 复制无 · 库大小 3.8 GiB", detailEn: "24/100 connections · 3.8 GiB" },
    { name: "Valkey 9.0.1", kind: "cache", ok: true, detail: "内存 212 MiB · 命中率 99.2%", detailEn: "212 MiB · 99.2% hit rate" },
    { name: "Caddy 2.10", kind: "proxy", ok: true, detail: "证书 6 张 · 最早到期 61 天后", detailEn: "6 certificates · next expiry in 61 days" },
  ],
  instances: [
    { id: "panel-a", host: "panel-01", version: "v0.4.0 (3f9c2a1)", uptime: "3 天", sessions: 4, ok: true, leader: ["告警评估", "流量压缩"] },
    { id: "panel-b", host: "panel-02", version: "v0.4.0 (3f9c2a1)", uptime: "3 天", sessions: 2, ok: true, leader: ["对账"] },
  ],
  jobs: [
    { name: "流量结算 flush", nameEn: "Traffic flush", last: "3 秒前", every: "10s", status: "ok", note: "上批 1,284 行 · 41 ms" },
    { name: "流量明细压缩", nameEn: "History compaction", last: "12 秒前", every: "30s", status: "ok", note: "暂存 3,920 行" },
    { name: "支付对账", nameEn: "Payment reconcile", last: "6 秒前", every: "10s", status: "ok", note: "待付订单 3" },
    { name: "邮件发件箱", nameEn: "Mail outbox", last: "20 秒前", every: "持续", status: "warn", note: "队列 2 · 死信 1" },
    { name: "节点告警评估", nameEn: "Alert evaluation", last: "18 秒前", every: "30s", status: "ok", note: "firing 4" },
    { name: "入口 TCP 探测", nameEn: "Entrance probes", last: "40 秒前", every: "60s", status: "warn", note: "2 个入口失败，已从订阅隐藏" },
    { name: "账号清理（D10）", nameEn: "Account cleanup (D10)", last: "—", every: "每日 04:00", status: "off", note: "未开启" },
  ],
};

/* ---------------- Settings ---------------- */
export type Domain = { name: string; preferred: boolean; cf: "grey" | "orange" | "none"; cert: "ok" | "pending" | "error"; usedBy: string[] };
export const domains: Record<"main" | "sub" | "node", Domain[]> = {
  main: [
    { name: "akari.example", preferred: true, cf: "orange", cert: "ok", usedBy: ["门户与后台", "邮件中的链接（12 个模板）", "支付回调（支付宝 · 当面付）", "节点安装命令"] },
    { name: "www.akari.example", preferred: false, cf: "orange", cert: "ok", usedBy: ["门户与后台（备用访问）"] },
  ],
  sub: [
    { name: "sub.akari-cdn.example", preferred: true, cf: "orange", cert: "ok", usedBy: ["3,402 个用户的订阅链接", "客户端一键导入链接"] },
    { name: "s2.akari-cdn.example", preferred: false, cf: "orange", cert: "ok", usedBy: ["218 个用户被随机分配到此域名"] },
  ],
  node: [
    { name: "grpc.akari.example", preferred: true, cf: "grey", cert: "ok", usedBy: ["5 个 agent 当前连接", "新节点安装令牌"] },
    { name: "ctl.akari.example", preferred: false, cf: "grey", cert: "ok", usedBy: ["1 个 agent（sg-dg-01）的 bootstrap 配置"] },
  ],
};

export const blockRuleSets = [
  { id: "bittorrent", name: "BitTorrent 协议识别", nameEn: "BitTorrent protocol", kind: "protocol", builtin: true, enabled: true, hits: 18_342, rules: 1 },
  { id: "bt_tracker", name: "BT Tracker 域名", nameEn: "BT tracker domains", kind: "domain", builtin: true, enabled: true, hits: 4_105, rules: 286 },
  { id: "xunlei_pt", name: "迅雷 / PT 站域名", nameEn: "Xunlei / PT domains", kind: "domain", builtin: true, enabled: false, hits: 0, rules: 142 },
  { id: "custom-1", name: "自定义：挖矿池", nameEn: "Custom: mining pools", kind: "domain", builtin: false, enabled: true, hits: 37, rules: 18 },
];

export const ruleTemplates = [
  { id: "t-default", name: "国内直连 · 国外代理 · 广告拦截", isDefault: true, rules: 7, updatedAt: "2026-09-30" },
  { id: "t-global", name: "全局代理（保留局域网直连）", isDefault: false, rules: 3, updatedAt: "2026-09-12" },
  { id: "t-stream", name: "流媒体分流（Netflix / Disney+ 走日本）", isDefault: false, rules: 11, updatedAt: "2026-08-21" },
];

export const templateRules = [
  { type: "geosite", value: "category-ads-all", action: "REJECT" },
  { type: "geosite", value: "private", action: "DIRECT" },
  { type: "geoip", value: "private", action: "DIRECT" },
  { type: "geosite", value: "cn", action: "DIRECT" },
  { type: "geoip", value: "cn", action: "DIRECT" },
  { type: "geosite", value: "geolocation-!cn", action: "PROXY" },
  { type: "match", value: "*", action: "PROXY" },
];
