import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { useTr } from "../lib/i18n";
import { setParams, useParam, useViewState } from "../lib/route";
import { blockRuleSets, domains, ruleTemplates, templateRules, type Domain } from "../mock/data";
import { Icon, type IconName } from "../ui/icons";
import { Dialog, useConfirm, useToast, type ConfirmOptions } from "../ui/overlays";
import { Badge, Button, Callout, Card, CardBody, CardHeader, ErrorState, Field, Input, PageHeader, Segmented, Select, SettingRow, Skeleton, Switch, Textarea } from "../ui/primitives";

type Tab = "site" | "security" | "subscription" | "signup" | "mail" | "block" | "cleanup";

const tabs: { id: Tab; zh: string; en: string; icon: IconName; tag: string }[] = [
  { id: "site", zh: "站点与域名", en: "Site & domains", icon: "globe", tag: "D8" },
  { id: "security", zh: "后台与登录安全", en: "Admin & sign-in", icon: "shield", tag: "D4 · D7" },
  { id: "subscription", zh: "订阅", en: "Subscription", icon: "link", tag: "D11 · W30" },
  { id: "signup", zh: "注册", en: "Registration", icon: "user", tag: "D1 · W27" },
  { id: "mail", zh: "邮件", en: "Mail", icon: "mail", tag: "W31" },
  { id: "block", zh: "审计规则", en: "Block rules", icon: "ban", tag: "W29" },
  { id: "cleanup", zh: "账号清理", en: "Account cleanup", icon: "trash", tag: "D10" },
];

