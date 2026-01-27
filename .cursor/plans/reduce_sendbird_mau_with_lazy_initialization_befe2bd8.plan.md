---
name: Reduce Sendbird MAU with Lazy Initialization
overview: Implement lazy initialization for Sendbird chat to reduce monthly active users by only connecting when users actually access chat features, instead of connecting all logged-in users automatically.
todos:
  - id: "1"
    content: "Update chatContext.tsx: Remove auto-initialization useEffect (lines 429-436), change initial state from 'INITIALIZING' to 'CLOSED' (lines 47, 78), add comment explaining lazy initialization"
    status: completed
  - id: "2"
    content: "Update my-chats/index.tsx: Add initialize to useChat destructuring, add useEffect to initialize chat on page mount (after rehydrated check)"
    status: in_progress
  - id: "3"
    content: "Update travelers/[id].tsx: Add initialize to useChat destructuring, update handleMessageClick to initialize chat if not initialized before creating channel"
    status: pending
  - id: "4"
    content: "Add dedicated SENDBIRD_MAU logs in sendbirdClient.ts: Add prominent log in connect() method immediately after sb.connect() success with format '[SENDBIRD_MAU] ✅ USER ACTIVE - Connected to Sendbird' including userId and timestamp. Add logs in disconnect() and initialize() methods."
    status: pending
  - id: "5"
    content: "Add dedicated SENDBIRD_MAU logs in chatContext.tsx: Log initialization start/completion with '[SENDBIRD_MAU]' tag, including userId, customerId, timestamp, and countsTowardMAU flag. Log when initialization is skipped and why."
    status: completed
  - id: "6"
    content: "Add initialization trigger logs in my-chats/index.tsx and travelers/[id].tsx: Log when page/button triggers chat initialization with '[SENDBIRD_MAU]' tag and trigger source"
    status: pending
  - id: "7"
    content: "Update documentation: Update MY_CHATS_COMPREHENSIVE_DOCUMENTATION.md and SENDBIRD_INTEGRATION.md to reflect lazy initialization approach - remove references to 'auto-initializes on login', update initialization flow diagrams, add MAU tracking logging section, and document lazy initialization behavior"
    status: pending
isProject: false
---

# Plan: Reduce Sendbird Monthly Active Users with Lazy Initialization

## Problem

Currently, Sendbird chat auto-initializes when users log in, causing every logged-in user to connect to Sendbird and count as a monthly active user (MAU), even if they never use chat. This results in 5,161 MAU exceeding the 5,000 limit.

## Solution

Implement lazy initialization: only connect to Sendbird when users actually access chat features (visit `/my-chats` page or click message buttons), not on login.

## Changes Required

### 1. Update Chat Context (`frontend/contexts/chatContext.tsx`)

**Remove auto-initialization:**

- Remove the `useEffect` hook that auto-initializes on login (lines 429-436)
- Change initial connection state from `"INITIALIZING"` to `"CLOSED"` (lines 47 and 78)
- Add comment explaining lazy initialization approach

**Add enhanced Android logging:**

- Add detailed logs when connecting/disconnecting with user ID and timestamp
- Use tag format `SENDBIRD_MAU` for easy filtering in Android logcat
- Log when user becomes active (counts toward MAU)

### 2. Update My Chats Page (`frontend/pages/my-chats/index.tsx`)

**Add lazy initialization:**

- Add `initialize` to `useChat()` destructuring (line 52)
- Add `useEffect` hook to initialize chat when page mounts (after line 70)
- Only initialize if `rehydrated && !isInitialized && !isConnected`
- Add error handling for initialization failures

### 3. Update Travelers Page (`frontend/pages/travelers/[id].tsx`)

**Add lazy initialization on message button click:**

- Add `initialize` to `useChat()` destructuring (line 82)
- Update `handleMessageClick` function (line 205) to initialize chat if not initialized
- Instead of showing error, attempt initialization and retry channel creation
- Add loading state while initializing

### 4. Enhanced Android Logging (`frontend/services/sendbirdClient.ts`)

**Add dedicated MAU tracking logs:**

