---
phase: 19
reviewers: [claude-self-adversarial]
reviewed_at: 2026-03-25T14:25:00Z
plans_reviewed: [19-01-PLAN.md, 19-02-PLAN.md, 19-03-PLAN.md, 19-04-PLAN.md, 19-05-PLAN.md]
note: Gemini CLI quota exhausted, Codex CLI API errors (500 + 401). Self-adversarial review performed instead.
---

# Cross-AI Plan Review -- Phase 19

## Reviewer Note

Both external AI CLIs failed:
- **Gemini CLI**: Free tier daily quota exhausted (429)
- **Codex CLI**: OpenAI API 500 Internal Server Error + 401 Unauthorized on fallback

This review was performed adversarially by the same Claude instance. While not as independent as separate models, the review was conducted with a deliberate focus on finding weaknesses, blind spots, and risks.

---

## Plan 01: Skeleton Screens + Toast Config

### Summary
Solid foundational plan that extracts an existing pattern (FeedLoadingSkeleton) into reusable primitives and creates 9 screen-specific skeleton components. The scope is well-contained and the wave 1 placement is correct since other plans depend on these components. The Toast config inclusion is a sensible co-location since it's a small addition.

### Strengths
- Reuses proven shimmer pattern from FeedLoadingSkeleton rather than inventing something new
- SkeletonBase with useShimmer hook + SkeletonShape primitive is a clean abstraction
- Explicit dimension constants from existing components prevents layout shift (D-02)
- Tests verify render-without-crash for all 9 skeletons

### Concerns
- **MEDIUM**: All 9 skeletons share a single Animated.Value from useShimmer(). If multiple skeleton screens are somehow mounted simultaneously (e.g., tab preloading), they each create independent animation loops. This is fine for correctness but wastes resources. Unlikely to matter in practice.
- **MEDIUM**: Task 1 creates 5 skeletons + SkeletonBase + tests in a single task. That's 8 files. If any skeleton has a dimension issue, the whole task blocks. Consider whether the skeleton dimensions were derived from reading the actual screen files (the plan says read_first includes MessagesListScreen, FriendsScreen, etc. -- good).
- **LOW**: DarkroomSkeleton uses absolute positioning with offset for stacked cards. This is fragile if DarkroomScreen layout changes. But since this is a polish phase (no feature changes), it's fine for now.
- **LOW**: ActivitySkeleton may just re-export NotificationsSkeleton. The plan says "read ActivityScreen.js first to determine" -- good defensive approach.

### Suggestions
- Consider adding a `testID` prop to SkeletonShape for easier testing and debugging
- The Toast config in Task 2 feels slightly orphaned -- it won't be wired into App.js until Plan 04. Ensure the test for Toast.tsx doesn't depend on being mounted in the app.

### Risk Assessment
**LOW** -- This is the safest plan. It creates new files without modifying existing ones. All components are independently testable. The pattern is proven (FeedLoadingSkeleton exists).

---

## Plan 02: Image URL Utility + EmptyState

### Summary
Clean utility plan that creates two independent, well-scoped modules. The imageUrl.ts utility is well-designed with the Buffer.from() decision for Android compatibility already made. EmptyState follows the UI-SPEC contract precisely. Both have thorough test coverage planned.

### Strengths
- Buffer.from() instead of atob() for signed URL JWT parsing -- addresses a real Android/Hermes pitfall
- isUrlNearExpiry defaults to `true` when expiry can't be determined -- fail-safe behavior
- EmptyState exactly matches the UI-SPEC visual contract (font sizes, colors, spacing all specified)
- FEED_CARD_WIDTH exported as a constant rather than magic number 400 scattered through code

