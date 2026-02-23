# PLAN-06 Summary: Darkroom UI Caption Input + DarkroomScreen Wiring

## Status: SUCCESS

## Overview

Wired caption TextInput and keyboard visibility props from DarkroomScreen through to SwipeablePhotoCard, completing the darkroom caption entry UI. Users can now type captions during photo triage in the darkroom.

## Tasks Completed

### Task 1: Add caption TextInput to SwipeablePhotoCard + styles
- **Status:** Already completed (commit `d6c6798` from prior execution)
- **Files:** `src/components/SwipeablePhotoCard.js`, `src/styles/SwipeablePhotoCard.styles.js`
- **What was done:**
  - TextInput with "Add a caption..." placeholder renders on front card only (stackIndex === 0)
  - Character counter appears at 80+ characters
  - Semi-transparent dark overlay background for readability
  - Positioned to avoid overlapping the tag button
  - `keyboardVisible` SharedValue passed through to `useSwipeableCard`

### Task 2: Wire caption and keyboard props in DarkroomScreen
- **Commit:** `7b2aa34`
- **Files:** `src/screens/DarkroomScreen.js`
- **What was done:**
  - Destructured `getCaptionForPhoto`, `handleCaptionChange`, `keyboardVisible` from `useDarkroom()`
  - Passed `caption`, `onCaptionChange`, `keyboardVisible` props to `SwipeablePhotoCard`
  - All props gated behind `isActive` check (only front card gets caption input)
  - `onCaptionChange` wraps `handleCaptionChange` to bind the current photo's ID

## Verification Checklist

- [x] `npm run lint` passes (0 errors in modified files; pre-existing warning in `useEffect` deps is unrelated)
- [x] `npm test` passes (23 suites, 747 tests root; 5 suites, 82 tests functions)
- [x] Caption TextInput renders only on front card (stackIndex === 0 guard + onCaptionChange guard)
- [x] Character counter appears at 80+ characters
- [x] Props wired from DarkroomScreen -> SwipeablePhotoCard -> useSwipeableCard
- [x] keyboardVisible disables pan gesture when keyboard is open
- [x] Caption saved to undo stack for restoration on undo
- [x] Backward compatible -- SwipeablePhotoCard works without caption props

## Deviations

None. Task 1 was already implemented in a prior commit (`d6c6798`), so only Task 2 needed execution. The plan was otherwise followed exactly.

## Files Modified

| File | Change |
|------|--------|
| `src/screens/DarkroomScreen.js` | Added caption state destructuring + prop wiring to SwipeablePhotoCard |

## Prop Flow (Complete)

```
useDarkroom()
  -> photoCaptions state (useState)
  -> handleCaptionChange(photoId, text)
  -> getCaptionForPhoto(photoId) -> string
  -> keyboardVisible (SharedValue<boolean>)

DarkroomScreen
  -> destructures getCaptionForPhoto, handleCaptionChange, keyboardVisible
  -> passes to SwipeablePhotoCard: caption, onCaptionChange, keyboardVisible

SwipeablePhotoCard
  -> renders TextInput (caption, onCaptionChange) on front card
  -> passes keyboardVisible to useSwipeableCard

useSwipeableCard
  -> panEnabled = isActive && !keyboardVisible.value
  -> panGesture.enabled(panEnabled)
```
