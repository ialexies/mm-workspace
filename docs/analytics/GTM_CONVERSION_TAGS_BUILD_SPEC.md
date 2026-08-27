# GTM Conversion Tags Build Spec — per-conversion-type tracking for Google Ads, Meta, TikTok, GA4

**Status:** Build in progress, live in `GTM-KC78NFHD`. See [Build progress](#build-progress) below for
exactly what's built, what's verified, and what's next — read that section first if you're picking this up
in a new session/machine.

**Why:** the ad platforms and GA4 currently only see one generic `purchase` conversion. There's no way to
tell Google Ads, Meta, or TikTok which purchase type (room booking, tour, surf camp, gift voucher, ALL IN
group trip) drove a given conversion, so campaigns can't be optimized or reported per product line. This
was raised by DemandMore (the ad agency, contact Luke) via email — see
[Luke's requirements → where this is answered](#lukes-requirements--where-this-is-answered) below.

## Before you build: what's already there

- **The Meta Pixel (`1689683661798465`) and TikTok Pixel (`D095O0BC77U0QQJ07KTG`) are already installed**
  as tags in `GTM-KC78NFHD` (see §11.1 of [GA4-GTM-IMPLEMENTATION.md](./GA4-GTM-IMPLEMENTATION.md)) and
  already fire on every page of every property that loads this container (main site, `parents-voucher/`,
  `lovable_pages/mm-squad-trips/`) via the built-in "All Pages" trigger — no hostname restriction anywhere
  in the container. Pixel _presence_ is not the gap here; **conversion-type granularity is.**
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
  hand-implement, not something already pushed live. (Track B, the live build itself, is now underway by
  hand in the GTM UI — see [Build progress](#build-progress).)

## Luke's requirements → where this is answered

DemandMore's email raised two complaints and listed 6 conversion types (All Purchases, Hostel, Tour, Surf
Camp, Parent Vouchers, HGL Purchases, ALL IN — Meta/TikTok said to be top priority). Mapping his asks to
what actually closes them:

| Ask                                                     | Answered by                                                                                                                                                                                  |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "No unique GA4 Key Events, only one generic `purchase`" | §3's 5 new GA4 event tags (`purchase_hostel`, `purchase_tour`, `purchase_surf_camp`, `purchase_parent_voucher`, `purchase_all_in`) + starring each as a Key Event in GA4 Admin after publish |
| "Ad platforms can't see/report per product line"        | §3's named custom events (`Purchase_Hostel` etc.) on Meta/TikTok → Custom Conversions in each platform's Events Manager; §4's new Google Ads Conversion Actions                              |
| "Is the Pixel even installed / firing on every page?"   | Already true today, not a gap — see "Before you build" above (Meta + TikTok pixels already fire container-wide, including both standalone sites)                                             |
| HGL Purchases                                           | **Deferred** — see [HGL Purchases (deferred, 6th type)](#hgl-purchases-deferred-6th-type)                                                                                                    |

## Build progress

Tracking per-conversion-type status so this can be picked up from any machine. Build order and rationale in
full is in the (superseded, historical) plan; this table is the live source of truth.

| Type               | Trigger                   | GA4 tag                               | Meta tag                             | TikTok tag                              | Google Ads tag | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ------------------------- | ------------------------------------- | ------------------------------------ | --------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ALL IN**         | `Purchase - All In` built | `GA4 - Event - Purchase All In` built | `FBP Custom - Purchase All In` built | `TikTok Custom - Purchase All In` built | not started    | **Live and verified against production, not just GTM Preview.** Container version 42 ("ALL In conversion tags — GA4/Meta/TikTok") is confirmed **published** — a same-shaped synthetic `purchase` push (`conversion_type: all_in`) against the real `madmonkeyhostels.com/all-in-trips` page produced, on inspection of the actual outbound network requests: a GA4 hit `en=purchase_all_in` to `tid=G-K27E7XLRBP` (the production property) alongside `en=purchase`, and a Meta hit `ev=Purchase_AllIn` alongside the standard `ev=Purchase`. `purchase_all_in` subsequently appeared in GA4 Realtime (count 1, 2026-08-13). TikTok pixel requests also fired but the custom event name isn't visible from the request URL alone (TikTok sends it in the POST body). Consent-gated (`ad_storage`/`ad_user_data`, `NEEDED`) confirmed correct on all 3 new tags via the v42 export. **Still open for ALL IN specifically:** (1) ~~star `purchase_all_in` as a GA4 Key Event~~ — **reversed 2026-08-26, see [GA4 Key Events — final decision](#ga4-key-events--final-decision-2026-08-26) below: do not star this.** It was briefly starred and has since been un-starred; (2) create a Custom Conversion for `Purchase_AllIn` in Meta Events Manager; (3) confirm/create the equivalent in TikTok Events Manager; (4) Google Ads tag — nothing built yet, fully blocked on §4 (no Conversion Action exists). |
| **Parent Voucher** | `Purchase - Parent Voucher` built | `GA4 - Event - Purchase Parent Voucher` built | `FBP Custom - Purchase Parent Voucher` built | `TikTok Custom - Purchase Parent Voucher` built | not started    | **Live and verified — published to `GTM-KC78NFHD` 2026-08-13 (version "Add Parent Voucher purchase tracking (GA4 + Meta + TikTok)").** Verified two ways: (1) a real Stripe **test-mode** purchase run through `parents-voucher` on `localhost:3000` end-to-end (consent granted via Cookiebot "Allow all", form → checkout → payment → thank-you redirect), inspecting actual outbound network requests rather than trusting the dataLayer alone — confirmed `en=purchase_parent_voucher` (`epn.value=50`, `ep.transaction_id=cs_test_…`) to `tid=G-27GXNDKYWW`, `ev=Purchase_ParentVoucher` to Meta (`cd[value]=50`, `cd[currency]=USD`, `cd[content_ids]=["credit_custom"]`), and TikTok's `{"event":"Purchase_ParentVoucher"}` in its pixel POST body — all three fired only after publish (a pre-publish run against the same flow correctly showed none of the three firing, confirming GTM Preview was rendering the draft workspace, not the live container). (2) Independently confirmed via the user's own GTM Preview/Tag Assistant session against a real purchase. Consent-gating (`ad_storage`/`ad_user_data`, `NEEDED`) confirmed correct — Meta/TikTok custom tags were blocked pre-consent, fired post-consent, exactly as designed. **Caveat:** both checks ran on `localhost`, which routes to the **dev** GA4 property (`G-27GXNDKYWW`) per the `{{lut - ga property 1}}` hostname lookup — not yet independently confirmed against the production property (`G-K27E7XLRBP`) the way ALL IN was. **Still open:** (1) ~~star `purchase_parent_voucher` as a GA4 Key Event~~ — **reversed 2026-08-26: do not star this, see [GA4 Key Events — final decision](#ga4-key-events--final-decision-2026-08-26) below.** Confirm it isn't currently starred (it hadn't fired in the last 28 days as of the check that prompted this decision, so its star status wasn't directly visible); (2) create a Meta Custom Conversion for `Purchase_ParentVoucher`; (3) confirm/create the TikTok equivalent; (4) Google Ads tag — blocked on §4; (5) the GA4 hit above carried `value`/`transaction_id` but no visible `pr1=` item parameter (unlike the base `purchase` hit) — worth checking in GTM whether the tag's `items` Event Parameter is actually bound to `{{ecommerce.items}}`. |
| **Hostel**         | not started               | not started                           | not started                          | not started                             | not started    | **Next up.** Not started. Needs `Purchase Has Accommodation Item` JS variable first (§1).                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Tour**           | not started               | not started                           | not started                          | not started                             | not started    | Not started. Needs `Purchase Has Tour Item` JS variable + shared `Purchase Content IDs` variable (§1).                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Surf Camp**      | `Purchase - Surf Camp` built | `GA4 - Event - Purchase Surf Camp` built | `FBP Custom - Purchase Surf Camp` built | `TikTok Custom - Purchase Surf Camp` built | not started    | **Live and verified — published to `GTM-KC78NFHD` 2026-08-14 (version "Add Surf Camp purchase tracking (GA4 + Meta + TikTok)").** Verified with a real Stripe **test-mode** purchase run through the actual tour booking flow on `staging.madmonkeyhostels.com/tours-events/surf-camp` (the real "Surf Camp" product, Kuta Lombok, `P0TJG8`, full payment $504.77) — a step up from Parent Voucher's check since this exercises the main site's real booking funnel, not a standalone page. Confirmed via actual outbound network requests: the real `purchase` event correctly carried `item_category: "Surf Camp"` (re-confirming the frontend fix is genuinely live on `new-v3-staging`, not just merged), Meta fired `ev=Purchase_SurfCamp` (`cd[value]=504.77`, `cd[content_ids]`) alongside the standard `ev=Purchase`, and TikTok fired `{"event":"PurchaseSurfCamp"}` — correctly **without** the underscore, confirming the `gtmTracker.ts` naming workaround (§3) was applied correctly. GA4's `purchase_surf_camp` was independently confirmed via the user's own GTM Preview/Tag Assistant session: Firing Status "Succeeded", `eventSettingsTable` shows `value`/`currency`/`transaction_id`/**`items`** all correctly bound to `{{ecommerce.*}}`, hit sent to `G-27GXNDKYWW`. This also resolves the open question from Parent Voucher's row below — confirms the `items` Event Parameter binding pattern works correctly when configured right. Consent-gating confirmed both directions in separate Preview runs: Meta/TikTok tags blocked pre-consent (trigger filters matched via green checkmarks, consent was the only thing withheld) and fired post-consent. **Caveat:** verified against staging (`G-27GXNDKYWW`, dev property), not yet against production. **Still open:** (1) ~~star `purchase_surf_camp` as a GA4 Key Event~~ — **reversed 2026-08-26: do not star this, see [GA4 Key Events — final decision](#ga4-key-events--final-decision-2026-08-26) below.** It was starred and has since been un-starred; (2) create a Meta Custom Conversion for `Purchase_SurfCamp`; (3) confirm/create the TikTok equivalent for `PurchaseSurfCamp`; (4) Google Ads tag — blocked on §4. |
| **HGL**            | not started (spec drafted, §7) | not started               | not started                          | not started                             | not started    | **Frontend prerequisite implemented and FULLY verified end-to-end, GTM side still deferred pending Kyle** (see below). The ambiguity about what "HGL" even refers to has a strong candidate answer: `https://madmonkeyhostels.com/tours-events/the-ha-giang-loop-tour-3d2n-easy-rider` is a real, live `frontend/` tour page (confirmed by loading it directly — real title, real $213.76/person price, real "Book Now" checkout), reached from `madventure-travel`'s Ha Giang Loop marketing page. `isHaGiangLoopTour()` (mirroring `isSurfCampTour()`, §7.1) is implemented on branch `hotfix/ha-giang-loop-purchase-tagging` (off `v3-main`, not merged). Confirmed via headless testing: `add_to_cart` and `begin_checkout` both carry `item_category: "Ha Giang Loop"` for all 3 confirmed-live slugs, including the live typo'd one (`the-tha-giang-loop-tour-3d2n-self-riding`); Surf Camp regression-checked and still correctly gets `"Surf Camp"`. **Confirmed via a real completed purchase (user's own GTM Preview session, 2026-08-27):** "The Ha Giang Loop Tour 4D / 3N (Self-Riding)" booked end-to-end, real `transaction_id`, `$203.80` — the actual `purchase` `dataLayer.push` carried `item_category: "Ha Giang Loop"` and `item_category4: "Ha Giang Loop"` on the item, `conversion_type: "tour"` correctly untouched, and `item_category2: "Signature Tours"` (existing signature-tour categorization) composing cleanly alongside it with no conflict. GTM's Tags-Fired report for that same purchase confirmed the standard aggregate tags fire correctly (`FBP Purchase Tag … V2`, `ga4 - event - ecommerce events`, `Google Ads - Purchase`, `Reddit - Purchase Event`, `TikTok - All Events`) and, as expected, no Ha Giang Loop-specific tag appears anywhere (fired or not) since none is built yet. GTM tags (§7.4) remain undrafted-into-GTM and pending Kyle's confirmation this tour is what "HGL" means — that's the only remaining step. |

**Other open items:**

- **Google Ads Conversion Actions (§4)** — not created yet for any type. Blocking dependency for all 5
  Google Ads tags. Whoever has Google Ads admin needs to create them in Tools & Settings → Conversions.
- **M4 consent gating — nearly done, re-checked 2026-08-13 against container v42.** `NEEDED
  [ad_storage, ad_user_data]` is confirmed correctly set on: Meta (`FBP Purchase Tag`, `FBP PageView Tag`),
  TikTok (`- All Events`, `- All Pages`), Reddit (`- All Pages`, `- Purchase Event`), all 5 Sojern tags, and
  **`UET Microsoft` (Bing)** — that last one wasn't confirmed fixed anywhere in this doc before. **The only
  tag still `NOT_SET` is `Google Ads - Purchase`** — the one remaining M4 action item, not hypothetical; fix
  it while someone's in Google Ads for §4 anyway. Also confirmed in v42: the old duplicate TikTok tag
  (`---OLD--- TT-...-Web-Tag-Pixel_Event`) is `paused: true` — the archive/cleanup step from M4 is done.
- **Regression found 2026-08-13: the standard `purchase` event is not currently starred as a GA4 Key
  Event** (checked in GA4 Admin → Events → Recent events — its star is grey/hollow, unlike `add_to_cart`
  and `begin_checkout` next to it). This contradicts audit finding C3, which claimed this was already fixed
  and live. Being manually re-starred during this session; **confirm it's actually done before trusting
  C3's "Live" status again** — don't just assume it holds.
- **GA4 Key Events** — `purchase_all_in`, `purchase_parent_voucher`, and `purchase_surf_camp` have all fired
  for real (confirmed in Realtime/live network requests, 2026-08-13/14) but none had appeared in the Admin →
  Events list to be starred as of this check — that list lags behind actual firing by an unknown amount, not
  by design, just needs time. Check back before assuming any is still un-starred. The other 2 new event
  names (`purchase_hostel`, `purchase_tour`) don't exist yet since those tags aren't built. **Superseded —
  see below: starring these turned out to be the wrong call.**

### GA4 Key Events — final decision (2026-08-26)

Everything above that says "star `purchase_all_in`/`purchase_parent_voucher`/`purchase_surf_camp` as a GA4
Key Event" was the original plan and is now **reversed**. Each of these tags fires alongside the standard
`purchase` event for the *same transaction*, with the same object as the standard `purchase` tag — `value`,
`currency` (§3) — by design, so starring them double-counts every ALL IN / Surf Camp / Parent Voucher sale:
one real transaction produced two GA4 conversions. Confirmed live in production data (Aug 13–26): `purchase`
765 events / 765 conversions / $70,075.57 revenue in one window, while `purchase_surf_camp` added another 14
conversions on top for the same underlying sales (revenue on the `purchase_surf_camp` side reads $0 in
practice — the `value` binding isn't actually populating despite §3.5's `eventSettingsTable` intent, which
is a separate open bug, see caveat below — so revenue wasn't double-counted yet, but conversion *count* was).

**Final GA4 Key Events list — confirmed live 2026-08-26 (GA4 Admin → Events → Key events, "1–3 of 3"):**

| Event | Keep? | Why |
|---|---|---|
| `purchase` | ✅ Keep | The single source of truth for real transactions/revenue. |
| `add_to_cart` | ✅ Keep | Verified at code level (`contexts/cartContext.tsx`, commits `0419c554`/`bd83e843`) — one real cart action, one event, no duplicate-fire risk. Legitimate soft/funnel conversion, not a duplicate of `purchase`. |
| `begin_checkout` | ✅ Keep | Same reasoning — a real, distinct funnel stage. |
| `purchase_all_in` | ❌ Removed | Duplicates `purchase` for the same sale. |
| `purchase_surf_camp` | ❌ Removed | Same. |
| `purchase_parent_voucher` | ❌ Do not star | Same duplication pattern by construction; hadn't fired in the last 28 days as of this check so its star status wasn't directly visible in the Recent Events view — confirm directly in GA4's Key Events config if unsure. |
| `purchase_hostel`, `purchase_tour` | ❌ Do not star when built | Not built yet (see table above), but will duplicate `purchase` the same way once they exist — **this is a standing rule, not a one-time cleanup.** Whoever builds these next should wire them for Meta/TikTok/Google Ads (which read the tags directly, independent of GA4 star status — no functionality lost) but leave the GA4 side un-starred. |
| `form_submit` | ❌ Removed, do not re-add as-is | Not part of this spec originally, but found and fixed in the same pass. The GTM trigger (`event - form_submit`, trigger 10) is an unscoped `{{_event}} equals form_submit` match — fires for *any* form sitewide (login, search, newsletter, cookie prefs, everything). The `form_name` parameter meant to distinguish forms reads `(not set)` on ~98% of events in production, so there's no way to audit what was actually being counted. Only reconsider if rebuilt as an explicitly-named event scoped to one real form (e.g. `newsletter_signup`), pushed from application code the same way the cart events are — not GTM's automatic form listener. |

**Practical implication:** GA4's blended "Conversions" total is still `purchase` + `add_to_cart` +
`begin_checkout` mixed together — soft and hard signals in one number. For anything revenue- or
booking-related, always pull `purchase` specifically (event-level, via Explore or the Data API), not the
blended total. The `purchase_*` product-line events remain fully useful for Meta/TikTok/Google Ads
breakdowns — those platforms read the tags directly, unaffected by GA4 star status.

**Caveat carried forward:** un-starring doesn't retroactively fix historical data — any date range that
overlaps when `purchase_all_in`/`purchase_surf_camp`/`form_submit` were still starred will still show
inflated "Conversions" for that window. Also still open: the `value` parameter not populating on
`purchase_surf_camp`/`purchase_all_in` in production (Parent Voucher row above flags the same suspicion for
its `items` parameter) — low priority while these stay un-starred, but **fix the double-star before fixing
the value binding**, not the other way around, or revenue (not just count) will start double-counting too.
- **HGL Purchases (deferred, 6th type)** — DemandMore's email is the first place "HGL" appears anywhere;
  no `HGL` category, item, or `conversion_type` value exists in `frontend/` or the GTM container today. Do
  not invent a definition — wait for Kyle to clarify what HGL actually refers to before designing a trigger
  or tags for it. **Update:** a real internal Rezdy tour that's plausibly what "HGL" means was found and
  confirmed live (see the HGL row above) — §7 drafts the full mirror-of-Surf-Camp spec against it so
  whoever builds this isn't starting from zero once Kyle confirms, but the frontend code in §7 is **not
  implemented**, and nothing GTM-side should be built until Kyle actually confirms the tour is what he meant.

## Frontend prerequisite (done, merged)

Tours whose name/slug matches `isSurfCampTour()` now get `item_category: "Surf Camp"` (not `"Tour"`),
mutually exclusive at the item level, in all three places that build a GA4 item for a tour — not just one:

- `frontend/utils/ecommerceDataLayer.ts` — `buildCartEcommerceItems()` (both the optimistic-`items[]` and
  single-tour branches) and `buildSummaryEcommerceItems()`
- `frontend/contexts/cartContext.tsx` — the `add_to_cart` and `remove_from_cart` item builders
- `frontend/pages/tours-events/[slug].tsx` — the `begin_checkout` item builder (a separate direct
  `buildGa4Item()` call that predates the shared helpers and was easy to miss)

All three were hardcoding `item_category: ITEM_CATEGORY_TOUR` regardless of surf-camp status; only
`item_category4` reflected it before this fix. Commit `2aa253ae`, now **merged into both
`origin/new-v3-staging` and `origin/v3-main`** — no code work remains here.

**Verified live**, not just unit-tested: booked the surf-camp tour and a control tour (Valencia Tour) on
localhost through the real UI (date selection → checkout → guest/login → Stripe test payment) and read the
actual `dataLayer` events — `add_to_cart`, `begin_checkout`, and `purchase` all correctly show
`item_category: "Surf Camp"` for the surf-camp booking and `"Tour"` for the control. Independently
re-confirmed the `begin_checkout` payload in Tag Assistant.

**Re-confirmed a second time, 2026-08-14, against `staging.madmonkeyhostels.com` directly** (not
localhost) while verifying the Surf Camp GTM tags — a real Stripe test-mode purchase of the actual "Surf
Camp" tour (Kuta Lombok, product `P0TJG8`) produced a `purchase` event with `item_category: "Surf Camp"`
and `item_category4: "Surf Camp"`. Worth noting for future sessions: the local `frontend/` clone's
`new-v3-staging` checkout was found 35 commits behind `origin/new-v3-staging` at the start of this check
(a stale local branch, not a real regression) — always `git pull` before trusting what a local read of
`ecommerceDataLayer.ts` shows.

No other frontend changes are required: `conversion_type` (`room` / `tour` / `gift_voucher` / `all_in`),
`item_category` (`Accommodation` / `Tour` / `Surf Camp` / `Gift Voucher`), and the standard
`ecommerce.value` / `currency` / `items[]` fields already carry everything the tags below key off of. Note
`conversion_type` intentionally stays `"tour"` for surf camp bookings — it's a flow-level field (which
booking engine handled checkout), not a product-level one; `item_category` is what the new triggers read.

**Known consequence:** any existing GA4 report/audience filtering `item_category == "Tour"` no longer
includes surf camp bookings going forward (historical rows are unaffected — this only changes new data).

## 1. New/reused variables

| Variable                                                                               | Type                | Value                                                                                                                               |
| -------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------- |
| `ecommerce.items`, `ecommerce.value`, `ecommerce.currency`, `ecommerce.transaction_id` | Data Layer Variable | already exist per §11.3 of the Implementation doc — reuse, don't recreate                                                           |
| `conversion_type`                                                                      | Data Layer Variable | **new** — key `conversion_type` (top-level, sibling of `ecommerce`, already pushed by the frontend on every `purchase` event)       |
| `Purchase Has Accommodation Item`                                                      | Custom JavaScript   | `function(){var i={{ecommerce.items}};return Array.isArray(i)&&i.some(function(x){return x&&x.item_category==='Accommodation';});}` |
| `Purchase Has Tour Item`                                                               | Custom JavaScript   | same pattern, `item_category==='Tour'`                                                                                              |
| `Purchase Has Surf Camp Item`                                                          | Custom JavaScript   | same pattern, `item_category==='Surf Camp'`                                                                                         |
| `Purchase Content IDs`                                                                 | Custom JavaScript   | `function(){var i={{ecommerce.items}}                                                                                               |     | [];return i.map(function(x){return x&&x.item_id;});}`— feeds Meta/TikTok`content_ids` |

The three "Has X Item" variables exist because a single `purchase` event can carry multiple line items of
mixed category (multi-room, mixed cart) — a plain Data Layer trigger can't inspect array contents, only a
Custom JavaScript variable can. Parent Voucher/ALL IN don't need this treatment: `conversion_type` is
already a single top-level value set once per event, so a direct equality trigger is enough.

## 2. New triggers

All are **Custom Event** triggers, base condition `event` equals `purchase`, plus one extra condition:

| Trigger name                | Extra condition                                                  |
| --------------------------- | ---------------------------------------------------------------- |
| `Purchase - All`            | _(none — this is the existing `purchase` trigger, reused as-is)_ |
| `Purchase - Hostel`         | `{{Purchase Has Accommodation Item}}` equals `true`              |
| `Purchase - Tour`           | `{{Purchase Has Tour Item}}` equals `true`                       |
| `Purchase - Surf Camp`      | `{{Purchase Has Surf Camp Item}}` equals `true`                  |
| `Purchase - Parent Voucher` | `{{conversion_type}}` equals `gift_voucher`                      |
| `Purchase - All In`         | `{{conversion_type}}` equals `all_in`                            |

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

**Naming caveat — read before building Hostel/Tour/Surf Camp:** `frontend/utils/gtmTracker.ts`'s
`ensureTikTokTrackPatched()` monkey-patches `window.ttq.track` the first time any event fires on the main
site (as early as `view_item`), and rewrites any event name not in its internal map by stripping
non-alphanumeric characters — `"Purchase_Hostel"` arrives at TikTok as `"PurchaseHostel"`. This only
affects the main site (Hostel/Tour/Surf Camp); the standalone sites (Parent Voucher, ALL IN) don't load
`gtmTracker.ts` so their names pass through unmangled. **Use no-underscore names for Hostel/Tour/Surf Camp**
(`PurchaseHostel`, `PurchaseTour`, `PurchaseSurfCamp`) so the string you configure in GTM matches what
actually lands at TikTok. ALL IN's tag was already built using `Purchase_AllIn` (with underscore) — that's
fine and doesn't need retrofitting, since the standalone site isn't subject to this patch.

- **Name:** `TikTok Custom - Purchase Hostel`
- **Type:** Custom HTML (reads straight off the original `purchase` dataLayer push — `ttq` is already
  initialized by the existing `TikTok - All Pages` tag, so no new pixel bootstrap is needed)
- **Event:** `ttq.track('PurchaseHostel', {value: {{ecommerce.value}}, currency: {{ecommerce.currency}}, contents: {{Purchase Content IDs}}})`
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

Meta's `fbq('trackCustom', …)` name and TikTok's `ttq.track(…)` name differ for Hostel/Tour/Surf Camp
because of the `gtmTracker.ts` mangling above — Meta isn't patched, so it keeps the underscore; TikTok's
name is what you type into GTM but must already be pre-stripped so it matches what TikTok actually receives.
Parent Voucher and ALL IN aren't subject to the patch, so both platforms use the same underscored name.

| Type           | Trigger                     | GA4 Event Name            | Meta custom event name   | TikTok custom event name (as configured in GTM) |
| -------------- | --------------------------- | ------------------------- | ------------------------ | ----------------------------------------------- |
| Hostel         | `Purchase - Hostel`         | `purchase_hostel`         | `Purchase_Hostel`        | `PurchaseHostel`                                |
| Tour           | `Purchase - Tour`           | `purchase_tour`           | `Purchase_Tour`          | `PurchaseTour`                                  |
| Surf Camp      | `Purchase - Surf Camp`      | `purchase_surf_camp`      | `Purchase_SurfCamp`      | `PurchaseSurfCamp`                              |
| Parent Voucher | `Purchase - Parent Voucher` | `purchase_parent_voucher` | `Purchase_ParentVoucher` | `Purchase_ParentVoucher`                        |
| ALL IN         | `Purchase - All In`         | `purchase_all_in`         | `Purchase_AllIn`         | `Purchase_AllIn` (**built**)                    |

### Existing tags — no functional change, just note what they now mean

The pre-existing `FBP Purchase Tag (…1798465) - V2`, `TikTok - All Events` (or `- All Pages`, whichever
carries the `CompletePayment` mapping), and `Google Ads - Purchase` tags are already, functionally, the
"All Purchases" tag for their platform (see §2, `Purchase - All`). No changes needed to them beyond §5's
consent-gating recommendation — just document them as the aggregate signal so nobody duplicates them.

**Current consent-gating status (re-checked 2026-08-13 via container v42 export):** `NEEDED
[ad_storage, ad_user_data]` is set on Meta's and TikTok's aggregate tags (`FBP Purchase Tag`,
`FBP PageView Tag`, `TikTok - All Events`, `TikTok - All Pages`), plus Reddit, all 5 Sojern tags, and
`UET Microsoft` — see "Build progress" → "Other open items" above for the full breakdown. **`Google Ads - Purchase`
is still `NOT_SET`** — this is the one remaining action item from M4, not hypothetical; fix it while
someone's in Google Ads for §4 anyway.

### ALL IN — known limitation: balance charge never reaches these tags

Per §19.3 of [GA4-GTM-IMPLEMENTATION.md](./GA4-GTM-IMPLEMENTATION.md), `mm-squad-trips` charges a deposit
client-side (a normal `dataLayer` push, which is what all 3 built ALL IN tags fire on), but the **balance**
— often the larger share of trip value — is charged server-side via a Supabase edge function calling the
GA4 Measurement Protocol directly, bypassing `dataLayer`/GTM entirely. None of the ALL IN tags in this spec
(GA4, Meta, TikTok, or the future Google Ads tag) can ever fire for that portion. Out of scope for this
build — fixing it means work in the separate `mm-squad-trips` repo plus new server-side Conversions API
integrations per platform, not a GTM change.

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
[`M4_AD_PIXEL_CONSENT.md`](../../frontend/docs/analytics/M4_AD_PIXEL_CONSENT.md). Note: `Reddit - All Pages`
is the closest existing example of a gated tag, but its live config only sets `ad_storage` —
`ad_user_data` is M4's own recommended _addition_, not something already present on Reddit's tag today.
Don't copy Reddit's tag as-is; apply the full two-item list above to every new tag in this spec. The 5 new
GA4 event tags should follow GA4's existing `analytics_storage` consent pattern, same as the rest of the
GA4 tags in the container.

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

## 7. Ha Giang Loop — frontend prerequisite implemented, GTM tags NOT yet built (pending Kyle)

§7.1's frontend change is implemented and locally verified on branch `hotfix/ha-giang-loop-purchase-tagging`
(off `v3-main`, **not merged**). §7.2-7.4 (the actual GTM variable/trigger/tags) remain proposals only,
mirroring Surf Camp's already-built pattern exactly — **nothing GTM-side is built.** This section exists
so that once Kyle confirms "HGL" means the tour found live at
`madmonkeyhostels.com/tours-events/the-ha-giang-loop-tour-3d2n-easy-rider` (see the HGL row in "Build
progress" above), the GTM build is copy-paste-ready instead of starting from a blank page.

### 7.1 Frontend prerequisite (implemented, branch not merged)

Added `isHaGiangLoopTour(name, slug)` to `frontend/utils/ecommerceDataLayer.ts`, mirroring
`isSurfCampTour()` (lines 113-120) — case-insensitive substring match, `"ha giang"` in place of
`"surf"`, **with one deliberate difference**: hyphens are normalized to spaces before matching, since
"Ha Giang" is two words and the display name (space-separated) vs. slug (hyphen-separated) use different
separators — `isSurfCampTour`'s single-token `"surf"` never had to handle this. This also catches the
live typo'd slug `the-tha-giang-loop-tour-3d2n-self-riding` for free (`"tha giang"` still contains
`"ha giang"` as a substring) — confirmed empirically, not just by inspection. Plus a new
`ITEM_CATEGORY_HA_GIANG_LOOP = "Ha Giang Loop"` constant. Wired into the same 6 call sites
`isSurfCampTour` already touches, chaining so Surf Camp's existing behavior can't regress:
`item_category: isSurf ? ITEM_CATEGORY_SURF_CAMP : isHgl ? ITEM_CATEGORY_HA_GIANG_LOOP : ITEM_CATEGORY_TOUR`
(same chain for `item_category4`):

1. `frontend/utils/ecommerceDataLayer.ts:208-236` — `buildCartEcommerceItems()`, optimistic-`items[]` branch
2. `frontend/utils/ecommerceDataLayer.ts:237-257` — same function, single-tour branch
3. `frontend/utils/ecommerceDataLayer.ts:322-343` — `buildSummaryEcommerceItems()`
4. `frontend/contexts/cartContext.tsx:1286-1291` — add_to_cart builder
5. `frontend/contexts/cartContext.tsx:1341-1346` — remove_from_cart builder
6. `frontend/pages/tours-events/[slug].tsx:352-362` — begin_checkout builder

`conversion_type` stays `"tour"` — untouched, same reasoning as Surf Camp (§ "Frontend prerequisite" note
above: flow-level, not product-level).

**Verified locally (headless browser, `npm run dev` on port 3000) against all 4 confirmed-live slugs —
complete coverage, not just the substring-match theory:**
- `the-ha-giang-loop-tour-3d2n-easy-rider` ✅ `add_to_cart`/`begin_checkout`
- `the-ha-giang-loop-tour-4d-3n-easy-rider` ✅ `add_to_cart`/`begin_checkout`
- `the-ha-giang-loop-tour-4d-3n-self-riding` ✅ real completed purchase (see below)
- `the-tha-giang-loop-tour-3d2n-self-riding` ✅ `add_to_cart` (the live typo'd slug)

All 4 carry `item_category: "Ha Giang Loop"` / `item_category4: "Ha Giang Loop"` correctly. Also checked:
`the-tha-giang-loop-tour-4d-3n-easy-rider` and `the-tha-giang-loop-tour-4d-3n-self-riding` both 404 — the
typo is isolated to one product listing, not systematic, so 4 slugs is the complete set today. Surf Camp
(`surf-camp` slug) regression-checked and still correctly gets `item_category: "Surf Camp"`.
`npm run type-check` and a lint pass on the 3 changed files are both clean.

**Verified end-to-end via a real completed purchase (user's own browser + GTM Preview, 2026-08-27)** —
the gap headless automation couldn't close (checkout navigation stalled under headless automation for
unclear reasons; worked fine in a real browser). "The Ha Giang Loop Tour 4D / 3N (Self-Riding)" booked
through Stripe checkout end-to-end; the actual `purchase` `dataLayer.push`:
```js
dataLayer.push({
  event: "purchase",
  conversion_type: "tour",             // ← correctly untouched, flow-level field
  ecommerce: {
    transaction_id: "b10ddadf-134b-4dc6-9bde-8ebe132a5734",
    value: 203.8,
    currency: "USD",
    items: [{
      item_id: "243481",
      item_name: "The Ha Giang Loop Tour 4D / 3N (Self-Riding)",
      item_category: "Ha Giang Loop",   // ← this plan's change, confirmed live
      item_category2: "Signature Tours", // ← pre-existing, composes cleanly alongside it
      item_category3: "Mad Monkey Hanoi",
      item_category4: "Ha Giang Loop",  // ← this plan's change, confirmed live
      price: 203.8,
      quantity: 1,
    }],
  },
});
```
GTM's Tags-Fired report for this same event confirmed the standard aggregate tags fire correctly
(`FBP Purchase Tag … V2`, `ga4 - event - ecommerce events`, `Google Ads - Purchase`,
`Reddit - Purchase Event`, `TikTok - All Events`), and — as expected, not a bug — no Ha Giang
Loop-specific tag appears anywhere in the Tags-Fired or Tags-Not-Fired lists, since none is built yet.
**This closes out frontend verification entirely.** The only remaining step for this whole feature is
Kyle confirming this tour is what "HGL" means, then building §7.2-7.4 in GTM.

### 7.2 New variable (§1 pattern)

| Variable | Type | Value |
|---|---|---|
| `Purchase Has Ha Giang Loop Item` | Custom JavaScript | `function(){var i={{ecommerce.items}};return Array.isArray(i)&&i.some(function(x){return x&&x.item_category==='Ha Giang Loop';});}` |

### 7.3 New trigger (§2 pattern)

| Trigger name | Extra condition |
|---|---|
| `Purchase - Ha Giang Loop` | `{{Purchase Has Ha Giang Loop Item}}` equals `true` |

(base condition `event` equals `purchase`, same as every other trigger in §2)

### 7.4 New tags (§3 pattern) — field-by-field, confirmed against the live Surf Camp tags in GTM

**`GA4 - Event - Purchase Ha Giang Loop`**
- Type: Google Analytics: GA4 Event · Send Ecommerce data: `false`
- `eventSettingsTable`: `value` → `{{ecommerce.value}}`, `currency` → `{{ecommerce.currency}}`,
  `transaction_id` → `{{dl - ecommerce.transaction_id}}`, `items` → `{{ecommerce.items}}`
- Event Name: `purchase_ha_giang_loop` · Measurement ID: `{{lut - ga property 1}}`
- Trigger: `Purchase - Ha Giang Loop`
- **Do not star as a GA4 Key Event** — see "GA4 Key Events — final decision" above; this is a standing
  rule, this type is no exception.

**`FBP Custom - Purchase Ha Giang Loop`**
- Type: Facebook Pixel (community template `cvt_5RM3Q`, same as the existing Surf Camp/aggregate tags),
  Pixel ID `1689683661798465`
- `objectPropertyList`: `value` → `{{dl - ecommerce.value}}`, `currency` → `{{dl - ecommerce.currency}}`,
  `content_type` → `"product"`, `content_ids` → `{{Purchase Content IDs}}`
- Trigger: `Purchase - Ha Giang Loop`

**`TikTok Custom - Purchase Ha Giang Loop`**
- Type: Custom HTML —
  ```html
  <script type="text/gtmscript">ttq.track("PurchaseHaGiangLoop",{value: {{ecommerce.value}},currency: {{ecommerce.currency}},contents:{{Purchase Content IDs}}});</script>
  ```
- **No underscore** — `"PurchaseHaGiangLoop"`, not `"Purchase_HaGiangLoop"` — same reasoning as
  Hostel/Tour/Surf Camp (§3's TikTok naming caveat): `gtmTracker.ts`'s `ensureTikTokTrackPatched()` strips
  non-alphanumerics from any event name on the main site, so the string configured here must already be
  pre-stripped to match what TikTok actually receives.
- Required Additional Consent: `ad_storage`, `ad_user_data` (same consent gate as every other new tag —
  §5 applies here too)
- Trigger: `Purchase - Ha Giang Loop`

**Google Ads** — not drafted; blocked on §4 for every type, not just this one, so there's nothing typeable
yet regardless.

### 7.5 Known bugs to watch for, not to repeat

Two open issues already confirmed in production for Surf Camp/ALL IN (see "GA4 Key Events — final
decision" above) will very likely reproduce identically for Ha Giang Loop unless someone checks for them
during this build, not after:
- The `value` parameter isn't actually populating on `purchase_surf_camp`/`purchase_all_in` in production
  despite the `eventSettingsTable` binding looking correct — worth a real network-request check (not just
  trusting GTM Preview) before calling this done.
- Never star `purchase_ha_giang_loop` as a GA4 Key Event (7.4 above) — it would double-count the same
  transaction the standard `purchase` event already counts, exactly like the other three types did until
  the 2026-08-26 reversal.

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

**Two caveats about verification claims elsewhere in the repo, flagged (not fixed) here:**

- **No test runner exists in this repo.** There are 13 `*.test.ts` files — including the one covering the
  Surf Camp `item_category` change this build depends on — but no Jest dependency, config, script, or CI
  step actually executes them. Don't treat "there's a test for it" as evidence of coverage; the only real
  verification for the frontend change was the manual live-booking check described above.
- **`deploy-k8s.yml` deploys on push to `main`, but `origin/main` is a stale, disconnected branch** — the
  Surf Camp fix being merged into `v3-main` does not mean it's live in production. Don't assert
  "in production" anywhere without checking which branch is actually deployed at the time.

## Reference

Container export baseline in the repo: [`frontend/docs/analytics/gtm/GTM-KC78NFHD_workspace48.json`](../../frontend/docs/analytics/gtm/GTM-KC78NFHD_workspace48.json)
— **stale as of this build.** Newer exports/versions have been reviewed since but none persist in the repo:
`workspace52` (pulled 2026-08-12, consent-gating fixes, state right before ALL IN was built), container
**version 42** (`GTM-KC78NFHD_v42`, shared 2026-08-13, exportTime `2026-08-13 09:35:10` — the one "ALL IN —
live and verified" above is based on), the **2026-08-13 8:24 PM publish** ("Add Parent Voucher purchase
tracking (GA4 + Meta + TikTok)", 39 tags / 34 triggers / 87 variables) that Parent Voucher's "live and
verified" status above is based on, and the **2026-08-14 publish** ("Add Surf Camp purchase tracking (GA4 +
Meta + TikTok)") that Surf Camp's "live and verified" status above is based on. If you need to diff
current-vs-this-doc again, re-export the live workspace/version from GTM rather than looking for any of
these in the repo — none of them are there.

Full architecture: [GA4-GTM-IMPLEMENTATION.md](./GA4-GTM-IMPLEMENTATION.md).
Code change: `ecommerceDataLayer.ts`, `cartContext.tsx`, `pages/tours-events/[slug].tsx`, commit `2aa253ae`,
merged into `new-v3-staging` and `v3-main`.
