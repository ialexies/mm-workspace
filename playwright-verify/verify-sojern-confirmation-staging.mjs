import { chromium } from "playwright";
import { mkdirSync } from "fs";

// Diagnostic: does /booking/thanks carry payment_intent_id / session_id on a
// real rooms booking, or does it fall back to cart_id — and does that leak
// into the Sojern GTM chain (ecommerce.reservation_id -> ecommerce.transaction_id
// -> sjrn_confirmation)? Books a REAL paid rooms booking on staging (Sept dates).

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

// Capture the app's own fetch to /cart/{cartId}/confirmation — its
// payment_intent_id query param reveals exactly what paymentIntentIdFinal
// was AT FETCH TIME, without needing to touch app source.
const confirmationRequests = [];
page.on("request", (req) => {
  const u = req.url();
  if (u.includes("/confirmation")) {
    confirmationRequests.push(u);
    console.log("   [net] confirmation request:", u);
  }
});

const dataLayerEvents = (eventName) =>
  page.evaluate((name) =>
    (window.dataLayer || [])
      .filter((e) => e && e.event === name)
      .map((e) => ({
        event: e.event,
        transaction_id: e.ecommerce?.transaction_id,
        value: e.ecommerce?.value,
        currency: e.ecommerce?.currency,
        reservation_id: e.ecommerce?.reservation_id,
        items: e.ecommerce?.items?.length,
      })),
    eventName,
  );

const sessionSnapshot = () =>
  page.evaluate(() => ({
    cart_id: sessionStorage.getItem("cart_id"),
    payment_intent_id: sessionStorage.getItem("payment_intent_id"),
  }));

const calendarIconPresent = () =>
  page.evaluate(() => !!document.querySelector('[data-testid="CalendarMonthOutlinedIcon"]'));

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
await page.screenshot({ path: `${OUT}/sj-1-dest.png` });
await page.locator('button:has-text("CONTINUE TO CHECKOUT")').first().click({ timeout: 10000 }).catch(() => {});
await page.waitForURL((u) => u.pathname.startsWith("/booking"), { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(3500);
console.log("URL after CONTINUE TO CHECKOUT:", page.url());
await page.screenshot({ path: `${OUT}/sj-2-booking.png` });

// ── CONFIRM & PAY -> embedded Stripe ──────────────────────────────────────
await page.locator('button:has-text("CONFIRM & PAY")').first().click({ timeout: 10000 }).catch(() => {});
console.log("clicked CONFIRM & PAY, waiting for Stripe element...");
await page.waitForTimeout(8000);
await page.screenshot({ path: `${OUT}/sj-3-stripe.png`, fullPage: true });

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
await page.screenshot({ path: `${OUT}/sj-4-filled.png`, fullPage: true });

let payClicked = false;
const payBtns = page.locator("button", { hasText: /^Pay$/ });
if (await payBtns.count()) { await payBtns.first().scrollIntoViewIfNeeded().catch(() => {}); await payBtns.first().click().catch(() => {}); payClicked = true; }
if (!payClicked) {
  for (const f of page.frames()) { try { const b = f.locator('button:has-text("Pay")').first(); if (await b.count()) { await b.click(); payClicked = true; break; } } catch {} }
}
console.log("pay clicked:", payClicked);

// ── Wait for /booking/thanks ───────────────────────────────────────────────
await page.waitForURL((u) => u.pathname.includes("/booking/thanks"), { timeout: 70000 }).catch(() => console.log("did NOT reach /thanks in time"));

// Watch for any client-side URL change WHILE on /thanks (e.g. currencyContext's
// router.push appending ?currency=... ) — this would explain paymentIntentIdFinal
// transiently going undefined mid-page-life.
const urlChanges = [];
let lastUrl = page.url();
urlChanges.push({ t: 0, url: lastUrl });
const navStart = Date.now();
page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) {
    const u = frame.url();
    if (u !== lastUrl) {
      urlChanges.push({ t: Date.now() - navStart, url: u });
      lastUrl = u;
    }
  }
});

