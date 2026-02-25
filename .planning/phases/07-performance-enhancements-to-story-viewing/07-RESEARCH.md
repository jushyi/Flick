# Phase 7: Performance Enhancements to Story Viewing - Research

**Researched:** 2026-02-25
**Domain:** React Native image loading, animation performance, and Firestore subscription optimization
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use progressive loading: show a low-quality preview first, then crossfade (~200ms) to the full-resolution image once loaded
- When tapping to the next photo, immediately show dark background + spinner — do NOT linger on the current image
- Friend transitions use the cube animation rotating into a dark+spinner on the incoming cube face
- Entry animation (modal slide-up) stays as-is; dismiss animation (swipe-down suck-back) stays as-is
- Preload the next friend's first photo while viewing the current friend
- Keep viewed images cached in memory for quick back-navigation (no aggressive unloading)
- Continue prefetching the next 2-3 photos within the current friend's story
- Paginate story cards on the feed screen in batches (not all at once)
- Show a "Load more" button at the bottom to load the next batch (not auto-load on scroll)
- In stories mode, only friends already loaded in the feed are available for swiping
- Keep the 3D cube rotation for friend-to-friend transitions — it's distinctive
- Optimize cube smoothness (reduce frame drops) with equal priority to loading/memory improvements
- Within-friend photo taps: instant swap with no animation
- Same animations on all devices (no adaptive simplification for low-end devices)
- Platform-specific image loading optimization — investigate and apply Android-specific cache sizes, compression, or decoding strategies where beneficial
- Android back button/gesture triggers the same suck-back dismiss animation as swipe-down
- Pause Firestore real-time listeners (reaction updates) during transitions between photos/friends
- Resume listeners once settled on the new photo
- Keep current overlay transition behavior (no changes to how overlays animate)
- Optimize reaction component rendering only if profiling shows it causes frame drops (conditional optimization)
- Progress bar behavior stays as-is (no changes)

### Claude's Discretion
- Progressive loading preview style (blurred vs. pixelated) and source (pre-generated vs. on-the-fly)
- Exact prefetch window sizes and cache limits
- Whether to use windowed loading for stories in memory (load all vs. keep ~5-10 active)
- Exact auto-skip timeout duration on load failure
- Feed pagination batch size
- Any additional memoization or render optimization beyond what profiling identifies

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

## Summary

This phase optimizes the story viewing experience across six areas: progressive image loading, within-friend tap loading states, friend-to-friend cube transitions, prefetching/caching, feed story card pagination, and Firestore subscription management during transitions. The current codebase already uses `expo-image` with `memory-disk` caching and has basic prefetching in place — this phase builds on that foundation.

The most impactful changes are: (1) adding progressive loading via expo-image's `placeholder` prop with thumbhash or blurhash, (2) migrating the cube transition from React Native's `Animated` API to `react-native-reanimated` for UI-thread animation, and (3) implementing a subscription pause/resume mechanism during transitions. The feed pagination with "Load more" is straightforward UI work that reduces initial data load.

**Primary recommendation:** Use expo-image's built-in `placeholder` prop with on-the-fly blurred previews (via `blurRadius` on the same source) for progressive loading, migrate cube transforms to Reanimated for 60fps smoothness, and add explicit Firestore listener management during transitions.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-image | ~3.0.11 | Image rendering, caching, prefetching, progressive loading | Already used project-wide; built-in `placeholder`, `transition`, `priority`, and `Image.prefetch()` |
| react-native-reanimated | ~4.1.1 | UI-thread animations for cube transition | Already used in `useSwipeableCard`; runs on native UI thread (60fps) vs Animated API on JS thread |
| react-native-gesture-handler | ~2.28.0 | Gesture detection for cube swipe | Already used in `useSwipeableCard`; better performance than PanResponder |
| @react-native-firebase/firestore | existing | Real-time subscriptions with pause/resume | Already used; `onSnapshot` returns unsubscribe function for listener management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-image-manipulator | existing | Generate low-quality thumbnail at upload time | If pre-generated thumbnails are chosen for progressive loading |
| blurhash | ^2.0.5 | Generate compact blur hash strings | Only if choosing blurhash approach for progressive loading |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| blurhash placeholder | `blurRadius` on same image | blurRadius is simpler (no upload pipeline change) but requires the full image to load first before blur renders; blurhash loads instantly from a ~30 byte string but requires upload pipeline changes |
| Reanimated for cube | Keep Animated API | Animated API already works but runs on JS thread causing frame drops during data updates; Reanimated runs on UI thread with worklets |
| Manual subscription management | No change | Current subscriptions run during transitions causing CPU/network work that competes with animations |

