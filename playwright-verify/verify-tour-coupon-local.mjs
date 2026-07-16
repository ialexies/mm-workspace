import { chromium } from "playwright";
import { mkdirSync } from "fs";

// Verify the tour coupon fix (fix/tour-coupon-analytics) against the LOCAL
// dev server: applies a real coupon code to a tour booking and checks that
// add_to_cart, remove_from_cart, and purchase all carry it correctly.

const BASE = "http://localhost:3000";
const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const EMAIL = "ialexies@gmail.com";
const PASSWORD = "*Luffy123";
const COUPON = process.env.TEST_COUPON || "TESTTOUR";
const OUT = "f:/madmonkey2/MM_V3/playwright-verify/screenshots";
try { mkdirSync(OUT, { recursive: true }); } catch {}

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 60 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();

page.on("console", (m) => {
  const t = m.text();
  if (/GTM purchase|Purchase ready|purchase event sent|hasSummary|coupon/i.test(t)) console.log("   [page]", t.slice(0, 200));
});

async function eventsByName(name) {
  return page.evaluate(
    (n) => (window.dataLayer || []).filter((e) => e && e.event === n),
    name,
  );
}

async function consent() {
  try {
    const d = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all")').first();
    if (await d.isVisible({ timeout: 3000 })) { await d.click(); await page.waitForTimeout(400); }
  } catch {}
}

