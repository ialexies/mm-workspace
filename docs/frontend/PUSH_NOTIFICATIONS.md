# Push Notifications Documentation

## Overview

The push notification system enables real-time notifications for Sendbird chat messages on iOS (APNs) and Android (FCM) native platforms. The implementation uses Capacitor plugins to handle platform-specific push notification services.

**Note:** This document covers the implementation details. For architecture documentation, see [Push Notification Architecture](./PUSH_NOTIFICATIONS_ARCHITECTURE.md).

## Architecture

The push notification system uses a centralized, provider-based architecture:

```
User Login → Chat Initialized → Request Push Permissions → Get Device Token
    ↓
PushTokenRegistrationManager orchestrates registration
    ↓
Register Token with Sendbird (iOS: APNs, Android: FCM)
    ↓
Register Token with Klaviyo (for marketing push notifications, requires email)
    ↓
Handle Incoming Notifications → Parse Sendbird Payload → Deep Link to Channel
```

For detailed architecture information, see [Push Notification Architecture Documentation](./PUSH_NOTIFICATIONS_ARCHITECTURE.md).

### App State Handling

The push notification system handles all app states:

1. **Foreground**: Notification received → Local notification shown → Tap navigates to channel
2. **Background**: System notification shown → Tap launches app → Navigates to channel
3. **Closed**:
   - **With `notification` field**: FCM/APNs displays automatically → Tap launches app → Navigates to channel
   - **Data-only payload**: `MadMonkeyFirebaseMessagingService` displays manually → Tap launches app → Navigates to channel

**Early Listener Setup**: To ensure notifications are captured when the app launches from a closed state, listeners are set up immediately when the service is created, before full initialization. This prevents missing notification taps that occur during app startup.

**Background Notification Handler**: For Android, when the app is closed and only `data` field is sent (no `notification` field), the `MadMonkeyFirebaseMessagingService` automatically displays the notification with images and deep linking support.

## Platform Support

- ✅ **iOS (Native App)**: APNs push notifications via Capacitor
- ✅ **Android (Native App)**: FCM push notifications via Capacitor
- ❌ **Web (Browser)**: No push notifications (real-time WebSocket messages still work)

## Components

### 1. PushNotificationService

**Location:** `frontend/services/pushNotificationService.ts`

Core service that handles:

- Platform detection (iOS/Android/Web)
- Permission management
- Device token retrieval and storage
- Notification event handling (foreground, background, action)
- Navigation handling for notification taps
- Provider registration orchestration (via PushTokenRegistrationManager)

**Key Methods:**

```typescript
// Initialize push notifications
await pushService.initialize();

// Get device token
const token = await pushService.getDeviceToken();

// Update customer data (triggers provider registration)
pushService.updateCustomerData(customer);

// Check permissions
const status = await pushService.checkPermissions();

// Request permissions
const result = await pushService.requestPermissions();

// Deprecated methods (still work, but use registration manager internally)
await pushService.registerWithSendbird(token);
await pushService.registerWithKlaviyo(token, userEmail);
await pushService.unregisterFromSendbird();
await pushService.unregisterFromKlaviyo();
```

**Note:** Token registration is now handled by `PushTokenRegistrationManager`. See [Architecture Documentation](./PUSH_NOTIFICATIONS_ARCHITECTURE.md) for details.

### 2. PushPermissionManager

**Location:** `frontend/services/pushPermissionManager.ts`

Manages smart permission request timing:

- Tracks first chat access
- Tracks first message sent
- Handles permission state persistence
- Provides user-friendly permission request flow

### 3. usePushNotifications Hook

**Location:** `frontend/hooks/usePushNotifications.ts`

React hook that provides push notification state and methods:

```typescript
const {
  isSupported,
  hasPermission,
  permissionStatus,
  deviceToken,
  isRegistered,
  error,
  requestPermissions,
  registerToken,
  unregisterToken,
} = usePushNotifications();
```

### 4. MadMonkeyFirebaseMessagingService (Android)

**Location:** `frontend/android/app/src/main/java/com/madmonkey/madmonkey/MadMonkeyFirebaseMessagingService.java`

Handles background push notifications when the app is closed or in background:

- Processes data-only notification payloads (when `notification` field is missing)
- Downloads and displays images (big picture and large icon)
- Extracts deep links from Sendbird and Klaviyo payloads
- Creates notifications manually when FCM doesn't display them automatically
- Supports both HTTP/HTTPS image URLs and content:// URIs
- **Sets `Intent.ACTION_VIEW` on notification intents** to ensure Capacitor's App plugin recognizes deep links

**Key Features:**

- Automatic notification display for data-only payloads
- Image downloading and caching for notifications
- Deep link extraction and intent creation with proper action
- Notification channel management (`chat_messages_v2`)
- **Deep link intent configuration:** Sets `Intent.ACTION_VIEW` action so Capacitor fires `appUrlOpen` event

**When It's Used:**

- App is closed: Processes data-only notifications and displays them
- App is in background: Handles notifications if FCM doesn't process them
- App is in foreground: Not used (Capacitor plugin handles these)

**Note:** This service only handles data-only messages. Messages with `notification` field are displayed automatically by FCM, but the service still creates custom notifications when deep links are present to ensure proper deep linking.

**Deep Link Intent Configuration:**

- Notification intents are created with `Intent.ACTION_VIEW` action
- This is required for Capacitor's App plugin to fire the `appUrlOpen` event
- Deep links are set as intent data: `intent.setData(Uri.parse(deepLink))`
- The intent action is set in `createNotificationIntent()` method

### 5. Sendbird Client Extensions

**Location:** `frontend/services/sendbirdClient.ts`

Extended with push notification methods:

```typescript
// Register push token
await sendbirdClient.registerPushToken(token, "ios" | "android");

// Unregister push token
await sendbirdClient.unregisterPushToken("ios" | "android");

// Set foreground/background state
await sendbirdClient.setForegroundState();
await sendbirdClient.setBackgroundState();

// Configure push trigger options
await sendbirdClient.setPushTriggerOption("all" | "mention_only" | "off");
```

## Setup Instructions

### Prerequisites

