import { test, expect, type Page, type TestInfo } from "@playwright/test";

// Verifies the paid-ads attribution + funnel-hygiene tracking changes against a
// running app (local dev by default; set BASE_URL for staging). No login/payment.
//
// Each test attaches a human-readable "Expected vs Actual" summary (with the real
// captured data) so the HTML report is meaningful to non-engineers, not just pass/fail.

async function dismissConsent(page: Page) {
  await test.step("Dismiss cookie consent (if shown)", async () => {
    try {
      const btn = page
        .locator(
          '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Allow all"), button:has-text("Accept")',
        )
        .first();
      if (await btn.isVisible({ timeout: 3000 })) {
        await btn.click();
        await page.waitForTimeout(400);
      }
    } catch {
      /* no banner — fine */
    }
  });
}

type DLEvent = Record<string, any>;
const eventsNamed = (page: Page, name: string): Promise<DLEvent[]> =>
  page.evaluate(
    (n) =>
      ((window as any).dataLayer || []).filter(
        (e: any) => e && e.event === n && e.ecommerce,
      ),
    name,
  );

const fmt = (v: unknown) =>
  v === undefined ? "undefined" : typeof v === "object" ? JSON.stringify(v) : String(v);

// Records each check (description, expected, actual, pass) and renders an
// "Expected vs Actual" markdown table to the report. Uses soft assertions so the
// whole table always renders even when a check fails.
function recorder(testInfo: TestInfo, what: string, why: string) {
  const rows: { check: string; expected: string; actual: string; ok: boolean }[] = [];
  return {
    expect(check: string, expected: string, actual: unknown, ok: boolean) {
      rows.push({ check, expected, actual: fmt(actual), ok });
      expect.soft(ok, `${check} (expected ${expected}, got ${fmt(actual)})`).toBe(true);
    },
    async report() {
      const md = [
        `# ${what}`,
        "",
        `**Why it matters:** ${why}`,
        "",
        "| # | Check | Expected | Actual | Result |",
        "|---|---|---|---|---|",
        ...rows.map(
          (r, i) =>
            `| ${i + 1} | ${r.check} | ${r.expected} | \`${r.actual}\` | ${r.ok ? "✅ PASS" : "❌ FAIL"} |`,
        ),
        "",
        `**Outcome:** ${rows.every((r) => r.ok) ? "✅ All checks passed" : "❌ One or more checks failed"}`,
      ].join("\n");
      await testInfo.attach("Expected vs Actual — summary", {
        body: md,
        contentType: "text/markdown",
      });
    },
  };
}

const attachJson = (testInfo: TestInfo, name: string, data: unknown) =>
  testInfo.attach(name, { body: JSON.stringify(data, null, 2), contentType: "application/json" });

