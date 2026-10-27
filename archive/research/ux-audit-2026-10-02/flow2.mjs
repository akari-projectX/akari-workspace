import { chromium } from "/tmp/claude-1000/-home-lam-projectX/4078da57-e661-4797-999a-0f6d1eb80fe8/scratchpad/ux-audit/src/spa/node_modules/@playwright/test/index.mjs";
import fs from "node:fs";
const UX = "/tmp/claude-1000/-home-lam-projectX/4078da57-e661-4797-999a-0f6d1eb80fe8/scratchpad/ux-audit";
const APP = `http://127.0.0.1:8190/${fs.readFileSync(UX + "/run/prefix", "utf8").trim()}/app`;
const b = await chromium.launch();
for (const [vp, w, h, loc] of [["desktop", 1440, 900, "zh"], ["phone", 390, 844, "en"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: loc === "zh" ? "zh-CN" : "en-US", isMobile: vp === "phone", deviceScaleFactor: vp === "phone" ? 2 : 1, permissions: ["clipboard-read", "clipboard-write"] });
  await ctx.addInitScript((l) => localStorage.setItem("akari.locale", l), loc);
  const page = await ctx.newPage();
  const dialogs = [];
  page.on("dialog", async (d) => { dialogs.push(d.message()); await d.accept(); });
  page.on("console", (m) => m.type() === "error" && console.log("console", m.text().slice(0, 200)));
  await page.goto(APP); await page.locator("#login").fill("alice"); await page.locator("#password").fill("user-pass-123");
  await page.locator("form button[type=submit]").click(); await page.waitForTimeout(1500);
  const tag = `${vp}-${loc}`;
  try {
    await page.getByRole("button", { name: /生成新订阅链接|New subscription link/ }).click(); await page.waitForTimeout(800);
    await page.getByRole("button", { name: /^(复制|Copy)$/ }).first().click(); await page.waitForTimeout(300);
    const el = page.locator("pre").first(); await el.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${UX}/shots/u-sub-generated-${tag}.png` });
    console.log("clipboard:", await page.evaluate(() => navigator.clipboard.readText()).catch((e) => e.message));
  } catch (e) { console.log("sub fail", e.message.split("\n")[0]); }
  try {
    const radios = page.locator("input[type=radio][value=month]"); await radios.nth(1).check();
    await page.locator("button:enabled").filter({ hasText: /^(更换为此套餐|Switch to this plan|购买|Buy)/ }).first().click();
    await page.waitForTimeout(2500);
    const panel = page.locator("[aria-live=polite]").first(); await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${UX}/shots/u-pay-qr2-${tag}.png` });
    await page.screenshot({ path: `${UX}/shots/u-pay-qr2-full-${tag}.png`, fullPage: true });
    await page.getByRole("button", { name: /取消订单|Cancel order/ }).click(); await page.waitForTimeout(1000);
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${UX}/shots/u-pay-cancelled2-${tag}.png` });
  } catch (e) { console.log("buy fail", e.message.split("\n")[0]); }
  // 2FA
  try {
    await page.getByRole("button", { name: /开启两步验证|Turn on two-factor|Enable two-factor|two-factor/i }).first().click(); await page.waitForTimeout(800);
    await page.screenshot({ path: `${UX}/shots/u-2fa2-${tag}.png`, fullPage: true });
  } catch (e) { console.log("2fa fail", e.message.split("\n")[0]); }
  console.log(tag, "dialogs:", JSON.stringify(dialogs));
  await ctx.close();
}
await b.close();
