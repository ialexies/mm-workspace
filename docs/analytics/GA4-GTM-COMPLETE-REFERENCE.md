# Mad Monkey Hostels — GA4, GTM & Google Ads (Complete Reference)

> **Single-file bundle for LLM context.** Combines the analytics index, May 2026 audit report, implementation guide, roadmap & reporting, PR checklist, and GTM changelog.  
> **Generated:** May 2026 · **Last resynced:** 2026-08-20 (Part 1 + Part 3 §19 — standalone landing pages / shared-analytics-account policy; Part 3 §3.5/§10.1/§10.4/§13.1/§15 and Part 4 — MCP live verification of C2/C4/M4 status) · **Sources:** `docs/analytics/*`, `GA4-GTM-AUDIT-REPORT.md`  
> **Part 2 is NOT resynced past May 2026** — see the note at the top of Part 2 and read `GA4-GTM-AUDIT-REPORT.md` directly for current fix status.  
> **Size:** ~125 KB · ~2,450 lines · GTM `GTM-KC78NFHD` · GA4 `G-K27E7XLRBP` · Google Ads `697-007-4125`

### How to use with an LLM

- Attach or paste this entire file when asking about tracking, GTM, GA4, Google Ads, booking funnels, consent, or audit fixes.
- **Part 2** = what is broken and how to fix it (audit).
- **Part 3** = how the system works today (implementation, events, flows, testing).
- **Part 4** = process, weekly reporting, and roadmap.
- After editing split docs, regenerate this file (concatenate the same source paths listed in `docs/analytics/README.md`).

---

## Master table of contents

