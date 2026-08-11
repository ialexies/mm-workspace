# GTM Conversion Tags Build Spec — per-conversion-type tracking for Google Ads, Meta, TikTok, GA4

**Status:** Ready to build in GTM. Nothing in this doc has been published to the live container — it's a
precise spec for whoever has `GTM-KC78NFHD` access (Kyle or the agency) to implement tag-by-tag.

**Why:** the ad platforms and GA4 currently only see one generic `purchase` conversion. There's no way to
tell Google Ads, Meta, or TikTok which purchase type (room booking, tour, surf camp, gift voucher, ALL IN
group trip) drove a given conversion, so campaigns can't be optimized or reported per product line.

## Before you build: what's already there

- **The Meta Pixel (`1689683661798465`) and TikTok Pixel (`D095O0BC77U0QQJ07KTG`) are already installed**
  as tags in `GTM-KC78NFHD` (see §11.1 of [GA4-GTM-IMPLEMENTATION.md](./GA4-GTM-IMPLEMENTATION.md)) and
  already fire on every page of every property that loads this container (main site, `parents-voucher/`,
  `lovable_pages/mm-squad-trips/`) via the built-in "All Pages" trigger — no hostname restriction anywhere
  in the container. Pixel *presence* is not the gap here; **conversion-type granularity is.**
- The existing `FBP Purchase Tag (…1798465) - V2`, `TikTok - All Events`, and `Google Ads - Purchase` tags
  already fire on `purchase` from **all three** properties, including `parents-voucher` (Parent Vouchers)
  and `mm-squad-trips` (ALL IN) — both push a literal `event: "purchase"` with a matching
  `ecommerce: {value, currency, transaction_id, items[]}` shape. So today, before any of this is built,
  those two products already register as generic "All Purchases" conversions on every platform — they're
  just not broken out. This contradicts `mm-squad-trips`'s own code comment ("no TikTok Pixel is
  provisioned for this site") — TikTok's `event equals purchase`-style trigger has no hostname filter and
  catches it anyway.
- **Known open bug (M4, see [`frontend/docs/analytics/M4_AD_PIXEL_CONSENT.md`](../../frontend/docs/analytics/M4_AD_PIXEL_CONSENT.md)):**
  all ad pixel tags fire regardless of Cookiebot consent state (`consentSettings: NOT_SET`), re-confirmed
  firing with consent denied on staging 2026-07-03. **Every new tag in this spec must be consent-gated
  from the start** — see §5. Don't copy the existing tags' un-gated config.
- No GTM/Ads/Meta API access was available to build this directly — everything below is a spec to
  hand-implement, not something already pushed live.

## Frontend prerequisite (done)

`frontend/utils/ecommerceDataLayer.ts` now sets `item_category: "Surf Camp"` (not `"Tour"`) for tours whose
name/slug matches `isSurfCampTour()`, on branch `feature/gtm-conversion-tracking` — so "Tour" and "Surf
Camp" are mutually exclusive at the item level and can be told apart with a single equality check. No other
frontend changes are required: `conversion_type` (`room` / `tour` / `gift_voucher` / `all_in`),
`item_category` (`Accommodation` / `Tour` / `Surf Camp` / `Gift Voucher`), and the standard
`ecommerce.value` / `currency` / `items[]` fields already carry everything the tags below key off of.

**Known consequence:** any existing GA4 report/audience filtering `item_category == "Tour"` no longer
includes surf camp bookings going forward (historical rows are unaffected — this only changes new data).

## 1. New/reused variables

| Variable | Type | Value |
|---|---|---|
| `ecommerce.items`, `ecommerce.value`, `ecommerce.currency`, `ecommerce.transaction_id` | Data Layer Variable | already exist per §11.3 of the Implementation doc — reuse, don't recreate |
| `conversion_type` | Data Layer Variable | **new** — key `conversion_type` (top-level, sibling of `ecommerce`, already pushed by the frontend on every `purchase` event) |
| `Purchase Has Accommodation Item` | Custom JavaScript | `function(){var i={{ecommerce.items}};return Array.isArray(i)&&i.some(function(x){return x&&x.item_category==='Accommodation';});}` |
| `Purchase Has Tour Item` | Custom JavaScript | same pattern, `item_category==='Tour'` |
| `Purchase Has Surf Camp Item` | Custom JavaScript | same pattern, `item_category==='Surf Camp'` |
| `Purchase Content IDs` | Custom JavaScript | `function(){var i={{ecommerce.items}}||[];return i.map(function(x){return x&&x.item_id;});}` — feeds Meta/TikTok `content_ids` |

