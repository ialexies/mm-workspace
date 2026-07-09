import { chromium } from "playwright";

// M4 ground-truth check: on a FRESH no-consent visit to staging (published
// container), do advertising/marketing pixels fire before the user consents?
// If M4 is fixed, ALL of these should be ZERO until marketing consent is granted.

const BASE = "https://staging.madmonkeyhostels.com";
const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const PIXELS = {
  "Microsoft UET / Clarity-UET": /clarity\.ms\/tag\/uet|bat\.bing\.com/,
  "Meta / Facebook": /connect\.facebook\.net|facebook\.com\/tr/,
  TikTok: /analytics\.tiktok\.com|analytics-sg\.tiktok\.com/,
  Reddit: /reddit\.com\/(rp|api)|redditstatic\.com|pixel\.reddit/,
  Sojern: /sojern|beacon\.krxd|onlny/,
  Tapfiliate: /tapfiliate|tapfil/,
  "Clarity (project)": /clarity\.ms\/tag\/[a-z0-9]{8,}(?!\/uet)/,
};

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 30 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); // fresh = no consent cookie
const page = await ctx.newPage();

const hits = {};
for (const k of Object.keys(PIXELS)) hits[k] = [];
page.on("request", (r) => {
  const u = r.url();
  for (const [name, re] of Object.entries(PIXELS)) {
    if (re.test(u)) hits[name].push(u.slice(0, 90));
  }
});

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3000);
// navigate once more (some pixels fire on route change) — still WITHOUT accepting consent
await page.evaluate(() => window.next?.router?.push?.("/tours-events")).catch(() => {});
await page.waitForTimeout(4000);

const consent = await page.evaluate(() => {
  try { return window.Cookiebot?.consent ?? null; } catch { return "err"; }
});

console.log("=== M4 no-consent pixel check (staging, published container) ===");
console.log("Cookiebot.consent:", JSON.stringify(consent));
let leaks = 0;
for (const [name, list] of Object.entries(hits)) {
  const n = list.length;
  if (n) leaks++;
  console.log(`  ${n ? "❌ LEAK" : "✅ blocked"}  ${name}: ${n}${n ? " — " + list[0] : ""}`);
}
console.log(
  `\nRESULT: ${leaks === 0 ? "✅ M4 looks FIXED — no ad pixels fired without consent" : `❌ ${leaks} pixel group(s) fired WITHOUT consent — M4 not fully fixed`}`,
);
await browser.close();
