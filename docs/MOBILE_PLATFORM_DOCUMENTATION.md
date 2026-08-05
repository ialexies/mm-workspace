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

Practical troubleshooting for running a local debug build on an Android emulator: pointing the WebView at your dev server (`10.0.2.2`, not `localhost`), AVD storage errors on install, CORS failures when calling the staging backend from an emulator origin (and the `kubectl`/`doctl` port-forward fix), and Google Sign-In's generic "problem communicating with Google servers" error (debug keystore SHA-1 registration vs. antivirus SSL inspection — two different causes, same symptom).

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

_Last Updated: May 2026_
