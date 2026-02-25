---
phase: 07-performance-enhancements-to-story-viewing
verified: 2026-02-25T21:00:00Z
status: human_needed
score: 8/8 must-haves verified
human_verification:
  - test: "Open the feed and confirm story cards appear in batches of 10 with a 'More' button visible at the end of the row when you have more than 10 friends"
    expected: "First 10 friend story cards render; a 'More' button with a chevron icon appears after the last card; tapping 'More' loads the next batch"
    why_human: "Cannot render the full feed in a test environment — pagination logic exists and is wired, but visual batch boundary and button appearance require a live device"
  - test: "Take a new photo and inspect the Firestore document in Firebase console"
    expected: "The photo document contains a 'thumbnailDataURL' field with a 'data:image/jpeg;base64,...' value"
    why_human: "Requires an actual camera capture and Firestore write; expo-image-manipulator behavior cannot be asserted in unit tests without a native device"
  - test: "Open stories mode and swipe between friends horizontally"
    expected: "The 3D cube rotation tracks your finger smoothly at 60fps; there are no dropped frames even when Firestore updates arrive during the gesture"
    why_human: "60fps verification requires profiling on a physical device; cannot be tested programmatically"
  - test: "In stories mode tap to the next photo within a friend"
    expected: "The previous image immediately disappears and is replaced by a fully black background with a pixel spinner; the new image then fades in (with blurred placeholder crossfade if the photo has a thumbnailDataURL)"
    why_human: "Requires visual inspection of loading state transitions on device"
  - test: "In stories mode, advance to a friend who has many photos, then simulate a slow network (throttle in device settings)"
    expected: "After 5 seconds on a photo that fails to load, the viewer automatically skips to the next photo"
    why_human: "Auto-skip timeout behavior requires a slow/failing network condition; cannot reliably simulate in unit tests"
  - test: "On an Android device, open a photo in stories mode and press the hardware back button"
    expected: "The PhotoDetailScreen dismisses with the suck-back animation (identical to swiping down)"
    why_human: "Android hardware back button behavior requires a physical Android device or emulator"
---

# Phase 7: Performance Enhancements to Story Viewing — Verification Report

