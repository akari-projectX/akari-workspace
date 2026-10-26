import { chromium } from '/home/lam/projectX/akari-workspace/.work/portal-restore/akari-panel/portal/node_modules/@playwright/test/index.mjs';
const [path, click, sel] = process.argv.slice(2);
const b = await chromium.launch(); await fetch(`http://127.0.0.1:18480/__mock?s=${encodeURIComponent(JSON.stringify({signedIn:true,scope:'full'}))}`);
const p = await (await b.newContext({viewport:{width:1440,height:900},locale:'zh-CN',reducedMotion:'reduce'})).newPage();
await p.goto(`http://localhost:5174${path}`); await p.waitForTimeout(2500); if(click){await p.locator(click).first().click(); await p.waitForTimeout(600);}
console.log(await p.evaluate((s)=>[...document.querySelectorAll(s)].slice(0,3).map(e=>e.outerHTML.slice(0,400)).join('\n---\n'),sel)); await b.close();
