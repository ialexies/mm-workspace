# Auto-Managed Property Group Chats - Implementation Plan

> **Roadmap document** – Use this as a reference when resuming work. Last updated: March 2026.

## Implementation Checklist

| # | Task | Status |
|---|------|--------|
| 1 | Extend SendbirdService (`inviteToChannel`, `leaveChannel`, `updateGroupChannel`) | ✅ Done |
| 2 | Create PropertyGroupChatService (scheduler, membership logic) | ✅ Done |
| 3 | Database migration (`property_group_*` tables) | ⏭️ Skipped (optional) |
| 4 | API endpoints (`sync`, `ensure-membership`, `list`) | ✅ Done |
| 5 | ChatChannelList – DMs + `property_group` channels | ✅ Done |
| 6 | my-chats page – remove `loadDestinationChannels`, pass `destinationChannels={[]}` | ✅ Done |
| 7 | Booking thanks – call `ensure-membership` after successful booking | ✅ Done |
| 8 | Deprecate `POST /chat/channels/destination` | ✅ Done |
| 9 | OpenAPI + frontend API client (ChatService methods) | ✅ Done |
| 10 | Property name resolution – `destinations` lookup, format "Mad Monkey [Property Name]" | ✅ Done |
| 11 | ChatChannelList – call `ensure-membership` on load (fixes existing channels with wrong names) | ✅ Done |
| 12 | Sendbird supergroup migration (create with `is_super: true`, in-place upgrade for existing groups) | ✅ Done |
| 13 | Integration tests | ⬜ Pending |

---

## Executive Summary

The existing **destination channel** implementation (overlap-based, multiple channels per property) should be **replaced** with the new **property group chat** model (one channel per property, date-based membership). The AI's suggested plan is **feasible and well-aligned** with the codebase. This document reviews the proposal, validates it against the current state, and highlights refinements.

---

## Current vs New - Key Differences

| Aspect                    | Current (Destination Channels)                     | New (Property Group Chats)                        |
| ------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| **Channels per property** | Multiple (per overlapping group)                   | One fixed channel                                 |
| **Channel URL**           | `destination-{propertyId}-{sortedUserIds}`         | `property-group-{propertyId}`                     |
| **Custom type**           | `destination`                                      | `property_group`                                  |
| **Membership logic**      | Guest-to-guest overlap (findOverlapping)           | Date window only: check-in - 14d to checkout + 3d |
| **Membership timing**     | On-demand (when user visits my-chats)              | Scheduled (daily) + immediate on booking          |
| **Frontend**              | Disabled (early return in loadDestinationChannels) | Re-enabled for property_group channels            |
| **Channel name format**   | —                                                  | `Mad Monkey [Property Name]` (e.g. Mad Monkey Manila) |

---

## Chat Name Format

**Required format:** `Mad Monkey [Property Name]`  
**Example:** `Mad Monkey Manila`

Property names are resolved in this order:
1. PostgreSQL `destinations` table (`property_id` → `name`)
2. Booking document `propertyName` or `destinationInfo.name`
3. Fallback: `propertyId` (e.g. `269587` → "Mad Monkey 269587")

**Important:** Ensure each property has a row in `destinations` with the correct `name`. If missing, channels will display as "Mad Monkey {propertyId}".

Existing channels created with the wrong name (e.g. "Mad Monkey 269587") are automatically corrected when:
- The user visits `/my-chats` (ChatChannelList calls `ensure-membership` before fetching)
- The scheduler runs (`sync`)
- The user completes a booking (thanks page calls `ensure-membership`)

---

## Architecture

```mermaid
flowchart TB
    subgraph Backend [Backend]
        Scheduler[PropertyGroupChatService - Daily Tick]
        Sendbird[SendbirdService - invite/leave]
        API[Chat API - sync + list]

        Scheduler -->|Query bookings| Mongo[(cloudbeds_reservations)]
        Scheduler -->|Ensure channel| Sendbird
        Scheduler -->|Add/remove members| Sendbird
        API -->|Manual sync| Scheduler
    end

    subgraph Frontend [Frontend]
        MyChats[my-chats Page]
        ChannelList[ChatChannelList]

        MyChats --> ChannelList
        ChannelList -->|ensure-membership (fix names)| API
        ChannelList -->|createMyGroupChannelListQuery| SendbirdSDK[Sendbird SDK]
    end

    SendbirdSDK -->|User invited by backend| Sendbird
```

