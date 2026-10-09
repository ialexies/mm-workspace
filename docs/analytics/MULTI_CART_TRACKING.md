# Multi-cart booking tracking (`cart_type`)

**Audience:** marketing (how to read the data) and engineering / GTM admin (how it works).
**Status:** code on branch `feat/gtm-multi-cart-tracking` (Frontend repo). GTM + GA4 setup pending. See [Rollout](#rollout).

---

## 1. What it answers

Marketing wants to compare **multi-cart** bookings against **single-cart** bookings: how many there are, revenue,
AOV, and checkout → purchase conversion rate.

"Multi-cart" covers two things a guest can do in one checkout:

- **Multi-property:** rooms at **2 or more hostels** (the "add a stop" flow)
- **Mixed:** **rooms + tours** together

## 2. The fields

Three new parameters on the existing **`begin_checkout`** and **`purchase`** events. There is no new event, so
nothing is double-counted.

| Parameter | Type | Meaning |
|---|---|---|
| `cart_type` | string | one of the four values below |
| `property_count` | number | how many distinct hostels the **rooms** are at (`0` for a tour-only cart) |
| `item_count` | number | room lines + tour lines in the cart |

### `cart_type` values

| `cart_type` | Meaning | Example |
|---|---|---|
| `single` | Rooms at **one** hostel (any number of rooms/beds), **or** tours only | 2 nights at Mad Monkey Dumaguete; or one tour; or two tours, no room |
| `multi_property` | Rooms at **2+ hostels**, no tour | Dumaguete + Siquijor |
| `mixed` | Rooms at **one** hostel **+ at least one tour** | Dumaguete + island-hopping tour |
| `mixed_multi_property` | Rooms at **2+ hostels + at least one tour** | Dumaguete + Siquijor + a tour |

Everything except `single` counts as multi-cart.

How it's decided:

```
rooms at 2+ hostels?   has a tour?   cart_type
        no                 no          single
        no                 yes         mixed            (single if there are no rooms at all)
        yes                no          multi_property
        yes                yes         mixed_multi_property
```

Example `purchase` push (only the last three keys are new):

```js
{
  event: "purchase",
  conversion_type: "room",          // unchanged
  hostel_name: "Mad Monkey Dumaguete",
  ecommerce: { /* unchanged */ },
  cart_type: "multi_property",
  property_count: 2,
  item_count: 3
}
```

### Why not reuse `conversion_type`?

`conversion_type` is a **flow-level** field (`room` / `tour` / `gift_voucher` / `all_in`). Live GTM triggers
(`Purchase - All In`, `Purchase - Parent Voucher`) and possibly reports and audiences filter on it. Adding a
value such as `mixed` would silently move orders out of those filters, so it is **deliberately unchanged**, and
multi-cart lives in its own dimension. A regression unit test locks `conversion_type` in place.

## 3. Where it's computed (Frontend repo)

**v4 frontend only** (`app/v4/`, the new site). The old (legacy) site, reachable through "switch back" until
16 October, is deliberately **not** changed: its events carry no `cart_type`, so in GA4 they show as
*(not set)*. Exclude *(not set)* when comparing cart types.

| Event | File | When |
|---|---|---|
| `begin_checkout` | `app/v4/booking/_lib/useBeginCheckoutEvent.ts` | on arrival at checkout, from the cart |
| `purchase` (rooms / multi-property / mixed) | `app/v4/booking/thanks/_lib/analytics.ts` → `usePurchaseEvent` | from `GET /cart/{id}/confirmation` |
| `purchase` (tour-only) | `app/v4/booking/thanks/_lib/analytics.ts` → `useTourPurchaseEvent` | from the tour receipt |

Helpers in `utils/bookingDataLayer.ts`:

- `getCartCompositionFields({ roomPropertyIds, tourCount })`: the pure rule above.
- `cartCompositionInputFromCart(cart)`: room `property_id`s from `cart.cloudbeds.rooms`, and tours via
  `getCartRezdyItems` (the same tour-line counter the booking page uses).
- `cartCompositionInputFromConfirmation(summary)`: rooms per `bookings[]` entry (falling back to the flat
  `summary.rooms`), and tours nested per booking, then top-level `tours[]`, then `tour`.
- `safeCartComposition(build, onError)`: **fail-safe wrapper**. Any error is logged via `logError` and yields
  `{}`, so the event still fires without the fields. Analytics must never block a checkout or lose a purchase.

Design rules:

- **Additive only.** No existing key on either event changes. This was verified by diffing the full v4
  `purchase` payload before and after the change for 6 cart scenarios (§7).
- **Never relayed through sessionStorage.** Unlike `hostel_name` / `conversion_type`
  (`BOOKING_TRACKING_FIELDS_STORAGE_KEY`), these are computed from the cart or confirmation in hand, so a
  previous cart can't leak into the next booking.

## 4. GTM (`GTM-KC78NFHD`)

Import `gtm/import_multi_cart_params.json` (**Merge → Rename conflicting**). It adds:

| Variable | Type | Purpose |
|---|---|---|
| `dl - cart_type`, `dl - property_count`, `dl - item_count` | Data Layer Variable (v2) | raw values |
| `cjs - cart_type (checkout)`, `cjs - property_count (checkout)`, `cjs - item_count (checkout)` | Custom JavaScript | return the DLV **only** when `{{Event}}` is `begin_checkout` or `purchase`, else `undefined` |

Then **by hand** (an import would overwrite the tag): in `ga4 - event - ecommerce events`, add three Event
Parameters (`cart_type`, `property_count` and `item_count`), each bound to its `cjs - … (checkout)` variable.

Why the `cjs` wrappers: that tag fires on 14 ecommerce events, and GTM's data model keeps top-level keys until
they're overwritten. Bound directly, a `view_item` after a checkout would report the previous `cart_type`.
(`hostel_name` and `conversion_type` already have this leak; it's tracked in Known issues and not changed
here.)

Nothing else is edited: no other tag, trigger or variable. The sites that share the container (mm-squad-trips,
parents-voucher, madventure) never push these keys, so nothing changes for them.

## 5. GA4

Register under **Admin → Custom definitions**, **before** the GTM publish, on every GA4 property behind
`{{lut - ga property 1}}` (web `G-K27E7XLRBP`; check whether app `G-WVGB07X1M6` and dev `G-27GXNDKYWW` are
separate properties, and if so register there too):

| Type | Name | Scope | Event parameter |
|---|---|---|---|
| Custom dimension | Cart Type | Event | `cart_type` |
| Custom metric | Property Count | Event (Standard) | `property_count` |
| Custom metric | Item Count | Event (Standard) | `item_count` |

### Reports for marketing

- **Explore → Free form:** Rows = *Cart Type*. Values = *Transactions*, *Purchase revenue*, *Average purchase
  revenue* (AOV). Filter *Event name* = `purchase`.
- **Explore → Funnel exploration:** steps `begin_checkout` → `purchase`, *Breakdown* = *Cart Type*, to compare
  conversion rate.
- Single vs multi in one number: add a segment or filter *Cart Type* ≠ `single`.

### Caveats (read before presenting numbers)

1. **No history.** Data starts the day GTM is published. Custom dimensions take ~24–48h to show in reports.
2. **Old-site traffic is *(not set)*.** Bookings through the legacy site (until 16 October) don't send these
   fields. Filter *Cart Type* ≠ *(not set)* when comparing.
3. **Order revenue is right; item revenue for mixed orders isn't.** On v4, `purchase.value` is the full amount
   charged (`receipt.grandTotal`), so *Purchase revenue* and AOV per Cart Type are reliable. But the tours of a
   room + tour order are missing from `items[]` (§6), so **item-level** reports (by item category / item name)
   under-count tour revenue for `mixed*` orders.
4. `item_count` counts cart lines, so on `mixed*` orders it can be higher than the number of `items[]` in the
   event, because of the same §6 issue.

## 6. Known issue (deferred, separate task)

Found while building this, **not changed by it**: on the v4 confirmation, a room + tour order's `purchase`
lists only the rooms in `items[]`. The tours are left out (`usePurchaseEvent` builds items from
`bookings[].rooms` only). `value` is correct. Fixing it changes what the item-based tags see (e.g. it would make
the Surf Camp tags fire for room + Surf Camp orders), so it needs marketing sign-off first. See
`GA4-GTM-IMPLEMENTATION.md` §15 M-MC1, which also covers the larger version of this bug on the legacy page.

## 7. Testing

All runs used the branch code on a local dev server against the staging backend. No payment was made.

| Layer | What | Result (2026-10-09) |
|---|---|---|
| Unit (`bun test`) | `utils/bookingDataLayer.test.ts`: every `cart_type` branch, blank/duplicate/numeric ids, cart + confirmation input mapping, fail-safe wrapper, `conversion_type` regression; plus the existing v4 thanks / tour-purchase / ecommerce suites | 304/304 pass |
| Playwright `multi-cart-analytics.spec.ts` + existing `v4-thanks.spec.ts`, `v4-thanks-tours.spec.ts` | mocked confirmation × 6 cart scenarios on v4 thanks; exactly one `purchase`; no re-fire on reload; no stale carry-over; confirmation without `bookings[]`; existing receipt / deposit / free-tour / dedupe checks | 50/50 pass (desktop Chrome + iPhone WebKit) |
| Before/after `purchase` diff | the spec in dump mode (`MULTI_CART_DUMP_DIR`) before and after the change | 6/6 identical except the 3 new keys (`value`, `transaction_id`, `items`, `conversion_type` unchanged) |
| Real carts on the staging backend (`staging-multi-cart-begin-checkout.spec.ts`, manual, `E2E_MULTI_CART_REAL=1`) | Dumaguete 15–17 Jan 2027 → `single 1 1`; + Siquijor → `multi_property 2 2`; + Surf Camp tour → `mixed 1 2`; stops before PAY | 3/3 pass |
| `v4-checkout.spec.ts` (real cart, now also asserts `cart_type: "single"`) | full v4 checkout incl. PAY opening Stripe (test mode) | 12/12 run tests pass (6 skipped by the spec's own conditions) |

Run the spec locally:

```bash
CI=1 E2E_BASE_URL=http://localhost:3000 npx playwright test \
  --config e2e/playwright.config.ts multi-cart-analytics
```

## Rollout

1. Register the GA4 custom definitions (§5).
2. Merge and deploy the Frontend PR. On its own it's harmless: the keys sit unused in the dataLayer until GTM
   forwards them.
3. In a GTM workspace: import the variables, edit the tag (§4), check GTM Preview on production (params on
   `begin_checkout` / `purchase` only, and none on a following `view_item`), then publish. Export the container
   to `gtm/` and add a row to `gtm/CHANGELOG.md`.
4. After ~48h, build the Explorations (§5) and share them with marketing together with the caveats.

**Rollback:** revert the GTM container to the previous version. The code can stay.
