# ChatWindow Mobile Keyboard Handling

## Overview

This document explains how the ChatWindow component handles mobile keyboard behavior when using SendBird UIKit v3 with Capacitor. The implementation ensures that:

1. Messages are visible and scrollable
2. The message input stays visible just above the keyboard when it appears
3. The layout adapts smoothly without breaking SendBird's internal structure

## Architecture

### Key Principle

**Don't fight SendBird's layout system** - We only adjust what's necessary for keyboard handling without forcing our own layout structure on SendBird components.

### Approach

Instead of forcing flexbox layouts or changing SendBird's DOM structure, we use a minimal approach:
- **When keyboard shows**: Add `padding-bottom` to the `.sendbird-conversation` container equal to keyboard height
- **When keyboard hides**: Remove the padding
- This pushes content up naturally without breaking SendBird's internal layout

## Implementation

### 1. Capacitor Configuration

**File:** `frontend/capacitor.config.ts`

```typescript
Keyboard: {
  resize: KeyboardResize.None, // We handle resizing manually
  resizeOnFullScreen: true,     // Important for Android edge-to-edge mode
}
```

**Why `resize: None`?**
- Prevents Capacitor from automatically resizing the WebView
- Gives us full control over how the layout adapts to keyboard
- Works better with SendBird's internal layout system

**Why `resizeOnFullScreen: true`?**
- Required for Android apps using edge-to-edge mode
- Ensures keyboard events work correctly in full-screen scenarios
- Required because `adjustMarginsForEdgeToEdge: "force"` is enabled

### 2. Keyboard Event Handler

**File:** `frontend/components/molecules/ChatWindow.tsx`
**Location:** Lines ~3302-3377

The keyboard handler uses a minimal, non-intrusive approach:

#### Helper Functions

```typescript
// Finds conversation element with retry mechanism (waits for SendBird to render)
const findConversationElement = (maxRetries = 5, delay = 100): Promise<HTMLElement | null>

// Handles keyboard show event
const handleKeyboardShow = async (info: KeyboardInfo)

// Handles keyboard hide event  
const handleKeyboardHide = async ()
```

#### How It Works

**When Keyboard Shows:**
1. Wait for SendBird to render (with retry mechanism)
2. Find the `.sendbird-conversation` element
3. Add `padding-bottom` equal to keyboard height
4. This pushes all content up, keeping input visible above keyboard

**When Keyboard Hides:**
1. Find the conversation element
2. Remove the `padding-bottom`
3. Content returns to normal position

#### Key Implementation Details

- **Retry mechanism**: Waits up to 5 attempts (100ms delay) for SendBird to render
- **Uses `padding-bottom`**: Less intrusive than `max-height`, works with SendBird's layout
- **Smooth transitions**: Uses CSS transitions for smooth animations
- **Proper cleanup**: Removes padding on component unmount

### 3. CSS Rules

**File:** `frontend/components/molecules/ChatWindow.tsx`
**Location:** In the styleElement.textContent around line 174

**Important:** We do NOT add aggressive CSS that forces flexbox or layout changes on SendBird containers. We only add minimal rules that don't interfere:

```css
/* Only basic padding adjustments - no layout forcing */
.sendbird-conversation__messages-padding {
  padding-left: 0 !important;
  padding-right: 0 !important;
}
```

**What we DON'T do:**
- ❌ Force flexbox on `.sendbird-conversation`
- ❌ Override SendBird's internal layout structure
- ❌ Use `order` properties to reorder elements
- ❌ Force `display: flex` on SendBird containers

**Why?**
- SendBird has its own internal layout system
- Forcing our layout breaks message rendering
- Can cause input to appear at top instead of bottom
- Breaks message list scrolling

## How It Works

### Normal State (No Keyboard)

```
┌─────────────────────────┐
│ Custom Header           │
├─────────────────────────┤
│                         │
│  Message List           │
│  (scrollable)           │
│                         │
│                         │
├─────────────────────────┤
│ Message Input           │
└─────────────────────────┘
```

### Keyboard Active

```
┌─────────────────────────┐
│ Custom Header           │
├─────────────────────────┤
│                         │
│  Message List           │
│  (scrollable,           │
│   reduced height)       │
│                         │
├─────────────────────────┤
│ Message Input           │ ← padding-bottom pushes this up
│                         │
└─────────────────────────┘
┌─────────────────────────┐
│ Virtual Keyboard        │
└─────────────────────────┘
```

The `padding-bottom` on `.sendbird-conversation` creates space that pushes the input (and all content) up, keeping it visible above the keyboard.

## Event Flow

```
User taps input
    ↓
Keyboard starts showing
    ↓
keyboardWillShow event fires
    ↓
findConversationElement() (with retry)
    ↓
Add padding-bottom = keyboardHeight
    ↓
keyboardDidShow event fires
    ↓
Content is now positioned correctly
    ↓
User types message...
    ↓
User dismisses keyboard
    ↓
keyboardWillHide event fires
    ↓
Remove padding-bottom
    ↓
Content returns to normal position
```

