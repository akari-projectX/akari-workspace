import { useEffect, useMemo, useState } from "react";
import { cn } from "../lib/cn";
import { useTr } from "../lib/i18n";
import { bytes, pct, TiB } from "../lib/format";
import { setParams, useParam, useViewState } from "../lib/route";
import { nodeGroups, servers, type Entrance, type LandingNode, type RateRule, type Server } from "../mock/data";
import { Icon } from "../ui/icons";
import { Dialog, Drawer, useConfirm, useToast } from "../ui/overlays";
import { Badge, Button, Callout, Card, Checkbox, Dot, EmptyState, ErrorState, Field, Input, PageHeader, Progress, Segmented, Select, Skeleton, Switch, Textarea, usageTone } from "../ui/primitives";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const DAY_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Pairs of rule indexes that overlap (same weekday and intersecting time). */
export function overlaps(rules: RateRule[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < rules.length; i++)
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i];
      const b = rules[j];
      if (!a.days.some((d) => b.days.includes(d))) continue;
      if (toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end)) out.push([i, j]);
    }
  return out;
}

function rateAt(base: number, rules: RateRule[], day: number, minute: number) {
  let r = base;
  let hit = false;
  for (const x of rules) {
    if (x.days.includes(day) && minute >= toMin(x.start) && minute < toMin(x.end) + (x.end === "23:59" ? 1 : 0)) {
      r = hit ? Math.max(r, x.multiplier) : x.multiplier;
      hit = true;
    }
  }
  return r;
}

export function multLabel(e: Entrance) {
  return `${e.multiplier.toFixed(1)}x`;
}

const quotaMode = { both: ["双向", "Up + down"], up: ["仅上行", "Upload only"], down: ["仅下行", "Download only"] } as const;

export function NodesPage() {
  const tr = useTr();
  const state = useViewState();
  const openId = useParam("open");
  const demo = useParam("demo");
  const [filter, setFilter] = useState<"all" | "issues">("all");
  const [q, setQ] = useState("");
  const [quotaFor, setQuotaFor] = useState<Server | null>(demo === "quota" ? servers[1] : null);
  useEffect(() => {
    if (demo === "quota") setQuotaFor(servers[1]);
  }, [demo]);

  const entrance = useMemo(() => {
    for (const s of servers) for (const n of s.nodes) for (const e of n.entrances) if (e.id === openId) return { s, n, e };
    return null;
  }, [openId]);

  const list = servers.filter((s) => {
    if (q && !(s.name + s.region + s.nodes.map((n) => n.name).join()).includes(q)) return false;
    if (filter === "issues") return !s.online || s.alerts > 0 || s.nodes.some((n) => n.status !== "online" || n.entrances.some((e) => e.probe === "down"));
    return true;
  });
  const allEntrances = servers.flatMap((s) => s.nodes.flatMap((n) => n.entrances));

  return (
    <>
      <PageHeader
        title={tr("节点", "Nodes")}
        description={tr("服务器 → 落地节点（一个节点一种协议）→ 入口（直连 / 外部中转）。用户能用哪些入口只由套餐的节点组决定。", "Server → landing node (one protocol each) → entrances (direct / external relay). Access comes only from plan node groups.")}
        actions={
          <>
            <Button size="sm" icon="refresh">
              {tr("立即测速", "Probe now")}
            </Button>
            <Button size="sm" variant="primary" icon="plus">
              {tr("添加服务器", "Add server")}
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [tr("服务器在线", "Servers online"), `${servers.filter((s) => s.online).length} / ${servers.length}`, "server"],
          [tr("落地节点", "Landing nodes"), String(servers.reduce((a, s) => a + s.nodes.length, 0)), "layers"],
          [tr("入口", "Entrances"), `${allEntrances.filter((e) => e.kind === "relay").length} ${tr("中转", "relay")} · ${allEntrances.filter((e) => e.kind === "direct").length} ${tr("直连", "direct")}`, "route"],
          [tr("探测失败（已隐藏）", "Probe failing (hidden)"), String(allEntrances.filter((e) => e.probe === "down").length), "alert"],
        ].map(([label, value, icon], i) => (
          <Card key={i} className="px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name={icon as "server"} size={14} />
              {label}
            </div>
            <div className={cn("mt-1 text-lg font-semibold tabular-nums", i === 3 && "text-destructive")}>{state === "loading" ? <Skeleton className="h-6 w-16" /> : value}</div>
          </Card>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-8 pl-8" placeholder={tr("服务器、节点或入口名称", "Server, node or entrance")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: tr("全部", "All") },
            { value: "issues", label: tr("有异常", "With issues") },
          ]}
        />
        <Select className="w-32">
          <option>{tr("全部地区", "All regions")}</option>
          <option>香港</option>
          <option>日本</option>
          <option>新加坡</option>
          <option>美国</option>
        </Select>
      </div>

      {state === "error" ? (
        <Card>
          <ErrorState />
        </Card>
      ) : state === "loading" ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Card key={i} className="space-y-3 p-4">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-20 w-full" />
            </Card>
          ))}
        </div>
      ) : state === "empty" || list.length === 0 ? (
        <Card>
          <EmptyState
            icon="server"
            title={tr("还没有服务器", "No servers yet")}
            description={tr("添加服务器后会生成一条一次性安装命令；agent 注册后再在上面建落地节点。", "Adding a server gives a one-time install command; create landing nodes after the agent enrolls.")}
            action={
              <Button size="sm" variant="primary" icon="plus">
                {tr("添加服务器", "Add server")}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((s) => (
            <ServerCard key={s.id} server={s} onQuota={() => setQuotaFor(s)} activeEntrance={openId} />
          ))}
        </div>
      )}

      {entrance && <EntranceDrawer {...entrance} onClose={() => setParams({ open: null, demo: null })} />}
      <QuotaDialog server={quotaFor} onClose={() => (setQuotaFor(null), demo === "quota" && setParams({ demo: null }, true))} />
    </>
  );
}

