import { chromium } from "playwright";
import { mkdirSync } from "fs";

// H6 confirmation: on a real purchase, is `original_value` (a) present & numeric in
// the dataLayer purchase event, and (b) sent to GA4 as a NUMERIC event param
// (epn.original_value) on the /g/collect hit? epn.* = numeric param => GA4 can
// aggregate it as a metric once registered. Uses the tours flow.

const BASE = "https://staging.madmonkeyhostels.com";
const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const EMAIL = "ialexies@gmail.com";
const PASSWORD = "*Luffy123";
const OUT = "f:/madmonkey2/MM_V3/playwright-verify/screenshots";
try { mkdirSync(OUT, { recursive: true }); } catch {}

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 60 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();

// Capture GA4 purchase hits and how original_value is encoded (ep. = text, epn. = numeric)
const ga4Purchase = [];
page.on("request", (req) => {
  const u = req.url();
  if (!/\/g\/collect|google-analytics\.com\/g\/collect|region\d+\.google-analytics/.test(u)) return;
  const scan = (params, batched) => {
    if (params.get("en") !== "purchase") return;
    ga4Purchase.push({
      en: "purchase",
      tid: params.get("tid"),
      "epn.original_value": params.get("epn.original_value"), // numeric param
      "ep.original_value": params.get("ep.original_value"),   // text param
      "epn.value": params.get("epn.value"),
      currency: params.get("cu"),
      batched: !!batched,
    });
  };
  scan(new URL(u).searchParams, false);
  const body = req.postData();
  if (body) body.split("\n").forEach((line) => scan(new URLSearchParams(line), true));
});

async function consent() {
  try {
    const d = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all")').first();
    if (await d.isVisible({ timeout: 3000 })) { await d.click(); await page.waitForTimeout(400); }
  } catch {}
}

// Login
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
await consent();
await page.locator('input[type="email"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await page.locator('[data-testid="LOG IN-button"], button:has-text("LOG IN")').first().click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 }).catch(() => {});
console.log("logged in");

// Tours flow -> booking
await page.goto(`${BASE}/tours-events/valencia-tour`, { waitUntil: "domcontentloaded", timeout: 60000 });
await consent();
await page.waitForTimeout(3000);
const slots = page.locator("text=/\\d{2} \\w{3} 2026, \\d{2}:\\d{2} [AP]M/");
await page.locator("text=Choose Dates for Booking").first().click().catch(() => {});
await page.waitForTimeout(1200);
await slots.first().click().catch(() => {});
for (let i = 0; i < 20; i++) {
  const atc = await page.evaluate(() => (window.dataLayer || []).filter((e) => e && e.event === "add_to_cart").length);
  if (atc > 0) break;
  await page.waitForTimeout(500);
}
await page.locator('button:has-text("CONTINUE TO CHECKOUT")').first().click({ timeout: 10000 }).catch(() => {});
await page.waitForURL((u) => u.pathname.startsWith("/booking"), { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(3500);

// Pay
await page.locator('button:has-text("CONFIRM & PAY")').first().click({ timeout: 10000 }).catch(() => {});
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
for (let i = 0; i < 6 && !filled; i++) { filled = await fillStripe(); if (!filled) await page.waitForTimeout(2000); }
console.log("card filled:", filled);
let payClicked = false;
const payBtns = page.locator("button", { hasText: /^Pay$/ });
if (await payBtns.count()) { await payBtns.first().click().catch(() => {}); payClicked = true; }
if (!payClicked) for (const f of page.frames()) { try { const b = f.locator('button:has-text("Pay")').first(); if (await b.count()) { await b.click(); payClicked = true; break; } } catch {} }
console.log("pay clicked:", payClicked);

// Thanks -> read purchase dataLayer + GA4 hit
await page.waitForURL((u) => u.pathname.includes("/booking/thanks"), { timeout: 70000 }).catch(() => console.log("no /thanks"));
let dlPurchase = null;
for (let i = 0; i < 40; i++) {
  dlPurchase = await page.evaluate(() => {
    const p = (window.dataLayer || []).filter((e) => e && e.event === "purchase" && e.ecommerce);
    const e = p[p.length - 1];
    return e ? { value: e.ecommerce.value, original_value: e.ecommerce.original_value, original_currency: e.ecommerce.original_currency, type_ov: typeof e.ecommerce.original_value } : null;
  });
  if (dlPurchase) break;
  await page.waitForTimeout(500);
}
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/ov-thanks.png`, fullPage: true });

console.log("\n=== dataLayer purchase.ecommerce ===");
console.log(JSON.stringify(dlPurchase, null, 2));
console.log("\n=== GA4 /g/collect purchase hits (original_value encoding) ===");
console.log(JSON.stringify(ga4Purchase, null, 2));

const dlOk = dlPurchase && dlPurchase.type_ov === "number" && dlPurchase.original_value > 0;
const numericOnHit = ga4Purchase.some((h) => h["epn.original_value"] != null);
const textOnHit = ga4Purchase.some((h) => h["ep.original_value"] != null);
console.log(
  `\nRESULT:\n  - dataLayer original_value numeric & >0: ${dlOk ? "✅ yes (" + dlPurchase.original_value + ")" : "❌ no"}\n  - GA4 hit sends epn.original_value (numeric): ${numericOnHit ? "✅ yes — GA4 will aggregate as a metric" : textOnHit ? "⚠️ sent as ep. (text) — check tag mapping" : "⚠️ not observed on captured hits"}`,
);
await page.waitForTimeout(1500);
await browser.close();
