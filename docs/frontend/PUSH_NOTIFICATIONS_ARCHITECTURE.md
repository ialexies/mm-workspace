# Push Notification Architecture Documentation

## Overview

The push notification system provides a centralized, extensible architecture for managing push token registration across multiple providers (Klaviyo, Sendbird, etc.). The system uses a provider pattern to separate core push notification functionality from provider-specific logic, making it easy to add new providers and maintain existing ones.

### Key Benefits

- **Separation of Concerns**: Core service handles token management, permissions, and listeners; providers handle provider-specific registration logic
- **Extensibility**: Easy to add new providers (OneSignal, Firebase, etc.) without modifying core service
- **Single Source of Truth**: Registration timing managed centrally through `PushTokenRegistrationManager`
- **Email Requirement Compliance**: Klaviyo only registers when customer email is available (API requirement)
- **Better Organization**: Related code grouped together in logical modules
- **Backward Compatibility**: Existing API surface maintained for gradual migration

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    PushNotificationService                    │
│  (Core: Token Management, Permissions, Listeners, Nav)      │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ Uses
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            PushTokenRegistrationManager                       │
│  (Orchestrates registration with multiple providers)         │
└──────┬──────────────────────────────┬───────────────────────┘
       │                              │
       │ Manages                      │ Manages
       ▼                              ▼
┌──────────────────┐          ┌──────────────────┐
│ KlaviyoProvider  │          │ SendbirdProvider │
│                  │          │                  │
│ - Requires email │          │ - Requires      │
│ - API calls      │          │   connection    │
│ - State tracking │          │ - SDK calls      │
└──────────────────┘          └──────────────────┘
```

## File Structure

```
frontend/
├── services/
│   ├── pushNotificationService.ts (core service, refactored)
│   └── push-notifications/
│       ├── providers/
│       │   ├── IPushNotificationProvider.ts (interface)
│       │   ├── KlaviyoPushProvider.ts
│       │   └── SendbirdPushProvider.ts
│       └── PushTokenRegistrationManager.ts (orchestrator)
├── utils/
│   └── klaviyoRegistration.ts (Klaviyo API utilities)
└── components/
    ├── AppPushInitializer.tsx (simplified)
    └── KlaviyoPushTokenRegistrar.tsx (simplified)
```

## Core Components

### 1. PushNotificationService

**Location:** `frontend/services/pushNotificationService.ts`

Core service that handles platform-specific push notification functionality:

- Platform detection (iOS/Android/Web)
- Permission management
- Device token retrieval and storage
- Notification event handling (foreground, background, action)
- Navigation handling for notification taps
- Early listener setup for closed app state

**Key Changes:**

- Removed provider-specific logic (Klaviyo, Sendbird)
- Added provider registry system
- Maintains backward compatibility with deprecated methods

**Key Methods:**

```typescript
// Initialize push notifications
await pushService.initialize();

// Get device token
const token = await pushService.getDeviceToken();

// Update customer data (triggers provider registration)
pushService.updateCustomerData(customer);

// Backward compatibility methods (deprecated)
await pushService.registerWithSendbird(token);
await pushService.registerWithKlaviyo(token, email);
```

### 2. PushTokenRegistrationManager

**Location:** `frontend/services/push-notifications/PushTokenRegistrationManager.ts`

Central orchestrator for push token registration with multiple providers:

- Manages provider registry
- Watches for customer data availability
- Handles token refresh and re-registration
- Single source of truth for registration timing

**Key Methods:**

```typescript
// Register a provider
registrationManager.registerProvider(provider);

// Update customer data (triggers re-registration if needed)
registrationManager.updateCustomerData(customer);

// Register token with all applicable providers
await registrationManager.registerWithProviders(token);

// Unregister from all providers
await registrationManager.unregisterFromProviders();

