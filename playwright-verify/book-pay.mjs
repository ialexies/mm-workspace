import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'https://staging.madmonkeyhostels.com';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const STATE = 'f:/madmonkey2/MM_V3/playwright-verify/auth-state.json';
const OUT = 'f:/madmonkey2/MM_V3/playwright-verify/screenshots';
try { mkdirSync(OUT, { recursive: true }); } catch {}

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 50 });
const ctx = await browser.newContext({ storageState: STATE, viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();

let checkoutBody = null;
page.on('request', req => { if (req.method() === 'POST' && /\/cart\/checkout/.test(req.url())) { try { checkoutBody = req.postData(); } catch {} } });
page.on('console', m => { const t = m.text(); if (/GTM purchase|Purchase ready|purchase event sent/.test(t)) console.log('   [page]', t.slice(0, 140)); });

// 1. To payment panel
await page.goto(`${BASE}/destination/dumaguete?gclid=STG_BOOK1&utm_source=google&utm_medium=cpc&utm_campaign=stg_full&checkIn=2026-07-02&checkOut=2026-07-03&adult=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
try { const d = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all")').first(); if (await d.isVisible({ timeout: 3000 })) await d.click(); } catch {}
await page.waitForTimeout(3500);
await page.locator('button:has-text("ADD TO TRIP")').first().click({ timeout: 8000 });
await page.waitForTimeout(2000);
await page.locator('button:has-text("CONTINUE TO CHECKOUT")').first().click({ timeout: 8000 });
await page.waitForURL(u => u.pathname.startsWith('/booking'), { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(3500);
await page.locator('button:has-text("CONFIRM & PAY")').first().click({ timeout: 8000 });
console.log('clicked CONFIRM & PAY, waiting for Stripe element...');
await page.waitForTimeout(7000);
await page.screenshot({ path: `${OUT}/p-1-stripe.png`, fullPage: true });

// 2. Fill Stripe Payment Element (search all frames for the card number input)
async function fillStripe() {
  for (const f of page.frames()) {
    try {
      const num = f.locator('input[name="number"], input[placeholder="1234 1234 1234 1234"]');
      if (await num.count()) {
        await num.first().fill('4242424242424242');
        await f.locator('input[name="expiry"], input[placeholder="MM / YY"]').first().fill('12 / 30').catch(()=>{});
        await f.locator('input[name="cvc"], input[placeholder="CVC"]').first().fill('123').catch(()=>{});
        const nm = f.locator('input[name="billingName"], input[placeholder*="ull name"], input[placeholder*="ame on card"]');
        if (await nm.count()) await nm.first().fill('Test Booker').catch(()=>{});
        console.log('-> filled Stripe card fields in frame', f.url().slice(0, 50));
        return true;
      }
    } catch {}
  }
  return false;
}
let filled = false;
for (let i = 0; i < 5 && !filled; i++) { filled = await fillStripe(); if (!filled) await page.waitForTimeout(2000); }
console.log('card filled:', filled);
// cardholder name might be a page-level input
try { const pn = page.locator('input[placeholder*="ardholder"], input[name*="cardholder" i]').first(); if (await pn.isVisible({ timeout: 1500 })) await pn.fill('Test Booker'); } catch {}
await page.screenshot({ path: `${OUT}/p-2-filled.png`, fullPage: true });

// 3. Click the teal "Pay" (not "Pay with link", not "CONFIRM & PAY")
let payClicked = false;
const payBtns = page.locator('button', { hasText: /^Pay$/ });
if (await payBtns.count()) { await payBtns.first().scrollIntoViewIfNeeded().catch(()=>{}); await payBtns.first().click().catch(()=>{}); payClicked = true; console.log('clicked exact "Pay"'); }
if (!payClicked) { // fallback: any submit-looking pay button inside stripe frame
  for (const f of page.frames()) { try { const b = f.locator('button:has-text("Pay")').first(); if (await b.count()) { await b.click(); payClicked = true; console.log('clicked Pay in frame'); break; } } catch {} }
}
console.log('pay clicked:', payClicked);

// 4. Wait for thanks page
await page.waitForURL(u => u.pathname.includes('/booking/thanks'), { timeout: 60000 }).catch(() => console.log('did not reach /thanks in time'));
await page.waitForTimeout(6000);
console.log('URL:', page.url());
await page.screenshot({ path: `${OUT}/p-3-thanks.png`, fullPage: true });

// 5. Read the purchase dataLayer event (Part 3)
const purchase = await page.evaluate(() => {
  const dl = window.dataLayer || [];
  const evs = dl.filter(e => e && e.event === 'purchase');
  return evs.length ? evs[evs.length - 1] : null;
});
console.log('\n=== PURCHASE EVENT (Part 3) ===');
console.log(JSON.stringify(purchase, null, 2));
console.log('\n=== checkout metadata (Part 2) ===');
try { console.log(JSON.stringify(JSON.parse(checkoutBody).metadata, null, 2)); } catch { console.log(checkoutBody); }
await page.waitForTimeout(1500);
await browser.close();
console.log('DONE');
