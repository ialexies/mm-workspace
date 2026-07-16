import { chromium } from "playwright";
import { mkdirSync } from "fs";

// Verify item_category3 (property/supplier name) on `begin_checkout` and
// `purchase` for a real TOURS booking against the LOCAL dev server
// (branch: fix/purchase-item-category3-multi-property).

const BASE = "http://localhost:3000";
const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const EMAIL = "ialexies@gmail.com";
const PASSWORD = "*Luffy123";
const OUT = "f:/madmonkey2/MM_V3/playwright-verify/screenshots";
try { mkdirSync(OUT, { recursive: true }); } catch {}

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 60 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();

page.on("console", (m) => {
  const t = m.text();
  if (/GTM purchase|Purchase ready|purchase event sent|hasSummary|waiting for data|payment_not_found|unsupported_booking_type/.test(t))
    console.log("   [page]", t.slice(0, 160));
});

const eventsByName = (name) =>
  page.evaluate((n) =>
    (window.dataLayer || [])
      .filter((e) => e && e.event === n && e.ecommerce)
      .map((e) => ({
        hostel_country: e.hostel_country,
        hostel_name: e.hostel_name,
        items: e.ecommerce?.items?.map((it) => ({
          item_id: it.item_id,
          item_name: it.item_name,
          item_category: it.item_category,
          item_category2: it.item_category2,
          item_category3: it.item_category3,
          price: it.price,
          quantity: it.quantity,
        })),
      })),
    name,
  );
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

// ── Tours flow: open tour, select slot ─────────────────────────────────
await page.goto(`${BASE}/tours-events/valencia-tour`, { waitUntil: "domcontentloaded", timeout: 60000 });
await consent();
await page.waitForTimeout(3000);

await page.locator("text=Choose Dates for Booking").first().click().catch(() => {});
await page.waitForTimeout(1200);
const preferred = page.locator("text=/\\d{2} (Sep|Oct|Nov) 2026, \\d{2}:\\d{2} [AP]M/");
const anySlot = page.locator("text=/\\d{2} \\w{3} 2026, \\d{2}:\\d{2} [AP]M/");
const slots = (await preferred.count()) ? preferred : anySlot;
const chosenSlot = (await slots.first().textContent().catch(() => "")) || "";
console.log("chosen tour slot:", chosenSlot.trim());
await slots.first().click().catch(() => {});
for (let i = 0; i < 20; i++) {
  const atc = await page.evaluate(() => (window.dataLayer || []).filter((e) => e && e.event === "add_to_cart").length);
  if (atc > 0) break;
  await page.waitForTimeout(500);
}
console.log("tour added to cart (add_to_cart seen)");
await page.screenshot({ path: `${OUT}/tc3-1-tour.png` });

let onBooking = false;
for (let i = 0; i < 4 && !onBooking; i++) {
  await page.locator('button:has-text("CONTINUE TO CHECKOUT")').first().click({ timeout: 10000 }).catch(() => {});
  onBooking = await page
    .waitForURL((u) => u.pathname.startsWith("/booking"), { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  if (!onBooking) { console.log(`CONTINUE TO CHECKOUT retry ${i + 1}…`); await page.waitForTimeout(1500); }
}
await page.waitForTimeout(3500);
console.log("URL after CONTINUE TO CHECKOUT:", page.url());

const beginCheckout = await eventsByName("begin_checkout");
console.log("\n=== begin_checkout (tours) ===");
console.log(JSON.stringify(beginCheckout, null, 2));

await page.screenshot({ path: `${OUT}/tc3-2-booking.png` });

// ── CONFIRM & PAY -> embedded Stripe ──────────────────────────────────────
await page.locator('button:has-text("CONFIRM & PAY")').first().click({ timeout: 10000 }).catch(() => {});
console.log("clicked CONFIRM & PAY, waiting for Stripe element...");
await page.waitForTimeout(8000);

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
await page.waitForTimeout(1000);
const payRe = /^(pay\b|pay \$|pay now|complete payment)/i;
let payClicked = false;
for (const t of await page.locator("button").allTextContents().catch(() => [])) {
  if (payRe.test(t.trim())) {
    const b = page.locator("button", { hasText: t.trim() }).first();
    await b.scrollIntoViewIfNeeded().catch(() => {});
    await b.click().catch(() => {});
    payClicked = true; console.log("clicked page button:", t.trim()); break;
  }
}
if (!payClicked) {
  for (const f of page.frames()) {
    try {
      const b = f.locator('button:has-text("Pay"), button[type="submit"]').first();
      if (await b.count()) { await b.scrollIntoViewIfNeeded().catch(() => {}); await b.click(); payClicked = true; console.log("clicked frame pay/submit"); break; }
    } catch {}
  }
}
console.log("pay clicked:", payClicked);

// ── Wait for /booking/thanks and read the purchase event ──────────────────
await page.waitForURL((u) => u.pathname.includes("/booking/thanks"), { timeout: 70000 }).catch(() => console.log("did NOT reach /thanks in time"));
console.log("URL:", page.url());
let found = [];
for (let i = 0; i < 40; i++) {
  found = await eventsByName("purchase");
  if (found.length) break;
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/tc3-5-thanks.png`, fullPage: true });

console.log("\n=== TOURS purchase events on /thanks (local, item_category3 check) ===");
console.log(JSON.stringify(found, null, 2));
const bcCat3 = beginCheckout[0]?.items?.every((it) => !!it.item_category3);
const purchaseFired = found.length > 0;
console.log(
  `\nRESULT: begin_checkout item_category3 ${bcCat3 ? "✅ present" : "❌ MISSING"}; purchase ${
    purchaseFired ? "fired (see items above for item_category3)" : "❌ did NOT fire"
  }`,
);
await page.waitForTimeout(2000);
await browser.close();
