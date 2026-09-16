# Mobile Platform Documentation Index

This document provides an index of mobile platform-specific documentation for the Mad Monkey V3 application.

## Android

### Status Bar Configuration
**File**: `frontend/docs/ANDROID_STATUS_BAR_CONFIGURATION.md`

Comprehensive guide covering:
- Capacitor StatusBar plugin configuration and naming conventions
- Android API 35+ edge-to-edge mode compatibility
- Native Java configuration in MainActivity
- Status bar hooks usage
- Troubleshooting common issues

**Key Points**:
- ⚠️ **Critical**: `Style.Dark` = light icons, `Style.Light` = dark icons (counter-intuitive naming)
- Dual approach: XML theme configuration + programmatic native code
- Required for Android 15+ edge-to-edge enforcement

### Related Files
- `frontend/capacitor.config.ts` - Capacitor plugin configuration
- `frontend/android/app/src/main/res/values/styles.xml` - Android theme configuration
- `frontend/android/app/src/main/java/com/madmonkey/madmonkey/MainActivity.java` - Native status bar configuration
- `frontend/pages/_app.tsx` - Status bar initialization
- `frontend/hooks/useStatusBar.ts` - Status bar hooks

### Local Emulator Testing
**File**: [`frontend/docs/ANDROID_EMULATOR_LOCAL_TESTING.md`](../frontend/docs/ANDROID_EMULATOR_LOCAL_TESTING.md)

Practical troubleshooting for running a local debug build on an Android emulator: pointing the WebView at your dev server (`10.0.2.2`, not `localhost`), AVD storage errors on install, CORS failures when calling the staging backend from an emulator origin (and the `kubectl`/`doctl` port-forward fix), Google Sign-In's generic "problem communicating with Google servers" error (debug keystore SHA-1 registration vs. antivirus SSL inspection — two different causes, same symptom), and — a separate, production-only failure — Google Sign-In working on local/emulator release builds but failing instantly on the actual Play Store app (Play App Signing key SHA-1 vs. Upload key SHA-1, plus the reminder that native plugin changes require an actual new release, not just a config fix). Also covers two silent v4-only hydration bugs found 2026-09-15 (Cookiebot's `beforeInteractive` script colliding with Next 16's metadata Suspense boundary; a missing `allowedDevOrigins` entry breaking HMR's WebSocket) and the CDP-over-`adb forward` technique that's the fast way to diagnose "nothing on the page responds to taps" instead of guessing at tap coordinates.

### v4 Native Bootstrap & Auth Parity

The `app/v4/*` tree (App Router) is a parallel route structure to the legacy `pages/*`
tree (Pages Router) in the same Next.js deployment, and `app/layout.tsx` does not
automatically inherit anything `pages/_app.tsx` mounts. As of 2026-09-15:

- **Shipped**: a shared native bootstrap (Android back button, GTM, Microsoft
  Clarity — `app/_components/native/NativeBootstrap.tsx`) and a deferred,
  identity-dependent tier (push token registration, Klaviyo push, geofencing,
  deep-link routing — `app/_components/native/{PushInitializerApp,
  KlaviyoPushTokenRegistrarApp, GeofenceNativeBootstrapApp, DeepLinkRouterApp,
  DeferredNativeIdentityBootstrap}.tsx`), both mounted in `app/layout.tsx`, so v4
  routes now get the same native integrations the legacy tree always had.
- **Shipped**: native Google sign-in on `app/v4/login` /`app/v4/register`.
  `services/v3-services/auth/firebaseApiService.ts`'s `unifiedGoogleLogin()`
  previously always used `signInWithPopup`, which Google actively blocks inside an
  embedded WebView — native Google sign-in wasn't just unported, it was silently
  broken. Now branches on `Capacitor.isNativePlatform()` to use
  `@capgo/capacitor-social-login` on native, matching the legacy
  `SocialSignIn.tsx` flow. Verified end-to-end on a real Android emulator and in a
  desktop browser (email/password and Google, full backend customer enrichment,
  not just the Firebase-token layer).
