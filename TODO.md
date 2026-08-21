# TODO List

## In Progress

- [ ]

## Pending

- [ ] Disable the auto creation of channel for customers with same destination and date in the backend
- [ ] **Perf: eliminate duplicate SEO API call on 8 high-traffic pages.** `frontend/pages/_document.tsx` (line 84) unconditionally calls `fetchSeoData(path)` on every single page render, with no caching/dedup. 8 pages *also* independently call the same endpoint (`SeoService.getSeo`/`fetchSeoData`) a second time in their own `getServerSideProps`, for the same path: `pages/index.tsx`, `pages/destination/[slug].tsx`, `pages/destination/index.tsx`, `pages/tours-events/[slug].tsx`, `pages/tours-events/index.tsx`, `pages/room/[slug].tsx`, `pages/madloyalty/index.tsx`, `pages/madloyalty/perks.tsx` — two full network round-trips to the backend per request, on exactly the highest-traffic pages (home, destinations, tours). Confirmed no caching in the generated client (`frontend/v3/api/core/request.ts`). Fix options: have `_document.tsx` reuse whatever the page already fetched (e.g. via `ctx` / ctx.renderPage's collected page props) instead of re-fetching, or add a request-scoped memoization around `fetchSeoData`. Found 2026-08-21 while investigating the `_app.tsx` SSR fix on `hotfix/seo-sitemap-canonical-fixes`.

## Completed

- [x] Disable automatic group channel creation for same destination and dates - disabled in frontend by early return in `loadDestinationChannels` function in `frontend/pages/my-chats/index.tsx`
- [x] Disable all group channels in frontend, show only DMs - filtered out non-DM group channels in `ChatChannelList.tsx`, removed destination channels and open channels from display

---

## Notes 

_Add any additional notes or context here_
