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

// Go to next month for safer availability
try { await page.locator('button[aria-label="Go to the Next Month"]').first().click(); await page.waitForTimeout(800); } catch (e) { console.log('next month click failed:', e.message); }

// Collect enabled date buttons (aria-label like "Monday, July 13th, 2026")
const dates = await page.evaluate(() => {
  const re = /^(?:Today, )?(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, [A-Z][a-z]+ \d+(?:st|nd|rd|th), 20\d\d$/;
  return [...document.querySelectorAll('button[aria-label]')]
    .filter(b => re.test(b.getAttribute('aria-label')) && !b.disabled && b.getAttribute('aria-disabled') !== 'true')
    .map(b => b.getAttribute('aria-label'));
});
console.log('enabled dates sample:', JSON.stringify(dates.slice(0, 8)));

if (dates.length < 2) { console.log('NOT ENOUGH DATES'); await browser.close(); process.exit(1); }
const checkin = dates[3], checkout = dates[4];
console.log('checkin =', checkin, '| checkout =', checkout);
await page.locator(`button[aria-label="${checkin}"]`).first().click();
await page.waitForTimeout(600);
await page.locator(`button[aria-label="${checkout}"]`).first().click();
await page.waitForTimeout(2500);

// After selecting dates, look for room/book actions
const els = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('button, a[role="button"]').forEach(b => { const t = (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' '); if (t && t.length < 40) out.push(t); });
  return [...new Set(out)];
});
console.log('ACTIONS after dates:', JSON.stringify(els.slice(0, 50)));
await page.screenshot({ path: `${OUT}/book-dates-selected.png`, fullPage: false });
console.log('URL:', page.url());
await page.waitForTimeout(1000);
await browser.close();
console.log('DONE');
