import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:3000';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'f:/madmonkey2/MM_V3/playwright-verify/screenshots';
try { mkdirSync(OUT, { recursive: true }); } catch {}

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 40 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();
async function consent() { try { const d = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all")').first(); if (await d.isVisible({ timeout: 3000 })) await d.click(); } catch {} }
const dl = (name) => page.evaluate((n) => (window.dataLayer || []).filter(e => e && e.event === n), name);

// ── TEST A: view_item has a real numeric value/price ──────────────────────────
console.log('\n=== TEST A: view_item (destination/dumaguete) ===');
await page.goto(`${BASE}/destination/dumaguete?checkIn=2026-07-09&checkOut=2026-07-10&adult=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await consent();
await page.waitForTimeout(6000); // let rooms + prices load so startingPrice computes
const vi = await dl('view_item');
const last = vi[vi.length - 1];
console.log('view_item count:', vi.length);
console.log('latest view_item ecommerce:', JSON.stringify(last?.ecommerce));
const v = last?.ecommerce?.value, p = last?.ecommerce?.items?.[0]?.price;
console.log('RESULT A: value =', v, '(type', typeof v, ') | price =', p, '(type', typeof p, ')');
console.log(typeof v === 'number' && typeof p === 'number' ? '✅ A PASS (numeric)' : '❌ A FAIL (not numeric / empty)');

// Grab a tour link for Test B
const tourHref = await page.evaluate(() => { const a = [...document.querySelectorAll('a[href*="/tours-events/"]')][0]; return a ? a.getAttribute('href') : null; });
console.log('\ntour link found:', tourHref);
await page.screenshot({ path: `${OUT}/hyg-A-destination.png` });

// ── TEST B: add_to_cart fires once per + only ─────────────────────────────────
if (tourHref) {
  console.log('\n=== TEST B: add_to_cart (tours-events) ===');
  await page.goto(tourHref.startsWith('http') ? tourHref : `${BASE}${tourHref}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await consent();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/hyg-B1-tour.png`, fullPage: true });
  const actions = await page.evaluate(() => { const o = []; document.querySelectorAll('button, [role="button"]').forEach(b => { const t = (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' '); if (t && t.length < 40) o.push(t); }); return [...new Set(o)].filter(t => !/^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day/.test(t)).slice(0, 30); });
  console.log('tour page actions:', JSON.stringify(actions));
  console.log('add_to_cart on load (should be 0):', (await dl('add_to_cart')).length);
} else {
  console.log('No tour link found on destination page — will explore separately.');
}

await page.waitForTimeout(1500);
await browser.close();
console.log('\nDONE');
