# My Chats Page - Comprehensive Documentation

## Overview

This document provides a complete overview of the `/my-chats` page implementation, including all components, integrations, UI/UX patterns, keyboard handling, swipe gestures, push notifications, and platform-specific features.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Page Structure](#page-structure)
3. [Components](#components)
4. [Sendbird Integration](#sendbird-integration)
5. [Push Notifications](#push-notifications)
6. [Keyboard Handling](#keyboard-handling)
7. [Swipe Gestures](#swipe-gestures)
8. [Desktop vs Mobile Layouts](#desktop-vs-mobile-layouts)
9. [Capacitor Integration](#capacitor-integration)
10. [Imports & Dependencies](#imports--dependencies)
11. [UI/UX Features](#uiux-features)
12. [State Management](#state-management)
13. [Error Handling](#error-handling)
14. [Performance Optimizations](#performance-optimizations)

---

## Architecture Overview

### High-Level Flow

```
User navigates to /my-chats
    ↓
Page loads → ChatContext initializes Sendbird
    ↓
Fetch Sendbird token from backend (/chat/token)
    ↓
Initialize Sendbird SDK with token
    ↓
Load channel list (group channels + open channels)
    ↓
User selects channel → Open ChatWindow
    ↓
Sendbird UIKit renders channel messages
    ↓
Push notifications register (native apps only)
```

### Key Technologies

- **Frontend Framework**: Next.js (React)
- **UI Library**: Material-UI (MUI)
- **Chat SDK**: Sendbird UIKit React (`@sendbird/uikit-react`)
- **Mobile Framework**: Capacitor (iOS/Android)
- **State Management**: React Context (ChatContext)
- **Push Notifications**: Capacitor Push Notifications + Custom Providers

---

## Page Structure

### Main Page: `/my-chats/index.tsx`

**Location**: `frontend/pages/my-chats/index.tsx`

**Key Responsibilities**:
- Authentication check (redirects if not logged in)
- Chat initialization state management
- Layout orchestration (desktop vs mobile)
- Channel selection handling
- Deep linking support (`channelUrl` query parameter)
- Notification permission prompts
- Swipe gesture handling for navigation

**Layout Structure**:
```typescript
<Layout>
  <Container/Box>
    <ChatChannelList />  {/* Left sidebar on desktop, full width on mobile */}
    <ChatWindow />       {/* Right side on desktop, modal/drawer on mobile */}
  </Container/Box>
</Layout>
```

**State Management**:
- `selectedChannelUrl`: Currently open channel
- `chatOpen`: Whether chat window is visible (mobile)
- `retryCount`: Connection retry attempts
- `showNotificationPrompt`: Notification permission modal state

**Key Features**:
- **Auto-retry**: Automatically retries connection on failure (max 3 attempts)
- **Deep Linking**: Supports `?channelUrl=xxx` query parameter to auto-open channels
- **Back Navigation**: Handles browser/app back button to close chat on mobile
- **Media Viewer**: Closes Sendbird image/file viewer before navigation

---

## Components

### 1. ChatChannelList Component

**Location**: `frontend/components/molecules/ChatChannelList.tsx`

**Purpose**: Displays list of chat channels with search functionality

**Features**:
- **Channel Types**: Supports Group Channels (1:1 DMs, group chats) and Open Channels
- **Real-time Updates**: Uses Sendbird event handlers for live channel updates
- **Search**: Client-side filtering by channel name or last message
- **Sorting**: Channels sorted by last message timestamp (newest first)
- **Customer Service**: Special "Mad Monkey Customer Support" item (opens FreshChat)
- **Avatars**: 
  - 1:1 DMs: Show other user's profile picture
  - Group chats: Split-circle avatar showing 2 members
  - Open channels: Channel cover image
- **Unread Badges**: Shows unread message count
- **Last Message Preview**: Shows last message text and timestamp

**Channel Display Logic**:
```typescript
// Only shows 1:1 DMs (filtered from group channels)
const dmChannelsOnly = groupChannels.filter((ch) => isDirectMessage(ch));

// Customer service always first, then DMs sorted by last message
const allChannels = [
  { isCustomerService: true },
  ...dmChannelsOnly.map(ch => ({ channel: ch }))
].sort((a, b) => {
  // Customer service first, then by timestamp
});
```

**Event Handlers**:
- `GroupChannelHandler`: Listens for channel changes, message received, user joined/left
- `OpenChannelHandler`: Listens for open channel updates

**Real-time Updates**:
- New messages move channel to top
- Channel updates reflect immediately
- Deleted channels removed from list

---

### 2. ChatWindow Component

**Location**: `frontend/components/molecules/ChatWindow.tsx`

**Purpose**: Main chat interface wrapping Sendbird UIKit Channel component

**Key Features**:

#### Custom Header
- **Desktop**: Inline header with avatar, name, search, info buttons
- **Mobile**: Full-width header with back button
- **Group Chats**: Shows split-circle avatar or group avatar
- **1:1 DMs**: Shows other user's profile picture

#### Sendbird UIKit Integration
- Uses `SendBirdProvider` and `Channel` components from `@sendbird/uikit-react`
- Custom CSS overrides to match MUI theme
- Hidden default Sendbird headers (using custom header)
- Custom message bubble styling (teal for outgoing, gray for incoming)

#### Search Functionality
- Modal-based search interface
- Searches through channel messages (up to 500 messages)
- Filters by message text content
- Shows search results with message preview

#### Info Modal/Sidebar
- **Mobile**: Full-screen modal
- **Desktop**: Sidebar panel
- Shows channel information:
  - Channel name
  - Member list (for group chats)
  - Member count
  - Channel type (DM vs Group)
- **Group Chats**: "Leave channel" button

#### Profile Popup Interception
- Hides Sendbird's "User ID" field
- Intercepts "Message" button clicks
- Extracts user ID from profile popup
- Creates/opens DM channel with that user
- Multiple extraction methods (React props, data attributes, text content)

#### Message Interaction
- Right-click context menu for copying messages
- Avatar click opens profile popup
- Message reactions support
- File/image upload support

#### Image Attachments & Preview
- ✅ **Image Compression**: 70% quality, max 1080x1920 resolution
- ✅ **Multiple Files**: Up to 10 images per message
- ✅ **Responsive Display**: Images fit screen width on all devices
- ✅ **Full-Screen Preview**: Click image to view in lightbox
- ✅ **Close Button**: Visible and properly aligned (16px from right edge)
- ✅ **Mobile Optimized**: Touch-friendly close button (44px), pinch-to-zoom support
- ✅ **Aspect Ratio**: Preserved (no distortion)
- ✅ **Filename Hidden**: Filename hidden in preview header to prevent layout issues (exact class: `sendbird-fileviewer__header__left__filename`)
- **Documentation**: See `docs/frontend/SENDBIRD_IMAGE_ATTACHMENT_ANALYSIS.md` and `docs/frontend/SENDBIRD_IMAGE_PREVIEW_CLOSE_FLOW.md`

**Props**:
```typescript
interface ChatWindowProps {
  channelUrl: string;        // Sendbird channel URL
  open: boolean;            // Whether window is visible
  onClose: () => void;      // Close handler
  isMobile?: boolean;       // Mobile vs desktop
  onChannelChange?: (url: string) => void;  // Channel switch handler
  inline?: boolean;         // Inline vs modal (desktop)
}
```

---

## Sendbird Integration

### Connection Flow

1. **Token Fetch**: Backend endpoint `/chat/token` returns:
   ```typescript
   {
     appId: string;
     userId: string;
     accessToken: string;
     expiresAt?: number;
   }
   ```

2. **SDK Initialization**: 
   ```typescript
   SendbirdChat.init({
     appId: tokenData.appId,
     modules: [new GroupChannelModule()]
   })
   ```

3. **Connection**:
   ```typescript
   await sb.connect(userId, accessToken)
   ```

4. **Channel Loading**:
   ```typescript
   const query = sb.groupChannel.createMyGroupChannelListQuery({
     limit: 50,
     includeEmpty: false,
     order: "latest_last_message"
   })
   const channels = await query.next()
   ```

### ChatContext (`frontend/contexts/chatContext.tsx`)

**Responsibilities**:
- Manages Sendbird client lifecycle
- Handles token fetching and refresh
- Manages connection state
- Initializes push notifications (native apps)
- Auto-initializes on login
- Cleans up on logout

**State**:
- `isInitialized`: SDK initialized
- `isConnected`: Connected to Sendbird
- `connectionState`: "INITIALIZING" | "CONNECTING" | "OPEN" | "CLOSED" | "ERROR"
- `error`: Error message if connection fails
- `client`: SendbirdClient instance
- `tokenData`: Token response from backend
- `activeChannel`: Currently active channel

**Methods**:
- `initialize()`: Initialize and connect
- `disconnect()`: Disconnect and cleanup
- `refreshToken()`: Refresh access token

**Push Notification Setup**:
```typescript
// After successful connection
await client.setPushTriggerOption("all");  // Enable push for all messages

// Initialize push service (native only)
if (Capacitor.isNativePlatform()) {
  const pushService = getPushNotificationService();
  await pushService.initialize();
  
  // Register token with providers
  pushService.onTokenReceived(async (token) => {
    await registrationManager.registerWithProviders(token);
  });
}
```

### SendbirdClient Service (`frontend/services/sendbirdClient.ts`)

**Wrapper around Sendbird SDK**:
- Connection management
- Token refresh handling
- Error handling with retry logic
- Push token registration (iOS APNs, Android FCM)
- Foreground/background state management

**Key Methods**:
- `initialize(config)`: Initialize SDK
- `connect(token)`: Connect with access token
- `getChannel(url)`: Get channel by URL
- `registerPushToken(token, platform)`: Register push token
- `setPushTriggerOption(option)`: Configure push behavior

---

## Push Notifications

### Architecture

**Provider-Based System**:
- `PushNotificationService`: Core service handling platform detection, permissions, token management
- `PushTokenRegistrationManager`: Orchestrates registration with multiple providers
- **Providers**:
  - `SendbirdPushProvider`: Registers tokens with Sendbird
  - `KlaviyoPushProvider`: Registers tokens with Klaviyo (requires email)

### Flow

```
App Launch (Native)
    ↓
PushNotificationService.initialize()
    ↓
Check permissions → Request if needed
    ↓
Register for push notifications
    ↓
Receive device token (APNs/FCM)
    ↓
Register with providers:
    - Sendbird (always)
    - Klaviyo (if email available)
    ↓
Token stored and ready
```

### Platform-Specific Implementation

#### iOS (APNs)
- **Token Format**: Hexadecimal string (64, 128, or 160 chars)
- **Registration**: `sb.registerAPNSPushTokenForCurrentUser(token)`
- **Image Support**: Native attachments array
- **Badge**: Supported via LocalNotifications
- **Grouping**: `threadIdentifier` for channel grouping

#### Android (FCM)
- **Token Format**: Base64 string
- **Registration**: `sb.registerFCMPushTokenForCurrentUser(token)`
- **Image Support**: 
  - Custom `FileUriConverterPlugin` for secure URI conversion
  - Downloads images to cache
  - Converts `file://` URIs to `content://` URIs via FileProvider
  - Big picture style for expanded notifications
- **Channel**: `chat_messages_v2` notification channel
- **Grouping**: `group` property for channel grouping

### Notification Handling

#### Foreground Notifications
- App shows local notification when in foreground
- Images downloaded and cached (Android)
- Badge count updated
- Message deduplication (prevents duplicate notifications)

#### Background/Closed App
- System handles notifications
- Deep linking to channels on tap
- Early listener setup for closed app launches

#### Deep Linking
- Sendbird notifications: Navigate to `/my-chats?channelUrl=xxx`
- Klaviyo notifications: Navigate to deep link URL
- Handles navigation before router is ready (queues actions)

### Image Support

**iOS**:
```typescript
attachments: [{ id: "image", url: imageUrl }]
```

**Android**:
```typescript
// Download and cache image
const localImagePath = await downloadAndCacheImage(imageUrl);

// Convert to content:// URI
const contentUri = await convertFileUriToContentUri(localImagePath);

// Use custom native plugin
await FileUriConverter.showNotificationWithImage({
  title,
  body,
  imageUri: contentUri,
  largeIconUri: profilePictureUri
});
```

### Critical Fixes Applied

1. **Plugin Registration Timing (Android)**: Plugins must be registered BEFORE `super.onCreate()` in `MainActivity.java`
2. **FileUriConverterPlugin**: Custom Capacitor plugin for secure image URI conversion
3. **Java 21 Requirement**: Capacitor Filesystem plugin requires Java 21
4. **iOS Settings Fix**: Fallback chain for opening notification settings (`PushNotifications.openSettings()` → `NativeSettings.open()` → `App.openSettings()`)

---

## Keyboard Handling

### Implementation (`ChatWindow.tsx`)

**Capacitor Keyboard Plugin**:
```typescript
import { Keyboard } from "@capacitor/keyboard";
import type { KeyboardInfo } from "@capacitor/keyboard";
```

**Setup** (Native apps only):
```typescript
useEffect(() => {
  if (!open || !Capacitor.isNativePlatform()) return;

  const handleKeyboardShow = (info: KeyboardInfo) => {
    const inputElement = document.querySelector(
      '.sendbird-message-input-wrapper'
    );
    
    if (inputElement) {
      setTimeout(() => {
        const keyboardHeight = info.keyboardHeight;
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        const targetBottom = viewportHeight - keyboardHeight - 10; // 10px gap
        
        // Scroll to position input above keyboard
        const inputRect = inputElement.getBoundingClientRect();
        if (inputRect.bottom > targetBottom) {
          const scrollAmount = inputRect.bottom - targetBottom;
          window.scrollBy({ top: scrollAmount, behavior: "smooth" });
        }
      }, 200); // Wait for keyboard animation
    }
  };

  const [show, didShow, hide] = await Promise.all([
    Keyboard.addListener("keyboardWillShow", handleKeyboardShow),
    Keyboard.addListener("keyboardDidShow", handleKeyboardShow),
    Keyboard.addListener("keyboardWillHide", handleKeyboardHide)
  ]);

  return () => {
    show.remove();
    didShow.remove();
    hide.remove();
  };
}, [open]);
```

**CSS Adjustments**:
- Input font-size: `16px` minimum (prevents iOS zoom on focus)
- Input wrapper: `z-index: 1000` to stay above keyboard
- Letter spacing: `0.5px` for better cursor positioning

**Platform-Specific**:
- **iOS**: Uses `keyboardWillShow` and `keyboardDidShow` events
- **Android**: Uses same events, but may need `adjustPan` in AndroidManifest.xml

---

## Swipe Gestures

### Implementation

**Library**: `react-swipeable`

**Chat List Swipe** (`/my-chats/index.tsx`):
```typescript
const chatListSwipeHandlers = useSwipeable({
  onSwipedRight: () => {
    if (isMobile && !chatOpen) {
      router.back();  // Navigate back to previous page
    }
  },
  trackMouse: false,        // Touch only
  preventScrollOnSwipe: false,  // Allow normal scrolling
  delta: 50,                 // Minimum swipe distance (50px)
  trackTouch: true,
  swipeDuration: 500         // Max duration (500ms)
});

// Applied to channel list container
<Box {...(isMobile && !chatOpen ? chatListSwipeHandlers : {})}>
  <ChatChannelList />
</Box>
```

**Chat Window Swipe** (`ChatWindow.tsx`):
```typescript
const chatWindowSwipeHandlers = useSwipeable({
  onSwipedRight: () => {
    if (isMobile && open) {
      onClose();  // Close chat and return to list
    }
  },
  trackMouse: false,
  preventScrollOnSwipe: false,  // Allow message list scrolling
  delta: 50,
  trackTouch: true,
  swipeDuration: 500
});

// Applied to chat window container
<Box {...(isMobile && open ? chatWindowSwipeHandlers : {})}>
  {/* Chat content */}
</Box>
```

**Behavior**:
- **Swipe Right**: Navigate back (chat list) or close chat (chat window)
- **Minimum Distance**: 50px to prevent accidental triggers
- **Touch Only**: No mouse tracking (prevents conflicts with desktop interactions)
- **Scroll Preserved**: Normal scrolling still works (doesn't prevent scroll)

---

## Desktop vs Mobile Layouts

### Desktop Layout

**Structure**:
```
┌─────────────────────────────────────────┐
│              Layout Header              │
├──────────────┬──────────────────────────┤
│              │                          │
│ Channel List │    Chat Window           │
│  (350px)     │    (flex: 1)             │
│              │                          │
│              │                          │
└──────────────┴──────────────────────────┘
```

**Features**:
- Side-by-side layout (channel list + chat window)
- Chat window renders inline (not modal)
- Info sidebar on right (when opened)
- Empty state shows background image with logo
- No app bar (header hidden)

**Styling**:
- Background: `#E0F2F1` (light teal)
- Channel list: `#FFFFFF` (white) with border
- Max width: `1400px` centered
- Padding: `24px` (md) / `32px` (lg)

### Mobile Layout

**Structure**:
```
┌─────────────────────┐
│   App Bar (Header)   │
├─────────────────────┤
│                     │
│   Channel List      │
│   (Full Width)      │
│                     │
│                     │
└─────────────────────┘

When channel selected:
┌─────────────────────┐
│   App Bar (Header)  │
├─────────────────────┤
│                     │
│   Chat Window       │
│   (Full Screen)     │
│   (Drawer/Modal)    │
│                     │
└─────────────────────┘
```

**Features**:
- Full-width channel list
- Chat window opens as drawer/modal
- App bar visible with back button
- Swipe gestures for navigation
- Keyboard handling for input visibility

**Styling**:
- Background: `#FFFFFF` (white)
- Full viewport height
- Bottom padding: `3rem` (xs) / `5rem` (sm) for navigation bar
- No side padding on channel list

**Responsive Breakpoint**: `theme.breakpoints.down("md")` (768px)

---

## Capacitor Integration

### Platform Detection

```typescript
import { Capacitor } from "@capacitor/core";

// Check if native app
const isNative = Capacitor.isNativePlatform();

// Get platform
const platform = Capacitor.getPlatform(); // "ios" | "android" | "web"
```

### Used Plugins

1. **@capacitor/keyboard**: Keyboard event handling
2. **@capacitor/push-notifications**: Push notification registration
3. **@capacitor/local-notifications**: Local notification display
4. **@capacitor/filesystem**: Image caching (Android)
5. **@capacitor/app**: App lifecycle and deep linking
6. **capacitor-native-settings**: Open system settings

### Custom Plugins

**FileUriConverterPlugin** (Android):
- Converts `file://` URIs to `content://` URIs
- Required for Android notification images
- Registered in `MainActivity.java`

### Configuration

**capacitor.config.json**:
```json
{
  "plugins": {
    "PushNotifications": {
      "presentationOptions": ["badge", "sound", "alert"]
    },
    "Keyboard": {
      "resize": "body",
      "style": "dark",
      "resizeOnFullScreen": true
    }
  }
}
```

---

## Imports & Dependencies

### Core Dependencies

```typescript
// React & Next.js
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";

// Sendbird
import { SendBirdProvider, Channel } from "@sendbird/uikit-react";
import "@sendbird/uikit-react/dist/index.css";
import type { GroupChannel, UserMessage, BaseMessage } from "@sendbird/chat/lib/__definition";

// Material-UI
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import TextField from "@mui/material/TextField";
import useTheme from "@mui/material/styles/useTheme";
import useMediaQuery from "@mui/material/useMediaQuery";

// Capacitor
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import type { KeyboardInfo } from "@capacitor/keyboard";

// Swipe Gestures
import { useSwipeable } from "react-swipeable";

// Services & Contexts
import { useChat } from "@/contexts/chatContext";
import { ChatService } from "@/v3/api";
import { getPushNotificationService } from "@/services/pushNotificationService";
```

### Key Package Versions

- `@sendbird/uikit-react`: Latest (v3)
- `@sendbird/chat`: Latest (v4)
- `@capacitor/core`: 7.x
- `@capacitor/keyboard`: 7.x
- `@capacitor/push-notifications`: 7.x
- `@mui/material`: 5.x
- `react-swipeable`: Latest
- `next`: 13.x / 14.x

---

## UI/UX Features

### Custom Header

**Design**:
- White background (`#FFFFFF`)
- No border (custom CSS overrides)
- Avatar (40x40px)
- Channel name (bold, 1rem)
- Action buttons (search, info)

**Mobile**:
- Back button on left
- Full-width header
- Padding: `1.5rem`

**Desktop**:
- No back button (inline layout)
- Extra right padding when inline (`6rem`)

### Message Bubbles

**Outgoing Messages**:
- Background: `#38BCB2` (teal)
- Text: `#FFFFFF` (white)
- Border radius: `16px`
- Padding: `8px 12px`

**Incoming Messages**:
- Background: `#f5f5f5` (light gray)
- Text: `#051036` (dark blue)
- Border radius: `16px`
- Padding: `8px 12px`

### Input Field

**Styling**:
- Border radius: `18px` (more circular)
- Font size: `16px` (prevents iOS zoom)
- Letter spacing: `0.5px`
- No scrollbar (hidden via CSS)

**Mobile Optimizations**:
- Stays above keyboard
- Auto-scrolls when keyboard appears
- Touch-friendly sizing

### Avatars

**Sizes**:
- Header: `40px × 40px`
- Message list (mobile): `40px × 40px`
- Message list (desktop): Default Sendbird size

**Group Chat Avatars**:
- Split-circle design showing 2 members
- Left half: First member
- Right half: Second member
- Fallback: Regular avatar with initials

### Empty States

**Desktop**:
- Background image: `chat-background.png`
- Large logo: `madmonkey_login_icon.png` (150×150px, darkened)
- Title: "Mad Monkey Chat"
- Tagline: "Talk Travel. Make Friends."
- Privacy message: "Private. Safe. Encrypted." with lock icon

**Mobile**:
- Simple "No conversations yet" message
- Centered text

### Loading States

- Circular progress spinner
- Connection state messages:
  - "Initializing chat..."
  - "Connecting to chat..."
  - "Loading chat..."

### Error States

- Error alert with message
- Retry button (max 3 attempts)
- User-friendly error messages
- Graceful degradation (app continues without chat)

---

## State Management

### ChatContext State

```typescript
{
  isInitialized: boolean;
  isConnected: boolean;
  connectionState: "INITIALIZING" | "CONNECTING" | "OPEN" | "CLOSED" | "ERROR";
  error: string | null;
  client: SendbirdClient | null;
  tokenData: ChatTokenResponse | null;
  activeChannel: GroupChannel | null;
}
```

### Page State (`/my-chats/index.tsx`)

```typescript
{
  selectedChannelUrl: string;
  chatOpen: boolean;
  retryCount: number;
  destinationChannels: DestinationChannel[];
  showNotificationPrompt: boolean;
}
```

### ChatWindow State

```typescript
{
  sendbirdInstance: any;
  isLoading: boolean;
  channelData: GroupChannel | null;
  isCreatingChannel: boolean;
  showSearchModal: boolean;
  searchQuery: string;
  searchResults: UserMessage[];
  isSearching: boolean;
  showInfoModal: boolean;
  showInfoSidebar: boolean;
  showMembersList: boolean;
}
```

### Real-time Updates

**Channel List**:
- `GroupChannelHandler`: Listens for channel changes, new messages, user joins/leaves
- `OpenChannelHandler`: Listens for open channel updates
- Channels automatically re-sorted on new messages

**Chat Window**:
- Sendbird UIKit handles real-time message updates
- Typing indicators (built into UIKit)
- Read receipts (built into UIKit)
- Message reactions (built into UIKit)

---

## Error Handling

### Connection Errors

**Types**:
- Network errors (CORS, ad-blockers)
- Token errors (expired, invalid)
- Sendbird service errors (disabled, unavailable)
- Gateway errors (504, 503)

**Handling**:
- User-friendly error messages
- Auto-retry (max 3 attempts, 3 second delay)
- Graceful degradation (app continues without chat)
- Error logging to Sentry

### Token Refresh

**Automatic**:
- Checks token expiration every 30 seconds
- Refreshes 5 minutes before expiration
- Only when connection is OPEN

**Manual**:
- Retry button on error state
- `refreshToken()` method in ChatContext

### Channel Errors

**Channel Not Found**:
- Shows error message
- Allows user to go back

**Channel Creation Errors**:
- User-friendly messages:
  - "RECIPIENT_NOT_FOUND": "Unable to find this user..."
  - "RECIPIENT_INCOMPLETE": "This user's account is incomplete..."
  - "INVALID_RECIPIENT": "You cannot message yourself."

---

## Performance Optimizations

### Lazy Loading

- Sendbird SDK loaded only when needed
- UIKit components render only when channel selected
- Images lazy-loaded by Sendbird UIKit

### Image Optimization

- **Image Compression**: 70% quality, max 1080x1920 resolution
  - Reduces file sizes by 30-50%
  - Faster uploads, especially on mobile
  - Lower bandwidth usage
- **Responsive Rendering**: Images scale to fit screen width
  - No fixed width constraints
  - Aspect ratio preserved
  - Overflow protection on all devices
- **Multiple Files**: Up to 10 images per message
  - Grouped thumbnails for better UX
  - Efficient grid layout
- **Preview Optimization**: Full-screen preview with proper close button
  - Mobile-optimized (touch-friendly, pinch-to-zoom)
  - Properly aligned close button (16px from edge)
  - No duplicate buttons

### Memoization

- `useCallback` for event handlers
- `useMemo` for filtered/sorted channel lists
- React.memo for expensive components (if needed)

### Efficient Updates

- Channel list updates only affected channels
- Message list virtualized by Sendbird UIKit
- Debounced search (300ms delay)

### Caching

- Token cached in localStorage
- Channel data cached by Sendbird SDK
- Push token cached in service

### Bundle Size

- Tree-shaking for unused Sendbird features
- Code splitting for chat components
- Dynamic imports for heavy dependencies

---

## Testing Considerations

### Manual Testing Checklist

**Desktop**:
- [ ] Channel list loads correctly
- [ ] Channel selection opens chat window
- [ ] Messages send/receive in real-time
- [ ] Search functionality works
- [ ] Info sidebar opens/closes
- [ ] Profile popup works
- [ ] DM creation works

**Mobile**:
- [ ] Swipe gestures work (back navigation)
- [ ] Keyboard handling (input stays visible)
- [ ] Push notifications (foreground/background/closed)
- [ ] Deep linking (notification tap → channel)
- [ ] Image display in notifications
- [ ] Badge count updates
- [ ] Image attachments upload and display correctly
- [ ] Image compression works (verify file sizes reduced)
- [ ] Multiple files upload (2-10 images)
- [ ] Image preview modal opens correctly
- [ ] Close button visible and functional
- [ ] Close button properly aligned (16px from edge)
- [ ] Images fit screen width (no overflow)
- [ ] Mobile pinch-to-zoom works

**Cross-Platform**:
- [ ] Connection retry works
- [ ] Token refresh works
- [ ] Error states display correctly
- [ ] Loading states display correctly

### Debugging Tools

**Console Logs**:
- `[ChatContext]`: Connection and initialization logs
- `[ChatWindow]`: Component lifecycle logs
- `[ChatChannelList]`: Channel loading logs
- `[PushNotificationService]`: Push notification logs
- `[SendbirdClient]`: SDK interaction logs

**Debug Banner** (Native apps):
- Shows on `/my-chats` page
- Displays: device token, provider registration status, permission status
- Component: `ChatNotificationStatusBanner`

**LocalStorage Keys**:
- `mm_push_token`: Cached push token
- `mm_debug_push_token`: Debug push token
- `mm_pending_notification`: Pending notification action

---

## Troubleshooting

### Common Issues

**1. Chat Not Connecting**
- Check network connection
- Verify ad-blockers not blocking Sendbird
- Check browser console for errors
- Verify backend `/chat/token` endpoint works

**2. Push Notifications Not Working**
- Verify permissions granted
- Check token registration logs
- Verify Sendbird dashboard APNs/FCM configured
- Check device token format (hex for iOS)

**3. Keyboard Covering Input (Mobile)**
- Verify Capacitor Keyboard plugin installed
- Check `capacitor.config.json` keyboard settings
- Verify listeners are set up correctly

**4. Swipe Gestures Not Working**
- Verify `react-swipeable` installed
- Check handlers applied to correct elements
- Verify `isMobile` detection works

**5. Images Not Showing in Notifications (Android)**
- Verify `FileUriConverterPlugin` registered
- Check FileProvider configuration
- Verify image download/caching works
- Check content URI conversion logs

---

## Related Documentation

- **Sendbird Integration**: `docs/SENDBIRD_INTEGRATION.md`
- **Push Notifications**: `frontend/docs/PUSH_NOTIFICATIONS.md`
- **Push Architecture**: `frontend/docs/PUSH_NOTIFICATIONS_ARCHITECTURE.md`
- **Android Setup**: `frontend/android/JAVA_21_REQUIREMENT.md`
- **Troubleshooting**: `frontend/docs/PUSH_NOTIFICATION_TROUBLESHOOTING.md`
- **Image Attachments**: `docs/frontend/SENDBIRD_IMAGE_ATTACHMENT_ANALYSIS.md` - Complete analysis of image attachment implementation
- **Image Preview Flow**: `docs/frontend/SENDBIRD_IMAGE_PREVIEW_CLOSE_FLOW.md` - Image preview close button flow and fixes
- **Image Click Flow**: `docs/frontend/SENDBIRD_IMAGE_CLICK_FLOW.md` - Image click behavior analysis
- **Image Improvements**: `docs/frontend/SENDBIRD_IMAGE_CLICK_IMPROVEMENTS.md` - Improvement suggestions and implementation guide

---

## Summary

The `/my-chats` page is a comprehensive chat implementation featuring:

✅ **Full Sendbird Integration**: Real-time messaging with UIKit components
✅ **Cross-Platform Support**: Desktop and mobile (iOS/Android) with responsive layouts
✅ **Push Notifications**: Complete implementation with image support

✅ **Image Attachments**: 
- Responsive image display (fits screen width)
- Image compression (70% quality, 1080x1920 max)
- Multiple files support (up to 10 images)
- Full-screen preview with proper close button
- Mobile-optimized with pinch-to-zoom
- Filename hidden in preview header (prevents layout issues)
- See `docs/frontend/SENDBIRD_IMAGE_ATTACHMENT_ANALYSIS.md` for details
✅ **Keyboard Handling**: Native keyboard management for mobile apps
✅ **Swipe Gestures**: Intuitive navigation gestures
✅ **Error Handling**: Robust error handling with retry logic
✅ **Performance**: Optimized for speed and efficiency
✅ **UI/UX**: Polished interface matching brand design
✅ **Deep Linking**: Support for notification deep links
✅ **Real-time Updates**: Live channel and message updates

The implementation follows best practices for React, Next.js, Capacitor, and Sendbird integration, providing a production-ready chat experience.
