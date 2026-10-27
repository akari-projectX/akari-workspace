import { chromium } from '/home/lam/projectX/akari-workspace/.work/portal-restore/akari-panel/portal/node_modules/@playwright/test/index.mjs';
const [path, ...sels] = process.argv.slice(2);
const b = await chromium.launch(); await fetch(`http://127.0.0.1:18480/__mock?s=${encodeURIComponent(JSON.stringify({signedIn:true,scope:'full'}))}`);
for (const port of [5173,5174]) { const p = await (await b.newContext({viewport:{width:1440,height:900},locale:'zh-CN',reducedMotion:'reduce'})).newPage();
 await p.goto(`http://localhost:${port}${path}`); await p.waitForTimeout(3500);
 console.log(port, JSON.stringify(await p.evaluate((sels)=>sels.map(s=>[...document.querySelectorAll(s)].slice(0,4).map(e=>{const r=e.getBoundingClientRect();return `${Math.round(r.y)}+${Math.round(r.height*10)/10}`})),sels)));}
await b.close();
