import { chromium } from "playwright";
import { mkdirSync } from "fs";

// Verify: does `purchase` fire on the ROOMS embedded-checkout /booking/thanks page?
// Completes a REAL paid rooms booking on staging with a Stripe test card, then
// reads the live dataLayer. Parity check against verify-tours-purchase.mjs.

const BASE = process.env.TEST_BASE || "https://staging.madmonkeyhostels.com";
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

const purchases = () =>
  page.evaluate(() =>
    (window.dataLayer || [])
      .filter((e) => e && e.event === "purchase" && e.ecommerce)
      .map((e) => ({
        transaction_id: e.ecommerce?.transaction_id,
        value: e.ecommerce?.value,
        currency: e.ecommerce?.currency,
        item_category: e.ecommerce?.items?.[0]?.item_category,
        item_name: e.ecommerce?.items?.[0]?.item_name,
        reservation_id: e.ecommerce?.reservation_id,
        items: e.ecommerce?.items?.length,
        // Top-level booking dimensions (siblings of ecommerce) under test
        conversion_type: e.conversion_type,
        hostel_country: e.hostel_country,
        hostel_name: e.hostel_name,
      })),
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

// ── Rooms flow: destination -> ADD TO TRIP -> CONTINUE TO CHECKOUT ────────
await page.goto(
  `${BASE}/destination/dumaguete?checkIn=2026-09-02&checkOut=2026-09-03&adult=1`,
  { waitUntil: "domcontentloaded", timeout: 60000 },
);
await consent();
await page.waitForTimeout(3500);
await page.locator('button:has-text("ADD TO TRIP")').first().click({ timeout: 10000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/rp-1-dest.png` });
await page.locator('button:has-text("CONTINUE TO CHECKOUT")').first().click({ timeout: 10000 }).catch(() => {});
await page.waitForURL((u) => u.pathname.startsWith("/booking"), { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(3500);
console.log("URL after CONTINUE TO CHECKOUT:", page.url());
await page.screenshot({ path: `${OUT}/rp-2-booking.png` });

// ── CONFIRM & PAY -> embedded Stripe ──────────────────────────────────────
await page.locator('button:has-text("CONFIRM & PAY")').first().click({ timeout: 10000 }).catch(() => {});
console.log("clicked CONFIRM & PAY, waiting for Stripe element...");
await page.waitForTimeout(8000);
await page.screenshot({ path: `${OUT}/rp-3-stripe.png`, fullPage: true });

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
for (let i = 0; i < 6 && !filled; i++) { filled = await fillStripe(); if (!filled) await page.waitForTimeout(2000); }
console.log("card filled:", filled);
await page.screenshot({ path: `${OUT}/rp-4-filled.png`, fullPage: true });

let payClicked = false;
const payBtns = page.locator("button", { hasText: /^Pay$/ });
if (await payBtns.count()) { await payBtns.first().scrollIntoViewIfNeeded().catch(() => {}); await payBtns.first().click().catch(() => {}); payClicked = true; }
if (!payClicked) {
  for (const f of page.frames()) { try { const b = f.locator('button:has-text("Pay")').first(); if (await b.count()) { await b.click(); payClicked = true; break; } } catch {} }
}
console.log("pay clicked:", payClicked);

// ── Wait for /booking/thanks and read the purchase event ──────────────────
await page.waitForURL((u) => u.pathname.includes("/booking/thanks"), { timeout: 70000 }).catch(() => console.log("did NOT reach /thanks in time"));
console.log("URL:", page.url());
let found = [];
for (let i = 0; i < 40; i++) {
  found = await purchases();
  if (found.length) break;
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/rp-5-thanks.png`, fullPage: true });

console.log("\n=== ROOMS purchase events on /thanks ===");
console.log(JSON.stringify(found, null, 2));
const one = found.length === 1 && Number(found[0]?.value) > 0;
console.log(
  `\nRESULT: ${
    found.length === 0
      ? "❌ NO purchase fired on rooms /thanks"
      : one
        ? "✅ purchase fired exactly once with value>0 — rooms tracking works"
        : `⚠️ purchase fired ${found.length}× — inspect above`
  }`,
);
await page.waitForTimeout(2000);
await browser.close();
