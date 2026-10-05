import { useState } from "react";
import { useTr } from "../lib/i18n";
import { navigate, useParam } from "../lib/route";
import { Icon } from "../ui/icons";
import { Button, Callout, Field, Input } from "../ui/primitives";

/*
 * Admin login (D1 email, D4 secret prefix, D7 passkey; no TOTP anywhere).
 * ?mode=passkey  → "仅允许通行密钥登录" policy is on
 * ?demo=bind     → prompt shown after a password login (bind a passkey)
 */
export function LoginPage({ theme, onTheme, onLang }: { theme: "light" | "dark"; onTheme: () => void; onLang: () => void }) {
  const tr = useTr();
  const mode = useParam("mode");
  const demo = useParam("demo");
  const passkeyOnly = mode === "passkey";
  const [email, setEmail] = useState("ops@akari.example");
  const [pw, setPw] = useState("");

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-subtle px-4 py-10">
      <div className="absolute right-3 top-3 flex gap-1">
        <Button variant="ghost" size="icon-sm" icon="languages" onClick={onLang} aria-label="language" />
        <Button variant="ghost" size="icon-sm" icon={theme === "dark" ? "sun" : "moon"} onClick={onTheme} aria-label="theme" />
      </div>
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-card">A</div>
          <h1 className="text-lg font-semibold">{tr("Akari 管理后台", "Akari admin console")}</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">akari.example/<span className="rounded bg-warning-soft px-1 text-warning">k7Qm…x2</span>/</p>
        </div>

        {demo === "bind" ? (
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon name="fingerprint" size={22} />
            </div>
            <h2 className="text-base font-semibold">{tr("绑定通行密钥", "Add a passkey")}</h2>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {tr(
                "你刚刚用密码登录。绑定通行密钥后，可以用指纹、面容或安全密钥登录，比密码更安全。本站策略：绑定后关闭此账户的密码登录。",
                "You just signed in with a password. With a passkey you can sign in with fingerprint, face or a security key. Site policy: password sign-in is turned off for this account after binding.",
              )}
            </p>
            <div className="mt-5 space-y-2">
              <Button variant="primary" size="lg" className="w-full" icon="fingerprint" onClick={() => navigate("dashboard")}>
                {tr("现在绑定", "Add passkey now")}
              </Button>
              <Button variant="ghost" size="lg" className="w-full" onClick={() => navigate("dashboard")}>
                {tr("稍后（下次登录还会提示）", "Later (ask again next time)")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <Button variant={passkeyOnly ? "primary" : "secondary"} size="lg" className="w-full" icon="fingerprint" onClick={() => navigate("dashboard")}>
              {tr("使用通行密钥登录", "Sign in with a passkey")}
            </Button>
            {passkeyOnly ? (
              <div className="mt-4">
                <Callout tone="info">{tr("本站已设置为仅允许通行密钥登录。丢失设备时，请用服务器上的 akari admin 命令恢复。", "This site only allows passkey sign-in. If you lost your device, recover with the akari admin CLI on the server.")}</Callout>
              </div>
            ) : (
              <>
                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  {tr("或使用邮箱和密码", "or email and password")}
                  <div className="h-px flex-1 bg-border" />
                </div>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    window.location.search = "?page=login&demo=bind";
                  }}
                >
                  <Field label={tr("邮箱", "Email")}>
                    <Input type="email" autoComplete="username webauthn" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </Field>
                  <Field label={tr("密码", "Password")}>
                    <Input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••••" />
                  </Field>
                  {/* Turnstile slot (W27; per-form switch in settings) */}
                  <div className="flex h-14 items-center gap-3 rounded-md border border-border bg-subtle px-3 text-[13px]">
                    <span className="flex h-5 w-5 items-center justify-center rounded border border-success bg-success-soft text-success">
                      <Icon name="check" size={12} strokeWidth={3} />
                    </span>
                    <span className="flex-1">{tr("验证成功", "Success!")}</span>
                    <span className="text-[10px] leading-tight text-muted-foreground">Cloudflare
                      <br />
                      Turnstile
                    </span>
                  </div>
                  <Button type="submit" variant="primary" size="lg" className="w-full">
                    {tr("登录", "Sign in")}
                  </Button>
                </form>
              </>
            )}
          </div>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {tr("后台地址只有管理员知道；门户不会链接到这里。", "Only admins know this address; the portal never links here.")}
        </p>
      </div>
    </div>
  );
}
