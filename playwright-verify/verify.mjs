import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE_URL = 'http://localhost:3000';
const OUT_DIR = 'f:/madmonkey2/MM_V3/playwright-verify/screenshots';
try { mkdirSync(OUT_DIR, { recursive: true }); } catch {}

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EMAIL = 'ialexies@gmail.com';
const PASSWORD = '*Luffy123';

const viewports = [
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'mobile-390',   width: 390,  height: 844 },
];

// ── Single browser session: log in once, reuse auth across viewports ──────────
const browser = await chromium.launch({ headless: false, executablePath: CHROME_PATH, slowMo: 80 });
const ctx    = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page   = await ctx.newPage();

// 1. Login
await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(2000);
try {
  const dismiss = page.locator('button:has-text("Allow all"), button:has-text("Accept")').first();
  if (await dismiss.isVisible({ timeout: 2000 })) { await dismiss.click(); await page.waitForTimeout(400); }
} catch {}

const emailInput = page.locator('input[type="email"]').first();
const passInput  = page.locator('input[type="password"]').first();
await emailInput.click();
await emailInput.fill(EMAIL);
await page.waitForTimeout(300);
await passInput.click();
await passInput.fill(PASSWORD);
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT_DIR}/login-filled.png` });

// Try button click first, fall back to Enter
const loginBtn = page.locator('[data-testid="LOG IN-button"]').first();
await loginBtn.scrollIntoViewIfNeeded();
await loginBtn.click();
console.log('-> clicked LOG IN button');

try {
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20000 });
  console.log('-> authenticated, URL:', page.url());
} catch {
  // Fallback: press Enter in the password field
  console.log('-> button click did not redirect, trying Enter key...');
  await passInput.focus();
  await page.keyboard.press('Enter');
  try {
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20000 });
    console.log('-> authenticated via Enter, URL:', page.url());
  } catch {
    console.log('-> login stuck at:', page.url());
    await page.screenshot({ path: `${OUT_DIR}/login-stuck.png` });
    await ctx.close(); await browser.close();
    process.exit(1);
  }
}

// 2. Navigate to /my-chats — retry if auth guard redirects us away
let mychatsReady = false;
for (let attempt = 1; attempt <= 4; attempt++) {
  await page.goto(`${BASE_URL}/my-chats`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  if (page.url().includes('/my-chats')) {
    console.log(`-> my-chats loaded (attempt ${attempt}):`, page.url());
    mychatsReady = true;
    break;
  }
  console.log(`-> attempt ${attempt}: redirected to ${page.url()}, waiting 8s for auth...`);
  await page.waitForTimeout(8000);
}
if (!mychatsReady) {
  console.log('-> could not stay on /my-chats after 4 attempts');
  await ctx.close(); await browser.close(); process.exit(1);
}

// 3. Wait for Dumaguete channel
console.log('-> waiting for channel list...');
try {
  await page.waitForSelector('[role="button"]:has-text("Mad Monkey Dumaguete")', { timeout: 45000 });
  console.log('-> channel list ready');
} catch {
  console.log('-> timeout waiting for channel list');
  const bt = await page.locator('body').innerText().catch(() => '');
  console.log('-> page text:', bt.slice(0, 200).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${OUT_DIR}/no-channels.png` });
  await ctx.close(); await browser.close();
  process.exit(1);
}

// 4. Click Dumaguete channel
const dumagueteBtns = [
  '[role="button"]:has-text("Mad Monkey Dumaguete")',
  '[role="button"]:has-text("Dumaguete")',
];
let clicked = false;
for (const sel of dumagueteBtns) {
  try {
    const loc = page.locator(sel).first();
    if (await loc.isVisible({ timeout: 3000 })) {
      const box = await loc.boundingBox();
      if (box && box.height < 200) {
        await loc.click({ position: { x: 10, y: 10 } });
        clicked = true;
        console.log('-> clicked Dumaguete via', sel);
        break;
      }
    }
  } catch {}
}
if (!clicked) {
  console.log('-> could not find Dumaguete channel');
  await ctx.close(); await browser.close();
  process.exit(1);
}

// 5. Wait for conversation to load
await page.waitForTimeout(5000);
console.log('-> conversation loaded\n');