// Get registration status
const status = registrationManager.getRegistrationStatus();
```

### 3. IPushNotificationProvider Interface

**Location:** `frontend/services/push-notifications/providers/IPushNotificationProvider.ts`

Defines the contract for push notification providers:

```typescript
interface IPushNotificationProvider {
  getName(): string;
  canRegister(context: PushRegistrationContext): boolean;
  register(token: string, context: PushRegistrationContext): Promise<void>;
  unregister(context: PushRegistrationContext): Promise<void>;
  isRegistered(): boolean;
}
```

**PushRegistrationContext:**

```typescript
interface PushRegistrationContext {
  platform: "ios" | "android";
  customerEmail?: string;
  customerId?: string | number;
  [key: string]: unknown;
}
```

### 4. KlaviyoPushProvider

**Location:** `frontend/services/push-notifications/providers/KlaviyoPushProvider.ts`

Handles push token registration with Klaviyo:

- **Requires email address** for registration (API compliance)
- Uses `registerPushTokenWithKlaviyo` from `utils/klaviyoRegistration.ts`
- Tracks registration state internally
- Handles re-registration when email becomes available

**Key Features:**

- `canRegister()` checks for email requirement
- `register()` validates email before API call
- Tracks registered token and email to prevent duplicate registrations

### 5. SendbirdPushProvider

**Location:** `frontend/services/push-notifications/providers/SendbirdPushProvider.ts`

Handles push token registration with Sendbird:

- **Requires customer data** (customer ID) for registration (similar to Klaviyo's email requirement)
- **Requires Sendbird connection** for registration
- Wraps `sendbirdClient.registerPushToken()` calls
- Tracks registration state internally
- Includes detailed Android logcat logging

**Key Features:**

- `canRegister()` checks for customer data availability and Sendbird connection state
- `register()` validates both requirements before SDK call
- Tracks registered token and customer ID to prevent duplicate registrations
- Sanitizes customer IDs in logs (shows only last 4 digits) for privacy
- Logs all registration attempts, successes, and failures for Android logcat debugging

## Registration Flow

### Initialization Flow

```
1. App starts
   ↓
2. PushNotificationService.initialize()
   - Requests permissions
   - Registers for push tokens
   ↓
3. Token received via Capacitor
   ↓
4. PushNotificationService.onTokenReceived callback
   ↓
5. PushTokenRegistrationManager.registerWithProviders(token)
   ↓
6. For each provider:
   - Check canRegister(context)
   - If yes: provider.register(token, context)
   - If no: Skip provider
```

### Customer Data Flow

```
1. Customer logs in
   ↓
2. Customer data becomes available
   ↓
3. Component calls registrationManager.updateCustomerData(customer)
   ↓
4. RegistrationManager detects customer data change
   ↓
5. If token exists: registerWithProviders(token)
   ↓
6. For each provider:
   - KlaviyoProvider.canRegister() checks for email (now returns true)
   - SendbirdPushProvider.canRegister() checks for customer ID and Sendbird connection
   ↓
7. Providers that can register execute registration
   - KlaviyoProvider.register() executes (email available)
   - SendbirdPushProvider.register() executes (customer ID + Sendbird connection available)
```

### Token Refresh Flow

```
1. Token refreshes (platform-specific)
   ↓
2. New token received via Capacitor
   ↓
3. PushNotificationService.onTokenReceived callback
   ↓
4. PushTokenRegistrationManager.registerWithProviders(newToken)
   ↓
5. Providers detect token change
   ↓
6. Providers re-register with new token
```

## Integration Points

### AppPushInitializer

**Location:** `frontend/components/AppPushInitializer.tsx`

**Changes:**

- Removed direct Klaviyo/Sendbird registration calls
- Uses `PushTokenRegistrationManager` instead
- Updates customer data when it changes

**Key Code:**

```typescript
// Update customer data in registration manager
useEffect(() => {
  if (!Capacitor.isNativePlatform()) return;
  const registrationManager = getPushTokenRegistrationManager();
  registrationManager.updateCustomerData(customer || null);
}, [customer]);

