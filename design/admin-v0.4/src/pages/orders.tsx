import { useMemo, useState } from "react";
import { useTr } from "../lib/i18n";
import { yuan } from "../lib/format";
import { setParams, useParam, useViewState } from "../lib/route";
import { orders, type Order } from "../mock/data";
import { Icon } from "../ui/icons";
import { Drawer, useConfirm, useToast } from "../ui/overlays";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Input, KV, PageHeader, Select, type Tone } from "../ui/primitives";
import { DataTable, Pager, type Column } from "../ui/table";

export function OrderStatusBadge({ status }: { status: Order["status"] }) {
  const tr = useTr();
  const map: Record<Order["status"], [Tone, string, string]> = {
    paid: ["success", "已支付", "Paid"],
    pending: ["info", "待支付", "Pending"],
    expired: ["neutral", "已过期", "Expired"],
    cancelled: ["neutral", "已取消", "Cancelled"],
    refunded: ["warning", "已退款", "Refunded"],
  };
  const [tone, zh, en] = map[status];
  return <Badge tone={tone}>{tr(zh, en)}</Badge>;
}

const kindLabel: Record<Order["kind"], [string, string]> = {
  new: ["新购", "New"],
  renew: ["续费", "Renewal"],
  switch: ["换套餐", "Switch"],
  reset: ["流量重置", "Reset pack"],
};

export function OrdersPage() {
  const tr = useTr();
  const state = useViewState();
  const openId = useParam("open");
  const [status, setStatus] = useState("all");
  const [via, setVia] = useState("all");
  const [q, setQ] = useState("");
  const rows = useMemo(
    () => orders.filter((o) => (status === "all" || o.status === status) && (via === "all" || o.via === via) && (!q || o.no.includes(q) || o.user.includes(q))),
    [status, via, q],
  );
  const open = orders.find((o) => o.id === openId) ?? null;

  const columns: Column<Order>[] = [
    {
      key: "no",
      header: tr("订单号", "Order"),
      fixed: true,
      mobile: "title",
      cell: (o) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-mono text-[12px]">
            {o.no}
            {o.fulfilError && (
              <span title={o.fulfilError} className="text-destructive">
                <Icon name="alert" size={13} />
              </span>
            )}
          </div>
          <div className="truncate text-xs text-muted-foreground md:hidden">{o.user}</div>
        </div>
      ),
    },
    { key: "user", header: tr("用户", "User"), mobile: "hide", cell: (o) => <span className="truncate">{o.user}</span> },
    {
      key: "plan",
      header: tr("套餐 / 周期", "Plan / period"),
      cell: (o) => (
        <span>
          {o.plan} <span className="text-muted-foreground">· {tr(o.period, o.periodEn)}</span>
        </span>
      ),
    },
    { key: "kind", header: tr("类型", "Type"), cell: (o) => <Badge tone="outline">{tr(...kindLabel[o.kind])}</Badge> },
    { key: "amount", header: tr("实付", "Paid"), align: "right", cell: (o) => <span className="font-medium tabular-nums">{yuan(o.amountCents)}</span> },
    { key: "list", header: tr("原价", "List"), optional: true, align: "right", cell: (o) => <span className="tabular-nums text-muted-foreground">{yuan(o.listCents)}</span> },
    { key: "via", header: tr("方式", "Via"), cell: (o) => <span className="text-muted-foreground">{o.via}</span> },
    { key: "status", header: tr("状态", "Status"), cell: (o) => <OrderStatusBadge status={o.status} /> },
    { key: "created", header: tr("创建时间", "Created"), cell: (o) => <span className="tabular-nums text-muted-foreground">{o.createdAt}</span> },
  ];

  return (
    <>
      <PageHeader
        title={tr("订单", "Orders")}
        description={tr("金额一律由服务端计算；“人工”订单走同一付款路径并写审计。", "Amounts are always computed server-side; manual orders use the same payment path and are audited.")}
        actions={
          <>
            <Button size="sm" icon="download">
              {tr("导出 CSV", "Export CSV")}
            </Button>
            <Button size="sm" variant="primary" icon="plus">
              {tr("人工订单", "Manual order")}
            </Button>
          </>
        }
      />
      {state === "ready" && (
        <div className="mb-4">
          <Callout tone="danger" title={tr("1 个订单已付款但开通失败", "1 paid order failed to fulfil")}>
            {tr("AK20261003231140：套餐库存已满。钱已收到，请在订单详情中处理（重试开通或退款）。", "AK20261003231140: plan at capacity. Payment received — retry or refund from the order.")}
          </Callout>
        </div>
      )}
      <DataTable
        rows={rows}
        columns={columns}
        state={state}
        activeId={openId}
        onRowClick={(o) => setParams({ open: o.id })}
        toolbar={
          <>
            <div className="relative w-full sm:w-64">
              <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 pl-8" placeholder={tr("订单号或邮箱", "Order no. or email")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select className="w-32" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">{tr("全部状态", "All statuses")}</option>
              <option value="paid">{tr("已支付", "Paid")}</option>
              <option value="pending">{tr("待支付", "Pending")}</option>
              <option value="expired">{tr("已过期", "Expired")}</option>
              <option value="cancelled">{tr("已取消", "Cancelled")}</option>
              <option value="refunded">{tr("已退款", "Refunded")}</option>
            </Select>
            <Select className="w-32" value={via} onChange={(e) => setVia(e.target.value)}>
              <option value="all">{tr("全部方式", "All methods")}</option>
              <option value="支付宝">支付宝</option>
              <option value="余额">{tr("余额", "Balance")}</option>
              <option value="人工">{tr("人工", "Manual")}</option>
            </Select>
            <Input type="date" className="h-8 w-36" defaultValue="2026-10-01" aria-label={tr("开始日期", "From")} />
            <span className="text-xs text-muted-foreground">—</span>
            <Input type="date" className="h-8 w-36" defaultValue="2026-10-04" aria-label={tr("结束日期", "To")} />
          </>
        }
        footer={<Pager total={1932} />}
      />
      <OrderDrawer order={open} onClose={() => setParams({ open: null })} />
    </>
  );
}