function ServerCard({ server: s, onQuota, activeEntrance }: { server: Server; onQuota: () => void; activeEntrance: string | null }) {
  const tr = useTr();
  const qp = s.quota ? pct(s.quota.used, s.quota.limit) : 0;
  const exceeded = s.quota ? s.quota.used >= s.quota.limit : false;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-subtle px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card font-mono text-[11px] font-semibold">{s.flag}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {s.region}
              <span className="font-mono text-xs font-normal text-muted-foreground">{s.name}</span>
              {s.online ? (
                <Badge tone="success" dot>
                  {tr("在线", "Online")}
                </Badge>
              ) : (
                <Badge tone="danger" dot>
                  {tr("离线 26 分钟", "Offline 26 min")}
                </Badge>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span className="font-mono">{s.ip}</span>
              <span>agent {s.agentVersion}</span>
              {s.agentVersion !== "v0.5.0" && <span className="text-info">{tr("有新版本 v0.5.0", "Update v0.5.0 available")}</span>}
              {s.certDays !== null && <span className={s.certDays < 14 ? "text-warning" : ""}>{tr(`证书 ${s.certDays} 天后到期`, `cert expires in ${s.certDays}d`)}</span>}
            </div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-4">
          {s.online && (
            <div className="flex gap-4 text-xs">
              <div>
                <div className="text-muted-foreground">CPU</div>
                <div className="font-medium tabular-nums">{s.cpu}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">{tr("内存", "Mem")}</div>
                <div className="font-medium tabular-nums">{s.mem}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">{tr("速率", "Rate")}</div>
                <div className="font-medium tabular-nums">
                  ↑{s.rateUp} ↓{s.rateDown} <span className="text-muted-foreground">Mbps</span>
                </div>
              </div>
            </div>
          )}
          <button type="button" onClick={onQuota} className="w-56 rounded-md border border-border bg-card px-2.5 py-1.5 text-left hover:border-primary/40">
            {s.quota ? (
              <>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    {tr("流量额度", "Quota")} · {tr(quotaMode[s.quota.mode][0], quotaMode[s.quota.mode][1])}
                  </span>
                  {exceeded ? <span className="font-medium text-destructive">{tr("已超额", "Exceeded")}</span> : <span className="tabular-nums">{qp}%</span>}
                </div>
                <Progress value={qp} tone={usageTone(qp)} />
                <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                  {bytes(s.quota.used)} / {bytes(s.quota.limit)} · {tr(`每月 ${s.quota.resetDay} 日重置`, `resets day ${s.quota.resetDay}`)}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon name="gauge" size={14} />
                {tr("未设置流量额度", "No traffic quota")}
              </div>
            )}
          </button>
          <Button size="icon-sm" variant="ghost" icon="more" aria-label="more" />
        </div>
      </div>
      {exceeded && (
        <div className="border-b border-border px-4 py-2.5">
          <Callout tone="danger" title={tr("服务器流量已超额：上面所有节点已下发空配置", "Server over quota: every node on it now has an empty config")}>
            {tr(`按“${quotaMode[s.quota!.mode][0]}”计，已用 ${bytes(s.quota!.used)}。10 月 15 日重置后，或调高额度后自动恢复。`, `Counted as “${quotaMode[s.quota!.mode][1]}”, ${bytes(s.quota!.used)} used. Restores automatically on Oct 15 or when the quota is raised.`)}
          </Callout>
        </div>
      )}
      {!s.online && (
        <div className="border-b border-border px-4 py-2.5">
          <Callout tone="warning" title={tr("agent 失联", "Agent unreachable")}>
            {tr("租约剩余 23 小时 34 分；到期前 agent 继续按最后配置服务。入口已从订阅隐藏并已告警。", "Lease has 23h 34m left; the agent keeps serving the last config. Entrances are hidden from subscriptions and alerted.")}
          </Callout>
        </div>
      )}
      <div className="divide-y divide-border">
        {s.nodes.map((n) => (
          <NodeBlock key={n.id} node={n} activeEntrance={activeEntrance} />
        ))}
      </div>
      <div className="border-t border-border px-4 py-2">
        <Button size="sm" variant="ghost" icon="plus">
          {tr("在此服务器上添加落地节点", "Add landing node on this server")}
        </Button>
      </div>
    </Card>
  );
}

function NodeStatus({ n }: { n: LandingNode }) {
  const tr = useTr();
  const m = {
    online: ["success", "运行中", "Running"],
    offline: ["danger", "离线", "Offline"],
    disabled: ["neutral", "已停用", "Disabled"],
    quota: ["danger", "超额停用", "Over quota"],
  } as const;
  const [tone, zh, en] = m[n.status];
  return (
    <Badge tone={tone} dot>
      {tr(zh, en)}
    </Badge>
  );
}

function NodeBlock({ node: n, activeEntrance }: { node: LandingNode; activeEntrance: string | null }) {
  const tr = useTr();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(true);
  const [block, setBlock] = useState(n.blockRules);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 items-center gap-2 text-left">
          <Icon name="chevronRight" size={16} className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
          <span className="font-medium">{n.name}</span>
          <Badge tone="primary">{n.protocol}</Badge>
          <span className="text-xs text-muted-foreground">
            {n.transport} · :{n.port}
          </span>
        </button>
        <NodeStatus n={n} />
        <div className="ml-auto flex flex-wrap items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            {tr("授权用户", "Users")} <b className="font-medium text-foreground tabular-nums">{n.users.toLocaleString()}</b> · {tr("在线", "online")} <b className="font-medium text-foreground tabular-nums">{n.online}</b>
          </span>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">{tr("审计规则", "Block rules")}</span>
            <Switch
              checked={block}
              label={tr("审计规则", "Block rules")}
              onChange={(v) =>
                v
                  ? (setBlock(true), toast({ tone: "success", title: tr(`${n.name}：已启用审计规则`, `${n.name}: block rules on`), description: tr("BitTorrent、BT Tracker、挖矿池 · 将发 Snapshot（重建 xray）", "BitTorrent, BT trackers, mining pools · sends a Snapshot (xray rebuild)") }))
                  : confirm({
                      title: tr("关闭审计规则", "Turn off block rules"),
                      tone: "warning",
                      impact: tr(`${n.name} 上的 ${n.online} 个在线连接会因重建 xray 断开一次`, `${n.online} live connections on ${n.name} drop once (xray rebuild)`),
                      onConfirm: () => setBlock(false),
                    })
              }
            />
          </label>
          <Button size="sm" variant="ghost" icon="settings">
            {tr("编辑节点", "Edit node")}
          </Button>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-3">
          <div className="overflow-hidden rounded-md border border-border">
            <div className="hidden grid-cols-[minmax(160px,1.4fr)_minmax(180px,1.4fr)_120px_minmax(120px,1fr)_130px_110px_40px] gap-3 border-b border-border bg-subtle px-3 py-2 text-xs text-muted-foreground lg:grid">
              <span>{tr("入口", "Entrance")}</span>
              <span>{tr("连接地址", "Connect to")}</span>
              <span>{tr("倍率", "Multiplier")}</span>
              <span>{tr("节点组", "Node groups")}</span>
              <span>{tr("TCP 探测", "TCP probe")}</span>
              <span>{tr("订阅中", "In subscription")}</span>
              <span />
            </div>
            {n.entrances.map((e) => (
              <EntranceRow key={e.id} e={e} active={activeEntrance === e.id} />
            ))}
            <button type="button" className="flex w-full items-center gap-2 border-t border-dashed border-border px-3 py-2 text-[13px] text-muted-foreground hover:bg-subtle hover:text-foreground">
              <Icon name="plus" size={14} />
              {tr("添加外部中转入口", "Add external relay entrance")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EntranceRow({ e, active }: { e: Entrance; active: boolean }) {
  const tr = useTr();
  const rulesCount = e.rules.length;
  const ov = overlaps(e.rules).length;
  return (
    <button
      type="button"
      onClick={() => setParams({ open: e.id })}
      className={cn(
        "grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 border-b border-border px-3 py-2.5 text-left text-[13px] last:border-b-0 hover:bg-subtle lg:grid-cols-[minmax(160px,1.4fr)_minmax(180px,1.4fr)_120px_minmax(120px,1fr)_130px_110px_40px] lg:items-center",
        active && "bg-primary-soft/40",
        !e.enabled && "opacity-60",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon name={e.kind === "direct" ? "zap" : "route"} size={14} className={e.kind === "direct" ? "text-chart-2" : "text-chart-4"} />
        <span className="truncate font-medium">{e.name}</span>
        <Badge tone="outline">{e.kind === "direct" ? tr("直连", "Direct") : tr("中转", "Relay")}</Badge>
      </span>
      <span className="order-last col-span-2 truncate font-mono text-xs text-muted-foreground lg:order-none lg:col-span-1">
        {e.host}:{e.port}
        {e.egress.length > 0 && <span className="ml-1.5 font-sans">· {tr(`出口 ${e.egress.length} 个`, `${e.egress.length} egress`)}</span>}
      </span>
      <span className="flex items-center gap-1.5 justify-self-end lg:justify-self-auto">
        <span className="font-semibold tabular-nums">{multLabel(e)}</span>
        {rulesCount > 0 && (
          <span className={cn("inline-flex items-center gap-0.5 text-xs", ov ? "text-warning" : "text-muted-foreground")} title={ov ? tr("时段重叠", "Overlapping windows") : undefined}>
            <Icon name={ov ? "alert" : "clock"} size={12} />
            {rulesCount}
          </span>
        )}
      </span>
      <span className="hidden truncate text-xs text-muted-foreground lg:block">{e.groups.join("、") || tr("未加入任何组", "No group")}</span>
      <span className="hidden lg:block">
        {e.probe === "up" ? (
          <span className="flex items-center gap-1.5 text-xs">
            <Dot tone="success" /> {e.latencyMs} ms
          </span>
        ) : e.probe === "down" ? (
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <Dot tone="danger" /> {tr("失败 · 12 分钟", "Failing · 12 min")}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Dot tone="neutral" /> {tr("未探测", "Not probed")}
          </span>
        )}
      </span>
      <span className="hidden lg:block">
        {!e.enabled ? (
          <Badge>{tr("已关闭", "Off")}</Badge>
        ) : e.hidden ? (
          <Badge tone="danger">
            <Icon name="eyeOff" size={11} />
            {tr("已隐藏", "Hidden")}
          </Badge>
        ) : (
          <Badge tone="success">
            <Icon name="eye" size={11} />
            {tr("显示", "Shown")}
          </Badge>
        )}
      </span>
      <span className="hidden justify-self-end text-muted-foreground lg:block">
        <Icon name="chevronRight" size={16} />
      </span>
      {/* phone/tablet status line */}
      <span className="col-span-2 flex flex-wrap items-center gap-2 text-xs lg:hidden">
        {e.probe === "down" ? (
          <Badge tone="danger" dot>
            {tr("探测失败 · 已从订阅隐藏", "Probe failing · hidden")}
          </Badge>
        ) : e.probe === "up" ? (
          <Badge tone="success" dot>
            {e.latencyMs} ms
          </Badge>
        ) : (
          <Badge>{tr("未探测", "Not probed")}</Badge>
        )}
        <span className="text-muted-foreground">{e.groups.join("、")}</span>
      </span>
    </button>
  );
}

/* ---------------- Entrance drawer: D9 rate rules + §5 relay fields ---------------- */
function EntranceDrawer({ s, n, e, onClose }: { s: Server; n: LandingNode; e: Entrance; onClose: () => void }) {
  const tr = useTr();
  const toast = useToast();
  const confirm = useConfirm();
  const [base, setBase] = useState(String(e.multiplier));
  const [rules, setRules] = useState<RateRule[]>(e.rules);
  const [groups, setGroups] = useState<string[]>(e.groups);
  const ov = overlaps(rules);
  const ovSet = new Set(ov.flat());
  const b = Number(base) || 0;
  const now = { day: 6, minute: 21 * 60 + 14 };

  const updateRule = (i: number, patch: Partial<RateRule>) => setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-2xl"
      title={e.name}
      subtitle={`${s.region} ${s.name} › ${n.name} (${n.protocol} · ${n.transport})`}
      footer={
        <>
          {e.kind === "relay" && (
            <Button
              variant="destructive-soft"
              icon="trash"
              className="mr-auto"
              onClick={() =>
                confirm({
                  title: tr("删除入口", "Delete entrance"),
                  impact: tr(`${e.users} 个用户将失去“${e.name}”，在线连接会被切断`, `${e.users} users lose “${e.name}”; live connections are cut`),
                  description: tr("落地机上对应的派生入站随之删除。", "The derived inbound on the landing server is removed too."),
                  confirmLabel: tr("删除入口", "Delete"),
                  typeToConfirm: e.name,
                })
              }
            >
              {tr("删除", "Delete")}
            </Button>
          )}
          <Button onClick={onClose}>{tr("取消", "Cancel")}</Button>
          <Button variant="primary" onClick={() => (toast({ tone: "success", title: tr("入口已保存", "Entrance saved"), description: tr("倍率规则变更已写入审计。", "Rate-rule change audited.") }), onClose())}>
            {tr("保存", "Save")}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label={tr("TCP 探测", "TCP probe")} value={e.probe === "up" ? `${e.latencyMs} ms` : e.probe === "down" ? tr("失败", "Failing") : "—"} tone={e.probe === "down" ? "danger" : undefined} />
          <MiniStat label={tr("订阅中", "Subscription")} value={e.hidden ? tr("已隐藏", "Hidden") : tr("显示", "Shown")} tone={e.hidden ? "danger" : undefined} />
          <MiniStat label={tr("可用用户", "Users")} value={e.users.toLocaleString()} />
          <MiniStat label={tr("当前倍率", "Current rate")} value={`${rateAt(b, rules, now.day, now.minute).toFixed(1)}x`} hint={tr("周六 21:14", "Sat 21:14")} />
        </div>
        {e.probe === "down" && (
          <Callout tone="danger" title={tr("TCP 探测连续失败 12 分钟", "TCP probe failing for 12 minutes")}>
            {tr("面板连不上 gz-bgp.relay.example:20443（connection refused）。该入口已从订阅中隐藏，已发 Telegram 告警。恢复后自动重新显示。", "The panel cannot reach gz-bgp.relay.example:20443 (connection refused). Hidden from subscriptions; Telegram alert sent. Shown again automatically on recovery.")}
          </Callout>
        )}

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{tr("基本", "Basics")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tr("名称（订阅中显示）", "Name (shown in subscriptions)")} hint={tr(`订阅节点名：${e.name} ${b.toFixed(1)}x`, `Subscription name: ${e.name} ${b.toFixed(1)}x`)}>
              <Input defaultValue={e.name} />
            </Field>
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <Field label={tr("连接地址", "Connect host")}>
                <Input defaultValue={e.host} className="font-mono text-[13px]" disabled={e.kind === "direct"} />
              </Field>
              <Field label={tr("端口", "Port")}>
                <Input defaultValue={e.port} className="font-mono text-[13px]" disabled={e.kind === "direct"} />
              </Field>
            </div>
          </div>
          {e.kind === "relay" ? (
            <Field
              label={tr("中转机出口 IP / CIDR", "Relay egress IPs / CIDRs")}
              hint={tr("落地机用 nftables 只放行这些来源连接派生入站；隔离主要靠独立凭据，IP 白名单是附加防护。每行一个。", "The landing server only accepts the derived inbound from these sources (nftables); isolation relies on separate credentials, the allowlist is defence in depth. One per line.")}
            >
              <Textarea rows={3} defaultValue={e.egress.join("\n")} />
            </Field>
          ) : (
            <div className="text-xs text-muted-foreground">{tr("直连入口使用落地节点自身的地址和端口；可以关闭（只卖中转时）。", "The direct entrance uses the node's own address and port; it can be turned off (relay-only sales).")}</div>
          )}
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <div className="text-[13px] font-medium">{tr("启用此入口", "Entrance enabled")}</div>
              <div className="text-xs text-muted-foreground">{tr("关闭后从订阅移除并撤销派生入站上的用户。", "Off removes it from subscriptions and revokes users on its derived inbound.")}</div>
            </div>
            <Switch checked={e.enabled} />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">{tr("倍率与时段规则", "Multiplier & time windows")}</h3>
              <p className="text-xs text-muted-foreground">{tr("时区 Asia/Shanghai（系统设置 → 站点）。不在任何时段内时用基础倍率。", "Timezone Asia/Shanghai (Settings → Site). Base multiplier applies outside every window.")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={tr("基础倍率", "Base multiplier")} className="w-36">
              <div className="relative">
                <Input value={base} onChange={(ev) => setBase(ev.target.value)} className="pr-7 tabular-nums" inputMode="decimal" />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">x</span>
              </div>
            </Field>
          </div>

          <div className="space-y-2">
            {rules.map((r, i) => (
              <div key={i} className={cn("rounded-md border p-2.5", ovSet.has(i) ? "border-warning/60 bg-warning-soft/40" : "border-border")}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-1">
                    {DAY_ORDER.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => updateRule(i, { days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d] })}
                        className={cn("h-7 w-7 rounded text-xs font-medium transition-colors", r.days.includes(d) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}
                      >
                        {tr(DAY_ZH[d], DAY_EN[d])}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input type="time" value={r.start} onChange={(ev) => updateRule(i, { start: ev.target.value })} className="h-8 w-[104px] tabular-nums" />
                    <span className="text-xs text-muted-foreground">—</span>
                    <Input type="time" value={r.end} onChange={(ev) => updateRule(i, { end: ev.target.value })} className="h-8 w-[104px] tabular-nums" />
                  </div>
                  <div className="relative w-20">
                    <Input value={r.multiplier} onChange={(ev) => updateRule(i, { multiplier: Number(ev.target.value) || 0 })} className="h-8 pr-6 tabular-nums" inputMode="decimal" />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">x</span>
                  </div>
                  <Button size="icon-sm" variant="ghost" icon="trash" className="ml-auto" aria-label={tr("删除规则", "Remove rule")} onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))} />
                </div>
              </div>
            ))}
            <Button size="sm" variant="ghost" icon="plus" onClick={() => setRules((rs) => [...rs, { days: [1, 2, 3, 4, 5], start: "20:00", end: "23:00", multiplier: b + 0.5 }])}>
              {tr("添加时段规则", "Add time window")}
            </Button>
          </div>

          {ov.length > 0 && (
            <Callout tone="warning" title={tr(`有 ${ov.length} 处时段重叠`, `${ov.length} overlapping windows`)}>
              {ov.map(([a, c]) => (
                <div key={`${a}-${c}`}>
                  {tr(`规则 ${a + 1} 与规则 ${c + 1} 在`, `Rule ${a + 1} and rule ${c + 1} overlap on`)} {rules[a].days.filter((d) => rules[c].days.includes(d)).map((d) => tr("周" + DAY_ZH[d], DAY_EN[d])).join("、")}{" "}
                  {tr(`重叠，重叠时段取最高倍率 ${Math.max(rules[a].multiplier, rules[c].multiplier).toFixed(1)}x。`, `— the higher ${Math.max(rules[a].multiplier, rules[c].multiplier).toFixed(1)}x applies.`)}
                </div>
              ))}
            </Callout>
          )}

          <WeekHeatmap base={b} rules={rules} now={now} />
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{tr("可使用的节点组", "Node groups")}</h3>
          <p className="text-xs text-muted-foreground">{tr("权限：套餐 → 节点组 → 入口。低价套餐只包含直连入口所在的组。", "Access: plan → node group → entrance. Budget plans only include groups with direct entrances.")}</p>
          <div className="flex flex-wrap gap-2">
            {nodeGroups.map((g) => (
              <label key={g.id} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[13px]", groups.includes(g.name) ? "border-primary/50 bg-primary-soft/50" : "border-border")}>
                <Checkbox checked={groups.includes(g.name)} onChange={() => setGroups((gs) => (gs.includes(g.name) ? gs.filter((x) => x !== g.name) : [...gs, g.name]))} />
                {g.name}
                <span className="text-xs text-muted-foreground">{tr(`${g.plans} 个套餐`, `${g.plans} plans`)}</span>
              </label>
            ))}
          </div>
        </section>
      </div>
    </Drawer>
  );
}

function MiniStat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm font-semibold tabular-nums", tone === "danger" && "text-destructive")}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function WeekHeatmap({ base, rules, now }: { base: number; rules: RateRule[]; now: { day: number; minute: number } }) {
  const tr = useTr();
  const all = DAY_ORDER.flatMap((d) => Array.from({ length: 24 }, (_, h) => rateAt(base, rules, d, h * 60 + 30)));
  const max = Math.max(...all, base);
  const min = Math.min(...all, base);
  const shade = (v: number) => (max === min ? 0.15 : 0.12 + ((v - min) / (max - min)) * 0.75);
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium">{tr("一周倍率预览", "Weekly preview")}</span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--chart-1)", opacity: 0.15 }} />
          {min.toFixed(1)}x
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--chart-1)", opacity: 0.87 }} />
          {max.toFixed(1)}x
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[460px]">
          {DAY_ORDER.map((d) => (
            <div key={d} className="flex items-center gap-1 py-[1px]">
              <span className="w-6 text-[10px] text-muted-foreground">{tr(DAY_ZH[d], DAY_EN[d])}</span>
              <div className="grid flex-1 grid-cols-24 gap-[2px]">
                {Array.from({ length: 24 }, (_, h) => {
                  const v = rateAt(base, rules, d, h * 60 + 30);
                  const isNow = d === now.day && h === Math.floor(now.minute / 60);
                  return (
                    <div key={h} title={`${tr("周" + DAY_ZH[d], DAY_EN[d])} ${h}:00 · ${v.toFixed(1)}x`} className={cn("relative h-4 rounded-[2px]", isNow && "ring-2 ring-foreground")}>
                      <div className="absolute inset-0 rounded-[2px]" style={{ background: "var(--chart-1)", opacity: shade(v) }} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="ml-7 mt-1 flex justify-between text-[10px] text-muted-foreground">
            {[0, 6, 12, 18, 24].map((h) => (
              <span key={h}>{h}:00</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Server quota dialog (D5, server-level per phase 0) ---------------- */
function QuotaDialog({ server, onClose }: { server: Server | null; onClose: () => void }) {
  const tr = useTr();
  const toast = useToast();
  const [mode, setMode] = useState<"both" | "up" | "down">(server?.quota?.mode ?? "both");
  const [limit, setLimit] = useState(server?.quota ? String(Math.round(server.quota.limit / TiB)) : "");
  useEffect(() => {
    setMode(server?.quota?.mode ?? "both");
    setLimit(server?.quota ? String(Math.round(server.quota.limit / TiB)) : "");
  }, [server]);
  if (!server) return null;
  const used = server.quota?.used ?? 0;
  const willRestore = server.quota && used >= server.quota.limit && Number(limit) * TiB > used;
  return (
    <Dialog
      open
      onClose={onClose}
      icon="gauge"
      title={tr(`流量额度 · ${server.region} ${server.name}`, `Traffic quota · ${server.name}`)}
      description={tr("额度按服务器计算（一台机器一个 agent），对上面所有落地节点和入口生效。", "Quota is per server (one machine, one agent) and covers every node and entrance on it.")}
      footer={
        <>
          <Button onClick={onClose}>{tr("取消", "Cancel")}</Button>
          <Button variant="primary" onClick={() => (toast({ tone: "success", title: tr("额度已保存", "Quota saved"), description: willRestore ? tr("服务器已恢复，节点正在重新下发配置。", "Server restored; nodes are receiving configs again.") : undefined }), onClose())}>
            {tr("保存", "Save")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={tr("计费方式", "Counting")}>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "both", label: tr("双向", "Up + down") },
              { value: "up", label: tr("仅上行", "Upload") },
              { value: "down", label: tr("仅下行", "Download") },
            ]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("每周期额度（TiB）", "Per period (TiB)")} hint={tr("留空 = 不限", "empty = unlimited")}>
            <Input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label={tr("每月重置日", "Reset day")}>
            <Select defaultValue={server.quota?.resetDay ?? 1}>
              {Array.from({ length: 28 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {tr(`${i + 1} 日`, `Day ${i + 1}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="rounded-md border border-border bg-subtle px-3 py-2 text-[13px]">
          {tr("本周期已用", "Used this period")} <b className="tabular-nums">{bytes(used)}</b>
          {server.quota && used >= server.quota.limit && <Badge tone="danger" className="ml-2">{tr("已超额", "Exceeded")}</Badge>}
        </div>
        {willRestore && <Callout tone="success">{tr("新额度高于已用流量：保存后立即恢复该服务器上的所有节点。", "The new quota exceeds usage: saving restores every node on this server immediately.")}</Callout>}
        <Callout tone="info">{tr("超额后：服务器上所有节点下发空配置（与停用节点效果相同），入口从订阅中隐藏；到下一个周期或调高额度后自动恢复。", "When exceeded: every node gets an empty config (like disabling it) and entrances leave subscriptions; restores next period or when the quota is raised.")}</Callout>
      </div>
    </Dialog>
  );
}