**Installation:**
```bash
# Only if blurhash approach is chosen:
npx expo install blurhash
# Everything else is already installed
```

## Architecture Patterns

### Recommended Approach for Progressive Loading

Two viable approaches exist. Recommendation: **on-the-fly blurred thumbnail using expo-image's blurRadius on a smaller source**.

**Approach A: Pre-generated at upload (RECOMMENDED)**
Generate a small (~20px wide) thumbnail at upload time using `expo-image-manipulator`, store the thumbnail URL (or base64 data URL) in the Firestore photo document. At display time, pass it as the `placeholder` prop.

Pros:
- Instant placeholder display (no network request for full image needed)
- expo-image's `placeholder` prop handles crossfade natively via `transition` prop
- Minimal runtime cost

Cons:
- Requires upload pipeline modification
- Existing photos won't have thumbnails (need backfill or fallback)

**Approach B: On-the-fly blur using blurRadius**
Use expo-image's `blurRadius` prop on a separate low-priority `<Image>` component showing the same URL, visible until the full image loads.

Pros:
- No upload pipeline changes
- Works for all existing photos

Cons:
- Still requires the image to load before blur renders (no instant placeholder)
- Two image components per photo

**Hybrid approach (BEST):**
- For new photos: Generate and store a tiny thumbnail (data URL or Storage path) at upload time
- For existing photos: Fall back to showing dark background + spinner (no placeholder)
- Use expo-image `placeholder` prop with the thumbnail URL, and `transition={200}` for crossfade

### Pattern 1: Immediate Dark Background on Photo Change
**What:** When user taps to next photo within a friend's story, immediately show dark background + spinner instead of lingering on current image.
**When to use:** Within-friend tap navigation (not cube transitions).
**Example:**
```javascript
// In PhotoDetailScreen - when photo changes, reset to loading state immediately
const prevPhotoIdRef = useRef(null);
if (contextPhoto?.id !== prevPhotoIdRef.current) {
  prevPhotoIdRef.current = contextPhoto?.id;
  // Force loading state to true - shows dark bg + spinner
  setImageLoading(true);
}

// Render: show dark background when loading, not the previous photo
<View style={styles.photoContainer}>
  {imageLoading && (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', zIndex: 1 }]}>
      <ActivityIndicator />
    </View>
  )}
  <Image
    source={{ uri: imageURL }}
    placeholder={thumbnailURL} // progressive loading
    transition={200} // crossfade from placeholder to full
    onLoadStart={() => setImageLoading(true)}
    onLoadEnd={() => setImageLoading(false)}
  />
</View>
```

### Pattern 2: Cube Transition with Reanimated
**What:** Migrate 3D cube rotation from `Animated` API to `react-native-reanimated` for UI-thread execution.
**When to use:** Friend-to-friend transitions in stories mode.
**Example:**
```javascript
// Using Reanimated shared values instead of Animated.Value
const cubeProgress = useSharedValue(1);

// Animated style computed on UI thread
const incomingFaceStyle = useAnimatedStyle(() => {
  return {
    transform: [
      { perspective: 650 },
      { translateX: interpolate(cubeProgress.value, [0, 1], [SCREEN_WIDTH, 0]) },
      { translateX: -SCREEN_WIDTH / 2 },
      { rotateY: `${interpolate(cubeProgress.value, [0, 1], [90, 0])}deg` },
      { translateX: SCREEN_WIDTH / 2 },
    ],
  };
});

// Interactive gesture drives cubeProgress on UI thread
const panGesture = Gesture.Pan()
  .onUpdate((event) => {
    'worklet';
    cubeProgress.value = clamp(Math.abs(event.translationX) / SCREEN_WIDTH, 0, 1);
  });
```

