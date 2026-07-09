import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const EMAIL = "ialexies@gmail.com";
const PASSWORD = "*Luffy123";

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 60 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(2000);
try {
  const d = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all")').first();
  if (await d.isVisible({ timeout: 3000 })) await d.click();
} catch {}

await page.locator('input[type="email"]').first().fill(EMAIL);
await page.waitForTimeout(200);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await page.waitForTimeout(300);
const loginBtn = page.locator('[data-testid="LOG IN-button"], button:has-text("LOG IN")').first();
await loginBtn.scrollIntoViewIfNeeded().catch(() => {});
await loginBtn.click();

// wait for the login event to be pushed
let ev = null;
for (let i = 0; i < 20; i++) {
  ev = await page.evaluate(() => {
    const a = (window.dataLayer || []).filter((e) => e && e.event === "login");
    return a[a.length - 1] || null;
  });
  if (ev) break;
  await page.waitForTimeout(500);
}

console.log("\n=== login event ===");
console.log(JSON.stringify(ev, null, 2));
const uid = ev?.user_id ?? "";
const isEmail = String(uid).includes("@");
const looksLikeUid = /^[A-Za-z0-9]{20,}$/.test(String(uid));
console.log(`\nuser_id = ${uid}`);
console.log(
  `RESULT: ${!isEmail && looksLikeUid ? "✅ user_id is a Firebase UID (not email)" : "❌ user_id is not a clean UID — inspect above"}`,
);
await page.waitForTimeout(1000);
await browser.close();