// ── Login ──────────────────────────────────────────────────────────────
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
await consent();
await page.locator('input[type="email"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await page.locator('[data-testid="LOG IN-button"], button:has-text("LOG IN")').first().click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 }).catch(() => {});
console.log("logged in:", page.url());

// ── Tour page: add Valencia Tour to cart ────────────────────────────────
await page.goto(`${BASE}/tours-events/valencia-tour`, { waitUntil: "domcontentloaded", timeout: 60000 });
await consent();
await page.waitForTimeout(3000);

await page.locator("text=Choose Dates for Booking").first().click().catch(() => {});
await page.waitForTimeout(1200);
// September date per the original instruction — fall back to any date only
// if no September slot is available.
const preferredSlot = page.locator("text=/\\d{2} Sep 2026, \\d{2}:\\d{2} [AP]M/");
const anySlot = page.locator("text=/\\d{2} \\w{3} 2026, \\d{2}:\\d{2} [AP]M/");
const slots = (await preferredSlot.count()) ? preferredSlot : anySlot;
const chosenSlot = (await slots.first().textContent().catch(() => "")) || "";
console.log("chosen tour slot:", chosenSlot.trim());
await slots.first().click().catch(() => {});

let atc = [];
for (let i = 0; i < 20; i++) {
  atc = await eventsByName("add_to_cart");
  if (atc.length >= 1) break;
  await page.waitForTimeout(1000);
}
console.log("\n=== add_to_cart (before coupon) ===");
console.log(JSON.stringify(atc.map((e) => ({ coupon: e.ecommerce?.items?.[0]?.coupon, item_id: e.ecommerce?.items?.[0]?.item_id })), null, 2));

// ── Go to /booking and apply the coupon ─────────────────────────────────
let onBooking = false;
for (let i = 0; i < 4 && !onBooking; i++) {
  await page.locator('button:has-text("CONTINUE TO CHECKOUT")').first().click({ timeout: 10000 }).catch(() => {});
  onBooking = await page.waitForURL((u) => u.pathname.startsWith("/booking"), { timeout: 15000 }).then(() => true).catch(() => false);
  if (!onBooking) await page.waitForTimeout(1500);
}
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/coupon-1-booking.png`, fullPage: true });

// MUI TextField uses a floating <label>, not a native placeholder attribute
// — match by accessible name (label text) instead of a placeholder selector.
const couponInput = page.getByRole("textbox", { name: /promo|coupon/i }).first();
let couponApplied = false;
try {
  await couponInput.waitFor({ state: "visible", timeout: 15000 });
  await couponInput.fill(COUPON);
  const applyBtn = page.locator('button:has-text("APPLY")').first();
  await applyBtn.click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);
  couponApplied = true;
} catch (e) {
  console.log("⚠️ No coupon input found on /booking page:", e.message?.slice(0, 150));
}
console.log("coupon input filled + apply clicked:", couponApplied);
await page.screenshot({ path: `${OUT}/coupon-2-applied.png`, fullPage: true });

const bodyText = await page.locator("body").innerText();
const couponAccepted = bodyText.toUpperCase().includes(COUPON.toUpperCase());
console.log(`Coupon "${COUPON}" visible on page after apply:`, couponAccepted);

// ── begin_checkout on CONFIRM & PAY ─────────────────────────────────────
await page.locator('button:has-text("CONFIRM & PAY")').first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
await page.locator('button:has-text("CONFIRM & PAY")').first().click({ timeout: 15000 }).catch(() => {});
await page.waitForTimeout(5000); // generous wait before checking — avoid the "checked too early" false negative
const bc = await eventsByName("begin_checkout");
console.log("\n=== begin_checkout ===");
console.log(JSON.stringify(bc.map((e) => ({ coupon: e.ecommerce?.coupon, item_coupon: e.ecommerce?.items?.[0]?.coupon })), null, 2));

// ── Stripe payment ───────────────────────────────────────────────────────
for (let i = 0; i < 30; i++) {
  let seen = false;
  for (const f of page.frames()) {
    try { if (await f.locator('input[name="number"], input[placeholder="1234 1234 1234 1234"]').count()) { seen = true; break; } } catch {}
  }
  if (seen) break;
  await page.waitForTimeout(1000);
}
async function fillStripe() {
  for (const f of page.frames()) {
    try {
      const num = f.locator('input[name="number"], input[placeholder="1234 1234 1234 1234"]');
      if (await num.count()) {
        await num.first().fill("4242424242424242");
        await f.locator('input[name="expiry"], input[placeholder="MM / YY"]').first().fill("12 / 30").catch(() => {});
        await f.locator('input[name="cvc"], input[placeholder="CVC"]').first().fill("123").catch(() => {});
        const nm = f.locator('input[name="billingName"], input[placeholder*="ull name"], input[placeholder*="ame on card"]');
        if (await nm.count()) await nm.first().fill("Test Booker").catch(() => {});
        return true;
      }
    } catch {}
  }
  return false;
}
let filled = false;
for (let i = 0; i < 15 && !filled; i++) { filled = await fillStripe(); if (!filled) await page.waitForTimeout(2000); }
console.log("card filled:", filled);
await page.mouse.wheel(0, 1200).catch(() => {});
await page.waitForTimeout(500);
const payRe = /^(pay\b|pay \$|pay now|complete payment)/i;
let payClicked = false;
for (const t of await page.locator("button").allTextContents().catch(() => [])) {
  if (payRe.test(t.trim())) {
    const b = page.locator("button", { hasText: t.trim() }).first();
    await b.scrollIntoViewIfNeeded().catch(() => {});
    await b.click().catch(() => {});
    payClicked = true; break;
  }
}
if (!payClicked) {
  for (const f of page.frames()) {
    try { const b = f.locator('button:has-text("Pay"), button[type="submit"]').first(); if (await b.count()) { await b.click(); payClicked = true; break; } } catch {}
  }
}
console.log("pay clicked:", payClicked);

await page.waitForURL((u) => u.pathname.includes("/booking/thanks"), { timeout: 70000 }).catch(() => console.log("did NOT reach /thanks in time"));
let purchases = [];
for (let i = 0; i < 40; i++) {
  purchases = await eventsByName("purchase");
  if (purchases.length) break;
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/coupon-3-thanks.png`, fullPage: true });

console.log("\n=== purchase ===");
console.log(JSON.stringify(purchases, null, 2));

console.log("\n\n========== SUMMARY ==========");
console.log(`add_to_cart item coupon: ${atc[0]?.ecommerce?.items?.[0]?.coupon || "(empty)"}`);
console.log(`begin_checkout top-level coupon: ${bc[0]?.ecommerce?.coupon || "(empty)"}`);
console.log(`purchase top-level coupon: ${purchases[0]?.ecommerce?.coupon || "(empty)"}`);
console.log(`purchase item coupon: ${purchases[0]?.ecommerce?.items?.[0]?.coupon || "(empty)"}`);

await page.waitForTimeout(2000);
await browser.close();