const finalUrl = new URL(page.url());
console.log("\n=== Redirect URL to /booking/thanks ===");
console.log("full URL:", finalUrl.href);
console.log("query params:", Object.fromEntries(finalUrl.searchParams.entries()));

// Poll Next.js's router singleton directly to see router.query/isReady over
// time on the SAME runtime the app uses — catches any transient reset that a
// filtered console.log wouldn't reveal.
const routerLog = [];
const pollStart = Date.now();
const routerPollTimer = setInterval(async () => {
  try {
    const snap = await page.evaluate(() => {
      const r = window.next && window.next.router;
      if (!r) return { noRouter: true };
      return {
        isReady: r.isReady,
        pathname: r.pathname,
        query: r.query,
      };
    });
    routerLog.push({ t: Date.now() - pollStart, ...snap });
  } catch {}
}, 150);

const session = await sessionSnapshot();
console.log("\n=== sessionStorage snapshot ===");
console.log(session);

// Poll for the app's own "purchase" push
let purchaseEvents = [];
for (let i = 0; i < 40; i++) {
  purchaseEvents = await dataLayerEvents("purchase");
  if (purchaseEvents.length) break;
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1500);

const iconPresent = await calendarIconPresent();
console.log("\n=== CalendarMonthOutlinedIcon present on /thanks? ===", iconPresent);

// Poll longer for the Sojern relay's re-pushed "sjrn_confirmation" event
// (its own DOM-poll budget is 10 attempts * 2000ms = 20s)
let sjrnEvents = [];
for (let i = 0; i < 22; i++) {
  sjrnEvents = await dataLayerEvents("sjrn_confirmation");
  if (sjrnEvents.length) break;
  await page.waitForTimeout(1000);
}

clearInterval(routerPollTimer);
await page.screenshot({ path: `${OUT}/sj-5-thanks.png`, fullPage: true });

console.log("\n=== dataLayer 'purchase' event(s) ===");
console.log(JSON.stringify(purchaseEvents, null, 2));

console.log("\n=== dataLayer 'sjrn_confirmation' event(s) (Sojern relay) ===");
console.log(JSON.stringify(sjrnEvents, null, 2));

console.log("\n=== /confirmation network request(s) ===");
console.log(confirmationRequests);

console.log("\n=== Client-side URL changes while on /thanks ===");
console.log(urlChanges);

console.log("\n=== window.next.router polling (every 150ms) ===");
console.log(JSON.stringify(routerLog, null, 2));

const p = purchaseEvents[0];
console.log("\n=== ANALYSIS ===");
if (p) {
  console.log("transaction_id:", p.transaction_id);
  console.log("reservation_id:", p.reservation_id ?? "(absent)");
  console.log("cart_id (session):", session.cart_id);
  console.log("payment_intent_id (session):", session.payment_intent_id);
  console.log("payment_intent_id (URL):", finalUrl.searchParams.get("payment_intent_id"));
  console.log("session_id (URL):", finalUrl.searchParams.get("session_id"));
  const txnEqualsCartId = session.cart_id && p.transaction_id === session.cart_id;
  console.log(
    txnEqualsCartId
      ? "\n⚠️  CONFIRMED: ecommerce.transaction_id === cart_id (the app-level fallback chain reached cart_id)."
      : "\n✅  transaction_id is NOT cart_id — payment_intent_id/session_id resolved as expected.",
  );
  if (!p.reservation_id) {
    console.log("⚠️  reservation_id is ABSENT on this push — Sojern's GTM variable would fall back to ecommerce.transaction_id" + (txnEqualsCartId ? " which IS the cart_id here." : " (a real id here, so Sojern would still get a valid-looking id — but on a slower Cloudbeds sync this fallback chain is what leaks cart_id)."));
  } else {
    console.log("✅  reservation_id is present — Sojern would receive the real Cloudbeds reservation id, no fallback needed.");
  }
} else {
  console.log("❌ No purchase event captured — cannot analyze.");
}

await page.waitForTimeout(2000);
await browser.close();