The three "Has X Item" variables exist because a single `purchase` event can carry multiple line items of
mixed category (multi-room, mixed cart) — a plain Data Layer trigger can't inspect array contents, only a
Custom JavaScript variable can. Parent Voucher/ALL IN don't need this treatment: `conversion_type` is
already a single top-level value set once per event, so a direct equality trigger is enough.

## 2. New triggers

All are **Custom Event** triggers, base condition `event` equals `purchase`, plus one extra condition:

| Trigger name | Extra condition |
|---|---|
| `Purchase - All` | *(none — this is the existing `purchase` trigger, reused as-is)* |
| `Purchase - Hostel` | `{{Purchase Has Accommodation Item}}` equals `true` |
| `Purchase - Tour` | `{{Purchase Has Tour Item}}` equals `true` |
| `Purchase - Surf Camp` | `{{Purchase Has Surf Camp Item}}` equals `true` |
| `Purchase - Parent Voucher` | `{{conversion_type}}` equals `gift_voucher` |
| `Purchase - All In` | `{{conversion_type}}` equals `all_in` |

## 3. Tag pattern — spelled out once for Hostel, repeat per type

For **each** of the 5 conversion types (Hostel, Tour, Surf Camp, Parent Voucher, ALL IN), build 4 tags, one
per destination, firing on that type's trigger from §2. Below is the full spec for Hostel; the other four
follow the identical pattern with only the trigger and event/custom-event name changed (see the table at
the end of this section).

### GA4 Event tag

- **Name:** `GA4 - Event - Purchase Hostel`
- **Type:** Google Analytics: GA4 Event
- **Configuration tag:** reuse the existing `GA4 Configuration` tag
- **Event Name:** `purchase_hostel`
- **Event Parameters:** same object as the standard `purchase` tag — `value`, `currency`,
  `transaction_id`, `items`
- **Trigger:** `Purchase - Hostel`
- **After publishing:** star `purchase_hostel` as a **Key Event** in GA4 Admin → Events. This is what
  closes the "no unique key events in GA4" gap — right now `purchase` is the only starred conversion event.

### Meta (Facebook Pixel)

