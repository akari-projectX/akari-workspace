import { chromium } from '/home/lam/projectX/akari-workspace/.work/portal-restore/akari-panel/portal/node_modules/@playwright/test/index.mjs';
const b=await chromium.launch();
for(const port of [5173,5174]){const p=await (await b.newContext({viewport:{width:1440,height:900},locale:'zh-CN'})).newPage();
await p.goto(`http://localhost:${port}/announcements`);await p.waitForTimeout(1800);
await p.locator('text=阅读全文').first().click();await p.waitForTimeout(800);
console.log(port,JSON.stringify(await p.evaluate(()=>{const d=document.querySelector('[role=dialog]');const o=[];const q=(e,l)=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);o.push([l,Math.round(r.y),Math.round(r.height),c.fontSize,c.letterSpacing,c.padding])};q(d,'dlg');for(const e of d.children)q(e,e.tagName+'.'+(e.className+'').slice(0,12));const h=d.querySelector('h2,[data-dialog-title]');q(h,'h2');q(h.parentElement,'hp');const ff=d.querySelector('button.btn,button[class*=group]:last-of-type');q(ff.parentElement,'formpar');q(d.querySelector('footer')||d.lastElementChild,'foot');return o}))) }
await b.close()
