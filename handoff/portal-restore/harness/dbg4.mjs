import { chromium } from '/home/lam/projectX/akari-workspace/.work/portal-restore/akari-panel/portal/node_modules/@playwright/test/index.mjs';
const b=await chromium.launch();
for(const port of [5173,5174]){const p=await (await b.newContext({viewport:{width:1440,height:900},locale:'zh-CN'})).newPage();
await p.goto(`http://localhost:${port}/tickets`);await p.waitForTimeout(1800);
await p.locator('text=节点连接超时').first().click();await p.waitForTimeout(800);
console.log(port,JSON.stringify(await p.evaluate(()=>{const f=document.querySelector('[role=dialog] footer');const o=[];const w=(e,d)=>{const r=e.getBoundingClientRect();o.push([d,e.tagName,(e.className+'').slice(0,18),Math.round(r.height),getComputedStyle(e).lineHeight]);if(d<3)for(const c of e.children)w(c,d+1)};w(f,0);return o})))}
await b.close()