1. [Analytics index](#part-1-analytics-index)
2. [Audit report (findings & fixes)](#part-2-audit-report-findings--fixes)
3. [Implementation guide (architecture, events, flows)](#part-3-implementation-guide)
4. [Roadmap, documentation & reporting](#part-4-roadmap-documentation--reporting)
5. [PR checklist (analytics changes)](#part-5-pr-checklist)
6. [GTM container changelog](#part-6-gtm-container-changelog)

---



---

# PART 1 — Analytics index

<a id="part-1"></a>


# Analytics documentation (GA4, GTM, Google Ads)

Central index for Mad Monkey V3 web and app analytics. Use these docs when changing tracking code, GTM, GA4 admin, or Google Ads conversion settings.

## Documents

| Document | Audience | Purpose |
|---|---|---|
| [GA4-GTM-IMPLEMENTATION.md](./GA4-GTM-IMPLEMENTATION.md) | Engineering, GTM admin | How tracking works today: architecture, events, flows, GTM/GA4/Ads config, testing, incidents |
| [GA4-GTM-ROADMAP-AND-REPORTING.md](./GA4-GTM-ROADMAP-AND-REPORTING.md) | Engineering, marketing, ops | Recommended next steps, documentation process, reporting & monitoring |
| [GA4-GTM-AUDIT-REPORT.md](../../GA4-GTM-AUDIT-REPORT.md) | Leadership, ads, engineering | May 2026 audit findings, severity, fix roadmap, technical appendix |

## Interactive report

- **Canvas:** `canvases/ga4-gtm-audit-report.canvas.tsx` (open beside chat in Cursor) — filterable issue matrix and fix roadmap

## Quick links

| System | ID / account |
|---|---|
| GTM container | `GTM-KC78NFHD` |
| GA4 (production web) | `G-K27E7XLRBP` |
| GA4 (development) | `G-27GXNDKYWW` |
| GA4 (app stream) | `G-WVGB07X1M6` |
| Google Ads | `697-007-4125` |
| Microsoft Clarity | `o7iu329276` |
| TikTok Pixel | `D095O0BC77U0QQJ07KTG` |

## Code entry points

| File | Role |
|---|---|
| `frontend/utils/gtmTracker.ts` | `gtmPushEvent`, `deferGtmPushEvent` |
| `frontend/components/atoms/GTM.tsx` | GTM script loader |
| `frontend/pages/_document.tsx` | Consent Mode defaults, `dataLayer` init |
| `frontend/pages/_app.tsx` | Clarity, native `screen_view`, route listeners |
| `frontend/pages/booking/thanks.tsx` | Canonical `purchase` + deduplication |

## Standalone landing pages (non-`frontend/` repos)

Marketing sometimes ships a landing page as its own repo/hosting (e.g. Lovable-built, deployed to Vercel) instead of a route inside `frontend/`. [`docs/GSC-REDIRECT-INDEXING-REVIEW.md`](../GSC-REDIRECT-INDEXING-REVIEW.md#background-landing-page-architecture-question) flagged this pattern as risking analytics fragmentation if each repo bootstraps its own GTM container or GA4 property. Policy: **every standalone landing page reuses the same `GTM-KC78NFHD` container and `G-K27E7XLRBP` GA4 property** — never a new one. See Implementation doc §19 for the bootstrap pattern, policy detail, and onboarding checklist. Three pages built under this policy so far: `parents-voucher/` (Gift of Travel voucher page), `lovable_pages/mm-squad-trips/` (All In group trips — also the reference for reporting server-side/webhook revenue via GA4 Measurement Protocol, §19.3), and `madventure-travel/`'s `/ha-giang-loop` route (the confirmed ad-funnel landing page for the Ha Giang Loop tour, reached via `hagianglooptour.madmonkeyhostels.com` — `view_item` only; no `begin_checkout` here despite the Book Now click, since it only hands off to `frontend/`'s real tour page which fires its own; no `purchase`, since booking always completes off-site).

## When to read which doc

- **Changing an event or booking flow** → Implementation doc §4–§6, then Roadmap PR checklist
- **Publishing GTM** → Implementation doc §11, §16–§18
- **Fixing conversions / ROAS** → Audit report (Critical + Week 1 roadmap), then Roadmap reporting section
- **Onboarding a new developer** → Implementation doc §1–§2, then this README
- **Building a new standalone landing page (Lovable, own repo, etc.)** → Implementation doc §19

---

*Last updated: August 2026 (added §19 standalone landing pages)*



---

# PART 2 — Audit report (findings & fixes)

<a id="part-2"></a>

> **Note (2026-08-20):** Part 2 below is the original May 2026 audit as last resynced — it predates all of the August 2026 fix-status updates (Fix Status table, Live Data Re-Audit, Live Session Findings, Full Platform Health Check, and the 2026-08-20 MCP Live Verification) that now live only in the standalone [`GA4-GTM-AUDIT-REPORT.md`](../../GA4-GTM-AUDIT-REPORT.md). Treat that file, not this section, as the source of truth for current fix status on C1–C5/H1–H7/M1–M4/L1–L6 plus N1–N3/T1. The M4 and C2/C4 status corrections from the 2026-08-20 pass are reflected in Part 3/4 of this bundle below, since those sections were resynced.

# GA4 & GTM Analytics Audit Report
**Mad Monkey Hostels** · May 2026  
**Scope:** GTM-KC78NFHD v34 · GA4 G-K27E7XLRBP · Google Ads 697-007-4125  
**Frontend stack:** Next.js (Pages Router) + Capacitor (iOS/Android)

**Related docs:** [Analytics index](docs/analytics/README.md) · [Implementation guide](docs/analytics/GA4-GTM-IMPLEMENTATION.md) · [Roadmap & reporting](docs/analytics/GA4-GTM-ROADMAP-AND-REPORTING.md)

---

## Executive Summary

A full audit of the frontend analytics implementation, GTM container, GA4 property, and Google Ads conversion configuration identified **23 issues** across four severity tiers.

| Severity | Count | Area |
|---|---|---|
| Critical | 5 | Money / Bidding |
| High | 7 | Data Accuracy |
| Medium | 4 | Privacy / Legal |
| Low | 6 | Technical Debt |

The most urgent finding is a duplicate `purchase` event that causes Google Ads to record **two conversions per booking**. Combined with the All Purchase action counting Every conversion, the $97,140 reported conversion value last month is approximately **2x the real figure**. Smart Bidding across 4,708 campaigns is optimising on inflated data.

---

## Critical — Money / Bidding

### C1 · Duplicate `purchase` event doubles Google Ads conversions

**Severity:** Critical | **Owner:** Dev | **Effort:** Low (1 hour)

**What is happening:**  
Two separate files fire the `purchase` event during the same booking flow:

1. `pages/booking/payment.tsx` line 86 — fires immediately after Stripe payment succeeds, using `transaction_id = paymentIntentId`
2. `pages/booking/thanks.tsx` — fires on the confirmation page using `transaction_id = cartId`

Because the two events use **different transaction IDs**, Google Ads does not recognise them as duplicates. The All Purchase conversion action is set to **Count: Every**, so both events are counted as separate conversions.

**Impact:**  
- Every embedded-checkout booking generates ~2 conversion events in Google Ads
- Reported conversion value is approximately 2x reality
- ROAS calculations and Smart Bidding bid targets are built on inflated figures
- `thanks.tsx` already has robust `sessionStorage` deduplication — the `payment.tsx` fire bypasses it entirely because it runs before the redirect

**Fix:**  
Remove the `gtmPushEvent('purchase', ...)` call from `pages/booking/payment.tsx`. The canonical purchase signal should come exclusively from `thanks.tsx` which has deduplication.

See **Technical Appendix A.1** for the exact code to remove.

---

### C2 · Add to cart and Begin checkout goals have 0 conversion actions in Google Ads

**Severity:** Critical | **Owner:** Ads | **Effort:** Low (20 minutes)

**What is happening:**  
The Google Ads Add to cart and Begin checkout goals both show **0 primary conversion actions** and a **Misconfigured** status.

**Impact:**  
Smart Bidding has no mid-funnel signals. It cannot distinguish a visitor who bounced from one who added to cart or started checkout. Across 4,708 campaigns, this significantly reduces bidding efficiency. GA4 already fires `add_to_cart` and `begin_checkout` correctly — the data exists, it just is not connected to the Google Ads goals.

**Fix:**  
Google Ads → Goals → Conversions → Add to cart → Add conversion action → import from GA4 `add_to_cart` event. Repeat for Begin checkout using `begin_checkout`.

---

### C3 · `purchase` not marked as GA4 key event

**Severity:** Critical | **Owner:** GA4 | **Effort:** Low (5 minutes)

**What is happening:**  
`purchase` is not starred as a GA4 key event. `calendar_booking_search_submit` is the only starred key event but has **No stream data detected** (see C5).

**Impact:**  
GA4 conversion reports, funnels, and audiences built on key events are all missing the actual booking signal. GA4 attribution is computed without bookings as the goal.

**Fix:**  
GA4 Admin → Events → click the star icon next to `purchase`.

---

### C4 · Dead Universal Analytics sources and a popup tool are Primary conversion actions in 32 campaigns

**Severity:** Critical | **Owner:** Ads | **Effort:** Low (15 minutes)

**What is happening:**  
The Other goal includes these Primary conversion actions:
- `BCY_Booking` — imports from Universal Analytics (shut down July 2023). Records 0 conversions.
- `PP_Booking` — same. Records 0 conversions.
- `Wheelofpopups_lead_gettingadiscount` — a popup lead capture tool, not a booking. Primary in the same 32 campaigns.

**Impact:**  
32 campaigns have the Other goal as a primary signal with no valid data. Google's bidding algorithm is trying to optimise for dead events. Wheelofpopups leads are not bookings — campaigns optimising on this signal are pursuing the wrong outcome.

**Fix:**  
In Google Ads Other goal: remove Primary status from `BCY_Booking`, `PP_Booking`, and `Wheelofpopups_lead_gettingadiscount`. Archive or delete the UA-sourced actions.

---

### C5 · The only GA4 key event (`calendar_booking_search_submit`) never fires

**Severity:** Critical | **Owner:** Dev / GA4 | **Effort:** Medium (2 hours)

**What is happening:**  
`calendar_booking_search_submit` is starred as a GA4 key event but GA4 reports **No stream data detected** for it. Searching the entire frontend codebase confirms this event name does not exist — it was never implemented.

**Impact:**  
GA4's sole conversion signal is an empty event. All GA4 conversion reporting, funnel analysis, and audience definitions built on key events show zero data.

**Fix (option A — recommended immediate fix):**  
GA4 Admin → Events → remove the star from `calendar_booking_search_submit`. Then mark `purchase` as a key event (C3).

**Fix (option B — implement the event):**  
Fire `gtmPushEvent('calendar_booking_search_submit', { ... })` when the search/date picker form is submitted on destination and room pages, then keep it as a key event.

---

## High — Data Accuracy

### H1 · SPA `page_view` missing on web; Enhanced Measurement double-fires on hard load

**Severity:** High | **Owner:** GTM / GA4 | **Effort:** Medium (2 hours)

**What is happening:**  
Two GA4 page_view mechanisms are both active:
1. GTM GA4 Configuration tag fires `page_view` on every page load
2. GA4 Enhanced Measurement has `page_view` enabled for the web stream

On a hard load, both fire — producing **2 page_view hits**. On Next.js SPA navigation (client-side route change), the GTM tag does not re-fire, and Enhanced Measurement's history change detection may or may not catch Next.js's router depending on the routing pattern. The result is unreliable SPA page tracking.

**Fix:**  
1. In GA4 Data Stream → Enhanced Measurement → turn off the page_view toggle
2. In `pages/_app.tsx`, add a `routeChangeComplete` handler that pushes `page_view` to `dataLayer` on every Next.js route change

See **Technical Appendix A.2** for the implementation.

---

### H2 · `ToursShoppingCart` fires `add_to_cart` on every guest count change

**Severity:** High | **Owner:** Dev | **Effort:** Low (30 minutes)

**What is happening:**  
`components/molecules/ToursShoppingCart.tsx` line 92 uses a `useEffect` with `[adultCount]` as a dependency to fire `add_to_cart`. This fires:
- On component mount
- Every time the user clicks the + button
- Every time the user clicks the - button
- Every time the cart is re-synced from the server

**Impact:**  
Tour `add_to_cart` counts in GA4 are heavily inflated and meaningless. The event no longer represents user intent to add an item.

**Fix:**  
Replace the `useEffect` with an explicit `onClick` handler attached only to the + (increment) button. See **Technical Appendix A.3**.

---

### H3 · `begin_checkout` fires up to 3 times per checkout session

**Severity:** High | **Owner:** Dev | **Effort:** Low (30 minutes)

**What is happening:**  
For a tours checkout, `begin_checkout` can fire from three locations:
1. `pages/tours-events/[slug].tsx` line 257 — on the "Book Now" click
2. `contexts/cartContext.tsx` — if `NEXT_PUBLIC_ENABLE_CART_ANALYTICS=true`
3. `pages/booking/index.tsx` line 1371 — on checkout form submit

For rooms, fires from at least 2 locations.

**Impact:**  
Checkout funnel step counts are inflated 2-3x. Conversion rate from begin_checkout → purchase appears artificially low.

**Fix:**  
Single canonical fire point: `pages/booking/index.tsx` line 1371, after `checkoutResponse` is returned. Remove `gtmPushEvent('begin_checkout', ...)` from `pages/tours-events/[slug].tsx:257`. See **Technical Appendix A.4**.

---

### H4 · `view_item` on destination pages sends empty strings as values

**Severity:** High | **Owner:** Dev | **Effort:** Low (1 hour)

**What is happening:**  
`pages/destination/[slug].tsx` around line 800 fires `view_item` with:
```javascript
value: '',
price: '',
discount: '',
coupon: '',
```

These are literal empty strings, not `undefined` or `0`.

**Impact:**  
GA4 accepts these without throwing an error but records no revenue data for destination/property page views. Item-level analytics for the property pages are empty. This makes `view_item → add_to_cart → purchase` funnel analysis for rooms impossible.

**Fix:**  
Replace empty strings with `undefined`, or populate with the actual starting room price available from the API response on that page. See **Technical Appendix A.5**.

---

### H5 · `app_page_location` not registered — native app navigation is invisible in GA4

**Severity:** High | **Owner:** GA4 | **Effort:** Low (5 minutes)

**What is happening:**  
`pages/_app.tsx` fires `screen_view` with an `app_page_location` parameter on every Capacitor route change. This parameter is sent to GA4 but has not been registered as a custom dimension.

**Impact:**  
GA4 silently drops unregistered parameters. All app navigation data is present in the raw events but unqueryable and invisible in GA4 reports. You cannot see which screens app users visit.

**Fix:**  
GA4 Admin → Custom definitions → Create custom dimension:
- Dimension name: `app_page_location`
- Scope: Event
- User property / event parameter: `app_page_location`

---

### H6 · `original_value` registered as a text dimension, not a numeric metric

**Severity:** High | **Owner:** GA4 | **Effort:** Low (5 minutes)

**What is happening:**  
`original_value` (the pre-discount subtotal) is sent on every `purchase` event but was registered in GA4 as an **Event-scoped text dimension** rather than a metric.

**Impact:**  
You cannot sum, average, or aggregate a text dimension. Discount impact analysis — comparing `original_value` vs. the actual `value` — is impossible in GA4 Explore or standard reports.

**Fix:**  
GA4 Admin → Custom definitions → Custom metrics → Add custom metric:
- Metric name: `original_value`
- Scope: Event
- Event parameter: `original_value`
- Unit of measurement: Standard (or Currency)

---

### H7 · iOS and Android purchase conversion actions have swapped platform labels

**Severity:** High | **Owner:** Ads | **Effort:** Low (15 minutes)

**What is happening:**  
In the Google Ads Other goal:
- `MMGLOBAL|GA4 - Mad Monkey Experience (iOS)` is configured to track the `android_purchase` Firebase event
- `MMGLOBAL|GA4 - Mad Monkey Experience (Android)` is configured to track the `ios_purchase` Firebase event

**Impact:**  
iOS and Android app purchase attribution in Google Ads is inverted. iOS campaigns receive Android purchase credit and vice versa.

**Fix:**  
In Google Ads, edit each conversion action and correct the Firebase event name: iOS → `ios_purchase`, Android → `android_purchase`.

---

## Medium — Privacy / Legal

### M1 · Email address sent as `user_id` — PII in GA4 and Google Ads

**Severity:** Medium | **Owner:** Dev | **Effort:** Low (1 hour)

**What is happening:**  
Multiple auth paths send the user's email address as `user_id` in analytics events:
- `components/pages/LoginPage.tsx` line 437: passes the typed email directly as `user_id`
- `pages/auth/callback.tsx` lines 289, 403: uses `user.email || user.uid` — email takes precedence when available
- `components/molecules/SocialSignIn.tsx` line 435: same `email || uid` pattern for Google/Apple sign-in

**Impact:**  
Email is PII. Sending it to Google Analytics and Google Ads:
- Violates Google's Terms of Service (PII prohibition in GA)
- Violates GDPR Article 5(1)(f) (data minimisation / integrity and confidentiality)
- Exposes user email data in your GA4 property and Google Ads account, potentially accessible to Google staff and exported to third parties

**Fix:**  
Always use the Firebase UID as `user_id`. `createAccountForm.tsx` already does this correctly — align all other paths to the same pattern. See **Technical Appendix A.6**.

---

### M2 · Microsoft Clarity loads without Cookiebot consent

**Severity:** Medium | **Owner:** Dev | **Effort:** Low (30 minutes)

**What is happening:**  
`pages/_app.tsx` around line 958 unconditionally injects the Microsoft Clarity script (`o7iu329276`) for all non-Capacitor visits. There is no consent check.

**Impact:**  
Clarity performs full session recording and generates heatmaps for every visitor, including EU/EEA users who have not yet interacted with the Cookiebot banner. This violates GDPR and the ePrivacy Directive, which require prior consent for non-essential tracking.

**Fix:**  
Gate the Clarity injection behind `CookiebotOnConsentReady`. Only load when `Cookiebot.consent.statistics === true`. See **Technical Appendix A.7**.

---

### M3 · GTM consent defaults grant analytics for non-UK visitors without interaction

**Severity:** Medium | **Owner:** GTM | **Effort:** Low (1 hour)

**What is happening:**  
The Cookiebot Consent Mode v2 tag in GTM is configured with `mlConsentRegions: ['GB']`. This means only visitors from the United Kingdom receive denied-by-default consent. All other regions — including the 27 EU member states, Norway, Iceland, and Liechtenstein — have `analytics_storage` and `ad_storage` **granted** before the user touches the cookie banner.

**Impact:**  
GDPR requires prior consent before setting non-essential cookies or processing personal data for analytics/advertising purposes. This configuration is non-compliant for the entire EU/EEA user base.

**Fix:**  
In the GTM Cookiebot tag, expand the `mlConsentRegions` array to include all EEA country codes:

```
AT, BE, BG, CY, CZ, DE, DK, EE, ES, FI, FR, GB, GR, HR, HU, IE, IT, LT, LU, LV, MT, NL, PL, PT, RO, SE, SI, SK, NO, IS, LI
```

Alternatively, set a global `denied` default in `_document.tsx` (before GTM loads) and only grant on consent, removing the region logic entirely.

---

### M4 · TikTok, Facebook, Sojern, and Reddit pixels fire without consent checks

**Severity:** Medium | **Owner:** GTM | **Effort:** Medium (1 hour)

**What is happening:**  
In the GTM container, these tags all have `consentSettings: NOT_SET`:
- TikTok Pixel (ID: D095O0BC77U0QQJ07KTG)
- Facebook Pixel
- Sojern Pixel
- Reddit Pixel

`NOT_SET` means the tags fire regardless of the user's Consent Mode state.

**Impact:**  
All four pixels set advertising cookies and transmit personal data (page URL, IP address, browser fingerprint) to third parties without user consent. This applies to all visitors, including EU/EEA users before consent is given.

**Fix:**  
For each tag in GTM:
1. Open the tag → Advanced Settings → Consent Settings
2. Enable "Additional Consent Checks"
3. Require `ad_storage: granted` before firing

---

## Low — Technical Debt

### L1 · Tracking IDs hardcoded in source code

**Severity:** Low | **Owner:** Dev | **Effort:** Low

`GTM-KC78NFHD` is hardcoded in `components/atoms/GTM.tsx` and `pages/_document.tsx`. Clarity ID `o7iu329276` is hardcoded in `pages/_app.tsx`. Switching containers requires a code deployment.

**Fix:** Move to `NEXT_PUBLIC_GTM_ID` and `NEXT_PUBLIC_CLARITY_ID` environment variables.

---

### L2 · Production debug code shipped to all users

**Severity:** Low | **Owner:** Dev | **Effort:** Low

`components/atoms/GTM.tsx` includes `window.testGTM`, console.log GTM status reports, and a `setTimeout` load verifier that all run in production. `pages/_app.tsx` includes a Cookiebot integration monitor script.

**Fix:** Wrap in `process.env.NODE_ENV !== 'production'` guards or remove entirely.

---

### L3 · Every GTM event fires an unnecessary TikTok twin event

**Severity:** Low | **Owner:** Dev | **Effort:** Medium

`utils/gtmTracker.ts` pushes every event twice — once with the original name, once with a TikTok-mapped name. Non-ecommerce events (`navigation`, `login`, `view_item_list`, `screen_view`) get TikTok names like `Navigation` or `Login` pushed to `dataLayer` and sent directly to `ttq.track()`. This approximately doubles `dataLayer` size.

**Fix:** Only push the TikTok twin when the event is in the 6-entry `tiktokEventMap` (`view_item`, `add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase`, `sign_up`). See **Technical Appendix A.8**.

---

### L4 · `sign_up` never fires for Google or Apple OAuth new users

**Severity:** Low | **Owner:** Dev | **Effort:** Low

`createAccountForm.tsx` fires both `login` and `sign_up` on email registration. Google/Apple OAuth paths (`callback.tsx`, `SocialSignIn.tsx`) only fire `login` — even for brand-new users. GA4 new user acquisition reports are undercounted.

**Fix:** In `callback.tsx` and `SocialSignIn.tsx`, check `additionalUserInfo.isNewUser` after sign-in. If `true`, push `sign_up` with `method` and `user_id` (Firebase UID only).

---

### L5 · Analytics window globals untyped in `global.d.ts`

**Severity:** Low | **Owner:** Dev | **Effort:** Low

`types/global.d.ts` declares `window.gtag` and `window.fcWidget` but not `window.dataLayer`, `window.ttq`, `window.tap`, `window._tapInit`, `window.Cookiebot`, `window.google_tag_manager`, or `window.testGTM`. All are accessed via `(window as any)` throughout the codebase, bypassing TypeScript strict mode.

**Fix:** Add proper type declarations. See **Technical Appendix A.9**.

---

### L6 · 36 legacy property-specific Google Ads conversion actions need archiving

**Severity:** Low | **Owner:** Ads | **Effort:** Low

BKK Booking, Boracay Booking, CB Booking, El Nido Booking, Hue Booking, and 31 more property-specific conversion actions all show 0 conversions with `Needs attention` or `Inactive` status. These are remnants of the old per-property tracking setup.

**Fix:** Archive all property-specific secondary conversion actions. For per-property analysis, use GA4 Explore with the `reservation_id` custom dimension (already registered) to segment by property.

---

## Fix Roadmap

### Week 1 — Immediate (highest ROI)

| Issue | Action | Owner | Est. Time | Business Impact |
|---|---|---|---|---|
| C1 | Remove duplicate `purchase` from `payment.tsx` line 86 | Dev | 1 hour | Stop doubling Google Ads conversion count and value |
| C3 | Mark `purchase` as GA4 key event | GA4 | 5 mins | Fix GA4 conversion and audience reporting |
| C2 | Assign `add_to_cart` and `begin_checkout` in Google Ads goals | Ads | 20 mins | Enable Smart Bidding funnel signals across 4,708 campaigns |
| C4 | Remove dead UA sources and Wheelofpopups from Primary in Other goal | Ads | 15 mins | Stop 32 campaigns optimising on dead or irrelevant actions |
| M1 | Replace email with Firebase UID as `user_id` in all auth events | Dev | 1 hour | Fix active PII violation in GA4 and Google Ads |

### Sprint 1 — Data Accuracy & Privacy

| Issue | Action | Owner | Est. Time |
|---|---|---|---|
| C5 | Implement `calendar_booking_search_submit` or remove as GA4 key event | Dev / GA4 | 2 hrs |
| H1 | Disable Enhanced Measurement `page_view`; add SPA `page_view` on `routeChangeComplete` | GTM / Dev | 2 hrs |
| H2 | Fix `ToursShoppingCart` `add_to_cart` to fire on click only | Dev | 30 mins |
| H3 | Remove `begin_checkout` from `tours/[slug].tsx`; use `booking/index.tsx` as sole fire point | Dev | 30 mins |
| H4 | Fix `view_item` payload on `destination/[slug].tsx` (empty strings → real values) | Dev | 1 hr |
| H5 | Register `app_page_location` as GA4 custom dimension | GA4 | 5 mins |
| H6 | Register `original_value` as GA4 custom metric | GA4 | 5 mins |
| H7 | Fix swapped iOS/Android Firebase event names in Google Ads | Ads | 15 mins |
| M2 | Gate Microsoft Clarity behind `Cookiebot.consent.statistics` | Dev | 30 mins |
| M3 | Expand GTM denied-by-default consent regions to full EEA | GTM | 1 hr |
| M4 | Add `ad_storage` consent checks to TikTok, Facebook, Sojern, Reddit GTM tags | GTM | 1 hr |

### Backlog — Technical Debt

| Issue | Action | Owner | Est. Time |
|---|---|---|---|
| L1 | Move GTM and Clarity IDs to environment variables | Dev | 30 mins |
| L2 | Remove production debug code (`window.testGTM`, Cookiebot monitor) | Dev | 30 mins |
| L3 | Limit TikTok twin pushes to the 6 mapped ecommerce events only | Dev | 1 hr |
| L4 | Fire `sign_up` for Google/Apple OAuth new users (check `isNewUser`) | Dev | 2 hrs |
| L5 | Type all analytics window globals in `types/global.d.ts` | Dev | 1 hr |
| L6 | Archive 36 legacy property-specific Google Ads conversion actions | Ads | 30 mins |

---

## Technical Appendix

### A.1 · Removing the duplicate `purchase` from `payment.tsx` (C1)

The following block in `pages/booking/payment.tsx` fires a `purchase` event when Stripe returns a success response. This fires **before** the redirect to `thanks.tsx`. Remove it entirely — `thanks.tsx` is the canonical purchase signal with proper deduplication.

```typescript
// pages/booking/payment.tsx ~line 86
// REMOVE this entire gtmPushEvent call:
gtmPushEvent("purchase", {
  ecommerce: {
    transaction_id: paymentIntentId,   // ← different ID from thanks.tsx
    value: totalAmount,
    currency: "USD",
    items: cartItems,
  },
});
// then navigation to /booking/thanks happens
// thanks.tsx fires ANOTHER purchase with transaction_id = cartId
// → Google Ads counts 2 conversions
```

The deduplication in `thanks.tsx` uses `sessionStorage` with a composite key. After removing the `payment.tsx` fire, verify `thanks.tsx` still fires correctly for both the Stripe redirect path and the direct confirmation path.

---

### A.2 · Adding SPA `page_view` on Next.js route changes (H1)

After disabling `page_view` in GA4 Enhanced Measurement, add this to `pages/_app.tsx`:

```typescript
// pages/_app.tsx — inside the App component, alongside existing router.events listeners

useEffect(() => {
  const handleRouteChangeComplete = (url: string) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "page_view",
      page_location: url,
      page_title: document.title,
    });
  };

  router.events.on("routeChangeComplete", handleRouteChangeComplete);
  return () => {
    router.events.off("routeChangeComplete", handleRouteChangeComplete);
  };
}, [router.events]);
```

The GTM GA4 Configuration tag will capture this `page_view` event from `dataLayer` via the existing "All Pages" trigger or a dedicated trigger on `page_view` event name.

---

### A.3 · Fix `add_to_cart` over-firing in `ToursShoppingCart` (H2)

```typescript
// components/molecules/ToursShoppingCart.tsx

// BEFORE — fires on every adultCount change including mount and decrements:
useEffect(() => {
  if (adultCount > 0) {
    gtmPushEvent("add_to_cart", {
      ecommerce: {
        items: [{ item_id: tour.id, item_name: tour.title, quantity: adultCount }],
      },
    });
  }
}, [adultCount]);

// AFTER — fires only when user explicitly increments:
const handleIncrement = () => {
  setAdultCount((prev) => prev + 1);
  gtmPushEvent("add_to_cart", {
    ecommerce: {
      currency: "USD",
      value: tour.price,
      items: [{
        item_id: tour.id,
        item_name: tour.title,
        item_category: "Tours",
        price: tour.price,
        quantity: 1,
      }],
    },
  });
};
```

---

### A.4 · Removing duplicate `begin_checkout` fires (H3)

```typescript
// pages/tours-events/[slug].tsx ~line 257
// REMOVE this early begin_checkout call from the click handler:
const fireCheckoutEventsAndNavigate = async () => {
  gtmPushEvent("view_cart", { ecommerce: null });  // keep view_cart clear
  // REMOVE the following:
  gtmPushEvent("begin_checkout", {
    ecommerce: {
      currency: "USD",
      value: totalValue,
      items: cartItems,
    },
  });
  // then router.push('/booking') happens
};

// pages/booking/index.tsx ~line 1371 — KEEP this as the canonical fire point:
// This fires after checkoutResponse is successfully returned from the API,
// which is the correct moment — the user has committed to checkout.
gtmPushEvent("begin_checkout", {
  ecommerce: {
    currency: "USD",
    value: checkoutTotal,
    coupon: appliedCoupon,
    items: checkoutItems,
  },
});
```

---

### A.5 · Fix broken `view_item` payload on destination pages (H4)

```typescript
// pages/destination/[slug].tsx ~line 800

// BEFORE — empty strings cause silent data loss in GA4:
gtmPushEvent("view_item", {
  ecommerce: {
    currency: "USD",
    value: '',          // ← empty string
    items: [{
      item_id: property.id,
      item_name: property.name,
      item_category: "Accommodation",
      price: '',        // ← empty string
      discount: '',     // ← empty string
      coupon: '',       // ← empty string
    }],
  },
});

// AFTER — use undefined for unknown values, real value when available:
const startingPrice = property.rooms?.[0]?.price ?? undefined;

gtmPushEvent("view_item", {
  ecommerce: {
    currency: "USD",
    value: startingPrice,
    items: [{
      item_id: property.id,
      item_name: property.name,
      item_category: "Accommodation",
      price: startingPrice,
      // omit discount and coupon entirely if not applicable
    }],
  },
});
```

---

### A.6 · Fixing `user_id` PII — use Firebase UID everywhere (M1)

```typescript
// components/pages/LoginPage.tsx ~line 437
// BEFORE:
gtmPushEvent("login", {
  method: "email",
  user_id: formValues.email,   // ← PII
});

// AFTER:
gtmPushEvent("login", {
  method: "email",
  user_id: firebaseUser.uid,   // ← anonymous Firebase UID, not PII
});

// ---

// pages/auth/callback.tsx ~line 289 and ~line 403
// BEFORE:
gtmPushEvent("login", {
  method: provider,
  user_id: user.email || user.uid,   // ← email takes precedence = PII
});

// AFTER:
gtmPushEvent("login", {
  method: provider,
  user_id: user.uid,   // ← UID only
});

// ---

// components/molecules/SocialSignIn.tsx ~line 435
// Same fix — replace email || uid with uid only
gtmPushEvent("login", {
  method: "google",  // or "apple"
  user_id: result.user.uid,
});
```

---

### A.7 · Gate Microsoft Clarity behind Cookiebot consent (M2)

```typescript
// pages/_app.tsx ~line 958
// BEFORE — unconditional load:
if (!isNative && router.pathname !== "/klaviyo" && router.pathname !== "/iframe") {
  // Clarity loads here for all visitors
  clarify("set", "userId", firebaseUser?.uid);
}

// AFTER — consent-gated load:
if (!isNative && router.pathname !== "/klaviyo" && router.pathname !== "/iframe") {
  const loadClarity = () => {
    if (typeof window !== "undefined" && (window as any).Cookiebot?.consent?.statistics) {
      // inject Clarity script tag
      const script = document.createElement("script");
      script.src = `https://www.clarity.ms/tag/o7iu329276`;
      script.async = true;
      document.head.appendChild(script);
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("CookiebotOnConsentReady", loadClarity);
    window.addEventListener("CookiebotOnConsentChange", loadClarity);
    // also try immediately in case consent was already given
    loadClarity();
  }
}
```

---

### A.8 · Limit TikTok twin events to ecommerce events only (L3)

```typescript
// utils/gtmTracker.ts

const tiktokEventMap: Record<string, string> = {
  begin_checkout: "InitiateCheckout",
  add_to_cart: "AddToCart",
  view_item: "ViewContent",
  purchase: "CompletePayment",
  add_payment_info: "AddPaymentInfo",
  sign_up: "CompleteRegistration",
};

export const gtmPushEvent = (
  eventName: string,
  eventData: Record<string, any> = {},
) => {
  if (typeof window !== "undefined") {
    window.dataLayer = window.dataLayer || [];

    // Push the original event first
    window.dataLayer.push({ event: eventName, ...eventData });

    // Only push TikTok twin for the 6 mapped ecommerce events
    // BEFORE this check was missing — ALL events got a twin push
    const tiktokEventName = tiktokEventMap[eventName];
    if (!tiktokEventName) return;  // ← ADD THIS GUARD

    // ... rest of TikTok payload building and push
  }
};
```

---

### A.9 · Adding missing type declarations to `global.d.ts` (L5)

```typescript
// types/global.d.ts — add these declarations:

interface Window {
  // Google Tag Manager
  dataLayer: Record<string, any>[];
  google_tag_manager: Record<string, any>;

  // TikTok Pixel
  ttq: {
    track: (eventName: string, payload?: Record<string, any>) => void;
    identify: (params: Record<string, any>) => void;
    page: () => void;
  };

  // Tapfiliate
  tap: (...args: any[]) => void;
  _tapInit: boolean;

  // Cookiebot
  Cookiebot: {
    consent: {
      necessary: boolean;
      preferences: boolean;
      statistics: boolean;
      marketing: boolean;
    };
    show: () => void;
    hide: () => void;
  };

  // Debug helpers (development only)
  testGTM?: () => string;
}
```

---

*Audit conducted May 2026. All findings verified against frontend source files, GTM container export GTM-KC78NFHD v34, GA4 property G-K27E7XLRBP admin screenshots, and Google Ads account 697-007-4125 conversion configurations.*



---

# PART 3 — Implementation guide

<a id="part-3"></a>


# Mad Monkey Hostels — GA4 & GTM Implementation Documentation

**Version:** Based on GTM-KC78NFHD v34 · GA4 G-K27E7XLRBP  
**Frontend stack:** Next.js 14 (Pages Router) + Capacitor (iOS / Android)  
**Last updated:** August 2026 (§19 standalone landing pages added)  
**Related:** [Analytics index](./README.md) · [Roadmap & reporting](./GA4-GTM-ROADMAP-AND-REPORTING.md) · [Audit report](../../GA4-GTM-AUDIT-REPORT.md)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Initialization Sequence](#2-initialization-sequence)
3. [Consent Mode](#3-consent-mode)
4. [Event Tracking Utility](#4-event-tracking-utility)
5. [Complete Event Catalog](#5-complete-event-catalog)
6. [Booking & Ecommerce Flow](#6-booking--ecommerce-flow)
7. [Authentication Flow](#7-authentication-flow)
8. [Navigation Tracking](#8-navigation-tracking)
9. [Native App Tracking](#9-native-app-tracking)
10. [Third-Party Integrations](#10-third-party-integrations)
11. [GTM Container Structure](#11-gtm-container-structure)
12. [GA4 Property Configuration](#12-ga4-property-configuration)
13. [Google Ads Integration](#13-google-ads-integration)
14. [Environment & Configuration Reference](#14-environment--configuration-reference)
15. [Known Issues](#15-known-issues)
16. [Testing & Debugging](#16-testing--debugging)
17. [How to Add a New Tracking Event](#17-how-to-add-a-new-tracking-event)
18. [Incident & Rollback Guide](#18-incident--rollback-guide)
19. [Standalone Landing Pages (Non-Frontend Repos)](#19-standalone-landing-pages-non-frontend-repos)

---

## 1. Architecture Overview

### System components

```
┌─────────────────────────────────────────────────────────────────┐
│                      Browser / Capacitor App                    │
│                                                                 │
│  ┌──────────────┐    ┌─────────────────────────────────────┐   │
│  │  Next.js App │───▶│          window.dataLayer           │   │
│  │              │    │  (shared event bus for all tags)    │   │
│  │  gtmTracker  │    └──────────────┬──────────────────────┘   │
│  │  .ts utility │                   │                          │
│  └──────────────┘                   ▼                          │
│                          ┌──────────────────────┐              │
│                          │  Google Tag Manager  │              │
│                          │   GTM-KC78NFHD       │              │
│                          └──────┬───────────────┘              │
│                                 │ fires tags based on          │
│                                 │ triggers + consent           │
│                    ┌────────────┼────────────────────┐         │
│                    ▼            ▼                    ▼         │
│            ┌────────────┐ ┌──────────┐  ┌──────────────────┐  │
│            │  GA4 Web   │ │  TikTok  │  │  Other pixels    │  │
│            │G-K27E7XLRBP│ │  Pixel   │  │  FB/Sojern/      │  │
│            └────────────┘ └──────────┘  │  Reddit/Wise     │  │
│                                         └──────────────────┘  │
│                                                                 │
│  ┌──────────────┐    Direct (not via GTM)                      │
│  │  Microsoft   │◀───── _app.tsx (no consent gate — see §15)  │
│  │  Clarity     │                                              │
│  └──────────────┘                                              │
│                                                                 │
│  ┌──────────────┐    Direct (not via GTM)                      │
│  │  Tapfiliate  │◀───── tapfiliate.ts + thanks.tsx            │
│  └──────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Data flow summary

| Source | Mechanism | Destination |
|---|---|---|
| Page events (ecommerce, auth, nav) | `gtmPushEvent()` → `window.dataLayer` → GTM | GA4, TikTok Pixel |
| Native app screen navigation | `window.dataLayer.push(screen_view)` in `_app.tsx` | GA4 App stream |
| Consent state | Cookiebot → `gtag('consent', 'update', …)` | GA4, Google Ads |
| Session recording | Microsoft Clarity script (direct, no GTM) | Clarity cloud |
| Affiliate tracking | `window.tap('conversion', …)` in `thanks.tsx` | Tapfiliate |
| Email marketing | `klaviyoTracker.ts` → backend API `/klaviyo` | Klaviyo |

### GA4 measurement IDs in use

| ID | Purpose | Routing condition |
|---|---|---|
| `G-K27E7XLRBP` | Production web + Google Ads | `window.location.hostname !== 'localhost'` |
| `G-27GXNDKYWW` | Development / localhost | `hostname === 'localhost'` |
| `G-WVGB07X1M6` | Native app (iOS + Android) | Separate GTM tag for app stream |

---

## 2. Initialization Sequence

### 2.1 Complete bootstrap order

The following sequence happens on every hard page load (browser navigation or app cold start):

```
Browser parses HTML (_document.tsx output)
│
├─ 1. <script> cookiebot-google-consent-bridge (afterInteractive)
│      ├─ window.dataLayer = window.dataLayer || []
│      ├─ function gtag(){dataLayer.push(arguments);}
│      ├─ gtag('consent', 'default', { all: 'denied' })
│      └─ starts polling for Cookiebot (waitForCookiebot loop)
│
├─ 2. <script> gtm-datalayer-init (afterInteractive)
│      └─ window.dataLayer.push({ user_group: '[V3]' })
│
├─ 3. <noscript> GTM iframe fallback
│      └─ <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-KC78NFHD">
│
├─ 4. <script> GTM loader (afterInteractive) — from GTM.tsx
│      ├─ pushes { gtm.start, event: 'gtm.js' } to dataLayer
│      ├─ injects gtm.js script tag (async)
│      ├─ console.log GTM loading status (debug — production issue, see §15 L2)
│      └─ sets window.testGTM helper (debug — production issue, see §15 L2)
│
├─ 5. GTM container loads and processes dataLayer backlog
│      ├─ GA4 Configuration tag fires → page_view sent to GA4
│      ├─ Cookiebot CMP tag loads (sets up consent regions)
│      └─ All triggers evaluated against current dataLayer
│
└─ 6. _app.tsx React lifecycle (client-side)
       ├─ useEffect: Microsoft Clarity injected (no consent gate — see §15 M2)
       ├─ useEffect: FreshChat widget injected
       ├─ useEffect: Tapfiliate init
       ├─ useEffect: Capacitor screen_view listener (native app only)
       └─ useEffect: route change listeners for SPA navigation
```

### 2.2 `_document.tsx` — server-rendered scripts

**File:** `frontend/pages/_document.tsx`

This file owns three critical responsibilities:

**a) Consent Mode default (runs before GTM):**
```javascript
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}

gtag('consent', 'default', {
  'analytics_storage': 'denied',
  'ad_storage': 'denied',
  'ad_user_data': 'denied',
  'ad_personalization': 'denied'
});
```

**b) `user_group` dataLayer push:**
```javascript
window.dataLayer.push({ 'user_group': '[V3]' });
```
This value is used in GTM to distinguish V3 traffic from legacy traffic.

**c) GTM `<noscript>` fallback:**
```html
<noscript>
  <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-KC78NFHD"
          height="0" width="0" style="display:none;visibility:hidden">
  </iframe>
</noscript>
```

**Note — Cookiebot is deliberately *not* loaded here.** A hardcoded
`<script id="CookiebotSetupScript">` briefly lived in this file alongside
GTM's own "Cookiebot CMP" tag (step 5 in §2.1) — loading `uc.js` from both
places raced two Cookiebot SDK instances and intermittently deleted app-side
localStorage (`mm_attribution`) around consent time. Removed 2026-08-24; see
`frontend/docs/COOKIEBOT_CMP_FIX.md`. Do not re-add a Cookiebot script tag
here — GTM's tag is the single source.

### 2.3 `GTM.tsx` — GTM loader component

**File:** `frontend/components/atoms/GTM.tsx`

Injects the GTM container script using `next/script` with `strategy="afterInteractive"`. The GTM container ID `GTM-KC78NFHD` is hardcoded here (known issue — see §15 L1).

This component is mounted in `pages/_app.tsx` and excluded for paths `/klaviyo` and `/iframe`.

### 2.4 SPA navigation handling

Next.js is a Single Page Application. After the initial hard load, GTM's `page_view` trigger does **not** re-fire on client-side route changes.

**Current state (broken):** No `dataLayer.push` for SPA route changes on web. Enhanced Measurement may partially catch some history changes but this is unreliable with Next.js.

**Intended fix (see §15 H1):**
```typescript
// pages/_app.tsx
router.events.on('routeChangeComplete', (url) => {
  window.dataLayer.push({
    event: 'page_view',
    page_location: url,
    page_title: document.title,
  });
});
```

---

## 3. Consent Mode

### 3.1 Architecture

Consent Mode v2 is implemented across two layers:

| Layer | File | Role |
|---|---|---|
| Code (default state) | `pages/_document.tsx` | Sets all consent to `denied` before GTM loads |
| GTM (CMP integration) | GTM Cookiebot tag | Updates consent after Cookiebot fires its events |

### 3.2 Consent update flow

```
User visits page
│
├─ _document.tsx sets all consent to DENIED
│
├─ Cookiebot banner loads and displays
│
└─ User interacts with banner
       │
       ├─ Accept all
       │    └─ CookiebotOnConsentReady fires
       │         └─ updateGoogleConsentFromCookiebot()
       │              ├─ Cookiebot.consent.statistics === true
       │              │    └─ gtag('consent','update',{ analytics_storage: 'granted' })
       │              └─ Cookiebot.consent.marketing === true
       │                   └─ gtag('consent','update',{
       │                           ad_storage: 'granted',
       │                           ad_user_data: 'granted',
       │                           ad_personalization: 'granted'
       │                      })
       │
       ├─ Reject all / statistics only
       │    └─ Same flow, only statistics consent granted
       │
       └─ Consent change (later)
            └─ CookiebotOnConsentChange fires same update function
```

### 3.3 Consent state per Cookiebot category

| Cookiebot category | Google consent signals granted |
|---|---|
| Necessary | (none — always on) |
| Preferences | (none mapped) |
| Statistics | `analytics_storage` |
| Marketing | `ad_storage`, `ad_user_data`, `ad_personalization` |

### 3.4 GTM Consent Mode v2 settings (from container)

The Cookiebot CMP tag in GTM has:
- `waitForUpdate: 2000` — GTM waits up to 2 seconds for consent before firing tags
- `mlConsentRegions: ['GB']` — **only UK gets denied-by-default** (known issue — see §15 M3)
- All other regions receive default-granted state

### 3.5 Tag-level consent requirements

| Tag | Required consent signal |
|---|---|
| GA4 Configuration | `analytics_storage` |
| GA4 Event tags | `analytics_storage` |
| Google Ads Conversion | `ad_storage` + `ad_user_data` |
| TikTok Pixel | `needed` (`ad_storage`+`ad_user_data`) as of 2026-08-20 GTM API pull — reverses the original "NOT_SET" finding; publish status to live container unconfirmed (see §15 M4) |
| Facebook Pixel | `needed` (`ad_storage`+`ad_user_data`) as of 2026-08-20 GTM API pull — same caveat (see §15 M4) |
| Sojern | `needed` (`ad_storage`+`ad_user_data`) as of 2026-08-20 GTM API pull — same caveat (see §15 M4) |
| Reddit | `needed` (`ad_storage`+`ad_user_data`) as of 2026-08-20 GTM API pull — same caveat (see §15 M4) |
| Microsoft Clarity | Not in GTM — loaded directly without consent gate (see §15 M2) |

---

## 4. Event Tracking Utility

### 4.1 `gtmPushEvent` — primary tracking function

**File:** `frontend/utils/gtmTracker.ts`

All analytics events in the codebase go through this single function (except native app `screen_view` which pushes directly):

```typescript
export const gtmPushEvent = (
  eventName: string,
  eventData: Record<string, any> = {},
) => {
  if (typeof window !== "undefined") {
    window.dataLayer = window.dataLayer || [];

    // 1. Resolve TikTok event name for this event
    const { formattedName: tiktokEventName, source } = resolveTikTokEventName(eventName);

    // 2. Push the original event with TikTok metadata attached
    window.dataLayer.push({
      event: eventName,
      ...eventData,
      tiktokEventName,
      tiktokEventSource: source,
    });

    // 3. Build TikTok payload and push a second twin event
    //    NOTE: This fires for ALL events, not just ecommerce (known issue — see §15 L3)
    window.dataLayer.push({
      event: tiktokEventName,
      originalEventName: eventName,
      ...tiktokPayload,
    });

    // 4. Direct ttq.track() fallback if TikTok pixel is loaded on page
    if (window.ttq?.track) {
      ttq.track(tiktokEventName, tiktokPayload);
    }
  }
};
```

**Result:** Every call to `gtmPushEvent` generates **two** `dataLayer` pushes — the original event and a TikTok-mapped twin. For ecommerce events this is intentional; for all other events it is a known issue (§15 L3).

### 4.2 TikTok event name mapping

| GA4 event name | TikTok event name |
|---|---|
| `view_item` | `ViewContent` |
| `add_to_cart` | `AddToCart` |
| `begin_checkout` | `InitiateCheckout` |
| `add_payment_info` | `AddPaymentInfo` |
| `purchase` | `CompletePayment` |
| `sign_up` | `CompleteRegistration` |
| All other events | Formatted version of the original name (e.g. `Navigation`, `Login`) — unintended, see §15 L3 |

### 4.3 `deferGtmPushEvent` — idle-time tracking

Same as `gtmPushEvent` but deferred to browser idle time:

```typescript
export const deferGtmPushEvent = (
  eventName: string,
  eventData: Record<string, any> = {},
) => {
  if (typeof window !== "undefined") {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => gtmPushEvent(eventName, eventData));
    } else {
      setTimeout(() => gtmPushEvent(eventName, eventData), 0);
    }
  }
};
```

Used in `pages/booking/index.tsx` for `begin_checkout` to avoid blocking the checkout UI.

### 4.4 Standard ecommerce payload structure

All ecommerce events follow this GA4 Enhanced Ecommerce shape:

```typescript
{
  ecommerce: {
    currency: "USD",            // always USD
    value: number,              // total value
    coupon?: string,            // coupon code if applied
    transaction_id?: string,    // purchase events only
    items: [
      {
        item_id: string,        // property/room/tour ID
        item_name: string,      // display name
        item_category: string,  // "Accommodation" | "Tours & Experiences"
        item_brand?: string,    // property name (tours)
        price: number,
        quantity: number,
        discount?: number,
        coupon?: string,
      }
    ]
  }
}
```

**Important:** Always push `{ ecommerce: null }` to `dataLayer` before an ecommerce event to clear the previous ecommerce object. Most pages do this; `destination/[slug].tsx` does not (minor omission).

---

## 5. Complete Event Catalog

### 5.1 Ecommerce events

#### `view_item_list`

Fires when a list of items is displayed to the user.

| File | When | Notes |
|---|---|---|
| `pages/room/[slug].tsx` | On page mount | Item list = all rooms at a property |
| `pages/tours-events/index.tsx` | On page mount | Item list = all tours |

```typescript
gtmPushEvent("view_item_list", {
  ecommerce: {
    item_list_id: "room_listing",    // or "tours_listing"
    item_list_name: "Rooms",         // or "Tours & Experiences"
    items: [
      {
        item_id: room.propertyId,
        item_name: room.name,
        item_list_id: "room_listing",
        item_list_name: "Rooms",
        item_category: "Accommodation",
        price: room.price,
        index: 0,                    // position in list
      }
    ]
  }
});
```

---

#### `view_item`

Fires when a single item detail page is viewed.

| File | When | Notes |
|---|---|---|
| `pages/destination/[slug].tsx` | On page mount | **BROKEN** — value/price are empty strings (§15 H4) |
| `pages/tours-events/[slug].tsx` | On page mount | Correct payload |

```typescript
gtmPushEvent("view_item", {
  ecommerce: {
    currency: "USD",
    value: item.price,              // ← empty string on destination pages (bug)
    items: [
      {
        item_id: item.id,
        item_name: item.name,
        item_category: "Accommodation",   // or "Tours & Experiences"
        price: item.price,          // ← empty string on destination pages (bug)
        discount: item.discount,
        coupon: item.coupon,
      }
    ]
  }
});
```

---

#### `add_to_cart`

Fires when an item is added to the cart.

| File | When | Notes |
|---|---|---|
| `components/molecules/CardRoomComponent.tsx` | Room card "+" click | Item-rich payload |
| `components/molecules/ToursShoppingCart.tsx` | **On every `adultCount` change** | **Over-fires — known issue §15 H2** |
| `contexts/cartContext.tsx` | After `addToCart()` API | **Gated by `ENABLE_CART_ANALYTICS=true` (OFF by default)** — minimal payload, no items |

```typescript
gtmPushEvent("add_to_cart", {
  ecommerce: {
    currency: "USD",
    value: room.price * quantity,
    items: [
      {
        item_id: room.propertyId,
        item_name: room.name,
        item_category: "Accommodation",
        price: room.price,
        quantity: quantity,
      }
    ]
  }
});
```

---

#### `remove_from_cart`

Fires when an item is removed from the cart.

| File | When | Notes |
|---|---|---|
| `components/molecules/CardRoomComponent.tsx` | Room card "−" click | Item-rich payload |
| `contexts/cartContext.tsx` | After `removeFromCart()` API | **Gated** — only sends `item_id`, no other fields |

```typescript
gtmPushEvent("remove_from_cart", {
  ecommerce: {
    currency: "USD",
    value: room.price * quantity,
    items: [
      {
        item_id: room.propertyId,
        item_name: room.name,
        price: room.price,
        quantity: quantity,
      }
    ]
  }
});
```

---

#### `view_cart`

Fires when the cart is displayed to the user before checkout.

| File | When | Notes |
|---|---|---|
| `components/molecules/RoomShoppingCart.tsx` | "CONTINUE TO CHECKOUT" click | Item-rich |
| `components/molecules/MobileRoomCart.tsx` | Mobile sticky checkout button | Item-rich |
| `pages/tours-events/[slug].tsx` | Before `begin_checkout` on checkout click | `ecommerce: null` clear then item-rich |
| `contexts/cartContext.tsx` | `checkoutCart()` call | **Gated** — minimal, no items |

```typescript
// Clear previous ecommerce data first
window.dataLayer.push({ ecommerce: null });

gtmPushEvent("view_cart", {
  ecommerce: {
    currency: "USD",
    value: cart.total,
    items: cartItems,
  }
});
```

---

#### `begin_checkout`

Fires when the user initiates the checkout process.

| File | When | Notes |
|---|---|---|
| `pages/tours-events/[slug].tsx:257` | "Book Now" click | **DUPLICATE — should be removed (§15 H3)** |
| `pages/booking/index.tsx:1371` | Checkout form submitted, after API response | Canonical fire point |
| `contexts/cartContext.tsx` | `checkoutCart()` call | **Gated** — minimal payload |

```typescript
gtmPushEvent("begin_checkout", {    // or deferGtmPushEvent
  ecommerce: {
    currency: "USD",
    value: checkout.total,
    coupon: checkout.couponCode,
    items: checkout.items.map(item => ({
      item_id: item.propertyId,
      item_name: item.name,
      item_category: item.type,
      price: item.price,
      quantity: item.quantity,
      discount: item.discount,
      coupon: item.couponCode,
    }))
  }
});
```

---

#### `add_payment_info`

Fires when the user submits payment details.

| File | When |
|---|---|
| `frontend/utils/handleCheckoutSubmit.ts` | Payment form submission |

```typescript
gtmPushEvent("add_payment_info", {
  ecommerce: {
    currency: "USD",
    value: total,
    payment_type: "Credit Card",   // Stripe
    coupon: couponCode,
    items: checkoutItems,
  }
});
```

> **Note:** `handleCheckoutSubmit.ts` appears to be an older utility. Verify it is still actively called in the current checkout flow.

---

#### `add_shipping_info`

Fires during the checkout form submission.

| File | When |
|---|---|
| `frontend/utils/handleCheckoutSubmit.ts` | On checkout form submit |

```typescript
gtmPushEvent("add_shipping_info", {
  ecommerce: {
    currency: "USD",
    value: total,
    items: checkoutItems,
  }
});
```

---

#### `purchase`

The canonical conversion event. Fires after a confirmed booking.

| File | When | Notes |
|---|---|---|
| `pages/booking/payment.tsx:86` | Immediately after Stripe payment success | **DUPLICATE — must be removed (§15 C1)** |
| `pages/booking/thanks.tsx` | On confirmation page load | **Canonical** — has sessionStorage deduplication |

**Canonical fire from `thanks.tsx`:**
```typescript
// Deduplication key built from paymentIntentId, session_id, or cartId
const dedupKey = `purchase_fired_${paymentIntentId || session_id || cartId}`;

if (!sessionStorage.getItem(dedupKey)) {
  sessionStorage.setItem(dedupKey, "true");

  gtmPushEvent("purchase", {
    ecommerce: {
      transaction_id: paymentIntentId || cartId,
      currency: "USD",
      value: booking.total,
      coupon: booking.couponCode,
      original_value: booking.subtotal,     // pre-discount total
      reservation_id: booking.reservationId,
      items: booking.items.map(item => ({
        item_id: item.propertyId,
        item_name: item.name,
        item_category: item.type,
        price: item.price,
        quantity: item.quantity,
        discount: item.discount,
        coupon: item.couponCode,
      }))
    }
  });
}
```

**Free tours** (zero-value bookings):
```typescript
gtmPushEvent("purchase", {
  ecommerce: {
    transaction_id: cartId,
    currency: "USD",
    value: 0,
    items: [{ item_id: tour.id, item_name: tour.title, price: 0, quantity: 1 }]
  }
});
```

**Custom parameters on `purchase`:**

| Parameter | Description | GA4 registration |
|---|---|---|
| `transaction_id` | Stripe payment intent ID or cart ID | Standard |
| `value` | Final charged amount (post-discount) | Standard |
| `original_value` | Pre-discount subtotal | Registered as dimension (wrong — should be metric, see §15 H6) |
| `reservation_id` | Internal booking ID | Custom dimension — registered |
| `coupon` | Applied coupon code | Standard |
| `currency` | Always "USD" | Standard |

---

### 5.2 Authentication events

#### `login`

| File | When | `user_id` value | Notes |
|---|---|---|---|
| `components/pages/LoginPage.tsx:437` | Email login button click | **Email** (PII — §15 M1) | |
| `components/molecules/createAccountForm.tsx` | Create account form submit | Firebase UID | Correct |
| `components/molecules/SocialSignIn.tsx:435` | Google/Apple sign-in | Email or UID | **May send email (§15 M1)** |
| `pages/auth/callback.tsx:289,:403` | OAuth redirect callback | Email or UID | **May send email (§15 M1)** |

```typescript
gtmPushEvent("login", {
  method: "email",      // "email" | "google" | "apple"
  user_id: user.uid,    // MUST be Firebase UID — never email
});
```

---

#### `sign_up`

| File | When | Notes |
|---|---|---|
| `components/molecules/createAccountForm.tsx` | Email account created | Correct — fires after Firebase account creation |
| `pages/auth/callback.tsx` | OAuth signup | **Does NOT fire — missing (§15 L4)** |
| `components/molecules/SocialSignIn.tsx` | Google/Apple new user | **Does NOT fire — missing (§15 L4)** |

```typescript
gtmPushEvent("sign_up", {
  method: "email",      // "email" | "google" | "apple"
  user_id: user.uid,    // Firebase UID only
});
```

---

### 5.3 Navigation events

#### `navigation`

Fires when a user clicks a nav item in the header or bottom navigation.

| File | Trigger |
|---|---|
| `components/molecules/layouts/DesktopHeader.tsx` | Desktop menu item clicks |
| `components/molecules/BottomNavigationComponent.tsx` | Mobile bottom tab clicks |

```typescript
gtmPushEvent("navigation", {
  nav_item: "explore",          // URL path or identifier
  nav_name: "Explore",          // Display name — inconsistent casing (see §15)
  site_type: "web",             // "web" | "app"
});
```

> **Note:** `nav_name` casing is inconsistent between DesktopHeader (`"Explore"`, `"Trips"`) and BottomNavigation (`"explore"`, `"trips"`). This makes grouping in GA4 Explore unreliable.

---

#### `cta_click`

| File | When |
|---|---|
| `components/pages/LoginPage.tsx` | "SIGN UP" button on login page |

```typescript
gtmPushEvent("cta_click", {
  cta_text: "SIGN UP",
  cta_location: "login_page",
});
```

---

### 5.4 Cart / session events

These events are fired from `contexts/cartContext.tsx` and are **gated by `NEXT_PUBLIC_ENABLE_CART_ANALYTICS=true`**. This environment variable is `false` by default, meaning these events do **not** fire in production unless explicitly enabled.

| Event | When | Payload |
|---|---|---|
| `cart_session_reset` | Cart session expires or resets | `{ cart_id }` |
| `cart_cleared` | Cart explicitly cleared | `{ cart_id }` |
| `apply_coupon` | Coupon code applied | `{ coupon_code, discount_amount }` |
| `error` | Cart API error | `{ error_type, error_message }` — **not gated** |

---

### 5.5 Payment / error events

#### `payment_error`

| File | When |
|---|---|
| `pages/booking/payment.tsx` | Stripe payment failure |

```typescript
gtmPushEvent("payment_error", {
  error_type: stripeError.type,
  error_code: stripeError.code,
  error_message: stripeError.message,
});
```

---

## 6. Booking & Ecommerce Flow

### 6.1 Room booking — complete event sequence

```
User lands on destination/[slug].tsx
│
├─ EVENT: view_item
│    payload: { item_id: propertyId, item_name, item_category: "Accommodation" }
│    ⚠️  value and price are empty strings (known issue §15 H4)
│
├─ User scrolls down to rooms section
│
└─ Component: room/[slug].tsx loads room list
     │
     ├─ EVENT: view_item_list
     │    payload: { item_list_id: "room_listing", items: [...all rooms] }
     │
     ├─ User clicks "+" on a room → CardRoomComponent
     │    │
     │    ├─ API call: cartContext.addToCart()
     │    │
     │    └─ EVENT: add_to_cart
     │         payload: { currency, value, items: [{ item_id, item_name, price, quantity }] }
     │
     ├─ User clicks "−" on a room → CardRoomComponent
     │    │
     │    └─ EVENT: remove_from_cart
     │         payload: { currency, value, items: [...] }
     │
     └─ User clicks cart → RoomShoppingCart / MobileRoomCart
          │
          ├─ EVENT: view_cart (on cart open or "CONTINUE" click)
          │    payload: { currency, value, items: [...all cart items] }
          │
          └─ User clicks "CONTINUE TO CHECKOUT"
               │
               ▼
        /booking/index.tsx
               │
               ├─ User fills checkout form and submits
               │
               ├─ API call: checkout POST
               │
               ├─ EVENT: begin_checkout  ← canonical fire point
               │    payload: { currency, value, coupon, items: [...] }
               │
               └─ Redirect to payment page
                    │
                    ▼
             /booking/payment.tsx
                    │
                    ├─ User enters card details (Stripe Elements)
                    │
                    ├─ EVENT: add_payment_info
                    │    payload: { currency, value, payment_type, items }
                    │
                    ├─ Stripe processes payment
                    │
                    ├─ ⚠️  EVENT: purchase ← DUPLICATE (known issue §15 C1 — REMOVE THIS)
                    │    transaction_id = paymentIntentId
                    │
                    └─ Redirect to /booking/thanks?...
                         │
                         ▼
                  /booking/thanks.tsx
                         │
                         ├─ SESSION STORAGE DEDUP CHECK
                         │    key: purchase_fired_${paymentIntentId || session_id || cartId}
                         │
                         ├─ EVENT: purchase  ← canonical, deduplicated
                         │    payload: { transaction_id, value, coupon,
                         │              original_value, reservation_id, items }
                         │
                         └─ Tapfiliate conversion tracking (direct, not GTM)
```

### 6.2 Tours booking — complete event sequence

```
User lands on tours-events/index.tsx
│
├─ EVENT: view_item_list
│    payload: { item_list_id: "tours_listing", items: [...all tours] }
│
└─ User clicks a tour → tours-events/[slug].tsx
     │
     ├─ EVENT: view_item
     │    payload: { currency, value: tour.price, items: [{ item_id: tour.id, ... }] }
     │
     ├─ User selects number of guests → ToursShoppingCart component
     │    │
     │    └─ ⚠️  EVENT: add_to_cart fires on EVERY adultCount change (known issue §15 H2)
     │         Should only fire on explicit "add" action
     │
     ├─ User clicks "Book Now" / checkout button
     │    │
     │    ├─ EVENT: view_cart (ecommerce: null clear + item-rich payload)
     │    │
     │    ├─ ⚠️  EVENT: begin_checkout (known issue §15 H3 — DUPLICATE, remove from here)
     │    │
     │    └─ router.push('/booking')
     │         │
     │         ▼
     │    /booking/index.tsx
     │         │
     │         └─ EVENT: begin_checkout ← canonical fire point
     │               (same flow as room booking from here)
     │
     └─ (payment + thanks flow identical to room booking above)
```

### 6.3 Purchase event deduplication logic (`thanks.tsx`)

```typescript
// Three possible transaction identifiers, in priority order:
const paymentIntentId = router.query.payment_intent as string;   // Stripe
const session_id = router.query.session_id as string;            // Stripe checkout session
const cartId = booking?.cartId;                                  // fallback

const dedupKey = `purchase_fired_${paymentIntentId || session_id || cartId}`;

// Guard: only fire once per unique booking
if (typeof window !== "undefined" && !sessionStorage.getItem(dedupKey)) {
  sessionStorage.setItem(dedupKey, "true");
  // fire purchase event
}

// Cleanup: remove backup cart data after successful confirmation
sessionStorage.removeItem("checkout_cart_backup");
```

> **Note:** `sessionStorage` is cleared when the browser tab is closed. If a user closes the tab and reopens the confirmation URL, the `purchase` event will fire again. For robustness, consider also checking a server-side confirmation flag.

---

## 7. Authentication Flow

### 7.1 Email authentication

```
/login page loads
│
├─ User clicks "SIGN UP" button
│    └─ EVENT: cta_click { cta_text: "SIGN UP", cta_location: "login_page" }
│
├─ User fills create account form → createAccountForm.tsx
│    │
│    ├─ Firebase: createUserWithEmailAndPassword()
│    │
│    ├─ EVENT: login { method: "email", user_id: uid }    ← correct
│    │
│    └─ EVENT: sign_up { method: "email", user_id: uid }  ← correct
│
└─ User fills login form → LoginPage.tsx
     │
     ├─ Firebase: signInWithEmailAndPassword()
     │
     └─ EVENT: login { method: "email", user_id: email }  ← ⚠️ PII (§15 M1)
```

### 7.2 Google / Apple OAuth

```
User clicks "Continue with Google" / "Continue with Apple"
│
├─ Native app path (Capacitor) → SocialSignIn.tsx
│    │
│    ├─ Firebase: signInWithCredential()
│    │
│    └─ EVENT: login { method: "google"|"apple", user_id: email || uid }
│         ⚠️  user_id may be email (§15 M1)
│         ⚠️  sign_up NOT fired for new users (§15 L4)
│
└─ Web path → OAuth redirect → /auth/callback.tsx
     │
     ├─ Firebase: getRedirectResult()
     │
     └─ EVENT: login { method: "google"|"apple", user_id: email || uid }
          ⚠️  user_id may be email (§15 M1)
          ⚠️  sign_up NOT fired for new users (§15 L4)
```

### 7.3 `user_id` policy

| Source | Correct value | Current state |
|---|---|---|
| Email registration | Firebase UID | Correct |
| Email login | Firebase UID | Sends email (bug) |
| Google OAuth | Firebase UID | May send email (bug) |
| Apple OAuth | Firebase UID | May send email (bug) |

**Rule:** Always use `user.uid` from the Firebase `UserCredential`. Never use `user.email`.

---

## 8. Navigation Tracking

### 8.1 Web navigation events

**Desktop header** — `components/molecules/layouts/DesktopHeader.tsx`:

```typescript
// Fires on each nav item click
gtmPushEvent("navigation", {
  nav_item: "explore",          // kebab-case path segment
  nav_name: "Explore",          // ⚠️ casing inconsistent vs mobile
  site_type: "web",
});
```

**Mobile bottom navigation** — `components/molecules/BottomNavigationComponent.tsx`:

```typescript
gtmPushEvent("navigation", {
  nav_item: "explore",
  nav_name: "explore",          // ⚠️ lowercase vs desktop's "Explore"
  site_type: "web",
});
```

| Nav item | Desktop `nav_name` | Mobile `nav_name` |
|---|---|---|
| Home / Explore | `"Explore"` | `"explore"` |
| Trips | `"Trips"` | `"trips"` |
| Account | `"Account"` | `"account"` |
| Destinations | `"Destinations"` | — |
| Tours | `"Tours"` | — |

> **Recommendation:** Standardise to lowercase kebab-case for all `nav_name` values to make GA4 Explore grouping reliable.

### 8.2 SPA `page_view` (current gaps)

| Scenario | Current state |
|---|---|
| Hard load (browser navigation) | GTM fires `page_view` — correct, but Enhanced Measurement fires a second one (§15 H1) |
| Next.js SPA route change | No `page_view` fired — missing (§15 H1) |
| Capacitor app navigation | `screen_view` fired with `app_page_location` — parameter not registered in GA4 (§15 H5) |

---

## 9. Native App Tracking

### 9.1 Screen view on Capacitor

**File:** `frontend/pages/_app.tsx`

```typescript
// Fires on every Capacitor route change (native iOS/Android only)
useEffect(() => {
  if (isNative) {
    const handleRouteChange = (url: string) => {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "screen_view",
        app_page_location: url,        // ⚠️ not registered as GA4 dimension (§15 H5)
        firebase_screen_name: url,
        firebase_screen_class: "NextJSPage",
      });
    };
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }
}, []);
```

### 9.2 Native app GA4 stream

- **Measurement ID:** `G-WVGB07X1M6`
- **Stream type:** iOS + Android (Firebase)
- **Routing:** Separate GTM tag fires only for native/app traffic

### 9.3 Native app Google Ads conversion actions

| Action name | Firebase event | Status |
|---|---|---|
| `MMGLOBAL\|GA4 - Mad Monkey Experience (iOS)` | `android_purchase` | ⚠️ Swapped (§15 H7) |
| `MMGLOBAL\|GA4 - Mad Monkey Experience (Android)` | `ios_purchase` | ⚠️ Swapped (§15 H7) |

---

## 10. Third-Party Integrations

### 10.1 TikTok Pixel

**Pixel ID:** `D095O0BC77U0QQJ07KTG`  
**Integration method:** GTM tag + direct `ttq.track()` fallback in `gtmTracker.ts`  
**Consent check (GTM tag):** `consentStatus: "needed"` (`ad_storage`+`ad_user_data`) as of the 2026-08-20 GTM workspace pull — reverses the original "NOT_SET" audit finding; not yet confirmed published to the live container (§15 M4). The direct `ttq.track()` fallback in step 4 of `gtmPushEvent()` bypasses GTM's consent gating entirely and has no consent check of its own — that part of the original finding still stands (§15 L3/N2).

The TikTok pixel receives events two ways:
1. Via GTM tag listening for TikTok-named events in `dataLayer` (e.g. `ViewContent`, `AddToCart`)
2. Via direct `ttq.track()` call inside `gtmPushEvent()` as a fallback

**Events tracked:**

| GA4 event | TikTok event |
|---|---|
| `view_item` | `ViewContent` |
| `add_to_cart` | `AddToCart` |
| `begin_checkout` | `InitiateCheckout` |
| `add_payment_info` | `AddPaymentInfo` |
| `purchase` | `CompletePayment` |
| `sign_up` | `CompleteRegistration` |

---

### 10.2 Microsoft Clarity

**Clarity ID:** `o7iu329276`  
**Integration method:** Direct script injection in `_app.tsx` — **not via GTM**  
**Consent check:** None — loads unconditionally (§15 M2)

```typescript
// pages/_app.tsx ~line 958
// Currently loads for ALL non-native visitors with no consent gate
if (!isNative && !isKlaviyo && !isIframe) {
  // Clarity loaded here
}
```

Clarity is excluded for:
- Native app (Capacitor) sessions
- `/klaviyo` path
- `/iframe` path

---

### 10.3 Tapfiliate (affiliate tracking)

**Integration method:** Direct `window.tap()` calls — not via GTM

**Initialization:** `frontend/utils/tapfiliate.ts` + `_app.tsx`

**Conversion tracking:** `pages/booking/thanks.tsx`

```typescript
// On successful booking confirmation
if (typeof window !== "undefined" && window.tap) {
  window.tap("conversion", transactionId, bookingValue, { currency: "USD" });
}
```

Tapfiliate is not connected to GA4 or GTM. It operates independently.

---

### 10.4 Sojern

**Integration method:** GTM tag with DOM polling  
**Consent check:** `consentStatus: "needed"` (`ad_storage`+`ad_user_data`) as of the 2026-08-20 GTM workspace pull — reverses the original "NOT_SET" audit finding; not yet confirmed published to the live container (§15 M4)

Sojern uses a DOM polling approach in GTM — it reads specific DOM elements to extract booking data rather than relying on `dataLayer` variables. The GTM tag includes a `setInterval` that repeatedly checks for DOM elements.

---

### 10.5 Klaviyo

**Integration method:** Server-side via backend API — no browser-side tracking  
**File:** `frontend/utils/klaviyoTracker.ts`

```typescript
// Calls the backend API which then sends to Klaviyo
// No direct browser→Klaviyo connection
await fetch('/api/klaviyo', {
  method: 'POST',
  body: JSON.stringify({ event, properties }),
});
```

Klaviyo is not integrated with GA4 or GTM.

---

## 11. GTM Container Structure

**Container ID:** `GTM-KC78NFHD`  
**Version audited:** v34

### 11.1 Tags

| Tag name | Type | Fires on |
|---|---|---|
| GA4 Configuration | GA4 Config | All pages (production hostname) |
| GA4 Configuration - DEV | GA4 Config | Localhost only |
| GA4 Configuration - App | GA4 Config | Native app traffic |
| GA4 - Ecommerce Events | GA4 Event | `view_item`, `add_to_cart`, `begin_checkout`, `purchase`, etc. |
| GA4 - Custom Events | GA4 Event | `navigation`, `login`, `sign_up`, etc. |
| GA4 - Outbound Click - Wise | GA4 Event | Wise outbound clicks — **hardcodes production GA4 ID** |
| Google Ads - Purchase | Ads Conversion | `purchase` event |
| Cookiebot CMP | Cookiebot | All pages |
| TikTok Pixel | Custom HTML | TikTok-named events in dataLayer |
| Facebook Pixel | Custom HTML | Page view + ecommerce events |
| Sojern | Custom HTML | `purchase` event |
| Reddit Pixel | Custom HTML | Page view |
| Microsoft Clarity | — | **Not in GTM — loaded directly in `_app.tsx`** |

### 11.2 Key triggers

| Trigger name | Type | Condition |
|---|---|---|
| All Pages | Page View | All pages |
| purchase | Custom Event | `event` equals `purchase` |
| add_to_cart | Custom Event | `event` equals `add_to_cart` |
| begin_checkout | Custom Event | `event` equals `begin_checkout` |
| view_item | Custom Event | `event` equals `view_item` |
| view_item_list | Custom Event | `event` equals `view_item_list` |
| login | Custom Event | `event` equals `login` |
| sign_up | Custom Event | `event` equals `sign_up` |
| navigation | Custom Event | `event` equals `navigation` |
| mad_loyalty | Custom Event | `event` equals `mad_loyalty` — **no code fires this event** |
| newsletter_sign_up | Custom Event | `event` equals `newsletter_sign_up` — **no code fires this event** |

### 11.3 Key variables

| Variable name | Type | Value |
|---|---|---|
| GA4 Measurement ID (Prod) | Constant | `G-K27E7XLRBP` |
| GA4 Measurement ID (Dev) | Constant | `G-27GXNDKYWW` |
| GA4 Measurement ID (App) | Constant | `G-WVGB07X1M6` |
| `ecommerce.items` | Data Layer | `ecommerce.items` |
| `ecommerce.value` | Data Layer | `ecommerce.value` |
| `ecommerce.transaction_id` | Data Layer | `ecommerce.transaction_id` |
| `ecommerce.currency` | Data Layer | `ecommerce.currency` |
| `tiktokEventName` | Data Layer | `tiktokEventName` |
| `user_group` | Data Layer | `user_group` (set to `[V3]` on init) |

### 11.4 Environment routing

GTM routes between production and dev GA4 properties based on hostname:

```javascript
// Condition used in GA4 Configuration tag
window.location.hostname !== 'localhost'  →  G-K27E7XLRBP (production)
window.location.hostname === 'localhost'  →  G-27GXNDKYWW (development)
```

---

## 12. GA4 Property Configuration

**Property:** Mad Monkey Hostels  
**Measurement ID (web):** `G-K27E7XLRBP`

### 12.1 Data streams

| Stream | Type | Measurement ID | Enhanced Measurement |
|---|---|---|---|
| Web | Web | `G-K27E7XLRBP` | ON — page_view enabled (causes double-fire, see §15 H1) |
| iOS App | iOS | (Firebase) | N/A |
| Android App | Android | (Firebase) | N/A |
| App stream (GTM) | Web | `G-WVGB07X1M6` | Unknown |

### 12.2 Custom dimensions

| Dimension name | Scope | Parameter | Notes |
|---|---|---|---|
| `reservation_id` | Event | `reservation_id` | Booking reference |
| `original_value` | Event | `original_value` | **WRONG TYPE — should be metric, not dimension (§15 H6)** |
| `user_group` | Event | `user_group` | Always `[V3]` for V3 traffic |
| `app_page_location` | — | `app_page_location` | **NOT REGISTERED — app navigation invisible (§15 H5)** |

### 12.3 Custom metrics

| Metric name | Scope | Parameter | Notes |
|---|---|---|---|
| (none registered) | — | — | `original_value` should be here |

### 12.4 Key events (starred conversions)

| Event | Status | Notes |
|---|---|---|
| `calendar_booking_search_submit` | Starred | **No stream data — event never fires in code (§15 C5)** |
| `purchase` | Not starred | **Should be starred (§15 C3)** |

---

## 13. Google Ads Integration

**Account:** 697-007-4125  
**Campaigns:** 4,708 (account-default goal scope, excludes removed campaigns) of 4,921 total campaigns in the account — only 16 are `ENABLED` and only 7 of those are actually `serving_status: SERVING` (confirmed via Ads API 2026-08-20)

### 13.1 Conversion goals

| Goal | Primary conversion actions | Status |
|---|---|---|
| Purchase | All Purchase | Active, Count: Every, 4,704 of 4,708 |
| Add to cart | Account-default, 27 of 4,708 campaigns | **Fixed 2026-08-19 — Active (§15 C2)**; 6 `ENDED` campaigns with customized goal sets still uncovered, moot since they aren't serving |
| Begin checkout | Account-default, 27 of 4,708 campaigns | **Fixed 2026-08-19 — Active, now matches Add to cart (§15 C2)** |
| Other | Wheelofpopups no longer Primary; BCY_Booking/PP_Booking no longer exist in the account | **Fixed — confirmed via Ads API 2026-08-20 (§15 C4)** |

### 13.2 All Purchase conversion action

| Setting | Value | Notes |
|---|---|---|
| Source | Website (GTM tag) | GA4 + dedicated Google Ads tag in GTM |
| Count | Every conversion | **Should be One (unique) for booking de-dup** |
| Value | Use different values; default $1 | |
| Click-through window | 90 days | |
| Engaged-view window | 30 days | |
| View-through window | 30 days | |
| Attribution model | Data-driven | |

> **Count: Every** combined with the duplicate `purchase` event (§15 C1) means every booking generates ~2 conversion records. Changing Count to **One (per click)** would be a partial mitigation, but the proper fix is removing the duplicate event from `payment.tsx`.

### 13.3 App conversion actions (Other goal)

| Action | Firebase event | Status |
|---|---|---|
| Mad Monkey Experience (iOS) | `android_purchase` | **Swapped label/event (§15 H7)** |
| Mad Monkey Experience (Android) | `ios_purchase` | **Swapped label/event (§15 H7)** |

### 13.4 Legacy property-specific actions (secondary)

36 property-specific conversion actions (BKK Booking, Boracay Booking, etc.) are secondary with 0 conversions and `Needs attention` / `Inactive` status. These are remnants of the old per-property tracking. Recommend archiving (§15 L6).

---

## 14. Environment & Configuration Reference

### 14.1 Hardcoded IDs (known issue — should be env vars, see §15 L1)

| ID | Current location | Should be |
|---|---|---|
| `GTM-KC78NFHD` | `components/atoms/GTM.tsx`, `pages/_document.tsx` | `NEXT_PUBLIC_GTM_ID` |
| `o7iu329276` (Clarity) | `pages/_app.tsx` | `NEXT_PUBLIC_CLARITY_ID` |
| `G-K27E7XLRBP` (prod GA4) | GTM variable | GTM constant — acceptable |
| `G-27GXNDKYWW` (dev GA4) | GTM variable | GTM constant — acceptable |
| `D095O0BC77U0QQJ07KTG` (TikTok) | GTM tag | GTM constant — acceptable |

### 14.2 Feature flags affecting analytics

| Flag | Default | Effect |
|---|---|---|
| `NEXT_PUBLIC_ENABLE_CART_ANALYTICS` | `false` | When `false`: cart context does NOT fire `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout` (minimal versions). Cart events come from UI components only. |

### 14.3 Paths excluded from GTM and Clarity

| Path | GTM | Clarity |
|---|---|---|
| `/klaviyo` | Excluded | Excluded |
| `/iframe` | Excluded | Excluded |
| Native Capacitor app | Not excluded (GTM runs) | Excluded |

### 14.4 `dataLayer` initial state

Every page load starts with this `dataLayer` state before GTM processes it:

```javascript
window.dataLayer = [
  // 1. Consent default (set by _document.tsx before GTM loads)
  { 0: "consent", 1: "default", 2: { analytics_storage: "denied", ad_storage: "denied", ... } },
  
  // 2. GTM start event (set by GTM.tsx)
  { "gtm.start": <timestamp>, event: "gtm.js" },

  // 3. User group tag (set by _document.tsx)
  { user_group: "[V3]" }
]
```

---

## 15. Known Issues

A full audit was conducted in May 2026. The following issues were identified. See the complete [GA4 & GTM Audit Report](../../GA4-GTM-AUDIT-REPORT.md) for detailed fix instructions and code snippets.

### Critical — fix immediately

| ID | Issue | Location |
|---|---|---|
| C1 | Duplicate `purchase` event doubles Google Ads conversions — **✅ Fixed, live in production** | `pages/booking/payment.tsx:86` |
| C2 | Add to cart and Begin checkout goals have 0 actions in Google Ads — **✅ Fixed 2026-08-19**, both Active at 27/4,708 account-default | Google Ads |
| C3 | `purchase` not marked as GA4 key event — **✅ Fixed, confirmed live** | GA4 Admin |
| C4 | Dead UA sources (BCY/PP Booking) + Wheelofpopups as Primary in 32 campaigns — **✅ Fixed**, confirmed via Ads API 2026-08-20 | Google Ads |
| C5 | `calendar_booking_search_submit` key event never fires — unimplemented; resolved via un-starring, `purchase` is the key event instead | Dev / GA4 |

### High — fix in Sprint 1

| ID | Issue | Location |
|---|---|---|
| H1 | SPA `page_view` missing; Enhanced Measurement double-fires | `_app.tsx` + GA4 |
| H2 | `add_to_cart` over-fires on every guest count change | `ToursShoppingCart.tsx:92` |
| H3 | `begin_checkout` fires 2-3x per checkout | `tours/[slug].tsx:257` |
| H4 | `view_item` destination page payload has empty strings | `destination/[slug].tsx:800` |
| H5 | `app_page_location` not registered in GA4 | GA4 Admin |
| H6 | `original_value` is a dimension not a metric | GA4 Admin |
| H7 | iOS/Android purchase actions have swapped event names | Google Ads |

### Medium — privacy/legal

| ID | Issue | Location |
|---|---|---|
| M1 | Email sent as `user_id` — PII in GA4 and Google Ads | Auth files |
| M2 | Clarity loads without Cookiebot consent | `_app.tsx:958` |
| M3 | GTM consent only denies UK — not full EEA | GTM container |
| M4 | TikTok/FB/Sojern/Reddit pixels have no consent check — **🟡 GTM workspace now shows `consentStatus: "needed"` on these tags (2026-08-20 API pull); publish status to live container unconfirmed, direct `ttq.track()` fallback still bypasses it regardless (see L3/N2)** | GTM container |

### Low — technical debt

| ID | Issue | Location |
|---|---|---|
| L1 | GTM and Clarity IDs hardcoded | `GTM.tsx`, `_document.tsx`, `_app.tsx` |
| L2 | Debug code (`window.testGTM`, console logs) in production | `GTM.tsx`, `_app.tsx` |
| L3 | Every event fires a TikTok twin unnecessarily | `gtmTracker.ts` |
| L4 | `sign_up` missing for Google/Apple OAuth new users | `callback.tsx`, `SocialSignIn.tsx` |
| L5 | Analytics window globals untyped in `global.d.ts` | `types/global.d.ts` |
| L6 | 36 legacy property-specific Google Ads actions need archiving | Google Ads |

---

## Appendix — File Map

| File | Analytics responsibility |
|---|---|
| `frontend/components/atoms/GTM.tsx` | GTM container script injection |
| `frontend/pages/_document.tsx` | Consent Mode defaults, dataLayer init, GTM noscript |
| `frontend/pages/_app.tsx` | Clarity, Tapfiliate, FreshChat init; native screen_view; route listeners |
| `frontend/utils/gtmTracker.ts` | `gtmPushEvent` and `deferGtmPushEvent` utilities + TikTok mapping |
| `frontend/utils/tapfiliate.ts` | Tapfiliate init helper |
| `frontend/utils/klaviyoTracker.ts` | Klaviyo server-side event helper (no browser tracking) |
| `frontend/utils/handleCheckoutSubmit.ts` | `add_shipping_info`, `add_payment_info` (verify still active) |
| `frontend/contexts/cartContext.tsx` | Cart events (gated by `ENABLE_CART_ANALYTICS`) |
| `frontend/pages/booking/index.tsx` | `begin_checkout` (canonical) |
| `frontend/pages/booking/payment.tsx` | `purchase` (DUPLICATE — remove), `payment_error` |
| `frontend/pages/booking/thanks.tsx` | `purchase` (canonical + dedup), Tapfiliate conversion |
| `frontend/pages/destination/[slug].tsx` | `view_item` (broken payload) |
| `frontend/pages/room/[slug].tsx` | `view_item_list` |
| `frontend/pages/tours-events/index.tsx` | `view_item_list` |
| `frontend/pages/tours-events/[slug].tsx` | `view_item`, `view_cart`, `begin_checkout` (duplicate — remove) |
| `frontend/components/molecules/CardRoomComponent.tsx` | `add_to_cart`, `remove_from_cart` |
| `frontend/components/molecules/RoomShoppingCart.tsx` | `view_cart` |
| `frontend/components/molecules/MobileRoomCart.tsx` | `view_cart` |
| `frontend/components/molecules/ToursShoppingCart.tsx` | `add_to_cart` (over-fires) |
| `frontend/components/molecules/layouts/DesktopHeader.tsx` | `navigation` |
| `frontend/components/molecules/BottomNavigationComponent.tsx` | `navigation` |
| `frontend/components/pages/LoginPage.tsx` | `login` (PII), `cta_click` |
| `frontend/components/molecules/createAccountForm.tsx` | `login`, `sign_up` |
| `frontend/components/molecules/SocialSignIn.tsx` | `login` (may send PII) |
| `frontend/pages/auth/callback.tsx` | `login` (may send PII) |
| `frontend/types/global.d.ts` | Window type declarations (incomplete — see §15 L5) |
| `parents-voucher/src/template.html` | Standalone landing page: Consent Mode default, GTM loader, `mmTrack()` push helper (see §19) |
| `lovable_pages/mm-squad-trips/index.html` | Standalone landing page: Consent Mode default, GTM loader (see §19) |
| `lovable_pages/mm-squad-trips/src/utils/gtmTracker.ts` | `gtmPushEvent`/`deferGtmPushEvent`, ported from `frontend/utils/gtmTracker.ts` |
| `lovable_pages/mm-squad-trips/src/utils/ecommerceDataLayer.ts` | GA4 `items[]` builder, `item_category4: "All In"`, `conversion_type: "all_in"` |
| `lovable_pages/mm-squad-trips/supabase/functions/charge-trip-balances/index.ts` | Server-side balance `purchase` report via GA4 Measurement Protocol (see §19.3) |

---

## 16. Testing & Debugging

### 16.1 Tools overview

| Tool | What it shows | When to use |
|---|---|---|
| GTM Preview mode | Which tags fired, which triggers matched, full dataLayer state | Before publishing any GTM change |
| GA4 DebugView | Live events as they hit GA4, with all parameters | After code changes to verify event payloads |
| Browser DevTools — Console | `window.dataLayer` contents, `window.testGTM()` helper | Quick sanity checks during development |
| Browser DevTools — Network | Raw GA4 collect requests (`/g/collect`) | Verify exact parameters sent to Google |
| Google Tag Assistant | Tag loading status, consent state, tag firing log | Diagnose GTM load failures |

---

### 16.2 GTM Preview mode

**How to enter Preview mode:**
1. Go to [tagmanager.google.com](https://tagmanager.google.com) → GTM-KC78NFHD
2. Click **Preview** (top right)
3. Enter the URL you want to test (e.g. `https://madmonkeyhostels.com`)
4. A new browser tab opens with Tag Assistant connected

**What to check in Preview mode:**

- **Tags Fired / Not Fired:** Confirm the correct tags fired for each dataLayer event
- **Variables:** Inspect the resolved value of every GTM variable (e.g. `ecommerce.value`, `ecommerce.items`)
- **dataLayer tab:** See every push in chronological order with the full object
- **Consent tab:** Verify consent signals (`analytics_storage`, `ad_storage`) are in the expected state

**Typical preview walkthrough for a booking:**

```
1. Open preview on /destination/[slug]
   → Expect: GA4 Config tag fired, view_item tag fired
   → Check: ecommerce.items has correct item_id, item_name

2. Add room to cart
   → Expect: add_to_cart tag fired
   → Check: ecommerce.value is a number (not empty string)

3. Click CONTINUE TO CHECKOUT
   → Expect: view_cart tag fired

4. Submit checkout form
   → Expect: begin_checkout tag fired (only ONCE — see §15 H3)

5. Complete payment
   → Expect: purchase tag fired on /booking/thanks
   → Check: transaction_id present, value correct
   → Confirm: purchase did NOT fire on /booking/payment (see §15 C1)
```

---

### 16.3 GA4 DebugView

**How to activate:**
1. Install the [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger) Chrome extension and enable it, **OR**
2. Add `?debug_mode=1` to the page URL (works without an extension)

**How to view:**
- GA4 Admin → property → **DebugView** (left sidebar)
- Events appear in real time with a ~2–5 second delay
- Click any event to expand all parameters

**What to verify per event:**

| Event | Parameters to check |
|---|---|
| `page_view` | `page_location` matches current URL |
| `view_item` | `value` is a number (not empty string), `items[0].item_id` is present |
| `add_to_cart` | `items[0].price` and `quantity` are correct |
| `begin_checkout` | Fires once only per checkout session |
| `purchase` | `transaction_id` present, `value` correct, fires once only |
| `login` | `user_id` is a Firebase UID (26-char alphanumeric), NOT an email address |

**Consent debugging in DebugView:**

GA4 DebugView shows a consent icon next to each event. If `analytics_storage` is denied when the event fires, the event is recorded in a consent-pending state and may be modelled rather than measured directly.

---

### 16.4 Browser console debugging

**Inspect the full dataLayer:**

```javascript
// Paste in browser console
console.table(window.dataLayer);

// See only event names in order
window.dataLayer.map(d => d.event).filter(Boolean);

// Find a specific event
window.dataLayer.find(d => d.event === 'purchase');
```

**Use the built-in GTM test helper** (available on all pages — see §15 L2 for why this should be removed from production):

```javascript
// Runs a diagnostic and pushes a test event
window.testGTM();

// Check if GTM loaded successfully
console.log(!!window.google_tag_manager?.['GTM-KC78NFHD']);

// Check current consent state
console.log(window.dataLayer.filter(d => d[0] === 'consent'));
```

**Verify TikTok pixel:**

```javascript
// Check if TikTok pixel is loaded
console.log(typeof window.ttq);           // "object" if loaded

// See TikTok events queued
console.log(window.ttq?._i);

// Check if Cookiebot has granted marketing consent
console.log(window.Cookiebot?.consent?.marketing);
```

**Verify GA4 is sending hits (Network tab):**

1. Open DevTools → Network tab
2. Filter by `collect`
3. Look for requests to `https://www.google-analytics.com/g/collect`
4. Click a request → Payload tab → inspect `en` (event name) and `ep.*` (event parameters)

---

### 16.5 Local development vs production

| Scenario | GA4 property used | GTM behavior |
|---|---|---|
| `localhost` | `G-27GXNDKYWW` (dev) | Full GTM runs; dev GA4 property receives events |
| Production domain | `G-K27E7XLRBP` (prod) | Full GTM runs; production GA4 property |
| `NEXT_PUBLIC_ENABLE_CART_ANALYTICS=true` | Either | Cart context events enabled |
| GTM Preview mode | Either | Same GTM container but tag firing is observable |

**Setting `ENABLE_CART_ANALYTICS` for local testing:**

```bash
# frontend/.env.local
NEXT_PUBLIC_ENABLE_CART_ANALYTICS=true
```

This enables the cart context events (`add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout` from `cartContext.tsx`). Keep in mind these are minimal payloads — the UI component events are richer.

---

### 16.6 Verifying consent mode in the browser

```javascript
// Check the full consent state as GTM sees it
window.dataLayer
  .filter(d => d[0] === 'consent')
  .forEach(d => console.log(d[1], d[2]));

// Expected output after user accepts all:
// "default" { analytics_storage: "denied", ad_storage: "denied", ... }
// "update"  { analytics_storage: "granted" }
// "update"  { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" }

// Check Cookiebot consent object
console.log({
  statistics: window.Cookiebot?.consent?.statistics,
  marketing:  window.Cookiebot?.consent?.marketing,
  necessary:  window.Cookiebot?.consent?.necessary,
});
```

---

## 17. How to Add a New Tracking Event

Follow these steps every time a new analytics event is needed. Going out of order (e.g. adding GTM tags before registering GA4 dimensions) means data arrives in GA4 but is silently dropped.

### Step 1 — Define the event

Answer these questions before writing any code:

| Question | Example |
|---|---|
| What user action does this represent? | User clicks "Redeem Loyalty Points" |
| What is the GA4 event name? (snake_case) | `redeem_loyalty_points` |
| Is it a GA4 ecommerce event or a custom event? | Custom |
| What parameters does it need? | `points_value`, `tier_name`, `user_id` |
| Which parameters need to be queryable in GA4 Explore? | `points_value`, `tier_name` |
| Is it a conversion (key event)? | Yes |
| Does it need to report to TikTok or other pixels? | No |

---

### Step 2 — Add the code

**a) Call `gtmPushEvent` at the right moment:**

```typescript
import { gtmPushEvent } from "@/utils/gtmTracker";

// Fire on the user action
const handleRedeemPoints = async () => {
  await api.redeemPoints(pointsAmount);

  gtmPushEvent("redeem_loyalty_points", {
    points_value: pointsAmount,
    tier_name: user.loyaltyTier,
    user_id: user.uid,             // Firebase UID only — never email
  });
};
```

**b) Clear ecommerce object first (ecommerce events only):**

```typescript
// Only needed for events that include an `ecommerce` object
window.dataLayer.push({ ecommerce: null });   // clear previous
gtmPushEvent("your_ecommerce_event", {
  ecommerce: { currency: "USD", value: 50, items: [...] }
});
```

**c) Use `deferGtmPushEvent` for non-critical events:**

