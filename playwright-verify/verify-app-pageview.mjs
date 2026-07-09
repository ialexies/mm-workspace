import { chromium } from "playwright";

// H5 check: does the app emit `screen_view` carrying `app_page_location`, and does
// that param reach GA4? _app.tsx only fires this when Capacitor.isNativePlatform()
// is true. Capacitor derives platform from window.androidBridge / webkit bridge, so
// we seed window.androidBridge BEFORE the bundle loads to make it detect "android".
// Then we (a) read the dataLayer for screen_view+app_page_location and (b) sniff GA4
// /g/collect hits for en=screen_view with ep.app_page_location.

const BASE = "https://staging.madmonkeyhostels.com";
const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 40 });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // phone-ish
const page = await ctx.newPage();

// Force Capacitor to detect a native Android platform.
await ctx.addInitScript(() => {
  // Capacitor getPlatformId(): win.androidBridge -> "android"
  window.androidBridge = { postMessage: () => {} };
});

// Sniff GA4 collection hits for screen_view + app_page_location
const ga4Hits = [];
page.on("request", (req) => {
  const u = req.url();
  if (/\/g\/collect|google-analytics\.com\/g\/collect|region1\.google-analytics/.test(u)) {
    const url = new URL(u);
    const en = url.searchParams.get("en");
    // app_page_location arrives as an event param: ep.app_page_location
    const apl = url.searchParams.get("ep.app_page_location");
    const tid = url.searchParams.get("tid");
    if (en === "screen_view" || apl) ga4Hits.push({ en, tid, app_page_location: apl });
    // batched hits put params in the POST body
    const body = req.postData();
    if (body && /screen_view|app_page_location/.test(body)) {
      body.split("\n").forEach((line) => {
        const p = new URLSearchParams(line);
        const en2 = p.get("en");
        const apl2 = p.get("ep.app_page_location");
        if (en2 === "screen_view" || apl2) ga4Hits.push({ en: en2, tid, app_page_location: apl2, batched: true });
      });
    }
  }
});

const screenViews = () =>
  page.evaluate(() =>
    (window.dataLayer || [])
      .filter((e) => e && e.event === "screen_view")
      .map((e) => ({ app_page_location: e.app_page_location })),
  );

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
try {
  const d = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all")').first();
  if (await d.isVisible({ timeout: 3000 })) await d.click();
} catch {}
await page.waitForTimeout(3000);

const platform = await page.evaluate(() => {
  try {
    // @ts-ignore
    return window.Capacitor?.getPlatform?.() ?? "unknown";
  } catch {
    return "err";
  }
});
console.log("Capacitor.getPlatform():", platform);
console.log("screen_view on load:", JSON.stringify(await screenViews()));

// client-side navigation (SPA) — native handler fires on routeChangeComplete
await page.evaluate(() => window.next?.router?.push?.("/tours-events")).catch(() => {});
await page.waitForTimeout(3500);
await page.evaluate(() => window.next?.router?.push?.("/destination/dumaguete")).catch(() => {});
await page.waitForTimeout(3500);

const sv = await screenViews();
console.log("\n=== dataLayer screen_view events ===");
console.log(JSON.stringify(sv, null, 2));
console.log("\n=== GA4 /g/collect hits with screen_view / app_page_location ===");
console.log(JSON.stringify(ga4Hits, null, 2));

const emitsParam = sv.some((e) => typeof e.app_page_location === "string" && e.app_page_location.length);
const reachesGa4 = ga4Hits.some((h) => h.app_page_location);
console.log(
  `\nRESULT:\n  - code emits screen_view w/ app_page_location: ${emitsParam ? "✅ yes" : "❌ no"}\n  - param reaches GA4 /g/collect: ${reachesGa4 ? "✅ yes (ep.app_page_location present)" : "⚠️ not observed in web collect (app stream uses Firebase SDK; confirm in GA4 DebugView on device)"}`,
);
await page.waitForTimeout(1500);
await browser.close();
