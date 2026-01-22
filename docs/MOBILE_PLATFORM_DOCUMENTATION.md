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

## iOS

### Settings Fix
**File**: `frontend/docs/IOS_SETTINGS_FIX.md`

Documentation for iOS-specific configuration fixes and settings.

## Cross-Platform

### Chat Window Keyboard Handling
**File**: `frontend/docs/CHATWINDOW_KEYBOARD_HANDLING.md`

Documentation for keyboard handling in chat windows across mobile platforms.

### SendBird Integration
**Files**:
- `frontend/docs/SENDBIRD_INTEGRATION.md` - Main integration documentation
- `frontend/docs/MY_CHATS_COMPREHENSIVE_DOCUMENTATION.md` - Comprehensive chat feature docs
- `frontend/docs/SENDBIRD_IMAGE_ATTACHMENTS_SUMMARY.md` - Image attachment handling
- `frontend/docs/SENDBIRD_DISCOVERY_QUESTIONS.md` - Discovery and Q&A features

## Architecture Reference

For high-level architecture information, see:
- `ARCHITECTURE.md` - Full-stack architecture overview
- `frontend/docs/DOCUMENTATION_UPDATE_SUMMARY.md` - Recent documentation updates

## Quick Links

- [Android Status Bar Configuration](../frontend/docs/ANDROID_STATUS_BAR_CONFIGURATION.md)
- [iOS Settings Fix](../frontend/docs/IOS_SETTINGS_FIX.md)
- [Chat Window Keyboard Handling](../frontend/docs/CHATWINDOW_KEYBOARD_HANDLING.md)
- [SendBird Integration](../frontend/docs/SENDBIRD_INTEGRATION.md)

---

_Last Updated: January 2025_
