import { chromium } from '/home/lam/projectX/akari-workspace/.work/portal-restore/akari-panel/portal/node_modules/@playwright/test/index.mjs';
const b=await chromium.launch();
for(const port of [5173,5174]){const p=await (await b.newContext({viewport:{width:1440,height:900},locale:'zh-CN'})).newPage();
await p.goto(`http://localhost:${port}/tickets`);await p.waitForTimeout(1800);
await p.locator('button:has-text("提交工单")').first().click();await p.waitForTimeout(800);
console.log(port,JSON.stringify(await p.evaluate(()=>{const g=(e)=>{if(!e)return null;const c=getComputedStyle(e),r=e.getBoundingClientRect();return [Math.round(r.y),Math.round(r.height),Math.round(r.width),c.fontSize,c.lineHeight,c.padding,c.borderRadius,c.fontWeight,c.marginBottom]};
const d=document.querySelector('[role=dialog]');return {dlg:g(d),ta:g(d.querySelector('textarea')),lab:g(d.querySelector('label')),leg:g(d.querySelector('legend')),opt:g(d.querySelector('fieldset label')),hint:g(d.querySelector('fieldset p')),inp:g(d.querySelector('input:not([type=radio])')),sel:g(d.querySelector('button[role=combobox]')),form:g(d.querySelector('form'))}})))}
await b.close()