### Concerns
- **HIGH**: `getTransformedPhotoUrl` takes a `storagePath` parameter and calls `supabase.storage.from(bucket).getPublicUrl(storagePath, { transform })`. But the existing feed data from Supabase RPC likely returns full URLs, not storage paths. Plan 04 will need to either: (a) extract the storage path from the full URL, or (b) this function needs to accept full URLs too. This mismatch could block Plan 04's image transform wiring.
- **MEDIUM**: The `buffer` package is listed as a "transitive dependency, already available" but this isn't verified. If it's not actually available at runtime, the signed URL expiry detection silently fails (returns null, treats as expired). The try/catch handles the crash, but every snap image would trigger unnecessary refreshes.
- **LOW**: EmptyState uses PixelIcon component. The plan lists available icon names (camera-outline, chatbubble-outline, etc.) but doesn't verify they all exist. Missing icons would render nothing, not crash.
- **LOW**: getSignedUrlExpiry parses JWT without signature verification. This is fine -- we're only reading the `exp` claim from our own Supabase-issued tokens, not trusting arbitrary JWTs for auth.

### Suggestions
- Add a unit test that verifies `Buffer.from` is available in the test environment (canary test for runtime availability)
- Consider adding `getTransformedUrl(fullUrl, width)` as an alternative entry point that accepts full CDN URLs and appends transform params, since downstream consumers (Plan 04) likely have full URLs, not storage paths
- Verify PixelIcon icon names exist before Plan 04 integration

### Risk Assessment
**LOW-MEDIUM** -- The storagePath vs fullUrl mismatch (HIGH concern) could cause friction in Plan 04, but the utility itself is sound. Tests will catch any issues early.

---

## Plan 03: Optimistic Mutation Helper + SWR Verification

### Summary
Creates a reusable useOptimisticMutation wrapper that standardizes the TanStack Query optimistic update pattern. The SWR verification task is a lightweight audit. The hook design is reasonable -- dynamic queryKey support via function-of-variables is the right call.

### Strengths
- Dynamic queryKey (static or function of variables) handles both simple and complex cases
- invalidateKeys option for cascading invalidation (e.g., mark-as-read invalidates both detail and list)
- SWR verification is a smart "trust but verify" task -- checks that global defaults aren't accidentally overridden per-hook
- Depends correctly on Plans 01+02 (needs Toast from 01)

### Concerns
- **HIGH**: The useOptimisticMutation helper assumes a single queryKey per mutation. But some optimistic updates need to update MULTIPLE cache entries. Example: toggling a reaction should update both `photos.detail(photoId)` AND the reaction count in the feed's infinite query (`photos.feed()`). The current interface only supports one `queryKey` + optional `invalidateKeys` for settle-time invalidation. The feed won't reflect the optimistic reaction until the settle refetch.
- **MEDIUM**: The helper wraps useMutation entirely, meaning consumers lose the ability to add their own onSuccess/onError/onSettled callbacks alongside the optimistic behavior. If useReactions needs custom logic on success (e.g., haptic feedback), it can't easily add it. Consider adding callback passthrough options.
- **MEDIUM**: Testing approach mocks useMutation and extracts callbacks. This tests the wiring but not the actual TanStack Query behavior (cache manipulation). Integration tests with a real QueryClient would catch more bugs but are harder to set up.
- **LOW**: The SWR verification task (Task 2) reads hooks and checks for `persist: true`. But "persist: true" is a meta flag for AsyncStorage persistence, not the core SWR behavior. SWR works without persistence (just loses cache on app restart). The task conflates the two.

### Suggestions
- Add an `updaters` option (array) that can update multiple query keys optimistically, not just one. Or document that for multi-key updates, consumers should use raw useMutation with the pattern directly.
- Add optional `onSuccess` / `onMutate` callback passthrough so consumers can extend behavior
- Consider whether the helper is worth the abstraction cost vs. a documented pattern that each hook follows manually. Five hooks is borderline -- the helper adds indirection for modest DRY benefit.

### Risk Assessment
**MEDIUM** -- The single-queryKey limitation is a real design gap that will surface when wiring reactions in Plan 05. The helper may need to be extended or bypassed for complex cases.

---

## Plan 04: Screen Integration

### Summary
The largest and riskiest plan -- modifies 13 files across 9 screens plus App.js. This is where all foundation work connects to the user-facing app. The human verification checkpoint (Task 3) is crucial and correctly placed. The plan is thorough with per-screen instructions, but the volume of changes in a single plan is concerning.

