import { chromium } from '/home/lam/projectX/akari-workspace/.work/portal-restore/akari-panel/portal/node_modules/@playwright/test/index.mjs';
const b = await chromium.launch(); await fetch(`http://127.0.0.1:18480/__mock?s=${encodeURIComponent(JSON.stringify({signedIn:true,scope:'full'}))}`);
for (const port of [5173,5174]) { const p = await (await b.newContext({viewport:{width:1440,height:900},locale:'zh-CN',reducedMotion:'reduce'})).newPage();
 await p.goto(`http://localhost:${port}/`); await p.waitForSelector('.wk');await p.waitForTimeout(800);
 console.log(port, await p.evaluate(()=>{const root=[...document.querySelectorAll('main > div > *')][1];const o=[];const walk=(e,d)=>{if(d>5)return;for(const c of e.children){const r=c.getBoundingClientRect();o.push('  '.repeat(d)+`${c.tagName}.${(c.className+'').slice(0,25)} ${Math.round(r.y+scrollY)}+${Math.round(r.height*10)/10} x${Math.round(r.x)}w${Math.round(r.width)}`);walk(c,d+1)}};walk(root,0);return o.join('\n')}));}
await b.close();
