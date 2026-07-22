# Sendbird Disable Runbook

Point-in-time snapshot of the Sendbird chat integration (captured 2026-07-21) plus the exact
procedure used to soft-disable it and bring it back later. For the living architecture reference,
see [`docs/SENDBIRD_INTEGRATION.md`](./SENDBIRD_INTEGRATION.md) and
[`backend/docs/SENDBIRD_CHAT_API.md`](../backend/docs/SENDBIRD_CHAT_API.md) — this doc does not
replace those, it exists so the disable can be reversed confidently without re-deriving the
architecture from scratch.

## Why this exists

Sendbird was temporarily disabled via a `SENDBIRD_ENABLED` kill switch (soft-disable, not code
removal — see [Design decision](#design-decision) below). This doc is the map back: what got
touched, what stayed untouched, and how to flip it back on.

## What Sendbird powers today

- 1:1 traveler-to-traveler messaging ("Message this traveler" on the traveler profile page).
- Per-property "group chat" channels, auto-populated nightly by a sync job that adds/removes
  guests based on their booking date window at that property.
- Push notifications for chat messages (iOS/Android via Capacitor).

## Current-state inventory

### Backend (`backend/`)

| Component | Location | Notes |
|---|---|---|
| Sendbird Platform API client | `src/services/SendbirdService.ts` | Raw `fetch` wrapper (no SDK dep on backend). Constructor throws if `SENDBIRD_APP_ID`/`SENDBIRD_API_TOKEN` are unset. Singleton via `getSendbirdService()`. Used only by `chat.ts` and `PropertyGroupChatService.ts`. |
| Chat routes | `src/routes/chat.ts`, mounted at `app.route("/chat", chatRoutes)` (`src/index.ts:185` and `:279`, same module) | `POST /token`, `POST /channels`, `GET /channels/:channelUrl/members`, `POST /property-groups/sync`, `POST /property-groups/ensure-membership`, `GET /property-groups`, `POST /channels/destination` all call Sendbird. |
| Ops allowlist admin routes | `src/routes/property-group-chat-admins.ts`, sub-mounted at `/chat/property-group-admins/*` | Postgres-only CRUD, does **not** call Sendbird. Stays functional regardless of chat disable state. |
| "Cron" sync job | `src/services/PropertyGroupChatService.ts` | Not a real cron — a `setInterval` loop, default 24h (`PROPERTY_GROUP_CHAT_CRON_INTERVAL_MS`). `start()`/`stop()`, singleton `propertyGroupChatService`. Started from `src/index.ts:396` only if `AUTO_SYNC_PROPERTY_GROUP_CHATS === "true"`. |
| Ops-auth middleware | `src/middleware/requirePropertyGroupChatOps.ts` | Gates `/chat/property-groups/sync` and all of `property-group-chat-admins.ts` via `PROPERTY_GROUP_CHAT_OPS_EMAILS` allowlist. Unrelated to the disable flag. |
| DB tables | `property_group_chat_admins`, `property_group_chat_admin_properties` (`src/db/schema.ts`) | Hold only the ops allowlist, not Sendbird channel/message state. Safe to leave untouched. |
| Webhook | — | Never built. No incoming Sendbird webhook traffic to worry about. |
| EventBus/RabbitMQ | — | No chat events registered in `src/events/`. |
| npm dependency | — | None — backend talks to Sendbird via plain `fetch`, no `@sendbird/*` package. |

**Env vars**: `SENDBIRD_APP_ID`, `SENDBIRD_API_TOKEN` (staging/prod via platform secrets),
`AUTO_SYNC_PROPERTY_GROUP_CHATS`, `PROPERTY_GROUP_CHAT_OPS_EMAILS`,
`PROPERTY_GROUP_CHAT_CRON_INTERVAL_MS`, `PROPERTY_GROUP_CHAT_SENDBIRD_DELAY_MS`, and the new
`SENDBIRD_ENABLED` (see below).

### Frontend (`frontend/`)

| Component | Location | Notes |
|---|---|---|
| SDK deps | `package.json` | `@sendbird/chat@4.20.6`, `@sendbird/uikit-react@3.17.8` — kept installed, not removed. |
| Chat context/provider | `contexts/chatContext.tsx` | `ChatProvider`, mounted app-wide in `pages/_app.tsx`. `fetchToken()` calls the backend token endpoint; `initialize()` is lazy — only runs when the user visits `/my-chats` or clicks "Message this traveler." |
| SDK wrapper | `services/sendbirdClient.ts` | Low-level singleton client. |
| Chat UI | `components/molecules/ChatWindow.tsx`, `ChatChannelList.tsx` | Only mount after a successful connect; never reached if `initialize()` fails first. |
| Push registration | `components/AppPushInitializer.tsx`, `services/push-notifications/providers/SendbirdPushProvider.ts` | Self-gate on `isConnected`/`sendbirdClient.isConnected()`. |
| Entry points | `pages/my-chats/index.tsx`, `pages/travelers/[id].tsx` | Where a disabled-state message needs to surface to the user. |
| CSP allowlist | `csp-config.mjs` (`connect-src`/`media-src` for `*.sendbird.com`) | Left as-is — harmless if unused, instantly correct again on re-enable. |
| Sentry filters | `instrumentation-client.ts` | Filters Sendbird network noise from Sentry — left as-is, becomes a no-op while disabled. |

**Env vars**: none. There is no `NEXT_PUBLIC_SENDBIRD_*` build-time flag — the Sendbird `appId` is
delivered at runtime from the backend's `/chat/token` response. This means the frontend has no
independent kill switch; it purely reflects whatever the backend's `/chat/*` endpoints return.

## Design decision

**Soft-disable, not removal.** All Sendbird code (routes, service, cron, npm packages, UI
components) stays in the repo untouched. A single backend env flag gates the Sendbird-calling
code paths. This makes re-enabling a one-line flag flip plus a backend redeploy — no frontend
redeploy, no re-implementation from this doc.

## How it was disabled

### Backend (`hotfix/disable-sendbird` off `main`)

1. New env var **`SENDBIRD_ENABLED`** — checked as `=== "true"`; absent or any other value means
   disabled (same convention as the existing `AUTO_SYNC_PROPERTY_GROUP_CHATS`).
2. `src/routes/chat.ts` — a `requireSendbirdEnabled` middleware returns `503` with
   `{ message, error: "SENDBIRD_DISABLED", details }` on the 7 Sendbird-calling routes only
   (applied per-route, not as a `.use("*")` catch-all, so `/chat/property-group-admins/*` — a
   different sub-router sharing a path prefix — is unaffected).
3. `src/index.ts:396` — the cron start condition now requires **both**
   `AUTO_SYNC_PROPERTY_GROUP_CHATS === "true"` and `SENDBIRD_ENABLED === "true"`.
4. `env.local.template` and `docs/ENVIRONMENT_VARIABLES_INVENTORY.md` document the new flag.
5. Deploy step: `SENDBIRD_ENABLED=false` (or simply left unset) in staging/prod env config is
   what actually flips the switch — the code change alone is a no-op until this is set in the
   deployed environment.

### Frontend (`hotfix/disable-sendbird` off `v3-main`)

1. `contexts/chatContext.tsx` — `fetchToken()` recognizes the `SENDBIRD_DISABLED` error code from
   the backend and sets an accurate user-facing message ("Chat is temporarily unavailable while
   we perform maintenance. You can continue using the app without chat.").
2. `pages/my-chats/index.tsx` — no code change needed; it already renders this message via its
   existing error `Alert`.
3. `pages/travelers/[id].tsx` — the "Message this traveler" failure path now surfaces the same
   accurate message (previously showed a generic, misleading string) via its existing Snackbar.
4. No changes to the SDK, chat UI components, push registration, `_app.tsx`, CSP config, or
   Sentry filters — they were confirmed to either be unreachable once `initialize()` fails, or to
   already self-gate on connection state.

## How to re-enable

1. Set `SENDBIRD_ENABLED=true` in the backend's deployed environment (staging/prod platform env
   config / secrets).
2. Redeploy the **backend only**. No frontend redeploy is required — the frontend has no
   hardcoded disabled state; it purely reacts to what `/chat/*` returns. Once the backend
   returns normal 200 responses again, `fetchToken()`/`initialize()` succeed, `isConnected`
   becomes `true`, and the chat UI mounts normally.
3. Confirm the property-group-chat cron resumes: check backend startup logs for
   `"Starting PropertyGroupChatService (AUTO_SYNC_PROPERTY_GROUP_CHATS=true)"`. If
   `AUTO_SYNC_PROPERTY_GROUP_CHATS` was also turned off during the disable window, re-set it to
   `true` as well — both flags are required for the cron to start.
4. Smoke-test: `POST /chat/token` returns a normal token response; `/my-chats` connects and lists
   channels; "Message this traveler" successfully opens a DM channel.

## What was intentionally left alone

- Sendbird npm packages, SDK wrapper, and all chat UI components (frontend) — untouched.
- `SendbirdService.ts`, `PropertyGroupChatService.ts` business logic, `property-group-chat-admins.ts`,
  `requirePropertyGroupChatOps.ts`, and the DB schema (backend) — untouched.
- CSP allowlist and Sentry Sendbird-error filters (frontend) — untouched, remain correct whether
  chat is enabled or disabled.