function OrderDrawer({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const tr = useTr();
  const confirm = useConfirm();
  const toast = useToast();
  if (!order) return null;
  const o = order;
  return (
    <Drawer
      open
      onClose={onClose}
      title={<span className="font-mono">{o.no}</span>}
      subtitle={
        <span className="flex items-center gap-1.5">
          <OrderStatusBadge status={o.status} /> {tr(...kindLabel[o.kind])} · {o.user}
        </span>
      }
      footer={
        o.status === "paid" ? (
          <Button
            variant="destructive-soft"
            icon="refresh"
            onClick={() =>
              confirm({
                title: tr("退款", "Refund"),
                impact: tr(`退款 ${yuan(o.amountCents + o.balanceCents)}，只能操作一次`, `Refund ${yuan(o.amountCents + o.balanceCents)} — one time only`),
                description: tr("余额部分退回余额；支付宝部分可选退回余额或线下退款。撤销未入账的邀请返利。不改变套餐。", "Balance part returns to balance; Alipay part to balance or offline. Pending commission is revoked. Plan unchanged."),
                confirmLabel: tr("确认退款", "Refund"),
                typeToConfirm: o.no.slice(-6),
              })
            }
          >
            {tr("退款", "Refund")}
          </Button>
        ) : o.status === "pending" ? (
          <Button icon="check" onClick={() => toast({ tone: "success", title: tr("已人工确认付款", "Marked as paid") })}>
            {tr("人工确认付款", "Mark as paid")}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {o.fulfilError && (
          <Callout tone="danger" title={tr("已付款，开通失败", "Paid, not fulfilled")}>
            {o.fulfilError}
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="primary">
                {tr("重试开通", "Retry")}
              </Button>
            </div>
          </Callout>
        )}
        <Card>
          <CardHeader title={tr("金额拆分", "Amount breakdown")} description={tr("全部在 SQL 中计算并拷入订单", "Computed in SQL, copied into the order")} />
          <CardBody>
            <KV
              items={[
                [tr("原价", "List price"), yuan(o.listCents)],
                [tr("优惠券", "Coupon"), o.discountCents ? `− ${yuan(o.discountCents)}（${o.coupon}）` : "—"],
                [tr("换套餐抵扣", "Switch credit"), o.creditCents ? `− ${yuan(o.creditCents)}` : "—"],
                [tr("余额支付", "Balance"), o.balanceCents ? `− ${yuan(o.balanceCents)}` : "—"],
                [<b key="a">{tr("实付", "Paid")}</b>, <b key="b">{yuan(o.amountCents)}</b>],
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={tr("详情", "Details")} />
          <CardBody>
            <KV
              items={[
                [tr("套餐", "Plan"), `${o.plan} · ${tr(o.period, o.periodEn)}`],
                [tr("支付方式", "Method"), o.via],
                [tr("创建", "Created"), o.createdAt],
                [tr("付款", "Paid at"), o.paidAt ?? "—"],
                [tr("渠道交易号", "Trade no."), o.via === "支付宝" ? "2026100422001412345678901234" : "—"],
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </Drawer>
  );
}
