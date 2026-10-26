import { chromium } from '/home/lam/projectX/akari-workspace/.work/portal-restore/akari-panel/portal/node_modules/@playwright/test/index.mjs';
const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1440,height:900},locale:'zh-CN'})).newPage();
p.on('console',m=>console.log('C',m.text().slice(0,200)));p.on('pageerror',e=>console.log('E',e.message));
await p.goto(`http://localhost:5174/tickets`);await p.waitForTimeout(1800);
await p.locator('text=节点连接超时').first().click();await p.waitForTimeout(1500);
console.log(await p.evaluate(()=>[document.querySelectorAll('[role=dialog]').length,location.href]));await p.screenshot({path:'out/t.png'});await b.close()
