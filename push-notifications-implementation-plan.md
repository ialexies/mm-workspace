# Sendbird Push Notifications Integration Plan

## Overview

Implement push notifications for the Sendbird chat system using Capacitor Push Notifications plugin, supporting both iOS (APNs) and Android (FCM). The implementation includes native push notifications, web browser notifications (PWA), permission management, notification preferences, and comprehensive error handling.

**Platform Support:**

- ✅ **iOS (Native App)**: APNs push notifications via Capacitor
- ✅ **Android (Native App)**: FCM push notifications via Capacitor
- ✅ **Web (PWA)**: Browser Push API via Service Worker (webhook-based fallback)
- ❌ **Web (Browser only)**: No push notifications (real-time WebSocket messages still work)

## Architecture

```
Native Apps (iOS/Android):
User Login → Chat Initialized → Request Push Permissions → Get Device Token
    ↓
Register Token with Sendbird (iOS: APNs, Android: FCM)
    ↓
Handle Incoming Notifications → Parse Sendbird Payload → Deep Link to Channel

Web App (PWA):
User Login → Chat Initialized → Request Browser Push Permissions → Register Service Worker
    ↓
Backend Webhook → Sendbird Event → Trigger Browser Push Notification
    ↓
Handle Notification Tap → Navigate to Channel
```

## Implementation Phases

### Phase 1: Core Native Push Notifications (MVP)

#### 1.1 Install Dependencies

**File:** `frontend/package.json`

**Dependencies to add:**

```json
"@capacitor/push-notifications": "^7.x.x",
"@capacitor/local-notifications": "^7.x.x"
```

**Actions:**

- Run `npm install`
- Run `npx cap sync` for both iOS and Android

#### 1.2 Create Push Notification Service

**New File:** `frontend/services/pushNotificationService.ts`

**Core Service Features:**

- Platform detection (iOS/Android/Web) using existing `@/utils/deviceDetection`
- Permission request and status checking
- Device token retrieval and storage
- Notification event handlers (foreground/background/action)
- Token refresh management
- Error handling and retry logic with Sentry logging

**Key Methods:**

```typescript
- initialize(): Promise<void> - Initialize and request permissions
- getDeviceToken(): Promise<string | null> - Get current device token
- registerWithSendbird(token: string): Promise<void> - Register with Sendbird
- unregisterFromSendbird(): Promise<void> - Unregister on logout
- handleNotificationReceived(notification): void - Process incoming notifications
- handleNotificationAction(action): void - Handle notification taps
- checkPermissions(): Promise<PermissionStatus>
- requestPermissions(): Promise<PermissionStatus>
- refreshToken(): Promise<void>
```

**Error Handling Pattern:**

```typescript
import { logError } from "@/utils/logger";
import { getPlatform } from "@/utils/deviceDetection";

try {
  // operation
} catch (error) {
  console.error("Descriptive error message:", error);
  logError(error, {
    section: "push-notifications",
    action: "register-token",
    platform: getPlatform(),
    // Add relevant context
  });
  // Handle gracefully - never block app functionality
}
```

#### 1.3 Create Permission Request Manager

**New File:** `frontend/services/pushPermissionManager.ts`

**Features:**

- Smart permission request timing
- User education and explanations
- Permission denial handling
- Permission state persistence
- Analytics tracking

**Permission Request Triggers:**

- When user opens `/my-chats` for the first time
- When user sends their first message
- When user explicitly enables in settings
- **NOT immediately on login** (better UX)

**User Education:**

- Show brief explanation before requesting
- Explain value: "Stay connected with other travelers"

#### 1.4 Extend Sendbird Client

**File:** `frontend/services/sendbirdClient.ts`

**Add Methods:**

```typescript
- registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void>
- unregisterPushToken(platform: 'ios' | 'android'): Promise<void>
- unregisterAllPushTokens(): Promise<void>
- setForegroundState(): Promise<void>
- setBackgroundState(): Promise<void>
- setPushTriggerOption(option: 'all' | 'mention_only' | 'off'): Promise<void>
- setChannelPushTriggerOption(channelUrl: string, option: string): Promise<void>
- getPushTemplate(): Promise<string>
- setPushTemplate(template: 'default' | 'alternative'): Promise<void>
```

**Implementation Notes:**

