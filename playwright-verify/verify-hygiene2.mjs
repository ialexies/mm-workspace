import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:3000';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'f:/madmonkey2/MM_V3/playwright-verify/screenshots';
try { mkdirSync(OUT, { recursive: true }); } catch {}

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 50 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();
async function consent() { try { const d = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all")').first(); if (await d.isVisible({ timeout: 3000 })) await d.click(); } catch {} }
const countAtc = () => page.evaluate(() => (window.dataLayer || []).filter(e => e && e.event === 'add_to_cart' && e.ecommerce).length);
const lastAtc = () => page.evaluate(() => { const a = (window.dataLayer || []).filter(e => e && e.event === 'add_to_cart' && e.ecommerce); return a[a.length - 1] || null; });

await page.goto(`${BASE}/tours-events/valencia-tour`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await consent();
await page.waitForTimeout(4000);
console.log('on tour page:', page.url());
console.log('add_to_cart on LOAD (expect 0):', await countAtc());

// Open the availability date picker
for (const sel of ['text=Choose Dates for Booking', 'text=Availability', 'button:has-text("ADD DATES")']) {
  try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 2000 })) { await b.click(); console.log('opened picker via', sel); break; } } catch {}
}
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/hyg-B-picker.png`, fullPage: true });

// Pick the first available date-time slot (rows like "01 Jul 2026, 09:00 AM")
let datePicked = false;
for (const re of [/\d{2} Jul 2026, \d{2}:\d{2} [AP]M/, /\d{2} Aug 2026, \d{2}:\d{2} [AP]M/, /\d{2} \w{3} 2026, \d{2}:\d{2} [AP]M/]) {
  try { const slot = page.locator(`text=${re}`).first(); if (await slot.isVisible({ timeout: 2000 })) { await slot.click(); datePicked = true; console.log('picked slot matching', re); break; } } catch {}
}
await page.waitForTimeout(2500);
console.log('date picked:', datePicked, '| add_to_cart after date (expect 0):', await countAtc());
await page.screenshot({ path: `${OUT}/hyg-B-afterdate.png`, fullPage: true });

// Find the guest +/- buttons
const plus = page.locator('button:has(svg[data-testid="AddIcon"])').first();
const minus = page.locator('button:has(svg[data-testid="RemoveIcon"])').first();
if (await plus.isVisible({ timeout: 3000 }).catch(() => false)) {
  await plus.click(); await page.waitForTimeout(1000);
  const c1 = await countAtc(); console.log(`+ click 1  -> add_to_cart = ${c1} (expect 1) | qty=${(await lastAtc())?.ecommerce?.items?.[0]?.quantity}`);
  if (await minus.isVisible().catch(() => false)) { await minus.click(); await page.waitForTimeout(1000); console.log(`- click    -> add_to_cart = ${await countAtc()} (expect still 1)`); }
  await plus.click(); await page.waitForTimeout(1000);
  console.log(`+ click 2  -> add_to_cart = ${await countAtc()} (expect 2)`);
  const f = await countAtc();
  console.log(f === 2 ? '✅ B PASS (one add_to_cart per + only)' : `⚠️ B: final count ${f} — inspect`);
} else {
  console.log('Guest +/- not visible — see hyg-B-afterdate.png to adjust date selection.');
}
await page.waitForTimeout(1500);
await browser.close();
console.log('\nDONE');
