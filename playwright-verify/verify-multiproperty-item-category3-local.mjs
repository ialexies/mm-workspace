import { chromium } from "playwright";
import { mkdirSync } from "fs";

// Verify the multi-property purchase fix: a real order spanning TWO
// properties (Dumaguete + Panglao, via the "ADD STOP" upsell on /booking)
// should produce a `purchase` event whose items[] includes rooms from BOTH
// properties, each tagged with its own item_category2 (country) /
// item_category3 (property name) — not just the anchor property.

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
    console.log("   [page]", t.slice(0, 200));
});

const purchases = () =>
  page.evaluate(() =>
    (window.dataLayer || [])
      .filter((e) => e && e.event === "purchase" && e.ecommerce)
      .map((e) => ({
        transaction_id: e.ecommerce?.transaction_id,
        value: e.ecommerce?.value,
        currency: e.ecommerce?.currency,
        hostel_country: e.hostel_country,
        hostel_name: e.hostel_name,
        items: e.ecommerce?.items?.map((it) => ({
          item_id: it.item_id,
          item_name: it.item_name,
          item_category2: it.item_category2,
          item_category3: it.item_category3,
          location_id: it.location_id,
          price: it.price,
          quantity: it.quantity,
        })),
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

// ── Property 1: Dumaguete ──────────────────────────────────────────────
await page.goto(
  `${BASE}/destination/dumaguete?checkIn=2026-07-20&checkOut=2026-07-21&adult=1`,
  { waitUntil: "domcontentloaded", timeout: 60000 },
);
await consent();
await page.waitForTimeout(3000);
await page.locator('button:has-text("ADD BED OR ROOM")').first().click({ timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.locator('button:has-text("ADD TO TRIP")').first().click({ timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.locator('button:has-text("CONTINUE TO CHECKOUT")').first().click({ timeout: 10000 }).catch(() => {});
await page.waitForURL((u) => u.pathname.startsWith("/booking"), { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(3000);
console.log("URL on /booking:", page.url());

// ── Property 2: add a stop (Panglao) via the upsell ────────────────────
const section = page.locator("text=Lock in the Best Rate").first();
await section.scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(1000);
await page.locator('button:has-text("ADD STOP")').first().click({ timeout: 10000 }).catch((e) => console.log("ADD STOP click err:", e.message));
await page.waitForTimeout(4000); // stop panel loads its own room list

const stopAdd = page.locator('button:has-text("ADD")').first();
await stopAdd.scrollIntoViewIfNeeded().catch(() => {});
await stopAdd.click({ timeout: 10000 }).catch((e) => console.log("stop room ADD click err:", e.message));
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/mp-1-stop-room-added.png`, fullPage: true });

const saveStop = page.locator('button:has-text("SAVE THIS STOP")').first();
await saveStop.scrollIntoViewIfNeeded().catch(() => {});
await saveStop.click({ timeout: 10000 }).catch((e) => console.log("SAVE THIS STOP click err:", e.message));
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/mp-2-stop-saved.png`, fullPage: true });
console.log("URL after saving stop:", page.url());

// ── CONFIRM & PAY -> embedded Stripe ──────────────────────────────────────
const confirmBtn = page.locator('button:has-text("CONFIRM & PAY")').first();
await confirmBtn.scrollIntoViewIfNeeded().catch(() => {});
await confirmBtn.click({ timeout: 15000 }).catch((e) => console.log("CONFIRM & PAY click err:", e.message));
console.log("clicked CONFIRM & PAY, waiting for Stripe element...");
for (let i = 0; i < 30; i++) {
  let seen = false;
  for (const f of page.frames()) {
    try {
      if (await f.locator('input[name="number"], input[placeholder="1234 1234 1234 1234"]').count()) { seen = true; break; }
    } catch {}
  }
  if (seen) break;
  await page.waitForTimeout(1000);
}
await page.screenshot({ path: `${OUT}/mp-3-stripe.png`, fullPage: true });

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
if (!filled) {
  console.log("Stripe form never appeared — aborting before a doomed pay click.");
  await page.screenshot({ path: `${OUT}/mp-4-nofill.png`, fullPage: true });
  await browser.close();
  process.exit(1);
}
await page.screenshot({ path: `${OUT}/mp-4-filled.png`, fullPage: true });

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
await page.screenshot({ path: `${OUT}/mp-5-thanks.png`, fullPage: true });

console.log("\n=== MULTI-PROPERTY purchase events on /thanks (local) ===");
console.log(JSON.stringify(found, null, 2));

const items = found[0]?.items ?? [];
const countries = new Set(items.map((i) => i.item_category2).filter(Boolean));
const properties = new Set(items.map((i) => i.item_category3).filter(Boolean));
const itemSum = items.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 1), 0);
const valueMatches = Math.abs(itemSum - Number(found[0]?.value || 0)) < 0.05;

console.log(`\nitems: ${items.length}, distinct item_category3 (properties): ${[...properties].join(", ")}`);
console.log(`item price*qty sum: ${itemSum.toFixed(2)} vs ecommerce.value: ${found[0]?.value} (reconciles: ${valueMatches})`);
console.log(
  `\nRESULT: ${
    found.length === 0
      ? "❌ NO purchase fired"
      : items.length >= 2 && properties.size >= 2 && valueMatches
        ? "✅ multi-property fix confirmed — items[] spans both properties, value reconciles"
        : items.length < 2
          ? `❌ REGRESSION STILL PRESENT — only ${items.length} item(s), expected >=2 (one per property)`
          : properties.size < 2
            ? "❌ items present but item_category3 not distinct per property"
            : "⚠️ items span properties but value does not reconcile — inspect above"
  }`,
);
await page.waitForTimeout(2000);
await browser.close();
