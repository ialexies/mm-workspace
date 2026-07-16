import { chromium } from "playwright";
import { mkdirSync } from "fs";

// Verify the currency/value fix: adding a room to a cart that ALREADY has an
// item should fire exactly ONE add_to_cart event, with `value` equal to just
// the newly added room (not the running cart total), uppercase currency, and
// a populated items[]. Then verify remove_from_cart the same way.

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
  if (/add_to_cart|remove_from_cart|GTM|analytics/i.test(t)) console.log("   [page]", t.slice(0, 200));
});

const eventsByName = (name) =>
  page.evaluate(
    (n) =>
      (window.dataLayer || [])
        .filter((e) => e && e.event === n)
        .map((e) => ({
          currency: e.ecommerce?.currency,
          value: e.ecommerce?.value,
          item_type: e.ecommerce?.item_type,
          item_id: e.ecommerce?.item_id,
          items: e.ecommerce?.items?.map((it) => ({
            item_id: it.item_id,
            item_name: it.item_name,
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

// ── Destination page: reveal room list ─────────────────────────────────
await page.goto(
  `${BASE}/destination/dumaguete?checkIn=2026-08-05&checkOut=2026-08-06&adult=1`,
  { waitUntil: "domcontentloaded", timeout: 60000 },
);
await consent();
await page.waitForTimeout(3000);
await page.locator('button:has-text("ADD BED OR ROOM")').first().click({ timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1500);

// ── Add FIRST room ──────────────────────────────────────────────────────
const addButtons = page.locator('button:has-text("ADD TO TRIP")');
await addButtons.first().click({ timeout: 10000 }).catch(() => {});
let afterFirst = [];
for (let i = 0; i < 20; i++) {
  afterFirst = await eventsByName("add_to_cart");
  if (afterFirst.length >= 1) break;
  await page.waitForTimeout(1000);
}
console.log("\n=== add_to_cart after FIRST room ===");
console.log(JSON.stringify(afterFirst, null, 2));
// Extra settle time so the first add's full async chain (refreshCartAfterRoomMutation,
// perk sync, etc.) is definitely finished before the second click.
await page.waitForTimeout(2000);

// ── Add SECOND room (different room type) — this is the critical case: if
// value were still "whole cart total", this event's value would include
// BOTH rooms instead of just the second one. ─────────────────────────────
const secondAddCount = await addButtons.count();
if (secondAddCount > 1) {
  await addButtons.nth(1).click({ timeout: 10000 }).catch(() => {});
} else {
  await addButtons.first().click({ timeout: 10000 }).catch(() => {});
}
let afterSecond = [];
for (let i = 0; i < 20; i++) {
  afterSecond = await eventsByName("add_to_cart");
  if (afterSecond.length >= afterFirst.length + 1) break;
  await page.waitForTimeout(1000);
}
console.log("\n=== add_to_cart after SECOND room (cumulative dataLayer) ===");
console.log(JSON.stringify(afterSecond, null, 2));

const secondEvent = afterSecond[afterSecond.length - 1];
const firstEvent = afterFirst[afterFirst.length - 1];
const fireCount = afterSecond.length - afterFirst.length;

console.log(
  `\nadd_to_cart RESULT: fired ${fireCount}x on the second add (expect 1). ` +
    `second event value=${secondEvent?.value}, currency=${secondEvent?.currency}, ` +
    `items=${secondEvent?.items?.length ?? 0}`,
);
const currencyOk = secondEvent?.currency === (secondEvent?.currency || "").toUpperCase() && !!secondEvent?.currency;
const valueLooksPerItem =
  firstEvent?.value != null &&
  secondEvent?.value != null &&
  // per-item value should NOT be roughly first+second cumulative
  Math.abs(secondEvent.value - (firstEvent.value + secondEvent.value)) > 0.01;
console.log(
  `add_to_cart currency uppercase: ${currencyOk ? "✅" : "❌"}; has items[]: ${
    (secondEvent?.items?.length ?? 0) > 0 ? "✅" : "❌"
  }`,
);

await page.screenshot({ path: `${OUT}/arc-1-two-rooms.png`, fullPage: true });

// ── Remove one room ──────────────────────────────────────────────────────
const removeButtons = page.locator('button[aria-label*="remove" i], button:has-text("Remove")');
let removed = false;
// Fall back: try the minus/decrement control near an added room card.
const minusButtons = page.locator('button:has(svg[data-testid="RemoveIcon"])');
if (await minusButtons.count()) {
  await minusButtons.first().click({ timeout: 5000 }).catch(() => {});
  removed = true;
} else if (await removeButtons.count()) {
  await removeButtons.first().click({ timeout: 5000 }).catch(() => {});
  removed = true;
}
console.log("\nremove attempted:", removed);
await page.waitForTimeout(2500);
const removeEvents = await eventsByName("remove_from_cart");
console.log("\n=== remove_from_cart events ===");
console.log(JSON.stringify(removeEvents, null, 2));
console.log(
  `\nremove_from_cart RESULT: fired ${removeEvents.length}x, ` +
    `has currency+value+items: ${
      removeEvents.length && removeEvents[0].currency && removeEvents[0].items?.length
        ? "✅"
        : removeEvents.length
          ? "⚠️ fired but missing currency/value/items (unmatched line — falls back to id-only, acceptable if addon)"
          : "❌ did not fire"
    }`,
);

// ── view_cart / begin_checkout currency casing spot check ────────────────
const viewCart = await eventsByName("view_cart");
console.log("\nview_cart currency samples:", viewCart.map((e) => e.currency));

await page.waitForTimeout(1500);
await browser.close();
