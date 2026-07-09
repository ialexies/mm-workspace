import { chromium } from "playwright";

// M2: Clarity must NOT load without statistics consent. On localhost Cookiebot
// does not grant consent, so a fresh visit should produce ZERO clarity.ms/tag
// requests and leave window.clarity undefined (fixed code). Old code loaded it
// unconditionally.

const BASE = "http://localhost:3000";
const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 30 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// M2 targets the _app.tsx Clarity project tag o7iu329276 specifically.
const CLARITY_ID = "o7iu329276";
const clarityReqs = []; // the M2 tag
const otherMsReqs = []; // e.g. the GTM "UET Microsoft" tag (343058181) — M4, separate
page.on("request", (r) => {
  const u = r.url();
  if (u.includes(CLARITY_ID)) clarityReqs.push(u.slice(0, 90));
  else if (/clarity\.ms\/tag/.test(u)) otherMsReqs.push(u.slice(0, 90));
});

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(6000); // give scripts time to run

const state = await page.evaluate(() => ({
  clarityDefined: typeof window.clarity !== "undefined",
  clarityLoadedFlag: !!window.__clarityLoaded,
  cookiebotStatistics: (window.Cookiebot && window.Cookiebot.consent && window.Cookiebot.consent.statistics) ?? null,
}));

console.log("=== M2 Clarity consent gate (no-consent visit) ===");
console.log(`M2 tag (${CLARITY_ID}) requests:`, clarityReqs.length, JSON.stringify(clarityReqs));
console.log("__clarityLoaded flag (our gate):", state.clarityLoadedFlag);
console.log("Cookiebot.consent.statistics:", state.cookiebotStatistics);
console.log("--- separate (M4, GTM UET Microsoft) ---");
console.log("other clarity.ms requests:", otherMsReqs.length, JSON.stringify(otherMsReqs));

const blocked = clarityReqs.length === 0 && !state.clarityLoadedFlag;
console.log(
  `\nRESULT (M2): ${blocked ? "✅ o7iu329276 BLOCKED without consent (fix works)" : "❌ still loading without consent"}`,
);
if (otherMsReqs.length) console.log("NOTE: a separate Microsoft UET tag (343058181) loads via GTM without consent — that's M4 (GTM ad-pixel consent), not M2.");
await page.waitForTimeout(1000);
await browser.close();
