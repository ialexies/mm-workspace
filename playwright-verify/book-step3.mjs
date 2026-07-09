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

// Capture the checkout request metadata (Part 2)
let checkoutBody = null;
page.on('request', req => {
  if (req.method() === 'POST' && /\/cart\/checkout/.test(req.url())) {
    try { checkoutBody = req.postData(); } catch {}
    console.log('>>> POST cart/checkout intercepted:', req.url());
  }
});
page.on('console', m => { const t = m.text(); if (/GTM purchase|Purchase ready|purchase event sent|mm_attribution/.test(t)) console.log('   [page]', t.slice(0, 160)); });

async function dump(label) {
  const els = await page.evaluate(() => { const o = []; document.querySelectorAll('button, a[role="button"], a').forEach(b => { const t = (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' '); if (t && t.length < 40) o.push(t); }); return [...new Set(o)]; });
  console.log(`ACTIONS [${label}]:`, JSON.stringify(els.filter(t => !/^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day/.test(t)).slice(0, 40)));
}

// Direct dated URL so rooms show without driving the picker
const url = `${BASE}/destination/dumaguete?gclid=STG_BOOK1&utm_source=google&utm_medium=cpc&utm_campaign=stg_full&checkIn=2026-07-02&checkOut=2026-07-03&adult=1`;
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
try { const d = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all")').first(); if (await d.isVisible({ timeout: 3000 })) { await d.click(); } } catch {}
await page.waitForTimeout(3500);

// Add first room to trip
const addBtn = page.locator('button:has-text("ADD TO TRIP")').first();
await addBtn.scrollIntoViewIfNeeded().catch(() => {});
await addBtn.click({ timeout: 8000 });
console.log('clicked ADD TO TRIP');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/s3-after-add.png`, fullPage: true });
await dump('after add to trip');

// Try to find a proceed-to-checkout / book / view trip action
let proceeded = false;
for (const sel of ['button:has-text("BOOK NOW")', 'button:has-text("Book Now")', 'button:has-text("CHECKOUT")', 'button:has-text("Checkout")', 'button:has-text("PROCEED")', 'button:has-text("VIEW TRIP")', 'a[href*="/booking"]']) {
  try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 1500 })) { await b.scrollIntoViewIfNeeded().catch(()=>{}); await b.click(); console.log('clicked proceed via', sel); proceeded = true; await page.waitForTimeout(3500); break; } } catch {}
}
console.log('proceeded:', proceeded, '| URL:', page.url());
await page.screenshot({ path: `${OUT}/s3-after-proceed.png`, fullPage: true });
await dump('after proceed');
console.log('checkoutBody so far:', checkoutBody ? checkoutBody.slice(0, 300) : null);
await page.waitForTimeout(1000);
await browser.close();
console.log('DONE');