**Phase Goal:** Story viewing feels instant and smooth — 60fps cube transitions, progressive image loading with placeholder crossfade, immediate dark loading states, smart prefetching, and paginated feed story cards
**Verified:** 2026-02-25T21:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Feed story cards load in paginated batches with a "Load more" button | VERIFIED | `STORY_BATCH_SIZE = 10` at line 59 of FeedScreen.js; `visibleStoryCount` state at line 117; `visibleFriends.slice(0, visibleStoryCount)` at line 1285; `hasMoreFriends && <TouchableOpacity ... onPress={() => setVisibleStoryCount(prev => prev + STORY_BATCH_SIZE)}>` at lines 1320-1327 |
| 2 | New photos generate a thumbnail stored as base64 data URL in Firestore | VERIFIED | `generateThumbnail` function in uploadQueueService.js lines 59-75 (ImageManipulator 20px resize + FileSystem base64); called at line 298; spread into docData at line 328; photoService.js accepts `options.thumbnailDataURL` at line 89 |
| 3 | Cube transition runs on the UI thread via Reanimated at 60fps | VERIFIED | `cubeProgress = useSharedValue(1)` (PhotoDetailScreen.js line 124); `incomingCubeStyle = useAnimatedStyle(...)` (lines 487-499); `outgoingCubeStyle = useAnimatedStyle(...)` (lines 501-516); `withTiming` on cubeProgress SharedValue (line 330); `GestureDetector` wrapping incoming face (line 1103) |
| 4 | Interactive horizontal swipe drives cube rotation on UI thread without JS blocking | VERIFIED | `Gesture.Pan()` with `.activeOffsetX([-15,15]).failOffsetY([-10,10])` in usePhotoDetailModal.js lines 878-920; `cubeProgressRef.current.value = progress` driven directly from gesture `.onUpdate` worklet (line 901); `.onEnd` calls `runOnJS(completeHorizontalSwipe)` |
| 5 | Tapping to next photo immediately shows dark background + spinner | VERIFIED | `showLoadingOverlay` state (PhotoDetailScreen.js line 176); `scheduleOverlay` sets it after 150ms delay (line 182); dark overlay rendered at lines 1128-1131 with `StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 2` |
| 6 | New photos with thumbnails show blurred placeholder crossfading to full image | VERIFIED | expo-image `placeholder={currentPhoto?.thumbnailDataURL ? { uri: currentPhoto.thumbnailDataURL } : undefined}` (lines 1135-1139); `transition={currentPhoto?.thumbnailDataURL ? 200 : 0}` (line 1144) |
| 7 | Firestore subscription pauses during transitions and resumes after settling | VERIFIED | `pauseSubscription` called before `cubeProgress.value = 0` in `handleFriendTransition` (line 313), `handlePreviousFriendTransition` (line 376), and `handlePrepareSwipeTransition` (line 426); auto-resumes via `useEffect` on `contextPhoto?.id` change (lines 272-276) |
| 8 | Auto-skip after 5 seconds on image load failure | VERIFIED | `LOAD_FAILURE_TIMEOUT = 5000` (usePhotoDetailModal.js line 95); `startLoadTimer` sets timeout calling `goNext()` (lines 593-601); exposed via hook return (lines 1099-1100); called from `handleImageLoadStart` via ref (PhotoDetailScreen.js line 199) |
| 9 | Next friend's first photo is prefetched while viewing current friend | VERIFIED | `useEffect` in usePhotoDetailModal.js lines 241-250 checks `currentIndex >= photos.length - 2` and calls `Image.prefetch(nextURL, 'memory-disk')`; `onGetNextFriendPhotoURL` wired from PhotoDetailScreen (lines 601-604) through `getCallbacks()` to FeedScreen's `getNextFriendFirstPhotoURL` callback (FeedScreen.js lines 388-397) |
| 10 | Within-friend next 2-3 photos are prefetched | VERIFIED | `useEffect` in usePhotoDetailModal.js lines 222-238 prefetches `photos[currentIndex + 1]` and `photos[currentIndex + 2]` via `Image.prefetch` on every `currentIndex` change |
| 11 | Android back button triggers suck-back dismiss animation | VERIFIED | `BackHandler.addEventListener('hardwareBackPress', ...)` with `Platform.OS !== 'android'` guard at PhotoDetailScreen.js lines 701-711; calls `animatedClose()` — same function as swipe-down dismiss |

