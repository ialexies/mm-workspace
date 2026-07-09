import { defineConfig } from "@playwright/test";

// Analytics verification suite for the paid-ads attribution + funnel-hygiene work.
// Requires the app running at BASE_URL (default: local dev on :3000).
//   BASE_URL=https://staging.madmonkeyhostels.com npx playwright test   # against staging
export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // Interactive booking-UI tests occasionally flake under full-suite timing;
  // retry once so a transient miss doesn't fail the run.
  retries: process.env.CI ? 2 : 1,
  // Metadata shows in the HTML report header.
  metadata: {
    suite: "Paid-ad attribution & funnel tracking",
    environment: process.env.BASE_URL || "http://localhost:3000",
    branch: "feature/fix-paid-ads-tracking-test",
    auditRefs: "C1 (purchase), H2 (add_to_cart), H4 (view_item)",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    channel: "chrome", // use the installed Chrome (no browser download needed)
    headless: !!process.env.CI, // headed locally so you can watch; headless in CI
    viewport: { width: 1280, height: 950 },
    screenshot: "on",
    trace: "on",
    video: "on",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
  },
});
