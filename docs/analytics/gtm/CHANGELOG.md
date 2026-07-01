# GTM container changelog — GTM-KC78NFHD

Record each production publish here. Export JSON to this folder after publishing (see [Roadmap §2.5](../GA4-GTM-ROADMAP-AND-REPORTING.md#25-version-control-gtm-container-exports)).

| Date | Version / export file | Author | Summary |
|---|---|---|---|
| 2026-05 | `GTM-KC78NFHD_v34.json` (external audit export) | — | Baseline audited in May 2026 GA4/GTM audit |
| 2026-06-29 | `GTM-KC78NFHD_workspace47.json` (pre-publish workspace export, in `frontend/docs/analytics/gtm/`) | Alexies | Workspace snapshot before the 2026-07-01 publish (below). |
| 2026-07-01 | **PUBLISHED** — export new version to this folder as `GTM-KC78NFHD_vNN.json` (get NN from GTM → Admin → Container Versions) | Alexies | **Published to production.** Bundled: (1) Conversion Linker `linkerDomains` cleaned to `madmonkeyhostels.com, mmk-main-app.vercel.app, mad-monkey.workers.dev` — fixes self-referral leak (audit context). (2) Enhanced Conversions foundation: DLVs `dl - customer_email`, `dl - customer_phone` + User-Provided Data var `UPD - Enhanced Conversions` (Ads-UI activation still pending — see `../../frontend/docs/analytics/ENHANCED_CONVERSIONS_FOLLOWUP.md`). (3) **SPA `page_view` (audit H1):** DLVs `dl - page_location` / `dl - page_path` / `dl - page_title`, Event Settings var `page_view`, Custom Event trigger `event - page_view`, GA4 Event tag `ga4 - event - page_view` (measurement ID `{{lut - ga property 1}}`). Paired GA4 change: web stream `G-K27E7XLRBP` → Enhanced Measurement → "Page changes based on browser history events" turned **OFF**. Verified end-to-end on staging (GA4 receives one `page_view` per in-app navigation). See `../../frontend/docs/analytics/SPA_PAGE_VIEW_H1.md`. |

## How to add an entry

1. GTM → **Admin** → **Export container** → export workspace version
2. Save as `GTM-KC78NFHD_vNN.json` in this directory
3. Add a row above with date, filename, your name, and a one-line summary of tag/trigger/variable changes
