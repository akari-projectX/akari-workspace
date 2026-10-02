// UX audit crawler: screenshots + DOM/a11y/overflow/console metrics for every page & flow.
import { chromium } from "/tmp/claude-1000/-home-lam-projectX/4078da57-e661-4797-999a-0f6d1eb80fe8/scratchpad/ux-audit/src/spa/node_modules/@playwright/test/index.mjs";
import fs from "node:fs";

const UX = "/tmp/claude-1000/-home-lam-projectX/4078da57-e661-4797-999a-0f6d1eb80fe8/scratchpad/ux-audit";
const PREFIX = fs.readFileSync(`${UX}/run/prefix`, "utf8").trim();
const ORIGIN = "http://127.0.0.1:8190";
const APP = `${ORIGIN}/${PREFIX}/app`;
const ADMIN = `${ORIGIN}/${PREFIX}/admin`;
const AXE = fs.readFileSync(`${UX}/axe/node_modules/axe-core/axe.min.js`, "utf8");
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
fs.mkdirSync(`${UX}/shots`, { recursive: true });
fs.mkdirSync(`${UX}/texts`, { recursive: true });
const results = [];
const VP = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

async function ctxFor(browser, vp, locale) {
  const ctx = await browser.newContext({
    viewport: VP[vp],
    locale: locale === "zh" ? "zh-CN" : "en-US",
    timezoneId: "Asia/Shanghai",
    isMobile: vp === "phone",
    hasTouch: vp === "phone",
    deviceScaleFactor: vp === "phone" ? 2 : 1,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await ctx.addInitScript((l) => {
    try { localStorage.setItem("akari.locale", l); } catch {}
  }, locale);
  return ctx;
}

function instrument(page, rec) {
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") rec.console.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => rec.console.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("/metrics")) rec.http.push(`${r.status()} ${r.request().method()} ${r.url().replace(ORIGIN, "")}`);
  });
  page.on("dialog", async (d) => {
    rec.dialogs.push(`${d.type()}: ${d.message().slice(0, 200)}`);
    await d.dismiss().catch(() => {});
  });
}

async function settle(page, ms = 600) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function snap(page, name, rec, extra = {}) {
  if (ONLY && !ONLY.test(name)) return;
  await settle(page);
  const file = `shots/${name}.png`;
  await page.screenshot({ path: `${UX}/${file}`, fullPage: true }).catch((e) => rec.console.push(`shot: ${e.message}`));
  const dom = await page.evaluate(() => {
    const vw = window.innerWidth;
    const doc = document.scrollingElement;
    const over = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden") continue;
      // inside a horizontally scrollable container -> fine
      let p = el.parentElement, scrolled = false;
      while (p && p !== document.body) {
        const ps = getComputedStyle(p);
        if (/(auto|scroll|hidden)/.test(ps.overflowX)) { scrolled = true; break; }
        p = p.parentElement;
      }
      if (!scrolled && r.right > vw + 1) over.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 40)} right=${Math.round(r.right)} "${(el.innerText || "").slice(0, 40).replace(/\s+/g, " ")}"`);
      // text clipped inside its own box
      if (el.scrollWidth > el.clientWidth + 2 && /(hidden|clip)/.test(cs.overflowX) && !/ellipsis/.test(cs.textOverflow) && el.children.length === 0)
        over.push(`clipped ${el.tagName.toLowerCase()} "${(el.innerText || "").slice(0, 40)}"`);
    }
    const text = document.body.innerText;
    // controls without accessible name
    const unl = [];
    for (const el of document.querySelectorAll("input,select,textarea")) {
      if (el.type === "hidden") continue;
      const id = el.id;
      const lab = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) || el.closest("label");
      if (!lab && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.title)
        unl.push(`${el.tagName.toLowerCase()}[${el.type || ""}] name=${el.name} ph=${el.placeholder}`);
    }
    // small tap targets on phone
    const small = [];
    if (vw < 500) for (const el of document.querySelectorAll("button,a,input[type=checkbox],input[type=radio]")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.height < 24 || r.width < 24)) small.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.innerText || el.getAttribute("aria-label") || "").slice(0, 20)}"`);
    }
    return { hscroll: doc.scrollWidth > window.innerWidth + 1, scrollWidth: doc.scrollWidth, height: doc.scrollHeight, over: over.slice(0, 15), text, unl, small: small.slice(0, 15), lang: document.documentElement.lang, title: document.title };
  });
  fs.writeFileSync(`${UX}/texts/${name}.txt`, dom.text);
  let axe = [];
  try {
    await page.evaluate(AXE);
    axe = await page.evaluate(async () => {
      const r = await window.axe.run(document, { resultTypes: ["violations"], runOnly: ["wcag2a", "wcag2aa", "best-practice"] });
      return r.violations.map((v) => `${v.impact} ${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ") + (n.any[0]?.message ? " — " + n.any[0].message.slice(0, 120) : "")).join(" | ")}`);
    });
  } catch (e) { axe = [`axe failed: ${e.message}`]; }
  const cjk = (dom.text.match(/[^\n]*[一-鿿][^\n]*/g) || []);
  const latinWords = (dom.text.match(/\b[A-Za-z][a-z]{3,}\b/g) || []);
  results.push({ name, file, url: page.url().replace(ORIGIN, ""), ...extra, hscroll: dom.hscroll, scrollWidth: dom.scrollWidth, height: dom.height, over: dom.over, unlabeled: dom.unl, small: dom.small, lang: dom.lang, title: dom.title, axe, cjkLines: cjk.slice(0, 40), latinWords: [...new Set(latinWords)].slice(0, 80), console: [...rec.console], http: [...rec.http], dialogs: [...rec.dialogs], ms: extra.ms });
  rec.console.length = 0; rec.http.length = 0; rec.dialogs.length = 0;
  console.log("snap", name, dom.hscroll ? "HSCROLL" : "", axe.length ? `axe=${axe.length}` : "");
}

