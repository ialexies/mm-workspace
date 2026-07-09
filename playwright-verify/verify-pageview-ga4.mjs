import { chromium } from "playwright";

const BASE = "https://staging.madmonkeyhostels.com";
const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 40 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Capture GA4 collect requests for the page_view event.
const pv = [];
page.on("request", (r) => {
  const u = r.url();
  if (/google-analytics\.com\/g\/collect/.test(u) && /[?&]en=page_view(&|$)/.test(u)) {
    const tid = (u.match(/[?&]tid=([^&]+)/) || [])[1] || "?";
    const dl = (u.match(/[?&]dl=([^&]+)/) || [])[1] || "";
    pv.push({ tid, page: decodeURIComponent(dl).replace(BASE, "") });
  }
});
async function consent() {
  try {
    const d = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all")').first();
    if (await d.isVisible({ timeout: 3000 })) { await d.click(); await page.waitForTimeout(500); }
  } catch {}
}
async function clientNav(path) {
  await page.waitForFunction(() => !!window.next?.router?.push, null, { timeout: 10000 }).catch(() => {});
  await page.evaluate((p) => window.next?.router?.push(p), path);
  await page.waitForURL((u) => u.pathname.startsWith(path.split("?")[0]), { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(7000); // GA4 batches/delays collect requests
}

console.log("=== Verifying GA4 page_view on staging (published container) ===\n");
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
await consent();
await page.waitForTimeout(4500);
const afterLoad = pv.length;
console.log(`[hard load]        page_view GA4 hits so far: ${afterLoad}`);

await clientNav("/destination/dumaguete");
const afterNav1 = pv.length;
console.log(`[in-app nav #1]    page_view GA4 hits so far: ${afterNav1}   (+${afterNav1 - afterLoad})`);

await clientNav("/tours-events/valencia-tour");
const afterNav2 = pv.length;
console.log(`[in-app nav #2]    page_view GA4 hits so far: ${afterNav2}   (+${afterNav2 - afterNav1})`);

// let GA4 flush any pending hit from the last nav
await page.waitForTimeout(6000);
console.log(`[after flush]      page_view GA4 hits total: ${pv.length}`);

console.log("\n--- all page_view hits sent to GA4 ---");
pv.forEach((h, i) => console.log(`  ${i + 1}. tid=${h.tid}  page=${h.page.slice(0, 80)}`));
const pages = pv.map((h) => h.page);
const gotDest = pages.some((p) => p.startsWith("/destination"));
const gotTour = pages.some((p) => p.startsWith("/tours-events"));
console.log(
  `\nRESULT: ${gotDest && gotTour ? "✅ GA4 received a page_view for each in-app navigation (destination + tour) — one per page" : "⚠️ missing a nav page_view — inspect above"}`,
);
await page.waitForTimeout(1000);
await browser.close();