1. **Install Dependencies:**

   ```bash
   npm install @capacitor/push-notifications@^7.0.1
   npm install @capacitor/local-notifications@^7.0.1
   ```

2. **Sync Capacitor:**
   ```bash
   npx cap sync ios
   npx cap sync android
   ```

### iOS Setup

1. **Enable Push Notifications Capability:**

   - Open Xcode project
   - Select your app target
   - Go to "Signing & Capabilities"
   - Click "+ Capability"
   - Add "Push Notifications"

2. **Configure APNs:**

   - Generate APNs certificates in Apple Developer portal
   - Upload certificates to Sendbird dashboard
   - Configure APNs settings in Sendbird dashboard

3. **AppDelegate.swift:**
   - Token registration handlers are already added
   - Located in `frontend/ios/App/App/AppDelegate.swift`

### Android Setup

1. **Java 21 Requirement:**

   ⚠️ **IMPORTANT**: The Capacitor Filesystem plugin requires Java 21 for building the Android app.

   - Download Java 21 from [Adoptium](https://adoptium.net/temurin/releases/?version=21) or [Oracle](https://www.oracle.com/java/technologies/downloads/#java21)
   - Install Java 21 and set JAVA_HOME:
     ```powershell
     $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.x-hotspot"
     $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
     ```
   - Verify installation: `java -version` (should show Java 21)
   - See `android/JAVA_21_REQUIREMENT.md` for detailed instructions

2. **Firebase Configuration:**

   - Create/configure Firebase project in Firebase Console
   - Register Android app with package name: `com.madmonkey.madmonkey`
   - Download `google-services.json`
   - Place `google-services.json` in `frontend/android/app/` directory

3. **AndroidManifest.xml:**

   - Permissions are already added:
     ```xml
     <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
     <uses-permission android:name="com.google.android.c2dm.permission.RECEIVE" />
     ```
   - FileProvider is configured for secure image URI handling
   - Custom `FileUriConverterPlugin` is registered for notification images

4. **Configure FCM:**

   - Get Firebase server key from Firebase Console
   - Configure FCM in Sendbird dashboard with server key

5. **Notification Channel:**

   - Created automatically by the service
   - Channel ID: `chat_messages_v2`
   - High importance with sound and vibration

6. **Custom Plugin Registration:**
   - `FileUriConverterPlugin` is registered in `MainActivity.java`
   - Required for displaying images in push notifications
   - Plugin must be registered BEFORE `super.onCreate()` (already configured)

## Usage

### Automatic Initialization

Push notifications are automatically initialized when:

1. User logs in
2. Chat context connects to Sendbird
3. App is on a native platform (iOS/Android)

### Manual Usage

```typescript
import { getPushNotificationService } from "@/services/pushNotificationService";

// Initialize manually
const pushService = getPushNotificationService();
await pushService.initialize();

// Get device token
const token = await pushService.getDeviceToken();
console.log("Device token:", token);

// Register with Sendbird (usually automatic)
await pushService.registerWithSendbird(token);

// Register with Klaviyo (usually automatic, requires email)
await pushService.registerWithKlaviyo(token, userEmail);
```

### Using the Hook

```typescript
import { usePushNotifications } from "@/hooks/usePushNotifications";

function MyComponent() {
  const {
    isSupported,
    hasPermission,
    deviceToken,
    isRegistered,
    requestPermissions,
  } = usePushNotifications();

  if (!isSupported) {
    return <div>Push notifications not supported on this platform</div>;
  }

  if (!hasPermission) {
    return (
      <button onClick={() => requestPermissions()}>
        Enable Push Notifications
      </button>
    );
  }

  return (
    <div>
      <p>Token: {deviceToken}</p>
      <p>Registered: {isRegistered ? "Yes" : "No"}</p>
    </div>
  );
}
```

## Notification Handling

### Foreground Notifications

When the app is in foreground:

- Notification is received via `pushNotificationReceived` event
- A local notification is automatically shown
- User can see the message in real-time in the chat

### Background Notifications

When the app is in background:

- System notification is displayed automatically
- User can tap notification to open the app
- Deep linking navigates to the specific channel

### Closed App Notifications

When the app is completely closed (not running):

**Android (FCM):**

- **With `notification` field**: FCM displays notification automatically → Tap launches app → Deep link navigates
- **Data-only payload**: `MadMonkeyFirebaseMessagingService` processes payload → Downloads images → Displays notification manually → Tap launches app → Deep link navigates
- Supports both Sendbird and Klaviyo payloads
- Images are downloaded and displayed (big picture and large icon)
- Deep links are extracted and handled automatically

**iOS (APNs):**

- System notification is displayed automatically by APNs
- User can tap notification to launch the app
- Deep linking works automatically via Capacitor App plugin

**Common Behavior:**

- **Early listener setup** ensures notification tap is captured even before full initialization
- App automatically navigates to the specific channel/screen on launch
- **Fallback mechanisms** check for initial notification data if event listener missed it
- Notification data is queued if navigation isn't ready yet, then processed when app is ready

### Notification Payload

**Sendbird notifications include:**

```json
{
  "sendbird": {
    "channel": {
      "channel_url": "sendbird_group_channel_123456789"
    }
  },
  "title": "New Message",
  "body": "You have a new message",
  "image_url": "https://example.com/image.jpg", // Optional: Big picture image
  "large_icon": "https://example.com/icon.jpg" // Optional: Large icon (profile picture)
}
```

**Klaviyo notifications include:**

```json
{
  "deep_link": "madmonkey://booking?promo=20OFF", // Optional: Deep link URL
  "url": "madmonkey://my-account", // Alternative: Generic URL field (recommended)
  "action_url": "madmonkey://booking?promo=20OFF", // Alternative: Action URL field
  "title": "Special Offer",
  "body": "Get 20% off your next booking",
  "image_url": "https://example.com/promo.jpg", // Optional: Big picture image
  "large_icon": "https://example.com/icon.jpg" // Optional: Large icon
}
```

**Important Deep Link Format:**

- ✅ **Correct:** `madmonkey://my-account` (full scheme)
- ❌ **Incorrect:** `my-account` (missing scheme)
- The deep link must include the `madmonkey://` scheme for proper handling
- The system will normalize partial deep links, but it's best to use the full format

**Payload Structure for Closed App (Android):**

For notifications to work when the app is closed, you can send either:

1. **Notification + Data payload** (recommended):

   ```json
   {
     "notification": {
       "title": "New Message",
       "body": "You have a new message"
     },
     "data": {
       "sendbird": "{\"channel\":{\"channel_url\":\"sendbird_group_channel_123\"}}",
       "title": "New Message",
       "body": "You have a new message",
       "image_url": "https://example.com/image.jpg"
     }
   }
   ```

2. **Data-only payload** (also supported):

   ```json
   {
     "data": {
       "sendbird": "{\"channel\":{\"channel_url\":\"sendbird_group_channel_123\"}}",
       "title": "New Message",
       "body": "You have a new message",
       "image_url": "https://example.com/image.jpg",
       "large_icon": "https://example.com/icon.jpg"
     }
   }
   ```

   The `MadMonkeyFirebaseMessagingService` will automatically display this notification with images and deep linking.

### Image Support in Notifications

**Android:**

- ✅ **Big Picture**: Full-size image shown when notification is expanded
- ✅ **Large Icon**: Profile picture or app icon shown when notification is collapsed
- **Foreground**: Images are downloaded, cached, and converted to secure `content://` URIs via `FileUriConverterPlugin`
- **Background/Closed**: Images are downloaded directly by `MadMonkeyFirebaseMessagingService` and displayed using `BigPictureStyle`
- Images must be valid HTTPS URLs
- Supports both HTTP/HTTPS URLs and `content://` URIs

**iOS:**

- ✅ **Attachments**: Images are shown as notification attachments
- Images are loaded directly from URLs (no caching required)

**Payload Fields:**

- `image_url`: URL for the big picture image (shown when notification is expanded)
- `large_icon`: URL for the large icon (profile picture, shown when collapsed)

**Example:**

```json
{
  "title": "New message from John",
  "body": "Hey, check out this photo!",
  "image_url": "https://cdn.example.com/photos/photo123.jpg",
  "large_icon": "https://cdn.example.com/profiles/john.jpg"
}
```

### Deep Linking

Notifications automatically deep link to channels and other screens:

**Sendbird Deep Links:**

- Format: `madmonkey://my-chats?channelUrl={channelUrl}`
- Extracted from: `data.sendbird.channel.channel_url`
- Navigates to `/my-chats` page with channel URL

**Klaviyo Deep Links:**

- Format: `madmonkey://{path}?{params}` (e.g., `madmonkey://my-account`, `madmonkey://booking?promo=20OFF`)
- Extracted from: `data.deep_link`, `data.url`, `data.action_url`, or `data.klaviyo.deep_link`
- Navigates to the specified path with parameters
- **Important:** Use full deep link format with scheme: `madmonkey://my-account` (not just `my-account`)

**Generic Deep Links:**

- Supports: `data.link`, `data.click_action`
- Handles both `madmonkey://` scheme and HTTP/HTTPS URLs

**Deep Link Handler:**

- Handled by `useDeepLinkListener` hook in JavaScript
- Processed by `MainActivity.handleNotificationIntent()` in Android
- Works in all app states: foreground, background, and closed

**Android Deep Link Intent Configuration:**

- Notification intents are created with `Intent.ACTION_VIEW` action
- This is required for Capacitor's App plugin to recognize the intent as a deep link
- The intent is created in `MadMonkeyFirebaseMessagingService.createNotificationIntent()`
- Deep links are automatically extracted from notification payloads and set as intent data

## Testing

### Getting the Device Token

1. **From Console Logs:**

   - Look for logs with 🔔 emoji
   - Token is logged when received:
     ```
     🔔 [PushInit] FULL PUSH TOKEN (for Firebase Console testing): <token>
     ```

2. **From localStorage:**

   ```javascript
   localStorage.getItem("mm_debug_push_token");
   ```

3. **From React Hook:**
   ```typescript
   const { deviceToken } = usePushNotifications();
   console.log("Token:", deviceToken);
   ```

### Testing with Firebase Console

1. Go to Firebase Console > Cloud Messaging
2. Click "Send test message"
3. Paste the device token
4. Enter notification title and message
5. **Add custom data** (for deep linking and images):
   - **Sendbird**: Add key `sendbird` with value `{"channel":{"channel_url":"sendbird_group_channel_123"}}`
   - **Klaviyo**: Add key `deep_link` with value `madmonkey://booking?promo=20OFF`
   - **Images**: Add keys `image_url` and `large_icon` with image URLs
6. Click "Test"
7. **Close the app completely** (swipe away from recent apps)
8. Notification should appear on device
9. Tap notification to test deep linking

### Testing Deep Links Directly

**Android (via ADB):**

```bash
# Test Sendbird deep link
adb shell am start -a android.intent.action.VIEW -d "madmonkey://my-chats?channelUrl=sendbird_group_channel_123456789"

# Test Klaviyo deep link (my-account page)
adb shell am start -a android.intent.action.VIEW -d "madmonkey://my-account"

# Test Klaviyo deep link (booking page)
adb shell am start -a android.intent.action.VIEW -d "madmonkey://booking?promo=20OFF"
```

**iOS (Simulator):**

```bash
# Test Sendbird deep link
xcrun simctl openurl booted "madmonkey://my-chats?channelUrl=sendbird_group_channel_123456789"

# Test Klaviyo deep link
xcrun simctl openurl booted "madmonkey://my-account"
xcrun simctl openurl booted "madmonkey://booking?promo=20OFF"
```

**Verifying Deep Link Works:**

- After running the adb command, check Logcat for:
  - `Notifying listeners for event appUrlOpen` (Capacitor App plugin)
  - `[DeepLink] Path: /my-account` (JavaScript handler)
  - App should navigate to the specified page
- If the adb command works but notification tap doesn't, check that the notification intent has `Intent.ACTION_VIEW` set

### Testing with Sendbird

1. Ensure you're logged in and have a chat channel
2. Send a message from another user/device in that channel
3. **Close the app completely** (swipe away from recent apps)
4. Wait for the notification
5. Tap the notification
6. Verify:
   - Notification appears with image (if available)
   - App opens and navigates to the chat channel
   - Channel opens automatically

### Testing with Klaviyo

1. Create a push campaign in Klaviyo Dashboard
2. Include deep link in the payload:
   ```json
   {
     "data": {
       "deep_link": "madmonkey://booking?promo=20OFF",
       "title": "Special Offer",
       "body": "Get 20% off your next booking",
       "image_url": "https://example.com/promo.jpg"
     }
   }
   ```
3. Send the campaign
4. **Close the app completely**
5. Tap the notification
6. Verify app opens and navigates to the booking page

## Troubleshooting

### Notification Not Showing When App is Closed

**Issue:** Notification not appearing when app is completely closed

**Solutions:**

1. **Check payload structure:**

   - If using data-only payload, ensure `title` and `body` are in the `data` field
   - Verify `MadMonkeyFirebaseMessagingService` is registered in `AndroidManifest.xml`
   - Check Logcat for: `[FCMService] Notification displayed from data payload`

2. **Check notification channel is created (Android 8+):**

   - Look for log: `[PushNotificationService] Notification channel created: chat_messages_v2`
   - Or: `[FCMService] Notification channel created: chat_messages_v2`

3. **Check permissions are granted:**

   - Use `usePushNotifications` hook to check `hasPermission`
   - Android 13+ requires `POST_NOTIFICATIONS` permission

4. **Check Firebase configuration:**

   - Verify `google-services.json` is in correct location
   - Verify FCM server key is configured in Sendbird/Klaviyo

5. **Check app state:**
   - Foreground: Local notification should show
   - Background: System notification should show (FCM or service)
   - Closed: System notification should show (FCM or service)

### Notification Not Showing (General)

**Issue:** Notification received but not displayed

**Solutions:**

1. Check notification channel is created (Android 8+)
   - Look for log: `[PushNotificationService] Notification channel created: chat_messages_v2`
2. Check permissions are granted
   - Use `usePushNotifications` hook to check `hasPermission`
3. Check app state
   - Foreground: Local notification should show
   - Background: System notification should show
4. Check Firebase configuration
   - Verify `google-services.json` is in correct location
   - Verify FCM server key is configured in Sendbird

### Token Not Received

**Issue:** Device token is null

**Solutions:**

1. Check permissions are granted
2. Check platform is native (iOS/Android)
3. Check initialization completed
4. Check console for registration errors
5. Verify Firebase/APNs configuration

### Token Not Registered with Sendbird

**Issue:** Token received but not registered with Sendbird

**Solutions:**

1. Check Sendbird connection status
   - Token only registers when Sendbird is connected
2. Check console logs for registration errors
3. Verify token format is correct
4. Check Sendbird API credentials

### Deep Linking Not Working

**Issue:** Notification tap doesn't navigate to channel/screen

**Solutions:**

1. **Check deep link handler is active:**

   - Verify `useDeepLinkListener` is mounted
   - Look for log: `[DeepLink] useDeepLinkListener mounted (client)`

2. **Check notification payload contains deep link:**

   - Sendbird: Verify `data.sendbird.channel.channel_url` exists
   - Klaviyo: Verify `data.deep_link`, `data.url`, or `data.action_url` exists
   - Check Logcat: `[FCMService] Deep link extracted: ...`

3. **Check deep link format:**

   - Sendbird: `madmonkey://my-chats?channelUrl={url}`
   - Klaviyo: `madmonkey://{path}?{params}` (e.g., `madmonkey://my-account`)
   - **Important:** Use full deep link format with scheme: `madmonkey://my-account` (not just `my-account`)
   - Verify URL encoding is correct

4. **Check intent action is set (Android):**

   - Notification intents must have `Intent.ACTION_VIEW` action
   - Check Logcat: `[FCMService] Created notification intent with deep link: ...`
   - Verify `appUrlOpen` event is fired: Look for `Notifying listeners for event appUrlOpen`
   - If missing, the intent action may not be set correctly

5. **Check `/my-chats` page handles `channelUrl` query parameter:**

   - Verify the page reads `router.query.channelUrl`

6. **Check if navigation callback is set:**

   - Look for log: `[PushNotificationService] Navigation callback set`
   - Verify router is ready before setting callback

7. **Check for pending notifications:**

   - Look for log: `[PushNotificationService] Processing X pending notification actions`
   - Check localStorage: `localStorage.getItem("mm_pending_notification")`

8. **Check MainActivity deep link processing:**

   - Verify `handleNotificationIntent()` is called in `onCreate()` and `onNewIntent()`
   - Check Logcat: `[MainActivity] Deep link found in intent data: ...`
   - Check Logcat: `[MainActivity] Triggered bridge.onNewIntent with deep link`
   - Verify `appUrlOpen` event is fired after bridge call

9. **Test deep link directly:**

   ```bash
   # Android - This should work and helps verify the deep link format
   adb shell am start -a android.intent.action.VIEW -d "madmonkey://my-account"
   adb shell am start -a android.intent.action.VIEW -d "madmonkey://my-chats?channelUrl=test123"

   # Check Logcat for deep link processing
   adb logcat | Select-String -Pattern "(DeepLink|PushNotificationService|FCMService|MainActivity|appUrlOpen)"
   ```

10. **Verify Capacitor App plugin is processing the intent:**
    - Check Logcat for: `Notifying listeners for event appUrlOpen`
    - If missing, the intent may not have `ACTION_VIEW` set
    - Check JavaScript console for: `[DeepLink] Path: /my-account`

### Images Not Displaying in Notifications

**Issue:** Notification shows but images don't appear

**Android Solutions (Foreground):**

1. Check Logcat for detailed error messages:
   ```bash
   adb logcat | Select-String -Pattern "(FileUriConverter|PushNotificationService)"
   ```
2. Verify `FileUriConverterPlugin` is registered in `MainActivity.java` BEFORE `super.onCreate()`
3. Verify FileProvider is configured in `AndroidManifest.xml`
4. Verify `file_paths.xml` includes cache path (`my_cache_images`)
5. Check that image URLs are valid HTTPS URLs
6. Verify content URI format: `content://com.madmonkey.madmonkey.fileprovider/my_cache_images/...`
7. Check plugin availability logs:
   - Look for: `✅ FileUriConverter plugin is available and functional`
   - If you see "plugin is not implemented", verify plugin registration order

**Android Solutions (Background/Closed App):**

1. Check Logcat for image download errors:
   ```bash
   adb logcat | grep -E "(FCMService|Big picture|Large icon)"
   ```
2. Verify image URLs are valid HTTPS URLs (HTTP/HTTPS required for download)
3. Check network connectivity (images are downloaded when app is closed)
4. Verify `image_url` and `large_icon` fields are in the `data` payload
5. Check for download timeout errors:
   - Look for: `[FCMService] Failed to load big picture: ...`
   - Images have 5s connect timeout and 10s read timeout
6. Verify image URLs are accessible (not blocked by CORS or authentication)
7. Check notification still displays without image (fallback behavior)

**iOS Solutions:**

1. Verify image URLs are accessible (not blocked by CORS)
2. Check that URLs use HTTPS (required for iOS)
3. Verify notification permissions are granted

**Common Issues:**

- **"Plugin is not implemented"**: Plugin registration order issue - verify `MainActivity.java` registers plugins BEFORE `super.onCreate()`
- **"Invalid resource ID"**: URI conversion issue - check FileProvider configuration
- **Images not downloading**: Network/CORS issue - verify image URLs are accessible
- **Java build errors**: Ensure Java 21 is installed and JAVA_HOME is set correctly

### App Launched from Closed State Not Navigating

**Issue:** App opens but doesn't navigate to channel when launched from notification

**Solutions:**

1. **Check early listeners are set up:**

   - Look for log: `[PushNotificationService] Early notification listeners set up successfully`

2. **Check initial notification check ran:**

   - Look for log: `[PushNotificationService] Checking for initial notification...`
   - Or: `[FCMService] Deep link extracted: ...`

3. **Check for queued notifications:**

   - Pending notifications are automatically processed when navigation becomes ready
   - Check localStorage: `localStorage.getItem("mm_pending_notification")`

4. **Verify router is ready before setting navigation callback:**

   - Navigation callback is set when `router.isReady` is true

5. **Check MainActivity deep link handling:**

   - Verify `handleNotificationIntent()` is called in `onCreate()` and `onNewIntent()`
   - Check Logcat: `[MainActivity]` for deep link processing

6. **Test deep link directly:**
   ```bash
   # Close app, then test deep link
   adb shell am start -a android.intent.action.VIEW -d "madmonkey://my-chats?channelUrl=test123"
   ```

## TypeScript Compilation Issues

### Known Type Definition Limitations

The push notification service uses some Capacitor APIs that have incomplete TypeScript type definitions. These are handled with type assertions:

**1. Badge Property in LocalNotifications**

**Issue:** `LocalNotifications.schedule()` TypeScript types don't include the `badge` property, even though Capacitor's runtime API supports it on iOS.

**Location:** `services/pushNotificationService.ts` - `setBadgeCount()` method

**Fix:** Type assertion is used to bypass the type check:

```typescript
await LocalNotifications.schedule({
  notifications: [
    {
      id: 0,
      title: "",
      body: "",
      badge: count, // Type assertion needed - runtime supports this
      channelId: "chat_messages_v2",
    } as any,
  ],
});
```

**Note:** This is safe because Capacitor's runtime API supports `badge` on iOS. The type definition is simply incomplete.

**2. Platform Type Narrowing**

**Issue:** `getPlatform()` returns `string`, but some methods require the specific union type `"ios" | "android" | "web"`.

**Location:** `services/pushNotificationService.ts` - `handleNotificationReceived()` method

**Fix:** Type assertion is used to narrow the type:

```typescript
const platform = getPlatform() as "ios" | "android" | "web";
const sound = this.getNotificationSound(sendbirdPayload, platform);
```

**Note:** This is safe because `getPlatform()` always returns one of these three values at runtime. The assertion is used to satisfy TypeScript's type checker.

### Pre-commit Type Checking

The project uses pre-commit hooks that run TypeScript type checking. If you encounter compilation errors:

1. **Run type check manually:**
   ```bash
   cd frontend
   npx tsc --noEmit --skipLibCheck
   ```

2. **Check for type definition updates:**
   - Update `@capacitor/push-notifications` and `@capacitor/local-notifications` packages
   - Run `npm update` to get latest type definitions

3. **If types are still incomplete:**
   - Use type assertions (`as any` or `as Type`) as shown above
   - Document why the assertion is safe (runtime behavior vs. type definitions)

## Error Handling

All errors are logged to Sentry with context:

```typescript
logError(error, {
  section: "push-notifications",
  action: "register-token",
  platform: getPlatform(),
});
```

**Error Context:**

- `section`: Always "push-notifications"
- `action`: Specific action that failed (e.g., "register-token", "initialize")
- `platform`: Current platform ("ios", "android", "web")

**Important:** Tokens are never logged to Sentry for security reasons. Only success/failure status is logged.

## Best Practices

1. **Permission Timing:**

   - Request permissions when user accesses chats (not on login)
   - Show brief explanation before requesting
   - Handle denial gracefully

2. **Token Management:**

   - Tokens are automatically refreshed when needed
   - Tokens are stored in localStorage for persistence
   - Maximum 20 tokens per platform (Sendbird limit)

3. **App Lifecycle:**

   - Foreground state is set when app comes to foreground
   - Background state is set when app goes to background
   - Tokens are refreshed on app resume
   - Initial notification check runs when app comes to foreground

4. **Closed App Handling:**

   - Early listeners are set up immediately to catch notification taps
   - Navigation callback is set when router is ready
   - Pending notifications are queued and processed when navigation becomes available
   - Fallback mechanisms check for stored notification data

5. **Error Handling:**
   - All errors are logged but don't block app functionality
   - App continues working even if push notifications fail
   - User-friendly error messages are shown when appropriate

## API Reference

### PushNotificationService

#### Methods

- `initialize(): Promise<void>` - Initialize push notification service
- `setupEarlyListeners(): void` - Set up early listeners for notification actions (called before initialization)
- `setNavigationCallback(callback: (url: string) => void): void` - Set navigation callback for router-based navigation
- `checkInitialNotification(): Promise<void>` - Check if app was launched from a notification
- `processPendingNotifications(): void` - Process any queued notification actions
- `getDeviceToken(): Promise<string | null>` - Get current device token
- `registerWithSendbird(token: string): Promise<void>` - Register token with Sendbird
- `unregisterFromSendbird(): Promise<void>` - Unregister from Sendbird
- `registerWithKlaviyo(token: string, email?: string): Promise<void>` - Register token with Klaviyo
- `getIsRegisteredWithKlaviyo(): boolean` - Get Klaviyo registration status
- `checkPermissions(): Promise<PermissionStatus>` - Check permission status
- `requestPermissions(): Promise<PermissionStatus>` - Request permissions
- `refreshToken(): Promise<void>` - Refresh device token
- `cleanup(): Promise<void>` - Clean up resources
- `getIsInitialized(): boolean` - Get initialization status
- `getIsRegisteredWithSendbird(): boolean` - Get Sendbird registration status

#### Callbacks

- `onTokenReceived(callback: (token: string) => void): void`
- `onNotificationReceived(callback: (notification) => void): void`
- `onNotificationAction(callback: (action) => void): void`

### usePushNotifications Hook

#### Returns

```typescript
{
  isSupported: boolean;
  hasPermission: boolean;
  permissionStatus: "prompt" | "granted" | "denied";
  deviceToken: string | null;
  isRegistered: boolean;
  error: string | null;
  requestPermissions: (explicitRequest?: boolean) => Promise<void>;
  registerToken: () => Promise<void>;
  unregisterToken: () => Promise<void>;
}
```

## Klaviyo Integration

### Overview

Push tokens are also registered with Klaviyo for marketing push notifications. This allows Klaviyo to send targeted push campaigns to users who have opted in.

### API Endpoint

**Location:** `frontend/pages/api/klaviyo-push-token.ts`

**Endpoint:** `POST /api/klaviyo-push-token`

### Request Format

```typescript
{
  token: string;        // Device push token (APNs or FCM)
  platform: "ios" | "android";
  email?: string;      // Optional: User's email for profile association
}
```

### Klaviyo API Payload

The endpoint creates a push token using Klaviyo's official API:

```json
{
  "data": {
    "type": "push-token",
    "attributes": {
      "token": "<device_push_token>",
      "platform": "ios" | "android",
      "vendor": "apns" | "fcm",
      "profile": {
        "data": {
          "type": "profile",
          "id": "<profile_id>" | {
            "type": "profile",
            "attributes": {
              "email": "<user_email>"
            }
          }
        }
      }
    }
  }
}
```

### Required Fields

- **token**: Device push token (required)
- **platform**: Must be "ios" or "android" (required)
- **vendor**: Automatically set based on platform
  - iOS: `"apns"` (Apple Push Notification Service)
  - Android: `"fcm"` (Firebase Cloud Messaging)
- **profile**: Profile association (required)
  - If profile ID exists: Uses existing profile
  - If email provided: Creates or finds profile by email
  - If neither: Returns 400 error

### Profile Association

The endpoint automatically handles profile association:

1. **If email is provided:**

   - Looks up existing profile by email
   - Creates new profile if not found
   - Associates push token with profile

2. **If no email:**
   - Returns 400 error (profile is required by Klaviyo API)

### Usage

Push tokens are automatically registered with Klaviyo when:

1. User logs in and has an email
2. Device token is received
3. Chat context initializes

**Manual Registration:**

```typescript
import { getPushNotificationService } from "@/services/pushNotificationService";

const pushService = getPushNotificationService();
const token = await pushService.getDeviceToken();

// Register with Klaviyo (email optional but recommended)
await pushService.registerWithKlaviyo(token, userEmail);
```

### Response Format

**Success (200):**

```json
{
  "success": true,
  "message": "Push token registered successfully",
  "profileId": "<klaviyo_profile_id>" | null,
  "pushTokenId": "<klaviyo_push_token_id>" | null
}
```

**Error (400):**

```json
{
  "error": "Missing required fields: token and platform are required"
}
```

or

```json
{
  "error": "Profile is required for push token registration. Email must be provided."
}
```

### Error Handling

The endpoint handles various error scenarios:

1. **Missing fields**: Returns 400 if token or platform is missing
2. **Invalid platform**: Returns 400 if platform is not "ios" or "android"
3. **Profile lookup failure**: Continues without profile association (logs warning)
4. **Profile creation failure**: Continues without profile association (logs warning)
5. **Klaviyo API errors**: Returns appropriate status code with error details
6. **Empty responses**: Handles cases where Klaviyo returns empty response body

All errors are logged to Sentry with context:

```typescript
logError(error, {
  section: "api",
  action: "klaviyo_push_token",
  platform: "ios" | "android",
  hasEmail: boolean,
  profileId: string | null,
  statusCode: number,
});
```

### API Configuration

**Environment Variables:**

- `KLAVIYO_API_KEY`: Klaviyo API key (required)
- `KLAVIYO_API_REVISION`: API revision (default: "2024-10-15")

**API Endpoint:**

- Base URL: `https://a.klaviyo.com/api`
- Push Tokens: `POST /push-tokens/`
- Profiles: `GET /profiles/?filter=...` or `POST /profiles/`

### Integration Points

1. **PushNotificationService** (`frontend/services/pushNotificationService.ts`)

   - Method: `registerWithKlaviyo(token: string, email?: string)`
   - Automatically called when token is received
   - Handles re-registration when email becomes available

2. **AppPushInitializer** (`frontend/components/AppPushInitializer.tsx`)

   - Registers token with Klaviyo when chat connects
   - Uses customer email if available

3. **ChatContext** (`frontend/contexts/chatContext.tsx`)

   - Registers token with Klaviyo during initialization
   - Uses customer email from context

4. **KlaviyoPushTokenRegistrar** (`frontend/components/KlaviyoPushTokenRegistrar.tsx`)
   - Dedicated component for Klaviyo registration
   - Watches for login state and customer email changes

### Best Practices

1. **Email Association:**

   - Always provide email when available
   - Enables targeted push campaigns
   - Improves user segmentation

2. **Re-registration:**

   - Service handles re-registration automatically
   - Re-registers when email becomes available
   - Prevents duplicate registrations

3. **Error Handling:**

   - Failures don't block app functionality
   - Errors are logged but don't throw
   - User experience continues even if Klaviyo registration fails

4. **Token Management:**
   - Tokens are registered once per device
   - Service tracks registration state
   - Prevents unnecessary API calls

### Troubleshooting

**Token Not Registered with Klaviyo:**

1. Check `KLAVIYO_API_KEY` is set in environment variables
2. Check console logs for registration errors
3. Verify email is provided (required for profile association)
4. Check Klaviyo API status and rate limits
5. Verify API revision is correct

**Profile Association Issues:**

1. Check email format is valid
2. Verify profile lookup/creation succeeded (check logs)
3. Check Klaviyo account has proper permissions
4. Verify API key has `profiles:write` and `push-tokens:write` scopes

**Empty Response Errors:**

- The endpoint handles empty responses gracefully
- Registration may succeed even with empty response
- Check Klaviyo dashboard to verify token was registered

## Sendbird Integration

### Overview

Push tokens are registered with Sendbird for chat message notifications. This allows Sendbird to send push notifications when users receive messages in chat channels, even when the app is in the background or closed.

### Registration Requirements

Push tokens are registered with Sendbird when **all** of the following conditions are met:

1. **Customer data is available** (customer ID must be present)
2. **Sendbird client is connected** (WebSocket connection established)
3. **Device token is received** (APNs for iOS, FCM for Android)
4. **Native platform** (iOS or Android, not web)

### Registration Flow

The registration follows the same pattern as Klaviyo for consistency:

1. **Customer logs in** → Customer data becomes available
2. **Sendbird connects** → WebSocket connection established
3. **Device token received** → Token available from Capacitor
4. **All requirements met** → Register push token with Sendbird

**Registration Timing:**

- If customer data is available before Sendbird connects → Registration happens when Sendbird connects
- If Sendbird connects before customer data is available → Registration happens when customer data loads
- If both are available simultaneously → Registration happens immediately

### SDK Methods

Sendbird uses SDK methods for push token registration:

**iOS:**
```typescript
await sendbirdClient.registerPushToken(token, "ios");
// Internally calls: sb.registerAPNSPushTokenForCurrentUser(token)
```

**Android:**
```typescript
await sendbirdClient.registerPushToken(token, "android");
// Internally calls: sb.registerGCMPushTokenForCurrentUser(token)
```

### Usage

Push tokens are automatically registered with Sendbird when:

1. User logs in and customer data is available
2. Sendbird client connects successfully
3. Device token is received
4. All requirements are met

**Manual Registration:**

```typescript
import { getPushNotificationService } from "@/services/pushNotificationService";
import { getPushTokenRegistrationManager } from "@/services/push-notifications/PushTokenRegistrationManager";

const pushService = getPushNotificationService();
const registrationManager = getPushTokenRegistrationManager();

// Update customer data
registrationManager.updateCustomerData(customer);

// Get token and register
const token = await pushService.getDeviceToken();
if (token) {
  await registrationManager.registerWithProviders(token);
}
```

### Android Logcat Logging

Sendbird push notification registration includes detailed logging for Android Studio logcat debugging.

**Filter Logs:**

```bash
# Filter for Sendbird push provider logs
adb logcat | Select-String -Pattern "SendbirdPushProvider"

# Filter for registration manager logs
adb logcat | Select-String -Pattern "PushTokenRegistrationManager"

# Filter for both
adb logcat | Select-String -Pattern "(SendbirdPushProvider|PushTokenRegistrationManager)"
```

**Log Format:**

All logs use the `[SendbirdPushProvider]` or `[PushTokenRegistrationManager]` prefix for easy filtering.

**Example Logs:**

```
[SendbirdPushProvider] Registration attempt: platform=android, customerId=***1234, hasToken=true, isConnected=true
[SendbirdPushProvider] Registering token with Sendbird: platform=android, customerId=***1234
[SendbirdPushProvider] Successfully registered token with Sendbird: platform=android, customerId=***1234
[SendbirdPushProvider] Cannot register - customer data not available
[SendbirdPushProvider] Cannot register - Sendbird not connected
[PushTokenRegistrationManager] Customer data updated: customerId=***1234, hasEmail=true, emailChanged=false, customerChanged=true
[PushTokenRegistrationManager] Registering token with providers: Klaviyo, Sendbird, platform=android, customerId=***1234, hasEmail=true
```

**Customer ID Privacy:**

- Customer IDs are sanitized in logs (only last 4 digits shown)
- Format: `***1234` instead of full customer ID
- This protects user privacy while allowing debugging

### Registration State Tracking

The `SendbirdPushProvider` tracks registration state to prevent duplicate registrations:

- **Registered Token**: Current device push token
- **Registered Customer ID**: Customer ID used for registration
- **Registration Flag**: Boolean indicating if currently registered

**Re-registration Triggers:**

- Token changes → Re-register with new token
- Customer ID changes → Re-register with new customer ID
- Sendbird reconnects → Re-register if token and customer ID are available

### Error Handling

Registration errors are logged but don't block app functionality:

```typescript
try {
  await sendbirdClient.registerPushToken(token, platform);
} catch (error) {
  // Error logged to Sentry with context
  // App continues working even if registration fails
}
```

**Error Context:**

- `section`: "push-notifications"
- `action`: "register-sendbird-token"
- `platform`: "ios" | "android"
- `provider`: "Sendbird"
- `hasCustomerId`: boolean

### Troubleshooting

**Token Not Registered with Sendbird:**

1. **Check customer data is available:**
   - Verify `customerId` is present in registration context
   - Check logs: `[SendbirdPushProvider] Cannot register - customer data not available`

2. **Check Sendbird connection:**
   - Verify `sendbirdClient.isConnected()` returns `true`
   - Check logs: `[SendbirdPushProvider] Cannot register - Sendbird not connected`
   - Ensure chat context initialized successfully

3. **Check registration manager has customer data:**
   - Verify `updateCustomerData()` was called with customer object
   - Check logs: `[PushTokenRegistrationManager] Customer data updated`

4. **Check console logs for registration attempts:**
   - Look for `[SendbirdPushProvider] Registration attempt` logs
   - Verify all requirements are met (platform, customerId, hasToken, isConnected)

5. **Verify token format:**
   - Token should be a non-empty string
   - Check logs for token validation errors

**Registration Timing Issues:**

- **Customer data loads before Sendbird connects**: Registration happens automatically when Sendbird connects
- **Sendbird connects before customer data loads**: Registration happens automatically when customer data becomes available
- **Both available simultaneously**: Registration happens immediately

**Android Logcat Debugging:**

1. Connect device via USB
2. Open Android Studio → View → Tool Windows → Logcat
3. Filter: `SendbirdPushProvider` or `PushTokenRegistrationManager`
4. Look for registration attempt logs
5. Check for error messages or skip reasons

**Common Issues:**

- **"Cannot register - customer data not available"**: Customer data hasn't loaded yet, wait for customer context to update
- **"Cannot register - Sendbird not connected"**: Chat context hasn't initialized, wait for Sendbird connection
- **"Already registered with same token"**: Normal behavior, prevents duplicate registrations

### Integration Points

1. **ChatContext** (`frontend/contexts/chatContext.tsx`)
   - Updates customer data in registration manager when available
   - Registers token with providers when token is received
   - Handles both new tokens and existing tokens

2. **PushTokenRegistrationManager** (`frontend/services/push-notifications/PushTokenRegistrationManager.ts`)
   - Orchestrates registration with all providers
   - Watches for customer data changes
   - Handles token refresh and re-registration

3. **SendbirdPushProvider** (`frontend/services/push-notifications/providers/SendbirdPushProvider.ts`)
   - Implements Sendbird-specific registration logic
   - Checks requirements (customer data + Sendbird connection)
   - Wraps SDK calls with error handling and logging

### Best Practices

1. **Customer Data Updates:**
   - Always call `updateCustomerData()` when customer data changes
   - Registration manager handles re-registration automatically

2. **Registration Timing:**
   - Don't manually trigger registration - let the manager handle it
   - Registration happens automatically when all requirements are met

3. **Error Handling:**
   - Registration failures don't block app functionality
   - Errors are logged to Sentry for monitoring
   - User experience continues even if registration fails

4. **Logging:**
   - Use Android logcat to debug registration issues
   - Filter by `SendbirdPushProvider` prefix for easy debugging
   - Customer IDs are sanitized in logs for privacy

## Related Files

### Core Services

- `frontend/services/pushNotificationService.ts` - Core service with image support
- `frontend/services/push-notifications/PushTokenRegistrationManager.ts` - Registration orchestrator
- `frontend/services/push-notifications/providers/IPushNotificationProvider.ts` - Provider interface
- `frontend/services/push-notifications/providers/KlaviyoPushProvider.ts` - Klaviyo provider
- `frontend/services/push-notifications/providers/SendbirdPushProvider.ts` - Sendbird provider
- `frontend/services/pushPermissionManager.ts` - Permission management
- `frontend/services/sendbirdClient.ts` - Sendbird integration

### Components & Hooks

- `frontend/hooks/usePushNotifications.ts` - React hook
- `frontend/components/AppPushInitializer.tsx` - Initialization component
- `frontend/components/KlaviyoPushTokenRegistrar.tsx` - Klaviyo registration component
- `frontend/contexts/chatContext.tsx` - Chat context integration
- `frontend/utils/hooks/useDeepLinkListener.ts` - Deep link handling

### Android Native Code

- `frontend/android/app/src/main/java/com/madmonkey/madmonkey/MadMonkeyFirebaseMessagingService.java` - Background notification handler for closed app state
- `frontend/android/app/src/main/java/com/madmonkey/madmonkey/FileUriConverterPlugin.java` - Custom plugin for notification images
- `frontend/android/app/src/main/java/com/madmonkey/madmonkey/MainActivity.java` - Plugin registration and deep link handling
- `frontend/android/app/src/main/AndroidManifest.xml` - FileProvider configuration and FirebaseMessagingService registration
- `frontend/android/app/src/main/res/xml/file_paths.xml` - FileProvider paths
- `frontend/android/app/proguard-rules.pro` - ProGuard rules for plugin

### TypeScript Plugin Definitions

- `frontend/plugins/FileUriConverter.ts` - Plugin registration
- `frontend/plugins/definitions.ts` - TypeScript interface definitions
- `frontend/plugins/web.ts` - Web platform implementation

### API & Utilities

- `frontend/utils/klaviyoRegistration.ts` - Klaviyo API utilities
- `frontend/pages/api/klaviyo-push-token.ts` - Klaviyo push token API endpoint
- `frontend/pages/_app.tsx` - App lifecycle management

### Documentation

- `frontend/ANDROID_PUSH_NOTIFICATION_FIX_SUMMARY.md` - Image fix implementation details
- `frontend/android/JAVA_21_REQUIREMENT.md` - Java 21 setup instructions

## Architecture Documentation

For detailed information about the push notification architecture, provider system, and how to add new providers, see:

**[Push Notification Architecture Documentation](./PUSH_NOTIFICATIONS_ARCHITECTURE.md)**

## Additional Resources

- [Capacitor Push Notifications Docs](https://capacitorjs.com/docs/apis/push-notifications)
- [Capacitor Local Notifications Docs](https://capacitorjs.com/docs/apis/local-notifications)
- [Sendbird Push Notifications Docs](https://sendbird.com/docs/chat/sdk/v3/javascript/guides/push-notifications)
- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Klaviyo Push Tokens API](https://developers.klaviyo.com/en/reference/create_push_token)
- [Android FileProvider Documentation](https://developer.android.com/reference/androidx/core/content/FileProvider)
- [Android Notification Big Picture Style](https://developer.android.com/training/notify-user/expanded#image-style)

## Image Support Implementation

For detailed information about the Android image support implementation, including:

- Custom `FileUriConverterPlugin` architecture
- Image download and caching process
- URI conversion and FileProvider integration
- Troubleshooting image display issues

See: **[Android Push Notification Image Fix Summary](../ANDROID_PUSH_NOTIFICATION_FIX_SUMMARY.md)**