- iOS: Use `sb.registerAPNSPushTokenForCurrentUser(token)`
- Android: Use `sb.registerGCMPushTokenForCurrentUser(token)` (FCM uses GCM method)
- Handle up to 20 tokens per platform
- Auto-cleanup oldest tokens when limit reached
- Include error logging with Sentry for registration failures

#### 1.5 Create Push Notification Hook

**New File:** `frontend/hooks/usePushNotifications.ts`

**Hook Returns:**

```typescript
{
  isSupported: boolean;
  hasPermission: boolean;
  permissionStatus: "prompt" | "granted" | "denied";
  deviceToken: string | null;
  isRegistered: boolean;
  error: string | null;
  requestPermissions: () => Promise<void>;
  registerToken: () => Promise<void>;
  unregisterToken: () => Promise<void>;
}
```

#### 1.6 Integrate with Chat Context

**File:** `frontend/contexts/chatContext.tsx`

**Integration Points:**

- Initialize push notifications after successful Sendbird connection
- Only initialize on native platforms (`Capacitor.isNativePlatform()`)
- Register device token with Sendbird automatically
- Unregister token on logout/disconnect
- Handle connection state changes

**Flow:**

```
Chat Connected → Check if native platform → Request permissions → Get token → Register with Sendbird
```

**Important:** Use existing ChatContext lifecycle management patterns.

#### 1.7 iOS Configuration

**File:** `frontend/ios/App/App/Info.plist`

**Already configured:**

- ✅ `UIBackgroundModes` includes `remote-notification`

**Additional Steps:**

- Enable Push Notifications capability in Xcode project settings
- Ensure APNs certificates are configured in Apple Developer portal
- Configure APNs in Sendbird dashboard

**File:** `frontend/ios/App/App/AppDelegate.swift`

**Add token registration handlers:**

```swift
func application(_ application: UIApplication,
                didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    NotificationCenter.default.post(
        name: .capacitorDidRegisterForRemoteNotifications,
        object: deviceToken
    )
}

func application(_ application: UIApplication,
                didFailToRegisterForRemoteNotificationsWithError error: Error) {
    NotificationCenter.default.post(
        name: .capacitorDidFailToRegisterForRemoteNotifications,
        object: error
    )
}
```

#### 1.8 Android Configuration

**File:** `frontend/android/app/src/main/AndroidManifest.xml`

**Add permissions:**

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="com.google.android.c2dm.permission.RECEIVE" />
```

**Firebase Setup:**

1. Create/configure Firebase project in Firebase Console
2. Register Android app with package name: `com.madmonkey.madmonkey`
3. Download `google-services.json` to `android/app/` directory
4. Configure FCM in Sendbird dashboard with Firebase server key

**File:** `frontend/android/app/build.gradle`

**Verify dependencies:**

```gradle
dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.x.x')
    implementation 'com.google.firebase:firebase-messaging'
    implementation 'com.google.firebase:firebase-analytics'
}
```

**Notification Channels (Android 8+):**

- Create notification channel for chat messages
- Configure importance, sound, vibration

#### 1.9 Notification Handling & Deep Linking

**File:** `frontend/services/pushNotificationService.ts`

**Foreground Notifications:**

- Parse Sendbird payload: `message.data.sendbird`
- Extract channel URL: `sendbird.channel.channel_url`
- Show local notification with channel info
- Navigate to channel when tapped

**Background/Quit State:**

- Use Capacitor background message handler
- Display system notification
- Handle notification tap to deep link

**Deep Linking (✅ Already Configured):**

**Existing Infrastructure:**

- ✅ Deep link scheme `madmonkey://` is already configured in iOS (`Info.plist`) and Android (`AndroidManifest.xml`)
- ✅ Deep link handler `useDeepLinkListener.ts` is already active and listening for `appUrlOpen` events
- ✅ `/my-chats` page already supports `channelUrl` query parameter for auto-opening channels

**Implementation Required:**
Add one route handler case in `frontend/utils/hooks/useDeepLinkListener.ts`:

```typescript
case "/my-chats": {
  const channelUrl = params.channelUrl;
  if (channelUrl) {
    router.push(`/my-chats?channelUrl=${encodeURIComponent(channelUrl)}`);
  } else {
    router.push("/my-chats");
  }
  break;
}
```

**Deep Link Format:**

