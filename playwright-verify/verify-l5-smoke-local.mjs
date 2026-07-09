import { chromium } from "playwright";

// L5 is a type-only change (identical emitted JS). This smoke just confirms no
// runtime regression on the running dev server: app loads, dataLayer + gtmTracker
// (TikTok ttq path, Cookiebot access) work, and no analytics console errors.

const BASE = "http://localhost:3000";
const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 30 });
const page = await browser.newPage();

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 140));
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message.slice(0, 140)));

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

// SPA nav to fire a gtmPushEvent (exercises gtmTracker: dataLayer push +
// ensureTikTokTrackPatched, which reads window.ttq — the typed-now global).
await page.evaluate(() => window.next?.router?.push?.("/tours-events")).catch(() => {});
await page.waitForTimeout(4000);

const state = await page.evaluate(() => ({
  dataLayerIsArray: Array.isArray(window.dataLayer),
  dataLayerLen: (window.dataLayer || []).length,
  events: [...new Set((window.dataLayer || []).filter((e) => e && e.event).map((e) => e.event))].slice(0, 12),
  cookiebotType: typeof window.Cookiebot,
  ttqType: typeof window.ttq,
}));

// Only flag errors that touch the analytics surface we changed.
const relevantErrors = errors.filter((e) => /ttq|gtmTracker|Cookiebot|clarity|dataLayer|is not a function|undefined/.test(e));

console.log("=== L5 runtime smoke (localhost:3000) ===");
console.log("dataLayer is array:", state.dataLayerIsArray, "| length:", state.dataLayerLen);
console.log("dataLayer events seen:", JSON.stringify(state.events));
console.log("typeof window.Cookiebot:", state.cookiebotType, "| typeof window.ttq:", state.ttqType);
console.log("analytics-related console errors:", relevantErrors.length, JSON.stringify(relevantErrors));

const ok = state.dataLayerIsArray && state.dataLayerLen > 0 && relevantErrors.length === 0;
console.log(`\nRESULT: ${ok ? "✅ no runtime regression — dataLayer/gtmTracker healthy" : "⚠️ inspect above"}`);
await browser.close();