- **Not built yet**: native Apple sign-in on `app/v4/login` — deliberately scoped
  out (Google-only for now) pending device testing.
- **Test coverage**: `frontend/e2e/tests/v4-login.spec.ts` (Playwright, web/webview
  content) and `frontend/e2e-native/specs/v4-login.e2e.ts` (WebdriverIO/Appium,
  real native shell) both cover the v4 login screen — hydration canary, wrong
  credentials, valid login + session enrichment, and Google sign-in's correct
  branch (web popup vs. native picker). **The native spec's Android branch has no
  Appium capability to actually run against yet** — `e2e-native/wdio.conf.ts` is
  still iOS-Simulator-only; this session's on-device verification was done via ad
  hoc ADB/CDP scripts, not through the `e2e-native` harness. See
  `frontend/e2e-native/README.md`.

## iOS

### Settings Fix
**File**: `docs/IOS_SETTINGS_FIX.md`

Documentation for iOS-specific configuration fixes and settings.

## Cross-Platform

### Chat Window Keyboard Handling
**File**: [`frontend/docs/CHATWINDOW_KEYBOARD_HANDLING.md`](../frontend/docs/CHATWINDOW_KEYBOARD_HANDLING.md) (canonical, most detailed).

A shorter umbrella copy exists at [`docs/CHATWINDOW_KEYBOARD_HANDLING.md`](./CHATWINDOW_KEYBOARD_HANDLING.md).

### SendBird Integration
**Files** (tracked at workspace `docs/`):
- [`SENDBIRD_INTEGRATION.md`](./SENDBIRD_INTEGRATION.md) – Main integration documentation
- [`MY_CHATS_COMPREHENSIVE_DOCUMENTATION.md`](./MY_CHATS_COMPREHENSIVE_DOCUMENTATION.md) – Comprehensive chat feature docs
- [`SENDBIRD_IMAGE_ATTACHMENTS_SUMMARY.md`](./SENDBIRD_IMAGE_ATTACHMENTS_SUMMARY.md) – Image attachment handling
- [`SENDBIRD_DISCOVERY_QUESTIONS.md`](./SENDBIRD_DISCOVERY_QUESTIONS.md) – Discovery and Q&A features

### Klaviyo WhatsApp marketing & geofencing

**Canonical doc:** [`frontend/docs/KLAVIYO_WHATSAPP_MARKETING_OPT_IN.md`](../frontend/docs/KLAVIYO_WHATSAPP_MARKETING_OPT_IN.md)

Native Capacitor builds only: after **sign-in** and **auth rehydration**, the traveller may accept **`GeofenceLocationDisclosure`**, which bundles **nearby-location / geofence** use with **WhatsApp marketing** consent (no separate checkbox). When the **OS** grants location and the background watcher reports a valid fix, the app calls **`POST /marketing/whatsapp-consent`** once per user (after success), backed by Klaviyo Profiles API on the server. Logged-out users do not enter this pipeline.

## Architecture Reference

For high-level architecture information, see:
- [`ARCHITECTURE.md`](../ARCHITECTURE.md) – Full-stack architecture overview
- [`frontend/docs/DOCUMENTATION_UPDATE_SUMMARY.md`](../frontend/docs/DOCUMENTATION_UPDATE_SUMMARY.md) – Recent frontend-facing documentation changelog

## Quick Links

- [Android Status Bar Configuration](../frontend/docs/ANDROID_STATUS_BAR_CONFIGURATION.md)
- [Android Local Emulator Testing](../frontend/docs/ANDROID_EMULATOR_LOCAL_TESTING.md)
- [iOS Settings Fix](./IOS_SETTINGS_FIX.md)
- [Chat Window Keyboard Handling](../frontend/docs/CHATWINDOW_KEYBOARD_HANDLING.md)
- [Klaviyo WhatsApp marketing opt-in (geofence)](../frontend/docs/KLAVIYO_WHATSAPP_MARKETING_OPT_IN.md)
- [SendBird Integration](./SENDBIRD_INTEGRATION.md)

---

_Last Updated: September 2026_