### Strengths
- Clear 4-state rendering logic: loading+noCache -> skeleton, loading+cache -> real data (SWR), empty -> EmptyState, data -> content
- Per-screen empty state copywriting table with exact icon/message/CTA/action mappings
- Human verification checkpoint gates the plan -- visual quality can't be unit tested
- Explicit instruction to preserve Plan 03's `persist: true` changes in useFeedPhotos.ts
- Toast placement instruction matches the known pitfall (last child after NavigationContainer)

### Concerns
- **HIGH**: Task 2 modifies useFeedPhotos.ts to add image transform URLs AND prefetching. This is the same file Plan 03 Task 2 modifies for SWR verification. The plan acknowledges this ("Re-read useFeedPhotos.ts fresh. Plan 03 may have added persist: true") but merge conflicts are likely if both plans' changes don't compose cleanly.
- **HIGH**: The plan says to transform photo URLs in the feed hook: "replace the raw photo_url with getTransformedPhotoUrl(storagePath, { width: FEED_CARD_WIDTH })". But feed data comes from a Supabase RPC that returns full URLs, not storage paths. This is the same storagePath vs fullUrl issue flagged in Plan 02. If not resolved, this task will hit a wall.
- **MEDIUM**: 13 files modified in 2 tasks (plus checkpoint). Task 1 alone touches 10 files. If any screen has an unexpected loading state pattern (e.g., DarkroomScreen uses custom state instead of TanStack isLoading), the task could stall.
- **MEDIUM**: Prefetch throttling in Task 2 uses "a ref to track if initial prefetch has been done." This means prefetch only fires once per hook mount. If the feed data changes (new friend added), the new friend's first image won't be prefetched until the component remounts. This is acceptable but worth documenting.
- **LOW**: The plan doesn't specify what happens to the existing FeedLoadingSkeleton.js after FeedSkeleton.tsx replaces it. Should it be deleted? Left for backwards compatibility? The RESEARCH.md says it "should be refactored" but Plan 01 creates FeedSkeleton.tsx as a new file.

### Suggestions
- Split Task 1 into two sub-tasks: screens A-E and screens F-I + App.js. Reduces blast radius per commit.
- Resolve the storagePath vs fullUrl issue before execution. Either Plan 02's imageUrl.ts needs a full-URL variant, or clarify how feed hook data maps to storage paths.
- Add explicit instruction to delete or deprecate FeedLoadingSkeleton.js after FeedSkeleton.tsx is wired in.
- Consider whether the prefetch ref should reset when feed data changes (new friends) vs. only on mount.

### Risk Assessment
**MEDIUM-HIGH** -- Large surface area (13 files), dependency on correct storagePath handling from Plan 02, and the useFeedPhotos.ts multi-plan editing risk. The human checkpoint mitigates visual issues but won't catch subtle data flow bugs.

---

## Plan 05: Optimistic Updates + Snap URL Refresh

### Summary
Completes the optimistic update wiring and signed URL refresh. Two distinct concerns in one plan. The optimistic wiring is straightforward if useOptimisticMutation from Plan 03 works well. The snap URL refresh is a nice defensive feature but adds complexity to the rendering path.

### Strengths
- Clear inventory of which hooks need optimistic updates vs. which are already instant (PowerSync)
- Snap URL refresh uses graceful degradation (serve current URL on refresh failure)
- expo-image cache serves as the visual buffer during URL refresh -- no flash
- ConversationScreen snap rendering uses simple useState + useEffect pattern

