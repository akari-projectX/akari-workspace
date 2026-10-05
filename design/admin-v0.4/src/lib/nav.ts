import type { IconName } from "../ui/icons";
import type { PageId } from "./route";

export type NavItem = { id: PageId; zh: string; en: string; icon: IconName; badge?: number; placeholder?: boolean };
export type NavGroup = { zh: string; en: string; items: NavItem[] };

/* Sidebar groups. Items marked `placeholder` keep their current function and
 * are migrated as-is in W33-b; W33-a only designs the shell around them. */
export const nav: NavGroup[] = [
  {
    zh: "概览",
    en: "Overview",
    items: [
      { id: "dashboard", zh: "仪表盘", en: "Dashboard", icon: "dashboard" },
      { id: "status", zh: "系统状态", en: "System status", icon: "activity" },
    ],
  },
  {
    zh: "运营",
    en: "Operations",
    items: [
      { id: "users", zh: "用户", en: "Users", icon: "users" },
      { id: "orders", zh: "订单", en: "Orders", icon: "receipt", badge: 1 },
      { id: "coupons", zh: "优惠券", en: "Coupons", icon: "tag", placeholder: true },
      { id: "finance", zh: "资金", en: "Finance", icon: "wallet", placeholder: true, badge: 2 },
      { id: "tickets", zh: "工单", en: "Tickets", icon: "ticket", placeholder: true, badge: 7 },
      { id: "content", zh: "内容", en: "Content", icon: "file", placeholder: true },
    ],
  },
  {
    zh: "资源",
    en: "Resources",
    items: [
      { id: "nodes", zh: "节点", en: "Nodes", icon: "server", badge: 4 },
      { id: "plans", zh: "套餐", en: "Plans", icon: "layers" },
      { id: "alerts", zh: "告警", en: "Alerts", icon: "bell", placeholder: true },
      { id: "updates", zh: "更新", en: "Updates", icon: "download", placeholder: true },
    ],
  },
  {
    zh: "系统",
    en: "System",
    items: [
      { id: "settings", zh: "系统设置", en: "Settings", icon: "settings" },
      { id: "audit", zh: "审计日志", en: "Audit log", icon: "history", placeholder: true },
      { id: "account", zh: "我的账户", en: "My account", icon: "user", placeholder: true },
    ],
  },
];

export const allNav = nav.flatMap((g) => g.items);
