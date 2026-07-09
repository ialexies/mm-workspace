import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://localhost:9222");
let page = null;
for (const c of browser.contexts())
  for (const p of c.pages())
    if (/madmonkeyhostels\.com/.test(p.url())) page = p;
if (!page) { console.log("no page"); process.exit(1); }
console.log("attached:", page.url());

// Capture ANY google analytics / gtm / collect request
const reqs = [];
page.on("request", (req) => {
  const u = req.url();
  if (/google-analytics|googletagmanager|\/g\/collect|analytics\.google/.test(u)) {
    reqs.push(u.slice(0, 120));
  }
});

// Consent + dataLayer state
const state = await page.evaluate(() => {
  const dl = window.dataLayer || [];
  const consentEvents = dl.filter((e) => Array.isArray(e) && e[0] === "consent");
  // gtag consent is stored internally; surface what we can from dataLayer
  const screen = dl.filter((e) => e && e.event === "screen_view").map((e) => e.app_page_location);
  const events = [...new Set(dl.filter((e) => e && e.event).map((e) => e.event))];
  return {
    dlLength: dl.length,
    consentPushes: consentEvents.map((e) => ({ arg1: e[1], arg2: e[2] })),
    screen_view_paths: screen,
    distinct_events: events,
    hasGtag: typeof window.gtag === "function",
    cookiebotConsent: window.Cookiebot?.consent ?? null,
  };
});
console.log("\n=== app dataLayer / consent state ===");
console.log(JSON.stringify(state, null, 2));

// Trigger a client-side navigation via the Next router (no reload)
const navOk = await page.evaluate(() => {
  try {
    const r = window.next?.router;
    if (r?.push) { r.push("/tours-events"); return "router.push"; }
    return "no-router";
  } catch (e) { return "err:" + e.message; }
});
console.log("nav trigger:", navOk);
await page.waitForTimeout(6000);
console.log("url now:", page.url());
const after = await page.evaluate(() => (window.dataLayer || []).filter((e) => e && e.event === "screen_view").map((e) => e.app_page_location));
console.log("screen_view paths after nav:", JSON.stringify(after));

console.log("\n=== google analytics/gtm/collect requests seen ===");
console.log(JSON.stringify(reqs, null, 2));
await browser.close();