export function SettingsPage() {
  const tr = useTr();
  const state = useViewState();
  const tabParam = useParam("tab") as Tab | null;
  const tab: Tab = tabs.some((t) => t.id === tabParam) ? tabParam! : "site";

  return (
    <>
      <PageHeader title={tr("系统设置", "Settings")} description={tr("所有设置只存数据库；保存即对所有面板实例生效，并写入审计。", "Settings live in the database only; saving applies to every panel instance and is audited.")} />
      <div className="flex flex-col gap-5 lg:flex-row">
        <nav className="scroll-thin -mx-4 flex shrink-0 gap-1 overflow-x-auto px-4 lg:mx-0 lg:w-56 lg:flex-col lg:overflow-visible lg:px-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setParams({ tab: t.id, demo: null }, true)}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition-colors",
                tab === t.id ? "bg-card font-medium text-foreground shadow-card ring-1 ring-border" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon name={t.icon} size={15} />
              <span className="flex-1">{tr(t.zh, t.en)}</span>
              <span className="hidden text-[10px] text-muted-foreground/80 lg:inline">{t.tag}</span>
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 space-y-4">
          {state === "error" ? (
            <Card>
              <ErrorState />
            </Card>
          ) : state === "loading" ? (
            <Card className="space-y-4 p-5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-2/3" />
            </Card>
          ) : (
            <>
              {tab === "site" && <SiteTab />}
              {tab === "security" && <SecurityTab />}
              {tab === "subscription" && <SubscriptionTab />}
              {tab === "signup" && <SignupTab />}
              {tab === "mail" && <MailTab />}
              {tab === "block" && <BlockTab />}
              {tab === "cleanup" && <CleanupTab />}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function SaveBar({ note }: { note?: ReactNode }) {
  const tr = useTr();
  const toast = useToast();
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
      {note && <span className="mr-auto text-xs text-muted-foreground">{note}</span>}
      <Button size="sm">{tr("还原", "Revert")}</Button>
      <Button size="sm" variant="primary" onClick={() => toast({ tone: "success", title: tr("已保存", "Saved"), description: tr("所有面板实例已重新加载设置。", "All panel instances reloaded settings.") })}>
        {tr("保存", "Save")}
      </Button>
    </div>
  );
}

/* ---------------- Site & domains (D8) ---------------- */
function SiteTab() {
  const tr = useTr();
  const confirm = useConfirm();
  const demo = useParam("demo");
  const classes: { key: "main" | "sub" | "node"; zh: string; en: string; desc: string; descEn: string }[] = [
    { key: "main", zh: "主域名", en: "Main domains", desc: "只有主域名能访问门户和后台；邮件、支付回调、安装命令用首选主域名。", descEn: "Only main domains serve the portal and admin; mail, payment callbacks and install commands use the preferred one." },
    { key: "sub", zh: "订阅域名", en: "Subscription domains", desc: "只提供订阅，其他请求一律返回统一的 404。可放在 Cloudflare 后。", descEn: "Serve subscriptions only; everything else gets the canonical 404. May sit behind Cloudflare." },
    { key: "node", zh: "节点通信域名", en: "Node domains", desc: "只给 agent 的 gRPC 连接用，必须是灰色云朵（不经 Cloudflare 代理）。证书 SAN 只增不减。", descEn: "Agent gRPC only; must be grey-cloud (not proxied). Certificate SANs only grow." },
  ];
  const del = (d: Domain, cls: string): ConfirmOptions => ({
    title: tr(`删除${cls}“${d.name}”`, `Remove “${d.name}”`),
    impact: tr(`会影响 ${d.usedBy.length} 处`, `Affects ${d.usedBy.length} places`),
    details: (
      <div className="space-y-2 text-[13px]">
        <ul className="space-y-1 rounded-md border border-border bg-subtle px-3 py-2">
          {d.usedBy.map((u) => (
            <li key={u} className="flex gap-2">
              <Icon name="link" size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
              {u}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          {cls === "订阅域名" || cls === "Subscription domains"
            ? tr("使用此域名的订阅链接会立即返回 404；用户需要在门户重新复制链接。被随机分配到此域名的用户会改用首选订阅域名。", "Links on this domain return 404 at once; users must copy the link again. Users randomly assigned here move to the preferred domain.")
            : tr("删除后 Caddy 不再为它签发证书。", "Caddy stops issuing a certificate for it.")}
        </p>
      </div>
    ),
    confirmLabel: tr("删除域名", "Remove domain"),
    typeToConfirm: d.name,
  });
  useEffect(() => {
    if (demo === "delete-domain") confirm(del(domains.sub[1], tr("订阅域名", "Subscription domains")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  return (
    <>
      {classes.map((c) => (
        <Card key={c.key}>
          <CardHeader
            title={tr(c.zh, c.en)}
            description={tr(c.desc, c.descEn)}
            actions={
              <Button size="sm" icon="plus">
                {tr("添加", "Add")}
              </Button>
            }
          />
          <ul className="divide-y divide-border">
            {domains[c.key].map((d) => (
              <li key={d.name} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:px-5">
                <span className="font-mono text-[13px] font-medium">{d.name}</span>
                {d.preferred ? (
                  <Badge tone="primary">
                    <Icon name="star" size={11} />
                    {tr("首选", "Preferred")}
                  </Badge>
                ) : (
                  <button type="button" className="text-xs text-primary hover:underline">
                    {tr("设为首选", "Make preferred")}
                  </button>
                )}
                <Badge tone={d.cf === "grey" ? "neutral" : "warning"}>{d.cf === "grey" ? tr("灰色云朵", "DNS only") : tr("Cloudflare 代理", "CF proxied")}</Badge>
                <Badge tone="success" dot>
                  {tr("证书有效", "Cert OK")}
                </Badge>
                <span className="ml-auto text-xs text-muted-foreground">{tr(`影响 ${d.usedBy.length} 处`, `${d.usedBy.length} places`)}</span>
                <Button size="icon-sm" variant="ghost" icon="trash" aria-label="remove" disabled={d.preferred} title={d.preferred ? tr("首选域名不能删除，请先把其他域名设为首选", "Change the preferred domain first") : undefined} onClick={() => confirm(del(d, tr(c.zh, c.en)))} />
              </li>
            ))}
          </ul>
          {c.key === "sub" && (
            <CardBody className="border-t border-border">
              <SettingRow
                title={tr("每个用户随机分配订阅域名", "Random subscription domain per user")}
                description={tr("按用户 ID 哈希固定选一个订阅域名（同一用户始终相同）。某个域名被封锁时只影响部分用户。", "A domain is picked by hashing the user ID (stable per user). A blocked domain affects only part of the users.")}
              >
                <Switch checked />
              </SettingRow>
            </CardBody>
          )}
          {c.key === "node" && (
            <CardBody className="border-t border-border">
              <Callout tone="info">{tr("证书 SAN 当前包含：grpc.akari.example、ctl.akari.example、localhost、127.0.0.1。删除节点域名只停止在新令牌中使用，仍在用它的 agent 会列出来。", "Certificate SANs: grpc.akari.example, ctl.akari.example, localhost, 127.0.0.1. Removing a node domain only stops it in new tokens; agents still using it are listed.")}</Callout>
            </CardBody>
          )}
        </Card>
      ))}
      <Card>
        <CardHeader title={tr("站点", "Site")} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("站点名称", "Site name")}>
            <Input defaultValue="Akari 云" />
          </Field>
          <Field label={tr("站点时区", "Site timezone")} hint={tr("用于倍率时段、营收日界、邮件时间。", "Used for rate windows, revenue days, mail times.")}>
            <Select defaultValue="Asia/Shanghai">
              <option>Asia/Shanghai</option>
              <option>Asia/Hong_Kong</option>
              <option>Asia/Tokyo</option>
              <option>UTC</option>
            </Select>
          </Field>
        </CardBody>
        <SaveBar />
      </Card>
    </>
  );
}

/* ---------------- Admin prefix (D4) + passkey policy (D7) ---------------- */
function SecurityTab() {
  const tr = useTr();
  const confirm = useConfirm();
  const demo = useParam("demo");
  const rotate: ConfirmOptions = {
    title: tr("轮换后台前缀", "Rotate admin prefix"),
    tone: "warning",
    impact: tr("当前后台地址立即失效；所有管理员会话需要用新地址重新打开", "The current admin URL stops working now; every admin must reopen the new URL"),
    details: (
      <div className="space-y-2 text-[13px]">
        <div className="rounded-md border border-border bg-subtle px-3 py-2 font-mono text-xs">
          <div className="text-muted-foreground line-through">https://akari.example/k7Qm9vR2…x2/</div>
          <div>https://akari.example/Zp4Tn8wL…a9/</div>
        </div>
        <p className="text-xs text-muted-foreground">{tr("新地址只显示这一次，请先复制保存。忘记时在服务器上运行 akari info。", "The new URL is shown once; copy it now. Forgot it? Run akari info on the server.")}</p>
      </div>
    ),
    confirmLabel: tr("轮换", "Rotate"),
    typeToConfirm: tr("轮换", "rotate"),
  };
  useEffect(() => {
    if (demo === "rotate-prefix") confirm(rotate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);
  const [passkeyOnly, setPasskeyOnly] = useState(false);
  return (
    <>
      <Card>
        <CardHeader title={tr("后台地址", "Admin address")} description={tr("全站唯一的秘密前缀。门户代码里不出现后台地址，登录后也不会从门户跳转到后台。", "The site's only secret prefix. The portal never contains or redirects to the admin URL.")} />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-subtle px-3 py-2 font-mono text-[13px]">https://akari.example/k7Qm9vR2••••••••x2/</code>
            <Button size="sm" icon="eye">
              {tr("显示", "Reveal")}
            </Button>
            <Button size="sm" icon="refresh" onClick={() => confirm(rotate)}>
              {tr("轮换", "Rotate")}
            </Button>
          </div>
          <Field label={tr("IP 白名单", "IP allowlist")} hint={tr("每行一个 IP 或 CIDR；留空 = 不限制。不在名单内的访问得到与未知路径相同的 404。保存前会检查你当前的地址 114.86.23.7 是否在名单内。", "One IP or CIDR per line; empty = no restriction. Others get the same 404 as an unknown path. Saving checks that your current address 114.86.23.7 is included.")}>
            <Textarea rows={3} defaultValue={"114.86.23.0/24\n2408:8207:1a2b::/48"} />
          </Field>
          <Callout tone="warning">{tr("锁在外面时：在服务器上运行 akari settings unset admin-allowlist。", "Locked out? Run akari settings unset admin-allowlist on the server.")}</Callout>
        </CardBody>
        <SaveBar />
      </Card>
      <Card>
        <CardHeader title={tr("登录方式", "Sign-in methods")} description={tr("通行密钥（WebAuthn）取代两步验证；TOTP 已移除。", "Passkeys (WebAuthn) replace two-factor auth; TOTP has been removed.")} />
        <CardBody className="divide-y divide-border py-1">
          <SettingRow title={tr("密码登录后引导绑定通行密钥", "Prompt to add a passkey after password sign-in")} description={tr("每次用密码登录都会提示，直到绑定。", "Shown on every password sign-in until one is added.")}>
            <Switch checked />
          </SettingRow>
          <SettingRow title={tr("绑定通行密钥后关闭该账户的密码登录", "Turn off password sign-in once a passkey is added")} description={tr("用户仍可用“忘记密码”邮件恢复。", "Users can still recover by password-reset email.")}>
            <Switch checked />
          </SettingRow>
          <SettingRow
            title={tr("仅允许通行密钥登录（管理员）", "Passkey-only sign-in (admins)")}
            description={tr("开启前你自己必须已绑定通行密钥。当前 3 名管理员中有 1 人未绑定，开启后他将无法登录。", "You must have a passkey yourself. 1 of 3 admins has none and would be locked out.")}
          >
            <Switch checked={passkeyOnly} onChange={setPasskeyOnly} />
          </SettingRow>
          <SettingRow title={tr("仅允许通行密钥登录（用户）", "Passkey-only sign-in (users)")} description={tr("只对已绑定通行密钥的用户生效；未绑定的用户仍可用密码登录。", "Applies to users with a passkey; others keep password sign-in.")}>
            <Switch checked={false} />
          </SettingRow>
        </CardBody>
        <SaveBar />
      </Card>
    </>
  );
}

/* ---------------- Subscription (D11, W30) ---------------- */
function SubscriptionTab() {
  const tr = useTr();
  const confirm = useConfirm();
  const demo = useParam("demo");
  const [path, setPath] = useState("r8Kq2m");
  const changePath: ConfirmOptions = {
    title: tr("修改订阅路径", "Change subscription path"),
    impact: tr("旧路径立即失效：3,620 个用户的订阅链接全部失效，需要在客户端重新导入", "The old path stops at once: 3,620 users' links break and must be re-imported"),
    details: (
      <div className="rounded-md border border-border bg-subtle px-3 py-2 font-mono text-xs">
        <div className="text-muted-foreground line-through">https://sub.akari-cdn.example/r8Kq2m/&lt;token&gt;</div>
        <div>https://sub.akari-cdn.example/{path === "r8Kq2m" ? "v3Np7d" : path}/&lt;token&gt;</div>
      </div>
    ),
    description: tr("安装链接和支付回调的路径不变。写入审计。可选同时给全部用户发邮件通知新链接。", "Install and payment-callback paths are unchanged. Audited. Optionally email every user the new link."),
    confirmLabel: tr("修改路径", "Change path"),
    typeToConfirm: tr("旧链接全部失效", "break all links"),
  };
  useEffect(() => {
    if (demo === "sub-path") confirm(changePath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);
  return (
    <>
      <Card>
        <CardHeader title={tr("订阅路径", "Subscription path")} description={tr("安装时随机生成、全站共用的一段路径（D11）。门户在主域名根路径 /。", "A random site-wide path generated at install (D11). The portal is at / on the main domain.")} />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <Field label={tr("路径", "Path")} className="w-48">
              <div className="flex items-center rounded-md border border-input bg-card pl-2.5 focus-within:border-ring">
                <span className="font-mono text-[13px] text-muted-foreground">/</span>
                <input className="h-9 w-full bg-transparent px-1 font-mono text-[13px] outline-none" value={path} onChange={(e) => setPath(e.target.value)} />
              </div>
            </Field>
            <Button size="md" icon="refresh" onClick={() => setPath("v3Np7d")}>
              {tr("随机生成", "Randomise")}
            </Button>
            <Button size="md" variant="destructive" onClick={() => confirm(changePath)}>
              {tr("应用新路径", "Apply new path")}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {tr("示例：", "Example: ")}
            <span className="font-mono">https://sub.akari-cdn.example/{path}/9f2c…e1</span>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={tr("分流规则模板", "Routing rule templates")}
          description={tr("Clash/mihomo 用 rule-providers，sing-box 用 rule_set（geosite / geoip）。", "Clash/mihomo get rule-providers, sing-box gets rule_set (geosite / geoip).")}
          actions={
            <Button size="sm" icon="plus">
              {tr("新建模板", "New template")}
            </Button>
          }
        />
        <div className="grid divide-y divide-border lg:grid-cols-[260px_1fr] lg:divide-x lg:divide-y-0">
          <ul className="p-2">
            {ruleTemplates.map((t, i) => (
              <li key={t.id}>
                <button type="button" className={cn("w-full rounded-md px-3 py-2 text-left text-[13px]", i === 0 ? "bg-muted font-medium" : "hover:bg-subtle")}>
                  <div className="flex items-center gap-1.5">
                    {t.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {t.isDefault && <Badge tone="primary">{tr("默认", "Default")}</Badge>}
                    {tr(`${t.rules} 条 · ${t.updatedAt}`, `${t.rules} rules · ${t.updatedAt}`)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="p-4">
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-subtle text-left text-xs text-muted-foreground">
                    <th className="w-8 px-3 py-2" />
                    <th className="px-3 py-2 font-medium">{tr("类型", "Type")}</th>
                    <th className="px-3 py-2 font-medium">{tr("匹配", "Match")}</th>
                    <th className="px-3 py-2 font-medium">{tr("动作", "Action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {templateRules.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">⋮⋮</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.type}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.value}</td>
                      <td className="px-3 py-2">
                        <Badge tone={r.action === "DIRECT" ? "success" : r.action === "REJECT" ? "danger" : "primary"}>{r.action === "DIRECT" ? tr("直连", "Direct") : r.action === "REJECT" ? tr("拦截", "Reject") : tr("代理", "Proxy")}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button size="sm" variant="ghost" icon="plus" className="mt-2">
              {tr("添加规则", "Add rule")}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title={tr("客户端一键导入", "One-click import")} description={tr("门户“导入到客户端”按钮显示哪些客户端。", "Clients shown on the portal's import buttons.")} />
        <CardBody className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {["Clash Verge", "mihomo", "Shadowrocket", "sing-box", "Stash", "Hiddify"].map((c) => (
            <div key={c} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-[13px]">
              {c}
              <Switch checked />
            </div>
          ))}
        </CardBody>
        <SaveBar />
      </Card>
    </>
  );
}

/* ---------------- Registration (D1, W27) ---------------- */
function SignupTab() {
  const tr = useTr();
  const [open, setOpen] = useState(true);
  return (
    <>
      <Card>
        <CardHeader title={tr("注册", "Registration")} description={tr("所有人用邮箱登录（D1）。两个开关互相独立，默认都关。", "Everyone signs in with email (D1). The two switches are independent; both off by default.")} />
        <CardBody className="divide-y divide-border py-1">
          <SettingRow title={tr("开放注册", "Open registration")}>
            <Switch checked={open} onChange={setOpen} />
          </SettingRow>
          <SettingRow title={tr("注册需要验证邮箱", "Require email verification")} description={tr("需要先配置好邮件；关闭时用工作量证明 + 限速防刷。", "Needs working mail; when off, proof-of-work + rate limits apply.")}>
            <Switch checked />
          </SettingRow>
          <SettingRow title={tr("注册需要邀请码", "Require an invite code")}>
            <Switch checked={false} />
          </SettingRow>
          <SettingRow title={tr("新用户试用套餐", "Trial plan for new users")}>
            <Select className="w-48" defaultValue="none">
              <option value="none">{tr("不赠送", "None")}</option>
              <option>入门 · 50G · 1 天</option>
            </Select>
          </SettingRow>
        </CardBody>
        <SaveBar />
      </Card>
      <Card>
        <CardHeader title={tr("防机器人", "Bot protection")} />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Turnstile Site Key">
              <Input defaultValue="0x4AAAAAAAB3…" className="font-mono text-[13px]" />
            </Field>
            <Field label="Turnstile Secret Key" hint={tr("已设置 · 加密存储", "Set · stored encrypted")}>
              <Input type="password" placeholder="••••••••（不修改请留空）" />
            </Field>
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium">{tr("在这些表单上启用 Turnstile", "Enable Turnstile on")}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                [tr("登录", "Sign in"), true],
                [tr("注册", "Register"), true],
                [tr("找回密码", "Password reset"), false],
              ].map(([l, v]) => (
                <div key={l as string} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-[13px]">
                  {l}
                  <Switch checked={v as boolean} />
                </div>
              ))}
            </div>
          </div>
          <SettingRow title={tr("蜜罐字段 + 最短提交时间", "Honeypot field + minimum fill time")} description={tr("默认开启。命中时返回与普通失败一样的响应，只记一次计数。近 7 天命中 1,284 次。", "On by default. Hits get the same response as a normal failure and are only counted. 1,284 hits in 7 days.")}>
            <Switch checked />
          </SettingRow>
        </CardBody>
        <SaveBar />
      </Card>
    </>
  );
}

/* ---------------- Mail (W31) ---------------- */
function MailTab() {
  const tr = useTr();
  const demo = useParam("demo");
  const [via, setVia] = useState<"smtp" | "resend">("smtp");
  const [tls, setTls] = useState("465");
  const [diag, setDiag] = useState(demo === "mail-test");
  useEffect(() => setDiag(demo === "mail-test"), [demo]);
  return (
    <>
      <Card>
        <CardHeader
          title={tr("发信方式", "Delivery")}
          actions={
            <Button size="sm" variant="primary" icon="mail" onClick={() => setDiag(true)}>
              {tr("测试发信", "Send test")}
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <Segmented
            value={via}
            onChange={setVia}
            options={[
              { value: "smtp", label: "SMTP" },
              { value: "resend", label: "Resend API" },
            ]}
          />
          {via === "smtp" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={tr("服务器", "Host")}>
                <Input defaultValue="smtp.example.com" className="font-mono text-[13px]" />
              </Field>
              <Field label={tr("端口与加密", "Port & TLS")}>
                <Select value={tls} onChange={(e) => setTls(e.target.value)}>
                  <option value="465">{tr("465 · 隐式 TLS", "465 · implicit TLS")}</option>
                  <option value="587">{tr("587 · STARTTLS", "587 · STARTTLS")}</option>
                </Select>
              </Field>
              <Field label={tr("用户名", "Username")}>
                <Input defaultValue="noreply@akari.example" />
              </Field>
              <Field label={tr("密码", "Password")} hint={tr("已设置 · 加密存储", "Set · stored encrypted")}>
                <Input type="password" placeholder={tr("不修改请留空", "leave empty to keep")} />
              </Field>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="API Key" hint={tr("re_ 开头；加密存储", "Starts with re_; stored encrypted")}>
                <Input type="password" placeholder="re_••••••••" />
              </Field>
              <Field label={tr("已验证的发信域名", "Verified sending domain")}>
                <Input defaultValue="mail.akari.example" className="font-mono text-[13px]" />
              </Field>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tr("发件人地址", "From address")}>
              <Input defaultValue="noreply@akari.example" />
            </Field>
            <Field label={tr("发件人名称", "From name")}>
              <Input defaultValue="Akari 云" />
            </Field>
          </div>
        </CardBody>
        <SaveBar note={tr("发信插件：SMTP、Resend；以后加服务商只需新增一个模块。", "Providers: SMTP, Resend; new providers are one module each.")} />
      </Card>
      <MailDiagDialog open={diag} onClose={() => (setDiag(false), demo && setParams({ demo: null }, true))} />
    </>
  );
}

function MailDiagDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tr = useTr();
  const steps: { ok: boolean | null; title: string; detail: string }[] = [
    { ok: true, title: tr("解析 smtp.example.com", "Resolve smtp.example.com"), detail: "203.0.113.45 · 12 ms" },
    { ok: true, title: tr("连接端口 465", "Connect to port 465"), detail: tr("TCP 已连通 · 38 ms", "TCP connected · 38 ms") },
    { ok: true, title: tr("TLS 握手（隐式 TLS）", "TLS handshake (implicit TLS)"), detail: tr("TLS 1.3 · 证书有效（smtp.example.com）", "TLS 1.3 · certificate valid") },
    { ok: false, title: tr("SMTP 认证", "SMTP authentication"), detail: "535 5.7.8 Authentication credentials invalid" },
    { ok: null, title: tr("发送测试邮件到 ops@akari.example", "Send test mail to ops@akari.example"), detail: tr("未执行", "Skipped") },
  ];
  return (
    <Dialog
      open={open}
      onClose={onClose}
      icon="mail"
      tone="warning"
      wide
      title={tr("测试发信：认证失败", "Test send: authentication failed")}
      footer={
        <>
          <Button onClick={onClose}>{tr("关闭", "Close")}</Button>
          <Button variant="primary" icon="refresh">
            {tr("重新测试", "Test again")}
          </Button>
        </>
      }
    >
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 rounded-md border border-border px-3 py-2">
            <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", s.ok === true ? "bg-success-soft text-success" : s.ok === false ? "bg-destructive-soft text-destructive" : "bg-muted text-muted-foreground")}>
              <Icon name={s.ok === true ? "check" : s.ok === false ? "x" : "more"} size={12} strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-medium">{s.title}</div>
              <div className="font-mono text-xs text-muted-foreground">{s.detail}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3">
        <Callout tone="warning" title={tr("可能的原因", "Likely cause")}>
          {tr("服务器拒绝了用户名或密码。很多邮箱服务要求使用“授权码 / 应用专用密码”而不是登录密码；请在邮箱服务商后台生成后填入。", "The server rejected the username or password. Many providers require an app-specific password instead of the login password; generate one in the provider's console.")}
        </Callout>
      </div>
    </Dialog>
  );
}

/* ---------------- Block rules (W29) ---------------- */
function BlockTab() {
  const tr = useTr();
  return (
    <>
      <Callout tone="info" title={tr("规则在面板里编译，agent 只写进 xray 路由（sniffing + blackhole）", "Rules compile in the panel; agents only write them into xray routing (sniffing + blackhole)")}>
        {tr("按节点开关，默认关闭（节点页每个节点有“审计规则”开关）。只统计每个节点的拦截次数，不记录用户访问明细。", "Toggled per node, off by default (see the switch on each node). Only per-node hit counts are kept — no per-user browsing records.")}
      </Callout>
      <Card>
        <CardHeader
          title={tr("规则集", "Rule sets")}
          description={tr("已在 4 / 6 个节点上启用", "Enabled on 4 / 6 nodes")}
          actions={
            <Button size="sm" icon="plus">
              {tr("自定义规则集", "Custom rule set")}
            </Button>
          }
        />
        <ul className="divide-y divide-border">
          {blockRuleSets.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[13px] font-medium">
                  {tr(r.name, r.nameEn)}
                  {r.builtin ? <Badge tone="outline">{tr("内置", "Built-in")}</Badge> : <Badge tone="info">{tr("自定义", "Custom")}</Badge>}
                  <Badge>{r.kind === "protocol" ? tr("协议识别", "Protocol") : tr(`域名 ${r.rules} 条`, `${r.rules} domains`)}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{tr(`近 7 天拦截 ${r.hits.toLocaleString()} 次`, `${r.hits.toLocaleString()} blocks in 7 days`)}</div>
              </div>
              {!r.builtin && (
                <Button size="sm" variant="ghost">
                  {tr("编辑", "Edit")}
                </Button>
              )}
              <Switch checked={r.enabled} />
            </li>
          ))}
        </ul>
        <SaveBar note={tr("修改会让启用了审计规则的节点重建一次 xray（断开连接）。", "Changes rebuild xray once on nodes with block rules on (connections drop).")} />
      </Card>
      <Card>
        <CardHeader title={tr("编辑：自定义：挖矿池", "Edit: Custom: mining pools")} />
        <CardBody className="space-y-3">
          <Field label={tr("类型", "Type")}>
            <Segmented value="domain" onChange={() => {}} options={[{ value: "domain", label: tr("域名", "Domain") }, { value: "ip", label: "IP / CIDR" }, { value: "protocol", label: tr("协议", "Protocol") }]} />
          </Field>
          <Field label={tr("规则（每行一条，支持 domain: / full: / keyword:）", "Rules (one per line; domain: / full: / keyword:)")}>
            <Textarea rows={5} defaultValue={"domain:minexmr.com\ndomain:supportxmr.com\nkeyword:nanopool\nfull:pool.hashvault.pro"} />
          </Field>
        </CardBody>
      </Card>
    </>
  );
}

/* ---------------- Account cleanup (D10) ---------------- */
function CleanupTab() {
  const tr = useTr();
  const [auto, setAuto] = useState(false);
  return (
    <Card>
      <CardHeader title={tr("清理从未使用的账号", "Clean up never-used accounts")} description={tr("“从未使用” = 注册超过 N 天，从没有过套餐、付过款、产生流量、有余额或提交工单。管理员和有任何财务记录的账号永远不算。", "“Never used” = registered over N days ago with no plan, payment, traffic, balance or ticket ever. Admins and accounts with any financial record never count.")} />
      <CardBody className="divide-y divide-border py-1">
        <SettingRow title={tr("自动清理", "Automatic cleanup")} description={tr("默认关闭。每天 04:00（站点时区）运行一次。", "Off by default. Runs daily at 04:00 site time.")}>
          <Switch checked={auto} onChange={setAuto} />
        </SettingRow>
        <SettingRow title={tr("注册超过天数 N", "Registered more than N days")}>
          <Input className="w-24 text-right tabular-nums" defaultValue="30" />
        </SettingRow>
        <SettingRow title={tr("删除前发邮件提醒", "Email a notice before deleting")} description={tr("提前 7 天发送；期间登录一次即保留。只发给已验证邮箱。", "Sent 7 days ahead; signing in once keeps the account. Verified emails only.")}>
          <Switch checked />
        </SettingRow>
      </CardBody>
      <CardBody className="border-t border-border">
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-subtle px-3 py-2.5 text-[13px]">
          <Icon name="users" size={16} className="text-muted-foreground" />
          <span className="flex-1">{tr("按当前设置，现在有 46 个账号符合条件。", "46 accounts match the current settings right now.")}</span>
          <Button size="sm" onClick={() => setParams({ page: "users", filter: "never", tab: null })}>
            {tr("在用户列表中查看", "View in users")}
          </Button>
        </div>
      </CardBody>
      <SaveBar />
    </Card>
  );
}