### Pattern 3: Firestore Subscription Pause/Resume
**What:** Unsubscribe from photo real-time listener during transitions, resubscribe after settling.
**When to use:** During cube transitions and within-friend photo changes.
**Example:**
```javascript
// PhotoDetailScreen - manage subscription lifecycle
const unsubRef = useRef(null);
const isTransitioningRef = useRef(false);

const pauseSubscription = () => {
  if (unsubRef.current) {
    unsubRef.current();
    unsubRef.current = null;
  }
};

const resumeSubscription = (photoId) => {
  pauseSubscription(); // Clean up any existing
  unsubRef.current = subscribePhoto(photoId, (result) => {
    if (result.success && result.photo) {
      updateCurrentPhoto(result.photo);
    }
  });
};

// Call pauseSubscription() at transition start
// Call resumeSubscription(newPhotoId) after transition settles
```

### Pattern 4: Feed Story Card Pagination with "Load More"
**What:** Load story cards in batches instead of all at once.
**When to use:** Feed screen stories row.
**Example:**
```javascript
const STORY_BATCH_SIZE = 10; // Claude's discretion
const [visibleCount, setVisibleCount] = useState(STORY_BATCH_SIZE);

const visibleFriends = sortedFriends.slice(0, visibleCount);
const hasMoreFriends = visibleCount < sortedFriends.length;

// In stories ScrollView:
{visibleFriends.map(friend => <FriendStoryCard ... />)}
{hasMoreFriends && (
  <TouchableOpacity onPress={() => setVisibleCount(prev => prev + STORY_BATCH_SIZE)}>
    <Text>Load more</Text>
  </TouchableOpacity>
)}
```

### Pattern 5: Auto-Skip on Load Failure
**What:** If an image fails to load, auto-skip to next photo after a timeout.
**When to use:** Stories mode image loading.
**Example:**
```javascript
const LOAD_FAILURE_TIMEOUT = 5000; // ms - Claude's discretion
const loadTimeoutRef = useRef(null);

const handleImageLoadStart = () => {
  setImageLoading(true);
  // Start failure timeout
  loadTimeoutRef.current = setTimeout(() => {
    // Auto-advance to next photo
    goNext();
  }, LOAD_FAILURE_TIMEOUT);
};

const handleImageLoadEnd = () => {
  setImageLoading(false);
  clearTimeout(loadTimeoutRef.current);
};
```

### Anti-Patterns to Avoid
- **Reading SharedValues on JS thread:** Never access `sharedValue.value` outside worklets — it blocks until UI thread responds.
- **Animated API for gesture-driven transitions:** PanResponder + Animated runs on JS thread, causing frame drops when JS is busy. Use Gesture Handler + Reanimated instead.
- **Re-creating subscriptions on every render:** Store `unsubscribe` in a ref and only recreate when photoId actually changes.
- **Prefetching all friend photos at once:** Only prefetch next 2-3 photos + next friend's first photo. Excessive prefetching wastes bandwidth and memory.
- **Using `recyclingKey` in non-recycling contexts:** Only needed in FlashList/FlatList rows. PhotoDetailScreen doesn't recycle views.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image caching | Custom cache manager | expo-image `cachePolicy="memory-disk"` | Already handles memory + disk cache, eviction, and prefetching |
| Progressive loading crossfade | Manual opacity animation between two Image components | expo-image `placeholder` + `transition={200}` | Built-in crossfade from placeholder to full image, handled natively |
| UI-thread animations | JS-thread Animated.timing with requestAnimationFrame | Reanimated `useAnimatedStyle` + `withTiming` | Worklets run on UI thread, immune to JS thread blocking |
| Gesture-driven cube | PanResponder translating to Animated.Value | Gesture Handler `Gesture.Pan` driving SharedValue | Direct UI-thread gesture tracking without bridge crossing |
| Image prefetching | Custom download + cache logic | `Image.prefetch(urls, 'memory-disk')` | Handles batch prefetch with proper cache integration |

**Key insight:** The project already uses expo-image and react-native-reanimated — the performance wins come from using their advanced features (placeholder, transition, worklets) rather than building parallel systems.

## Common Pitfalls

