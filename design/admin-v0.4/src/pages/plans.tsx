import { useState } from "react";
import { cn } from "../lib/cn";
import { useTr } from "../lib/i18n";
import { bytes, yuan } from "../lib/format";
import { setParams, useParam, useViewState } from "../lib/route";
import { nodeGroups, plans, servers, type Plan } from "../mock/data";
import { Icon } from "../ui/icons";
import { Drawer, useToast } from "../ui/overlays";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Checkbox, EmptyState, ErrorState, Field, Input, PageHeader, Select, Skeleton, Switch, Tabs } from "../ui/primitives";

const entranceIndex = Object.fromEntries(servers.flatMap((s) => s.nodes.flatMap((n) => n.entrances.map((e) => [e.id, { e, n, s }]))));

export function PlansPage() {
  const tr = useTr();
  const state = useViewState();
  const tab = (useParam("tab") as "plans" | "groups") ?? "plans";
  const openId = useParam("open");
  const open = plans.find((p) => p.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title={tr("套餐", "Plans")}
        description={tr("权限链：套餐 → 节点组 → 入口。用户能用的入口只由生效套餐决定（D3，无手动分配）。", "Access chain: plan → node group → entrance. A user's entrances come only from the active plan (D3, no manual assignment).")}
        actions={
          <Button size="sm" variant="primary" icon="plus">
            {tab === "groups" ? tr("新建节点组", "New node group") : tr("新建套餐", "New plan")}
          </Button>
        }
      />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={(v) => setParams({ tab: v }, true)}
          tabs={[
            { value: "plans", label: tr("套餐", "Plans"), count: plans.length },
            { value: "groups", label: tr("节点组", "Node groups"), count: nodeGroups.length },
          ]}
        />
      </div>
      {state === "error" ? (
        <Card>
          <ErrorState />
        </Card>
      ) : state === "empty" ? (
        <Card>
          <EmptyState icon="layers" title={tr("还没有套餐", "No plans yet")} description={tr("先建节点组（选择入口），再建套餐并选择节点组和价格。", "Create a node group (pick entrances) first, then a plan with groups and prices.")} action={<Button size="sm" variant="primary" icon="plus">{tr("新建节点组", "New node group")}</Button>} />
        </Card>
      ) : tab === "plans" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => (state === "loading" ? <Skeleton key={p.id} className="h-64" /> : <PlanCard key={p.id} plan={p} onOpen={() => setParams({ open: p.id })} />))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {nodeGroups.map((g) => (
            <Card key={g.id}>
              <CardHeader
                title={g.name}
                description={tr(`${g.entrances.length} 个入口 · 被 ${g.plans} 个套餐使用`, `${g.entrances.length} entrances · used by ${g.plans} plans`)}
                actions={
                  <Button size="sm" variant="ghost" icon="settings">
                    {tr("编辑", "Edit")}
                  </Button>
                }
              />
              <CardBody className="space-y-3">
                {servers
                  .filter((s) => s.nodes.some((n) => n.entrances.some((e) => g.entrances.includes(e.id))))
                  .map((s) => (
                    <div key={s.id}>
                      <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                        {s.region} · <span className="font-mono">{s.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {s.nodes.flatMap((n) =>
                          n.entrances
                            .filter((e) => g.entrances.includes(e.id))
                            .map((e) => (
                              <span key={e.id} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs", e.kind === "relay" ? "border-chart-4/40" : "border-border")}>
                                <Icon name={e.kind === "direct" ? "zap" : "route"} size={12} className={e.kind === "direct" ? "text-chart-2" : "text-chart-4"} />
                                {e.name}
                                <span className="text-muted-foreground">{e.multiplier.toFixed(1)}x</span>
                                {e.hidden && <Icon name="eyeOff" size={12} className="text-destructive" />}
                              </span>
                            )),
                        )}
                      </div>
                    </div>
                  ))}
              </CardBody>
            </Card>
          ))}
          <Callout tone="info" title={tr("低价套餐不能用中转", "Budget plans cannot use relays")}>
            {tr("“基础线路”只包含直连入口；中转入口只在“高级线路”中。落地机上每个中转入口有独立的派生入站和凭据，所以改客户端地址也用不上（§5）。", "“Basic” only has direct entrances; relays are only in “Premium”. Each relay entrance has its own derived inbound and credentials on the landing server, so editing the client address does not help (§5).")}
          </Callout>
        </div>
      )}
      <PlanDrawer plan={open} onClose={() => setParams({ open: null })} />
    </>
  );
}