```typescript
import { deferGtmPushEvent } from "@/utils/gtmTracker";

// Low-priority events that should not block user interactions
deferGtmPushEvent("page_section_view", { section: "loyalty_banner" });
```

**d) Add TypeScript types for new window globals (if needed):**

```typescript
// types/global.d.ts — only if the new event uses a new global
interface Window {
  newThirdPartyLibrary?: { track: (event: string) => void };
}
```

---

### Step 3 — Register custom dimensions / metrics in GA4

Do this **before** the code is deployed, otherwise parameters sent during the gap are permanently lost.

1. Go to **GA4 Admin → [Property] → Custom definitions**
2. For text/categorical parameters → **Custom dimensions → Create custom dimension**
   - Dimension name: human-readable (e.g. `Tier Name`)
   - Scope: `Event`
   - Event parameter: exact snake_case name used in code (e.g. `tier_name`)
3. For numeric/aggregatable parameters → **Custom metrics → Create custom metric**
   - Metric name: human-readable (e.g. `Points Value`)
   - Scope: `Event`
   - Event parameter: exact snake_case name (e.g. `points_value`)
   - Unit: `Standard` for counts, `Currency` for money values

> **Rule:** If you can sum it or average it, it's a metric. If you group or filter by it, it's a dimension.

---