// ── Now test each viewport without re-logging in ──────────────────────────────
for (const vp of viewports) {
  console.log(`=== ${vp.name} (${vp.width}x${vp.height}) ===`);
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.waitForTimeout(1500); // let layout reflow

  // Navigate to conversation (URL should already be /my-chats with channel open)
  // Just re-navigate to my-chats in case the URL changed
  const currentUrl = page.url();
  if (!currentUrl.includes('/my-chats')) {
    await page.goto(`${BASE_URL}/my-chats`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    // Re-click channel
    try {
      const loc = page.locator('[role="button"]:has-text("Mad Monkey Dumaguete")').first();
      if (await loc.isVisible({ timeout: 5000 })) {
        await loc.click({ position: { x: 10, y: 10 } });
        await page.waitForTimeout(4000);
      }
    } catch {}
  }

  await page.screenshot({ path: `${OUT_DIR}/${vp.name}-01-channel.png` });

  // Scroll to top to see older (image) messages
  try {
    const conv = page.locator('.sendbird-conversation__messages-padding, .sendbird-conversation__messages').first();
    if (await conv.isVisible({ timeout: 3000 })) {
      await conv.evaluate(el => { el.scrollTop = 0; });
      await page.waitForTimeout(2000);
    }
  } catch {}
  await page.screenshot({ path: `${OUT_DIR}/${vp.name}-02-top.png` });

  // Measure outgoing message gaps
  const measurements = await page.evaluate(() => {
    const scrollEl = document.querySelector('.sendbird-conversation__messages-padding, .sendbird-conversation__messages');
    return [...document.querySelectorAll('.sendbird-message-content.outgoing')].map((msg, i) => {
      const ts = msg.querySelector('[class*="body-container__created-at"]');
      if (!ts) return null;

      const thumbnail   = msg.querySelector('.sendbird-thumbnail-message-item-body');
      const textBubble  = msg.querySelector('.sendbird-text-message-item-body');
      const fileBody    = msg.querySelector('.sendbird-file-message-item-body');
      const imgRenderer = msg.querySelector('.sendbird-image-renderer');

      const tsR  = ts.getBoundingClientRect();
      const msgR = msg.getBoundingClientRect();
      const tsStyle = window.getComputedStyle(ts);

      let type = 'unknown', contentR = null, rW = null, rH = null;
      let thumbBodyH = null, imgInlineH = null;

      if (thumbnail) {
        type = 'image';
        contentR = thumbnail.getBoundingClientRect();
        thumbBodyH = Math.round(contentR.height);
        if (imgRenderer) {
          const r = imgRenderer.getBoundingClientRect();
          rW = Math.round(r.width); rH = Math.round(r.height);
          imgInlineH = imgRenderer.style.height;
        }
      } else if (textBubble) {
        type = 'text';
        contentR = textBubble.getBoundingClientRect();
      } else if (fileBody) {
        type = 'file';
        contentR = fileBody.getBoundingClientRect();
      }

      const gap = contentR ? Math.round(tsR.top - contentR.bottom) : null;
      // Visual gap = gap from IMAGE RENDERER bottom (not thumbnail body bottom) to timestamp
      let visualGap = null;
      if (imgRenderer && contentR) {
        const imgR = imgRenderer.getBoundingClientRect();
        visualGap = Math.round(tsR.top - imgR.bottom);
      }

      const rightAligned = tsR.right <= msgR.right + 5;
      return {
        i, type,
        tsText: ts.textContent?.trim(),
        tsDisplay: tsStyle.display,
        gap,          // gap from thumbnail body bottom to timestamp top
        visualGap,    // gap from image renderer bottom to timestamp top (what user sees)
        rightAligned,
        inViewport: tsR.top >= 0 && tsR.bottom <= window.innerHeight,
        rW, rH,
        thumbBodyH,
        imgInlineH,
      };
    }).filter(Boolean);
  });

  console.log('  Measurements:');
  if (measurements.length === 0) console.log('    (no outgoing messages in DOM)');
  for (const m of measurements) {
    const ren = m.rW != null ? ` img=${m.rW}x${m.rH}` : '';
    const tbH = m.thumbBodyH != null ? ` thumbH=${m.thumbBodyH}` : '';
    const inl = m.imgInlineH ? ` inlineH="${m.imgInlineH}"` : '';
    const vg  = m.visualGap != null ? ` visualGap=${m.visualGap}px` : '';
    const align = m.rightAligned ? 'right✓' : 'NOT-right✗';
    const vp2 = m.inViewport ? 'visible' : 'offscreen';
    console.log(`    [${m.i}] ${m.type.padEnd(5)} "${m.tsText}" bodyGap=${m.gap}px${vg} ${align} ${vp2} display=${m.tsDisplay}${ren}${tbH}${inl}`);
  }

  // Hover test
  try {
    const outgoing = page.locator('.sendbird-message-content.outgoing').first();
    if (await outgoing.isVisible({ timeout: 2000 })) {
      await outgoing.hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT_DIR}/${vp.name}-03-hover.png` });
      console.log('  -> hover saved');
    }
  } catch {}

  // Scroll to bottom
  try {
    const conv = page.locator('.sendbird-conversation__messages-padding, .sendbird-conversation__messages').first();
    if (await conv.isVisible({ timeout: 1000 })) {
      await conv.evaluate(el => { el.scrollTop = el.scrollHeight; });
      await page.waitForTimeout(1500);
    }
  } catch {}
  await page.screenshot({ path: `${OUT_DIR}/${vp.name}-04-bottom.png` });
  console.log('  -> bottom saved\n');
}

await ctx.close();
await browser.close();
console.log(`Done. Screenshots -> ${OUT_DIR}`);
