import { chromium } from "playwright";

// M4 Part B — test BOTH branches of the Tapfiliate consent gate on localhost.
// window._tapInit is set ONLY by our app code (not the GTM tag), so it cleanly
// isolates our loader:
//   Phase 1 (consent denied)   -> _tapInit stays false (loader blocked)
//   Phase 2 (marketing granted)-> _tapInit becomes true (loader runs)
// Consent is simulated by overriding window.Cookiebot + firing the Cookiebot event.

const BASE = "http://localhost:3000";
const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 30 });
const page = await browser.newPage();

let ourLoads = 0; // requests that happen right after we grant consent
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(6000);

// ── Phase 1: no consent ────────────────────────────────────────────────
const phase1 = await page.evaluate(() => ({
  tapInit: !!window._tapInit,
  marketing: window.Cookiebot?.consent?.marketing ?? null,
}));

// ── Phase 2: simulate marketing consent granted, fire Cookiebot event ───
await page.evaluate(() => {
  window.Cookiebot = {
    consent: { necessary: true, preferences: true, statistics: true, marketing: true },
  };
  window.dispatchEvent(new Event("CookiebotOnConsentChange"));
  window.dispatchEvent(new Event("CookiebotOnConsentReady"));
});
await page.waitForTimeout(3000);

const phase2 = await page.evaluate(() => ({
  tapInit: !!window._tapInit,
  marketing: window.Cookiebot?.consent?.marketing ?? null,
}));

console.log("=== M4 Part B — Tapfiliate gate, BOTH cases (localhost) ===");
console.log("Phase 1 (consent DENIED):");
console.log("  Cookiebot.consent.marketing:", phase1.marketing);
console.log("  our loader ran (_tapInit):", phase1.tapInit, phase1.tapInit ? "❌ should be false" : "✅");
console.log("Phase 2 (marketing GRANTED, simulated):");
console.log("  Cookiebot.consent.marketing:", phase2.marketing);
console.log("  our loader ran (_tapInit):", phase2.tapInit, phase2.tapInit ? "✅" : "❌ should be true");

const ok = phase1.tapInit === false && phase2.tapInit === true;
console.log(`\nRESULT: ${ok ? "✅ gate correct — blocked when denied, loads when granted" : "❌ gate misbehaves — inspect above"}`);
await browser.close();