### Step 4 — Create the GTM trigger

1. GTM → **Triggers → New**
2. Trigger type: **Custom Event**
3. Event name: exact event name from your `gtmPushEvent` call (e.g. `redeem_loyalty_points`)
4. This trigger fires on: **All Custom Events**
5. Save with a descriptive name: `CE - redeem_loyalty_points`

---

### Step 5 — Create or update the GTM tag

**For a GA4 event tag:**

1. GTM → **Tags → New**
2. Tag type: **Google Analytics: GA4 Event**
3. Configuration tag: select the existing GA4 Configuration tag
4. Event name: `{{Event}}` (passes through the dataLayer event name dynamically)
   — OR use a fixed name if this tag is for one specific event
5. Event parameters: add each custom parameter
   - Parameter name: `points_value` (exact)
   - Value: `{{DLV - points_value}}` (create a new Data Layer Variable if it doesn't exist)
6. Triggering: select the trigger created in Step 4
7. Save with name: `GA4 - redeem_loyalty_points`

**Creating a Data Layer Variable:**

1. GTM → **Variables → New**
2. Variable type: **Data Layer Variable**
3. Data Layer Variable Name: `points_value` (exact path, dot-notation for nested: `ecommerce.value`)
4. Save with name: `DLV - points_value`

---

### Step 6 — Mark as GA4 key event (if it's a conversion)

1. GA4 → **Admin → Events**
2. Wait for the event to appear (requires at least one real event sent to GA4 — use DebugView to trigger one)
3. Click the star icon next to the event name

> **Alternative:** GA4 Admin → **Conversions → New conversion event** → type the event name exactly. This works before any data arrives.

---

### Step 7 — Test end to end

1. **GTM Preview mode** → trigger the user action → confirm:
   - Trigger `CE - redeem_loyalty_points` matched
   - Tag `GA4 - redeem_loyalty_points` fired
   - All Data Layer Variables resolved to expected values

2. **GA4 DebugView** → trigger the action → confirm:
   - Event `redeem_loyalty_points` appears
   - All parameters visible with correct values
   - If it is a key event, the conversion icon appears

3. **Check for regressions** — re-test the purchase flow and any ecommerce events to confirm the new code did not affect existing events

---

### Step 8 — Publish GTM

1. GTM → **Submit**
2. Version name: descriptive (e.g. `Add redeem_loyalty_points event`)
3. Version notes: list what changed and why
4. **Publish**

> Never publish a GTM change without completing Step 7 in Preview mode first.

---

### Checklist summary

```
[ ] Event name defined (snake_case, descriptive)
[ ] gtmPushEvent() added at correct location in code
[ ] ecommerce: null clear added (if ecommerce event)
[ ] Custom dimensions registered in GA4 BEFORE code deployed
[ ] Custom metrics registered in GA4 BEFORE code deployed
[ ] GTM Data Layer Variables created for each new parameter
[ ] GTM Custom Event trigger created
[ ] GTM GA4 Event tag created and linked to trigger
[ ] GTM Preview mode — tag fires, variables resolve correctly
[ ] GA4 DebugView — event appears with correct parameters
[ ] GA4 key event starred (if conversion)
[ ] GTM published with descriptive version notes
[ ] Regression test: purchase flow still works correctly
```

---

## 18. Incident & Rollback Guide

### 18.1 Scenarios and responses

#### Scenario A — Wrong data sent to GA4 (bad event payload)

**Example:** A code deploy accidentally sent `value: NaN` or `user_id: email@example.com` for all purchase events for 2 hours.

**Immediate response:**
1. Identify the time window of bad data (check GA4 DebugView and the deploy timestamp)
2. Roll back the code deploy if it is still actively sending bad data
3. In GA4, create a **Data Filter** or **Exploration** to exclude the affected date range from reports

**GA4 data deletion (for PII incidents like user_id = email):**
1. GA4 Admin → Data deletion requests
2. Specify the event name (`login`) and parameter (`user_id`)
3. Google processes deletion within 63 days
4. This is required if real email addresses were sent (see §15 M1)

**Important:** GA4 data cannot be edited retroactively. Deletion is the only recourse for PII. For non-PII bad data (wrong values), document the time window so analysts can exclude it.

---

#### Scenario B — GTM tag firing incorrectly (wrong pages, wrong trigger)

**Example:** The `purchase` tag accidentally fires on every page view.

**Immediate response:**
1. GTM → find the affected tag → click the three dots → **Pause tag**
2. A paused tag is not deleted — it stops firing immediately without a full publish
3. Investigate the trigger condition that caused the mis-fire
4. Fix the trigger, unpause the tag, test in Preview mode
5. Publish with a note describing what happened

**Rolling back a GTM version:**
1. GTM → **Versions** (left sidebar)
2. Find the last known-good version
3. Click the three dots → **Publish**
4. This immediately reverts the live container to that version

---

#### Scenario C — GTM container fails to load (analytics dark period)

**Symptoms:** No events arriving in GA4, no tags firing in console, `window.google_tag_manager` is undefined.

**Diagnosis:**
```javascript
// Check if GTM script loaded
console.log('GTM loaded:', !!window.google_tag_manager?.['GTM-KC78NFHD']);

// Check for script errors
// DevTools → Console → filter for errors → look for gtm.js failures

// Check if dataLayer exists and has events
console.log('dataLayer length:', window.dataLayer?.length);
```

**Common causes:**
- Ad blocker or browser extension blocking `googletagmanager.com`
- Content Security Policy (CSP) header blocking GTM
- Network error loading `gtm.js`

**Response:**
- If CSP: add `https://www.googletagmanager.com` to `script-src` and `https://www.googletagmanager.com` to `img-src`
- If ad blocker: expected in a percentage of users — not actionable
- If GTM itself is down: rare; check [Google Workspace Status](https://www.google.com/appsstatus)

---

#### Scenario D — Conversion spike or drop in Google Ads

**Sudden spike:** Check if the duplicate purchase bug (§15 C1) was reintroduced. Also check if Count was changed to Every on a conversion action.

```javascript
// On the /booking/thanks page, check if purchase fires more than once
window.dataLayer.filter(d => d.event === 'purchase');
// Should return exactly 1 item
```

**Sudden drop:** Check:
1. GTM Preview — does the `purchase` tag still fire on `/booking/thanks`?
2. Is `sessionStorage` dedup key persisting unexpectedly? (Check: `sessionStorage.getItem('purchase_fired_...')`)
3. Did a code change alter the `transaction_id` format?
4. Is the Google Ads conversion tag still in GTM and still linked to the correct trigger?

---

#### Scenario E — Consent Mode misconfiguration causing data loss

**Symptom:** Significant drop in GA4 events after a GTM publish, especially in EU/EEA regions.

**Diagnosis:**
```javascript
// Check the consent state on page load
window.dataLayer
  .filter(d => d[0] === 'consent')
  .forEach(d => console.log(JSON.stringify(d)));

// If you see only "default" with all "denied" and no "update",
// the Cookiebot consent update is not firing
```

**Response:**
1. Check that the Cookiebot script is loading (Network tab, filter `cookiebot`)
2. Check GTM Preview → does the Cookiebot CMP tag fire?
3. Check `_document.tsx` — the `waitForCookiebot` polling function should eventually call `updateGoogleConsentFromCookiebot`
4. If the Cookiebot CDN is down: GA4 will operate in consent-denied mode until it recovers

---

### 18.2 Data quality monitoring checklist

Run this check after every code deploy that touches analytics or after every GTM publish:

```
[ ] Open /booking/thanks with a test booking → purchase fires exactly once
[ ] Open DevTools → dataLayer → no event appears more than expected
[ ] GA4 DebugView → purchase event has transaction_id (not undefined/null)
[ ] GA4 DebugView → login event has user_id that is a UID (not an email)
[ ] GTM Preview → purchase tag fires on /booking/thanks, NOT on /booking/payment
[ ] GTM Preview → begin_checkout fires exactly once per checkout
[ ] Google Ads → All Purchase conversion → check for spike/drop vs. prior day
[ ] Consent state check → analytics_storage and ad_storage update after Cookiebot accept
```

---

### 18.3 Key contacts and access

| System | Where to find |
|---|---|
| GTM container | [tagmanager.google.com](https://tagmanager.google.com) → GTM-KC78NFHD |
| GA4 property | [analytics.google.com](https://analytics.google.com) → Mad Monkey Hostels → G-K27E7XLRBP |
| Google Ads | [ads.google.com](https://ads.google.com) → account 697-007-4125 |
| Microsoft Clarity | [clarity.microsoft.com](https://clarity.microsoft.com) → project o7iu329276 |
| Cookiebot | [manage.cookiebot.com](https://manage.cookiebot.com) |
| Tapfiliate | [tapfiliate.com](https://tapfiliate.com) |

---

## 19. Standalone Landing Pages (Non-Frontend Repos)

Marketing sometimes ships a landing page as its own repo/hosting (e.g. built in Lovable, deployed to Vercel) instead of a route inside `frontend/`, to move fast without an eng bottleneck. [`docs/GSC-REDIRECT-INDEXING-REVIEW.md`](../GSC-REDIRECT-INDEXING-REVIEW.md#background-landing-page-architecture-question) flagged this pattern as risking "analytics fragmentation" if each repo bootstraps its own GTM container or GA4 property. This section is the policy that closes that gap.

### 19.1 Policy

- **Reuse `GTM-KC78NFHD` and `G-K27E7XLRBP`** (see §1 GA4 measurement IDs). Never provision a new GTM container or GA4 property for a landing page — a new one means separate reporting, a separate Google Ads bidding pool, and no shared audiences/attribution with the rest of the site.
- These repos aren't Next.js, so they can't import `GTM.tsx` / `_document.tsx` / `gtmTracker.ts` directly. Re-implement the same *pattern* by hand: Consent Mode default → `dataLayer` push → GTM loader snippet.
- Push a stable, top-level page-identifier into `dataLayer` **before** the GTM loader line, so GTM/GA4 can segment this page's hits from the rest of the site without unpacking `ecommerce`. The frontend's own convention (`_document.tsx`) pushes `user_group`; the reference implementation below uses `app_name` — either shape is fine, what matters is a stable top-level key.
- **Do not confuse that page-identifier with `site_type`** — a separate, narrower dataLayer key that `_document.tsx` sets to `'app'` only when running inside Capacitor native, and otherwise omits. It is the signal GTM's app-only GA4 tag keys off of to route events to the native app's GA4 stream (`G-WVGB07X1M6`, §9.2) instead of the web property (`G-K27E7XLRBP`); see the inline comment at `_document.tsx` ~L332. A standalone landing page that is never loaded inside the Capacitor webview should **not** set `site_type` at all — omitting it is what makes GTM's routing default to the shared web GA4 property, exactly like a normal web page load in `frontend/`. Only set `site_type: 'app'` if the page is ever embedded in the native app's in-app browser/webview.
- No separate Cookiebot `<script>` needed — the shared GTM container already carries a Cookiebot CMP tag that self-loads Cookiebot and drives Consent Mode updates once `gtm.js` loads. Adding a second Cookiebot script produces a duplicate-load console warning against this container.
- Ecommerce-shaped events only: don't manually push `page_view` (the shared container's GA4 Configuration tag auto-fires it on every hard load), and skip the TikTok twin / idle-defer machinery in `gtmTracker.ts` — out of scope for a single-purpose funnel page.
- Any conversion discriminator (the shared GA4 event tag's equivalent of `conversion_type`) must sit at the **top level of the event object, as a sibling of `ecommerce`** — not nested inside it. GA4's ecommerce parser silently drops non-standard nested fields. Mirrors `frontend/utils/bookingDataLayer.ts`'s `ConversionType` (`"room" | "tour"`) convention exactly.
- If the page calls the backend API, add its hostname to the backend CORS allowlist before pointing DNS at it (`localhost` and `*.vercel.app` are already allowed; custom domains are not).
- Wrap the `dataLayer.push` call in `try/catch` — analytics must never be able to break the page's core flow (payment, form submit, etc.).

### 19.2 Reference implementations

Three landing pages have been built under this policy so far:

| | [`parents-voucher/`](../../parents-voucher/) | [`lovable_pages/mm-squad-trips/`](../../lovable_pages/mm-squad-trips/) | [`madventure-travel/`](../../madventure-travel/) (`/ha-giang-loop` route) |
|---|---|---|---|
| Product | Gift of Travel voucher purchase | "All In" group trips (deposit + balance) | Ha Giang Loop motorbike tour — the confirmed ad-funnel target (~120 active ad variants on Google Ads customer `6970074125`, campaign `PSEARCH \| HA GIANG LOOP \| INDIA \| EVG \| SEARCH \| HA GIANG LOOP \| NONBRAND \| RETENTION \| ENGLISH \| MT_BM`) |
| Repo / hosting | Separate repo, Vercel | Separate repo, Lovable-managed (GitHub `CFSiteDesign/mm-squad-trips`) | Separate repo, Vercel — but a full Next.js app (own domain `www.madventures.travel`) with the `/ha-giang-loop` route also mounted at `madmonkeyhostels.com/ha-giang-loop`, unlike the other two single-purpose pages |
| Stack | Plain HTML + inline JS, no framework | Vite + React + TypeScript + Supabase | Next.js (Pages Router) + MUI |
| Served at | `giftvouchers.madmonkeyhostels.com` (own subdomain) | `/all-in-trips` on `madmonkeyhostels.com` (path, via Lovable custom domain) | `madmonkeyhostels.com/ha-giang-loop` (ad-facing entry is `hagianglooptour.madmonkeyhostels.com`, 301 → the above) |
| GTM container | `GTM-KC78NFHD` (shared) | `GTM-KC78NFHD` (shared, injected via `VITE_GTM_ID` env var → `%VITE_GTM_ID%` in `index.html`) | `GTM-KC78NFHD` (shared) — was already hardcoded in `_app.tsx`/`_document.tsx` before this page got event tracking; only the Consent Mode default + discriminator + events were missing |
| GA4 property | `G-K27E7XLRBP` (shared) | Same shared container's GA4 tag — see also §19.3 (Measurement Protocol) | `G-K27E7XLRBP` (shared) |
| Bootstrap location | Inline `<script>` in `src/template.html` `<head>` (rebuilt into `index.html` via `node build.mjs` — never hand-edit the generated file) | Inline `<script>` in `index.html` `<head>` | Inline `<script>` in `src/pages/_document.tsx`'s `<Head>` |
| Page/event discriminator | `{ app_name: 'gift-vouchers' }` pushed pre-GTM, plus `conversion_type: 'gift_voucher'` per event | No page-level `dataLayer` flag; `item_category4: "All In"` on every item + `conversion_type: 'all_in'` per event | `{ app_name: 'madventures' }` pushed pre-GTM (app-wide, since `_document.tsx` wraps every route), plus `conversion_type: 'madventures_ha_giang_loop'` per event on this one page — other routes in this app don't push events yet |
| `site_type` (GA4 property routing) | Not set — pure web page, never embedded in the Capacitor webview, so it correctly falls through to the web-property default (see §19.1) | Not set — same reasoning, pure web page | Not set — same reasoning |
| Event push helper | `window.mmTrack(eventName, ecommerceData)` | `src/utils/gtmTracker.ts` + `src/utils/ecommerceDataLayer.ts` — ported near-verbatim from `frontend/utils/*`, minus the TikTok twin (no TikTok Pixel on this site) | `src/utils/gtmTracker.ts` — `gtmPushEvent(eventName, ecommerce?)`, no TikTok twin (the shared container's own FB/TikTok Pixel tags key off the standard events instead) |
| Conversion discriminator | `conversion_type: 'gift_voucher'` (top-level, sibling of `ecommerce`) | `conversion_type: 'all_in'` (same convention) | `conversion_type: 'madventures_ha_giang_loop'` (same convention). **Deliberately not `hgl`/`ha_giang_loop` bare** — `GTM_CONVERSION_TAGS_BUILD_SPEC.md`'s "HGL Purchases (deferred, 6th type)" explicitly defers inventing an HGL `conversion_type` pending Kyle's input, for the *`frontend/` `purchase` event*. This page never fires `purchase` (booking hands off off-site), so there's no GTM-trigger collision either way, but the namespaced value avoids anyone mistaking this for that separate, still-undefined answer. |
| Cookiebot | Loaded by the GTM container's own CMP tag; no separate script | Same policy — a hardcoded second Cookiebot `<script>` was found and removed as a bug fix, see that repo's own [`docs/GTM_GA4_IMPLEMENTATION.md`](../../lovable_pages/mm-squad-trips/docs/GTM_GA4_IMPLEMENTATION.md) | Same policy — confirmed live via a headless-browser check against the production page (`window.Cookiebot` populated, driven entirely by the container's own CMP tag) before adding any code here |
| Events implemented | Full purchase funnel (voucher checkout completes on this page) | Deposit `purchase` client-side + balance `purchase` via Measurement Protocol (§19.3) | `view_item` (page load) only — no `purchase`, since booking always completes off-site on a WooCommerce-driven link. `begin_checkout` deliberately **not** pushed here despite the Book Now click: it only hands off to `frontend/`'s real tour page, which fires its own `begin_checkout` — pushing one here too would double-count one booking attempt under the same GA4 Key Event |
| Own docs | [`parents-voucher/README.md`](../../parents-voucher/README.md#analytics) | [`docs/GTM_GA4_IMPLEMENTATION.md`](../../lovable_pages/mm-squad-trips/docs/GTM_GA4_IMPLEMENTATION.md), [`docs/GTM_GA4_TESTING.md`](../../lovable_pages/mm-squad-trips/docs/GTM_GA4_TESTING.md) | [`madventure-travel/README.md`](../../madventure-travel/README.md#analytics) |

`parents-voucher/` domains (from [its README](../../parents-voucher/README.md#domains)):

| Host | Serves | Notes |
|---|---|---|
| `giftvouchers.madmonkeyhostels.com` | Canonical page | Production |
| `parents.madmonkeyhostels.com` | 301 → `giftvouchers.*` | Retired domain, deliberately kept alive for old shared/printed links |
| `parents-voucher.vercel.app` | Vercel preview | Staging / Stripe test mode |

`madventure-travel/` domains, confirmed live 2026-08-24 (`curl -I` + a headless-browser check against production — see `GA4-GTM-AUDIT-REPORT.md` for the general audit context, this specific check was ad-hoc and isn't itself in that file):

| Host | Serves | Notes |
|---|---|---|
| `www.madventures.travel` | The full `madventure-travel/` app (homepage listing all tours, `/itinerary/[slug]`, `/ha-giang-loop`) | Canonical app domain |
| `madmonkeyhostels.com/ha-giang-loop` | Same `/ha-giang-loop` route, same Vercel deployment (confirmed via `x-matched-path`/`x-powered-by`/`x-vercel-id` response headers) | The actual ad-facing landing page |
| `hagianglooptour.madmonkeyhostels.com` | 301 → `madmonkeyhostels.com/ha-giang-loop` | The literal final URL configured on all ~120 active Ha Giang Loop ad variants (confirmed via the `google-marketing` MCP) |

### 19.3 Server-side reporting via GA4 Measurement Protocol (`mm-squad-trips` pattern)

`mm-squad-trips` sells trips as a **deposit at booking + a balance charged later** (`supabase/functions/charge-trip-balances/index.ts`). The deposit fires a normal client-side `purchase` event, but the balance charge happens server-side, days later, with no page load to hang a `dataLayer.push` off of — so it can't reuse the GTM/`dataLayer` path at all. Instead that edge function calls the [GA4 Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4) directly:

- `POST https://www.google-analytics.com/mp/collect?measurement_id=<GA4_MEASUREMENT_ID>&api_secret=<GA4_MP_API_SECRET>` with a `purchase` event, `transaction_id: "<session_id>-balance"` (suffixed so GA4 doesn't dedupe it against the deposit's own `transaction_id` — deposit + balance are meant to sum to the full trip price), and the same `conversion_type: "all_in"` / `item_category4: "All In"` shape as the client-side events.
- Uses the visitor's own GA4 `client_id` (read from the `_ga` cookie at booking time) so the balance revenue attributes to the same visitor/session as the deposit; if no `client_id` was captured (visitor declined analytics consent), it skips rather than fabricate a client id for someone who opted out.
- **As of this writing, `GA4_MEASUREMENT_ID` / `GA4_MP_API_SECRET` are not yet provisioned as Supabase Edge Function secrets, so the call is a safe no-op in production** (`sendBalancePurchaseToGa4` short-circuits with `skipped:not_configured` if either is unset). Provisioning is a Supabase project secret, not a code change — set `GA4_MEASUREMENT_ID` to the shared prod web stream (`G-K27E7XLRBP`) and get `GA4_MP_API_SECRET` from GA4 Admin → Data Streams → that stream → Measurement Protocol API secrets.

This is the pattern to reach for whenever a standalone landing page needs to report revenue/events from a backend job, webhook, or any other context with no browser page load — not just for `mm-squad-trips`.

### 19.4 Checklist for a new standalone landing page

```
[ ] Reuse GTM-KC78NFHD and G-K27E7XLRBP — do not create a new container or property
[ ] Copy the Consent Mode default + GTM loader snippet from parents-voucher/src/template.html
    or lovable_pages/mm-squad-trips/index.html
[ ] Push a stable top-level dataLayer discriminator before the GTM loader (app_name / equivalent)
[ ] No separate Cookiebot script — confirm the shared container's CMP tag still fires (GTM Preview)
[ ] Any conversion_type / custom event lives top-level, sibling of `ecommerce`
[ ] Wrap dataLayer pushes in try/catch
[ ] New hostname added to backend CORS allowlist before DNS cutover (if the page calls the API)
[ ] Server-side/webhook revenue (no page load) → GA4 Measurement Protocol, not dataLayer (§19.3)
[ ] Verified in GTM Preview + GA4 DebugView (§16) before going live
[ ] Add a row to the table in §19.2 documenting the new page
```

---

*Documentation generated from source audit May 2026. §19 added August 2026. Keep this document updated when changing event names, parameters, or GTM configuration.*



---

# PART 4 — Roadmap, documentation & reporting

<a id="part-4"></a>


# GA4 & GTM — Roadmap, Documentation & Reporting

**Mad Monkey Hostels** · May 2026  
**Related:** [Implementation guide](./GA4-GTM-IMPLEMENTATION.md) · [Audit report](../../GA4-GTM-AUDIT-REPORT.md) · [Analytics index](./README.md)

This document captures recommended follow-ups after the May 2026 GA4/GTM audit: what to fix first, how to keep documentation and GTM in sync with code, and how to run ongoing reporting and quality checks.

---

## Table of contents

1. [Priority summary](#1-priority-summary)
2. [Documentation & process](#2-documentation--process)
3. [Reporting & monitoring](#3-reporting--monitoring)
4. [Engineering quality](#4-engineering-quality)
5. [Compliance](#5-compliance)
6. [Nice-to-have / later](#6-nice-to-have--later)
7. [Suggested phase 2 bundle](#7-suggested-phase-2-bundle)
8. [PR checklist (analytics changes)](#8-pr-checklist-analytics-changes)
9. [Ownership matrix](#9-ownership-matrix)
10. [Weekly reporting checklist](#10-weekly-reporting-checklist)
11. [Quarterly re-audit](#11-quarterly-re-audit)

---

## 1. Priority summary

| Priority | Item | Owner | Est. effort | Status |
|---|---|---|---|---|
| P0 | Remove duplicate `purchase` from `payment.tsx` (audit C1) | Dev | 1 hr | ✅ Live |
| P0 | Mark `purchase` as GA4 key event (C3) | GA4 admin | 5 min | ✅ Live |
| P0 | Wire `add_to_cart` + `begin_checkout` in Google Ads goals (C2) | Ads | 20 min | ✅ Fixed 2026-08-19 (27/4,708 account-default, both Active) |
| P0 | Demote dead UA + Wheelofpopups Primary actions (C4) | Ads | 15 min | ✅ Fixed, confirmed via Ads API 2026-08-20 |
| P0 | Stop sending email as `user_id` (M1) | Dev | 1 hr | ✅ Live 2026-08-19 |
| P1 | Sprint 1 audit items (H1–H7, M2–M4) | Dev / GTM / GA4 / Ads | ~1–2 days | Mostly ✅ Live; **M4 needs re-check** — GTM workspace now shows `consentStatus: "needed"` on TikTok/FB/Sojern/Reddit tags (2026-08-20), publish status unconfirmed; H7/L6 still open (Ads UI) |
| P2 | Documentation process + GTM in git (this doc §2) | Engineering | ~2 hrs |
| P2 | Weekly reporting ritual (this doc §10) | Marketing / ops | Ongoing |
| P3 | Server-side purchase, E2E smoke, BigQuery | Engineering | Project-sized |

Full issue detail and code snippets: [GA4-GTM-AUDIT-REPORT.md](../../GA4-GTM-AUDIT-REPORT.md).

---

## 2. Documentation & process

### 2.1 Keep docs linked from the umbrella repo

- **Done:** `docs/analytics/README.md` (this index), implementation guide, audit report at repo root.
- **Maintain:** Add a line to [ARCHITECTURE.md](../../ARCHITECTURE.md) under Monitoring & Analytics pointing to `docs/analytics/`.
- **On change:** When adding/removing events or GTM tags, update:
  - [GA4-GTM-IMPLEMENTATION.md](./GA4-GTM-IMPLEMENTATION.md) §5 (event catalog) and relevant flow section
  - Audit report only if a *new* known issue is discovered (or mark an issue resolved)

### 2.2 PR template — analytics change checklist

Add the checklist in [§8](#8-pr-checklist-analytics-changes) to:

- `frontend/.github/PULL_REQUEST_TEMPLATE.md`, or
- A dedicated `docs/analytics/PULL_REQUEST_ANALYTICS.md` linked from the main PR template

Require it for any PR touching:

- `gtmTracker.ts`, `GTM.tsx`, `_document.tsx`, `_app.tsx`
- `pages/booking/*`, cart components, auth login/sign-up flows
- GTM export JSON under `docs/analytics/gtm/` (if adopted)

### 2.3 Cursor / agent rule (optional)

Add a workspace rule (e.g. `.cursor/rules/analytics-gtm.mdc`) so agents and developers consistently:

- Use `gtmPushEvent` / `deferGtmPushEvent` only; no ad-hoc `gtag` for product events unless consent bridge
- Never set `user_id` to email — Firebase UID only
- Single canonical fire point for `purchase` (`thanks.tsx`) and `begin_checkout` (`booking/index.tsx`)
- Follow [§17 of the implementation guide](./GA4-GTM-IMPLEMENTATION.md#17-how-to-add-a-new-tracking-event) for new events

### 2.4 Ownership matrix

Define who can publish what (see [§9](#9-ownership-matrix)). Avoid “everyone thought someone else published GTM.”

### 2.5 Version-control GTM container exports

**Recommendation:** After each GTM publish, export the workspace and commit:

```
docs/analytics/gtm/
  GTM-KC78NFHD_workspace_vNN.json   # dated or versioned filename
  CHANGELOG.md                        # one line per publish: date, author, summary
```

**Benefits:**

- PR-reviewable tag/trigger changes
- Fast rollback reference (which JSON matched production on date X)
- Diff against code audit when debugging

**Process:**

1. GTM → Admin → Export container → choose workspace version
2. Save to `docs/analytics/gtm/`
3. Update `CHANGELOG.md`
4. Open PR with label `analytics-gtm` (optional)

### 2.6 Ghost GTM cleanup (documentation + GTM)

Document and remove unused GTM triggers that have no frontend event:

| GTM trigger event | Frontend status | Action |
|---|---|---|
| `mad_loyalty` | Not pushed in code | Pause tag or implement event |
| `newsletter_sign_up` | Not pushed in code | Pause tag or implement event |

### 2.7 Environment variables (recommended)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_GTM_ID` | Replace hardcoded `GTM-KC78NFHD` |
| `NEXT_PUBLIC_CLARITY_ID` | Replace hardcoded Clarity project id |
| `NEXT_PUBLIC_ENABLE_CART_ANALYTICS` | Already exists; document in `.env.example` |

Add entries to `frontend/.env.example` with comments pointing to the implementation guide.

---

## 3. Reporting & monitoring

### 3.1 Goals

- **Trust:** Reported conversions align with internal booking counts
- **Speed:** Detect breaks within 24–48 hours of deploy or GTM publish
- **Compliance:** EU traffic respects consent before ads/analytics pixels fire

### 3.2 Core metrics to reconcile weekly

| Metric | GA4 source | Internal source | Healthy signal |
|---|---|---|---|
| Purchases (count) | Event `purchase`, key event | Confirmed bookings DB / Stripe | Ratio ~1:1 after C1 fix |
| Purchase revenue | `purchase` `value` sum | Finance / Stripe settled | Within agreed tolerance (e.g. ±5%) |
| Begin checkout | Event `begin_checkout` | Checkout sessions started | Funnel shape stable week-over-week |
| Add to cart | Event `add_to_cart` | Optional: cart API | No sudden 3x spike (H2/H3) |
| Google Ads conversions | All Purchase action | GA4 `purchase` | Align after dedup fix |

**Note:** Until C1 is fixed, expect Google Ads purchase count ≈ **2×** GA4 or internal bookings for embedded-checkout paths.

### 3.3 GA4 reports to use

| Report / tool | Use for |
|---|---|
| **Realtime** | Immediate post-deploy smoke |
| **DebugView** | Parameter validation during development |
| **Explorations → Funnel** | `view_item` → `add_to_cart` → `begin_checkout` → `purchase` |
| **Explorations → Free form** | Segment by `user_group`, `reservation_id`, device |
| **Admin → Events** | Key events, new event registration |
| **Admin → Data display → Filters** | Exclude internal/test traffic if IP or debug params defined |

### 3.4 Google Ads reporting

| View | Check |
|---|---|
| Goals → Conversions | Purchase primary; add_to_cart / begin_checkout assigned (after C2) |
| Campaigns → Conversions column | Week-over-week; investigate spikes after deploy |
| Attribution → Conversion paths | After funnel goals fixed, validate assisted conversions |

### 3.5 Recommended alerts (manual or automated)

| Alert | Condition | Action |
|---|---|---|
| Purchase drop | GA4 `purchase` count &lt; 70% of 7-day avg | Check thanks page, GTM publish, Stripe |
| Purchase spike | Google Ads conversions &gt; 150% of 7-day avg | Check duplicate `purchase` (C1), GTM tag |
| Zero begin_checkout | 0 events for 24h on prod | Check `booking/index.tsx` deploy |
| Consent regression | High % sessions with only `consent: default` denied | Cookiebot / GTM region config (M3) |

Automation options: GA4 custom insights email, Google Ads custom alerts, or a scheduled script comparing GA4 Data API to internal booking count.

### 3.6 GA4 → BigQuery export (recommended)

**Why:** Explore-level analysis of `reservation_id`, `original_value`, and funnel drop-offs without sampling limits; easier to join to internal warehouse.

**Setup (GA4 Admin):**

1. Admin → Product links → BigQuery → Link
2. Enable daily export (and streaming if budget allows)
3. Document dataset name in this file once created

**Example analyses once linked:**

- True revenue: `SUM(ecommerce.purchase_revenue_in_usd)` by `reservation_id`
- Duplicate purchases same day: count `transaction_id` with `COUNT(*) > 1`
- Pre/post discount: compare `original_value` vs `value` after H6 metric fix

### 3.7 Microsoft Clarity

Use for UX debugging only — not for conversion reporting. After M2 fix, expect lower session volume in EU (consent-gated). Review heatmaps on key paths: destination → room → checkout → payment.

### 3.8 Tapfiliate vs GA4

Tapfiliate conversions are independent of GTM. Reconcile affiliate bookings separately; do not use Tapfiliate as source of truth for GA4 purchase validation.

---

## 4. Engineering quality

### 4.1 Centralize event names

Create `frontend/constants/analyticsEvents.ts` (or similar):

```typescript
export const AnalyticsEvents = {
  PURCHASE: "purchase",
  BEGIN_CHECKOUT: "begin_checkout",
  ADD_TO_CART: "add_to_cart",
  // ...
} as const;
```

Use constants in all `gtmPushEvent` calls to prevent typos and orphan GTM triggers.

### 4.2 Server-side `purchase` (longer-term)

Send one `purchase` from the backend after booking confirmation:

- **Pros:** Immune to double client fire, ad blockers, tab close before thanks page
- **Cons:** Measurement Protocol or server GTM setup, idempotency on `reservation_id`
- **Parameter:** Use same `transaction_id` / `reservation_id` as client for dedup if both exist during migration

### 4.3 E2E analytics smoke test

Playwright/Cypress flow:

1. Mock or complete test checkout
2. Land on `/booking/thanks`
3. Assert `window.dataLayer.filter(d => d.event === 'purchase').length === 1`

Guards against regression of C1.

### 4.4 Limit TikTok twin pushes (L3)

Only map the six ecommerce events in `gtmTracker.ts`; see audit appendix A.8.

---

## 5. Compliance

| Item | Audit ID | Action |
|---|---|---|
| Email as `user_id` | M1 | UID only; request GA4 data deletion if emails were sent |
| Clarity without consent | M2 | Gate on `Cookiebot.consent.statistics` |
| EEA consent defaults | M3 | Expand denied-by-default regions in GTM Cookiebot tag |
| Ad pixels without consent | M4 | `ad_storage` required on TikTok, FB, Sojern, Reddit tags — GTM workspace pull (2026-08-20) shows this is now configured (`consentStatus: "needed"`); **confirm it's published to the live container**, and note the direct `ttq.track()` fallback in `gtmTracker.ts` bypasses it regardless (L3/N2) |

Document consent state in privacy policy / DPA reviews when changing tags.

---

## 6. Nice-to-have / later

| Item | Benefit |
|---|---|
| Archive 36 legacy property-specific Ads actions (L6) | Cleaner account |
| Standardize `nav_name` casing | Reliable navigation reports |
| Remove `window.testGTM` from production (L2) | Less noise and exposure |
| `sign_up` for OAuth new users (L4) | Accurate acquisition |
| Fix `GA4 - Outbound Click - Wise` hardcoded measurement ID | Consistent env routing |
| Quarterly re-audit | Catch config drift |

---

## 7. Suggested phase 2 bundle

If you can only do one coordinated pass after Week 1 fixes:

1. Execute **Week 1 audit fixes** (C1–C4, M1) — ✅ done as of 2026-08-20
2. Add **PR analytics checklist** (§8) to frontend PR template
3. **Commit GTM export** to `docs/analytics/gtm/` + `CHANGELOG.md`
4. **Link** `docs/analytics/` from `ARCHITECTURE.md`
5. Start **weekly reporting checklist** (§10) with marketing/ops

Estimated engineering time: ~2–4 hours excluding P0 code fixes.

---

## 8. PR checklist (analytics changes)

Copy into pull requests that touch tracking:

```markdown
## Analytics checklist

- [ ] Event name is snake_case and documented in `docs/analytics/GA4-GTM-IMPLEMENTATION.md` §5
- [ ] Fired via `gtmPushEvent` / `deferGtmPushEvent` (not duplicate raw `dataLayer.push` unless justified)
- [ ] `user_id` is Firebase UID only (never email)
- [ ] Ecommerce events: `ecommerce: null` clear before payload where applicable
- [ ] `purchase` only from `pages/booking/thanks.tsx` (not `payment.tsx`)
- [ ] `begin_checkout` only from `pages/booking/index.tsx` (not tour slug early fire)
- [ ] New GA4 custom dimensions/metrics registered **before** merge (if new parameters)
- [ ] GTM: trigger + tag created/updated; tested in **Preview mode**
- [ ] GA4 **DebugView**: event + parameters verified
- [ ] No new production `console.log` / `window.testGTM` without `NODE_ENV` guard
- [ ] GTM export committed to `docs/analytics/gtm/` if container published (if using §2.5)
- [ ] Regression: one test booking → single `purchase` on thanks page
```

---

## 9. Ownership matrix

Fill in names/contacts for your team:

| Area | Responsibility | Can publish without code deploy? | Backup |
|---|---|---|---|
| Frontend tracking code | | No — requires deploy | |
| GTM container `GTM-KC78NFHD` | | Yes — GTM publish | |
| GA4 property `G-K27E7XLRBP` | | Yes — Admin | |
| GA4 custom dimensions/metrics | | Yes — Admin | |
| Google Ads `697-007-4125` | | Yes — Ads UI | |
| Cookiebot consent config | | Yes — Cookiebot + GTM | |
| Microsoft Clarity | | Yes — Clarity + code (M2) | |
| Tapfiliate | | Yes — Tapfiliate dashboard | |
| This documentation | | PR to `docs/analytics/` | |

**Escalation:** Conversion count wrong → Dev (code) + Ads (goals) + GTM admin same day.

---

## 10. Weekly reporting checklist

Run every **Monday** (or first business day after a release week). Owner: _______________

### Data pull (15 min)

- [ ] GA4 → Reports → Engagement → Events: `purchase` count (last 7 days vs prior 7 days)
- [ ] GA4 → Monetization → Ecommerce purchases: revenue trend
- [ ] Google Ads → Goals → Conversions: All Purchase count and value (last 7 days)
- [ ] Internal: confirmed bookings count for same period (Stripe or ops report)

### Reconciliation

- [ ] `purchase` (GA4) ÷ internal bookings = ______ (target ~1.0 after C1 fix; ~2.0 if C1 unfixed)
- [ ] Google Ads purchases ÷ GA4 purchases = ______ (document if Ads uses Every + duplicates)
- [ ] Note any deploy or GTM publish dates in the week: _______________

### Quality spot-check

- [ ] DebugView or Tag Assistant: one manual `purchase` on staging or prod test booking — single fire
- [ ] `login` events: spot-check `user_id` is not email-shaped (no `@` in value)
- [ ] Consent: sample EU VPN session — statistics/marketing only after banner accept

### Actions

| Finding | Owner | Ticket |
|---|---|---|
| | | |

### Sign-off

- Reviewed by: _______________ Date: _______________

---

## 11. Quarterly re-audit

Every **3 months** (or after major checkout/auth refactor):

1. Re-export GTM container → diff against `docs/analytics/gtm/`
2. Screenshot GA4: key events, custom definitions, data streams (Enhanced Measurement)
3. Screenshot Google Ads: conversion goals and Primary/Secondary actions
4. Grep frontend for `gtmPushEvent` and compare to implementation doc §5
5. Update [GA4-GTM-AUDIT-REPORT.md](../../GA4-GTM-AUDIT-REPORT.md) — close resolved issues, add new ones
6. Update implementation guide if architecture changed

---

*Maintained with the analytics documentation set. Update this roadmap when priorities or owners change.*



---

# PART 5 — PR checklist

<a id="part-5"></a>


# Pull request — analytics checklist

Use this checklist when the PR touches Google Tag Manager, GA4 events, booking/checkout tracking, or auth `login` / `sign_up` events.

**Docs:** [Implementation guide](./GA4-GTM-IMPLEMENTATION.md) · [How to add an event](./GA4-GTM-IMPLEMENTATION.md#17-how-to-add-a-new-tracking-event) · [Roadmap](./GA4-GTM-ROADMAP-AND-REPORTING.md)

---

## Code

- [ ] Event name is `snake_case` and documented in `docs/analytics/GA4-GTM-IMPLEMENTATION.md` §5
- [ ] Uses `gtmPushEvent` or `deferGtmPushEvent` (no duplicate raw `dataLayer.push` unless justified)
- [ ] `user_id` is Firebase UID only — **never email**
- [ ] Ecommerce events: `ecommerce: null` clear before payload where applicable
- [ ] `purchase` fires only from `pages/booking/thanks.tsx` (not `payment.tsx`)
- [ ] `begin_checkout` fires only from `pages/booking/index.tsx` (not early on tour slug page)
- [ ] No new production `console.log` / `window.testGTM` without `NODE_ENV !== 'production'` guard

## GA4 / GTM admin (if applicable)

- [ ] New parameters registered as GA4 custom dimension or metric **before** merge
- [ ] GTM trigger + tag created or updated
- [ ] Tested in GTM **Preview mode**
- [ ] Verified in GA4 **DebugView**

## GTM publish (if container changed)

- [ ] GTM export committed to `docs/analytics/gtm/` with entry in `CHANGELOG.md`

## Regression

- [ ] Test booking completes → exactly **one** `purchase` on thanks page (`dataLayer` or DebugView)



---

# PART 6 — GTM container changelog

<a id="part-6"></a>


# GTM container changelog — GTM-KC78NFHD

Record each production publish here. Export JSON to this folder after publishing (see [Roadmap §2.5](../GA4-GTM-ROADMAP-AND-REPORTING.md#25-version-control-gtm-container-exports)).

| Date | Version / export file | Author | Summary |
|---|---|---|---|
| 2026-05 | `GTM-KC78NFHD_v34.json` (external audit export) | — | Baseline audited in May 2026 GA4/GTM audit |

## How to add an entry

1. GTM → **Admin** → **Export container** → export workspace version
2. Save as `GTM-KC78NFHD_vNN.json` in this directory
3. Add a row above with date, filename, your name, and a one-line summary of tag/trigger/variable changes

