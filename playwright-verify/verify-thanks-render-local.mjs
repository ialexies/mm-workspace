import { chromium } from "playwright";

// Test the FIXED /booking/thanks render on localhost (fix branch) using a REAL
// already-completed booking against the staging backend. Cases:
//   1. tours session + type=tours  → normal tours render + purchase
//   2. tours session + type=rooms  → THE CRASH REPRO: URL type mismatches the
//      summary type. Old code: rooms branch on a tours summary → tours[0]/rooms.map
//      throw → white-screen "Application error" → purchase lost.
//      Fixed code: branches on summary.type → renders tours gracefully + purchase.

const BASE = "http://localhost:3000";
const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const EMAIL = "ialexies@gmail.com";
const PASSWORD = "*Luffy123";

// Real completed checkout sessions (staging backend)
const TOURS_SESSION = "cs_test_a1AJMQwyF1JhyhzrYxgRDCzpbzMqyFMOYUVidzLmNrXJbYvAiq7lHbwo4n";
const TOURS_CART = "9afa10dc-658d-451e-a848-8a6b38e5c6ee";
const ROOMS_SESSION = "cs_test_a1KVTUPlg5LBzEn1Sw8zOepGJXLZshiQP7YVrOUUDUkpKN9mx0HmPo1pwP";
const ROOMS_CART = "5547ed6c-fb92-4617-8a36-25ebe0c22295";

const cases = [
  { label: "TOURS booking, type=tours (normal)", session: TOURS_SESSION, cart: TOURS_CART, type: "tours" },
  { label: "TOURS booking, type=rooms (mismatch — old crash)", session: TOURS_SESSION, cart: TOURS_CART, type: "rooms" },
  { label: "ROOMS booking, type=rooms (normal)", session: ROOMS_SESSION, cart: ROOMS_CART, type: "rooms" },
  { label: "ROOMS booking, type=tours (mismatch — old crash)", session: ROOMS_SESSION, cart: ROOMS_CART, type: "tours" },
];

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 40 });

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  try {
    const d = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all")').first();
    if (await d.isVisible({ timeout: 3000 })) await d.click();
  } catch {}
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('[data-testid="LOG IN-button"], button:has-text("LOG IN")').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }).catch(() => {});
}

for (const c of cases) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const page = await ctx.newPage();
  let pageError = null;
  page.on("pageerror", (e) => { pageError = e.message; });

  await login(page);

  const url = `${BASE}/booking/thanks?payment_intent_id=${c.session}&cart_id=${c.cart}&type=${c.type}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  // Poll for either the purchase event, or the Next crash screen.
  let purchase = null, appError = false;
  for (let i = 0; i < 50; i++) {
    appError = await page.getByText("Application error", { exact: false }).isVisible().catch(() => false);
    purchase = await page.evaluate(() => {
      const p = (window.dataLayer || []).filter((e) => e && e.event === "purchase" && e.ecommerce);
      const e = p[p.length - 1];
      return e ? { value: e.ecommerce.value, item_category: e.ecommerce.items?.[0]?.item_category, items: e.ecommerce.items?.length } : null;
    });
    if (purchase || appError) break;
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1500);
  appError = await page.getByText("Application error", { exact: false }).isVisible().catch(() => false);
  await page.screenshot({ path: `f:/madmonkey2/MM_V3/playwright-verify/screenshots/thanks-${c.type}.png` });

  console.log(`\n===== CASE: ${c.label} =====`);
  console.log("  white-screen 'Application error':", appError ? "❌ YES (crash)" : "✅ no");
  console.log("  pageerror:", pageError ? "❌ " + pageError.slice(0, 100) : "none");
  console.log("  purchase event:", purchase ? `✅ ${JSON.stringify(purchase)}` : "⚠️ none");
  await ctx.close();
}

await browser.close();