### Pitfall 1: Flash of Previous Photo During Transition
**What goes wrong:** When switching photos, the old image briefly shows before the new one loads because expo-image maintains the last displayed image until the new source is ready.
**Why it happens:** expo-image with `transition={0}` (current setting) keeps the old image visible until the new one loads. With `transition > 0`, it crossfades, but both images may be visible.
**How to avoid:** Set `imageLoading` state to true on photo change, render a dark overlay with `zIndex: 1` over the Image component. Clear overlay on `onLoadEnd`. This gives the "instant dark + spinner" the user requested.
**Warning signs:** Seeing the old friend's photo for a frame during cube transition.

### Pitfall 2: Reanimated Shared Value Read on JS Thread
**What goes wrong:** Accessing `cubeProgress.value` on the JS thread (outside a worklet) blocks synchronously waiting for the UI thread response.
**Why it happens:** Developers often read shared values in React effects or callbacks, unaware of the cross-thread blocking.
**How to avoid:** Only read `.value` inside `'worklet'` functions. Use `runOnJS` to communicate from worklets to JS thread.
**Warning signs:** Occasional 16-33ms jank spikes during cube transition.

### Pitfall 3: Stale Snapshot During Cancelled Interactive Swipe
**What goes wrong:** The outgoing cube face shows stale data after a cancelled swipe because the snapshot wasn't restored properly.
**Why it happens:** The current implementation freezes `snapshotRef` during transitions. If the cancel path doesn't properly restore state, the snapshot shows wrong data.
**How to avoid:** Ensure `handleCancelFriendTransition` restores all state via `openPhotoDetail()` before unfreezing the snapshot. The current code already handles this — maintain this pattern in the Reanimated migration.
**Warning signs:** Wrong friend's photo showing on the outgoing face after a cancelled swipe.

### Pitfall 4: Subscription Leak During Rapid Navigation
**What goes wrong:** Multiple Firestore listeners accumulate if the user taps through photos faster than subscriptions can be set up and torn down.
**Why it happens:** Each `subscribePhoto` call returns a new `unsubscribe` function. If the previous one isn't called before creating a new one, listeners stack up.
**How to avoid:** Always call the previous `unsubscribe` before creating a new subscription. Use a ref to track the current unsubscribe function. During transitions, pause (unsubscribe) without resubscribing until settled.
**Warning signs:** Memory usage climbing during story viewing, or seeing reaction updates from photos the user already left.

### Pitfall 5: Android Elevation Breaking 3D Transforms
**What goes wrong:** Android's `elevation` property interacts badly with 3D transforms (`perspective`, `rotateY`), causing visual artifacts or clipping.
**Why it happens:** Android renders `elevation` as a native shadow + z-ordering, which conflicts with CSS-style 3D perspective transforms.
**How to avoid:** Remove any `elevation` from cube face views. Use `zIndex` and `backfaceVisibility: 'hidden'` instead. Test cube transition on Android specifically.
**Warning signs:** Cube faces flickering or showing through each other on Android only.

### Pitfall 6: Feed Pagination Breaking Stories Mode Navigation
**What goes wrong:** After loading more story cards via "Load more", the `storySequenceRef` (locked at session start) doesn't include the new friends, causing navigation to skip them.
**Why it happens:** The story sequence is captured when opening stories. New friends loaded after that point aren't in the sequence.
**How to avoid:** Per the user's decision: "In stories mode, only friends already loaded in the feed are available for swiping." This is already the correct behavior — the "Load more" button loads more friends into the stories row, but a currently-open stories session uses its locked sequence.
**Warning signs:** None — this is expected behavior by design.

## Code Examples

### expo-image Progressive Loading with Placeholder
```javascript
// Source: https://docs.expo.dev/versions/latest/sdk/image/
<Image
  source={{ uri: fullResolutionURL, cacheKey: `photo-${photoId}` }}
  placeholder={{ uri: thumbnailDataURL }} // base64 or low-res URL
  placeholderContentFit="cover" // Match contentFit to prevent flicker
  contentFit="cover"
  cachePolicy="memory-disk"
  transition={200} // 200ms crossfade from placeholder to full
  priority={isCurrentPhoto ? 'high' : 'normal'}
  onLoadStart={handleImageLoadStart}
  onLoadEnd={handleImageLoadEnd}
/>
```

