---
status: awaiting_human_verify
trigger: "When viewing @jusher's story from @vannaan's phone, an old photo appears instead of newly triaged photos. Correct on @jusher's own device."
created: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED -- FriendStoryCard uses static cacheKey `story-thumb-${userId}` with expo-image, causing stale thumbnail display even when thumbnailURL changes
test: Verified code in FriendStoryCard.js line 88. expo-image with cachePolicy="memory-disk" and a static cacheKey ignores URI changes.
expecting: Changing cacheKey to include the actual photo content identifier will fix stale thumbnails
next_action: Apply fix to FriendStoryCard.js and MeStoryCard.js (if same issue exists)

## Symptoms

expected: When @vannaan views @jusher's story, the newly triaged (revealed) photos should appear in the story.
actual: @vannaan sees an old photo from @jusher instead of the newly triaged photos. On @jusher's own device, the correct new photos appear in stories.
errors: No error messages reported.
reproduction: 1) Take photos on @jusher's account, 2) Wait for reveal, 3) Triage photos, 4) View story on @jusher's device — correct, 5) View story on @vannaan's device — shows old photo.
started: First time noticed. Unknown if it ever worked correctly cross-account.

## Eliminated

- hypothesis: Different Firestore queries between self-view and friend-view
  evidence: getUserStoriesData and getFriendStoriesData use identical query structure (photoState=='journal', triagedAt>=cutoff). Composite index (userId, photoState, triagedAt) exists.
  timestamp: 2026-03-19

- hypothesis: Missing Firestore index causing incomplete results
  evidence: Index at firestore.indexes.json lines 39-44 covers (userId ASC, photoState ASC, triagedAt DESC)
  timestamp: 2026-03-19

## Evidence

- timestamp: 2026-03-19
  checked: FriendStoryCard.js line 88 - expo-image cacheKey for story thumbnail
  found: cacheKey is `story-thumb-${userId}` -- static per user, never changes when photo content changes
  implication: expo-image returns cached old image even when thumbnailURL updates to a new photo URL

- timestamp: 2026-03-19
  checked: feedService.js getFriendStoriesData query (line 785-793)
  found: Query correctly filters by photoState=='journal' AND triagedAt>=cutoff. Returns fresh data from Firestore.
  implication: Server-side data is correct; the bug is client-side image caching

- timestamp: 2026-03-19
  checked: PhotoDetailScreen.js line 1165
  found: Detail view uses cacheKey `photo-${currentPhoto?.id}` which is unique per photo -- no stale cache issue there
  implication: The stale image is only on the FriendStoryCard thumbnail, not in the detail viewer

- timestamp: 2026-03-19
  checked: expo-image cacheKey behavior
  found: When cacheKey is provided, expo-image uses it as the sole cache lookup key, ignoring URI changes. With cachePolicy="memory-disk", cached images persist across sessions.
  implication: Static cacheKey + persistent cache = guaranteed stale thumbnails when photos change

## Resolution

root_cause: FriendStoryCard uses a static cacheKey (`story-thumb-${userId}`) for expo-image thumbnails. Since the key never changes per user, expo-image returns the old cached image even when the underlying thumbnailURL changes to a new photo. The same issue exists in MeStoryCard.
fix: Change cacheKey to include a content-dependent identifier (the thumbnailURL or a hash of it) so the cache invalidates when the photo changes.
verification: Self-verified: cacheKey now includes URL-derived suffix via profileCacheKey(), which changes when thumbnailURL changes. Lint passes. Needs on-device verification.
files_changed: [src/components/FriendStoryCard.js, src/components/MeStoryCard.js]