test.describe("Paid-ad attribution capture", () => {
  test("captures the ad click (gclid + UTMs) and persists it", async ({ page }, testInfo) => {
    testInfo.annotations.push({
      type: "description",
      description:
        "When a visitor lands from a paid ad, the click id + campaign tags must be captured and stored so a later booking can be traced back to the ad.",
    });
    const rec = recorder(
      testInfo,
      "Ad-click capture (gclid + UTMs → localStorage)",
      "This is the foundation of per-booking attribution: no capture here means we can never tie a booking to the ad click.",
    );

    await test.step("Visitor lands from a paid ad", async () => {
      await page.goto(
        "/?gclid=RPT_TEST123&utm_source=google&utm_medium=cpc&utm_campaign=report_run&fbclid=FB_RPT",
      );
    });
    await dismissConsent(page);

    const attr = await test.step("Read the stored attribution", async () => {
      await page.waitForTimeout(2000);
      const a = await page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem("mm_attribution") || "null");
        } catch {
          return null;
        }
      });
      await attachJson(testInfo, "Captured data — mm_attribution", a);
      return a || {};
    });

    rec.expect("Attribution record exists", "present", attr && Object.keys(attr).length > 0, !!attr.gclid);
    rec.expect("Google click id (gclid)", "RPT_TEST123", attr.gclid, attr.gclid === "RPT_TEST123");
    rec.expect("Meta click id (fbclid)", "FB_RPT", attr.fbclid, attr.fbclid === "FB_RPT");
    rec.expect("Campaign source", "google", attr.utm_source, attr.utm_source === "google");
    rec.expect("Campaign medium", "cpc", attr.utm_medium, attr.utm_medium === "cpc");
    rec.expect("Campaign name", "report_run", attr.utm_campaign, attr.utm_campaign === "report_run");
    rec.expect("Landing page recorded", "contains the gclid", attr.landing_page, String(attr.landing_page).includes("RPT_TEST123"));
    rec.expect("Capture timestamp recorded", "a timestamp", attr.captured_at, !!attr.captured_at);
    await rec.report();
  });

  test("a new ad click replaces the previous one (no mixing)", async ({ page }, testInfo) => {
    testInfo.annotations.push({
      type: "description",
      description:
        "Attribution must reflect the most recent campaign click — a gclid from one click must never be mixed with UTMs from another.",
    });
    const rec = recorder(
      testInfo,
      "Last-campaign-touch overwrite",
      "Prevents wrong attribution (e.g. crediting a booking to the wrong campaign).",
    );

    await test.step("First ad click (google/cpc, gclid FIRST111)", async () => {
      await page.goto("/?gclid=FIRST111&utm_source=google&utm_medium=cpc");
      await dismissConsent(page);
      await page.waitForTimeout(1500);
    });
    await test.step("Second ad click (tiktok/paid, gclid SECOND222)", async () => {
      await page.goto("/?gclid=SECOND222&utm_source=tiktok&utm_medium=paid");
      await page.waitForTimeout(1500);
    });

    const attr =
      (await page.evaluate(() =>
        JSON.parse(localStorage.getItem("mm_attribution") || "null"),
      )) || {};
    await attachJson(testInfo, "Captured data — mm_attribution (after 2nd click)", attr);

    rec.expect("Click id is the latest", "SECOND222", attr.gclid, attr.gclid === "SECOND222");
    rec.expect("Source is the latest", "tiktok", attr.utm_source, attr.utm_source === "tiktok");
    rec.expect("Old click id is gone", "not FIRST111", attr.gclid, attr.gclid !== "FIRST111");
    await rec.report();
  });
});

