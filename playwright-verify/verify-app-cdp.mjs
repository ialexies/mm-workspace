import { chromium } from "playwright";

// H5 end-to-end (published container): connect to the running Android WebView via
// CDP, reload to fetch the freshly published GTM container, and capture the GA4
// /g/collect hits — checking (a) page_location (dl=) carries the app path, and
// (b) app_page_location arrives as an event param (ep.app_page_location).

const browser = await chromium.connectOverCDP("http://localhost:9222");
let page = null;
for (const c of browser.contexts())
  for (const p of c.pages())
    if (/madmonkeyhostels\.com/.test(p.url())) page = p;
if (!page) { console.log("no madmonkeyhostels page in WebView"); process.exit(1); }
console.log("attached:", page.url(), "| platform:", await page.evaluate(() => window.Capacitor?.getPlatform?.() ?? "n/a"));

const hits = [];
page.on("request", (req) => {
  const u = req.url();
  if (!/google-analytics\.com\/g\/collect|\/g\/collect|region\d+\.google-analytics|analytics\.google\.com\/g\/collect/.test(u)) return;
  const scan = (p, batched) => {
    const en = p.get("en");
    if (!en) return;
    hits.push({
      en,
      tid: p.get("tid"),
      page_location: p.get("dl"),                       // built-in page_location
      app_page_location: p.get("ep.app_page_location"), // custom event param
      site_type: p.get("ep.site_type"),
      batched: !!batched,
    });
  };
  scan(new URL(u).searchParams, false);
  const body = req.postData();
  if (body) body.split("\n").forEach((line) => scan(new URLSearchParams(line), true));
});

// Reload to fetch the freshly published container + fire the native screen_view on mount.
try { await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 }); } catch (e) { console.log("reload err:", e.message.slice(0, 60)); }
await page.waitForTimeout(6000);

console.log("\n=== GA4 /g/collect hits after reload ===");
console.log(JSON.stringify(hits, null, 2));

const anyHit = hits.length > 0;
const aplParam = hits.some((h) => h.app_page_location);
const locHasPath = hits.some((h) => h.page_location && !/^https?:\/\/[^/]+\/?$/.test(h.page_location) || (h.page_location && h.app_page_location));
console.log(
  `\nRESULT (real Android app, published container):\n  - GA4 hit(s) sent: ${anyHit ? "✅ yes (" + hits.length + ")" : "❌ none captured"}\n  - app_page_location event param present: ${aplParam ? "✅ yes" : "⚠️ not seen"}\n  - page_location carries app path: ${hits.find((h) => h.app_page_location)?.page_location ?? hits[0]?.page_location ?? "n/a"}`,
);
await browser.close();