- Native: `madmonkey://my-chats?channelUrl={url}`
- Web fallback: `/my-chats?channelUrl={url}` (direct navigation)
- Handle all app states: closed, background, foreground
- Extract `channelUrl` from notification payload: `data.sendbird.channel.channel_url`

#### 1.10 App Lifecycle Management

**File:** `frontend/pages/_app.tsx`

**Add Capacitor App listeners:**

```typescript
-App.addListener("appStateChange", handleAppStateChange) -
  App.addListener("appUrlOpen", handleDeepLink);
```

**State Management:**

- Call `setForegroundState()` when app comes to foreground
- Call `setBackgroundState()` when app goes to background
- Refresh tokens on app resume
- Re-register if token expired

### Phase 2: Enhanced Features

#### 2.1 Web Browser Notifications (PWA)

**New File:** `frontend/services/webPushNotificationService.ts`

**Features:**

- Service Worker registration
- Browser Push API integration
- Webhook listener (backend sends webhook on Sendbird events)
- Fallback for web users

**Backend Integration Required:**

- Sendbird webhook endpoint to receive chat events
- Trigger browser push notifications via webhook
- Store web push subscriptions in database

**File:** `frontend/public/sw.js` (Service Worker)

**Service Worker Functions:**

- Handle push events
- Display notifications
- Handle notification clicks
- Navigate to channel on click

#### 2.2 Notification Preferences UI

**New File:** `frontend/components/molecules/NotificationPreferences.tsx`

**Settings Include:**

- Global push notification toggle
- Push trigger option (All / Mentions Only / Off)
- Push template selection (Default / Alternative)
- Per-channel notification settings
- Do Not Disturb hours
- Sound/vibration preferences

**File:** `frontend/services/sendbirdClient.ts`

**Add preference methods:**

```typescript
- setDoNotDisturb(enabled: boolean, startHour: number, startMin: number, endHour: number, endMin: number, timezone: string): Promise<void>
- setSnoozePeriod(enabled: boolean, startTs: number, endTs: number): Promise<void>
- getPushPreferences(): Promise<PushPreferences>
```

#### 2.3 Custom Notification Content

**File:** `frontend/services/pushNotificationService.ts`

**Customization:**

- 1:1 DMs: "New message from {first_name}"
- Destination groups: "New message in {destination} chat"
- Group chats: "{sender_name}: {message_preview}"
- Show unread count in badge
- Include sender avatar if available

### Phase 3: Advanced Features (Optional)

#### 3.1 Token Management

**Enhanced Features:**

- Store tokens locally for comparison
- Detect token changes and re-register
- Handle token invalidation gracefully
- Support multiple devices (up to 20 per platform)
- Auto-cleanup old tokens

#### 3.2 Backend Token Storage (Optional Enhancement)

**Consider storing tokens in backend for:**

- Better device management (track which devices are registered)
- Analytics (understand device usage patterns)
- Security (centralized token management)
- Future features ("logout from all devices", device list in settings)

**If implementing backend storage:**

- Create database table: `user_push_tokens` with fields: `user_id`, `token`, `platform`, `device_info`, `created_at`, `updated_at`, `is_active`
- Create API endpoints: `POST /chat/push-token/register`, `DELETE /chat/push-token/unregister`, `GET /chat/push-tokens`
- Backend syncs tokens with Sendbird after storing in database
- Frontend calls backend API instead of Sendbird directly

#### 3.3 Error Handling & Retry Logic

**File:** `frontend/services/pushNotificationService.ts`

**Error Handling:**

- Permission denial: Show friendly message, continue without push
- Token registration failure: Retry with exponential backoff
- Network errors: Queue registration for retry
- Invalid token: Request new token
- Sendbird API errors: Log to Sentry, show user message

**Error Handling (Leverage Existing Patterns):**

**Use Existing Infrastructure:**

- ✅ Use existing `logError()` utility from `@/utils/logger`
- ✅ Follow Sentry logging patterns from `.cursorrules` and `docs/SENTRY_ERROR_LOGGING_ROADMAP.md`
- ✅ Include context: `{ section: "push-notifications", action: "register-token", platform: getPlatform() }`
- ✅ Never log sensitive data (tokens, user info) - only log success/failure status

**Error Handling Principles:**

- Always provide graceful degradation
- Show user-friendly error messages
- Never block app functionality if push fails
- Retry failed operations with exponential backoff
- Handle permission denial gracefully (continue without push)

