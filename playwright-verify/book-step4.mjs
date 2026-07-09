import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'https://staging.madmonkeyhostels.com';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const STATE = 'f:/madmonkey2/MM_V3/playwright-verify/auth-state.json';
const OUT = 'f:/madmonkey2/MM_V3/playwright-verify/screenshots';
try { mkdirSync(OUT, { recursive: true }); } catch {}

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 40 });
const ctx = await browser.newContext({ storageState: STATE, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

let checkoutBody = null;
page.on('request', req => {
  if (req.method() === 'POST' && /\/cart\/checkout/.test(req.url())) {
    try { checkoutBody = req.postData(); } catch {}
    console.log('>>> POST cart/checkout intercepted');
  }
});

async function dump(label) {
  const els = await page.evaluate(() => { const o = []; document.querySelectorAll('button, a[role="button"]').forEach(b => { const t = (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' '); if (t && t.length < 40) o.push(t); }); return [...new Set(o)]; });
  console.log(`ACTIONS [${label}]:`, JSON.stringify(els.filter(t => !/^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day|^(ABOUT|ROOMS|EXPERIENCES|LOCATION|Our Story|Ha Giang|Tour & Groups|No Sex|Cancellation|Privacy|Terms|Investor|Property Partners|Content Creators|Travel Agencies|Tour Operators|We're Hiring|Mad Monkey|Creator Hub|SUBSCRIBE|Destination|VIEW ON MAP|SHOW ALL|READ MORE|Go to the)/.test(t)).slice(0, 30)));
}

await page.goto(`${BASE}/destination/dumaguete?gclid=STG_BOOK1&utm_source=google&utm_medium=cpc&utm_campaign=stg_full&checkIn=2026-07-02&checkOut=2026-07-03&adult=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
try { const d = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all")').first(); if (await d.isVisible({ timeout: 3000 })) { await d.click(); } } catch {}
await page.waitForTimeout(3500);

await page.locator('button:has-text("ADD TO TRIP")').first().click({ timeout: 8000 });
console.log('added to trip');
await page.waitForTimeout(2000);

await page.locator('button:has-text("CONTINUE TO CHECKOUT")').first().click({ timeout: 8000 });
console.log('clicked CONTINUE TO CHECKOUT');
await page.waitForURL(u => u.pathname.startsWith('/booking'), { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(4000);
console.log('URL:', page.url());
await page.screenshot({ path: `${OUT}/s4-booking.png`, fullPage: true });
await dump('booking page');

// Find the final pay/checkout action on /booking
let paid = false;
for (const sel of ['button:has-text("PROCEED TO PAYMENT")', 'button:has-text("CONTINUE TO PAYMENT")', 'button:has-text("PAY NOW")', 'button:has-text("COMPLETE BOOKING")', 'button:has-text("CHECKOUT")', 'button:has-text("PAY")', 'button:has-text("CONFIRM")']) {
  try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 1500 })) { await b.scrollIntoViewIfNeeded().catch(()=>{}); await b.click(); console.log('clicked pay via', sel); paid = true; break; } } catch {}
}
console.log('clicked pay button:', paid);
await page.waitForTimeout(6000); // wait for /cart/checkout + Stripe to load
await page.screenshot({ path: `${OUT}/s4-after-pay-click.png`, fullPage: true });
await dump('after pay click');
console.log('\n=== checkoutBody (Part 2) ===');
console.log(checkoutBody || 'NOT CAPTURED');
await page.waitForTimeout(1500);
await browser.close();
console.log('DONE');