function PlanCard({ plan: p, onOpen }: { plan: Plan; onOpen: () => void }) {
  const tr = useTr();
  const ents = [...new Set(nodeGroups.filter((g) => p.groups.includes(g.name)).flatMap((g) => g.entrances))];
  const relays = ents.filter((id) => entranceIndex[id]?.e.kind === "relay").length;
  return (
    <Card className="flex cursor-pointer flex-col transition-colors hover:border-primary/40">
      <div className="flex-1 p-4" onClick={onOpen}>
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold">{p.name}</div>
          {p.onSale ? <Badge tone="success">{tr("在售", "On sale")}</Badge> : <Badge>{tr("已下架", "Off sale")}</Badge>}
        </div>
        <div className="mt-3 text-2xl font-semibold tabular-nums">
          {yuan(p.prices[0].cents)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">/ {tr(p.prices[0].period, p.prices[0].periodEn)}</span>
        </div>
        <ul className="mt-4 space-y-1.5 text-[13px]">
          <li className="flex items-center gap-2">
            <Icon name="gauge" size={14} className="text-muted-foreground" />
            {bytes(p.traffic)} · {p.resetMode}
          </li>
          <li className="flex items-center gap-2">
            <Icon name="zap" size={14} className="text-muted-foreground" />
            {p.speedMbps ? `${p.speedMbps} Mbps` : tr("不限速", "No speed limit")}
          </li>
          <li className="flex items-center gap-2">
            <Icon name="route" size={14} className="text-muted-foreground" />
            {p.groups.join("、")} · {tr(`${ents.length} 个入口`, `${ents.length} entrances`)}
            {relays > 0 && <Badge tone="info">{tr(`含 ${relays} 中转`, `${relays} relay`)}</Badge>}
          </li>
        </ul>
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span>
          {tr("订阅", "Subscribers")} <b className="text-foreground tabular-nums">{p.subscribers.toLocaleString()}</b>
          {p.capacity && <span className="tabular-nums"> / {p.capacity}</span>}
        </span>
        <span>{tr(`${p.prices.length} 个周期`, `${p.prices.length} periods`)}</span>
      </div>
    </Card>
  );
}

function PlanDrawer({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const tr = useTr();
  const toast = useToast();
  const [groups, setGroups] = useState<string[]>(plan?.groups ?? []);
  if (!plan) return null;
  const g = groups.length ? groups : plan.groups;
  const ents = [...new Set(nodeGroups.filter((x) => g.includes(x.name)).flatMap((x) => x.entrances))];
  return (
    <Drawer
      open
      onClose={onClose}
      title={plan.name}
      subtitle={tr(`${plan.subscribers.toLocaleString()} 个生效订阅`, `${plan.subscribers.toLocaleString()} active subscriptions`)}
      footer={
        <>
          <Button onClick={onClose}>{tr("取消", "Cancel")}</Button>
          <Button variant="primary" onClick={() => (toast({ tone: "success", title: tr("套餐已保存", "Plan saved"), description: tr(`套餐字段与价格同一事务保存；${plan.subscribers} 个用户的入口已重新计算。`, `Fields and prices saved together; entrances recomputed for ${plan.subscribers} users.`) }), onClose())}>
            {tr("保存", "Save")}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr("名称", "Name")}>
            <Input defaultValue={plan.name} />
          </Field>
          <Field label={tr("每周期流量（GiB）", "Traffic per period (GiB)")}>
            <Input defaultValue={Math.round(plan.traffic / 1024 ** 3)} />
          </Field>
          <Field label={tr("限速（Mbps）", "Speed limit (Mbps)")} hint={tr("0 = 不限", "0 = unlimited")}>
            <Input defaultValue={plan.speedMbps ?? 0} />
          </Field>
          <Field label={tr("流量重置", "Traffic reset")}>
            <Select defaultValue={plan.resetMode}>
              <option>每月按订阅日</option>
              <option>每月 1 日</option>
              <option>不重置</option>
            </Select>
          </Field>
        </div>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{tr("节点组", "Node groups")}</h3>
          <div className="flex flex-wrap gap-2">
            {nodeGroups.map((x) => (
              <label key={x.id} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[13px]", g.includes(x.name) ? "border-primary/50 bg-primary-soft/50" : "border-border")}>
                <Checkbox checked={g.includes(x.name)} onChange={() => setGroups(g.includes(x.name) ? g.filter((y) => y !== x.name) : [...g, x.name])} />
                {x.name}
              </label>
            ))}
          </div>
          <div className="mt-3 rounded-md border border-border">
            <div className="border-b border-border bg-subtle px-3 py-1.5 text-xs text-muted-foreground">{tr(`用户将获得的入口（${ents.length}）`, `Entrances users get (${ents.length})`)}</div>
            <ul className="divide-y divide-border text-[13px]">
              {ents.map((id) => {
                const x = entranceIndex[id];
                return (
                  <li key={id} className="flex items-center gap-2 px-3 py-1.5">
                    <Icon name={x.e.kind === "direct" ? "zap" : "route"} size={13} className={x.e.kind === "direct" ? "text-chart-2" : "text-chart-4"} />
                    <span className="flex-1">{x.e.name}</span>
                    <span className="text-xs text-muted-foreground">{x.n.protocol}</span>
                    <span className="w-12 text-right text-xs tabular-nums">{x.e.multiplier.toFixed(1)}x</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{tr("价格", "Prices")}</h3>
          <div className="space-y-2">
            {plan.prices.map((x) => (
              <div key={x.period} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                <span className="text-[13px]">{tr(x.period, x.periodEn)}</span>
                <Input defaultValue={(x.cents / 100).toFixed(2)} className="text-right tabular-nums" />
                <Button size="icon-sm" variant="ghost" icon="trash" aria-label="remove" />
              </div>
            ))}
            <Button size="sm" variant="ghost" icon="plus">
              {tr("添加周期", "Add period")}
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{tr("销售", "Sales")}</h3>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-[13px]">
            {tr("在门户商店中销售", "Sell in the portal shop")}
            <Switch checked={plan.onSale} />
          </div>
          <Field label={tr("库存上限", "Capacity")} hint={tr("留空 = 不限；付款履约时再检查一次。", "Empty = unlimited; re-checked at fulfilment.")}>
            <Input defaultValue={plan.capacity ?? ""} />
          </Field>
        </section>
      </div>
    </Drawer>
  );
}