async function go(page, url) {
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await settle(page, 300);
  return Date.now() - t0;
}

async function login(page, user, pw) {
  await page.locator("#login").fill(user);
  await page.locator("#password").fill(pw);
  await page.locator("form button[type=submit]").click();
  await settle(page, 800);
}

async function tryDo(rec, label, fn) {
  try { await fn(); } catch (e) { rec.console.push(`FLOW ${label} failed: ${e.message.split("\n")[0]}`); console.log("flow fail", label, e.message.split("\n")[0]); }
}

async function userRun(browser, vp, locale) {
  const tag = `${vp}-${locale}`;
  const rec = { console: [], http: [], dialogs: [] };
  // signed-out pages
  {
    const ctx = await ctxFor(browser, vp, locale);
    const page = await ctx.newPage(); instrument(page, rec);
    let ms = await go(page, APP); await snap(page, `u-login-${tag}`, rec, { ms });
    await tryDo(rec, "wrongpw", async () => { await login(page, "alice", "nope"); await snap(page, `u-login-wrongpw-${tag}`, rec); });
    ms = await go(page, `${APP}/register`); await snap(page, `u-register-${tag}`, rec, { ms });
    await tryDo(rec, "register-code", async () => {
      await page.locator("input[type=email]").first().fill(`new-${tag}@example.com`);
      await page.getByRole("button").filter({ hasText: /验证码|code/i }).first().click();
      await settle(page, 1000); await snap(page, `u-register-codesent-${tag}`, rec);
    });
    ms = await go(page, `${APP}/forgot`); await snap(page, `u-forgot-${tag}`, rec, { ms });
    await tryDo(rec, "forgot-submit", async () => {
      await page.locator("input").first().fill("alice@example.com");
      await page.locator("form button[type=submit]").click(); await snap(page, `u-forgot-sent-${tag}`, rec);
    });
    ms = await go(page, `${APP}/reset`); await snap(page, `u-reset-notoken-${tag}`, rec, { ms });
    ms = await go(page, `${APP}/reset#token=bogus-token-123`); await snap(page, `u-reset-token-${tag}`, rec, { ms });
    ms = await go(page, `${APP}/nonexistent-view`); await snap(page, `u-unknownpath-${tag}`, rec, { ms });
    await ctx.close();
  }
  // signed-in personas
  for (const who of ["alice", "bob-expired", "carol-quota", "frank-noplan", "dave-inviter", "very.long.username.overflow-test_2026"]) {
    if (who !== "alice" && vp === "phone" && locale === "en" && !["bob-expired", "very.long.username.overflow-test_2026"].includes(who)) continue;
    const ctx = await ctxFor(browser, vp, locale);
    const page = await ctx.newPage(); instrument(page, rec);
    await go(page, APP);
    const t0 = Date.now(); await login(page, who, "user-pass-123");
    const short = who.split(/[-.]/)[0];
    await snap(page, `u-portal-${short}-${tag}`, rec, { ms: Date.now() - t0 });
    if (who === "alice") {
      await tryDo(rec, "copy-sub", async () => {
        await page.getByRole("button", { name: /生成新订阅链接|New subscription link/ }).first().click({ timeout: 5000 }); await settle(page);
        await page.getByRole("button", { name: /^(复制|Copy)$/ }).first().click({ timeout: 5000 }); await page.waitForTimeout(300);
        await page.getByRole("button", { name: /复制|Copy/ }).first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${UX}/shots/u-copy-feedback-${tag}.png` });
      });
      await tryDo(rec, "coupon", async () => {
        await page.locator("#coupon-code").fill("WELCOME10");
        await page.getByRole("button", { name: /^(使用|Apply)$/ }).click(); await settle(page);
        const cb = page.locator("label:has(input[type=checkbox]) input[type=checkbox]").first();
        if (await cb.count()) await cb.check();
        await settle(page); await snap(page, `u-shop-coupon-balance-${tag}`, rec);
      });
      await tryDo(rec, "badcoupon", async () => {
        await page.locator("#coupon-code").fill("NOPE99");
        await page.getByRole("button", { name: /^(使用|Apply)$/ }).click(); await settle(page);
        await page.locator("#coupon-code").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${UX}/shots/u-shop-badcoupon-${tag}.png` });
        await page.getByRole("button", { name: /^(清除|Clear)$/ }).click().catch(() => {});
      });
      await tryDo(rec, "buy", async () => {
        const cb = page.locator("label:has(input[type=checkbox]) input[type=checkbox]").first();
        if (await cb.count() && await cb.isChecked()) await cb.uncheck();
        await settle(page);
        // second plan card (Pro), choose year
        const radios = page.locator("input[type=radio][value=year]");
        if (await radios.count() > 1) await radios.nth(1).check();
        await page.locator("button:enabled").filter({ hasText: /^(购买|Buy|更换为此套餐|Switch to this plan|续费|Renew)/ }).first().click({ timeout: 5000 });
        await page.waitForTimeout(2500);
        await snap(page, `u-pay-qr-${tag}`, rec);
        await page.getByRole("button", { name: /取消订单|Cancel order/ }).first().click(); await settle(page);
        await snap(page, `u-pay-cancelled-${tag}`, rec);
      });
      await tryDo(rec, "2fa", async () => {
        await page.getByRole("button", { name: /两步验证|two-factor|2FA|Enable/i }).first().click(); await settle(page);
        await snap(page, `u-2fa-enroll-${tag}`, rec);
      });
      await tryDo(rec, "email", async () => {
        await page.getByRole("button", { name: /^(绑定邮箱|更换邮箱|Add email|Change email)$/ }).first().click({ timeout: 5000 });
        const em = page.locator("#email-new");
        await em.fill("alice@example.com"); await page.locator("#email-pw").fill("user-pass-123");
        await page.locator("form[aria-label] button[type=submit]").last().click(); await settle(page, 1200);
        await em.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${UX}/shots/u-email-code-${tag}.png` });
      });
    }
    if (who === "dave-inviter") {
      await tryDo(rec, "withdraw-form", async () => {
        await page.locator("#w-amount").scrollIntoViewIfNeeded({ timeout: 5000 });
        await snap(page, `u-withdraw-form-${tag}`, rec);
      });
    }
    await ctx.close();
  }
}

async function adminRun(browser, vp) {
  const tag = vp;
  const rec = { console: [], http: [], dialogs: [] };
  const ctx = await ctxFor(browser, vp, "zh");
  const page = await ctx.newPage(); instrument(page, rec);
  await go(page, APP);
  const t0 = Date.now(); await login(page, "admin", "ux-admin-pass-123");
  await snap(page, `a-landing-${tag}`, rec, { ms: Date.now() - t0 });
  const views = ["users", "plans", "orders", "coupons", "finance", "nodes", "updates", "audit", "settings", "account"];
  for (const v of views) {
    const ms = await go(page, `${ADMIN}/${v}`);
    await snap(page, `a-${v}-${tag}`, rec, { ms });
  }
  // explore: click non-destructive openers on each view
  const OPEN = /^(管理|详情|编辑|查看|新建|创建|新建节点|添加|展开|明细|使用记录|安装命令|重装命令|从模板添加|高级|生成|余额)/;
  const NEVER = /(删除|停用|吊销|重置|退款|取消|撤销|中止|驳回|拒绝|批准|通过|确认|保存|退出|重新生成|启用|禁用|暂停|恢复|移除|立即测速|重试)/;
  for (const v of views) {
    await go(page, `${ADMIN}/${v}`);
    const labels = await page.getByRole("button").evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => e.innerText.trim()));
    const seen = new Set();
    let i = 0;
    for (const l of labels) {
      if (!OPEN.test(l) || NEVER.test(l) || seen.has(l)) continue;
      seen.add(l);
      await tryDo(rec, `${v}:${l}`, async () => {
        await go(page, `${ADMIN}/${v}`);
        await page.getByRole("button", { name: l, exact: true }).first().click({ timeout: 4000 });
        await settle(page, 800);
        await snap(page, `a-${v}-open${i++}-${l.replace(/[^\w一-鿿]+/g, "_").slice(0, 16)}-${tag}`, rec);
      });
    }
  }
  // node detail via link
  await tryDo(rec, "node-detail", async () => {
    const seed = JSON.parse(fs.readFileSync(`${UX}/run/seed.json`, "utf8"));
    const ms = await go(page, `${ADMIN}/nodes/${seed.nodes.hk}`);
    await page.waitForTimeout(2000);
    await snap(page, `a-node-detail-${tag}`, rec, { ms });
  });
  // destructive-confirmation probe: click delete-ish on users first row (dialogs are dismissed and recorded)
  await tryDo(rec, "destructive", async () => {
    await go(page, `${ADMIN}/users`);
    await page.getByRole("button", { name: "管理" }).last().click(); await settle(page);
    for (const n of ["吊销会话", "删除"]) {
      const b = page.getByRole("button", { name: new RegExp(n) }).first();
      if (await b.count()) { await b.click(); await settle(page, 500); }
    }
    await snap(page, `a-users-destructive-${tag}`, rec);
  });
  await ctx.close();
}

const browser = await chromium.launch();
try {
  const which = process.env.WHICH || "all";
  if (which === "all" || which === "user") {
    for (const vp of ["desktop", "phone"]) for (const l of ["zh", "en"]) await userRun(browser, vp, l);
  }
  if (which === "all" || which === "admin") for (const vp of ["desktop", "phone"]) await adminRun(browser, vp);
  if (which === "all" || which === "admin" || which === "adminen") {
    // admin console in an en-US browser: must still be all Chinese (dates included)
    const rec = { console: [], http: [], dialogs: [] };
    const ctx = await ctxFor(browser, "desktop", "en");
    const page = await ctx.newPage(); instrument(page, rec);
    await go(page, APP); await login(page, "admin", "ux-admin-pass-123");
    const seed = JSON.parse(fs.readFileSync(`${UX}/run/seed.json`, "utf8"));
    for (const v of ["users", "nodes", `nodes/${seed.nodes.hk}`, "orders", "finance", "audit", "account"]) {
      await go(page, `${ADMIN}/${v}`); await page.waitForTimeout(1200);
      await snap(page, `a-enbrowser-${v.split("/")[0]}${v.includes("/") ? "-detail" : ""}`, rec);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  const out = `${UX}/results-${process.env.WHICH || "all"}.json`;
  fs.writeFileSync(out, JSON.stringify(results, null, 1));
  console.log("wrote", out, results.length);
}