## Platform-Specific Notes

### iOS
- `resize: None` works well
- `visualViewport` API provides accurate viewport height
- Smooth transitions work reliably

### Android
- `resizeOnFullScreen: true` is critical for edge-to-edge mode
- Keyboard height detection is reliable
- May need slight delay adjustments for some devices

## Troubleshooting

### Messages Not Showing

**Symptoms:** Blank white area where messages should be

**Possible Causes:**
- Aggressive CSS forcing layout changes on SendBird containers
- SendBird hasn't finished rendering yet
- CSS conflicts with SendBird's internal styles

**Solution:**
- Remove any CSS that forces `display: flex` or layout changes on `.sendbird-conversation`
- Let SendBird handle its own layout
- Check browser console for SendBird errors

### Input at Top Instead of Bottom

**Symptoms:** Message input appears just below header

**Possible Causes:**
- CSS forcing flexbox with wrong order
- SendBird's layout being overridden

**Solution:**
- Remove flexbox CSS rules
- Let SendBird's default layout work
- Only adjust padding when keyboard appears

### Input Hidden Behind Keyboard

**Symptoms:** Keyboard covers the input field

**Possible Causes:**
- Keyboard handler not finding conversation element
- Padding not being applied correctly
- Keyboard height calculation wrong

**Solution:**
- Check console logs for keyboard events
- Verify conversation element is found (check retry mechanism)
- Ensure padding-bottom is being applied (inspect element)
- Verify keyboard height is correct

### Layout Jumps When Keyboard Appears

**Symptoms:** Content jumps/shifts abruptly

**Possible Causes:**
- No CSS transition
- Padding applied too quickly

**Solution:**
- Ensure `transition: 'padding-bottom 0.25s ease-out'` is set
- Use `requestAnimationFrame` for smooth updates

## Code Examples

### Finding Conversation Element

```typescript
const findConversationElement = (
  maxRetries = 5,
  delay = 100,
): Promise<HTMLElement | null> => {
  return new Promise((resolve) => {
    let attempts = 0;
    const tryFind = () => {
      const element = document.querySelector(
        '.sendbird-conversation, [class*="sendbird-conversation"]',
      ) as HTMLElement | null;

      if (element || attempts >= maxRetries) {
        resolve(element);
      } else {
        attempts++;
        setTimeout(tryFind, delay);
      }
    };
    tryFind();
  });
};
```

### Keyboard Show Handler

```typescript
const handleKeyboardShow = async (info: KeyboardInfo) => {
  const keyboardHeight = info.keyboardHeight;
  const conversationElement = await findConversationElement();

  if (!conversationElement) {
    console.warn('[ChatWindow] Could not find sendbird-conversation element');
    return;
  }

  // Use padding-bottom instead of max-height
  requestAnimationFrame(() => {
    conversationElement.style.paddingBottom = `${keyboardHeight}px`;
    conversationElement.style.transition = 'padding-bottom 0.25s ease-out';
  });
};
```

### Keyboard Hide Handler

```typescript
const handleKeyboardHide = async () => {
  const conversationElement = await findConversationElement();

  if (conversationElement) {
    requestAnimationFrame(() => {
      conversationElement.style.paddingBottom = '';
      conversationElement.style.transition = '';
    });
  }
};
```

## Best Practices

1. **Minimal CSS**: Only add CSS that doesn't interfere with SendBird's layout
2. **Wait for Render**: Always wait for SendBird to render before manipulating DOM
3. **Use Padding**: Prefer `padding-bottom` over `max-height` for less intrusive adjustments
4. **Smooth Transitions**: Always add CSS transitions for smooth animations
5. **Proper Cleanup**: Remove inline styles on component unmount
6. **Console Logging**: Add logs for debugging (can be removed in production)

## Testing Checklist

- [ ] Messages are visible when chat opens
- [ ] Input is at bottom when keyboard is hidden
- [ ] Keyboard appears: input stays visible above keyboard
- [ ] Messages are scrollable when keyboard is active
- [ ] Keyboard hides: layout returns to normal smoothly
- [ ] No layout jumps or glitches
- [ ] Works on iOS devices
- [ ] Works on Android devices
- [ ] Works with different keyboard heights
- [ ] Works when rapidly showing/hiding keyboard

## Related Files

- `frontend/components/molecules/ChatWindow.tsx` - Main implementation
- `frontend/capacitor.config.ts` - Keyboard plugin configuration
- `@sendbird/uikit-react` - SendBird UIKit v3 library
- `@capacitor/keyboard` - Capacitor keyboard plugin

## References

- [Capacitor Keyboard Plugin Docs](https://capacitorjs.com/docs/apis/keyboard)
- [SendBird UIKit v3 Docs](https://sendbird.com/docs/chat/uikit/v3/react/overview)
- [Visual Viewport API](https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API)