// Register when chat connects
useEffect(() => {
  if (!isConnected) return;
  const registrationManager = getPushTokenRegistrationManager();
  registrationManager.updateCustomerData(customer || null);
  await registrationManager.registerWithProviders(token);
}, [isConnected, customer]);
```

### KlaviyoPushTokenRegistrar

**Location:** `frontend/components/KlaviyoPushTokenRegistrar.tsx`

**Changes:**

- Simplified to watch customer data
- Updates registration manager when customer data changes
- Registration manager handles actual registration

**Key Code:**

```typescript
useEffect(() => {
  if (!Capacitor.isNativePlatform() || !isLoggedIn) return;

  const registrationManager = getPushTokenRegistrationManager();
  registrationManager.updateCustomerData(customer || null);

  // Also try to register if token is available
  const registerIfTokenAvailable = async () => {
    const token = await pushService.getDeviceToken();
    if (token) {
      await registrationManager.registerWithProviders(token);
    }
  };
  registerIfTokenAvailable();
}, [isLoggedIn, customer]);
```

### ChatContext

**Location:** `frontend/contexts/chatContext.tsx`

**Changes:**

- Removed direct Klaviyo registration calls
- Uses registration manager for all provider registrations
- Updates customer data when available

**Key Code:**

```typescript
pushService.onTokenReceived(async (token) => {
  const registrationManager = getPushTokenRegistrationManager();
  registrationManager.updateCustomerData(customer || null);
  await registrationManager.registerWithProviders(token);
});
```

## API Compliance

### Klaviyo API Compliance

**Endpoint:** `POST /api/push-tokens/` (Klaviyo API)

**Requirements:**

- Token and platform are required (ios/android)
- Vendor must be "apns" for iOS, "fcm" for Android
- Profile is REQUIRED in attributes
- Profile requires email to create/find

**Implementation:**

- `KlaviyoPushProvider.canRegister()` checks for email
- Registration only proceeds when `customerEmail` is available
- Uses `registerPushTokenWithKlaviyo()` from `utils/klaviyoRegistration.ts`

### Sendbird SDK Compliance

**SDK Methods:**

- iOS: `registerAPNSPushTokenForCurrentUser(token)`
- Android: `registerGCMPushTokenForCurrentUser(token)` (FCM backward compatible)

**Requirements:**

- **Customer data must be available** (customer ID required)
- Client must be initialized and connected (OPEN state)
- Valid token string required
- Platform-specific methods for iOS/Android

**Implementation:**

- `SendbirdPushProvider.canRegister()` checks for customer data availability and Sendbird connection state
- Registration only proceeds when both customer ID and Sendbird connection are available
- Follows same pattern as Klaviyo (requires customer data) for consistency
- Wraps existing SDK calls correctly
- Includes detailed Android logcat logging for debugging

## Adding a New Provider

To add a new push notification provider (e.g., OneSignal, Firebase):

1. **Create Provider Class:**

```typescript
// frontend/services/push-notifications/providers/OneSignalPushProvider.ts
import {
  IPushNotificationProvider,
  PushRegistrationContext,
} from "./IPushNotificationProvider";

export class OneSignalPushProvider implements IPushNotificationProvider {
  getName(): string {
    return "OneSignal";
  }

  canRegister(context: PushRegistrationContext): boolean {
    // Add your requirements check here
    return true; // or false based on requirements
  }

  async register(
    token: string,
    context: PushRegistrationContext
  ): Promise<void> {
    // Implement registration logic
    // Call OneSignal SDK or API
  }

  async unregister(context: PushRegistrationContext): Promise<void> {
    // Implement unregistration logic
  }

  isRegistered(): boolean {
    // Return registration state
    return false;
  }
}
```

2. **Register Provider in PushNotificationService:**

```typescript
// In pushNotificationService.ts constructor
private oneSignalProvider: OneSignalPushProvider;

constructor() {
  // ... existing code ...
  this.oneSignalProvider = new OneSignalPushProvider();
  this.registrationManager.registerProvider(this.oneSignalProvider);
}
```

3. **Provider will automatically be used:**

The registration manager will automatically:

- Check `canRegister()` when token is received
- Call `register()` if requirements are met
- Handle errors gracefully
- Track registration state

## Usage Examples

### Manual Registration

```typescript
import { getPushTokenRegistrationManager } from "@/services/push-notifications/PushTokenRegistrationManager";
import { getPushNotificationService } from "@/services/pushNotificationService";

// Get services
const pushService = getPushNotificationService();
const registrationManager = getPushTokenRegistrationManager();