test.describe("Funnel hygiene", () => {
  test("view_item sends a real price (audit H4)", async ({ page }, testInfo) => {
    testInfo.annotations.push({
      type: "description",
      description:
        "Property page views must report a real price. Previously they sent empty strings, so GA4 recorded no value and the rooms funnel was unusable.",
    });
    const rec = recorder(
      testInfo,
      "view_item carries a real price",
      "Without a numeric value/price, GA4 silently drops it and the view_item → purchase funnel for rooms cannot be built.",
    );

    await test.step("Open a property page (Dumaguete) with dates", async () => {
      await page.goto("/destination/dumaguete?checkIn=2026-07-09&checkOut=2026-07-10&adult=1");
      await dismissConsent(page);
      await page.waitForTimeout(6000); // rooms + prices load so startingPrice computes
    });

    const last = await test.step("Read the view_item event from the dataLayer", async () => {
      const items = await eventsNamed(page, "view_item");
      const ev = items[items.length - 1] || {};
      await attachJson(testInfo, "Captured data — view_item event", ev);
      return ev;
    });

    const value = last?.ecommerce?.value;
    const price = last?.ecommerce?.items?.[0]?.price;
    const item = last?.ecommerce?.items?.[0] || {};
    rec.expect("view_item event fired", "present", last?.ecommerce, !!last?.ecommerce);
    rec.expect("Event value is numeric", "a number > 0", value, typeof value === "number" && value > 0);
    rec.expect("Item price is numeric", "a number > 0", price, typeof price === "number" && price > 0);
    rec.expect("No empty discount key", 'not ""', item.discount, item.discount !== "");
    rec.expect("No empty coupon key", 'not ""', item.coupon, item.coupon !== "");
    await rec.report();
  });

  test("add_to_cart fires once when the tour is added (audit H2)", async ({
    page,
  }, testInfo) => {
    testInfo.annotations.push({
      type: "description",
      description:
        "add_to_cart should fire once when the tour enters the cart (first date selected), with quantity = guest count. It must NOT fire again on +/- or when the date is changed.",
    });
    const rec = recorder(
      testInfo,
      "add_to_cart fires once on tour-add (qty = guests), not per +/- or date change",
      "Firing per guest or on every change re-inflates the funnel; firing once on add captures every tour (incl. single-guest) exactly once.",
    );
    const count = async () => (await eventsNamed(page, "add_to_cart")).length;
    const slots = page.locator("text=/\\d{2} \\w{3} 2026, \\d{2}:\\d{2} [AP]M/");

    await test.step("Open the Valencia Tour page", async () => {
      await page.goto("/tours-events/valencia-tour");
      await dismissConsent(page);
      await page.waitForTimeout(4000);
    });
    rec.expect("On page load", "0 add_to_cart", await count(), (await count()) === 0);

    await test.step("Select a date-time slot (tour enters cart)", async () => {
      await page.locator("text=Choose Dates for Booking").first().click();
      await page.waitForTimeout(1500);
      await slots.first().click();
    });
    // add_to_cart fires after the async backend cart upsert — poll (up to ~10s).
    let onAdd: DLEvent[] = [];
    for (let i = 0; i < 20; i++) {
      onAdd = await eventsNamed(page, "add_to_cart");
      if (onAdd.length >= 1) break;
      await page.waitForTimeout(500);
    }
    await attachJson(testInfo, "Captured data — add_to_cart on tour-add", onAdd);
    rec.expect("After first date select", "1 add_to_cart", onAdd.length, onAdd.length === 1);
    rec.expect(
      "Quantity = guest count",
      "1 (default guest)",
      onAdd[0]?.ecommerce?.items?.[0]?.quantity,
      onAdd[0]?.ecommerce?.items?.[0]?.quantity === 1,
    );

    const plus = page.locator('button:has(svg[data-testid="AddIcon"])').first();
    const minus = page.locator('button:has(svg[data-testid="RemoveIcon"])').first();

    await test.step("Click + once", async () => {
      await plus.click();
      await page.waitForTimeout(1000);
    });
    rec.expect("After + (increment)", "still 1 (no re-fire)", await count(), (await count()) === 1);

    await test.step("Click − once", async () => {
      await minus.click();
      await page.waitForTimeout(1000);
    });
    rec.expect("After − (decrement)", "still 1 (no re-fire)", await count(), (await count()) === 1);

    await test.step("Change the date (re-select a different slot)", async () => {
      await page.locator("text=Availability").first().click().catch(() => {});
      await page.waitForTimeout(1200);
      const n = await slots.count();
      await slots.nth(n > 1 ? 1 : 0).click().catch(() => {});
      await page.waitForTimeout(2500);
    });
    rec.expect("After changing date", "still 1 (already in cart)", await count(), (await count()) === 1);

    await rec.report();
  });

  test("rooms add_to_cart fires on the ADD TO TRIP click (not on load)", async ({
    page,
  }, testInfo) => {
    testInfo.annotations.push({
      type: "description",
      description:
        "Rooms use a different component (CardRoomComponent) than tours. Adding a room should fire exactly one add_to_cart (qty 1) on the explicit ADD TO TRIP click, and none on page load.",
    });
    const rec = recorder(
      testInfo,
      "Rooms add_to_cart fires once per room added (on ADD TO TRIP)",
      "Confirms the rooms funnel add_to_cart step is clean and fires on the deliberate add action.",
    );
    const count = async () => (await eventsNamed(page, "add_to_cart")).length;

    await test.step("Open Dumaguete (property/rooms page) with dates", async () => {
      await page.goto("/destination/dumaguete?checkIn=2026-07-09&checkOut=2026-07-10&adult=1");
      await dismissConsent(page);
      await page.waitForTimeout(6000); // rooms + ADD TO TRIP buttons load
    });
    rec.expect("On page load", "0 add_to_cart", await count(), (await count()) === 0);

    await test.step("Click ADD TO TRIP on a room", async () => {
      const addBtn = page.locator('button:has-text("ADD TO TRIP")').first();
      await addBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      // Wait for the cart add API so add_to_cart (which fires after it) can run.
      await Promise.all([
        page
          .waitForResponse(
            (r) => /\/cart\//.test(r.url()) && r.request().method() === "POST",
            { timeout: 15000 },
          )
          .catch(() => null),
        addBtn.click(),
      ]);
      await page.waitForTimeout(3500);
    });
    const onAdd = await eventsNamed(page, "add_to_cart");
    await attachJson(testInfo, "Captured data — rooms add_to_cart", onAdd);
    rec.expect("After ADD TO TRIP", "1 add_to_cart", onAdd.length, onAdd.length === 1);
    rec.expect(
      "Quantity on the event",
      "1",
      onAdd[onAdd.length - 1]?.ecommerce?.items?.[0]?.quantity,
      onAdd[onAdd.length - 1]?.ecommerce?.items?.[0]?.quantity === 1,
    );

    await rec.report();
  });
});

