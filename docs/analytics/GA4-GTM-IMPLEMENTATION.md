# Mad Monkey Hostels — GA4 & GTM Implementation Documentation

**Version:** Based on GTM-KC78NFHD v34 · GA4 G-K27E7XLRBP  
**Frontend stack:** Next.js 14 (Pages Router) + Capacitor (iOS / Android)  
**Last updated:** May 2026  
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
| TikTok Pixel | NOT_SET (fires regardless — see §15 M4) |
| Facebook Pixel | NOT_SET (fires regardless — see §15 M4) |
| Sojern | NOT_SET (fires regardless — see §15 M4) |
| Reddit | NOT_SET (fires regardless — see §15 M4) |
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
    currency: "USD",            // uppercase ISO 4217 — the customer's actual charge currency (multi-currency site, not fixed to USD)
    value: number,              // total value
    coupon?: string,            // coupon code if applied
    transaction_id?: string,    // purchase events only
    items: [
      {
        item_id: string,        // property/room/tour ID
        item_name: string,      // display name
        item_category: string,  // "Accommodation" | "Tour"
        item_category2?: string, // destination country
        item_category3?: string, // property/hostel name, e.g. "Mad Monkey Dumaguete" — added 2026-07-16
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
| `contexts/cartContext.tsx` (`addItemToCart`) | After the cart-add API call succeeds, for every room/tour/addon add site-wide | **Sole source as of 2026-07-16** (fixed — see below). Item-rich payload built from the API response; `item_type` still included for addons since the Cart response carries no addon pricing to build a proper `items[]` from |
| `components/molecules/ToursShoppingCart.tsx` | **On every `adultCount` change** | **Over-fires — known issue §15 H2** (unrelated to the 2026-07-16 fix below) |

**Fixed 2026-07-16** (`fix/ga4-currency-value-correctness`): this event used to double-fire — the shared `cartContext.tsx` handler pushed a minimal payload (`value` = the **whole cart's running total**, no `items[]`, lowercase `currency`), and `CardRoomComponent.tsx`/the tours flow (`useTourBooking.ts`) each pushed a **second**, richer event right after. Fixed by making the shared handler look up the specific line just added from the API response and build a correct single-item payload (reusing `buildGa4Item` from `utils/ecommerceDataLayer.ts`), then removing the now-redundant component-level pushes. `value` is now always uppercase `currency` and just the item(s) added in *this* event, not the cart total.

```typescript
gtmPushEvent("add_to_cart", {
  ecommerce: {
    currency: "USD",             // uppercase — normalized from the cart's raw (lowercase) currency field
    value: room.price * quantity, // just the item(s) added in this event, not the running cart total
    item_type: "cloudbeds",       // "cloudbeds" | "rezdy" | "addon"
    items: [
      {
        item_id: room.room_id,
        item_name: room.room_name,
        item_category: "Accommodation",
        item_variant: room.room_name,
        price: room.unit_price,
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
| `contexts/cartContext.tsx` (`removeItemFromCart`) | After the cart-remove API call succeeds, for every room/tour removal site-wide | **Sole source as of 2026-07-16** (fixed — see below). Matches the removed line against the pre-removal cart snapshot to build a proper `items[]`; addons still send `item_id` only (no addon pricing available to match) |

**Fixed 2026-07-16**: previously sent only `{ item_id }` — no `currency`/`value`/`items[]` at all — while `CardRoomComponent.tsx` separately pushed a second, richer event for room removals specifically (tours had no equivalent, so tour removals were undercounted). Fixed the same way as `add_to_cart` above and removed the redundant component-level push.

```typescript
gtmPushEvent("remove_from_cart", {
  ecommerce: {
    item_id: itemId,
    currency: "USD",              // uppercase
    value: room.unit_price * quantity,
    items: [
      {
        item_id: room.room_id,
        item_name: room.room_name,
        item_category: "Accommodation",
        price: room.unit_price,
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
| `contexts/cartContext.tsx` | `checkoutCart()` call | **Gated** — minimal, no items. `currency` uppercased as of 2026-07-16 (was sent raw/lowercase) |

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
    currency: "USD",   // uppercase — fixed 2026-07-16 (`contexts/cartContext.tsx` and `pages/booking/index.tsx`
                        // previously sent the cart's raw, lowercase `currency` field directly)
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
      currency: "USD",              // uppercase; reflects the customer's actual charge currency, not always USD
      value: booking.total,
      coupon: booking.couponCode,
      original_value: booking.subtotal,     // pre-discount total
      reservation_id: booking.reservationId,
      items: booking.items.map(item => ({
        item_id: item.propertyId,
        item_name: item.name,
        item_category: item.type,        // "Accommodation" | "Tour"
        item_category2: item.country,    // destination country
        item_category3: item.propertyName, // e.g. "Mad Monkey Dumaguete" — added 2026-07-16
        price: item.price,
        quantity: item.quantity,
        discount: item.discount,
        coupon: item.couponCode,
      }))
    }
  });
}
```

**Multi-property orders (fixed 2026-07-16):** a single order can span more than one property (the "add a stop" checkout upsell). `items[]` is built from the confirmation response's `bookings[]` array (one entry per property, each with its own `destination`), not the flat top-level summary — a prior bug read only the flat summary and silently dropped every property's rooms except the anchor from `items[]` while `value` (sourced from `grandTotals.total`) already correctly included all of them. See `frontend/pages/booking/thanks.tsx` `lineItems` and `playwright-verify/verify-multiproperty-item-category3-local.mjs`.

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
| `currency` | Customer's actual charge currency (uppercase ISO 4217) — multi-currency, not fixed to USD | Standard |

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
**Consent check:** None — `consentSettings: NOT_SET` in GTM (§15 M4)

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
**Consent check:** None — `consentSettings: NOT_SET` in GTM (§15 M4)

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
**Campaigns:** 4,708 active campaigns

### 13.1 Conversion goals

| Goal | Primary conversion actions | Status |
|---|---|---|
| Purchase | All Purchase | Active, Count: Every |
| Add to cart | (none assigned) | **Misconfigured (§15 C2)** |
| Begin checkout | (none assigned) | **Misconfigured (§15 C2)** |
| Other | BCY_Booking, PP_Booking, Wheelofpopups_lead | **Dead signals (§15 C4)** |

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
| C1 | Duplicate `purchase` event doubles Google Ads conversions | `pages/booking/payment.tsx:86` |
| C2 | Add to cart and Begin checkout goals have 0 actions in Google Ads | Google Ads |
| C3 | `purchase` not marked as GA4 key event | GA4 Admin |
| C4 | Dead UA sources (BCY/PP Booking) + Wheelofpopups as Primary in 32 campaigns | Google Ads |
| C5 | `calendar_booking_search_submit` key event never fires — unimplemented | Dev / GA4 |

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
| M4 | TikTok/FB/Sojern/Reddit pixels have no consent check | GTM container |

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

*Documentation generated from source audit May 2026. Keep this document updated when changing event names, parameters, or GTM configuration.*
