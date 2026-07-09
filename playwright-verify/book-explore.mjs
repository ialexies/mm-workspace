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

const url = `${BASE}/destination/dumaguete?gclid=STG_BOOK1&utm_source=google&utm_medium=cpc&utm_campaign=stg_full`;
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
try {
  const d = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all")').first();
  if (await d.isVisible({ timeout: 3000 })) { await d.click(); await page.waitForTimeout(400); }
} catch {}
await page.waitForTimeout(3000);

const attr = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mm_attribution') || 'null'); } catch { return 'ERR'; } });
console.log('mm_attribution =', JSON.stringify(attr));
console.log('URL now:', page.url());

// Dump interactive elements to find selectors
const els = await page.evaluate(() => {
  const out = { buttons: [], links: [], inputs: [] };
  document.querySelectorAll('button').forEach(b => { const t = (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' '); if (t) out.buttons.push(t.slice(0, 40)); });
  document.querySelectorAll('a').forEach(a => { const t = (a.innerText || '').trim().replace(/\s+/g, ' '); if (t) out.links.push(t.slice(0, 40)); });
  document.querySelectorAll('input').forEach(i => out.inputs.push(`${i.type || 'text'}:${(i.placeholder || i.name || '').slice(0, 30)}`));
  return out;
});
console.log('BUTTONS:', JSON.stringify([...new Set(els.buttons)].slice(0, 40)));
console.log('LINKS:', JSON.stringify([...new Set(els.links)].slice(0, 30)));
console.log('INPUTS:', JSON.stringify([...new Set(els.inputs)].slice(0, 20)));

await page.screenshot({ path: `${OUT}/book-explore-destination.png`, fullPage: false });
await page.waitForTimeout(1000);
await browser.close();
console.log('DONE');
