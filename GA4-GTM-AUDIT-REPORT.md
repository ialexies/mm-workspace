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

## Fix Status (updated 2026-07-01)

**Legend:** ✅ Live (in production) · 🟡 Fixed in branch, pending prod deploy (`bugfix/sp12-analytics-gtm-fixes` + earlier) · ⚙️ GA4/GTM/Ads config done · ⛔ Blocked on admin access · ⬜ Not started · ⏭️ Deferred

| # | Issue | Status | Notes |
|---|---|---|---|
| C1 | Duplicate `purchase` | ✅ Live | `payment.tsx` no longer fires it |
| C2 | Mid-funnel goals 0 actions | ⛔ Blocked | `add_to_cart`/`begin_checkout` are GA4 key events; only the **app** versions imported. Need the **web** property `G-K27E7XLRBP` conversion import enabled on the GA4↔Ads link (Data Manager → Manage) — no self-serve access |
| C3 | `purchase` not key event | ✅ Live | Confirmed key event in GA4 |
| C4 | Dead UA/popup Primary | ✅ Live | Removed in Ads UI |
| C5 | Dead `calendar_booking_search_submit` | ✅ Resolved | `purchase` is the working key event; dead event removed |
| H1 | SPA `page_view` | 🟡 + ⚙️ | Code committed; GTM tag **published**; GA4 EM history-changes off; verified on staging. Pending prod deploy. See `frontend/docs/analytics/SPA_PAGE_VIEW_H1.md` |
| H2 | `add_to_cart` over-fires | 🟡 | Tours reworked to fire once on tour-add; rooms verified correct. Pending prod deploy |
| H3 | `begin_checkout` 2–3× | ✅ Live | `markCheckoutEventOnce` dedup — verified on staging: rooms checkout emits exactly **1** `begin_checkout` (0 on page load, 1 on CONFIRM & PAY). All 3 sources share the same dedup key |
| H4 | `view_item` empty prices | 🟡 | Real starting price sent. Pending prod deploy |
| H5 | `app_page_location` not registered | ⬜ | GA4 custom dimension |
| H6 | `original_value` text not metric | ⏭️ | Deferred (off-goal; needs archiving a live dimension) |
| H7 | Swapped iOS/Android labels | ⬜ | Ads UI |
| M1 | Email as `user_id` (PII) | 🟡 | Code fixed — all auth paths now send Firebase UID; verified on staging (`login` emits UID). Pending prod deploy |
| M2 | Clarity without consent | ⬜ | Code |
| M3 | GTM consent UK-only | ⬜ | GTM |
| M4 | Ad pixels without consent | ⬜ | GTM (the "32 tags not configured for consent" warning) |
| L4 | `sign_up` missing for OAuth new users | 🟡 | Code fixed — Google/Apple OAuth paths now fire `sign_up` (UID only) when `getAdditionalUserInfo().isNewUser`. Pending prod deploy |
| L1–L3, L5–L6 | Technical debt | ⬜ | Not started |

**New work this sprint (beyond the original 23):**
- **Paid-ad attribution loop** — site-wide durable capture of `gclid`/`fbclid`/`ttclid`/UTMs → checkout metadata (Stripe) → `purchase` event identity. 🟡 in branch, verified on staging.
- **Self-referral fix** — GA4 Unwanted referrals (✅ live, both web streams) + Conversion Linker `linkerDomains` cleaned (⚙️ published 2026-07-01).
- **Enhanced Conversions foundation** — `customer_email`/`customer_phone` on `purchase`, GTM DLVs + `UPD - Enhanced Conversions` (⚙️ published). Ads-UI activation pending — see `frontend/docs/analytics/ENHANCED_CONVERSIONS_FOLLOWUP.md`.
- **Funnel-hygiene test suite** — `playwright-verify/` (attribution, view_item, add_to_cart tours/rooms, SPA page_view) with HTML report + video.

**Separate issue found (not in the 23):** tours `/booking/thanks` `hasSummary:false` — `purchase` doesn't fire on the tours embedded-checkout path; under-counts tours conversions. Needs its own ticket.

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
