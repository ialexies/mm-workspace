# Multi-product purchase tracking (rooms, tours, transport, eSIM)

**Audience:** marketing / revenue (how to read the data) and engineering / GTM admin (how it works).
**Status:** code on branch `feat/gtm-multi-cart-tracking` (Frontend repo, **v4 only**). GTM + GA4 setup pending; see
[Rollout](#rollout).

---

## 1. What it answers

A booking can mix **rooms, tours, transportation and eSIMs**. The `purchase` event describes all of it, so the teams
can report on:

- purchases and revenue **by product category**
- how many **rooms, tours, transport services and eSIMs** were sold
- **single-item vs multi-item** purchases
- **room-only, tour-only and mixed** conversions
- revenue **by hostel property and country**
- **cross-selling**: tours / transport bought alongside accommodation

## 2. What's on the event

### Top-level fields (siblings of `ecommerce`)

| Field | Meaning |
|---|---|
| `item_count` | **Total quantity** of everything purchased: rooms + tours + transport + eSIMs. A tour for 2 people counts 2. |
| `property_count` | **Unique hostel properties** in the booking, across rooms **and** tours / transport. An eSIM adds none. |
| `cart_type` | `single` (`item_count` = 1) or `multiple` (`item_count` > 1). |
| `conversion_type` | `room` (rooms only; an eSIM alongside doesn't change it) · `tour` (tours / transport only) · `mixed` (rooms + at least one tour / transport) · `esim` (the standalone eSIM checkout). The other sites keep their own values (`gift_voucher`, `all_in`). |

`property_count` and `item_count` are separate metrics. Two rooms and one tour at Mad Monkey Manila = **3 items,
1 property**; the same items across two hostels = **3 items, 2 properties**.

### `ecommerce.items[]`: every product, separately

| Product | `item_category` | `quantity` | `price` |
|---|---|---|---|
| Room / bed | `Accommodation` | beds / rooms on the line | per unit |
| Tour | `Tour` (`Surf Camp` / `Ha Giang Loop` for those products) | tickets | per ticket |
| Transport (transfers, shuttles, boats) | `Transport` | tickets | per ticket |
| eSIM | `eSIM` | eSIMs | per eSIM |
| Any other cart add-on | `Add-on` | quantity | per unit |

Every v4 item also carries `item_category3` = hostel name and **`item_category5` = hostel country** (new), so revenue
can be split by property and by country.

### `ecommerce.value`

The **whole amount charged** for the transaction (`receipt.grandTotal` on rooms / mixed orders, the tour payment
rule on tour-only orders, Stripe's amount on eSIM). It's taken once from the order total and never summed from the
items, so nothing is double-counted.

### Example

A customer books, all at Mad Monkey Manila: Standard 4-Bed Dorm ×1, Standard Female Dorm ×1, City Tour ×1.

```js
{
  event: "purchase",
  item_count: 3,
  property_count: 1,
  cart_type: "multiple",
  conversion_type: "mixed",          // rooms + tour
  ecommerce: {
    value: /* total charged */,
    items: [ /* Accommodation, Accommodation, Tour */ ]
  }
}
```

### One purchase per transaction

Unchanged: each order fires exactly one `purchase`, however many items it has. The existing dedupe guards
(sessionStorage for rooms, localStorage for tours and eSIM) stop a reload or a reopened email from firing it again.

## 3. Where it's built (Frontend repo, v4 only)

| Event | File |
|---|---|
| `purchase`: rooms / multi-property / mixed | `app/v4/booking/thanks/_lib/analytics.ts` → `usePurchaseEvent` |
| `purchase`: tour-only | same file → `useTourPurchaseEvent` |
| `purchase`: standalone eSIM (`?type=esim`), **new** | same file → `useEsimPurchaseEvent`, called from `EsimThanksScreen.tsx` once the eSIM is provisioned |
| `begin_checkout` | `app/v4/booking/_lib/useBeginCheckoutEvent.ts` (same `cart_type` / `property_count` / `item_count` rules from the live cart; no `conversion_type`) |

Shared pieces:

- `app/v4/booking/thanks/_lib/purchaseItems.ts`: reads the confirmation and returns every product as a GA4 item,
  plus the lines the fields are counted from. It reads each thing **once**: the backend copies the same tour into
  up to three places, and the anchor's add-ons into `summary.summary.addons`.
- `utils/bookingDataLayer.ts` → `getCartCompositionFields(lines)`: the rules in §2; `safeCartComposition`: fail-safe,
  so any error is logged and the event still fires without the fields.
- `utils/ecommerceDataLayer.ts`: item categories (`Transport`, `eSIM`, `Add-on`), `item_category5`, and
  `buildAddonEcommerceItems`.

Rules worth knowing:

- **Transport** is recognised by product code via the v4 tour categories (`app/v4/_lib/tourCategory.ts`). That list
  was generated from staging, so a production-only transfer code not in it is reported as `Tour` until the list is
  regenerated.
- **A tour's hostel** is its own `propertyId` from the confirmation (or slug). A tour with neither adds no property.
  It's never guessed from the name, because a supplier can come back as a bare place like "Valencia".
- **The legacy `pages/booking` site is not changed.** It retires after 16 October, and its events show these fields
  as *(not set)*.

## 4. GTM (`GTM-KC78NFHD`)

The variables and tag parameters from the first version stay as they are; only the values change:

| Variable | Type | Purpose |
|---|---|---|
| `dl - cart_type`, `dl - property_count`, `dl - item_count` | Data Layer Variable (v2) | raw values |
| `cjs - cart_type (checkout)`, `cjs - property_count (checkout)`, `cjs - item_count (checkout)` | Custom JavaScript | the DLV **only** on `begin_checkout` / `purchase`, else `undefined` |

On `ga4 - event - ecommerce events`: Event Parameters `cart_type`, `property_count`, `item_count`, each set to its
`cjs - … (checkout)` variable. `conversion_type` and items are already forwarded by that tag. Create the variables
by hand or import `gtm/import_multi_cart_params.json` (**Merge → Rename conflicting**).

Why the `cjs` wrappers: that tag fires on 14 ecommerce events, and GTM's data model keeps top-level keys until
they're overwritten, so a later `view_item` would otherwise report the last checkout's values.

**Effects on existing tags** (all intended by the task):

- `conversion_type` is now `mixed` for v4 room + tour / transport orders, so they no longer match filters on `room`.
- Room + Surf Camp orders now include the Surf Camp item, so the live `Purchase - Surf Camp` tags fire for them,
  with the order's value (as that spec designs).
- Standalone eSIM orders now send a `purchase`: new conversions in GA4 / Google Ads / Meta / TikTok.

## 5. GA4

Register under **Admin → Data display → Custom definitions** (on the web property, and on the dev property to see
it during GTM Preview):

| Type | Name | Scope | Event parameter |
|---|---|---|---|
| Custom dimension | Cart Type | Event | `cart_type` |
| Custom dimension | Conversion Type | Event | `conversion_type` |
| Custom metric | Property Count | Event (Standard) | `property_count` |
| Custom metric | Item Count | Event (Standard) | `item_count` |

Item category, Item category 3 / 5, Item revenue and Items purchased are **built-in**, so there's nothing to register.

### Reports

| Requirement | Explore → Free form |
|---|---|
| Purchases & revenue by product category | Item category × Item revenue, Items purchased |
| Rooms / tours / transport / eSIMs sold | Item category × Items purchased |
| Single vs multi-item | Cart Type × Transactions, Purchase revenue |
| Room-only / tour-only / mixed | Conversion Type × Transactions, Purchase revenue |
| Revenue by hostel and country | Item category 3 (hostel), Item category 5 (country) × Item revenue |
| Cross-selling | Filter Conversion Type = `mixed`, then Item category |

### Caveats

1. **No history.** Data starts on the GTM publish date; custom definitions take 24–48h to appear.
2. **Old site = *(not set)*** until it retires (16 October). Exclude *(not set)* when comparing.
3. **`begin_checkout` reflects the cart on arrival at checkout; `purchase` reflects the final order.** A guest who
   adds a tour during checkout starts `single` / room-only and finishes `multiple` / `mixed`, so use `purchase` for
   counts, revenue and AOV.
4. **Item revenue can differ slightly from Purchase revenue** when part of an order was paid with store credit, or
   with pack-level tour discounts and rounding. Purchase revenue (`value`) is the authoritative order total.
5. **Transport list** comes from staging product codes; unknown production codes show as `Tour` (see §3).

## 6. Deferred

- **Raw email / phone in the `purchase` push** (the task's privacy line). They're pushed for Google Ads Enhanced
  Conversions (`UPD - Enhanced Conversions`, whose Ads toggle is still off, so nothing uses them yet). **No GA4 tag
  reads them.** Recommended follow-up: push SHA-256 hashes in a `user_data` object and point the UPD variable at
  them. The new eSIM purchase sends no email or phone.

## 7. Testing

All runs used the branch code on a local dev server (clean URLs on, like production) against the staging backend.
Test bookings: **Dumaguete, January 2027**. No payment was made.

| Layer | What |
|---|---|
| Unit (`bun test`) | `utils/bookingDataLayer.test.ts`: the rules (task example 3 / 1 / multiple / mixed; two hostels → 2; 2 rooms + tour for 2 + eSIM → 5 / 1 / multiple / mixed; room + eSIM → room; tours only → tour; standalone eSIM → esim; fail-safe). `purchaseItems.test.ts`: confirmation shapes (tours / add-ons never counted twice, transport, eSIM name / price, top-level fallback, room items identical to before). |
| Playwright `e2e/tests/multi-cart-analytics.spec.ts` | Mocked v4 confirmation × 10 scenarios + standalone eSIM: items, categories, fields, `value` = order total, exactly one `purchase`, no re-fire on reload, no stale carry-over. Desktop Chrome + iPhone WebKit. |
| Before/after diff | The same scenarios on the original `new-v3-staging` code vs the branch: `value`, `transaction_id` and every pre-existing item identical; only the new fields, `conversion_type` on room + tour / transport orders, the added tour / transport / eSIM items and `item_category5` differ. |
| Regression | `v4-thanks`, `v4-thanks-tours`, `v4-checkout`, and the real-cart staging dry run (`staging-multi-cart-begin-checkout.spec.ts`, manual, `E2E_MULTI_CART_REAL=1`). |

```bash
CI=1 NEXT_PUBLIC_V4_CLEAN_URLS=true E2E_BASE_URL=http://localhost:3000 \
  npx playwright test --config e2e/playwright.config.ts multi-cart-analytics
```

## Rollout

1. Register the GA4 custom definitions (§5).
2. Merge and deploy the Frontend PR.
3. GTM: confirm the variables and tag parameters exist (§4); in Preview, check `purchase` shows the fields and a
   later `view_item` doesn't; publish; export the container to `gtm/` and add a `gtm/CHANGELOG.md` row.
4. Tell marketing about the effects in §4 and the caveats in §5, then share the Explorations after ~48h.

**Rollback:** revert the Frontend PR. The GTM changes are harmless without it.