#### 3.4 Testing & Debug Mode

**New File:** `frontend/services/pushNotificationDebug.ts`

**Debug Features:**

- Test notification button (dev mode only)
- Log all notification events
- Simulate notifications
- Token inspection
- Permission status display

## Files to Create/Modify

### New Files:

1. `frontend/services/pushNotificationService.ts` - Core push notification service
2. `frontend/services/pushPermissionManager.ts` - Permission management
3. `frontend/services/webPushNotificationService.ts` - Web/PWA notifications (Phase 2)
4. `frontend/services/pushNotificationAnalytics.ts` - Analytics tracking
5. `frontend/services/pushNotificationDebug.ts` - Debug utilities
6. `frontend/hooks/usePushNotifications.ts` - React hook
7. `frontend/components/molecules/NotificationPreferences.tsx` - Settings UI (Phase 2)
8. `frontend/public/sw.js` - Service Worker for web push (Phase 2)

### Modified Files:

1. `frontend/package.json` - Add dependencies
2. `frontend/contexts/chatContext.tsx` - Integrate push notifications
3. `frontend/services/sendbirdClient.ts` - Add token registration and preference methods
4. `frontend/pages/_app.tsx` - Add app lifecycle listeners
5. `frontend/utils/hooks/useDeepLinkListener.ts` - Add `/my-chats` route handler
6. `frontend/android/app/src/main/AndroidManifest.xml` - Add permissions
7. `frontend/ios/App/App/AppDelegate.swift` - Add token handlers
8. `frontend/android/app/build.gradle` - Add Firebase dependencies
9. `frontend/public/manifest.webmanifest` - Ensure PWA config (if needed)

### Platform Configuration:

1. **iOS:** Xcode project → Signing & Capabilities → Push Notifications
2. **Android:** Firebase Console → Add Android app → Download `google-services.json`
3. **Sendbird Dashboard:** Configure APNs certificates and FCM credentials
4. **Both:** Run `npx cap sync` after configuration

## Prerequisites

**Before Implementation:**

- ✅ Sendbird Chat SDK integrated (`@sendbird/chat` v4.x)
- ✅ Capacitor configured for iOS and Android (v7.2.0)
- ✅ iOS Info.plist has `remote-notification` background mode
- ✅ Deep link scheme `madmonkey://` already configured
- ✅ Deep link handler `useDeepLinkListener.ts` already active
- ✅ `/my-chats` page already handles `channelUrl` query parameter
- ❌ Install `@capacitor/push-notifications` plugin
- ❌ Firebase project setup for Android FCM
- ❌ APNs certificates configured in Sendbird dashboard
- ❌ FCM server key configured in Sendbird dashboard
- ❌ Push Notifications capability enabled in Xcode
- ❌ `google-services.json` downloaded and placed in `android/app/`

## Implementation Notes

### Platform-Specific Considerations:

**iOS:**

- Requires explicit permission request via native API
- APNs certificates must be configured in Sendbird dashboard
- Test with both sandbox and production certificates
- Token format is Data type, needs base64 encoding

**Android:**

- Android 13+ (API 33+) requires runtime `POST_NOTIFICATIONS` permission
- Notification channels required for Android 8+ (Oreo)
- FCM tokens work with Sendbird's `registerGCMPushTokenForCurrentUser()` method
- Firebase project must be configured and linked

**Web:**

- Browser Push API requires HTTPS (except localhost)
- Service Worker must be registered
- Requires backend webhook integration for Sendbird events
- Only works in PWA mode, not regular browser tabs

### Sendbird Limitations:

- Maximum 20 FCM tokens per user
- Maximum 20 APNs tokens per user
- Oldest tokens are automatically deleted when limit reached
- JavaScript SDK requires explicit `setForegroundState()` / `setBackgroundState()` calls

### Best Practices & Recommendations:

**1. Leverage Existing Utilities:**

- Use `isNativeApp()`, `getPlatform()` from `@/utils/deviceDetection`
- Follow existing permission request patterns (similar to other Capacitor plugins)
- Integrate with existing ChatContext lifecycle management
- Use existing Next.js router for navigation

**2. Permission Request Strategy:**

- Request permissions when user opens `/my-chats` for the first time
- Request when user sends their first message
- Show brief explanation before requesting (educate user on value)
- Do NOT request immediately on login (better UX)
- Handle permission denial gracefully - continue without push