### expo-image Batch Prefetch
```javascript
// Source: https://docs.expo.dev/versions/latest/sdk/image/
// Already used in codebase — prefetch next photos in story
const urlsToPrefetch = [];
for (let i = currentIndex + 1; i <= currentIndex + 3 && i < photos.length; i++) {
  if (photos[i]?.imageURL) urlsToPrefetch.push(photos[i].imageURL);
}
if (urlsToPrefetch.length > 0) {
  Image.prefetch(urlsToPrefetch, 'memory-disk').catch(() => {});
}
```

### Reanimated Cube Animation with Gesture Handler
```javascript
// Source: https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/handling-gestures/
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const cubeProgress = useSharedValue(1);

const incomingStyle = useAnimatedStyle(() => ({
  transform: [
    { perspective: 650 },
    { translateX: interpolate(cubeProgress.value, [0, 1], [SCREEN_WIDTH, 0]) },
    { translateX: -SCREEN_WIDTH / 2 },
    { rotateY: `${interpolate(cubeProgress.value, [0, 1], [90, 0])}deg` },
    { translateX: SCREEN_WIDTH / 2 },
  ],
}));

const outgoingStyle = useAnimatedStyle(() => ({
  transform: [
    { perspective: 650 },
    { translateX: interpolate(cubeProgress.value, [0, 1], [0, -SCREEN_WIDTH]) },
    { translateX: SCREEN_WIDTH / 2 },
    { rotateY: `${interpolate(cubeProgress.value, [0, 1], [0, -90])}deg` },
    { translateX: -SCREEN_WIDTH / 2 },
  ],
}));
```

