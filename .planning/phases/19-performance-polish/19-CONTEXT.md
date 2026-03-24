# Phase 19: Performance Polish - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Every screen feels instant. Skeleton screens replace loading spinners on all major list views, optimistic updates make interactions feel zero-latency, CDN-backed image loading with responsive sizing eliminates expired URL flashes, and consistent empty states replace blank screens. This phase is a UX polish pass across the existing app -- no new features, only making existing features feel faster and more complete.

</domain>

<decisions>
## Implementation Decisions

### Skeleton screens
- **D-01:** Shimmer pulse animation style (left-to-right shimmer gradient on dark gray shapes, Instagram/TikTok style). Works with the app's CRT dark theme
- **D-02:** Exact layout match per screen (each skeleton mirrors the real screen layout -- card shapes for feed, message rows for conversations, etc.)
- **D-03:** 9 screens get skeleton loading states: Feed, Conversations, Friends list, Comments, Notifications, Albums, Darkroom, Profile (photo grid), Activity
- **D-04:** FeedLoadingSkeleton.js already exists and can be used as the pattern/template for the other 8

### Optimistic updates
- **D-05:** Silent rollback + toast on failure. UI reverts to previous state automatically, brief toast notification shows error (e.g., "Failed to send"). No modal, no blocking
- **D-06:** Required optimistic updates (5 from success criteria): send message, react, accept friend request, triage photo, mark as read. Plus extras: commenting, blocking/unblocking, album edits
- **D-07:** Optimistic updates apply to TanStack-managed mutations only. PowerSync-backed data (photos, conversations, friendships, streaks) is already local-first and instant by nature -- no additional optimistic layer needed

### Image loading & CDN
- **D-08:** Supabase Storage image transformation API for responsive sizing. Append `?width=400&format=webp` to URLs for feed cards, serve original size in PhotoDetail. No pre-generated variants
- **D-09:** Two-tier prefetching: (1) On feed load, prefetch first image of each friend's story at 400px card size. (2) During story viewing, prefetch next 3 photos at full-res
- **D-10:** Proactive signed URL refresh for snaps. Check URL expiry before rendering -- if within 1 minute of expiry, trigger background refresh and serve cached image until new URL arrives. Never show expired/broken images

### Empty states
- **D-11:** Pixel art illustration + text style, matching the app's 16-bit retro aesthetic. Small pixel art icon plus short message
- **D-12:** Contextual CTA buttons where relevant (empty feed -> "Add friends", empty albums -> "Create album", empty conversations -> "Start a chat")
- **D-13:** One shared EmptyState component that accepts icon, message, and optional CTA via props. All screens use this component for consistent spacing/typography

### Claude's Discretion
- Shimmer animation implementation details (Reanimated vs Animated API, gradient approach)
- Skeleton component architecture (base skeleton primitive vs per-screen full components)
- Exact toast library/pattern for optimistic update failures
- Supabase transform URL construction helpers
- Prefetch timing and throttling (when during feed load to trigger prefetches)
- Signed URL expiry check implementation (parse JWT, check exp claim, or track timestamps)
- Pixel art assets for empty states (source/create simple icons)
- Which specific screens get which empty state messages/CTAs

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack & architecture decisions
- `.planning/research/STACK.md` -- Supabase, PowerSync, TanStack Query package versions and integration patterns
- `.planning/research/ARCHITECTURE.md` -- Service layer restructuring, data flow changes

### Prior phase context (direct prerequisites)
- `.planning/phases/14-data-layer-caching-foundation/14-CONTEXT.md` -- TanStack Query config (staleTime 30s, gcTime 10min), AsyncStorage persistence, query key factory pattern, PowerSync + TanStack boundary decisions
- `.planning/phases/15-core-services-photos-feed-darkroom/15-CONTEXT.md` -- Feed via Supabase RPC + useInfiniteQuery, PowerSync local writes for photos/darkroom, stale-while-revalidate pattern
- `.planning/phases/13-auth-storage-migration/13-CONTEXT.md` -- Public CDN URLs for photos, 5-min signed URLs for snaps, WebP compression (0.9 at 1080px photos, 0.7 at 400px profile)

### Existing code patterns
- `src/components/FeedLoadingSkeleton.js` -- Existing skeleton screen for feed (template for new skeletons)
- `src/hooks/useFeedPhotos.js` -- Feed hook with existing prefetch calls and stories grouping
- `src/hooks/usePhotoDetailModal.js` -- Photo detail with existing Image.prefetch calls
- `src/components/FriendStoryCard.js` -- Story card with existing prefetch integration

### Requirements
- `.planning/REQUIREMENTS.md` -- PERF-02 (stale-while-revalidate), PERF-03 (skeleton screens), PERF-04 (optimistic updates), PERF-05 (CDN URLs), PERF-06 (image sizing), PERF-07 (empty states), PERF-10 (story load time), PERF-11 (prefetching)
- `.planning/ROADMAP.md` -- Phase 19 success criteria (6 items)

### Project context
- `.planning/PROJECT.md` -- Constraints (dev-first migration, functionally identical)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FeedLoadingSkeleton.js` -- Existing skeleton for feed screen. Use as template for shimmer animation pattern
- `expo-image` -- Already used throughout app with `cachePolicy="memory-disk"`. Handles image caching and prefetching natively
- TanStack Query `useMutation` with `onMutate`/`onError`/`onSettled` -- optimistic update pattern available (already used in 11 files with `setQueryData`)
- `src/lib/queryKeys.ts` -- Query key factory for cache invalidation/updates

### Established Patterns
- PowerSync local writes for synced tables (photos, conversations, friendships, streaks) -- already instant
- TanStack mutations for non-synced data (reactions, comments, profiles, albums)
- Service layer: new services throw on error, TanStack catches automatically
- snake_case in DB, camelCase in TypeScript (mapping in service layer)

### Integration Points
- Feed screen renders story cards with `FriendStoryCard` and `MeStoryCard` -- prefetch hooks integrate here
- PhotoDetail opens as transparentModal -- receives photo data from parent, loads full-res
- All list views use FlatList -- `ListEmptyComponent` prop is the natural integration point for EmptyState
- Toast notifications need a provider at the app root level (or use existing notification system)

</code_context>

<specifics>
## Specific Ideas

- Feed should feel instant: cached data renders immediately via stale-while-revalidate, first story images are pre-cached on feed load
- Stories should load without delay: first photo of each story prefetched at 400px, then next 3 at full-res during viewing
- Snaps should never flash expired URLs: proactive refresh checks expiry before render, serves cached image during refresh
- Empty states should guide users: pixel art illustrations match the retro aesthetic, contextual CTAs tell users what to do next
- Skeleton screens should feel native: shimmer pulse on exact layout matches makes the app feel like it's "loading content" rather than "waiting"

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 19-performance-polish*
*Context gathered: 2026-03-24*
