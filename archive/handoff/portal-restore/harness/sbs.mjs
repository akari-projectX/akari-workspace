// node sbs.mjs <refDir> <ciDir> <outDir>
import { chromium } from '/home/lam/projectX/akari-workspace/.work/portal-restore/akari-panel/portal/node_modules/@playwright/test/index.mjs';
import { readdirSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
const [ref, ci, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch(); const p = await b.newPage();
const names = readdirSync(ref).filter((f) => f.endsWith('.png') && !f.startsWith('usdt-'));
const miss = [];
for (const f of names) {
  if (!existsSync(`${ci}/${f}`)) { miss.push(f); continue; }
  const a = readFileSync(`${ref}/${f}`).toString('base64'), c = readFileSync(`${ci}/${f}`).toString('base64');
  const mobile = f.includes('-mobile');
  await p.setViewportSize({ width: mobile ? 1000 : 2900, height: 800 });
  await p.setContent(`<body style="margin:0;background:#888;display:flex;gap:12px;align-items:flex-start"><img style="width:${mobile ? 490 : 1440}px" src="data:image/png;base64,${a}"><img style="width:${mobile ? 490 : 1440}px" src="data:image/png;base64,${c}"></body>`);
  await p.screenshot({ path: `${out}/${f}`, fullPage: true });
}
console.log('done', names.length - miss.length, 'missing', miss.join(' '));
await b.close();
