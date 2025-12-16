# Sendbird Chat Integration - Frontend Documentation

## Overview

This document describes the Sendbird Chat integration in the Mad Monkey frontend application. The chat feature enables real-time messaging between guests with overlapping bookings.

**Status:** ✅ **Production Ready** - Core MVP complete

**Privacy:** The chat system displays only first names (not full names) for better privacy. Full names are never stored in Sendbird or accessible via browser dev tools.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Setup & Configuration](#setup--configuration)
3. [Components](#components)
4. [Usage Guide](#usage-guide)
5. [API Integration](#api-integration)
6. [Troubleshooting](#troubleshooting)

---

## Architecture

### High-Level Flow

```
User Login (Firebase)
    ↓
ChatProvider auto-initializes
    ↓
POST /chat/token → Backend
    ↓
Initialize SendbirdClient with token
    ↓
WebSocket connection established
    ↓
Ready for messaging
```

### Key Components

1. **SendbirdClient** (`services/sendbirdClient.ts`)

   - Wrapper around Sendbird Chat SDK
   - Manages WebSocket connection
   - Handles token refresh and reconnection

2. **ChatProvider** (`contexts/chatContext.tsx`)

   - React context for chat state
   - Auto-initializes on user login
   - Manages connection lifecycle

3. **ChatChannelList** (`components/molecules/ChatChannelList.tsx`)

   - Displays list of conversations
   - Real-time updates via SDK event handlers
   - Search and filtering

4. **ChatWindow** (`components/molecules/ChatWindow.tsx`)
   - Wraps Sendbird UIKit for message interface
   - Responsive (mobile drawer / desktop modal)
   - MUI theme integration

---

## Setup & Configuration

### Prerequisites

1. **Dependencies** (already installed):

   ```json
   {
     "@sendbird/chat": "^4.x",
     "@sendbird/uikit-react": "^3.x"
   }
   ```

2. **Environment Variables** (configured in backend):
   - `NEXT_PUBLIC_API_BASE_URL` - Backend API base URL

### Initialization

The chat system auto-initializes when a user logs in. No manual setup required.

**How it works:**

1. User authenticates via Firebase
2. `ChatProvider` detects login via `useAuth()` hook
3. Automatically calls `POST /chat/token` to get Sendbird credentials
4. Initializes `SendbirdClient` and establishes WebSocket connection

**Manual initialization (if needed):**

```typescript
import { useChat } from "@/contexts/chatContext";

function MyComponent() {
  const { initialize, isInitialized } = useChat();

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, []);
}
```

---

## Components

### ChatProvider

**Location:** `contexts/chatContext.tsx`

**Purpose:** Provides chat state and methods to child components.

**Usage:**

```typescript
import { useChat } from "@/contexts/chatContext";

function MyComponent() {
  const {
    isInitialized, // boolean - Chat client initialized
    isConnected, // boolean - WebSocket connected
    connectionState, // 'INITIALIZING' | 'OPEN' | 'CLOSED' | 'ERROR'
    error, // string | null - Error message if any
    client, // SendbirdClient instance
    tokenData, // { accessToken, userId, appId, expiresAt }
    activeChannel, // GroupChannel | null
    setActiveChannel, // (channel: GroupChannel | null) => void
    initialize, // () => Promise<void>
    disconnect, // () => Promise<void>
    refreshToken, // () => Promise<void>
  } = useChat();
}
```

**Hooks:**

- `useChat()` - Main chat context hook
- `useChatChannel()` - Access active channel only

### ChatChannelList

**Location:** `components/molecules/ChatChannelList.tsx`

**Purpose:** Displays list of chat channels with search and real-time updates.

**Props:**

```typescript
interface ChatChannelListProps {
  onChannelSelect: (channelUrl: string) => void;
  searchQuery?: string; // Optional external search query
}
```

**Usage:**

```typescript
import ChatChannelList from "@/components/molecules/ChatChannelList";

function ChatPage() {
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  return (
    <ChatChannelList
      onChannelSelect={(channelUrl) => {
        setSelectedChannel(channelUrl);
        // Open ChatWindow with channelUrl
      }}
    />
  );
}
```

**Features:**

- ✅ Real-time channel updates
- ✅ Search functionality
- ✅ Unread badge indicators
- ✅ Last message preview
- ✅ Timestamp formatting
- ✅ Empty state handling
- ✅ Loading states

### ChatWindow

**Location:** `components/molecules/ChatWindow.tsx`

**Purpose:** Wraps Sendbird UIKit for message interface.

**Props:**

```typescript
interface ChatWindowProps {
  channelUrl: string; // Required - Sendbird channel URL
  open: boolean; // Controls visibility
  onClose: () => void; // Close handler
  isMobile?: boolean; // Optional - Auto-detected if not provided
  onChannelChange?: (channelUrl: string) => void; // Optional - Callback when channel changes (e.g., after creating new DM)
  inline?: boolean; // Optional - Render inline instead of modal on desktop (default: false)
}
```

**Usage:**

```typescript
import ChatWindow from "@/components/molecules/ChatWindow";
import { useState } from "react";

function TravelersPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [channelUrl, setChannelUrl] = useState<string | null>(null);

  const handleMessageClick = async (recipientCustomerId: number) => {
    // Create channel via API using customer ID (email is looked up internally for privacy)
    const response = await ChatService.postChatChannels({
      requestBody: {
        recipientCustomerId,
      },
    });
    setChannelUrl(response.channelUrl);
    setChatOpen(true);
  };

  return (
    <>
      <Button onClick={() => handleMessageClick(123)}>Message</Button>

      {channelUrl && (
        <ChatWindow
          channelUrl={channelUrl}
          open={chatOpen}
          onClose={() => {
            setChatOpen(false);
            setChannelUrl(null);
          }}
        />
      )}
    </>
  );
}
```

**Features:**

- ✅ Responsive (mobile drawer / desktop modal / inline)
- ✅ MUI theme integration
- ✅ Loading and error states
- ✅ Custom header with channel info and actions
- ✅ Sendbird UIKit for message UI
- ✅ Message search functionality
- ✅ Channel info sidebar/modal (members list, group info)
- ✅ Group chat avatars (composite avatars for 2-4 members)
- ✅ Profile popup Message button interception
- ✅ Channel creation from profile popups
- ✅ Smart channel display names (1:1 shows other user, groups show "Mad Monkey Chat")

---

## Usage Guide

### Starting a Conversation

**Scenario:** User wants to message an overlapping guest.

**Privacy Note:** The chat system uses customer ID instead of email addresses for better privacy and security. Email addresses are never exposed in API requests and are only looked up internally by the backend.

**User Privacy:** Only first names are displayed in chat (not full names). This ensures full names are never stored in Sendbird or accessible via browser dev tools, providing better data minimization and privacy protection.

**Methods:**

#### Method 1: From Travelers Page

**Steps:**

1. User navigates to `/travelers/:reservationId`
2. Sees list of overlapping guests (each guest has a `id` field - customer ID)
3. Clicks "Message" button on a guest
4. Frontend calls `POST /chat/channels` with `recipientCustomerId` (customer ID)
5. Backend looks up recipient email internally and creates/retrieves channel
6. Backend returns `channelUrl`
7. Frontend opens `ChatWindow` with `channelUrl`

#### Method 2: From Profile Popup in Chat

**Steps:**

1. User is in a chat conversation
2. Clicks on a user's avatar or name in a message
3. Sendbird shows profile popup
4. User clicks "Message" button in popup
5. ChatWindow intercepts the click and extracts user ID
6. Parses customer ID from Sendbird user ID (`customer_{id}`)
7. Calls `POST /chat/channels` to create/open DM channel
8. Automatically switches to the new channel (via `onChannelChange` callback)

**Example Implementation:**

```typescript
// In travelers/[id].tsx
import { ChatService } from "@/v3/api";
import ChatWindow from "@/components/molecules/ChatWindow";

const handleMessageClick = async (guestId: number) => {
  try {
    setIsCreatingChannel(true);
    // Use customer ID instead of email for privacy
    const response = await ChatService.postChatChannels({
      requestBody: {
        recipientCustomerId: guestId,
      },
    });
    setSelectedChannelUrl(response.channelUrl);
    setChatWindowOpen(true);
  } catch (error) {
    console.error("Failed to create channel:", error);
    // Show error message to user
  } finally {
    setIsCreatingChannel(false);
  }
};

// With onChannelChange callback for profile popup channel creation
<ChatWindow
  channelUrl={selectedChannelUrl}
  open={chatWindowOpen}
  onClose={() => {
    setChatWindowOpen(false);
    setSelectedChannelUrl("");
  }}
  onChannelChange={(newChannelUrl) => {
    // Automatically switch to new channel when created from profile popup
    setSelectedChannelUrl(newChannelUrl);
    setChatWindowOpen(true);
  }}
/>;
```

### Destination-Based Group Channels

**Scenario:** User wants to chat with travelers at a specific destination (e.g., "Manila") whose bookings overlap with their own.

**Overview:** Destination channels are automatically created for properties where users have upcoming bookings with overlapping guests. Uses **strict overlap logic** - users only see and chat with guests whose bookings directly overlap with their own, ensuring privacy. These channels appear in the `/my-chats` page.

**How It Works:**

1. User visits `/my-chats` page
2. Frontend fetches upcoming bookings with `overlappingGuests`
3. Groups bookings by property/destination
4. For each unique destination, calls `POST /chat/channels/destination`
5. Backend filters to only the user's bookings, then finds overlapping guests (strict overlap)
6. Backend creates/retrieves group channel with only directly overlapping guests
7. Destination channels appear at the top of the channel list

**Strict Overlap Behavior:**

The backend uses strict overlap logic, meaning:

- Users only see guests whose bookings directly overlap with their own bookings
- Different overlapping groups get separate channels (e.g., `destination-manila-100-200` vs `destination-manila-100-300`)
- This ensures privacy: users who don't overlap with each other won't see each other
- Multiple channels per destination are expected and normal

**Implementation:**

```typescript
// In pages/my-chats/index.tsx
import { fetchBookingHistory } from "@/services/v3-services/bookings";
import { ChatService } from "@/v3/api";

useEffect(() => {
  const loadDestinationChannels = async () => {
    // Fetch upcoming bookings
    const bookings = await fetchBookingHistory({ page: 1, limit: 50 });

    // Group by property
    const propertyMap = new Map();
    bookings.bookings.cloudbeds.bookings.forEach((booking) => {
      if (booking.overlappingGuests?.length > 0) {
        const propertyId = booking.propertyID || booking.propertyId;
        if (propertyId && !propertyMap.has(propertyId)) {
          propertyMap.set(propertyId, {
            propertyId,
            propertyName: booking.propertyName || propertyId,
          });
        }
      }
    });

    // Create channels for each destination
    const channels = await Promise.allSettled(
      Array.from(propertyMap.values()).map(async (property) => {
        const response = await ChatService.postChatChannelsDestination({
          requestBody: {
            propertyId: property.propertyId,
            propertyName: property.propertyName,
          },
        });
        return {
          channelUrl: response.channelUrl,
          channelName: response.channelName,
          propertyId: property.propertyId,
        };
      })
    );

    setDestinationChannels(
      channels
        .filter((r) => r.status === "fulfilled" && r.value)
        .map((r) => (r as PromiseFulfilledResult<any>).value)
    );
  };

  loadDestinationChannels();
}, [rehydrated, firebaseToken, customer, isInitialized]);
```

**Display in ChatChannelList:**

```typescript
// In components/molecules/ChatChannelList.tsx
<ChatChannelList
  onChannelSelect={handleChannelSelect}
  destinationChannels={destinationChannels}
  isLoadingDestinations={isLoadingDestinations}
/>
```

**Features:**

- ✅ Automatically created when user has upcoming bookings with overlapping guests
- ✅ Appears at the top of channel list (before regular channels)
- ✅ Labeled with "(Destination)" badge
- ✅ Shows "Chat with other travelers" subtitle
- ✅ Uses strict overlap: only includes guests whose bookings directly overlap with user's bookings
- ✅ Channels persist and are reused if they already exist
- ✅ Multiple channels per destination are expected (one per unique overlapping group)

**Channel Membership (Strict Overlap):**

- Current user (always included)
- **Only** guests whose bookings directly overlap with the user's bookings
- Does NOT include guests who don't overlap with the user, even if they're at the same property
- Only includes guests who have accounts in PostgreSQL

**Example Scenario:**

- Customer A: Dec 11-20 → Sees channel with {A, B, C} (all overlap with A)
- Customer B: Dec 9-12 → Sees channel with {A, B} (only A overlaps with B)
- Customer C: Dec 18-21 → Sees channel with {A, C} (only A overlaps with C)

This creates separate channels: `destination-manila-A-B-C`, `destination-manila-A-B`, `destination-manila-A-C`

**Notes:**

- Only upcoming bookings (endDate >= today) are considered
- Only bookings with `overlappingGuests.length > 0` create channels
- Channels are created on-demand when user visits `/my-chats`
- **Strict overlap logic**: Users only see guests they actually overlap with
- Multiple channels per destination are expected and normal (one per unique overlapping group)
- Channel URLs are deterministic based on sorted user IDs, ensuring same groups get same channels
- If channel creation fails for a destination, it's silently skipped (logged to console)

---

### Viewing Chat List

**Scenario:** User wants to see all their conversations.

**Steps:**

1. User navigates to `/my-chats` page
2. `ChatChannelList` component:
   - Fetches destination channels (if user has upcoming bookings)
   - Queries regular channels via Sendbird SDK
   - Displays destination channels first, then regular channels sorted by last message time
3. Real-time updates when new messages arrive
4. **Auto-open from URL**: If `?channelUrl={url}` is in query params, automatically opens that channel

**Example Implementation:**

```typescript
import ChatChannelList from "@/components/molecules/ChatChannelList";
import ChatWindow from "@/components/molecules/ChatWindow";

function ChatListPage() {
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [destinationChannels, setDestinationChannels] = useState([]);

  return (
    <>
      <ChatChannelList
        onChannelSelect={(channelUrl) => {
          setSelectedChannel(channelUrl);
          setChatOpen(true);
        }}
        destinationChannels={destinationChannels}
      />

      {selectedChannel && (
        <ChatWindow
          channelUrl={selectedChannel}
          open={chatOpen}
          onClose={() => {
            setChatOpen(false);
            setSelectedChannel(null);
          }}
          onChannelChange={(newChannelUrl) => {
            // Handle channel switching (e.g., after creating DM from profile popup)
            setSelectedChannel(newChannelUrl);
            setChatOpen(true);
          }}
          inline={!isMobile} // Inline on desktop, modal on mobile
        />
      )}
    </>
  );
}
```

### Sending Messages

**Scenario:** User sends a message in a chat.

**Implementation:** Handled automatically by Sendbird UIKit. No custom code needed.

**Flow:**

1. User types message in `ChatWindow`
2. Sendbird UIKit sends message via SDK
3. Message delivered to recipient in real-time (< 2s latency)
4. Both users see message immediately via WebSocket

---

## API Integration

### Token Endpoint

**Endpoint:** `POST /chat/token`

**Purpose:** Get Sendbird access token for authenticated user.

**Implementation:**

- Automatically called by `ChatProvider` on login
- Uses OpenAPI-generated `ChatService.postChatToken()`

**Response:**

```typescript
{
  accessToken: string;
  userId: string; // Format: "customer_{id}"
  appId: string;
  expiresAt: number; // Unix timestamp (milliseconds)
}
```

### Channel Creation Endpoint

**Endpoint:** `POST /chat/channels`

**Purpose:** Create or retrieve a direct message channel.

**Request:**

```typescript
{
  recipientCustomerId: number; // Customer ID (email is looked up internally for privacy)
}
```

**Response:**

```typescript
{
  channelUrl: string; // Format: "dm-{user1Id}-{user2Id}"
  channelName: string; // Format: "John & Jane" (first names only)
  createdAt: number; // Unix timestamp (milliseconds)
}
```

**Note:** Channel names use first names only (e.g., "John & Jane" instead of "John Doe & Jane Smith") for privacy. Channel names are computed dynamically from current user nicknames.

**Usage:**

```typescript
import { ChatService } from "@/v3/api";

// Direct message channel (uses customer ID for privacy)
const response = await ChatService.postChatChannels({
  requestBody: {
    recipientCustomerId: 123, // Customer ID instead of email
  },
});

console.log(response.channelUrl); // "dm-123-456"

// Destination-based group channel
const destResponse = await ChatService.postChatChannelsDestination({
  requestBody: {
    propertyId: "12345",
    propertyName: "Manila",
  },
});

console.log(destResponse.channelUrl); // "destination-12345-100-200-300"
console.log(destResponse.channelName); // "Manila"
console.log(destResponse.memberCount); // 3
```

### Channel Listing

**Note:** Frontend uses Sendbird SDK directly for channel listing (no backend API).

**SDK Query:**

```typescript
const { client } = useChat();
const sendbirdInstance = client.getInstance();

const channelListQuery =
  sendbirdInstance.groupChannel.createMyGroupChannelListQuery({
    limit: 50,
    includeEmpty: false,
    order: "latest_last_message",
  });

const channels = await channelListQuery.next();
```

**Real-time Updates:**

- Handled automatically by `ChatChannelList` component
- Uses `GroupChannelHandler` for event listeners
- Updates UI when messages arrive, channels change, etc.

---

## Troubleshooting

### Chat Not Initializing

**Symptoms:**

- `isInitialized` stays `false`
- `connectionState` is `ERROR`
- Error message in `error` state

**Possible Causes:**

1. User not logged in
2. Backend `/chat/token` endpoint failing
3. Sendbird credentials invalid
4. Network issues

**Debug Steps:**

```typescript
const { isInitialized, error, connectionState } = useChat();

console.log("Chat State:", {
  isInitialized,
  connectionState,
  error,
});
```

**Solutions:**

- Check browser console for errors
- Verify user is authenticated
- Check backend logs for token endpoint errors
- Verify `SENDBIRD_APP_ID` and `SENDBIRD_API_TOKEN` in backend

### Channel Creation Fails

**Symptoms:**

- Error when clicking "Message" button
- API call returns 404 or 500

**Possible Causes:**

1. Recipient customer ID not found in database
2. Recipient account incomplete (missing email)
3. User trying to message themselves
4. Backend Sendbird service error

**Debug Steps:**

```typescript
try {
  const response = await ChatService.postChatChannels({
    requestBody: {
      recipientCustomerId: guest.id, // Use customer ID from travelers list
    },
  });
} catch (error) {
  console.error("Channel creation error:", error);
  // Check error.response.data for details
  // Error codes:
  // - RECIPIENT_NOT_FOUND: Customer ID doesn't exist in database
  // - RECIPIENT_INCOMPLETE: Customer exists but has no email (required for Sendbird)
  // - INVALID_RECIPIENT: Trying to message yourself
  // - VALIDATION_ERROR: Invalid customer ID format (must be positive integer)
}
```

**Solutions:**

- Verify recipient customer ID exists in database (should be from travelers list)
- Ensure recipient has an email address (required for Sendbird, looked up internally)
- Check backend logs for detailed error
- Ensure both users exist in Sendbird (handled by backend)
- Verify chat is initialized before clicking message button
- Check that `guest.id` is not null/undefined before calling API

### Messages Not Appearing

**Symptoms:**

- Messages sent but not received
- Real-time updates not working

**Possible Causes:**

1. WebSocket connection lost
2. Token expired
3. Channel not loaded properly

**Debug Steps:**

```typescript
const { isConnected, connectionState } = useChat();

console.log("Connection State:", {
  isConnected,
  connectionState,
});
```

**Solutions:**

- Check `connectionState` - should be `'OPEN'`
- Token auto-refreshes 5 minutes before expiration
- Try refreshing page to reinitialize connection
- Check Sendbird dashboard for channel status

### Token Expiration

**Symptoms:**

- Connection drops after 7 days
- `connectionState` becomes `'ERROR'`

**Solution:**

- Token auto-refreshes 5 minutes before expiration
- If expired, user needs to refresh page or re-login
- Backend token expires after 7 days (604800 seconds)

---

## Best Practices

### 1. Always Check Connection State

```typescript
const { isConnected, isInitialized } = useChat();

if (!isInitialized || !isConnected) {
  return <LoadingState />;
}
```

### 2. Handle Errors Gracefully

```typescript
const { error } = useChat();

if (error) {
  return <ErrorMessage message={error} />;
}
```

### 3. Clean Up on Unmount

```typescript
useEffect(() => {
  return () => {
    // ChatProvider handles cleanup automatically
  };
}, []);
```

### 4. Use SDK for Channel Operations

- Channel listing: Use SDK `MyGroupChannelListQuery`
- Channel deletion: Use SDK `channel.delete()`
- Real-time updates: Use SDK event handlers

### 5. Mobile vs Desktop vs Inline

```typescript
// ChatWindow auto-detects mobile/desktop
// But you can override:
<ChatWindow
  channelUrl={channelUrl}
  open={open}
  onClose={onClose}
  isMobile={true} // Force mobile drawer
  inline={true} // Render inline on desktop (no modal, side-by-side layout)
/>
```

**Rendering Modes:**

- **Mobile**: Full-screen drawer from bottom
- **Desktop Modal** (default): Dialog modal with 80vh height
- **Desktop Inline** (`inline={true}`): Renders inline in parent container (used in `/my-chats` for side-by-side layout)

### 6. Message Search

**Feature:** Search messages within a channel.

**Usage:** Click the search icon in the chat header to open the search modal.

**Implementation:**

- Searches up to 500 messages in the channel
- Filters by message text (case-insensitive)
- Shows results with sender name and timestamp
- Debounced search (300ms delay)

**Example:**

```typescript
// Search is built into ChatWindow - no additional code needed
// User clicks search icon → modal opens → types query → results appear
```

### 7. Channel Info Sidebar/Modal

**Feature:** View channel information, members list, and group details.

**Usage:** Click the info icon in the chat header.

**Desktop:** Opens as a sidebar on the right (when `inline={true}`)
**Mobile:** Opens as a full-screen modal

**Features:**

- Channel avatar and name
- Member count (for group chats)
- Searchable members list (up to 20 visible, "See all" button for more)
- Leave channel button (group chats only)
- Expandable members list in mobile modal

**Implementation:**

```typescript
// Built into ChatWindow - automatically shows:
// - 1:1 DMs: Other user's info
// - Group chats: Group info with member list
```

### 8. Group Chat Avatars

**Feature:** Composite avatars for group chats showing up to 4 members.

**Behavior:**

- **2 members**: Split left/right
- **3-4 members**: 2x2 grid layout
- **Fallback**: Channel cover image or initials

**Implementation:** Automatically rendered in chat header and info sidebar/modal.

### 9. Avatar Click Profile Redirect

**Feature:** Redirects to user profile page when clicking on a user's avatar in a message, instead of opening Sendbird's profile popup.

**How it works:**

1. User clicks on a user's avatar/image in an incoming message (left side)
2. ChatWindow intercepts the click event (capture phase)
3. Prevents Sendbird's default profile popup from opening
4. Extracts user ID from the message using multiple strategies
5. Parses customer ID from Sendbird user ID format (`customer_{id}`)
6. Redirects to `/profile/{customerId}` using Next.js router

**User ID Extraction Methods (in order of priority):**

1. **Stored userId**: Checks if userId was previously extracted and stored in `data-chat-window-user-id` attribute
2. **React Props**: Extracts userId from MessageContent component's React props (via React fiber)
3. **Sendbird SDK**:
   - Loads all messages from the channel
   - Filters to only incoming messages (excludes current user's messages)
   - Matches the clicked message by:
     - Position (reversed index since DOM shows newest first)
     - Message content text
     - Sender name
   - Extracts `user.user_id` from matched message (format: `customer_{id}`)
4. **DOM Attributes**: Searches for `customer_XXX` pattern in all data attributes
5. **Child Elements**: Searches all child elements for userId in attributes
6. **Text Content**: Searches message text content for userId pattern
7. **Avatar Image URL**: Checks if avatar image src contains userId

**Important Notes:**

- **Only incoming messages**: Only processes clicks on `message-content__left` (incoming messages), not `message-content__right` (outgoing/own messages)
- **Current user filtering**: Automatically skips messages from the current user to prevent redirecting to own profile
- **Message matching**: Uses multiple strategies to accurately match the clicked message with SDK messages, accounting for reverse order (newest first in DOM, oldest first in SDK)
- **Fallback strategies**: If position matching fails (`messageIndex: -1`), tries:
  - Single incoming message (if only one exists)
  - Finding which message item contains the clicked avatar
  - Using the most recent incoming message

**Implementation:**

- Uses click event listener with capture phase to intercept before Sendbird's handlers
- MutationObserver watches for new MessageContent components and extracts userIds
- Periodic check (every 2 seconds) to extract userIds from all existing messages
- Stores extracted userIds in `data-chat-window-user-id` for quick access

**Example:**

```typescript
// User clicks avatar in message from customer_73691
// Code extracts userId: "customer_73691"
// Parses customer ID: 73691
// Redirects to: /profile/73691
```

### 10. Profile Popup Message Button Interception

**Feature:** Intercepts Sendbird's default "Message" button in profile popups to use our channel creation flow.

**How it works:**

1. User clicks on a user's avatar/name in a message
2. Sendbird shows profile popup with "Message" button
3. ChatWindow intercepts the click event
4. Extracts user ID from the popup (multiple fallback methods)
5. Parses customer ID from Sendbird user ID format (`customer_{id}`)
6. Calls `handleCreateChannel()` to create/open DM channel
7. Switches to the new channel via `onChannelChange` callback

**User ID Extraction Methods (in order):**

1. Data attributes (`data-user-id`, `data-userid`, `data-sb-user-id`)
2. Text content after "User ID" label
3. Class names or element IDs containing user ID pattern
4. All text content in modal (regex: `customer_\d+`)
5. Avatar image URL
6. React internal props (experimental)
7. ARIA labels or titles

**Implementation:** Uses MutationObserver to watch for profile popups and adds click handlers with capture phase to intercept before Sendbird's handlers.

**Note:** User ID section in Sendbird profile popup is hidden via CSS (privacy). This feature is now less commonly used since avatar clicks redirect directly to profile pages (see section 9).

### 11. Channel Display Names

**Feature:** Smart channel name display based on channel type.

**Logic:**

- **1:1 DMs**: Shows other user's nickname (first name only) or userId if no nickname
- **Group chats**: Shows "Mad Monkey Chat"
- **Fallback**: Channel name from Sendbird

**Privacy:** Nicknames in Sendbird contain only first names (not full names), ensuring full names are never displayed or accessible via frontend code.

**Implementation:** `getChannelDisplayName()` function in ChatWindow.

### 11. Auto-Open from Query Parameter

**Feature:** Automatically open a chat channel from URL query parameter.

**Usage:** Navigate to `/my-chats?channelUrl={channelUrl}`

**Implementation:**

```typescript
// In pages/my-chats/index.tsx
// Automatically opens channel if channelUrl is in query params
// Removes query param after opening (shallow routing)
```

**Use Cases:**

- Deep linking to specific conversations
- Redirecting after channel creation
- Opening channels from external links

---

## File Structure

```
frontend/
├── services/
│   └── sendbirdClient.ts          # Sendbird SDK wrapper
├── contexts/
│   └── chatContext.tsx            # Chat state management
├── components/
│   └── molecules/
│       ├── ChatChannelList.tsx    # Channel list component
│       └── ChatWindow.tsx         # Message interface wrapper with:
│                                   #   - Search functionality
│                                   #   - Info sidebar/modal
│                                   #   - Group avatars
│                                   #   - Avatar click profile redirect
│                                   #   - Profile popup interception
├── types/
│   └── sendbird.ts                # TypeScript types
└── pages/
    ├── travelers/
    │   └── [id].tsx                # Travelers page with Message buttons
    └── my-chats/
        └── index.tsx               # Chat list page with:
                                    #   - Destination channels
                                    #   - Auto-open from query param
                                    #   - Side-by-side layout (desktop)
```

---

## Related Documentation

- [Backend Chat API Documentation](../backend/docs/SENDBIRD_CHAT_API.md)
- [Sendbird Chat SDK Docs](https://sendbird.com/docs/chat)
- [Sendbird UIKit Docs](https://sendbird.com/docs/uikit)

---

## Support

For issues or questions:

1. Check browser console for errors
2. Review backend logs for API errors
3. Check Sendbird dashboard for channel status
4. Refer to troubleshooting section above