- **Name:** `FBP Custom - Purchase Hostel`
- **Type:** same template the existing `FBP Purchase Tag (…1798465) - V2` uses (community template
  `cvt_5RM3Q`, or a Custom HTML tag calling `fbq()` directly if that template doesn't expose a "custom
  event name" field — check the existing tag's config in the GTM UI first and match it for consistency)
- **Event:** `fbq('trackCustom', 'Purchase_Hostel', {value: {{ecommerce.value}}, currency: {{ecommerce.currency}}, content_ids: {{Purchase Content IDs}}, content_type: 'product'})`
- **Trigger:** `Purchase - Hostel`
- **Do not** rename this to the standard `Purchase` event or replace the existing aggregate tag. Keep
  `FBP Purchase Tag (…1798465) - V2` firing on `Purchase - All` as the one standard-named "All Purchases"
  signal Meta uses for ad-delivery optimization — fragmenting it into 5 differently-named standard events
  would degrade Meta's learning and risk double-counted totals in Ads Manager. These new `Purchase_*`
  custom-named tags are for **reporting and audience-building**: once they're live, create a Custom
  Conversion per event name in Meta Events Manager.

### TikTok

- **Name:** `TikTok Custom - Purchase Hostel`
- **Type:** Custom HTML (reads straight off the original `purchase` dataLayer push — `ttq` is already
  initialized by the existing `TikTok - All Pages` tag, so no new pixel bootstrap is needed)
- **Event:** `ttq.track('Purchase_Hostel', {value: {{ecommerce.value}}, currency: {{ecommerce.currency}}, contents: {{Purchase Content IDs}}})`
- **Trigger:** `Purchase - Hostel`
- Same rationale as Meta: keep the existing `CompletePayment` twin-event path (already fired by
  `gtmTracker.ts`'s `tiktokEventMap` for every purchase) as the "All Purchases" signal; these are additive,
  reporting-only events.

### Google Ads

- **Name:** `Google Ads - Purchase Hostel`
- **Type:** Google Ads Conversion Tracking
- **Conversion ID:** `697-007-4125` (existing account)
- **Conversion Label:** **blocked on §4 below** — Google Ads Conversion Actions must exist before this
  field can be filled in
- **Conversion Value:** `{{ecommerce.value}}` · **Currency Code:** `{{ecommerce.currency}}` ·
  **Transaction ID:** `{{ecommerce.transaction_id}}` (enables value-based bidding and Ads-side dedupe)
- **Trigger:** `Purchase - Hostel`

### Repeat for the other 4 types

| Type | Trigger | GA4 Event Name | Meta/TikTok custom event name |
|---|---|---|---|
| Tour | `Purchase - Tour` | `purchase_tour` | `Purchase_Tour` |
| Surf Camp | `Purchase - Surf Camp` | `purchase_surf_camp` | `Purchase_SurfCamp` |
| Parent Voucher | `Purchase - Parent Voucher` | `purchase_parent_voucher` | `Purchase_ParentVoucher` |
| ALL IN | `Purchase - All In` | `purchase_all_in` | `Purchase_AllIn` |

### Existing tags — no functional change, just note what they now mean

The pre-existing `FBP Purchase Tag (…1798465) - V2`, `TikTok - All Events` (or `- All Pages`, whichever
carries the `CompletePayment` mapping), and `Google Ads - Purchase` tags are already, functionally, the
"All Purchases" tag for their platform (see §2, `Purchase - All`). No changes needed to them beyond §5's
consent-gating recommendation — just document them as the aggregate signal so nobody duplicates them.

## 4. Blocking dependency — Google Ads Conversion Actions

Before the 5 new Google Ads tags in §3 can be finished, **whoever has Google Ads admin access must first
create 5 new Conversion Actions** in Google Ads → Tools & Settings → Conversions (one each for
Hostel/Tour/Surf Camp/Parent Voucher/ALL IN Purchases). That's where each Conversion Label comes from — the
GTM tags cannot be completed without it. This is not resolvable inside GTM.

While in there, also worth doing (adjacent, not strictly in scope): switch the existing "All Purchases"
conversion action's **Count** setting from "Every" to "One", as a backstop against any remaining
duplicate-fire edge cases beyond the C1 dedupe fix already documented in the audit report.

## 5. Consent gating — apply to every new tag

Set, on all 15 new advertising tags (Meta ×5, TikTok ×5, Google Ads ×5):

```json
"consentSettings": {
  "consentStatus": "NEEDED",
  "consentType": { "type": "LIST", "list": [
    { "type": "TEMPLATE", "value": "ad_storage" },
    { "type": "TEMPLATE", "value": "ad_user_data" }
  ]}
}
```

This is the exact template already documented in
[`M4_AD_PIXEL_CONSENT.md`](../../frontend/docs/analytics/M4_AD_PIXEL_CONSENT.md) (copied from
`Reddit - All Pages`, the one tag that already does this correctly). The 5 new GA4 event tags should follow
GA4's existing `analytics_storage` consent pattern, same as the rest of the GA4 tags in the container.

**Recommend, don't silently do:** while touching this container, also apply the same fix to the
pre-existing generic Meta/TikTok/Ads tags — M4 is still open against them as of the last audit check.

## 6. Standalone sites — Parent Vouchers, ALL IN

No trigger hostname edits needed. Confirmed none of the triggers in §2 (nor the pre-existing ones they're
modeled on) carry any `Page Hostname`/`Page Path` condition — they're pure event-name matchers — so
`parents-voucher` and `mm-squad-trips` already reach every tag in this spec once built, since both already
push the matching `event: "purchase"` / `conversion_type` shape described in the "Before you build"
section above.

One pre-existing, unrelated discrepancy worth a note for whoever maintains `mm-squad-trips` next:
`parents-voucher` pushes a pre-GTM `dataLayer.push({app_name: 'gift-vouchers'})` page-identifier before its
GTM loader (per the Implementation doc §19.1 policy); `mm-squad-trips` doesn't have an equivalent
`app_name` push (§19.2 documents `item_category4`/`conversion_type` as its accepted substitute). Not a
blocker for this build since `conversion_type` already does the job at the event level.

## Verification

- **GTM:** Preview mode against staging for each of the 5 conversion-type flows (book a room, book a tour,
  book a surf-camp tour, buy a Parent Voucher, book an ALL IN trip). Confirm the aggregate "All Purchases"
  tag fires every time, plus exactly one of the 5 category tags, on all 3 destinations.
- **Meta:** Events Manager → Test Events — confirm the standard `Purchase` event fires once per checkout
  plus the correct `Purchase_<Type>` custom event.
- **TikTok:** Events Manager → Test Events (or the Pixel Helper browser extension) — same check for
  `CompletePayment` plus the custom event.
- **Google Ads:** Tag Assistant / Google Ads' own diagnostics, after the Conversion Actions + labels from
  §4 are in place.
- **GA4:** DebugView to confirm the 5 new `purchase_*` events land with correct parameters, then confirm
  they appear as Key Events in GA4 Admin.

## Reference

Container export: [`frontend/docs/analytics/gtm/GTM-KC78NFHD_workspace48.json`](../../frontend/docs/analytics/gtm/GTM-KC78NFHD_workspace48.json).
Full architecture: [GA4-GTM-IMPLEMENTATION.md](./GA4-GTM-IMPLEMENTATION.md).
Code change: `frontend/utils/ecommerceDataLayer.ts` on `feature/gtm-conversion-tracking`.
