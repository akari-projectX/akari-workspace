import { useTr } from "../lib/i18n";
import { bytes, pct } from "../lib/format";
import { useViewState } from "../lib/route";
import { systemStatus as st } from "../mock/data";
import { Ring } from "../ui/charts";
import { Icon } from "../ui/icons";
import { Badge, Button, Card, CardBody, CardHeader, Dot, ErrorState, PageHeader, Skeleton } from "../ui/primitives";

export function StatusPage() {
  const tr = useTr();
  const state = useViewState();
  const loading = state === "loading";
  if (state === "error")
    return (
      <>
        <PageHeader title={tr("系统状态", "System status")} />
        <Card>
          <ErrorState />
        </Card>
      </>
    );
  const memP = pct(st.host.mem.used, st.host.mem.total);
  const diskP = pct(st.host.disk.used, st.host.disk.total);
  const tone = (p: number) => (p >= 90 ? "danger" : p >= 75 ? "warning" : "primary");
  return (
    <>
      <PageHeader
        title={tr("系统状态", "System status")}
        description={tr("面板机器与依赖服务。每 10 秒自动刷新（W31）。", "Panel host and dependencies. Refreshes every 10 s (W31).")}
        actions={
          <Button size="sm" icon="refresh">
            {tr("刷新", "Refresh")}
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          [tr("CPU", "CPU"), st.host.cpu, tr(`负载 ${st.host.load.join(" / ")}`, `load ${st.host.load.join(" / ")}`)],
          [tr("内存", "Memory"), memP, `${bytes(st.host.mem.used)} / ${bytes(st.host.mem.total)}`],
          [tr("磁盘", "Disk"), diskP, `${bytes(st.host.disk.used)} / ${bytes(st.host.disk.total)}`],
        ].map(([label, v, sub]) => (
          <Card key={label as string} className="flex items-center gap-4 p-4">
            {loading ? <Skeleton className="h-14 w-14 rounded-full" /> : <Ring value={v as number} tone={tone(v as number)} label={label as string} />}
            <div className="min-w-0">
              <div className="text-[13px] font-medium">{label}</div>
              <div className="truncate text-xs text-muted-foreground">{sub}</div>
            </div>
          </Card>
        ))}
        <Card className="flex flex-col justify-center p-4">
          <div className="text-[13px] font-medium">{tr("运行时间", "Uptime")}</div>
          <div className="mt-1 text-lg font-semibold">{tr(st.host.uptime, "21d 4h")}</div>
          <div className="text-xs text-muted-foreground">Debian 13 · 4 vCPU</div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={tr("依赖服务", "Services")} />
          <ul className="divide-y divide-border">
            {st.services.map((s) => (
              <li key={s.name} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon name={s.kind === "db" ? "database" : s.kind === "cache" ? "zap" : "globe"} size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{s.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{tr(s.detail, s.detailEn)}</div>
                </div>
                <Badge tone="success" dot>
                  {tr("正常", "Healthy")}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title={tr("面板实例", "Panel instances")} description={tr("LISTEN 直连 PG；单实例任务通过 advisory lock 认领", "Direct LISTEN to PG; singleton jobs claimed via advisory locks")} />
          <ul className="divide-y divide-border">
            {st.instances.map((i) => (
              <li key={i.id} className="px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2 text-[13px]">
                  <Dot tone="success" />
                  <span className="font-medium">{i.host}</span>
                  <span className="font-mono text-xs text-muted-foreground">{i.version}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{tr(`运行 ${i.uptime} · ${i.sessions} 个 agent 会话`, `up ${i.uptime} · ${i.sessions} agent sessions`)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 pl-4">
                  {i.leader.map((l) => (
                    <Badge key={l} tone="outline">
                      {l}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title={tr("后台任务", "Background jobs")} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-subtle text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">{tr("任务", "Job")}</th>
                <th className="px-4 py-2 font-medium">{tr("状态", "Status")}</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">{tr("周期", "Every")}</th>
                <th className="px-4 py-2 font-medium">{tr("上次运行", "Last run")}</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">{tr("说明", "Note")}</th>
              </tr>
            </thead>
            <tbody>
              {st.jobs.map((j) => (
                <tr key={j.name} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">{tr(j.name, j.nameEn)}</td>
                  <td className="px-4 py-2.5">
                    {j.status === "ok" ? <Badge tone="success" dot>{tr("正常", "OK")}</Badge> : j.status === "warn" ? <Badge tone="warning" dot>{tr("注意", "Attention")}</Badge> : <Badge>{tr("未开启", "Off")}</Badge>}
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">{j.every}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{j.last}</td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">{j.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="mt-4">
        <CardBody className="flex flex-wrap items-center gap-3 text-[13px]">
          <Icon name="mail" size={16} className="text-warning" />
          <span className="flex-1">{tr("邮件发件箱有 1 封死信：SMTP 535 认证失败（smtp.example.com:465）。", "Mail outbox has 1 dead letter: SMTP 535 authentication failed (smtp.example.com:465).")}</span>
          <Button size="sm">{tr("查看死信", "View dead letters")}</Button>
          <Button size="sm" variant="primary">
            {tr("测试发信", "Send test mail")}
          </Button>
        </CardBody>
      </Card>
    </>
  );
}