// Get token
const token = await pushService.getDeviceToken();

// Update customer data
registrationManager.updateCustomerData(customer);

// Register with all providers
await registrationManager.registerWithProviders(token);
```

### Check Registration Status

```typescript
const registrationManager = getPushTokenRegistrationManager();

// Get status for all providers
const status = registrationManager.getRegistrationStatus();
// Returns: { Klaviyo: true, Sendbird: false }

// Check if registered with any provider
const isRegistered = registrationManager.isRegisteredWithAnyProvider();
```

### Provider-Specific Checks

```typescript
const pushService = getPushNotificationService();

// Check Klaviyo registration (backward compatibility)
const isKlaviyoRegistered = pushService.getIsRegisteredWithKlaviyo();

// Check Sendbird registration (backward compatibility)
const isSendbirdRegistered = pushService.getIsRegisteredWithSendbird();
```

## State Management

### Registration State

Each provider maintains its own registration state:

- **KlaviyoPushProvider**: Tracks `registeredToken` and `registeredEmail`
- **SendbirdPushProvider**: Tracks `registeredToken` and `registeredCustomerId`

### Customer Data State

`PushTokenRegistrationManager` tracks:

- `currentToken`: Current device push token
- `currentCustomer`: Current customer data (for email requirement)

### State Updates

State updates trigger re-registration:

- Token changes → Re-register with all providers
- Email changes → Re-register with Klaviyo (if email now available)
- Customer ID changes → Re-register with Sendbird (if customer ID now available)
- Customer changes → Re-register with all providers

## Error Handling

### Provider Errors

Provider errors are handled gracefully:

```typescript
// In PushTokenRegistrationManager.registerWithProviders()
const registrationPromises = this.providers.map(async (provider) => {
  try {
    if (provider.canRegister(context)) {
      await provider.register(token, context);
    }
  } catch (error) {
    console.error(`Failed to register with ${provider.getName()}:`, error);
    // Don't throw - continue with other providers
  }
});

