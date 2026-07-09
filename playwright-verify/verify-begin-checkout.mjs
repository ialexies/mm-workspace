import { chromium } from "playwright";

// H3 verification — begin_checkout must fire EXACTLY ONCE per checkout.
// Uses the reliable ROOMS flow (destination -> ADD TO TRIP -> CONTINUE TO
// CHECKOUT -> /booking -> CONFIRM & PAY). This exercises the two begin_checkout
// sources most likely to double-fire on a single checkout:
//   - pages/booking/index.tsx:3846  (after checkoutCart returns)
//   - contexts/cartContext.tsx:2811 (flag-gated)
// both guarded by markCheckoutEventOnce("begin_checkout", cart.id).
// We stop at CONFIRM & PAY — begin_checkout fires the moment checkoutCart
// resolves, before the Stripe element, so no real payment is needed.

const BASE = "https://staging.madmonkeyhostels.com";
const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const EMAIL = "ialexies@gmail.com";
const PASSWORD = "*Luffy123";

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 50 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();

const bc = () =>
  page.evaluate(() => (window.dataLayer || []).filter((e) => e && e.event === "begin_checkout" && e.ecommerce).length);
async function consent() {
  try {
    const d = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all")').first();
    if (await d.isVisible({ timeout: 3000 })) { await d.click(); await page.waitForTimeout(400); }
  } catch {}
}
async function pollBc(min, ms = 12000) {
  const end = Date.now() + ms;
  let n = await bc();
  while (Date.now() < end && n < min) { await page.waitForTimeout(500); n = await bc(); }
  return n;
}

// ── Login ──────────────────────────────────────────────────────────────
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
await consent();
await page.locator('input[type="email"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await page.locator('[data-testid="LOG IN-button"], button:has-text("LOG IN")').first().click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 }).catch(() => {});
console.log("logged in:", page.url());

// ── Rooms flow ───────────────────────────────────────────────────────────
console.log("\n=== ROOMS flow — begin_checkout should total exactly 1 ===");
await page.goto(
  `${BASE}/destination/dumaguete?gclid=STG_H3&utm_source=google&utm_medium=cpc&utm_campaign=h3_verify&checkIn=2026-07-02&checkOut=2026-07-03&adult=1`,
  { waitUntil: "domcontentloaded", timeout: 60000 },
);
await consent();
await page.waitForTimeout(3500);
console.log("begin_checkout on destination load:", await bc());

await page.locator('button:has-text("ADD TO TRIP")').first().click({ timeout: 10000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.locator('button:has-text("CONTINUE TO CHECKOUT")').first().click({ timeout: 10000 }).catch(() => {});
await page.waitForURL((u) => u.pathname.startsWith("/booking"), { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(3500);
console.log("URL after CONTINUE TO CHECKOUT:", page.url());
console.log("begin_checkout on /booking load (before CONFIRM & PAY):", await bc());
await page.screenshot({ path: "f:/madmonkey2/MM_V3/playwright-verify/screenshots/bc-booking.png" });

// begin_checkout fires the moment checkoutCart resolves after CONFIRM & PAY
await page.locator('button:has-text("CONFIRM & PAY")').first().click({ timeout: 10000 }).catch(() => {});
console.log("clicked CONFIRM & PAY, polling for begin_checkout...");
const count = await pollBc(1, 15000);
await page.waitForTimeout(2000);
console.log("begin_checkout after CONFIRM & PAY:", count);
await page.screenshot({ path: "f:/madmonkey2/MM_V3/playwright-verify/screenshots/bc-afterpay.png" });

const all = await page.evaluate(() =>
  (window.dataLayer || [])
    .filter((e) => e && e.event === "begin_checkout" && e.ecommerce)
    .map((e) => ({ tx: e.ecommerce?.transaction_id, value: e.ecommerce?.value, items: e.ecommerce?.items?.length })),
);
console.log("\nall begin_checkout events:", JSON.stringify(all, null, 2));
const final = all.length;
console.log(
  `\nRESULT: ${final === 1 ? "✅ begin_checkout fired EXACTLY ONCE — dedup works (H3 verified)" : `⚠️ begin_checkout fired ${final} times — inspect`}`,
);
await page.waitForTimeout(1500);
await browser.close();
