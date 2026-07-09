import { chromium } from "playwright";

// M4 Part B: Tapfiliate must NOT load without Cookiebot marketing consent.
// On localhost Cookiebot doesn't grant consent, so a fresh visit should make
// ZERO requests to script.tapfiliate.com and leave window.tap undefined.

const BASE = "http://localhost:3000";
const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 30 });
const page = await browser.newPage();

const tapReqs = [];
page.on("request", (r) => {
  if (/tapfiliate\.com/.test(r.url())) tapReqs.push(r.url().slice(0, 80));
});

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(6000);
// navigate once (route-detect useEffect also touches window.tap) — still no consent
await page.evaluate(() => window.next?.router?.push?.("/tours-events")).catch(() => {});
await page.waitForTimeout(3000);

const state = await page.evaluate(() => ({
  tapInit: !!window._tapInit,
  tapDefined: typeof window.tap !== "undefined",
  marketing: (window.Cookiebot && window.Cookiebot.consent && window.Cookiebot.consent.marketing) ?? null,
}));

console.log("=== M4 Part B — Tapfiliate consent gate (no-consent visit) ===");
console.log("script.tapfiliate.com requests:", tapReqs.length, JSON.stringify(tapReqs));
console.log("window._tapInit:", state.tapInit, "| window.tap defined:", state.tapDefined);
console.log("Cookiebot.consent.marketing:", state.marketing);

const blocked = tapReqs.length === 0 && !state.tapDefined;
console.log(`\nRESULT: ${blocked ? "✅ Tapfiliate BLOCKED without marketing consent (fix works)" : "❌ Tapfiliate loaded without consent"}`);
await browser.close();
