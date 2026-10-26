// usage: node shot.mjs <name> <path> [--scope=full|expired|banned] [--guest] [--pre="js"] [--sel=css]  -> out/<name>-{ref,new}-<device>-<theme>.png and out/<name>-cmp-... side by side (ref | new)
import { chromium } from '/home/lam/projectX/akari-workspace/.work/portal-restore/akari-panel/portal/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
const [name, path, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const devices = (opt.devices ?? 'desktop,mobile').split(','), themes = (opt.themes ?? 'light,dark').split(',');
const VP = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const out = '/home/lam/projectX/akari-workspace/.work/portal-restore/harness/out'; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
await fetch(`http://127.0.0.1:18480/__mock?s=${encodeURIComponent(JSON.stringify({ signedIn: !('guest' in opt), scope: opt.scope ?? 'full' }))}`);
for (const device of devices) for (const theme of themes) {
  for (const [k, port] of [['ref', 5173], ['new', 5174]]) {
    if (opt.only && opt.only !== k) continue;
    const ctx = await browser.newContext({ ...VP[device], locale: 'zh-CN', colorScheme: theme, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${port}${path}`);
    await page.locator('main h1, main h2, form').first().waitFor({ timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(600);
    if (opt.pre) await page.evaluate(opt.pre).catch((e) => console.log('pre', e.message));
    if (opt.click) { await page.locator(opt.click).first().click().catch((e) => console.log('click', e.message.split('\n')[0])); await page.waitForTimeout(500); }
    const f = `${out}/${name}-${k}-${device}-${theme}.png`;
    if (opt.clip) { const [x, y, width, height] = opt.clip.split(',').map(Number); await page.screenshot({ path: f, fullPage: true, clip: { x, y, width, height } }); } else if (opt.sel) await page.locator(opt.sel).first().screenshot({ path: f }); else await page.screenshot({ path: f, fullPage: opt.full !== '0' });
    await ctx.close();
  }
  if (!opt.only) {
    const html = (d) => `<body style="margin:0;display:flex;gap:8px;background:#888">${['ref','new'].map((k) => `<img src="data:image/png;base64,${fs.readFileSync(`${out}/${name}-${k}-${device}-${theme}.png`).toString('base64')}" style="height:auto;width:${d === 'desktop' ? 1440 : 390}px">`).join('')}</body>`;
    const p2 = await browser.newPage({ viewport: { width: (device === 'desktop' ? 2888 : 788), height: 600 } });
    await p2.setContent(html(device)); await p2.waitForTimeout(300);
    await p2.screenshot({ path: `${out}/${name}-cmp-${device}-${theme}.png`, fullPage: true }); await p2.close();
  }
}
await browser.close();
