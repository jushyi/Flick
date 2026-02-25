# Phase 7: Performance Enhancements to Story Viewing - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Optimize story viewing for smoother transitions, reduced memory usage, and faster load times. This covers the PhotoDetailScreen experience in both feed and stories modes, the 3D cube transition between friends, image loading/prefetching, and feed story card pagination. Comment performance and new feature capabilities are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Photo quality & progressive loading
- Use progressive loading: show a low-quality preview first, then crossfade (~200ms) to the full-resolution image once loaded
- Claude decides the preview style (blurred thumbnail vs. pixelated) and generation approach (pre-generated at upload vs. on-the-fly)
- Goal is both perceived speed (progressive loading) and actual speed (better prefetching, caching, reduced re-renders)

### Loading states (within-friend taps)
- When tapping to the next photo, immediately show dark background + spinner — do NOT linger on the current image
- This makes navigation feel responsive even before the image loads
- Progress bar behavior stays as-is (no changes)
- On load failure: auto-skip to the next photo after a timeout (no error message shown to user)

### Loading states (friend-to-friend transitions)
- Friend transitions use the cube animation rotating into a dark+spinner on the incoming cube face
- This is visually distinct from within-friend taps (cube animation vs. instant dark swap)
- Entry animation (modal slide-up) stays as-is
- Dismiss animation (swipe-down suck-back) stays as-is

### Prefetching & caching strategy
- Preload the next friend's first photo while viewing the current friend
- Keep viewed images cached in memory for quick back-navigation (no aggressive unloading)
- Continue prefetching the next 2-3 photos within the current friend's story

### Feed story card pagination
- Paginate story cards on the feed screen in batches (not all at once)
- Show a "Load more" button at the bottom to load the next batch (not auto-load on scroll)
- In stories mode, only friends already loaded in the feed are available for swiping

### Cube transition optimization
- Keep the 3D cube rotation for friend-to-friend transitions — it's distinctive
- Optimize cube smoothness (reduce frame drops) with equal priority to loading/memory improvements
- Within-friend photo taps: instant swap with no animation

### Android-specific tuning
- Same animations on all devices (no adaptive simplification for low-end devices)
- Platform-specific image loading optimization — investigate and apply Android-specific cache sizes, compression, or decoding strategies where beneficial
- Android back button/gesture triggers the same suck-back dismiss animation as swipe-down

### Real-time subscriptions during transitions
- Pause Firestore real-time listeners (reaction updates) during transitions between photos/friends
- Resume listeners once settled on the new photo
- Reduces CPU/network work during animations

### Reaction/overlay rendering
- Keep current overlay transition behavior (no changes to how overlays animate)
- Optimize reaction component rendering only if profiling shows it causes frame drops (conditional optimization)

### Claude's Discretion
- Progressive loading preview style (blurred vs. pixelated) and source (pre-generated vs. on-the-fly)
- Exact prefetch window sizes and cache limits
- Whether to use windowed loading for stories in memory (load all vs. keep ~5-10 active)
- Exact auto-skip timeout duration on load failure
- Feed pagination batch size
- Any additional memoization or render optimization beyond what profiling identifies

</decisions>

<specifics>
## Specific Ideas

- The dark background + spinner on tap should make it clear you've moved to the next item, unlike the current behavior where it stays on the current image with a spinner
- The cube transition should rotate into the dark+spinner state if the next friend's photo isn't ready — never delay the cube animation
- "Load more" button on feed rather than infinite scroll — user controls when more data loads
- Comments performance is explicitly a separate concern, not part of this phase

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-performance-enhancements-to-story-viewing*
*Context gathered: 2026-02-25*
