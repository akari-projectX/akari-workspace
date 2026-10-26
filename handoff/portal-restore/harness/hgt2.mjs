import { chromium } from '/home/lam/projectX/akari-workspace/.work/portal-restore/akari-panel/portal/node_modules/@playwright/test/index.mjs';
const b = await chromium.launch(); await fetch(`http://127.0.0.1:18480/__mock?s=${encodeURIComponent(JSON.stringify({signedIn:true,scope:'full'}))}`);
for (const port of [5173,5174]) { const p = await (await b.newContext({viewport:{width:1440,height:900},locale:'zh-CN',reducedMotion:'reduce'})).newPage();
 await p.goto(`http://localhost:${port}/`); await p.waitForSelector('.wk',{timeout:15000}).catch(()=>console.log('no wk'));await p.waitForTimeout(800);
 console.log(port, await p.evaluate(()=>{let e=document.querySelector('.wk'),o=[];while(e&&e.tagName!=='BODY'){const r=e.getBoundingClientRect();o.push(`${e.tagName}.${(e.className+'').slice(0,20)} ${Math.round(r.y+scrollY)}+${r.height}`);e=e.parentElement}return o.join(' | ')}));
 console.log(await p.evaluate(()=>[...document.querySelectorAll('main > div > *, main > div > section > *')].map(e=>`${e.tagName}.${(e.className+'').slice(0,12)} ${Math.round(e.getBoundingClientRect().y+scrollY)}+${e.getBoundingClientRect().height}`).join(' | ')));}
await b.close();