- **In `connect()` method (line 60) - CRITICAL LOG:**
- Add prominent log immediately after successful `sb.connect()` call (line 71)
- Format: `console.log("[SENDBIRD_MAU] ✅ USER ACTIVE - Connected to Sendbird", { userId: this.config.userId, timestamp: new Date().toISOString(), event: "CONNECTION", countsTowardMAU: true })`
- This log marks when user becomes active and counts toward MAU
- Also log connection attempt start: `console.log("[SENDBIRD_MAU] 🔄 Connecting to Sendbird...", { userId: this.config.userId, timestamp: new Date().toISOString() })`

- **In `disconnect()` method (line 115):**
- Add log: `console.log("[SENDBIRD_MAU] ❌ USER DISCONNECTED - Disconnected from Sendbird", { userId: this.config?.userId || "unknown", timestamp: new Date().toISOString(), event: "DISCONNECTION" })`
- Log before calling `sb.disconnect()`

- **In `initialize()` method (line 31):**
- Add log at start: `console.log("[SENDBIRD_MAU] 🚀 Initializing Sendbird client", { userId: config.userId, appId: config.appId, timestamp: new Date().toISOString() })`
- Add log after successful initialization: `console.log("[SENDBIRD_MAU] ✅ Sendbird client initialized successfully", { userId: config.userId, timestamp: new Date().toISOString() })`

**Add enhanced logging in ChatContext (`frontend/contexts/chatContext.tsx`):**

- **In `initialize()` function (line 222):**
- Add log at start: `console.log("[SENDBIRD_MAU] 📍 Chat initialization requested", { userId: customer?.id, timestamp: new Date().toISOString(), trigger: "USER_ACTION" })`
- Add log after successful connection: `console.log("[SENDBIRD_MAU] ✅ Chat initialized - User is now active in Sendbird", { userId: tokenResponse.userId, customerId: customer?.id, timestamp: new Date().toISOString(), countsTowardMAU: true })`
- Add log if initialization skipped: `console.log("[SENDBIRD_MAU] ⏭️ Skipping initialization", { reason: "already_connected" | "not_logged_in", timestamp: new Date().toISOString() })`

- **Add log when initialization is triggered from pages:**
  - In `my-chats/index.tsx`: Log when page triggers initialization
  - In `travelers/[id].tsx`: Log when message button triggers initialization

### 5. Update Documentation

**Update `docs/MY_CHATS_COMPREHENSIVE_DOCUMENTATION.md`:**

- **Update Architecture Overview (line 33):**
  - Change: "Page loads → ChatContext initializes Sendbird" 
  - To: "Page loads → User accesses chat feature → ChatContext initializes Sendbird (lazy initialization)"

- **Update ChatContext section (line 263):**
  - Remove: "Auto-initializes on login"
  - Add: "Lazy initialization: Only initializes when user accesses chat features (visits /my-chats or clicks message button)"
  - Add explanation of MAU reduction strategy

- **Add new section: "Lazy Initialization & MAU Management":**
  - Explain why lazy initialization is implemented (reduce Sendbird MAU)
  - Document when initialization occurs (page mount, message button click)
  - Document initialization triggers and flow
  - Add Android logging section with SENDBIRD_MAU tag filtering instructions
  - Include logcat commands for testing

**Update `docs/SENDBIRD_INTEGRATION.md`:**

- **Update Frontend Integration section (line 161):**
  - Change: "Fetch Sendbird token from the backend immediately after Firebase auth completes"
  - To: "Fetch Sendbird token from the backend when user accesses chat features (lazy initialization)"

- **Update Context & State section (line 164):**
  - Remove: "Auto-initialize push notifications on native platforms"
  - Clarify: Push notifications initialize independently, but Sendbird token registration happens after chat connection

- **Add new section: "Monthly Active Users (MAU) Management":**
  - Explain Sendbird MAU billing model (users counted on connection, not user creation)
  - Document lazy initialization strategy to reduce MAU
  - Explain when users become active (connection events)
  - Add Android logging section with SENDBIRD_MAU tag for tracking
  - Include testing guide with logcat filter commands
  - Document expected log flows for different scenarios

## Expected Impact

- **Before:** All logged-in users connect → ~5,161 MAU
- **After:** Only users who access chat connect → Significant reduction (depends on actual chat usage)
- **Example:** If only 20% of users use chat → ~1,032 MAU (80% reduction)

## Testing Strategy

1. **Android Logcat Filtering:**

