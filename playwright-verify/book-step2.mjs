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

await page.goto(`${BASE}/destination/dumaguete?gclid=STG_BOOK1&utm_source=google&utm_medium=cpc&utm_campaign=stg_full`, { waitUntil: 'domcontentloaded', timeout: 60000 });
try { const d = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all")').first(); if (await d.isVisible({ timeout: 3000 })) { await d.click(); } } catch {}
await page.waitForTimeout(2500);

async function dump(label) {
  const els = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, a[role="button"]').forEach(b => { const t = (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' '); if (t && t.length < 45) out.push(t); });
    return [...new Set(out)];
  });
  console.log(`ACTIONS [${label}]:`, JSON.stringify(els.slice(0, 45)));
}

// 1. Open the date picker
for (const sel of ['button:has-text("ADD DATES")', 'button:has-text("VIEW DATES")', 'button:has-text("Book Now")']) {
  try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 2000 })) { await b.click(); console.log('opened picker via', sel); break; } } catch {}
}
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/s2-after-open.png` });

// 2. Click two visible future dates
async function clickDate(label) {
  const loc = page.locator(`button[aria-label="${label}"]:visible`).first();
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await loc.click({ timeout: 8000 });
}
let datesOk = false;
for (const [ci, co] of [['Thursday, July 2nd, 2026', 'Friday, July 3rd, 2026'], ['Monday, July 6th, 2026', 'Tuesday, July 7th, 2026'], ['Tuesday, June 30th, 2026', 'Wednesday, July 1st, 2026']]) {
  try { await clickDate(ci); await page.waitForTimeout(500); await clickDate(co); await page.waitForTimeout(1500); console.log('selected dates:', ci, '->', co); datesOk = true; break; }
  catch (e) { console.log('date pair failed:', ci, '-', e.message.split('\n')[0]); }
}
if (!datesOk) { console.log('NO DATES SELECTED'); await page.screenshot({ path: `${OUT}/s2-nodate.png` }); await browser.close(); process.exit(1); }

await page.screenshot({ path: `${OUT}/s2-dates-picked.png` });
await dump('after dates');

// 3. Look for a search/apply/check-availability action
for (const sel of ['button:has-text("SEARCH")', 'button:has-text("Search")', 'button:has-text("CHECK AVAILABILITY")', 'button:has-text("APPLY")', 'button:has-text("DONE")']) {
  try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 1500 })) { await b.click(); console.log('clicked', sel); await page.waitForTimeout(3000); break; } } catch {}
}
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/s2-after-search.png`, fullPage: true });
await dump('after search');
console.log('URL:', page.url());
await page.waitForTimeout(1000);
await browser.close();
console.log('DONE');