await Promise.allSettled(registrationPromises);
```

### Error Logging

All errors are logged to Sentry with context:

```typescript
logError(error, {
  section: "push-notifications",
  action: "register-klaviyo-token",
  platform: getPlatform(),
  provider: "Klaviyo",
  hasEmail: !!email,
});
```

## Troubleshooting

### Klaviyo Not Registering

**Issue:** Token not registered with Klaviyo

**Solutions:**

1. Check customer email is available
   - `KlaviyoPushProvider.canRegister()` requires email
   - Check `registrationManager.getCurrentCustomer()?.email`
2. Check registration manager has customer data
   - Verify `updateCustomerData()` was called
3. Check console logs for `canRegister()` results
4. Verify Klaviyo API key is configured

### Sendbird Not Registering

**Issue:** Token not registered with Sendbird

**Solutions:**

1. Check customer data is available
   - `SendbirdPushProvider.canRegister()` requires customer ID
   - Check `registrationManager.getCurrentCustomer()?.id`
   - Verify `updateCustomerData()` was called with customer object
   - Check Android logcat: `[SendbirdPushProvider] Cannot register - customer data not available`

2. Check Sendbird connection state
   - `SendbirdPushProvider.canRegister()` requires connection
   - Verify `sendbirdClient.isConnected()` returns true
   - Check Android logcat: `[SendbirdPushProvider] Cannot register - Sendbird not connected`

3. Check chat context initialized
   - Sendbird registration happens after chat connection
   - Verify chat context has initialized successfully

4. Check Android logcat for detailed logs
   - Filter: `adb logcat | Select-String -Pattern "SendbirdPushProvider"`
   - Look for registration attempt logs with context details
   - Verify all requirements are met (platform, customerId, hasToken, isConnected)

### Multiple Registrations

**Issue:** Token registered multiple times

**Solutions:**

1. Providers track registration state internally
2. Check `provider.isRegistered()` before registering
3. Providers check token/email hasn't changed before re-registering

### Customer Email Not Updating

**Issue:** Klaviyo registration doesn't happen when email becomes available

**Solutions:**

1. Verify `updateCustomerData()` is called when customer loads
2. Check `KlaviyoPushTokenRegistrar` component is mounted
3. Check customer context provides email
4. Verify registration manager detects email change

## Migration Notes

### Backward Compatibility

The following methods are deprecated but still work:

```typescript
// Deprecated but functional
await pushService.registerWithSendbird(token);
await pushService.registerWithKlaviyo(token, email);
await pushService.unregisterFromSendbird();
await pushService.unregisterFromKlaviyo();
```

These methods now delegate to the registration manager internally.

### Gradual Migration

Components can be migrated gradually:

1. New code should use `PushTokenRegistrationManager` directly
2. Existing code continues to work via deprecated methods
3. Components updated to use registration manager when convenient

## Best Practices

1. **Customer Data Updates:**

   - Always call `updateCustomerData()` when customer data changes
   - Registration manager handles re-registration automatically

2. **Provider Requirements:**

   - Implement `canRegister()` correctly
   - Check all requirements before attempting registration
   - Return `false` if requirements not met (don't throw)

3. **Error Handling:**

   - Don't throw errors in provider `register()` methods
   - Log errors but allow other providers to continue
   - Use `Promise.allSettled()` for parallel registrations

4. **State Tracking:**

   - Track registration state internally in providers
   - Prevent duplicate registrations
   - Re-register when token or requirements change

5. **Testing:**
   - Test `canRegister()` with various contexts
   - Test registration with missing requirements
   - Test re-registration when requirements become available

## Quick Reference

### Common Tasks

**Register token with all providers:**

```typescript
const registrationManager = getPushTokenRegistrationManager();
await registrationManager.registerWithProviders(token);
```

**Update customer data (triggers re-registration):**

```typescript
const registrationManager = getPushTokenRegistrationManager();
registrationManager.updateCustomerData(customer);
```

**Check registration status:**

```typescript
const registrationManager = getPushTokenRegistrationManager();
const status = registrationManager.getRegistrationStatus();
// Returns: { Klaviyo: true, Sendbird: false }
```

**Add a new provider:**

1. Create provider class implementing `IPushNotificationProvider`
2. Register provider in `PushNotificationService` constructor
3. Provider automatically used by registration manager

### Key Files

- **Core Service**: `services/pushNotificationService.ts`
- **Registration Manager**: `services/push-notifications/PushTokenRegistrationManager.ts`
- **Provider Interface**: `services/push-notifications/providers/IPushNotificationProvider.ts`
- **Klaviyo Provider**: `services/push-notifications/providers/KlaviyoPushProvider.ts`
- **Sendbird Provider**: `services/push-notifications/providers/SendbirdPushProvider.ts`

### Key Concepts

1. **Provider Pattern**: Each provider (Klaviyo, Sendbird) implements `IPushNotificationProvider`
2. **Registration Manager**: Orchestrates registration with all providers
3. **Email Requirement**: Klaviyo requires email before registration
4. **Connection Requirement**: Sendbird requires connection before registration
5. **Automatic Re-registration**: Manager detects changes and re-registers automatically

## Related Documentation

- [Push Notifications Implementation](./PUSH_NOTIFICATIONS.md) - Implementation details and setup
- [Sendbird Chat Integration](./SENDBIRD_CHAT_INTEGRATION.md) - Sendbird integration details
- [Klaviyo API Reference](https://developers.klaviyo.com/en/reference/create_push_token)

## Related Files

- `frontend/services/pushNotificationService.ts` - Core service
- `frontend/services/push-notifications/PushTokenRegistrationManager.ts` - Registration orchestrator
- `frontend/services/push-notifications/providers/IPushNotificationProvider.ts` - Provider interface
- `frontend/services/push-notifications/providers/KlaviyoPushProvider.ts` - Klaviyo provider
- `frontend/services/push-notifications/providers/SendbirdPushProvider.ts` - Sendbird provider
- `frontend/utils/klaviyoRegistration.ts` - Klaviyo API utilities
- `frontend/components/AppPushInitializer.tsx` - Initialization component
- `frontend/components/KlaviyoPushTokenRegistrar.tsx` - Klaviyo registration component
- `frontend/contexts/chatContext.tsx` - Chat context integration
