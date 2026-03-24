# Phase 19: Performance Polish - Research

**Researched:** 2026-03-24
**Domain:** React Native UX performance -- skeleton screens, optimistic updates, image optimization, empty states
**Confidence:** HIGH

## Summary

Phase 19 is a UX polish pass across the existing Flick app. No new features are introduced. The phase adds skeleton loading screens to 9 list views, implements optimistic updates for 5+ user interactions via TanStack Query mutations, enables Supabase Storage image transformations for responsive sizing (400px cards vs full-res detail), enhances prefetching for feed and story images, implements proactive signed URL refresh for snaps, and creates consistent empty state screens with pixel art styling.

The existing codebase provides strong foundations: TanStack Query v5 is already integrated with `useInfiniteQuery` for the feed, `useMutation` for profile updates, and AsyncStorage persistence. The `FeedLoadingSkeleton` component already implements the shimmer animation pattern using React Native's `Animated` API. The `signedUrlService` and `storageService` already handle public CDN URLs and signed snap URLs. The query key factory in `queryKeys.ts` is well-structured for cache manipulation needed by optimistic updates.

The main implementation areas are: (1) creating 8 new skeleton components following the `FeedLoadingSkeleton` pattern, (2) adding `onMutate`/`onError`/`onSettled` optimistic update handlers to existing and new `useMutation` hooks, (3) building a URL helper that appends Supabase image transform parameters to public URLs, (4) enhancing prefetch logic in feed and story hooks, (5) building a reusable `EmptyState` component, and (6) adding a lightweight toast system for optimistic update rollback notifications.

**Primary recommendation:** Follow the existing `FeedLoadingSkeleton` shimmer pattern (React Native `Animated` API, not Reanimated) for all skeleton screens. Use TanStack Query's built-in `onMutate`/`onError`/`onSettled` for optimistic updates. Use Supabase's `getPublicUrl` with `transform` option for image sizing. Use `react-native-toast-message` for failure toasts.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Shimmer pulse animation style (left-to-right shimmer gradient on dark gray shapes, Instagram/TikTok style)
- **D-02:** Exact layout match per screen (each skeleton mirrors the real screen layout)
- **D-03:** 9 screens get skeleton loading states: Feed, Conversations, Friends list, Comments, Notifications, Albums, Darkroom, Profile (photo grid), Activity
- **D-04:** FeedLoadingSkeleton.js already exists and can be used as the pattern/template for the other 8
- **D-05:** Silent rollback + toast on failure for optimistic updates
- **D-06:** Required optimistic updates: send message, react, accept friend request, triage photo, mark as read. Plus extras: commenting, blocking/unblocking, album edits
- **D-07:** Optimistic updates apply to TanStack-managed mutations only. PowerSync-backed data is already local-first and instant
- **D-08:** Supabase Storage image transformation API for responsive sizing. Append width/format params to URLs
- **D-09:** Two-tier prefetching: (1) On feed load, prefetch first image of each friend's story at 400px. (2) During story viewing, prefetch next 3 photos at full-res
- **D-10:** Proactive signed URL refresh for snaps -- check expiry before rendering, serve cached image during refresh
- **D-11:** Pixel art illustration + text style for empty states, matching 16-bit retro aesthetic
- **D-12:** Contextual CTA buttons where relevant (empty feed -> "Add friends", etc.)
- **D-13:** One shared EmptyState component with icon, message, and optional CTA props

