import { useTr } from "../lib/i18n";
import { bytes, pct, yuan } from "../lib/format";
import { navigate, setParams, useViewState } from "../lib/route";
import { dashboard, orders, servers } from "../mock/data";
import { Bars, Sparkline } from "../ui/charts";
import { Icon, type IconName } from "../ui/icons";
import { Badge, Button, Card, CardBody, CardHeader, Dot, ErrorState, PageHeader, Progress, Skeleton, usageTone } from "../ui/primitives";
import { OrderStatusBadge } from "./orders";

export function DashboardPage() {
  const tr = useTr();
  const state = useViewState();
  const d = dashboard;

  if (state === "error")
    return (
      <>
        <PageHeader title={tr("仪表盘", "Dashboard")} />
        <Card>
          <ErrorState />
        </Card>
      </>
    );

  const loading = state === "loading";
  const days = Array.from({ length: 14 }, (_, i) => `${9 + Math.floor((21 + i) / 30)}/${((21 + i) % 30) + 1}`);

  return (
    <>
      <PageHeader
        title={tr("仪表盘", "Dashboard")}
        description={tr("数据更新于 10:14:32（北京时间）· 营收按北京日界统计", "Updated 10:14:32 (Asia/Shanghai) · revenue by Beijing day")}
        actions={
          <>
            <Button size="sm" icon="refresh">
              {tr("刷新", "Refresh")}
            </Button>
            <Button size="sm" variant="primary" icon="plus" onClick={() => (navigate("users"), setParams({ demo: "new-user" }, true))}>
              {tr("新建用户", "New user")}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard loading={loading} icon="wallet" label={tr("今日营收", "Revenue today")} value={yuan(d.revenue.today)} sub={tr(`7 天 ${yuan(d.revenue.d7)} · 30 天 ${yuan(d.revenue.d30)}`, `7d ${yuan(d.revenue.d7)} · 30d ${yuan(d.revenue.d30)}`)} spark={d.revenue.trend} trend="+12.4%" />
        <StatCard loading={loading} icon="users" label={tr("有效订阅", "Active subscriptions")} value={d.users.activeSubs.toLocaleString()} sub={tr(`共 ${d.users.total.toLocaleString()} 个账户 · 7 天新增 ${d.users.new7}`, `${d.users.total.toLocaleString()} accounts · ${d.users.new7} new in 7d`)} spark={[30, 31, 31, 33, 34, 34, 35, 36]} trend="+3.1%" color="var(--chart-2)" />
        <StatCard loading={loading} icon="zap" label={tr("当前在线用户", "Online now")} value={d.users.online.toLocaleString()} sub={tr("在线节点心跳之和", "Sum of online node heartbeats")} spark={[280, 310, 290, 350, 420, 460, 431]} color="var(--chart-3)" />
        <StatCard loading={loading} icon="server" label={tr("节点", "Nodes")} value={`${d.nodes.online} / ${d.nodes.online + d.nodes.offline + d.nodes.quota + d.nodes.disabled}`} sub={tr(`离线 ${d.nodes.offline} · 超额 ${d.nodes.quota} · 入口异常 ${d.nodes.entrancesDown}`, `${d.nodes.offline} offline · ${d.nodes.quota} over quota · ${d.nodes.entrancesDown} entrances down`)} tone="warning" onClick={() => navigate("nodes")} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={tr("近 14 天全网流量", "Fleet traffic, last 14 days")} description={tr("单位 TiB · UTC 日", "TiB · UTC days")} actions={<Badge tone="outline">{tr("合计 160.4 TiB", "Total 160.4 TiB")}</Badge>} />
          <CardBody>{loading ? <Skeleton className="h-44 w-full" /> : <Bars data={d.traffic14} labels={days} unit="TiB" />}</CardBody>
        </Card>

        <Card>
          <CardHeader title={tr("待处理", "Needs attention")} />
          <CardBody className="space-y-1 py-2">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="my-2 h-8 w-full" />)
              : (
                  [
                    ["ticket", tr("待回复工单", "Tickets awaiting reply"), d.todo.tickets, "tickets"],
                    ["receipt", tr("开通失败的订单", "Orders failed to fulfil"), d.todo.fulfilErrors, "orders"],
                    ["wallet", tr("待处理提现", "Pending withdrawals"), d.todo.withdrawals, "finance"],
                    ["mail", tr("发送失败的邮件", "Failed mail"), d.todo.mailFailed, "status"],
                    ["route", tr("探测失败的入口（已从订阅隐藏）", "Entrances failing probes (hidden)"), d.nodes.entrancesDown, "nodes"],
                  ] as [IconName, string, number, Parameters<typeof navigate>[0]][]
                ).map(([icon, label, n, to]) => (
                  <button key={label} type="button" onClick={() => navigate(to)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-[13px] hover:bg-muted">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon name={icon} size={14} />
                    </span>
                    <span className="flex-1">{label}</span>
                    <Badge tone={n > 0 ? "danger" : "neutral"}>{n}</Badge>
                    <Icon name="chevronRight" size={14} className="text-muted-foreground" />
                  </button>
                ))}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={tr("最新订单", "Latest orders")}
            actions={
              <Button size="sm" variant="ghost" onClick={() => navigate("orders")}>
                {tr("全部订单", "All orders")}
                <Icon name="chevronRight" size={14} />
              </Button>
            }
          />
          <ul className="divide-y divide-border">
            {(loading ? orders.slice(0, 6) : orders.slice(0, 6)).map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px] sm:px-5">
                {loading ? (
                  <Skeleton className="h-5 w-full" />
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{o.user}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {o.plan} · {tr(o.period, o.periodEn)} · {o.createdAt.slice(5)}
                      </div>
                    </div>
                    <OrderStatusBadge status={o.status} />
                    <div className="w-20 text-right font-medium tabular-nums">{yuan(o.amountCents)}</div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title={tr("服务器", "Servers")}
            actions={
              <Button size="sm" variant="ghost" onClick={() => navigate("nodes")}>
                {tr("节点", "Nodes")}
                <Icon name="chevronRight" size={14} />
              </Button>
            }
          />
          <ul className="divide-y divide-border">
            {servers.map((s) => {
              const qp = s.quota ? pct(s.quota.used, s.quota.limit) : null;
              return (
                <li key={s.id} className="px-4 py-3 sm:px-5">
                  {loading ? (
                    <Skeleton className="h-9 w-full" />
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-[13px]">
                        <Dot tone={s.online ? "success" : "danger"} />
                        <span className="font-medium">{s.region}</span>
                        <span className="font-mono text-xs text-muted-foreground">{s.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{s.online ? `CPU ${s.cpu}% · ${tr("内存", "mem")} ${s.mem}%` : tr("离线 26 分钟", "offline 26 min")}</span>
                      </div>
                      {s.quota && qp !== null && (
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Progress value={qp} tone={usageTone(qp)} className="flex-1" />
                          <span className="w-28 text-right tabular-nums">
                            {bytes(s.quota.used)} / {bytes(s.quota.limit)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  spark,
  trend,
  color,
  tone,
  loading,
  onClick,
}: {
  icon: IconName;
  label: string;
  value: string;
  sub: string;
  spark?: number[];
  trend?: string;
  color?: string;
  tone?: "warning";
  loading?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card className={onClick ? "cursor-pointer transition-colors hover:border-primary/40" : undefined}>
      <div className="p-4" onClick={onClick}>
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span className={tone === "warning" ? "text-warning" : "text-primary"}>
            <Icon name={icon} size={15} />
          </span>
          {label}
          {trend && <span className="ml-auto rounded bg-success-soft px-1.5 text-[11px] font-medium text-success">{trend}</span>}
        </div>
        {loading ? (
          <>
            <Skeleton className="mt-3 h-7 w-32" />
            <Skeleton className="mt-2 h-3 w-48" />
          </>
        ) : (
          <>
            <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div>
          </>
        )}
        {spark && !loading && <Sparkline data={spark} color={color} className="mt-2" />}
      </div>
    </Card>
  );
}
