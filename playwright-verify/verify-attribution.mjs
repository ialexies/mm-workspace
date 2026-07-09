import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT_DIR = 'f:/madmonkey2/MM_V3/playwright-verify/screenshots';
try { mkdirSync(OUT_DIR, { recursive: true }); } catch {}
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'https://staging.madmonkeyhostels.com';

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 40 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

async function dismissConsent() {
  try {
    const btn = page.locator(
      '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all"), button:has-text("Accept")'
    ).first();
    if (await btn.isVisible({ timeout: 3000 })) { await btn.click(); await page.waitForTimeout(500); }
  } catch {}
}
async function readAttr() {
  return await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('mm_attribution') || 'null'); } catch { return 'PARSE_ERROR'; }
  });
}

// [1] Capture on landing with ad params
const url1 = `${BASE}/?gclid=STG_TEST123&utm_source=google&utm_medium=cpc&utm_campaign=stg_relaunch&fbclid=FB_STG`;
console.log('\n[1] Landing with ad params:\n   ', url1);
await page.goto(url1, { waitUntil: 'domcontentloaded', timeout: 45000 });
await dismissConsent();
await page.waitForTimeout(1500);
console.log('    mm_attribution =', JSON.stringify(await readAttr()));
await page.screenshot({ path: `${OUT_DIR}/stg-1-landing.png` });

// [2] Durability: navigate with NO params -> should still hold the click
console.log('\n[2] Navigate with NO params (durability):');
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(1200);
console.log('    mm_attribution =', JSON.stringify(await readAttr()));

// [3] Overwrite: a NEW campaign click should replace the previous one
console.log('\n[3] New campaign click (overwrite):');
await page.goto(`${BASE}/?gclid=STG_NEW456&utm_source=tiktok&utm_medium=paid`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(1500);
console.log('    mm_attribution =', JSON.stringify(await readAttr()));
await page.screenshot({ path: `${OUT_DIR}/stg-3-overwrite.png` });

await browser.close();
console.log('\nDONE');