### Claude's Discretion
- Shimmer animation implementation details (Reanimated vs Animated API, gradient approach)
- Skeleton component architecture (base skeleton primitive vs per-screen full components)
- Exact toast library/pattern for optimistic update failures
- Supabase transform URL construction helpers
- Prefetch timing and throttling
- Signed URL expiry check implementation
- Pixel art assets for empty states
- Which specific screens get which empty state messages/CTAs

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-02 | Stale-while-revalidate on feed, conversations, profile (cached data <100ms) | TanStack Query already configured with staleTime 30s, gcTime 10min, AsyncStorage persistence. Feed hook already uses useInfiniteQuery with meta.persist. Need to verify conversations and profile hooks have same pattern |
| PERF-03 | Skeleton screens on all list views (feed, conversations, friends, comments, notifications, albums) | FeedLoadingSkeleton exists as template. 8 new skeleton components needed. Shimmer uses Animated API with 800ms loop |
| PERF-04 | Optimistic updates for message sending, reactions, friend requests, photo triage, read receipts | TanStack useMutation onMutate/onError/onSettled pattern. PowerSync-backed writes (photos, conversations) already instant. TanStack mutations need optimistic layer |
| PERF-05 | Photo/video CDN-backed permanent URLs or pre-refreshed signed URLs (no expired URL flash) | Public photos already use CDN URLs via getPublicUrl(). Snaps use 5-min signed URLs. Need proactive refresh logic checking expiry |
| PERF-06 | Feed images served at appropriate sizes (400px cards, full-res in PhotoDetail) | Supabase Storage image transformations on Pro plan. Use getPublicUrl with transform: { width: 400 } for feed cards |
| PERF-07 | Consistent empty state screens across all list views | 9+ screens already have ListEmptyComponent. Need shared EmptyState component with pixel art styling |
| PERF-10 | Story photos from friends load within 1-2 seconds | CDN + 400px sizing + prefetching first image per story on feed load |
| PERF-11 | Feed and story image prefetching (next N images while viewing current) | expo-image prefetch already used in useDarkroom and usePhotoDetailModal. Enhance with size-aware prefetching |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Logger:** Never use `console.log()` -- always use `logger` utility from `utils/logger`
- **Import order:** React/RN core, third-party, services, components, context/hooks, utilities
- **expo-image:** Already used throughout with `cachePolicy="memory-disk"` -- use for all image display
- **Service pattern:** New services throw on error (TanStack catches). Old Firebase services keep `{ success, error }`
- **Commit format:** `type(scope): description` -- commit after each plan/phase
- **Platform guards:** Always wrap Android-only code in `Platform.OS === 'android'` checks
- **File naming:** Components PascalCase, services/utils camelCase, screens PascalCase+Screen, hooks camelCase+use

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.95.2 | Data fetching, caching, mutations | Already integrated. Provides useMutation with optimistic update hooks |
| @tanstack/react-query-persist-client | ^5.95.2 | AsyncStorage cache persistence | Already integrated. Enables <100ms cached renders |
| expo-image | ~3.0.11 | Image display and prefetching | Already used app-wide. Has `prefetch()` and `cachePolicy` |
| react-native-reanimated | ~4.1.1 | Gesture animations | Already installed. NOT needed for skeleton shimmer (use Animated API per existing pattern) |
| @supabase/supabase-js | ^2.100.0 | Storage image transformations via getPublicUrl transform option | Already integrated |

### New Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-native-toast-message | 2.3.3 | Lightweight toast notifications for optimistic rollback | Show brief error messages on mutation failure |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-native-toast-message | burnt (0.13.0) | burnt uses native iOS/Android toasts -- looks great but less customizable for pixel art theme |
| react-native-toast-message | sonner-native (0.23.1) | Newer, but less battle-tested. toast-message has 4K+ GitHub stars, better docs |
| react-native-toast-message | Custom InAppNotificationBanner | Already exists but designed for push notifications, not brief error toasts. Reusing would conflate concerns |

**Installation:**
```bash
npm install react-native-toast-message@2.3.3
```

**No native build required** -- react-native-toast-message is pure JS. Deployable via EAS Update.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── skeletons/              # NEW: All skeleton screen components
│   │   ├── SkeletonBase.tsx    # Shared shimmer animation + base shapes
│   │   ├── FeedSkeleton.tsx    # (refactor from FeedLoadingSkeleton.js)
│   │   ├── ConversationsSkeleton.tsx
│   │   ├── FriendsSkeleton.tsx
│   │   ├── CommentsSkeleton.tsx
│   │   ├── NotificationsSkeleton.tsx
│   │   ├── AlbumsSkeleton.tsx
│   │   ├── DarkroomSkeleton.tsx
│   │   ├── ProfilePhotoGridSkeleton.tsx
│   │   └── ActivitySkeleton.tsx
│   ├── EmptyState.tsx          # NEW: Shared empty state component
│   └── Toast.tsx               # NEW: Custom toast config for pixel art style
├── utils/
│   └── imageUrl.ts             # NEW: URL helpers for image transforms + signed URL refresh
├── hooks/
│   └── useOptimisticMutation.ts  # NEW (optional): Shared optimistic mutation wrapper
```

### Pattern 1: Skeleton Base with Shimmer Animation
**What:** Extract the shimmer animation from FeedLoadingSkeleton into a shared base, then compose per-screen skeletons from primitive shapes.
**When to use:** All 9 skeleton screens.
**Example:**
```typescript
// src/components/skeletons/SkeletonBase.tsx
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SHIMMER_WIDTH = 100;