test.describe("Page views (SPA)", () => {
  test("page_view fires per in-app navigation, not on hard load (audit H1)", async ({
    page,
  }, testInfo) => {
    testInfo.annotations.push({
      type: "description",
      description:
        "The site is a Next.js SPA — client-side route changes don't reload, so they need an explicit page_view. The initial/hard load is covered by the GA4 Configuration tag, so this handler must NOT fire on hard load (avoids double-counting the entry page).",
    });
    const rec = recorder(
      testInfo,
      "SPA page_view fires on client-side navigation, not on hard load (H1)",
      "Without this, in-app page views are missed; firing on hard load too would double-count the entry page.",
    );
    const pv = () =>
      page.evaluate(
        () =>
          ((window as any).dataLayer || []).filter(
            (e: any) => e && e.event === "page_view",
          ).length,
      );

    await test.step("Hard load the homepage", async () => {
      await page.goto("/");
      await dismissConsent(page);
      await page.waitForTimeout(2500);
    });
    rec.expect("On hard load (from SPA handler)", "0 page_view", await pv(), (await pv()) === 0);

    await test.step("Navigate in-app (client-side route change)", async () => {
      // Use Next's client-side router for a reliable SPA navigation (dev exposes
      // window.next.router); fall back to clicking an internal link.
      await page
        .waitForFunction(() => !!(window as any).next?.router?.push, null, {
          timeout: 10000,
        })
        .catch(() => {});
      const ok = await page.evaluate(() => {
        const r = (window as any).next?.router;
        if (r && typeof r.push === "function") {
          r.push("/destination/dumaguete");
          return true;
        }
        return false;
      });
      if (!ok) {
        await page
          .locator('a[href^="/destination/"]:visible, nav a[href^="/"]:not([href="/"]):visible')
          .first()
          .click()
          .catch(() => {});
      }
      // Confirm the SPA navigation actually happened before checking.
      await page
        .waitForURL((u) => u.pathname.startsWith("/destination"), { timeout: 12000 })
        .catch(() => {});
    });
    // Poll for the page_view (fires in the routeChangeComplete handler).
    let after = 0;
    for (let i = 0; i < 12; i++) {
      after = await pv();
      if (after >= 1) break;
      await page.waitForTimeout(500);
    }
    await attachJson(
      testInfo,
      "page_view events",
      await page.evaluate(() =>
        ((window as any).dataLayer || []).filter(
          (e: any) => e && e.event === "page_view",
        ),
      ),
    );
    rec.expect("After one in-app navigation", "1 page_view", after, after === 1);

    await rec.report();
  });
});
