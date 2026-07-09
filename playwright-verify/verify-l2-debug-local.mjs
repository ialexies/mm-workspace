import { chromium } from "playwright";

// L2 dev smoke: in DEV (NODE_ENV=development) the guard is true, so the GTM debug
// helpers SHOULD still be present (no dev regression), the deleted "Rendering GTM
// Component" render log should be GONE, and GTM must still load normally.
// (Prod stripping is guaranteed by Next inlining NODE_ENV; confirm on staging.)

const BASE = "http://localhost:3000";
const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 30 });
const page = await browser.newPage();

const logs = [];
page.on("console", (m) => logs.push(m.text()));

let gtmJs = false;
page.on("request", (r) => {
  if (/googletagmanager\.com\/gtm\.js/.test(r.url())) gtmJs = true;
});

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(6000); // allow the setTimeout(2000) debug + Cookiebot monitor to run

const state = await page.evaluate(() => ({
  testGTM: typeof window.testGTM,
  dataLayerLen: (window.dataLayer || []).length,
  events: [...new Set((window.dataLayer || []).filter((e) => e && e.event).map((e) => e.event))].slice(0, 10),
}));

const has = (s) => logs.some((l) => l.includes(s));
console.log("=== L2 dev smoke (localhost:3000, DEV build) ===");
console.log("GTM debug present in dev (expected YES):");
console.log("  '🚀 GTM Loading Status':", has("GTM Loading Status"));
console.log("  window.testGTM is function:", state.testGTM === "function");
console.log("  'Cookiebot Integration Monitor':", has("Cookiebot Integration Monitor"));
console.log("Deleted render log gone (expected NOT present):");
console.log("  '🎯 Rendering GTM Component':", has("Rendering GTM Component"));
console.log("Regression — GTM still loads:");
console.log("  gtm.js requested:", gtmJs, "| dataLayer len:", state.dataLayerLen);
console.log("  events:", JSON.stringify(state.events));

const devOk = has("GTM Loading Status") && state.testGTM === "function";
const renderLogGone = !has("Rendering GTM Component");
const gtmOk = gtmJs && state.dataLayerLen > 0;
console.log(
  `\nRESULT: dev debug intact ${devOk ? "✅" : "❌"} | render log removed ${renderLogGone ? "✅" : "❌"} | GTM loads ${gtmOk ? "✅" : "❌"}`,
);
await browser.close();