export function useShimmer() {
  const shimmerPosition = useRef(new Animated.Value(-SHIMMER_WIDTH)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerPosition, {
        toValue: SCREEN_WIDTH,
        duration: 800,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmerPosition]);

  return shimmerPosition;
}

interface SkeletonShapeProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  shimmerPosition: Animated.Value;
  style?: object;
}

export function SkeletonShape({ width, height, borderRadius = 4, shimmerPosition, style }: SkeletonShapeProps) {
  return (
    <View style={[{ width, height, borderRadius, backgroundColor: colors.background.tertiary, overflow: 'hidden' }, style]}>
      <Animated.View
        style={[styles.shimmer, { transform: [{ translateX: shimmerPosition }] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SHIMMER_WIDTH,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
```

### Pattern 2: TanStack Optimistic Update
**What:** Use onMutate to snapshot previous data, update cache optimistically, then rollback on error.
**When to use:** All TanStack-managed mutations (reactions, comments, friend requests, album edits, blocking).
**Example:**
```typescript
// Optimistic update pattern for reactions
const toggleReaction = useMutation({
  mutationFn: (params: { photoId: string; userId: string }) =>
    reactionService.toggleReaction(params.photoId, params.userId),
  onMutate: async ({ photoId, userId }) => {
    // Cancel in-flight queries
    await queryClient.cancelQueries({ queryKey: queryKeys.photos.detail(photoId) });

    // Snapshot previous value
    const previous = queryClient.getQueryData(queryKeys.photos.detail(photoId));

    // Optimistically update
    queryClient.setQueryData(queryKeys.photos.detail(photoId), (old: any) => ({
      ...old,
      reactionCount: old.hasReacted ? old.reactionCount - 1 : old.reactionCount + 1,
      hasReacted: !old.hasReacted,
    }));

    return { previous };
  },
  onError: (_err, { photoId }, context) => {
    // Rollback
    queryClient.setQueryData(queryKeys.photos.detail(photoId), context?.previous);
    Toast.show({ type: 'error', text1: 'Failed to react' });
  },
  onSettled: (_data, _err, { photoId }) => {
    // Refetch to ensure server state
    queryClient.invalidateQueries({ queryKey: queryKeys.photos.detail(photoId) });
  },
});
```

### Pattern 3: Supabase Image Transform URL Helper
**What:** Utility that appends transform parameters to Supabase public URLs or generates transformed URLs directly.
**When to use:** Feed card images (400px), profile photos, any image that needs responsive sizing.
**Example:**
```typescript
// src/utils/imageUrl.ts
import { supabase } from '@/lib/supabase';

/**
 * Get a public URL with image transformations applied.
 * Uses Supabase's /render/image/ endpoint for on-the-fly resizing.
 */
export function getTransformedPhotoUrl(
  storagePath: string,
  options: { width?: number; quality?: number; bucket?: string } = {}
): string {
  const { width, quality, bucket = 'photos' } = options;

  if (!width) {
    // No transform needed -- return standard CDN URL
    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath, {
    transform: { width, ...(quality ? { quality } : {}) },
  });
  return data.publicUrl;
}

// Convenience constants
export const FEED_CARD_WIDTH = 400;
export const FULL_RES = undefined; // No transform = original 1080px
```

### Pattern 4: Proactive Signed URL Refresh
**What:** Check snap URL expiry before rendering. If near expiry, refresh in background while serving cached image.
**When to use:** Snap images in conversations and snap viewer.
**Example:**
```typescript
// src/utils/imageUrl.ts (continued)

/**
 * Parse expiry from Supabase signed URL.
 * Supabase signed URLs contain a `token` query param which is a JWT.
 * The `exp` claim is the expiry timestamp.
 */
export function getSignedUrlExpiry(signedUrl: string): number | null {
  try {
    const url = new URL(signedUrl);
    const token = url.searchParams.get('token');
    if (!token) return null;
    // JWT payload is the second part, base64url-encoded
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null; // Convert to ms
  } catch {
    return null;
  }
}

/**
 * Check if a signed URL will expire within the given threshold.
 */
export function isUrlNearExpiry(signedUrl: string, thresholdMs = 60_000): boolean {
  const expiry = getSignedUrlExpiry(signedUrl);
  if (!expiry) return true; // Can't determine -- treat as expired
  return Date.now() + thresholdMs >= expiry;
}
```

### Pattern 5: EmptyState Component
**What:** Shared component for all empty list views with pixel art icon, message, and optional CTA.
**When to use:** All FlatList `ListEmptyComponent` slots across the app.
**Example:**
```typescript
// src/components/EmptyState.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PixelIcon from './PixelIcon';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

interface EmptyStateProps {
  icon: string;       // PixelIcon name
  message: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}

export function EmptyState({ icon, message, ctaLabel, onCtaPress }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <PixelIcon name={icon} size={48} color={colors.text.tertiary} />
      <Text style={styles.message}>{message}</Text>
      {ctaLabel && onCtaPress && (
        <TouchableOpacity style={styles.cta} onPress={onCtaPress}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

### Anti-Patterns to Avoid
- **Using Reanimated for skeleton shimmer:** The existing FeedLoadingSkeleton uses React Native's built-in `Animated` API with `useNativeDriver: true`. This is sufficient for a simple translateX loop. Reanimated adds complexity for no benefit here. Stay consistent with the existing pattern.
- **Hand-rolling optimistic state management:** Do NOT build a custom state layer for optimistic updates. TanStack Query's `onMutate`/`onError`/`onSettled` with `setQueryData` handles this perfectly. The queryClient IS the optimistic state store.
- **Prefetching all images at once:** Prefetch only what the user is likely to see next. On feed load: first image per friend at 400px. During story viewing: next 3 at full-res. Not the entire feed.
- **Storing signed URL expiry timestamps separately:** Parse expiry from the JWT token in the signed URL itself. No need for a separate cache or database column.
- **Building skeleton screens without matching real layouts:** Each skeleton MUST mirror the exact dimensions and spacing of the real screen. Measure from the actual component styles, not from approximation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom animated banner | react-native-toast-message | Handles queue, auto-dismiss, swipe-to-dismiss, keyboard avoidance. 50+ edge cases |
| Image caching | Custom AsyncStorage image cache | expo-image cachePolicy="memory-disk" | Already handles LRU eviction, disk/memory tiers, prefetch API |
| Optimistic state | Custom useState + revert logic | TanStack Query onMutate/setQueryData | Built-in rollback, refetch on settle, query invalidation |
| Image resizing | Client-side resize before display | Supabase Storage transform API | Server-side, CDN-cached, no client CPU cost |
| Shimmer animation | LinearGradient + MaskedView | Animated.View translateX | Already working in FeedLoadingSkeleton. Simpler, fewer dependencies |

**Key insight:** This phase adds zero new infrastructure. Every capability (caching, mutations, image transforms, prefetching) already exists in the installed stack. The work is wiring existing APIs into the right places with the right patterns.

## Common Pitfalls

### Pitfall 1: Optimistic Update Cache Key Mismatch
**What goes wrong:** `setQueryData` updates a key that doesn't match what the component is reading, so the UI doesn't update optimistically.
**Why it happens:** Query keys are arrays. `['photos', 'detail', '123']` is not the same as `['photos', '123']`. If the mutation updates the wrong key, the component never sees the change.
**How to avoid:** Always use the `queryKeys` factory from `src/lib/queryKeys.ts`. Never construct query key arrays manually in mutation hooks.
**Warning signs:** Optimistic update "works" on refetch but not instantly. The mutation succeeds but the UI waits for the settle refetch.

### Pitfall 2: Race Condition in Optimistic Rollback
**What goes wrong:** Two rapid mutations to the same data (e.g., double-tap reaction) cause the rollback to restore stale state.
**Why it happens:** First `onMutate` snapshots state A. Second `onMutate` snapshots state B (which is the optimistic result of mutation 1, not yet confirmed). If mutation 1 fails, it rolls back to A, overwriting mutation 2's optimistic change.
**How to avoid:** Always call `queryClient.cancelQueries()` at the start of `onMutate` to cancel in-flight fetches. For toggle operations (reaction toggle), debounce at the UI level or use a `mutateAsync` chain.
**Warning signs:** Rapid tapping causes UI flicker between states.

### Pitfall 3: Skeleton Dimensions Don't Match Real Content
**What goes wrong:** Content "jumps" when real data replaces skeleton because the skeleton shapes have different heights/widths than the actual content.
**Why it happens:** Skeleton dimensions are approximated instead of derived from the same style constants the real components use.
**How to avoid:** Import the same dimension constants used by real components (e.g., `STORY_PHOTO_WIDTH` from the story card styles). The existing `FeedLoadingSkeleton` already does this correctly.
**Warning signs:** Visible layout shift when transitioning from skeleton to real content.

### Pitfall 4: Supabase Image Transform URL Caching
**What goes wrong:** The same image at different sizes generates different URLs, which means expo-image caches them separately -- doubling storage and bandwidth.
**Why it happens:** `getPublicUrl` with `transform: { width: 400 }` returns a URL like `/render/image/public/...?width=400`, while the full-res URL is `/object/public/...`. These are different cache keys.
**How to avoid:** This is expected behavior and actually desirable -- you want 400px cached separately from 1080px. But be aware that prefetching at 400px does NOT warm the cache for 1080px. When opening PhotoDetail, the full-res image still needs to load.
**Warning signs:** None -- this is working as intended. Just be aware of it when designing prefetch strategy.

### Pitfall 5: Signed URL JWT Parsing on Android
**What goes wrong:** `atob()` may not be available or behave differently in Hermes/JSC on Android.
**Why it happens:** `atob` is a Web API that may not exist in all React Native JavaScript engines.
**How to avoid:** Use a polyfill or manual base64 decode. React Native's `Buffer` from `buffer` package (already a transitive dep) can decode base64: `Buffer.from(str, 'base64').toString()`. Or simply track the URL creation timestamp + 300 second TTL instead of parsing the JWT.
**Warning signs:** Crash on Android when trying to check URL expiry.

### Pitfall 6: Toast Provider Placement
**What goes wrong:** Toasts don't appear because the `<Toast />` component is rendered behind a modal or below the navigation container.
**Why it happens:** react-native-toast-message requires its `<Toast />` component at the very top of the component tree, AFTER all other providers and navigators.
**How to avoid:** Place `<Toast />` as the LAST child in App.js, after `NavigationContainer`. This ensures it renders above everything.
**Warning signs:** `Toast.show()` is called but nothing appears on screen.

## Code Examples

### Existing Feed Skeleton (Template for All Others)
```javascript
// Source: src/components/FeedLoadingSkeleton.js (lines 47-114)
// Key patterns:
// 1. Uses Animated.Value with loop timing (800ms, useNativeDriver: true)
// 2. ShimmerHighlight is an Animated.View with translateX transform
// 3. Each shape has overflow: 'hidden' and backgroundColor: colors.background.tertiary
// 4. Dimensions match real component constants (STORY_PHOTO_WIDTH, FEED_PROFILE_SIZE)
```

### Existing Prefetch Pattern
```javascript
// Source: src/hooks/useDarkroom.js (lines 631-652)
// Uses ExpoImage.prefetch(urls, 'memory-disk')
// Prefetches only visible stack cards (not all photos)
// Wrapped in try/catch with logger.warn on failure
```

### Existing Query Key Factory
```typescript
// Source: src/lib/queryKeys.ts
// All domains covered: profile, photos, conversations, friends, comments, notifications, albums
// Used by setQueryData for optimistic updates and invalidateQueries for refetch
```

### Supabase getPublicUrl with Transform
```typescript
// Source: Supabase official docs
// https://supabase.com/docs/guides/storage/serving/image-transformations
supabase.storage.from('photos').getPublicUrl('user/photo.webp', {
  transform: {
    width: 400,    // 1-2500px
    quality: 75,   // 20-100 (default 80)
    // resize: 'cover' (default) | 'contain' | 'fill'
    // format: 'origin' to disable auto-WebP
  },
});
// Returns: { data: { publicUrl: 'https://project.supabase.co/storage/v1/render/image/public/photos/user/photo.webp?width=400&quality=75' } }
```

### react-native-toast-message Setup
```typescript
// App.js - Place <Toast /> as last child
import Toast, { BaseToast } from 'react-native-toast-message';

const toastConfig = {
  error: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: colors.status.error, backgroundColor: colors.background.secondary }}
      text1Style={{ color: colors.text.primary, fontFamily: 'PixelFont' }}
      text1NumberOfLines={1}
    />
  ),
};

// In App.js render, after NavigationContainer:
<Toast config={toastConfig} position="bottom" bottomOffset={100} visibilityTime={2000} />

// Usage in any component:
import Toast from 'react-native-toast-message';
Toast.show({ type: 'error', text1: 'Failed to send message' });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Firebase signed URLs (7-day) | Supabase signed URLs (5-min) + public CDN | Phase 13 | Snaps need proactive refresh; photos use permanent CDN |
| Manual useState/useEffect caching | TanStack Query with persistence | Phase 14 | All caching is declarative, persist flag enables instant renders |
| Firestore chunked queries | Single SQL JOIN via RPC | Phase 15 | Feed loads in one query, no 30-ID limit |
| Client-side image resize before display | Supabase Storage server-side transforms | Available now | CDN-cached resized images, no client CPU cost |

**Deprecated/outdated:**
- `FeedLoadingSkeleton.js`: Still functional but should be refactored into the new `skeletons/` directory for consistency with the 8 new skeleton components
- Individual `renderEmptyState` functions in each screen: Will be replaced by the shared `EmptyState` component

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest with jest-expo preset |
| Config file | `jest.config.js` |
| Quick run command | `npm test -- --bail` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-02 | Stale-while-revalidate renders cached data | unit | `npm test -- __tests__/hooks/useFeedPhotos.test.ts --bail` | Exists (useFeedPhotos.test.ts) |
| PERF-03 | Skeleton screens render without errors | unit | `npm test -- __tests__/components/skeletons/ --bail` | Wave 0 |
| PERF-04 | Optimistic updates revert on error | unit | `npm test -- __tests__/hooks/useOptimisticMutation.test.ts --bail` | Wave 0 |
| PERF-05 | Signed URL expiry detection works correctly | unit | `npm test -- __tests__/utils/imageUrl.test.ts --bail` | Wave 0 |
| PERF-06 | Transform URL helper generates correct URLs | unit | `npm test -- __tests__/utils/imageUrl.test.ts --bail` | Wave 0 |
| PERF-07 | EmptyState component renders with all prop combos | unit | `npm test -- __tests__/components/EmptyState.test.tsx --bail` | Wave 0 |
| PERF-10 | Prefetch called with correct URLs on feed load | unit | `npm test -- __tests__/hooks/useFeedPhotos.test.ts --bail` | Exists (needs update) |
| PERF-11 | Prefetch called for next N images during story view | unit | `npm test -- __tests__/hooks/usePhotoDetailModal.test.js --bail` | Exists (needs update) |

### Sampling Rate
- **Per task commit:** `npm test -- --bail`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/components/skeletons/` -- directory for skeleton render tests
- [ ] `__tests__/utils/imageUrl.test.ts` -- covers PERF-05, PERF-06 (URL transforms, expiry parsing)
- [ ] `__tests__/components/EmptyState.test.tsx` -- covers PERF-07
- [ ] `__tests__/hooks/useOptimisticMutation.test.ts` -- covers PERF-04 (optimistic update rollback)
- [ ] Update existing `useFeedPhotos.test.ts` for prefetch assertions

## Screens and Empty State Mapping

Based on code analysis of existing `ListEmptyComponent` usage and `renderEmptyState` patterns:

| Screen | Current Empty State | Proposed Empty State |
|--------|-------------------|---------------------|
| FeedScreen | Custom inline (TakeFirstPhotoCard or sad emoji) | EmptyState: icon="camera", "No photos yet", CTA "Add friends" |
| MessagesScreen | Custom inline renderEmptyState | EmptyState: icon="message", "No conversations yet", CTA "Start a chat" |
| FriendsScreen | Custom inline (3 sections) | EmptyState: icon="friends", "No friends yet", CTA "Find friends" |
| NotificationsScreen | Custom inline renderEmptyState | EmptyState: icon="bell", "No notifications yet" |
| CommentsBottomSheet | Custom inline renderEmpty | EmptyState: icon="comment", "No comments yet", CTA "Be the first" |
| AlbumGridScreen | None detected | EmptyState: icon="album", "No photos in this album" |
| DarkroomScreen | Existing empty state in styles | EmptyState: icon="darkroom", "Nothing developing" |
| ProfileScreen (grid) | None detected | EmptyState: icon="photo", "No photos yet", CTA "Take a photo" |
| ActivityScreen | None detected | EmptyState: icon="activity", "No activity yet" |
| BlockedUsersScreen | Custom inline | EmptyState: icon="block", "No blocked users" |
| NewMessageScreen | Custom inline | EmptyState: icon="search", "No friends found" |

## Optimistic Update Inventory

Based on D-06 and D-07, here is the mapping of which interactions need optimistic updates and which are already instant via PowerSync:

| Interaction | Data Source | Already Instant? | Action Needed |
|------------|------------|-----------------|---------------|
| Send message | PowerSync (conversations) | YES | None -- local write |
| React to photo | TanStack (photo_reactions) | NO | Add onMutate/onError/onSettled |
| Accept friend request | PowerSync (friendships) | YES | None -- local write |
| Triage photo (journal/archive) | PowerSync (photos) | YES | None -- local write |
| Mark as read | TanStack (conversations) | NO | Add optimistic update |
| Comment on photo | TanStack (comments) | NO | Add optimistic update |
| Block/unblock user | TanStack (blocks) | NO | Add optimistic update |
| Album edits | TanStack (albums) | NO | Add optimistic update |

**Key insight:** Of the 5 required optimistic updates (D-06), 3 are already instant via PowerSync local writes. Only reactions and mark-as-read need TanStack optimistic updates from the required list. The "extras" (commenting, blocking, album edits) all need TanStack optimistic updates.

## Open Questions

1. **Supabase Image Transform Availability**
   - What we know: Supabase Pro plan includes image transformations. The project is on Pro plan ($25/mo per STACK.md)
   - What's unclear: Whether image transformations are enabled by default or need to be toggled on in the Supabase dashboard
   - Recommendation: Verify in Supabase dashboard that Image Transformations are enabled before implementing. If not, enable them (Pro plan feature, no extra cost)

2. **Pixel Art Assets for Empty States**
   - What we know: The app uses a 16-bit retro pixel art aesthetic. PixelIcon component exists with various icon names
   - What's unclear: Whether PixelIcon has sufficient icons for all empty states (camera, message, bell, album, etc.)
   - Recommendation: Audit PixelIcon available icons. If missing, create simple pixel art icons or use existing ones with closest semantic match

3. **Toast Message Styling with Pixel Font**
   - What we know: react-native-toast-message supports custom toast configs with full style control
   - What's unclear: Whether the pixel font renders correctly at toast text sizes
   - Recommendation: Test toast appearance with pixel font early. Fall back to system font if pixel font is unreadable at small sizes

## Sources

### Primary (HIGH confidence)
- `src/components/FeedLoadingSkeleton.js` -- Existing shimmer animation pattern (line 47-114)
- `src/hooks/useFeedPhotos.ts` -- Existing feed hook with TanStack Query integration
- `src/hooks/useProfile.ts` -- Existing useMutation pattern (template for optimistic updates)
- `src/services/supabase/signedUrlService.ts` -- Current signed URL implementation
- `src/services/supabase/storageService.ts` -- Current storage URL pattern
- `src/lib/queryKeys.ts` -- Query key factory for cache operations
- Supabase Storage Image Transformations docs -- https://supabase.com/docs/guides/storage/serving/image-transformations

### Secondary (MEDIUM confidence)
- react-native-toast-message npm (v2.3.3 verified via npm registry)
- TanStack Query v5 optimistic update pattern (standard well-documented pattern)

### Tertiary (LOW confidence)
- `atob()` availability in Hermes engine -- needs runtime verification on Android

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All core libraries already installed and verified. Only new dependency is react-native-toast-message (pure JS, well-established)
- Architecture: HIGH - Patterns derived directly from existing codebase (FeedLoadingSkeleton, useFeedPhotos, queryKeys). No new architectural patterns
- Pitfalls: HIGH - Based on direct code analysis and known React Native / TanStack Query behaviors
- Image transforms: MEDIUM - Supabase docs confirm API, but dashboard enablement not verified

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (30 days -- stable libraries, no fast-moving changes expected)
