# GSC "Page with Redirect" Indexing Review

**Date:** 2026-07-30
**Related:** [SEO-AUDIT.md](SEO-AUDIT.md) (Critical Finding #1 — blank SSR on core pages)

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
1. Fix `MadPassComponent.tsx:133` to point at MadPass's real current destination (confirm target URL first).
2. Resolve the `creative-hub` / `creatorhub` duplication in `SecondaryNavigationComponent.tsx` — remove the stale link or confirm both are intentionally distinct.
3. Remove/update the redirecting `/mad-pass-unlimited-stays/` entry in `sitemap.xml`.

**Before re-requesting GSC validation**
4. Confirm `nacpan-beach` and `creatorhub` are the only slugs referenced anywhere in sitemap/internal links (no lingering references to old slugs).
5. Investigate `corporate-social-responsibility` and `partners/suppliers` on the WordPress side.

**Do not** re-trigger GSC validation until the above are live — the previous validation cycle already failed once (7/13–7/25) because the underlying links weren't fixed yet.
