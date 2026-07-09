import { chromium } from 'playwright';

const BASE = 'https://staging.madmonkeyhostels.com';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EMAIL = 'ialexies@gmail.com';
const PASSWORD = '*Luffy123';
const STATE = 'f:/madmonkey2/MM_V3/playwright-verify/auth-state.json';

const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 40 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2000);
try {
  const dismiss = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all"), button:has-text("Accept")').first();
  if (await dismiss.isVisible({ timeout: 3000 })) { await dismiss.click(); await page.waitForTimeout(400); }
} catch {}

await page.locator('input[type="email"]').first().fill(EMAIL);
await page.waitForTimeout(200);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await page.waitForTimeout(300);
const loginBtn = page.locator('[data-testid="LOG IN-button"], button:has-text("LOG IN")').first();
await loginBtn.scrollIntoViewIfNeeded();
await loginBtn.click();

try {
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 25000 });
} catch {
  await page.locator('input[type="password"]').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 25000 });
}
console.log('-> authenticated, URL:', page.url());
await ctx.storageState({ path: STATE });
console.log('-> saved auth state to', STATE);
await browser.close();
