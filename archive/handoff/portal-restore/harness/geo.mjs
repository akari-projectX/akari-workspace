// node geo.mjs <path> [--device=desktop|mobile] [--guest] [--click=css] [--pre=js] [--scope=..] -> text-anchored geometry+style diff (ref vs new)
import { chromium } from '/home/lam/projectX/akari-workspace/.work/portal-restore/akari-panel/portal/node_modules/@playwright/test/index.mjs';
const [path, ...rest] = process.argv.slice(2);
const o = Object.fromEntries(rest.map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const mobile = o.device === 'mobile', dark = o.theme === 'dark';
const b = await chromium.launch();
await fetch(`http://127.0.0.1:18480/__mock?s=${encodeURIComponent(JSON.stringify({ signedIn: !('guest' in o), scope: o.scope ?? 'full' }))}`);
const grab = async (port) => {
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  const p = await (await b.newContext({ ...(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } }), locale: 'zh-CN', colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce' })).newPage();
  await p.goto(`http://localhost:${port}${port === 5173 && process.env.REFPATH ? process.env.REFPATH : path}`);
  await p.locator('main h1, main h2, form').first().waitFor({ timeout: 15000 }).catch(() => {});
  await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(900);
  if (o.pre) await p.evaluate(o.pre).catch((e) => console.log('pre', e.message));
  if (o.click) { await p.locator(o.click).first().click().catch((e) => console.log('click', e.message.split('\n')[0])); await p.waitForTimeout(700); }
  return p.evaluate(() => {
    const out = []; const seen = {};
    const roots = [...document.querySelectorAll('main, [role=dialog], [role=alertdialog]')];
    const els = [...document.querySelectorAll('body *')];
    for (const e of els) {
      if (!roots.some((r) => r.contains(e)) || e.closest('script,style,svg')) continue;
      const nodes = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
      if (!nodes.length) continue;
      const tx = nodes.map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim();
      const r = document.createRange(); r.setStartBefore(nodes[0]); r.setEndAfter(nodes[nodes.length - 1]);
      const rc = nodes.length === 1 ? (() => { const q = document.createRange(); q.selectNodeContents(nodes[0]); return q.getBoundingClientRect(); })() : r.getBoundingClientRect();
      if (!rc.width) continue;
      const c = getComputedStyle(e); const key = tx.slice(0, 30); seen[key] = (seen[key] ?? 0) + 1;
      out.push({ k: `${key}#${seen[key]}`, x: Math.round(rc.x), y: Math.round(rc.y + scrollY), w: Math.round(rc.width), h: Math.round(rc.height), fs: c.fontSize, fw: c.fontWeight, col: c.color, ls: c.letterSpacing });
    }
    return out;
  });
};
const A = await grab(5173), B = await grab(5174); await b.close();
const mb = new Map(B.map((x) => [x.k, x])); let diffs = 0;
for (const a of A) { const x = mb.get(a.k); if (!x) { console.log('ONLY-REF', a.k, a.x, a.y); diffs++; continue; }
  const d = []; if (Math.abs(a.x - x.x) > 1) d.push(`x ${a.x}->${x.x}`); if (Math.abs(a.y - x.y) > 1) d.push(`y ${a.y}->${x.y}`); if (Math.abs(a.w - x.w) > 2) d.push(`w ${a.w}->${x.w}`);
  for (const k of ['fs', 'fw', 'col', 'ls']) if (a[k] !== x[k]) d.push(`${k} ${a[k]}->${x[k]}`);
  if (d.length) { console.log(a.k, d.join(' ; ')); diffs++; mb.delete(a.k); } else mb.delete(a.k); }
for (const x of mb.values()) { console.log('ONLY-NEW', x.k, x.x, x.y); diffs++; }
console.log('diffs', diffs, 'of', A.length);
