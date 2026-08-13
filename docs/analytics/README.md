# Analytics documentation (GA4, GTM, Google Ads)

Central index for Mad Monkey V3 web and app analytics. Use these docs when changing tracking code, GTM, GA4 admin, or Google Ads conversion settings.

## Documents

| Document | Audience | Purpose |
|---|---|---|
| **[GA4-GTM-COMPLETE-REFERENCE.md](./GA4-GTM-COMPLETE-REFERENCE.md)** | **LLM / full context** | **All docs + audit report in one file (~2,400 lines)** |
| [GA4-GTM-IMPLEMENTATION.md](./GA4-GTM-IMPLEMENTATION.md) | Engineering, GTM admin | How tracking works today: architecture, events, flows, GTM/GA4/Ads config, testing, incidents |
| [GA4-GTM-ROADMAP-AND-REPORTING.md](./GA4-GTM-ROADMAP-AND-REPORTING.md) | Engineering, marketing, ops | Recommended next steps, documentation process, reporting & monitoring |
| [GA4-GTM-AUDIT-REPORT.md](../../GA4-GTM-AUDIT-REPORT.md) | Leadership, ads, engineering | May 2026 audit findings, severity, fix roadmap, technical appendix |
| [GTM_CONVERSION_TAGS_BUILD_SPEC.md](./GTM_CONVERSION_TAGS_BUILD_SPEC.md) | GTM admin (Kyle / agency) | Per-conversion-type tag/trigger/variable build spec for Google Ads, Meta, TikTok, GA4 (Hostel/Tour/Surf Camp/Parent Voucher/ALL IN Purchases; HGL Purchases deferred pending definition). **Build in progress — see the doc's "Build progress" section for live status.** |

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

Marketing sometimes ships a landing page as its own repo/hosting (e.g. Lovable-built, deployed to Vercel) instead of a route inside `frontend/`. [`docs/GSC-REDIRECT-INDEXING-REVIEW.md`](../GSC-REDIRECT-INDEXING-REVIEW.md#background-landing-page-architecture-question) flagged this pattern as risking analytics fragmentation if each repo bootstraps its own GTM container or GA4 property. Policy: **every standalone landing page reuses the same `GTM-KC78NFHD` container and `G-K27E7XLRBP` GA4 property** — never a new one. See Implementation doc §19 for the bootstrap pattern, policy detail, and onboarding checklist. Two pages built under this policy so far: `parents-voucher/` (Gift of Travel voucher page) and `lovable_pages/mm-squad-trips/` (All In group trips — also the reference for reporting server-side/webhook revenue via GA4 Measurement Protocol, §19.3).

## When to read which doc

- **Changing an event or booking flow** → Implementation doc §4–§6, then Roadmap PR checklist
- **Publishing GTM** → Implementation doc §11, §16–§18
- **Fixing conversions / ROAS** → Audit report (Critical + Week 1 roadmap), then Roadmap reporting section
- **Onboarding a new developer** → Implementation doc §1–§2, then this README
- **Building a new standalone landing page (Lovable, own repo, etc.)** → Implementation doc §19
- **Building per-conversion-type ad tags (Google Ads / Meta / TikTok / GA4)** → GTM_CONVERSION_TAGS_BUILD_SPEC.md

---

*Last updated: August 2026 (GTM conversion-tags build in progress — ALL IN done, Parent Voucher next)*