### Concerns
- **HIGH**: The plan assumes hooks like useReactions.ts, useComments.ts, useBlocking.ts, useAlbums.ts exist as separate files. The note says "Some hooks may not exist yet as TypeScript files -- they may still be .js. Check for both extensions." But what if the reaction logic is embedded in a screen component or in a different hook entirely (e.g., usePhotoActions)? The plan should verify file locations before execution.
- **MEDIUM**: The snap URL refresh pattern (useState + useEffect watching originalUrl) creates a re-render cycle: originalUrl changes -> effect fires -> async refresh -> setResolvedUrl -> re-render. If multiple snap messages are visible, this could cause a cascade of async refresh calls. Consider batching or debouncing.
- **MEDIUM**: useOptimisticMutation's single-queryKey limitation (flagged in Plan 03) affects this plan directly. When wiring useReactions, the reaction toggle should optimistically update both the photo detail AND the feed list. If the helper only supports one key, the feed won't update optimistically.
- **LOW**: refreshSignedUrlIfExpiring catches errors and returns currentUrl. But if the current URL is actually expired, the image will fail to load from the expired URL. expo-image may show a broken state. Consider whether to show a placeholder on known-expired URLs.
- **LOW**: The plan doesn't mention testing for the snap URL refresh integration. Task 2 has no TDD flag. The signedUrlService change is testable but ConversationScreen integration is not unit-tested.

### Suggestions
- Before execution, grep the codebase for the actual hook file names. The plan's hook inventory may not match reality.
- For snap URL refresh, consider a `useSnapUrl(originalUrl, storagePath)` custom hook that encapsulates the refresh logic, rather than inlining useState+useEffect in ConversationScreen. This is reusable if snaps appear in other contexts.
- Add basic test for refreshSignedUrlIfExpiring in signedUrlService
- Document what happens when useOptimisticMutation's single queryKey is insufficient for reactions -- inline the manual pattern there?

### Risk Assessment
**MEDIUM** -- The hook file location uncertainty and single-queryKey limitation are the main risks. The snap URL refresh is well-designed but untested.

---

## Consensus Summary

### Agreed Strengths
- Plans build on existing, proven patterns (FeedLoadingSkeleton, TanStack mutations, expo-image prefetch) rather than inventing new infrastructure
- Wave-based execution with correct dependency ordering (1 -> 2 -> 3, parallel within waves)
- Strong test coverage planned for foundation components (Plans 01-03)
- Human verification checkpoint in Plan 04 catches visual issues that unit tests miss
- PowerSync/TanStack boundary correctly identified -- avoids redundant optimistic layer on already-instant writes

### Agreed Concerns
1. **storagePath vs fullUrl mismatch (HIGH)**: getTransformedPhotoUrl accepts storage paths, but feed data likely has full URLs. This will block Plan 04 Task 2. Must be resolved before execution.
2. **useOptimisticMutation single queryKey limitation (HIGH)**: Reactions need to update multiple cache entries (photo detail + feed list). The helper only supports one queryKey. Plan 05 will hit this when wiring useReactions.
3. **Plan 04 large blast radius (MEDIUM-HIGH)**: 13 files in one plan, including a file also modified by Plan 03. Merge conflicts and compounding errors are likely.
4. **Hook file location assumptions (MEDIUM)**: Plan 05 assumes specific hook file names that may not exist or may be named differently.
5. **Buffer.from() availability unverified (MEDIUM)**: Assumed transitive dependency for signed URL JWT parsing.

### Divergent Views / Edge Cases
- Whether useOptimisticMutation helper is worth the abstraction (5 consumers) vs. a documented inline pattern -- borderline call
- Whether FeedLoadingSkeleton.js should be deleted after FeedSkeleton.tsx replaces it -- not addressed
- Prefetch ref resets on mount only vs. on data change -- minor UX gap for new friends
- Snap URL refresh lacks test coverage in Plan 05 but covered by utility tests in Plan 02

### Recommended Pre-Execution Actions
1. **Verify how feed RPC returns photo URLs** -- storage path or full URL? Adjust imageUrl.ts API accordingly.
2. **Decide on multi-queryKey optimistic updates** -- extend useOptimisticMutation or document when to bypass it.
3. **Grep codebase for actual hook filenames** referenced in Plan 05 (useReactions, useComments, useBlocking, useAlbums).
4. **Verify `buffer` package is available** at runtime in the React Native bundle.
