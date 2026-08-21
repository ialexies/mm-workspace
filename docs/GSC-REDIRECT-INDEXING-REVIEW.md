# GSC "Page with Redirect" Indexing Review

**Date:** 2026-07-30 (see [2026-08-20 update](#update-2026-08-20--root-cause-of-blank-ssr-found-and-fixed-plus-action-items-resolved) below — all 5 action items resolved, and the "blank SSR on core pages" issue referenced below turned out to have a single root cause, now fixed)
**Related:** ~~[SEO-AUDIT.md](SEO-AUDIT.md)~~ (Critical Finding #1 — blank SSR on core pages) — this file could not be found in the repo as of 2026-08-20; the link is dangling. Treat the 2026-08-20 update below as the current source of truth for the blank-SSR finding instead.

---

## Background: Landing Page Architecture Question

Prompted by a plan to keep building marketing landing pages in Lovable (each in its own repo) and redirecting them in from the main domain.

**Assessment: bad architecture at scale.** Fine as a one-off prototype; risky as a repeated pattern.

| | |
|---|---|
| **Pros** | Fast to ship without eng bottleneck; isolates blast radius from the main app. |
| **Cons** | SEO signal dilution through redirect hops; analytics fragmentation (GTM/dataLayer conventions don't carry over per repo); N repos = N maintenance/security/hosting surfaces; brand/design drift (no shared MUI theme); no reuse path if a page needs to graduate into the real app. |

**Recommendation:** build a lightweight landing-page template inside the existing `frontend/` app (e.g. a `/campaigns/[slug]` route or shared minimal package) instead of one repo per page — gets SSR, GTM, and the design system for free.

**Update (2026-08):** the analytics-fragmentation con is now mitigated by convention rather than architecture — every standalone landing page is required to reuse the shared GTM container (`GTM-KC78NFHD`) and GA4 property (`G-K27E7XLRBP`) instead of provisioning its own. Two pages already follow this: `parents-voucher/` and `lovable_pages/mm-squad-trips/` (the latter is Lovable-built, exactly the pattern this review was warning about, and reuses the shared container correctly). See [`docs/analytics/GA4-GTM-IMPLEMENTATION.md`](analytics/GA4-GTM-IMPLEMENTATION.md#19-standalone-landing-pages-non-frontend-repos) §19 for the policy and onboarding checklist. The other cons (N repos = N maintenance surfaces, no shared design system, no reuse path into the real app, SEO signal dilution through redirect hops) still apply — this only closes the analytics gap.

This review found no evidence that Lovable pages are the cause of the current indexing issues below — those trace to ordinary redirect/slug hygiene in the existing Next.js app and (likely) WordPress.

---

## GSC Report Reviewed

**Page indexing → Page with redirect**
Status: Validation Failed (started 7/13/26, failed 7/25/26) · 12 affected pages

Meaning: Google crawled these URLs, found a 3xx redirect, and correctly excluded the *redirecting* URL from the index (only the destination can be indexed). "Validation Failed" means a fix was already submitted for revalidation on 7/13, and Google's recrawl through 7/25 still found the redirect live.

## Live Verification (2026-07-30)

Checked all 12 reported URLs directly.

**7 of 12 now resolve `200 OK` with no redirect** — likely fixed after the 7/25 failed validation, just not yet recrawled: `chiang-mai`, `kuta-lombok`, `luang-prabang`, `koh-rong`, `dumaguete`, `panglao`, `siquijor`. No action needed beyond re-requesting validation once the remaining items below are resolved.

**5 of 12 still actively redirect:**

| URL | Redirects to | Severity |
|---|---|---|
| `/mad-pass-unlimited-stays/` | `/destination` (301) | High — commercial product page collapsing into a generic listing page; loses all page-specific content/keyword targeting. Already flagged in [SEO-AUDIT.md](SEO-AUDIT.md#xml-sitemap--needs-work) as present in the sitemap despite redirecting. |
| `/destination/nacpan` | `/destination/nacpan-beach` (301) | Low — clean slug rename; just needs internal links/sitemap updated to the new slug. |
| `/creative-hub` | `/creatorhub` (301) | Medium — slug rename; stale internal link found in code (see below). |
| `/corporate-social-responsibility` | `/corporate-social-responsibility-reports/` (301) | Low — slug rename + the trailing-slash inconsistency already noted in the SEO audit. Likely WordPress-side. |
| `/partners/suppliers` | `/partners/suppliers/` (301) | Low — pure trailing-slash self-redirect, no content change. Likely WordPress-side. |

## Root Cause Found in Frontend Code

Two of the five are self-inflicted: the frontend hardcodes links to the stale, redirecting URLs, which is why Google keeps rediscovering them and why the 7/13 validation attempt failed.

- **[MadPassComponent.tsx:133-138](../frontend/components/molecules/home/MadPassComponent.tsx#L133-L138)** — the homepage's "UNLOCK UNLIMITED" CTA hardcodes `href="https://madmonkeyhostels.com/mad-pass-unlimited-stays/"`, which live-redirects to the generic `/destination` listing. This is a UX bug as well as an SEO one: users clicking the CTA land on a generic page, not a MadPass-specific one.
- **[SecondaryNavigationComponent.tsx](../frontend/components/molecules/SecondaryNavigationComponent.tsx)** — two separate footer links to Creator Hub, one stale:
  - Line 175: `"Content Creators"` → `creative-hub/` (old slug, still redirects)
  - Line 316: `"Creator Hub Stays"` → `creatorhub/` (current slug, resolves directly)

  Either these are meant to be distinct destinations and one has the wrong URL, or they're duplicate leftovers from the rename.

`corporate-social-responsibility` and `partners/suppliers` were not found in the frontend codebase — likely WordPress-side links, out of scope for this repo.

## Action Items

**Now**
1. ✅ **Done (2026-08-20).** MadPass CTA never got redirected — instead `MadPassComponent.tsx` was found completely unused (not imported anywhere in the app) and deleted, along with the equally-orphaned `MyAccountNavigation.tsx` (superseded by `MyNewAccountNavigation.tsx`). MadPass no longer exists as a product per the business; no working destination to point the CTA at.
2. ✅ **Done (2026-08-20).** `SecondaryNavigationComponent.tsx`'s stale `Content Creators` link now points at `/creatorhub/` directly instead of the redirecting `/creative-hub/`.
3. ✅ **Done (2026-08-20).** `/mad-pass-unlimited-stays/` removed from `sitemap.xml` entirely (not redirect-updated, since the product no longer exists).

**Before re-requesting GSC validation**
4. ✅ **Done (2026-08-20).** `sitemap.xml` now uses `nacpan-beach` and `creatorhub` exclusively — grepped for lingering old-slug references, none found.
5. ⏳ **Still open.** `corporate-social-responsibility` and `partners/suppliers` are WordPress-side, outside this repo. Live-checked 2026-08-20: `partners/suppliers` now resolves `200` directly (no redirect — appears fixed independently on the WP side since 7/30). `corporate-social-responsibility` still 301s to `corporate-social-responsibility-reports/`; `sitemap.xml` now points directly at the `-reports/` URL to avoid submitting a redirecting entry, but the underlying WP redirect itself is unresolved — flag to whoever manages that WP content if it should be fixed rather than just avoided in the sitemap.

**Ready to re-trigger GSC validation** once the branch below deploys — all frontend-side blockers are resolved. Re-run the redirect probe from the update below against production first to confirm.

---

## Update (2026-08-20) — root cause of blank SSR found and fixed, plus action items resolved

A follow-up SEO audit (sitemap/robots.txt cleanup, canonical tags, GSC sitemap registration) surfaced something bigger than this review's original scope: the "blank SSR on core pages" issue this doc's header pointed at (via the now-missing `SEO-AUDIT.md`) has a single, confirmed root cause.

**Root cause:** `pages/_app.tsx` (previously) had `if (!maintenanceChecked) return null;` gating the entire app render. `maintenanceChecked` starts `useState(false)` and is only ever flipped to `true` inside a `useEffect` — which never runs during server-side rendering. Result: **every single server-rendered page, on every environment (production/staging/local), returned a completely empty `<div id="__next"></div>`** — no `<title>`, no meta tags, nothing from `next/head` anywhere, on literally every page, confirmed via direct HTML inspection. `pages/_document.tsx`'s independently-fetched OG/description tags were the *only* reason the site had any dynamic meta content at all — a workaround someone already built for exactly this gap, without realizing the gap itself was fixable in one line.

**Fix:** `if (Capacitor.isNativePlatform() && !maintenanceChecked) return null;` — `Capacitor.isNativePlatform()` is always `false` during SSR (no native runtime in Node), so the gate becomes a no-op for web/SSR while native's real maintenance-check gate is preserved unchanged.

**Consequence (expected and handled):** real SSR executing for the first time surfaced two categories of previously-dormant bugs that only crash under actual server rendering:
- `dompurify` called directly during SSR in 12 files (`DOMPurify.sanitize is not a function` — the package needs a DOM, which doesn't exist in Node). Fixed by swapping to `isomorphic-dompurify` (drop-in replacement) across all 12: `CardPlainComponent.tsx`, `CardTourPlainComponent.tsx`, `Faq.tsx`, `HotelBookingListThumb.tsx`, `MadLoyaltyDiscount.tsx`, `MadLoyaltyMechanics.tsx`, `MadLoyaltyStripe.tsx`, `RoomDetails.tsx`, `TourEventCardComponent.tsx`, `pages/destination/[slug].tsx`, `pages/esim/index.tsx`, `pages/tours-events/[slug].tsx`.
- `pages/booking/thanks.tsx` accessed `sessionStorage` directly in the component body (not inside an effect), which broke the production *build itself* (static-generation prerender error) once SSR started really running. Fixed with a `typeof window !== "undefined"` guard on the two unconditional call sites (line ~326); the other ~12 `sessionStorage` calls in that file were confirmed already inside `useEffect`/event handlers, safe as-is.

**Additional related work landed alongside this fix** (branch `hotfix/seo-sitemap-canonical-fixes`, not yet merged):
- `Layout.tsx` now renders `<link rel="canonical">`, sourced from `SeoData.basic.canonical_url` (already computed correctly by the backend, previously fetched and silently discarded) with a self-referencing fallback (never defaults to the homepage — a bug caught in review, since several static pages like `/our-story` never call `fetchSeoData` at all).
- `next.config.mjs` now redirects trailing-slash duplicates (`/destination/bangkok/` → `/destination/bangkok`) to their canonical form — previously both forms served `200` independently, which is the other half of what was causing duplicate-URL indexing.
- The WordPress/Yoast sitemap (`sitemap_index.xml`, covering `/blogs/*`, products, destinations — confirmed live and current, `lastmod` 2026-08-19) was never registered with Search Console; added as a second `Sitemap:` line in `robots.txt`.
- New Playwright regression spec (`e2e/tests/seo-canonical-and-redirects.spec.ts`) guards both the canonical-tag and trailing-slash-redirect behavior going forward.
- Full verification: `type-check`, `lint`, `next build`, and the full Playwright suite were run both on this branch and against an isolated worktree of unmodified `v3-main` to confirm zero regressions — 16 pre-existing test failures (analytics/auth/session-expiry/booking-thanks-transaction-id) are identical on both, confirmed pre-existing and environmental (not caused by this work).

**Not yet verified:** the native (Capacitor/iOS/Android) build should get a smoke test before this ships — `Capacitor.isNativePlatform()` evaluates `false` server-side regardless of what the eventual client turns out to be, so a genuine native client's first hydration pass could very briefly diverge from the server's non-native assumption. Functionally this should resolve itself immediately (native's own effect still runs the real maintenance check right after), but it hasn't been confirmed on an actual device/simulator.

---

## Update (2026-08-21) — structured data / schema.org gap (AI-search + rich results)

Flagged while researching AI/SEO best practices; verified against the codebase.

**Current state:** the only structured data anywhere on the site is a global `Organization` schema (logo only) in [`_document.tsx`](../frontend/pages/_document.tsx#L202-L211), identical on every page. Grepped the whole frontend for `schema.org`/`application/ld+json` — nothing else exists.

**Gap:** no `LodgingBusiness`/`Hotel` schema on destination pages, no `Product`/`TouristTrip` schema on tour pages, no `Article`/`BreadcrumbList` on blog posts. This matters for two separate audiences:
- **Classic Google rich results** — star-rating/price snippets in search require this markup.
- **AI answer engines** (Google AI Overviews, ChatGPT search, Perplexity) — these lean on structured data to extract entity facts (address, price, amenities) rather than parsing rendered HTML, so pages without it are effectively invisible to that layer even once the blank-SSR fix above ships.

**Feasibility check:** [`pages/destination/[slug].tsx`](../frontend/pages/destination/[slug].tsx) already fetches and renders `address`, images (`map_image` + gallery), and price data (`advertisedPrice`, `priceOptions`) client-side — enough to build a basic `LodgingBusiness` schema without new backend work. **Not confirmed available:** aggregate rating/review count and precise lat/long geo-coordinates — needs a check against what Cloudbeds/the backend actually exposes before that part can be scoped.

**Action items (not started):**
1. ⏳ Add `LodgingBusiness` JSON-LD to `pages/destination/[slug].tsx` using existing address/image/price data.
2. ⏳ Confirm whether aggregate rating and geo-coordinates are available from the backend; if not, scope as a backend follow-up.
3. ⏳ Add `Product`/`TouristTrip` schema to tour pages (`pages/tours-events/[slug].tsx`).
4. ⏳ Add `Article` + `BreadcrumbList` schema to blog posts.
5. ⏳ Validate with [Google's Rich Results Test](https://search.google.com/test/rich-results) once implemented (do not run non-Google validators against production URLs without checking their ToS first).
