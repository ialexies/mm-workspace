# GA4 & GTM — Roadmap, Documentation & Reporting

**Mad Monkey Hostels** · May 2026 · Priority summary & compliance table updated 2026-08-20  
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
