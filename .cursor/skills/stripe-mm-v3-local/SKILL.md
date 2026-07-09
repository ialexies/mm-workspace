---
name: stripe-mm-v3-local
description: >-
  Stripe local dev for MM V3 backend (Docker, stripe listen, webhooks, Rezdy
  booking after checkout). Use when debugging Stripe payments, webhooks not
  firing, stripe listen empty output, account mismatch, STRIPE_WEBHOOK_SECRET,
  or tour checkout not creating Rezdy orders. Also use when installing or
  updating official Stripe agent skills.
---

# Stripe — MM V3 local development

## Install official Stripe agent skills

`npx skills add -y https://docs.stripe.com` **does not work** (no skills index at site root).

Use instead:

```bash
npx skills add -y stripe/ai
```

Official skills install to `backend/.agents/skills/`:

- `stripe-best-practices` — integrations, webhooks, keys
- `stripe-projects` — Stripe Projects provisioning
- `upgrade-stripe` — API/SDK upgrades

Catalog index: `https://docs.stripe.com/.well-known/skills/index.json`

For integration design questions, read `backend/.agents/skills/stripe-best-practices/SKILL.md` and its `references/` files.

## Local webhook flow (MM V3 backend)

1. Backend runs in Docker on **port 8000** (`docker-compose.local.yml`).
2. Webhook route: `http://127.0.0.1:8000/webhooks/stripe` (prefer `127.0.0.1` over `localhost` on Windows).
3. **`stripe listen` account MUST match `STRIPE_SECRET_KEY`** in `backend/.env` / `.env.local`.
   - CLI has no `--api-key` on `listen`; run `stripe login` to the correct account first.
   - If listen shows nothing after a successful payment → account mismatch.
4. Put the **`whsec_...` from `stripe listen` output** (not Dashboard) into:
   - `backend/.env` (for Docker Compose `${STRIPE_*}` interpolation)
   - `backend/.env.local` (for app `env_file`)
5. Recreate container after secret change:
   ```bash
   docker compose -f docker-compose.local.yml up -d --force-recreate app
   ```
6. Expect after payment:
   ```
   --> checkout.session.completed
   <-- [200] POST http://127.0.0.1:8000/webhooks/stripe
   ```
7. Rezdy booking is created on `checkout.session.completed` / `payment_intent.succeeded` via `StripeDatabaseService`.

## Verify payment vs webhook

- Paid in Stripe but no Rezdy order → webhook never reached backend.
- Check session: `stripe checkout sessions retrieve cs_test_... --api-key $STRIPE_SECRET_KEY`
- Replay missed webhook (same account): retrieve event id from `stripe events list --type checkout.session.completed`, then POST signed payload to `/webhooks/stripe` using container env secrets.

## Env files

| File | Role |
|------|------|
| `backend/.env.local` | Main app config |
| `backend/.env` | Docker Compose `${STRIPE_*}` only is OK |
