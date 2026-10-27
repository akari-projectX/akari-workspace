// Captures every prototype page at 1440px and 390px, light and dark, plus
// interaction states (drawers, dialogs, palette, loading/empty/error).
// Usage: npm run build && npm run screenshots   (starts `vite preview` itself)
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}/`;
const OUT = new URL("../screenshots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const pages = ["login", "dashboard", "users", "nodes", "plans", "orders", "settings", "status"];

// [file name, query, full page?]
const extras = [
  ["login-passkey-only", "page=login&mode=passkey"],
  ["login-bind-passkey", "page=login&demo=bind"],
  ["palette", "page=dashboard&demo=palette"],
  ["dashboard-loading", "page=dashboard&state=loading"],
  ["users-drawer", "page=users&open=u-19be04"],
  ["users-drawer-banned", "page=users&open=u-5d11f2"],
  ["users-ban-dialog", "page=users&open=u-7f3a2c&demo=ban"],
  ["users-new", "page=users&demo=new-user"],
  ["users-never-used", "page=users&filter=never", true],
  ["users-bulk-delete", "page=users&filter=never&demo=bulk-delete"],
  ["users-loading", "page=users&state=loading"],
  ["users-empty", "page=users&state=empty"],
  ["nodes-entrance-rates", "page=nodes&open=e-hk-iplc"],
  ["nodes-entrance-down", "page=nodes&open=e-hk-bgp"],
  ["nodes-quota", "page=nodes&demo=quota"],
  ["nodes-error", "page=nodes&state=error"],
  ["plans-groups", "page=plans&tab=groups", true],
  ["plans-drawer", "page=plans&open=p-pro"],
  ["orders-drawer", "page=orders&open=o4"],
  ["settings-security", "page=settings&tab=security", true],
  ["settings-rotate-prefix", "page=settings&tab=security&demo=rotate-prefix"],
  ["settings-delete-domain", "page=settings&tab=site&demo=delete-domain"],
  ["settings-subscription", "page=settings&tab=subscription", true],
  ["settings-sub-path", "page=settings&tab=subscription&demo=sub-path"],
  ["settings-signup", "page=settings&tab=signup", true],
  ["settings-mail-test", "page=settings&tab=mail&demo=mail-test"],
  ["settings-block-rules", "page=settings&tab=block", true],
  ["settings-cleanup", "page=settings&tab=cleanup", true],
];

const viewports = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("preview server did not start");
}

const server = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
try {
  await waitForServer();
  // Use a pre-installed Chromium when present (CI/cloud images); else Playwright's own.
  const exe = process.env.CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  const browser = await chromium.launch({ executablePath: exe });
  const shots = [];
  for (const theme of ["light", "dark"])
    for (const [vpName, vp] of Object.entries(viewports)) {
      for (const p of pages) shots.push({ name: `${p}`, q: `page=${p}`, full: true, theme, vpName, vp });
      for (const [name, q, full] of extras) shots.push({ name, q, full: !!full, theme, vpName, vp });
    }
  // Keep the matrix complete for main pages; extras: desktop light + phone dark only (size budget).
  const wanted = shots.filter((s) => pages.includes(s.name) || (s.vpName === "desktop" && s.theme === "light") || (s.vpName === "phone" && s.theme === "dark"));
  for (const s of wanted) {
    const { width, height, ...dev } = s.vp;
    const ctx = await browser.newContext({ viewport: { width, height }, ...dev, colorScheme: s.theme, locale: "zh-CN", timezoneId: "Asia/Shanghai" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}?${s.q}&theme=${s.theme}`, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important} .skeleton{background:var(--muted)!important}" });
    await page.waitForTimeout(150);
    const file = `${OUT}${s.name}-${s.vpName}-${s.theme}.png`;
    await page.screenshot({ path: file, fullPage: s.full });
    await ctx.close();
    process.stdout.write(".");
  }
  await browser.close();
  console.log(`\n${wanted.length} screenshots → ${OUT}`);
} finally {
  server.kill();
}
