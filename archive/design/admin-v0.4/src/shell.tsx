import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "./lib/cn";
import { useTr } from "./lib/i18n";
import { allNav, nav } from "./lib/nav";
import { navigate, setParams, useParam, type PageId } from "./lib/route";
import { users } from "./mock/data";
import { Icon, type IconName } from "./ui/icons";
import { MenuItem, Popover } from "./ui/overlays";
import { Badge, Button, Kbd } from "./ui/primitives";

export type ShellProps = {
  page: PageId;
  theme: "light" | "dark";
  onTheme: () => void;
  lang: "zh" | "en";
  onLang: () => void;
  children: ReactNode;
};

function readCollapsed() {
  try {
    return localStorage.getItem("akari.sidebar") === "collapsed";
  } catch {
    return false;
  }
}

export function Shell({ page, theme, onTheme, lang, onLang, children }: ShellProps) {
  const tr = useTr();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileNav, setMobileNav] = useState(false);
  const demo = useParam("demo");
  const [palette, setPalette] = useState(demo === "palette");
  const [userMenu, setUserMenu] = useState(false);

  useEffect(() => setPalette(demo === "palette"), [demo]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("akari.sidebar", collapsed ? "collapsed" : "expanded");
    } catch {
      /* private mode */
    }
  }, [collapsed]);

  const current = allNav.find((n) => n.id === page);

  const sidebar = (mobile: boolean) => (
    <nav className="flex h-full flex-col">
      <div className={cn("flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4", collapsed && !mobile && "justify-center px-0")}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">A</div>
        {(!collapsed || mobile) && (
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">Akari</div>
            <div className="text-[11px] leading-tight text-muted-foreground">{tr("管理后台", "Admin console")}</div>
          </div>
        )}
        {mobile && <Button variant="ghost" size="icon-sm" icon="x" className="ml-auto" onClick={() => setMobileNav(false)} aria-label="close" />}
      </div>
      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {nav.map((g) => (
          <div key={g.zh}>
            {(!collapsed || mobile) && <div className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{tr(g.zh, g.en)}</div>}
            {collapsed && !mobile && <div className="mx-auto mb-1 h-px w-6 bg-border" />}
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = it.id === page;
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      title={collapsed && !mobile ? tr(it.zh, it.en) : undefined}
                      onClick={() => {
                        navigate(it.id);
                        setMobileNav(false);
                      }}
                      className={cn(
                        "relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
                        active ? "bg-sidebar-accent font-medium text-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                        collapsed && !mobile && "justify-center px-0",
                      )}
                    >
                      {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />}
                      <Icon name={it.icon} size={16} className={active ? "text-primary" : "text-muted-foreground"} />
                      {(!collapsed || mobile) && (
                        <>
                          <span className="flex-1 truncate text-left">{tr(it.zh, it.en)}</span>
                          {it.badge ? (
                            <span className="rounded-full bg-destructive-soft px-1.5 text-[11px] font-medium text-destructive">{it.badge}</span>
                          ) : it.placeholder ? (
                            <span className="text-[10px] text-muted-foreground/70">W33-b</span>
                          ) : null}
                        </>
                      )}
                      {collapsed && !mobile && it.badge ? <span className="absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full bg-destructive" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {!mobile && (
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className={cn("flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-sidebar-accent/60", collapsed && "justify-center px-0")}
          >
            <Icon name="panel" size={16} />
            {!collapsed && tr("收起侧边栏", "Collapse sidebar")}
          </button>
        </div>
      )}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* desktop sidebar: outer column stretches (full-height surface), inner nav sticks */}
      <aside className={cn("z-20 hidden shrink-0 border-r border-border bg-sidebar transition-[width] lg:block", collapsed ? "w-16" : "w-60")}>
        <div className="sticky top-0 h-screen">{sidebar(false)}</div>
      </aside>
      {/* mobile / tablet sidebar */}
      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileNav(false)} />
          <aside className="anim-in absolute inset-y-0 left-0 w-72 border-r border-border bg-sidebar shadow-pop">{sidebar(true)}</aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur sm:px-5">
          <Button variant="ghost" size="icon-sm" icon="menu" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label={tr("菜单", "Menu")} />
          <div className="hidden min-w-0 items-center gap-1.5 text-sm text-muted-foreground sm:flex">
            <span>Akari</span>
            <Icon name="chevronRight" size={14} />
            <span className="truncate font-medium text-foreground">{current ? tr(current.zh, current.en) : ""}</span>
          </div>
          <span className="truncate text-sm font-medium sm:hidden">{current ? tr(current.zh, current.en) : ""}</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="hidden h-8 w-64 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-[13px] text-muted-foreground shadow-card hover:bg-muted md:flex"
          >
            <Icon name="search" size={14} />
            <span className="flex-1 text-left">{tr("搜索用户、订单、节点…", "Search users, orders, nodes…")}</span>
            <Kbd>Ctrl K</Kbd>
          </button>
          <Button variant="ghost" size="icon-sm" icon="search" className="md:hidden" onClick={() => setPalette(true)} aria-label={tr("搜索", "Search")} />
          <Button variant="ghost" size="icon-sm" icon="languages" onClick={onLang} aria-label="language" title={lang === "zh" ? "English" : "中文"} />
          <Button variant="ghost" size="icon-sm" icon={theme === "dark" ? "sun" : "moon"} onClick={onTheme} aria-label={tr("切换主题", "Toggle theme")} />
          <div className="relative">
            <Button variant="ghost" size="icon-sm" icon="bell" onClick={() => navigate("alerts")} aria-label={tr("告警", "Alerts")} />
            <span className="pointer-events-none absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
          </div>
          <div className="relative">
            <button type="button" onClick={() => setUserMenu((v) => !v)} className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
              OP
            </button>
            <Popover open={userMenu} onClose={() => setUserMenu(false)}>
              <div className="px-2.5 py-2">
                <div className="text-[13px] font-medium">ops@akari.example</div>
                <div className="text-xs text-muted-foreground">{tr("管理员 · 通行密钥登录", "Admin · signed in with passkey")}</div>
              </div>
              <div className="my-1 h-px bg-border" />
              <MenuItem icon="fingerprint" onClick={() => navigate("account")}>
                {tr("通行密钥与密码", "Passkeys & password")}
              </MenuItem>
              <MenuItem icon="logout" danger onClick={() => navigate("login")}>
                {tr("退出登录", "Sign out")}
              </MenuItem>
            </Popover>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
      {palette && <CommandPalette onClose={() => (demo === "palette" ? setParams({ demo: null }, true) : setPalette(false))} onTheme={onTheme} />}
    </div>
  );
}

/* ---------------- Command palette (Ctrl+K) ---------------- */
type Cmd = { id: string; group: string; label: string; hint?: string; icon: IconName; run: () => void };

function CommandPalette({ onClose, onTheme }: { onClose: () => void; onTheme: () => void }) {
  const tr = useTr();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const all = useMemo<Cmd[]>(() => {
    const go = (p: PageId, extra?: Record<string, string>) => () => {
      navigate(p);
      if (extra) setParams(extra, true);
      onClose();
    };
    return [
      ...allNav.map((n) => ({ id: `p-${n.id}`, group: tr("页面", "Pages"), label: tr(n.zh, n.en), icon: n.icon, run: go(n.id) })),
      { id: "a-user", group: tr("操作", "Actions"), label: tr("新建用户（分配套餐）", "New user (assign plan)"), icon: "plus", hint: "N U", run: go("users", { demo: "new-user" }) },
      { id: "a-node", group: tr("操作", "Actions"), label: tr("添加落地节点", "Add landing node"), icon: "server", run: go("nodes") },
      { id: "a-entrance", group: tr("操作", "Actions"), label: tr("添加中转入口", "Add relay entrance"), icon: "route", run: go("nodes", { open: "e-hk-iplc" }) },
      { id: "a-cleanup", group: tr("操作", "Actions"), label: tr("筛选从未使用的账号", "Filter never-used accounts"), icon: "filter", run: go("users", { filter: "never" }) },
      { id: "a-mail", group: tr("操作", "Actions"), label: tr("测试发信", "Send test mail"), icon: "mail", run: go("settings", { tab: "mail" }) },
      { id: "a-theme", group: tr("操作", "Actions"), label: tr("切换深色 / 浅色", "Toggle dark / light"), icon: "moon", run: () => (onTheme(), onClose()) },
      ...users.slice(0, 8).map((u) => ({ id: `u-${u.id}`, group: tr("用户", "Users"), label: u.email, hint: u.sub?.plan ?? tr("无套餐", "No plan"), icon: "user" as IconName, run: go("users", { open: u.id }) })),
      { id: "o-1", group: tr("订单", "Orders"), label: "AK20261004101233", hint: "¥577.10", icon: "receipt", run: go("orders", { open: "o1" }) },
    ];
  }, [tr, onClose, onTheme]);

  const list = q.trim() ? all.filter((c) => (c.label + (c.hint ?? "")).toLowerCase().includes(q.trim().toLowerCase())) : all.filter((c) => !c.id.startsWith("u-")).concat(all.filter((c) => c.id.startsWith("u-")).slice(0, 4));
  const groups = [...new Set(list.map((c) => c.group))];
  useEffect(() => setIdx(0), [q]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-[10vh]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="anim-in relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-pop">
        <div className="flex items-center gap-2 border-b border-border px-3.5">
          <Icon name="search" size={16} className="text-muted-foreground" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setIdx((i) => Math.min(list.length - 1, i + 1)));
              if (e.key === "ArrowUp") (e.preventDefault(), setIdx((i) => Math.max(0, i - 1)));
              if (e.key === "Enter") list[idx]?.run();
              if (e.key === "Escape") onClose();
            }}
            placeholder={tr("输入页面、操作、邮箱或订单号…", "Type a page, action, email or order no…")}
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="scroll-thin max-h-[60vh] overflow-y-auto p-1.5">
          {list.length === 0 && <div className="px-3 py-8 text-center text-sm text-muted-foreground">{tr("没有结果", "No results")}</div>}
          {groups.map((g) => (
            <div key={g} className="pb-1">
              <div className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{g}</div>
              {list
                .filter((c) => c.group === g)
                .map((c) => {
                  const i = list.indexOf(c);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onMouseEnter={() => setIdx(i)}
                      onClick={c.run}
                      className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px]", i === idx && "bg-muted")}
                    >
                      <Icon name={c.icon} size={15} className="text-muted-foreground" />
                      <span className="flex-1 truncate">{c.label}</span>
                      {c.hint && <span className="text-xs text-muted-foreground">{c.hint}</span>}
                      {i === idx && <Icon name="chevronRight" size={14} className="text-muted-foreground" />}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-border bg-subtle px-3.5 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> {tr("选择", "navigate")}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Enter</Kbd> {tr("打开", "open")}
          </span>
          <span className="ml-auto">
            <Badge tone="outline">{tr("仅本地 mock 数据", "Local mock data only")}</Badge>
          </span>
        </div>
      </div>
    </div>
  );
}
