import { chromium } from "playwright";

// L1 no-regression: with NO env override, the env-driven code must fall back to
// the current IDs — GTM loads gtm.js?id=GTM-KC78NFHD and Clarity still uses
// o7iu329276 (gated by M2). BASE overridable via TEST_BASE (default localhost:3000).

const BASE = process.env.TEST_BASE || "http://localhost:3000";
const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 30 });
const page = await browser.newPage();

let gtmId = null;
const clarityIds = [];
page.on("request", (r) => {
  const u = r.url();
  const m = u.match(/googletagmanager\.com\/gtm\.js\?id=([^&]+)/);
  if (m) gtmId = m[1];
  const c = u.match(/clarity\.ms\/tag\/([A-Za-z0-9]+)/);
  if (c) clarityIds.push(c[1]);
});

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(6000);

// Read the inline Clarity snippet id straight from the DOM (the gated loader references it)
const inlineClarityId = await page.evaluate(() => {
  const s = [...document.querySelectorAll("script")].find((x) => /clarity\.ms\/tag/.test(x.textContent || ""));
  const m = s && (s.textContent || "").match(/"script",\s*"([A-Za-z0-9]+)"/);
  return m ? m[1] : null;
});

console.log("=== L1 fallback (no env override) ===");
console.log("gtm.js id:", gtmId);
console.log("inline Clarity id in snippet:", inlineClarityId);
console.log("clarity.ms/tag ids requested:", JSON.stringify(clarityIds));

const gtmOk = gtmId === "GTM-KC78NFHD";
const clarityOk = inlineClarityId === "o7iu329276";
console.log(
  `\nRESULT: GTM fallback ${gtmOk ? "✅" : "❌ (" + gtmId + ")"} | Clarity snippet fallback ${clarityOk ? "✅" : "❌ (" + inlineClarityId + ")"}`,
);
await browser.close();
