// node probe.mjs <port> <path> <css> [guest] -> computed style subset of matching elements
import { chromium } from '/home/lam/projectX/akari-workspace/.work/portal-restore/akari-panel/portal/node_modules/@playwright/test/index.mjs';
const [port, path, sel, guest] = process.argv.slice(2);
const b = await chromium.launch();
await fetch(`http://127.0.0.1:18480/__mock?s=${encodeURIComponent(JSON.stringify({ signedIn: !guest }))}`);
const p = await (await b.newContext({ viewport: { width: +(process.env.VW||1440), height: 900 }, hasTouch: !!process.env.VW, isMobile: !!process.env.VW, locale: 'zh-CN', reducedMotion: 'reduce' })).newPage();
await p.goto(`http://localhost:${port}${path}`); await p.waitForTimeout(1500);
const r = await p.evaluate((sel) => [...document.querySelectorAll(sel)].slice(0, 6).map((e) => { const c = getComputedStyle(e), r = e.getBoundingClientRect();
  const k = ['fontSize','fontWeight','lineHeight','letterSpacing','color','backgroundColor','borderRadius','borderTopWidth','borderTopColor','paddingTop','paddingLeft','marginTop','marginBottom','boxShadow','gap'];
  return `${e.tagName}.${e.className.toString().slice(0,50)} [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}] "${(e.textContent||'').trim().slice(0,20)}" ` + k.map((x) => `${x}=${c[x]}`).filter(s=>!/=(0px|none|normal|rgba\(0, 0, 0, 0\))$/.test(s)).join(' '); }), sel);
console.log(r.join('\n')); await b.close();
