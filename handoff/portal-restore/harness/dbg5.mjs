import { chromium } from '/home/lam/projectX/akari-workspace/.work/portal-restore/akari-panel/portal/node_modules/@playwright/test/index.mjs';
const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1440,height:900},locale:'zh-CN'})).newPage();
p.on('pageerror',e=>console.log('E',e.message));
await p.goto(`http://localhost:5174/`);await p.waitForTimeout(2000);
await p.evaluate(()=>scrollTo(0,300));
await p.locator('header a:has-text("商店")').first().click();
for(const ms of [30,60,200,500]){await p.waitForTimeout(ms);console.log(ms,await p.evaluate(()=>[location.pathname,scrollY,document.querySelector('.page')?.className,getComputedStyle(document.querySelector('.page')).opacity,document.querySelector('main h1')?.textContent]))}
await b.close()