### Firestore Subscription Management
```javascript
// Pause/resume pattern for transitions
const subscriptionRef = useRef(null);

const pauseSubscription = useCallback(() => {
  if (subscriptionRef.current) {
    subscriptionRef.current(); // call unsubscribe
    subscriptionRef.current = null;
  }
}, []);

const resumeSubscription = useCallback((photoId) => {
  pauseSubscription();
  if (!photoId) return;
  subscriptionRef.current = subscribePhoto(photoId, (result) => {
    if (result.success && result.photo) {
      updateCurrentPhoto(result.photo);
    }
  });
}, [pauseSubscription, updateCurrentPhoto]);

// On transition start:
pauseSubscription();

// On transition complete:
resumeSubscription(newPhotoId);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Native `Animated` on JS thread | Reanimated worklets on UI thread | Reanimated 3+ (2023) | 60fps animations immune to JS thread blocking |
| PanResponder (JS thread gestures) | Gesture Handler (native gestures) | React Native Gesture Handler 2+ (2022) | Direct native gesture tracking without bridge |
| Manual image caching | expo-image built-in cache | expo-image 1.0+ (2023) | Memory + disk cache with `cachePolicy`, `placeholder`, `transition` |
| Load all story cards at once | Paginated batch loading | This phase | Reduces initial render cost and memory for users with many friends |

**Deprecated/outdated:**
- `PanResponder` for gesture-driven animations: Still works but runs on JS thread. Use Gesture Handler for performance-critical gestures.
- React Native `Animated` API for complex transforms: Works but can't run 3D perspective transforms at 60fps during JS-heavy operations. Reanimated is the standard for performance-critical animation.
- `react-native` `Image` component: Replaced by `expo-image` in this project for caching and prefetch support.

## Open Questions

1. **Progressive loading thumbnail generation approach**
   - What we know: expo-image supports `placeholder` prop with URL or blurhash string. The upload pipeline already uses `expo-image-manipulator` for compression.
   - What's unclear: Whether to generate thumbnails client-side at upload, server-side via Cloud Function, or use blurhash encoding. Also unclear if existing photos need backfill.
   - Recommendation: Generate a tiny (20x20) JPEG thumbnail client-side at upload time using `expo-image-manipulator`, store as base64 data URL in the Firestore photo document. Existing photos fall back to dark background + spinner. Blurhash adds a dependency and is harder to debug; a tiny JPEG is simpler and achieves similar perceived-speed gains.

2. **Reanimated migration scope for cube transition**
   - What we know: The cube currently uses `Animated.timing` + `Animated.Value` from React Native. Interactive swipe already drives `cubeProgress` from PanResponder.
   - What's unclear: Whether to migrate only the cube animation to Reanimated or also migrate the dismiss/expand animations.
   - Recommendation: Migrate the cube transition (friend-to-friend) to Reanimated since it's gesture-driven and most frame-drop-prone. Keep dismiss/expand animations on `Animated` API since they're already smooth (spring-based, no concurrent JS work).

3. **Memory impact of keeping all viewed images cached**
   - What we know: User wants "no aggressive unloading" — keep viewed images in memory for back-navigation. expo-image's `memory-disk` cache handles eviction automatically.
   - What's unclear: Exact memory impact when a user views 50+ photos across multiple friends.
   - Recommendation: Trust expo-image's built-in cache eviction for `memory-disk` policy. If memory issues surface during testing, consider a windowed approach (keep ~10 most recent in memory, rest on disk).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 with jest-expo 54.0.17 |
| Config file | package.json (jest section) |
| Quick run command | `npm test -- --testPathPattern="<pattern>" --bail` |
| Full suite command | `npm test` |
| Estimated runtime | ~15-30 seconds (full suite) |

### Phase Requirements to Test Map

This phase has no explicitly mapped requirement IDs. Tests cover the performance behaviors described in the CONTEXT.md decisions.

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Progressive loading shows placeholder then crossfades | unit | `npm test -- __tests__/screens/PhotoDetailScreen.test.js -t "progressive"` | Partial (file exists, needs new tests) |
| Tap navigation shows dark bg + spinner immediately | unit | `npm test -- __tests__/screens/PhotoDetailScreen.test.js -t "loading"` | Partial |
| Photo prefetch called for next 2-3 photos | unit | `npm test -- __tests__/hooks/usePhotoDetailModal.test.js -t "prefetch"` | No (hook test file doesn't exist) |
| Feed story pagination shows batch + "Load more" | unit | `npm test -- __tests__/screens/FeedScreen.test.js -t "pagination"` | No (screen test doesn't exist) |
| Firestore subscription paused during transition | unit | `npm test -- __tests__/screens/PhotoDetailScreen.test.js -t "subscription"` | Partial |
| Auto-skip on image load failure | unit | `npm test -- __tests__/hooks/usePhotoDetailModal.test.js -t "auto-skip"` | No |
| Cube transition uses Reanimated shared values | manual-only | Visual inspection on device | N/A (animation smoothness requires device testing) |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task, run: `npm test -- --bail`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~15-30 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `__tests__/hooks/usePhotoDetailModal.test.js` — covers prefetch behavior, auto-skip, photo navigation
- [ ] New test cases in `__tests__/screens/PhotoDetailScreen.test.js` — covers progressive loading, dark bg on tap, subscription pause/resume
- [ ] `__tests__/screens/FeedScreen.test.js` — covers story card pagination with "Load more"

## Sources

### Primary (HIGH confidence)
- [Expo Image documentation (SDK 54)](https://docs.expo.dev/versions/latest/sdk/image/) — prefetch API, cachePolicy, placeholder, transition, priority props
- [React Native Reanimated Performance Guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/) — UI thread vs JS thread, SharedValue best practices, common issues
- [React Native Reanimated Gesture Handling](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/handling-gestures/) — Gesture Handler + Reanimated integration patterns
- Codebase analysis: `PhotoDetailScreen.js`, `usePhotoDetailModal.js`, `PhotoDetailContext.js`, `FeedScreen.js`, `useFeedPhotos.js`, `FriendStoryCard.js`, `useSwipeableCard.js`, `feedService.js`, `storageService.js`, `signedUrlService.js`

### Secondary (MEDIUM confidence)
- [expo/expo#33412](https://github.com/expo/expo/issues/33412) — Image.prefetch header support limitations
- [expo/expo#40442](https://github.com/expo/expo/issues/40442) — cachePolicy behavior with cacheKey

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, APIs verified via official docs
- Architecture: HIGH - Patterns based on direct codebase analysis and verified library capabilities
- Pitfalls: HIGH - Derived from actual code patterns found in codebase and documented Reanimated issues

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable — all libraries are established)
