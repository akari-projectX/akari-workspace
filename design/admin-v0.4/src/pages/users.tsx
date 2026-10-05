import { useEffect, useMemo, useState } from "react";
import { useTr } from "../lib/i18n";
import { bytes, pct, yuan } from "../lib/format";
import { setParams, useParam, useViewState } from "../lib/route";
import { plans, users, usersTotal, type User } from "../mock/data";
import { Icon } from "../ui/icons";
import { Dialog, Drawer, MenuItem, Popover, useConfirm, useToast } from "../ui/overlays";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Checkbox, EmptyState, Field, Input, KV, PageHeader, Progress, Segmented, Select, Textarea, usageTone, type Tone } from "../ui/primitives";
import { DataTable, FilterChip, Pager, type Column } from "../ui/table";

export function statusBadge(u: User, tr: (a: string, b: string) => string) {
  const map: Record<User["status"], [Tone, string, string]> = {
    active: ["success", "正常", "Active"],
    expired: ["warning", "已到期", "Expired"],
    quota: ["warning", "流量用尽", "Out of traffic"],
    banned: ["danger", "已封禁", "Banned"],
    no_plan: ["neutral", "无套餐", "No plan"],
  };
  const [tone, zh, en] = map[u.status];
  return (
    <Badge tone={tone} dot>
      {tr(zh, en)}
    </Badge>
  );
}