---

## Implementation Phases

### Phase 1: Backend Core

**1. Extend SendbirdService** (`backend/src/services/SendbirdService.ts`)

Add methods (verified against [Sendbird Platform API v3](https://sendbird.com/docs/chat/platform-api/v3/)):

- `getGroupChannel(channelUrl)`: `GET /v3/group_channels/{channel_url}?show_member=true` – **Important:** `show_member=true` is required so the response includes `members`. Without it, member removal (`leaveChannel`) never runs because `currentMemberIds` is empty.
- `inviteToChannel(channelUrl, userIds)`: `POST /v3/group_channels/{channel_url}/invite` with `{ user_ids: [...] }`
- `leaveChannel(channelUrl, userIds)`: `PUT /v3/group_channels/{channel_url}/leave` with `{ user_ids: [...] }`
- `updateGroupChannel(channelUrl, params)`: `PUT /v3/group_channels/{channel_url}` – used to fix channel names (e.g. "Mad Monkey 269587" → "Mad Monkey Manila")

All support up to 100 users per request. Default invitation behavior joins users immediately (no accept/decline).

**2. Create PropertyGroupChatService** (new file: `backend/src/services/PropertyGroupChatService.ts`)

- **Scheduler:** Use `setInterval` (e.g., daily) like `CloudbedsCacheService`
- **Membership algorithm:**
  - Query `cloudbeds_reservations` for confirmed, non-canceled bookings
  - For each guest: `windowStart = max(today, checkIn - 14 days)`, `windowEnd = checkOut + 3 days`
  - If `today` in `[windowStart, windowEnd]` → add to channel; otherwise → remove
- **Per property:**
  - Ensure channel exists: `property-group-{propertyId}`, name `"Mad Monkey {propertyName}"`, `customType: "property_group"`
  - Resolve property name from `destinations` (by `property_id`) or reservation `propertyName`
- **Batch invite/leave:** Chunk userIds in groups of 100
- Start/stop via env (e.g., `AUTO_SYNC_PROPERTY_GROUP_CHATS=true`), similar to Cloudbeds

**3. Database Migration** (optional but recommended)

- `property_group_channels`: `property_id`, `property_name`, `channel_url`, `last_synced_at`
- `property_group_memberships`: `channel_url`, `customer_id`, `booking_id`, `added_at`, `removed_at`

Use for idempotency, auditing, and avoiding redundant Sendbird API calls.

**4. API Endpoints** (`backend/src/routes/chat.ts`)

- `POST /chat/property-groups/sync` – manual trigger (admin or internal use); also updates wrong channel names
- `POST /chat/property-groups/ensure-membership` – ensure current user's membership and fix wrong channel names (call after booking, and on my-chats load)
- `GET /chat/property-groups` – list user's property group channels (for UI context if needed)

---

### Phase 2: Frontend Integration

**5. ChatChannelList Updates** (`frontend/components/molecules/ChatChannelList.tsx`)

- Change from `dmChannelsOnly` to: **DMs + channels with `customType === 'property_group'`**
- **Call `POST /chat/property-groups/ensure-membership`** before fetching channels – ensures user membership and fixes existing channels that have wrong names (e.g. "Mad Monkey 269587" → "Mad Monkey Manila")
- Set `includeEmpty: true` on `createMyGroupChannelListQuery` so property group channels with no messages yet appear
- Property group channels will appear in `createMyGroupChannelListQuery` once users are invited (no separate API)
- Remove or repurpose `destinationChannels` prop – property groups do not need frontend-driven channel creation
- Filter client-side: `groupChannels.filter(ch => ch.customType === 'dm' || ch.customType === 'property_group')`

**6. my-chats Page Updates** (`frontend/pages/my-chats/index.tsx`)

- **Remove** the `loadDestinationChannels` logic – property group membership is managed by the backend scheduler
- No new API calls needed for property groups; they appear via Sendbird once the user is invited
- Keep existing DM, Customer Support, and ChatWindow behavior

**7. Booking Confirmation Hook** (for short lead time)

- After successful checkout/booking, call `POST /chat/property-groups/ensure-membership`
- Ensures guests who book < 14 days before check-in are added immediately

---

### Phase 3: Deprecate Old Destination Flow

**8. Destination Channel Endpoint**

- Deprecate or remove `POST /chat/channels/destination` – it uses overlap logic and is incompatible with the new model

---

## When Group Chat Triggers / Activates

| Trigger | When | Action |
|---------|------|--------|
| Backend startup + env | Server starts with `AUTO_SYNC_PROPERTY_GROUP_CHATS=true` | Scheduler runs immediately, then every 24h (or `PROPERTY_GROUP_CHAT_CRON_INTERVAL_MS`) |
| User visits `/my-chats` | Channel list loads | `ensure-membership` called before fetching channels |
| User completes booking | Lands on `/booking/thanks` | `ensure-membership` called |
| Manual API call | `POST /chat/property-groups/sync` | Full sync run |

---

## Short Lead Time (AC2)

**Requirement:** When a booking is made < 14 days before check-in, add the guest immediately.

**Recommended approach:** Call `POST /chat/property-groups/ensure-membership` after successful booking confirmation. This satisfies "immediately" without webhooks. The daily scheduler remains the source of truth for removals.

---

## Data Sources

- **Bookings:** MongoDB `cloudbeds_reservations` – `startDate`, `endDate`, `propertyID`/`propertyId`, `guestEmail`, `status`
- **Property names:** PostgreSQL `destinations` (`property_id` → `name`) – **primary source**; fallback: reservation `propertyName` or `destinationInfo.name`, then `propertyId`. Ensure `destinations` has all Cloudbeds property IDs for correct channel names.
- **User mapping:** `guestEmail` → `customers` (PostgreSQL) → `customer_{id}` in Sendbird

### Customer Identification (Email Only)

Guests are matched to Sendbird users **by email only**. The sync does **not** use `guestID`, `profileID`, or any Cloudbeds profile identifier.

| Source | Field used | Purpose |
|--------|------------|---------|
| MongoDB `cloudbeds_reservations` | `guestEmail` or `guestDetails.email` | Get email for each reservation |
| PostgreSQL `customers` | `email` | Look up customer and get `id` |
| Not used | `guestID`, `profileID` | Ignored |

**A customer** = a row in PostgreSQL `customers` table. Typically created when the user signs up or logs in to the Mad Monkey app. Walk-in or import-only bookings do not create customers automatically.

**Verify if someone is a customer:**

```sql
SELECT id, email, first_name, last_name, created_at 
FROM customers 
WHERE email = 'guest@example.com';
```

If no row is returned, that guest cannot be added to the property group chat.

**Local PostgreSQL** (from `docker-compose.local.yml`): host=localhost, port=5432, db=madmonkey, user=admin, password=password123. Ensure `DATABASE_URL` points to local PostgreSQL if the backend should use it; otherwise the backend may use staging/production.

---

## Story Points

| Task                         | SP  |
| ---------------------------- | --- |
| SendbirdService invite/leave | 2   |
| PropertyGroupChatService     | 8   |
| DB migration                 | 3   |
| API endpoints                | 3   |
| ChatChannelList              | 3   |
| my-chats page                | 2   |
| Ensure-membership + booking hook | 2 |
| Integration tests            | 5   |
| **Total**                    | **28** |

---

## Sendbird supergroup channels

Property group channels use **Sendbird supergroup** channels (same Platform API as group channels, with a higher member limit).

- **Creation:** Channels are created with `is_super: true`, allowing up to **2,000+ members** per channel (Pro plan; varies by Sendbird plan).
- **Initial create limit:** Sendbird allows max **100 users** in the initial `user_ids` array when creating a channel. Additional members are invited via `inviteToChannel` in batches of 100.
- **Channel URL:** Unchanged: `property-group-{propertyId}`. No frontend or API URL changes.
- **Lazy migration:** When sync runs and finds an existing **group** channel (legacy 100-member cap), it upgrades in-place via `PUT /group_channels/{url}` with `is_super: true`. **Message history is preserved.** Sendbird does not allow reusing a `channel_url` after delete, so delete+recreate is not used.

**Supergroup limitations (Sendbird behavior; no code change):**

- **Read/delivery receipts:** Not supported in supergroups.
- **Unread count:** Capped at 99; display as "99+" when at or above 100.
- **Push notifications:** With 100+ members, Sendbird applies a ~10-minute batching window; not every message triggers an immediate push.

**Frontend display (ChatWindow):**

- **Member count:** Use `channel.memberCount` for the displayed total, not `channel.members.length`. The Sendbird SDK truncates the `members` array for supergroups (e.g. to ~10), while `memberCount` holds the true total (e.g. 1006).
- **Channel name:** Display the actual channel name from `channel.name` (e.g. "Mad Monkey Dumaguete") for property group chats. Fallback to "Mad Monkey Chat" only when the channel has no name set.

---

## Risks and Mitigations

1. **Booking sync lag:** Cloudbeds data may be delayed. Document expected sync interval.
2. **Sendbird rate limits:** Batch invite/leave in chunks of 100; add delays if needed.
3. **Empty channels:** A property channel with zero members can exist. Sendbird allows it.
4. **Existing destination channels:** Do not migrate; new flow uses `property_group` only. Old channels can be archived.
5. **Supergroup migration:** First sync after deploy upgrades existing property group channels in-place (no delete); history is preserved.

---

## Files to Modify or Create

| File                                                | Action                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| `backend/src/services/SendbirdService.ts`           | Add `inviteToChannel`, `leaveChannel`, `updateGroupChannel` (supports `is_super` for in-place upgrade), `getAllChannelMemberIds` (paginated – required for supergroups; `channel.members` is truncated) |
| `backend/src/services/PropertyGroupChatService.ts`  | **Create** – scheduler and membership logic                            |
| `backend/src/routes/chat.ts`                        | Add `/property-groups/sync`, `/property-groups/ensure-membership`, `/property-groups`; deprecate destination |
| `backend/src/index.ts`                              | Start PropertyGroupChatService when enabled                            |
| `backend/src/db/`                                   | New migration for property_group_* tables (optional)                   |
| `frontend/components/molecules/ChatChannelList.tsx` | Include `property_group` channels; call `ensure-membership` on load; `includeEmpty: true`; remove destination usage |
| `frontend/components/molecules/ChatWindow.tsx`      | Use `memberCount` for supergroup member display; use `channel.name` for group chat header (e.g. "Mad Monkey Dumaguete") |
| `frontend/pages/my-chats/index.tsx`                 | Remove/simplify `loadDestinationChannels`                              |
| Booking confirmation flow                           | Add call to ensure-membership after successful booking                 |
| OpenAPI + frontend API client                       | Regenerate after new endpoints                                         |

---

## Testing

### Prerequisites

- **MongoDB** – `cloudbeds_reservations` collection with bookings (`startDate`, `endDate`, `propertyID`/`propertyId`, `guestEmail`, `status`)
- **PostgreSQL** – `customers` (email → id), `destinations` (property_id → name)
- **Sendbird** – Env vars set (`SENDBIRD_APP_ID`, `SENDBIRD_API_TOKEN`, etc.)
- **Firebase** – Valid ID token for an authenticated user whose email matches a customer and has a qualifying booking

### 1. Backend API Testing (curl)

All chat endpoints require Firebase auth. Pass the token in the `Authorization` header.

**Obtain a Firebase ID token** (via your app’s login flow or Firebase SDK).

**POST /chat/property-groups/ensure-membership** (short lead time – add user after booking):

```bash
curl -X POST "http://localhost:3000/chat/property-groups/ensure-membership" \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \
  -H "Content-Type: application/json"
```

Expected: `200` with `{ "added": ["property-group-<propertyId>", ...] }` or `{ "added": [] }`.

**POST /chat/property-groups/sync** (manual sync):

```bash
curl -X POST "http://localhost:3000/chat/property-groups/sync" \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>"
```

Expected: `200` with `{ "propertiesProcessed": N, "errors": M }`.

**POST /chat/property-groups/sync?propertyId=269587** (fast, per-property membership-only sync):

- Adds/removes members only for the given property (e.g. Cloudbeds property ID `269587`).
- **Skips the Sendbird user upsert loop** by default, so it runs much faster than a global sync. It assumes users generally exist in Sendbird already (via `/chat/token` or previous full syncs).
- **Retry-on-failure:** If an invite fails with "User not found", the sync upserts the batch to Sendbird and retries once, so a full sync is not required beforehand.

```bash
curl -X POST "http://localhost:3000/chat/property-groups/sync?propertyId=269587" \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>"
```

**POST /chat/property-groups/sync?propertyId=269587&upsertUsers=true** (per-property sync with user upsert):

- Same as above but **runs user upsert** for **that property's guests only** (not all users globally) before inviting. Slower but self-sufficient when many guests have never been synced to Sendbird.
- Use when you want to avoid retry latency or ensure all users exist before inviting.

```bash
curl -X POST "http://localhost:3000/chat/property-groups/sync?propertyId=269587&upsertUsers=true" \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>"
```

**GET /chat/property-groups** (list user’s property group channels):

```bash
curl "http://localhost:3000/chat/property-groups" \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>"
```

Expected: `200` with `{ "channels": [{ "channelUrl", "channelName", "propertyId" }, ...] }`.

### 2. Enable the Scheduler

Set env and restart the backend:

```bash
AUTO_SYNC_PROPERTY_GROUP_CHATS=true
```

Optional: `PROPERTY_GROUP_CHAT_CRON_INTERVAL_MS` (default: 24 hours) to run more often for testing.

Optional: `PROPERTY_GROUP_CHAT_SENDBIRD_DELAY_MS` (default: 250) – delay in ms between each user upsert to avoid Sendbird rate limits (429 Too Many Requests). Sendbird allows ~10 req/sec; each upsert = 2 API calls.

Check logs for: `[PropertyGroupChatService] Starting (every N hours)` and `[PropertyGroupChatService] Scheduled run...`.

**Sync debugging logs:** When adding guests to a property, the service logs each booking that contributes to membership: `[PropertyGroupChatService] Booking {reservationID} ({email}) adds customer_{id} to property {propertyId}`. Use this to trace which reservations keep a user in the channel.

**Supergroup member removal:** Property group channels are supergroups (2k+ members). Sendbird truncates `channel.members` in `getGroupChannel` responses (~100 members). The sync uses `getAllChannelMemberIds()` (paginated via `listChannelMembers`) to fetch the full member list before computing `toRemove`, ensuring cancelled users are correctly removed regardless of channel size.

### 3. Frontend Flow Testing

| Flow | Steps |
|------|-------|
| **my-chats page** | 1. Log in. 2. Go to `/my-chats`. 3. Property group channels (e.g. "Mad Monkey {Property Name}") should appear if you have a booking in the membership window. |
| **Booking (short lead time)** | 1. Log in. 2. Complete a booking with check-in < 14 days away. 3. Land on `/booking/thanks`. 4. `ensure-membership` is called automatically. 5. Open `/my-chats` – the property group channel should appear. |
| **Removal after checkout** | 1. Ensure a guest’s checkout + 3 days is in the past. 2. Wait for the next scheduler run (or trigger sync via API). 3. Guest should be removed from the channel and it should disappear from their list. |

### 4. Verify Membership Window

- **Add:** `today` in `[checkIn - 14d, checkOut + 3d]`
- **Remove:** `today > checkOut + 3d`

Use test bookings with dates that fall inside/outside this window to confirm add/remove behavior.

### 5. Common Issues

| Issue | Check |
|-------|-------|
| 401 Unauthorized | Firebase token missing, expired, or invalid |
| 404 Customer not found | User email not in `customers` table |
| Empty `added` array | No qualifying bookings (date window, status), or user already a member |
| Channels not in Sendbird | MongoDB/PostgreSQL data present; scheduler or `ensure-membership` logs; Sendbird env vars |
| Channel shows "Mad Monkey 269587" instead of property name | Add/update row in `destinations` with `property_id = '269587'` and `name = 'Manila'` (or correct name). Refresh `/my-chats` – ensure-membership will update the channel. |
| Guest not removed 3 days after checkout | Sync runs in two passes: (1) properties with active bookings in overlap window, (2) all existing `property_group` channels not in pass 1 – those have desired members = empty, so all members are removed. Run `POST /chat/property-groups/sync` to trigger. |
| User still in channel after sync (should have been removed) | **Fixed:** The sync uses `getAllChannelMemberIds()` (paginated) instead of `channel.members`, which Sendbird truncates for supergroups (~100 members). Cancelled users beyond the truncation were never in `toRemove`. See `backend/src/services/SendbirdService.ts` (`getAllChannelMemberIds`) and `PropertyGroupChatService.ts` (Pass 1 and Pass 2). |
| Guest not added (has confirmed booking) | See "Why a guest might not be added" below |
| "User" not found on per-property sync | Use `?upsertUsers=true` to run user upsert for that property's guests first, or retry—the sync will upsert missing users and retry invites on failure |

### Why a Guest Might Not Be Added

1. **Canceled reservation** – Status must not be `canceled`, `no_show`, `Cancelled`, or `CANCELLED`.
2. **Missing `guestEmail`** – Reservation must have `guestEmail` or `guestDetails.email` in MongoDB. Import script may omit it; use `getReservationById` for full payload.
3. **Not a customer** – Guest email must exist in PostgreSQL `customers` table. Check: `SELECT id, email FROM customers WHERE email = 'guest@example.com';`
4. **Date overlap** – Booking must overlap `[today - 3 days, today + 14 days]`. Far-past or far-future bookings are excluded from the initial query.
5. **Outside membership window** – For add: `today` must be in `[checkIn - 14d, checkOut + 3d]`. If check-in is months away, guest is not added yet.

### Triggering Sync Manually

**Unix/macOS (curl):**

```bash
curl -X POST "http://localhost:8000/chat/property-groups/sync" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json"
```

**Windows PowerShell** (PowerShell `curl` is an alias for `Invoke-WebRequest`; use `curl.exe` or `Invoke-RestMethod`):

```powershell
# Option 1: Invoke-RestMethod
$token = "YOUR_FIREBASE_TOKEN"
Invoke-RestMethod -Uri "http://localhost:8000/chat/property-groups/sync" -Method POST -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }

# Option 2: Real curl
curl.exe -X POST "http://localhost:8000/chat/property-groups/sync" -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" -H "Content-Type: application/json"
```

**Note:** Use `Authorization: Bearer <token>` (include "Bearer "). Get a fresh token via Firebase; tokens expire in ~1 hour.

---

## Acceptance Criteria Checklist

| AC                                  | Implementation                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| AC1: Standard lead time (14+ days)  | Scheduler adds guest when `today >= checkIn - 14`                                            |
| AC2: Short lead time (< 14 days)    | Post-booking `ensure-membership` endpoint called after checkout                              |
| AC3: Removal after checkout         | Scheduler removes when `today > checkOut + 3`. Sync has two passes: Pass 1 syncs properties with bookings in overlap window; Pass 2 lists all `property_group` channels and removes all members from channels whose property has no active bookings (enforces removal for past checkouts). |
| AC4: Valid membership window        | Algorithm enforces `[max(today, checkIn-14), checkOut+3]`                                    |
| AC5: Property isolation             | One channel per property; guest in A only in A's channel; multi-property = multiple channels |
