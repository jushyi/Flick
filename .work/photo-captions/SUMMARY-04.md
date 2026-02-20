# PLAN-04 Summary: Darkroom Hook -- Caption State + Keyboard Gesture Control

**Status:** Complete
**Duration:** ~10 minutes
**Tasks:** 2/2 completed

## One-liner

Caption state management in useDarkroom mirroring photoTags pattern, plus keyboard-aware gesture disabling via SharedValue in useSwipeableCard.

## Commits

| # | Hash | Message | Files |
|---|------|---------|-------|
| 1 | `8f06a63` | feat(captions): add caption state, handlers, and undo integration to useDarkroom | `src/hooks/useDarkroom.js`, `__tests__/hooks/useDarkroom.test.js` |
| 2 | `7d95f26` | feat(captions): add keyboard tracking to useDarkroom and disable gesture in useSwipeableCard | `src/hooks/useDarkroom.js`, `src/hooks/useSwipeableCard.js` |

## Task Details

### Task 1: Add caption state, handlers, and undo integration to useDarkroom

- Added `photoCaptions` state (`useState({})`) alongside existing `photoTags`
- Added `handleCaptionChange(photoId, caption)` handler with 100-char max enforcement via `caption.slice(0, 100)`
- Added `getCaptionForPhoto(photoId)` getter returning caption string or empty string
- Captured `currentCaption` in undo stack entries alongside `tags`
- Added caption restoration in `handleUndo` when `lastDecision.caption` exists
- Updated `handleDone` to pass `photoCaptions` as third argument to `batchTriagePhotos(decisions, photoTags, photoCaptions)`
- Cleared `photoCaptions` alongside `photoTags` when photos reload (two places in `loadDevelopingPhotos`)
- Exported `photoCaptions`, `handleCaptionChange`, `getCaptionForPhoto` in return statement

### Task 2: Add keyboard tracking to useDarkroom + disable gesture in useSwipeableCard

- Added `Keyboard` import from `react-native` and `useSharedValue` from `react-native-reanimated` to useDarkroom
- Created `keyboardVisible` SharedValue (boolean, initialized to `false`)
- Added `useEffect` with `keyboardDidShow`/`keyboardDidHide` listeners (cross-platform, not iOS-only `keyboardWillShow`)
- Exported `keyboardVisible` from useDarkroom return statement
- Added `useDerivedValue` import to useSwipeableCard
- Added optional `keyboardVisible = null` parameter to useSwipeableCard (backward compatible)
- Replaced `.enabled(isActive)` with `.enabled(panEnabled)` where `panEnabled` is a `useDerivedValue` that returns `isActive && !(keyboardVisible?.value ?? false)`
- Optional chaining ensures existing callers without `keyboardVisible` prop continue to work

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated test expectation for new batchTriagePhotos signature**
- **Found during:** Task 1
- **Issue:** `__tests__/hooks/useDarkroom.test.js` expected `batchTriagePhotos` to be called with 2 args but the updated code passes 3
- **Fix:** Added `{} // photoCaptions` as third expected argument in the test assertion
- **Files modified:** `__tests__/hooks/useDarkroom.test.js`
- **Commit:** `8f06a63`

## Verification Checklist

- [x] `npm run lint` passes (0 errors, only pre-existing warnings)
- [x] `npm test` passes (23 suites, 738 passed, 0 failures)
- [x] useDarkroom exports: `photoCaptions`, `handleCaptionChange`, `getCaptionForPhoto`, `keyboardVisible`
- [x] Undo stack captures and restores captions
- [x] `batchTriagePhotos` receives photoCaptions as third arg
- [x] Pan gesture is disabled when keyboard is visible
- [x] No React re-renders from keyboard state changes (SharedValue, not useState)

## Key Files Modified

- `src/hooks/useDarkroom.js` -- Caption state, handlers, undo integration, keyboard SharedValue
- `src/hooks/useSwipeableCard.js` -- Optional keyboardVisible param, pan gesture disabling
- `__tests__/hooks/useDarkroom.test.js` -- Updated batchTriagePhotos call expectation