**Score:** 11/11 truths verified (automated checks)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/screens/FeedScreen.js` | Paginated story card rendering with Load more button | VERIFIED | `STORY_BATCH_SIZE`, `visibleStoryCount`, `hasMoreFriends`, `loadMoreStoriesButton` style all present and wired |
| `src/services/uploadQueueService.js` | Thumbnail generation during upload pipeline | VERIFIED | `generateThumbnail` function present with ImageManipulator + FileSystem; called at step 2 of `uploadQueueItem` |
| `src/services/firebase/photoService.js` | thumbnailDataURL field written to photo document | VERIFIED | `options.thumbnailDataURL` spread into `setDoc` call (line 89) |
| `src/screens/PhotoDetailScreen.js` | Dark loading overlay, progressive placeholder, subscription pause/resume, prefetch next friend | VERIFIED | `darkLoadingOverlay` style, expo-image placeholder prop, `pauseSubscription` calls, `onGetNextFriendPhotoURL` wiring all present |
| `src/hooks/usePhotoDetailModal.js` | Gesture.Pan horizontal swipe, auto-skip timeout, next-friend prefetch trigger | VERIFIED | `Gesture.Pan()` with worklet, `LOAD_FAILURE_TIMEOUT`, `startLoadTimer`/`clearLoadTimer`, next-friend prefetch `useEffect` all present |
| `__tests__/hooks/usePhotoDetailModal.test.js` | Test scaffold with 9 todo tests | VERIFIED | File exists; 10 `it.todo` entries confirmed |
| `__tests__/screens/FeedScreen.test.js` | Test scaffold with 5 todo tests | VERIFIED | File exists; 6 `it.todo` entries confirmed |
| `__tests__/screens/PhotoDetailScreen.test.js` | Extended with 9 new todo tests | VERIFIED | 9 `it.todo` entries for progressive loading, dark overlay, and subscription pause/resume confirmed appended |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `usePhotoDetailModal.js` | `PhotoDetailScreen.js` | `cubeProgress` SharedValue shared between gesture writes and animated styles | VERIFIED | `cubeProgress = useSharedValue(1)` in PhotoDetailScreen.js (line 124) passed into hook as `cubeProgress` param; gesture writes `cubeProgressRef.current.value` and animated styles read `cubeProgress.value` |
| `usePhotoDetailModal.js` | `react-native-gesture-handler` | `Gesture.Pan` for interactive horizontal swipe | VERIFIED | `Gesture.Pan()` with `.activeOffsetX([-15,15]).failOffsetY([-10,10])` at lines 878-880 |
| `FeedScreen.js` → `PhotoDetailContext.js` → `usePhotoDetailModal.js` | next-friend first photo URL | `getNextFriendFirstPhotoURL` callback chain | VERIFIED | FeedScreen registers callback via `setCallbacks` (line 388); PhotoDetailScreen retrieves it via `getCallbacks()` (line 602); hook receives it as `onGetNextFriendPhotoURL` prop (line 66) |
| `uploadQueueService.js` | `photoService.js` | `thumbnailDataURL` passed through upload pipeline | PARTIAL | `uploadQueueService.js` writes directly to Firestore via its own `setDoc` call (line 330) rather than calling `createPhoto`; `photoService.createPhoto` was updated to accept `options.thumbnailDataURL` but is not called from `uploadQueueService.uploadQueueItem`. Both paths correctly write `thumbnailDataURL` to the document — the two implementations converge on the same result. The plan's intended key link (uploadQueueService calling createPhoto with thumbnailDataURL) is not the actual implementation, but the outcome (thumbnailDataURL in Firestore) is achieved via the direct write path. |
| `PhotoDetailScreen.js` | `subscribePhoto` | `subscriptionRef` with pause/resume wrappers | VERIFIED | `subscribePhoto` imported (line 60); `subscriptionRef.current = subscribePhoto(photoId, ...)` at line 254; pause/resume pattern correctly implemented |
| `__tests__/hooks/usePhotoDetailModal.test.js` | `src/hooks/usePhotoDetailModal.js` | imports `usePhotoDetailModal` | VERIFIED | Import present at line 17 (eslint-disable scaffold comment) |
| `__tests__/screens/FeedScreen.test.js` | `src/screens/FeedScreen.js` | render testing pagination UI | VERIFIED | Scaffold file exists with FeedScreen mocks and pagination test describe block |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PERF-01 | 07-03 | Progressive loading with 200ms placeholder crossfade | SATISFIED | expo-image `placeholder` + `transition={200}` when `thumbnailDataURL` exists; PhotoDetailScreen.js lines 1135-1144 |
| PERF-02 | 07-03 | Immediate dark background + spinner on photo navigation | SATISFIED | `showLoadingOverlay` with 150ms delayed `scheduleOverlay`; `darkLoadingOverlay` style with `absoluteFillObject + zIndex:2` |
| PERF-03 | 07-02 | Cube transition on UI thread via Reanimated at 60fps | SATISFIED | `useSharedValue`, `useAnimatedStyle`, `Gesture.Pan` all present; cube faces are `ReanimatedView` components |
| PERF-04 | 07-03 | Next friend prefetched; next 2-3 within-friend photos prefetched | SATISFIED | Two separate `useEffect` hooks in usePhotoDetailModal.js — adjacent photos (lines 222-238) and next-friend first photo (lines 241-250) |
| PERF-05 | 07-01 | Feed story cards paginated with "Load more" button | SATISFIED | `STORY_BATCH_SIZE=10`, `visibleStoryCount` state, `hasMoreFriends` guard, load-more `TouchableOpacity` all in FeedScreen.js |
| PERF-06 | 07-03 | Firestore listeners pause during transitions, resume after settling | SATISFIED | `pauseSubscription()` called in all three transition entry points; auto-resumes via `useEffect` on `contextPhoto?.id` |
| PERF-07 | 07-03 | Failed image loads auto-skip after timeout | SATISFIED | `LOAD_FAILURE_TIMEOUT = 5000`; `startLoadTimer` called on `onLoadStart`; timeout fires `goNext()` |
| PERF-08 | 07-01 | Thumbnail generated at upload time stored as base64 in Firestore | SATISFIED | `generateThumbnail` in uploadQueueService.js; `thumbnailDataURL` spread into Firestore docData; photoService.createPhoto also accepts the field |

All 8 PERF requirements satisfied. No orphaned requirements found — all PERF-01 through PERF-08 appear in plan frontmatter and have implementation evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `FeedScreen.js` | 1183-1196 | "placeholder" in comment (loading skeleton shimmer) | Info | Not a stub — this is the intended FeedLoadingSkeleton placeholder UI; not a code smell |

No blocking anti-patterns found. No TODOs, FIXMEs, or stub returns in any phase 7 implementation file.

### Human Verification Required

The following items require visual inspection on a real device. All automated code checks passed.

#### 1. Feed Story Card Pagination (PERF-05)

**Test:** Open the app feed. Count how many friend story cards appear in the horizontal scroll row. Scroll to the end of the row.
**Expected:** Exactly 10 (or fewer if < 10 friends) friend story cards appear initially. A "More" button with a right-facing chevron icon appears at the end. Tapping "More" loads the next 10. Pull-to-refresh resets to the first batch.
**Why human:** Full React Native rendering with live Firestore data is required to confirm the visual layout and interaction.

#### 2. Thumbnail in Firestore (PERF-08)

**Test:** Take a new photo in the app. In Firebase console, open the `photos` collection and inspect the newly created document.
**Expected:** The document contains a field `thumbnailDataURL` whose value starts with `data:image/jpeg;base64,`.
**Why human:** Requires a real camera capture triggering expo-image-manipulator on a native device; no unit test covers the full upload pipeline end-to-end.

#### 3. 60fps Cube Transition (PERF-03)

**Test:** Open stories mode and slowly swipe horizontally between friends. Use Xcode Instruments (iOS) or Android GPU profiler to observe frame rate during the gesture.
**Expected:** Frame rate stays at 60fps (or 120fps on ProMotion devices) during the cube rotation even when receiving Firestore updates (e.g., new reactions appearing).
**Why human:** 60fps verification requires runtime profiling on a physical device.

#### 4. Dark Loading State + Progressive Crossfade (PERF-01, PERF-02)

**Test:** In stories mode, tap rapidly to the next photo. Watch what happens immediately after the tap, before the image loads.
**Expected:** The previous image instantly disappears and is replaced by a solid black background with a pixel spinner. If the new photo has a `thumbnailDataURL` (recently taken), a blurred low-res placeholder appears first and then crossfades to the full image over ~200ms. Older photos without thumbnails show only the dark spinner until loaded.
**Why human:** Visual loading transition perception cannot be automated.

#### 5. Auto-Skip on Load Failure (PERF-07)

**Test:** In stories mode on a device, enable airplane mode or throttle the network to very slow (simulate packet loss). Navigate to a photo that has not yet been cached.
**Expected:** After 5 seconds of the spinner showing, the viewer automatically advances to the next photo without user input.
**Why human:** Requires network failure simulation on device; `setTimeout` behavior in stories mode with real image loading cannot be reliably asserted in unit tests.

#### 6. Android Back Button Dismiss (PERF-03)

**Test:** On an Android device or emulator, open a photo in stories mode. Press the hardware back button or use the back swipe gesture.
**Expected:** The PhotoDetailScreen dismisses with the same suck-back animation as swiping down (scale + translate to origin). The back button does NOT navigate to the previous screen in the stack.
**Why human:** Requires Android hardware or gesture navigation; `BackHandler` tests with emulated events are unreliable for animation verification.

### Gaps Summary

No gaps found in automated verification. All 11 observable truths verified with direct code evidence.

One implementation note: the plan's key link "uploadQueueService calls createPhoto with thumbnailDataURL" is not how it was actually implemented — `uploadQueueService.uploadQueueItem` writes directly to Firestore rather than delegating to `photoService.createPhoto`. Both services independently implement the `thumbnailDataURL` write correctly. This is a deviation from the intended architecture (DRY violation) but does not affect the observable behavior; PERF-08 is satisfied by both code paths. This is flagged as a warning, not a blocker.

---

_Verified: 2026-02-25T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