**3. Security & Privacy:**

- Never log tokens in console or Sentry (only log success/failure status)
- Validate tokens before registration (format, length checks)
- Handle token invalidation on logout and account deletion
- Encrypt tokens at rest if stored in backend
- Respect user privacy - only request permissions at appropriate times

**4. Performance Optimizations:**

- Lazy load push notification service (only initialize on native platforms)
- Debounce token refresh operations (avoid rapid refresh requests)
- Cache permission status (don't check on every render)
- Batch token operations if handling multiple devices
- Optimize notification payload parsing (parse only what's needed)

**5. Testing Strategy:**

- Use existing deep link testing commands from README.md:

  ```bash
  # Android
  adb shell am start -a android.intent.action.VIEW -d "madmonkey://my-chats?channelUrl=dm-123-456"

  # iOS
  xcrun simctl openurl booted "madmonkey://my-chats?channelUrl=dm-123-456"
  ```

- Test permission denial gracefully (app should continue working)
- Test token registration failures (retry logic should work)
- Test all app states (closed, background, foreground notifications)
- Test deep linking from notification tap in all states
- Test token refresh when tokens expire or change
- Test multiple devices (ensure up to 20 tokens per platform work)

## Testing Checklist

- [ ] Permission request on first chat access
- [ ] Token registration with Sendbird (iOS)
- [ ] Token registration with Sendbird (Android)
- [ ] Foreground notification receipt
- [ ] Background notification receipt
- [ ] Quit state notification receipt
- [ ] Notification tap → deep link to channel
- [ ] Deep link handler `/my-chats` route works correctly
- [ ] Token refresh on app resume
- [ ] Multiple device support (up to 20 tokens)
- [ ] Permission denial handling (app continues working)
- [ ] Network error handling (retry logic works)
- [ ] Token invalidation handling
- [ ] Push preferences changes
- [ ] Do Not Disturb functionality (Phase 2)
- [ ] Per-channel notification settings (Phase 2)
- [ ] Web push notifications (Phase 2)
- [ ] Analytics tracking
- [ ] Error logging to Sentry with proper context
- [ ] Graceful degradation when push fails

## iOS vs Android Parity & QA Reference

- For an iOS-focused QA flow that mirrors the working Android implementation, see `frontend/docs/IOS_PUSH_NOTIFICATIONS_QA_CHECKLIST.md`.
- When validating changes, always:
  - Compare titles, bodies, deep links, and image behaviour on both platforms for at least one **Sendbird** and one **Klaviyo** notification.
  - Confirm APNs and FCM credentials are correctly configured in the Sendbird dashboard for the target environment.
  - Re-run the sign-off checklist in `IOS_PUSH_NOTIFICATIONS_QA_CHECKLIST.md` before each major release.

## Phased Rollout Recommendation

1. **Phase 1 (MVP)**: Native push notifications only, basic error handling
2. **Phase 2**: Enhanced features (preferences UI, web push, analytics)
3. **Phase 3**: Backend token storage, advanced device management (optional)
4. **Phase 4**: Advanced features (Do Not Disturb, per-channel preferences)

This allows for iterative testing and deployment, reducing risk.

## Key Implementation Highlights

1. **Deep linking infrastructure already exists** - Just need to add `/my-chats` route handler
2. **Error logging infrastructure already exists** - Use existing `logError()` utility and Sentry patterns
3. **Device detection utilities already exist** - Use existing `@/utils/deviceDetection`
4. **Chat context already manages lifecycle** - Integrate push notifications into existing patterns
5. **Smart permission timing** - Request when user actually needs it, not on login
6. **Graceful degradation** - App continues working even if push notifications fail
7. **Comprehensive error handling** - Log to Sentry with proper context, never block app functionality

## Related Documentation

- [Sendbird Chat Integration Docs](docs/frontend/SENDBIRD_CHAT_INTEGRATION.md)
- [Sendbird Push Notifications Docs](https://sendbird.com/docs/chat/sdk/v3/javascript/guides/push-notifications)
- [Capacitor Push Notifications Docs](https://capacitorjs.com/docs/apis/push-notifications)
- [Sentry Error Logging Roadmap](frontend/docs/SENTRY_ERROR_LOGGING_ROADMAP.md)
