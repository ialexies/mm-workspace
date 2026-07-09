# Pull request — analytics checklist

Use this checklist when the PR touches Google Tag Manager, GA4 events, booking/checkout tracking, or auth `login` / `sign_up` events.

**Docs:** [Implementation guide](./GA4-GTM-IMPLEMENTATION.md) · [How to add an event](./GA4-GTM-IMPLEMENTATION.md#17-how-to-add-a-new-tracking-event) · [Roadmap](./GA4-GTM-ROADMAP-AND-REPORTING.md)

---

## Code

- [ ] Event name is `snake_case` and documented in `docs/analytics/GA4-GTM-IMPLEMENTATION.md` §5
- [ ] Uses `gtmPushEvent` or `deferGtmPushEvent` (no duplicate raw `dataLayer.push` unless justified)
- [ ] `user_id` is Firebase UID only — **never email**
- [ ] Ecommerce events: `ecommerce: null` clear before payload where applicable
- [ ] `purchase` fires only from `pages/booking/thanks.tsx` (not `payment.tsx`)
- [ ] `begin_checkout` fires only from `pages/booking/index.tsx` (not early on tour slug page)
- [ ] No new production `console.log` / `window.testGTM` without `NODE_ENV !== 'production'` guard

## GA4 / GTM admin (if applicable)

- [ ] New parameters registered as GA4 custom dimension or metric **before** merge
- [ ] GTM trigger + tag created or updated
- [ ] Tested in GTM **Preview mode**
- [ ] Verified in GA4 **DebugView**

## GTM publish (if container changed)

- [ ] GTM export committed to `docs/analytics/gtm/` with entry in `CHANGELOG.md`

## Regression

- [ ] Test booking completes → exactly **one** `purchase` on thanks page (`dataLayer` or DebugView)