export function UsersPage() {
  const tr = useTr();
  const state = useViewState();
  const confirm = useConfirm();
  const toast = useToast();
  const openId = useParam("open");
  const demo = useParam("demo");
  const filterParam = useParam("filter");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [neverUsed, setNeverUsed] = useState(filterParam === "never");
  const [regBefore, setRegBefore] = useState(filterParam === "never" ? "2026-09-04" : "");
  const [loginBefore, setLoginBefore] = useState("");
  const [more, setMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [banFor, setBanFor] = useState<User | null>(null);
  const [planFor, setPlanFor] = useState<{ user: User | null; mode: "assign" | "change" | "extend" } | null>(demo === "new-user" ? { user: null, mode: "assign" } : null);

  useEffect(() => {
    if (filterParam === "never") {
      setNeverUsed(true);
      setRegBefore("2026-09-04");
    }
  }, [filterParam]);

  const rows = useMemo(
    () =>
      users.filter((u) => {
        if (q && !u.email.includes(q.toLowerCase()) && !u.id.includes(q.toLowerCase())) return false;
        if (status !== "all" && u.status !== status) return false;
        if (plan !== "all" && (plan === "none" ? u.sub !== null : u.sub?.plan !== plan)) return false;
        if (neverUsed && !u.neverUsed) return false;
        if (regBefore && u.registeredAt >= regBefore) return false;
        if (loginBefore && u.lastLoginAt && u.lastLoginAt >= loginBefore) return false;
        return true;
      }),
    [q, status, plan, neverUsed, regBefore, loginBefore],
  );

  useEffect(() => {
    if (demo === "bulk-delete") {
      const ids = rows.filter((u) => u.role !== "admin").map((u) => u.id);
      setSelected(new Set(ids));
      openBulkDelete(ids.length, true);
    }
    if (demo === "ban") setBanFor(users.find((u) => u.id === openId) ?? users[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  const open = users.find((u) => u.id === openId) ?? null;

  function openBulkDelete(count: number, never: boolean) {
    const shown = never ? 46 : count;
    confirm({
      title: tr("删除账户", "Delete accounts"),
      impact: tr(`将永久删除 ${shown} 个账户`, `${shown} accounts will be permanently deleted`),
      description: tr("删除方式与用户自助注销相同：删除个人数据；有财务记录的账户匿名化保留。管理员账户与有任何财务记录的账户不会出现在“从未使用”中。", "Same as self-service deletion: personal data is removed; accounts with financial records are anonymised. Admins and accounts with any financial record never match “never used”."),
      details: never ? (
        <div className="rounded-md border border-border bg-subtle px-3 py-2 text-xs text-muted-foreground">
          {tr("筛选：从未使用 · 注册早于 2026-09-04（30 天）。列表当前页显示 3 个，筛选总数 46 个，全部会被删除。", "Filter: never used · registered before 2026-09-04 (30 days). 3 shown on this page; all 46 matching accounts will be deleted.")}
        </div>
      ) : undefined,
      confirmLabel: tr(`删除 ${shown} 个账户`, `Delete ${shown} accounts`),
      typeToConfirm: tr(`删除 ${shown} 个账户`, `delete ${shown}`),
      onConfirm: () => {
        setSelected(new Set());
        toast({ tone: "success", title: tr(`已创建批量任务：删除 ${shown} 个账户`, `Batch job created: delete ${shown} accounts`), description: tr("可在“批量任务”中查看进度；每个账户单独写审计。", "Track it under batch jobs; each account gets its own audit entry.") });
      },
    });
  }

  const columns: Column<User>[] = [
    {
      key: "email",
      header: tr("邮箱", "Email"),
      fixed: true,
      mobile: "title",
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold uppercase text-muted-foreground">{u.email[0]}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate font-medium">
              {u.email}
              {u.role === "admin" && <Badge tone="primary">{tr("管理员", "Admin")}</Badge>}
            </div>
            {!u.verified && <div className="text-[11px] text-muted-foreground">{tr("邮箱未验证", "Email not verified")}</div>}
          </div>
        </div>
      ),
    },
    { key: "status", header: tr("状态", "Status"), cell: (u) => statusBadge(u, tr) },
    { key: "plan", header: tr("套餐", "Plan"), cell: (u) => (u.sub ? <span>{u.sub.plan}</span> : <span className="text-muted-foreground">—</span>) },
    {
      key: "traffic",
      header: tr("流量", "Traffic"),
      mobile: "hide",
      cell: (u) =>
        u.sub ? (
          <div className="w-36">
            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>{bytes(u.sub.used)}</span>
              <span>{bytes(u.sub.total)}</span>
            </div>
            <Progress value={pct(u.sub.used, u.sub.total)} tone={usageTone(pct(u.sub.used, u.sub.total))} />
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: "expires", header: tr("到期", "Expires"), cell: (u) => <span className="tabular-nums">{u.sub ? u.sub.expiresAt.slice(0, 10) : "—"}</span> },
    { key: "balance", header: tr("余额", "Balance"), optional: true, align: "right", cell: (u) => <span className="tabular-nums">{yuan(u.balanceCents)}</span> },
    { key: "online", header: tr("在线设备", "Online"), optional: true, align: "right", cell: (u) => <span className="tabular-nums">{u.online}</span> },
    { key: "passkeys", header: tr("通行密钥", "Passkeys"), optional: true, cell: (u) => (u.passkeys ? <Badge tone="outline">{u.passkeys}</Badge> : <span className="text-muted-foreground">—</span>) },
    { key: "registered", header: tr("注册时间", "Registered"), cell: (u) => <span className="tabular-nums text-muted-foreground">{u.registeredAt}</span> },
    { key: "login", header: tr("最后登录", "Last login"), cell: (u) => <span className="tabular-nums text-muted-foreground">{u.lastLoginAt ?? tr("从未", "Never")}</span> },
  ];

  const activeFilters = [
    neverUsed && { label: tr("从未使用", "Never used"), value: tr("是", "yes"), clear: () => setNeverUsed(false) },
    regBefore && { label: tr("注册早于", "Registered before"), value: regBefore, clear: () => setRegBefore("") },
    loginBefore && { label: tr("最后登录早于", "Last login before"), value: loginBefore, clear: () => setLoginBefore("") },
  ].filter(Boolean) as { label: string; value: string; clear: () => void }[];

  return (
    <>
      <PageHeader
        title={tr("用户", "Users")}
        description={tr("流量与到期时间只能通过套餐调整（D12）；节点权限由套餐决定（D3）。", "Traffic and expiry change only through plans (D12); node access comes from plans (D3).")}
        actions={
          <>
            <Button size="sm" icon="download">
              {tr("导出 CSV", "Export CSV")}
            </Button>
            <Button size="sm" variant="primary" icon="plus" onClick={() => setPlanFor({ user: null, mode: "assign" })}>
              {tr("新建用户", "New user")}
            </Button>
          </>
        }
      />

      <DataTable
        rows={rows}
        columns={columns}
        state={state}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        activeId={openId}
        onRowClick={(u) => setParams({ open: u.id })}
        toolbar={
          <>
            <div className="relative w-full sm:w-64">
              <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 pl-8" placeholder={tr("邮箱或 ID 前缀", "Email or ID prefix")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select className="w-32" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">{tr("全部状态", "All statuses")}</option>
              <option value="active">{tr("正常", "Active")}</option>
              <option value="expired">{tr("已到期", "Expired")}</option>
              <option value="quota">{tr("流量用尽", "Out of traffic")}</option>
              <option value="banned">{tr("已封禁", "Banned")}</option>
              <option value="no_plan">{tr("无套餐", "No plan")}</option>
            </Select>
            <Select className="w-40" value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="all">{tr("全部套餐", "All plans")}</option>
              {plans.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
              <option value="none">{tr("无套餐", "No plan")}</option>
            </Select>
            <div className="relative">
              <Button size="sm" icon="filter" onClick={() => setMore((v) => !v)}>
                {tr("更多筛选", "More filters")}
                {activeFilters.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{activeFilters.length}</span>}
              </Button>
              <Popover open={more} onClose={() => setMore(false)} align="left" className="w-72 p-3">
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <Checkbox checked={neverUsed} onChange={setNeverUsed} />
                    <span>
                      <span className="block text-[13px] font-medium">{tr("从未使用", "Never used")}</span>
                      <span className="block text-xs text-muted-foreground">{tr("没有过套餐、付款、流量、余额和工单（D10）", "No plan, payment, traffic, balance or ticket ever (D10)")}</span>
                    </span>
                  </label>
                  <Field label={tr("注册早于", "Registered before")}>
                    <Input type="date" className="h-8" value={regBefore} onChange={(e) => setRegBefore(e.target.value)} />
                  </Field>
                  <Field label={tr("最后登录早于", "Last login before")}>
                    <Input type="date" className="h-8" value={loginBefore} onChange={(e) => setLoginBefore(e.target.value)} />
                  </Field>
                </div>
              </Popover>
            </div>
            {activeFilters.map((f) => (
              <FilterChip key={f.label} label={f.label} value={f.value} onClear={f.clear} />
            ))}
          </>
        }
        bulkActions={(n) => (
          <>
            <Button size="sm" icon="layers" onClick={() => setPlanFor({ user: null, mode: "extend" })}>
              {tr("分配套餐 / 延长", "Assign / extend")}
            </Button>
            <Button size="sm" icon="mail">
              {tr("发邮件", "Email")}
            </Button>
            <Button size="sm" icon="ban" onClick={() => toast({ tone: "info", title: tr(`封禁 ${n} 个账户需要填写原因`, `Banning ${n} accounts needs a reason`) })}>
              {tr("封禁", "Ban")}
            </Button>
            <Button size="sm" variant="destructive" icon="trash" onClick={() => openBulkDelete(n, neverUsed)}>
              {neverUsed ? tr("删除全部 46 个匹配", "Delete all 46 matching") : tr(`删除 ${n} 个`, `Delete ${n}`)}
            </Button>
          </>
        )}
        empty={
          <EmptyState
            icon="users"
            title={tr("没有匹配的用户", "No matching users")}
            description={tr("试试清除“从未使用”或日期筛选。", "Try clearing “never used” or the date filters.")}
            action={
              <Button size="sm" onClick={() => (setNeverUsed(false), setRegBefore(""), setLoginBefore(""), setStatus("all"), setPlan("all"), setQ(""))}>
                {tr("清除筛选", "Clear filters")}
              </Button>
            }
          />
        }
        footer={<Pager total={neverUsed ? 46 : usersTotal} />}
      />

      <UserDrawer
        user={open}
        onClose={() => setParams({ open: null, demo: null })}
        onBan={(u) => setBanFor(u)}
        onPlan={(u, mode) => setPlanFor({ user: u, mode })}
      />
      <BanDialog user={banFor} onClose={() => (setBanFor(null), demo === "ban" && setParams({ demo: null }, true))} />
      <PlanDialog target={planFor} selected={selected.size} onClose={() => (setPlanFor(null), demo === "new-user" && setParams({ demo: null }, true))} />
    </>
  );
}

/* ---------------- Drawer ---------------- */
function UserDrawer({ user, onClose, onBan, onPlan }: { user: User | null; onClose: () => void; onBan: (u: User) => void; onPlan: (u: User, mode: "assign" | "change" | "extend") => void }) {
  const tr = useTr();
  const confirm = useConfirm();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  if (!user) return null;
  const s = user.sub;
  const p = s ? pct(s.used, s.total) : 0;

  return (
    <Drawer
      open
      onClose={onClose}
      title={user.email}
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          {statusBadge(user, tr)}
          {user.verified ? <Badge tone="outline">{tr("邮箱已验证", "Verified")}</Badge> : <Badge tone="warning">{tr("邮箱未验证", "Not verified")}</Badge>}
          <span className="font-mono">{user.id}</span>
        </span>
      }
      actions={
        <div className="relative">
          <Button variant="ghost" size="icon-sm" icon="more" onClick={() => setMenu((v) => !v)} aria-label="more" />
          <Popover open={menu} onClose={() => setMenu(false)}>
            <MenuItem icon="link" onClick={() => (setMenu(false), toast({ tone: "success", title: tr("已重置订阅链接", "Subscription link reset"), description: tr("旧链接立即失效，已写入审计。", "The old link stops working now; audited.") }))}>
              {tr("重置订阅链接", "Reset subscription link")}
            </MenuItem>
            <MenuItem icon="mail">{tr("发送邮件", "Send email")}</MenuItem>
            <MenuItem icon="history">{tr("查看审计记录", "View audit trail")}</MenuItem>
            <div className="my-1 h-px bg-border" />
            <MenuItem
              icon="trash"
              danger
              onClick={() => {
                setMenu(false);
                confirm({
                  title: tr("删除账户", "Delete account"),
                  impact: tr(`将删除 1 个账户：${user.email}`, `1 account will be deleted: ${user.email}`),
                  description: tr("该账户有 3 笔已付款订单：个人数据删除，订单匿名化保留。", "This account has 3 paid orders: personal data is removed, orders are anonymised."),
                  confirmLabel: tr("删除账户", "Delete account"),
                  typeToConfirm: user.email,
                });
              }}
            >
              {tr("删除账户", "Delete account")}
            </MenuItem>
          </Popover>
        </div>
      }
      footer={
        user.status === "banned" ? (
          <Button icon="check" onClick={() => toast({ tone: "success", title: tr("已解除封禁", "Unbanned") })}>
            {tr("解除封禁", "Unban")}
          </Button>
        ) : (
          <Button variant="destructive-soft" icon="ban" onClick={() => onBan(user)} disabled={user.role === "admin"}>
            {tr("封禁用户", "Ban user")}
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {user.status === "banned" && (
          <Callout tone="danger" title={tr("已封禁（2026-09-30 08:15，操作人 ops@akari.example）", "Banned (2026-09-30 08:15 by ops@akari.example)")}>
            {tr("原因（用户门户可见）：", "Reason (shown in the portal): ")}
            {user.banReason}
          </Callout>
        )}

        <Card>
          <CardHeader
            title={tr("当前订阅", "Current subscription")}
            actions={s ? <Badge tone={s.status === "active" ? "success" : "warning"}>{s.status === "active" ? tr("生效中", "Active") : s.status === "quota" ? tr("流量用尽", "Out of traffic") : tr("已到期", "Expired")}</Badge> : undefined}
          />
          {s ? (
            <CardBody className="space-y-4">
              <div>
                <div className="text-base font-semibold">{s.plan}</div>
                <div className="text-xs text-muted-foreground">
                  {tr(s.period, s.periodEn)} · {tr("到期", "expires")} {s.expiresAt}
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                  <span className="text-muted-foreground">{tr("已用 / 总流量", "Used / total")}</span>
                  <span className="font-medium tabular-nums">
                    {bytes(s.used)} / {bytes(s.total)} <span className="text-muted-foreground">({p}%)</span>
                  </span>
                </div>
                <Progress value={p} tone={usageTone(p)} className="h-2" />
              </div>
              <KV
                items={[
                  [tr("下次重置", "Next reset"), s.nextReset ?? tr("不重置", "No reset")],
                  [tr("限速", "Speed limit"), s.plan.includes("IPLC") || s.plan.includes("1T") ? tr("不限速", "Unlimited") : s.plan.includes("50G") ? "100 Mbps" : "300 Mbps"],
                  [tr("可用入口", "Entrances"), s.plan.includes("IPLC") ? tr("高级线路 · 8 个入口（含 3 个中转）", "Premium · 8 entrances (3 relay)") : tr("基础线路 · 5 个入口", "Basic · 5 entrances")],
                ]}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  icon="refresh"
                  onClick={() =>
                    confirm({
                      title: tr("重置套餐流量", "Reset plan traffic"),
                      tone: "warning",
                      impact: tr(`已用流量 ${bytes(s.used)} 将清零`, `${bytes(s.used)} used will be reset to 0`),
                      description: tr("不改变到期时间和重置计划。写入审计；因流量用尽被停用的账户会自动恢复。", "Expiry and reset schedule stay. Audited; accounts disabled for quota are re-enabled."),
                      confirmLabel: tr("重置流量", "Reset traffic"),
                      onConfirm: () => toast({ tone: "success", title: tr("流量已重置", "Traffic reset"), description: user.email }),
                    })
                  }
                >
                  {tr("重置流量", "Reset traffic")}
                </Button>
                <Button size="sm" icon="calendar" onClick={() => onPlan(user, "extend")}>
                  {tr("续期 / 延长", "Renew / extend")}
                </Button>
                <Button size="sm" icon="layers" onClick={() => onPlan(user, "change")}>
                  {tr("更换套餐", "Change plan")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive-soft"
                  icon="x"
                  onClick={() =>
                    confirm({
                      title: tr("取消套餐", "Cancel plan"),
                      impact: tr(`${user.email} 将立即失去全部入口`, `${user.email} loses all entrances immediately`),
                      description: tr("不退款（退款请在订单中操作）。在线连接会被切断。", "No refund (refund from the order). Live connections are cut."),
                      confirmLabel: tr("取消套餐", "Cancel plan"),
                    })
                  }
                >
                  {tr("取消套餐", "Cancel plan")}
                </Button>
              </div>
            </CardBody>
          ) : (
            <EmptyState
              icon="layers"
              title={tr("没有生效的套餐", "No active plan")}
              description={user.role === "admin" ? tr("管理员账户不能持有套餐。", "Admin accounts cannot hold a plan.") : tr("分配套餐后用户即可使用对应节点组的入口。", "Assign a plan to grant the entrances of its node groups.")}
              action={
                user.role !== "admin" && (
                  <Button size="sm" variant="primary" icon="plus" onClick={() => onPlan(user, "assign")}>
                    {tr("分配套餐", "Assign plan")}
                  </Button>
                )
              }
            />
          )}
        </Card>

        <Card>
          <CardHeader title={tr("账户", "Account")} />
          <CardBody>
            <KV
              items={[
                [tr("登录邮箱", "Email"), user.email],
                [tr("注册时间", "Registered"), user.registeredAt],
                [tr("最后登录", "Last login"), user.lastLoginAt ?? tr("从未", "Never")],
                [tr("通行密钥", "Passkeys"), user.passkeys ? tr(`${user.passkeys} 个`, `${user.passkeys}`) : tr("未绑定", "None")],
                [tr("余额", "Balance"), yuan(user.balanceCents)],
                [tr("邀请人", "Invited by"), user.inviter ?? "—"],
                [tr("在线设备", "Online devices"), String(user.online)],
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={tr("近 30 天流量", "Traffic, last 30 days")} description={tr("按入口统计（R43：用户 + 入口）", "Per entrance (R43: user + entrance)")} />
          <CardBody className="space-y-2 text-[13px]">
            {[
              ["香港 直连", "1.0x", 38.2],
              ["香港 IPLC", "2.0x / 3.0x 晚高峰", 21.7],
              ["日本 直连", "1.0x", 18.0],
              ["美国 直连", "0.5x", 8.5],
            ].map(([name, mult, gib]) => (
              <div key={name as string} className="flex items-center gap-3">
                <span className="w-24 truncate">{name}</span>
                <Progress value={((gib as number) / 40) * 100} className="flex-1" />
                <span className="w-16 text-right tabular-nums">{gib} GiB</span>
                <Badge tone="outline" className="hidden w-28 justify-center sm:inline-flex">
                  {mult}
                </Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </Drawer>
  );
}

/* ---------------- Ban dialog (W28) ---------------- */
function BanDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const tr = useTr();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [preset, setPreset] = useState("share");
  if (!user) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      icon="ban"
      tone="danger"
      title={tr(`封禁 ${user.email}`, `Ban ${user.email}`)}
      description={tr("封禁后立即踢下线（所有节点），订阅返回 404；用户仍可登录门户查看封禁原因并提交工单。写入审计。", "Kicks the user off every node now and the subscription returns 404; the user can still sign in to the portal to read the reason and open a ticket. Audited.")}
      footer={
        <>
          <Button onClick={onClose}>{tr("取消", "Cancel")}</Button>
          <Button
            variant="destructive"
            disabled={preset === "other" && !reason.trim()}
            onClick={() => {
              toast({ tone: "success", title: tr("已封禁并踢下线", "Banned and disconnected"), description: tr("4 个节点已收到撤权（UserDelta）", "4 nodes received the revocation (UserDelta)") });
              onClose();
            }}
          >
            {tr("封禁", "Ban")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={tr("原因（门户可见）", "Reason (visible in the portal)")}>
          <Select value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="share">{tr("共享账号给多人使用", "Account shared with others")}</option>
            <option value="abuse">{tr("滥用（BT 下载 / 扫描 / 发垃圾邮件）", "Abuse (BT / scanning / spam)")}</option>
            <option value="chargeback">{tr("支付争议 / 拒付", "Payment dispute / chargeback")}</option>
            <option value="other">{tr("其他（请填写）", "Other (write below)")}</option>
          </Select>
        </Field>
        <Field label={tr("补充说明", "Details")} hint={tr("最多 200 字，会显示给用户，不要写内部信息。", "Up to 200 chars, shown to the user — no internal notes.")}>
          <Textarea className="font-sans" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr("例如：工单 #1042 已告知", "e.g. told in ticket #1042")} />
        </Field>
      </div>
    </Dialog>
  );
}

/* ---------------- Plan dialog (D12: plan + period, or extend N days) ---------------- */
function PlanDialog({ target, selected, onClose }: { target: { user: User | null; mode: "assign" | "change" | "extend" } | null; selected: number; onClose: () => void }) {
  const tr = useTr();
  const toast = useToast();
  const [how, setHow] = useState<"period" | "days">("period");
  const [planId, setPlanId] = useState(plans[1].id);
  const [days, setDays] = useState("30");
  if (!target) return null;
  const { user, mode } = target;
  const isNew = !user && mode === "assign";
  const bulk = !user && mode === "extend";
  const plan = plans.find((p) => p.id === planId)!;
  const title = isNew ? tr("新建用户", "New user") : bulk ? tr(`为 ${selected} 个用户分配套餐 / 延长`, `Assign / extend for ${selected} users`) : mode === "change" ? tr("更换套餐", "Change plan") : mode === "extend" ? tr("续期 / 延长", "Renew / extend") : tr("分配套餐", "Assign plan");

  return (
    <Dialog
      open
      onClose={onClose}
      icon={isNew ? "user" : "layers"}
      title={title}
      description={user ? user.email : undefined}
      footer={
        <>
          <Button onClick={onClose}>{tr("取消", "Cancel")}</Button>
          <Button
            variant="primary"
            onClick={() => {
              toast({ tone: "success", title: isNew ? tr("用户已创建", "User created") : tr("套餐已更新", "Plan updated"), description: tr("已写入审计，受影响节点已收到更新。", "Audited; affected nodes were updated.") });
              onClose();
            }}
          >
            {isNew ? tr("创建", "Create") : tr("保存", "Save")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {isNew && (
          <>
            <Field label={tr("邮箱（登录名）", "Email (sign-in)")} hint={tr("管理员创建的邮箱视为已验证（D1）。", "Admin-created emails count as verified (D1).")}>
              <Input type="email" placeholder="name@example.com" />
            </Field>
            <Field label={tr("初始密码", "Initial password")} hint={tr("留空则发送设置密码邮件。", "Leave empty to email a set-password link.")}>
              <Input type="password" placeholder={tr("留空 = 发邮件", "empty = email link")} />
            </Field>
          </>
        )}
        {mode === "extend" && user?.sub ? (
          <Segmented
            value={how}
            onChange={setHow}
            options={[
              { value: "period", label: tr("续一个周期", "Renew one period") },
              { value: "days", label: tr("延长 N 天", "Extend N days") },
            ]}
          />
        ) : (
          (isNew || bulk || mode === "change" || mode === "assign") && (
            <Field label={tr("套餐", "Plan")}>
              <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {(isNew || bulk ? [{ id: "none", name: tr("暂不分配", "None for now") } as { id: string; name: string }] : []).concat(plans).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          )
        )}
        {bulk && (
          <Segmented
            value={how}
            onChange={setHow}
            options={[
              { value: "period", label: tr("套餐周期", "Plan period") },
              { value: "days", label: tr("延长 N 天", "Extend N days") },
            ]}
          />
        )}
        {how === "period" ? (
          <Field label={tr("周期", "Period")}>
            <Select>
              {(user?.sub && mode === "extend" ? plans.find((p) => p.name === user.sub!.plan) ?? plan : plan).prices.map((x) => (
                <option key={x.period}>
                  {tr(x.period, x.periodEn)} · {yuan(x.cents)}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label={tr("延长天数", "Days")} hint={tr("从当前到期时间顺延；已到期的从现在算起。", "Added to the current expiry; from now if already expired.")}>
            <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
        )}
        {mode === "change" && <Callout tone="warning">{tr("更换套餐会清零已用流量并按新套餐的节点组重新授权（M3 替换）。不产生订单；需要收费请让用户在门户下单。", "Changing plan resets used traffic and re-grants by the new plan's node groups. No order is created; let the user order in the portal to charge.")}</Callout>}
        <Callout tone="info">{tr("流量上限与到期时间由套餐决定，不能直接编辑（D12）。", "Traffic limit and expiry come from the plan and cannot be edited directly (D12).")}</Callout>
      </div>
    </Dialog>
  );
}