- Use filter: `SENDBIRD_MAU` to see all MAU-related events
- Filter for `USER ACTIVE` to see when users become active (count toward MAU)
- Filter for `USER DISCONNECTED` to see when users disconnect
- Filter for `Skipping initialization` to verify lazy initialization is working
- Monitor connection/disconnection events with user IDs and timestamps

2. **Expected Log Flow Examples:**

**Scenario 1: User logs in but doesn't use chat**

```
[No SENDBIRD_MAU logs should appear]
```

**Scenario 2: User visits /my-chats page**

```
[SENDBIRD_MAU] 📍 Chat initialization requested { userId: 123, timestamp: "2026-01-27T10:30:00.000Z", trigger: "USER_ACTION" }
[SENDBIRD_MAU] 🚀 Initializing Sendbird client { userId: "customer_123", appId: "...", timestamp: "2026-01-27T10:30:00.100Z" }
[SENDBIRD_MAU] 🔄 Connecting to Sendbird... { userId: "customer_123", timestamp: "2026-01-27T10:30:00.200Z" }
[SENDBIRD_MAU] ✅ USER ACTIVE - Connected to Sendbird { userId: "customer_123", timestamp: "2026-01-27T10:30:00.500Z", event: "CONNECTION", countsTowardMAU: true }
[SENDBIRD_MAU] ✅ Chat initialized - User is now active in Sendbird { userId: "customer_123", customerId: 123, timestamp: "2026-01-27T10:30:00.600Z", countsTowardMAU: true }
```

**Scenario 3: User clicks message button**

```
[SENDBIRD_MAU] 📍 Chat initialization requested { userId: 123, timestamp: "2026-01-27T10:35:00.000Z", trigger: "USER_ACTION" }
[SENDBIRD_MAU] 🚀 Initializing Sendbird client { userId: "customer_123", appId: "...", timestamp: "2026-01-27T10:35:00.100Z" }
[SENDBIRD_MAU] 🔄 Connecting to Sendbird... { userId: "customer_123", timestamp: "2026-01-27T10:35:00.200Z" }
[SENDBIRD_MAU] ✅ USER ACTIVE - Connected to Sendbird { userId: "customer_123", timestamp: "2026-01-27T10:35:00.500Z", event: "CONNECTION", countsTowardMAU: true }
```

**Scenario 4: User disconnects**

```
[SENDBIRD_MAU] ❌ USER DISCONNECTED - Disconnected from Sendbird { userId: "customer_123", timestamp: "2026-01-27T10:40:00.000Z", event: "DISCONNECTION" }
```

3. **Logcat Commands for Testing:**
```bash
# Filter for all MAU-related logs
adb logcat | grep "SENDBIRD_MAU"

# Filter for only connection events (when users become active)
adb logcat | grep "USER ACTIVE"

# Filter for initialization triggers
adb logcat | grep "Chat initialization requested"

# Filter for disconnections
adb logcat | grep "USER DISCONNECTED"

# Combined filter for active users only
adb logcat | grep -E "SENDBIRD_MAU.*USER ACTIVE|SENDBIRD_MAU.*Connected to Sendbird"
```

4. **Test Scenarios:**

- User logs in but doesn't use chat → Should NOT connect
- User visits `/my-chats` → Should connect
- User clicks message button → Should connect
- Deep link to `/my-chats` → Should connect
- Push notification opens chat → Should connect

3. **Verify No Regressions:**

- Push notifications still work (handled by AppPushInitializer)
- Deep links still work (navigates to page, which initializes)
- Chat components handle uninitialized state correctly

## Files to Modify

1. `frontend/contexts/chatContext.tsx` - Remove auto-init, change initial state, add logging
2. `frontend/pages/my-chats/index.tsx` - Add lazy initialization on mount
3. `frontend/pages/travelers/[id].tsx` - Add lazy initialization on message click
4. `frontend/services/sendbirdClient.ts` - Add enhanced Android logging
5. `docs/MY_CHATS_COMPREHENSIVE_DOCUMENTATION.md` - Update initialization flow, remove auto-init references
6. `docs/SENDBIRD_INTEGRATION.md` - Update initialization documentation, add MAU tracking section

## Notes

- Push notifications are handled independently by `AppPushInitializer` and will continue to work
- Deep links navigate to `/my-chats` which will trigger initialization
- All existing chat components already check `isInitialized` before use
- No backend changes required