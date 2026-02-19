# Codebase Concerns

**Analysis Date:** 2026-02-19

## Tech Debt

**Oversized Screen Components:**

- Issue: Several screen files exceed 1200 lines with business logic mixed into rendering
- Files: `src/screens/FeedScreen.js` (1538 lines), `src/screens/FriendsScreen.js` (1392 lines), `src/screens/PhotoDetailScreen.js` (1269 lines), `src/screens/ProfileScreen.js` (1231 lines)
- Why: Features grew incrementally without extracting hooks
- Impact: Harder to test, debug, and maintain; complex re-render chains
- Fix approach: Extract data loading and business logic into dedicated custom hooks

**Magic Numbers Scattered Across Files:**

- Issue: Constants like `MIN_REACTIONS_FOR_HOT = 2`, `FIRESTORE_IN_LIMIT = 30`, `STORIES_VISIBILITY_DAYS = 7`, `FEED_VISIBILITY_DAYS = 1` defined inline in hooks/services
- Files: `src/hooks/useFeedPhotos.js` (lines 22-23), `src/services/firebase/feedService.js` (lines 38-39, 83-84), `src/hooks/useDarkroom.js` (lines 35-38)
- Why: Added ad-hoc as features were built
- Impact: Duplication risk; hard to find all configuration values
- Fix approach: Move to `src/constants/` and import centrally

**No TypeScript:**

- Issue: Entire codebase is JavaScript with only JSDoc type hints
- Why: Project started as rapid prototype
- Impact: No compile-time type safety; runtime errors from shape mismatches possible
- Fix approach: Gradual TypeScript migration starting with service layer (long-term)

## Known Bugs

**Silent Image Prefetch Failures:**

- Symptoms: Photos may not load or appear blank without error indication
- Trigger: Slow network or Firebase signed URL expiry during prefetch
- Files: `src/screens/FeedScreen.js` (lines 485, 590, 674) - `.catch(() => {})` silently swallows errors; `src/hooks/usePhotoDetailModal.js` (lines 194, 217) - empty catch handler
- Workaround: Images eventually load on retry/scroll, or user pull-to-refresh
- Root cause: No fallback UI or retry mechanism for failed prefetch

**Closure Stale State in Feed:**

- Symptoms: Feed may occasionally show stale data after friendship changes
- Trigger: Rapid state transitions in `useFeedPhotos`
- File: `src/hooks/useFeedPhotos.js` (lines 149-151, 219) - Comment acknowledges: "can't use state value as it hasn't updated yet due to closure"
- Workaround: Uses function return value instead of state; works but fragile
- Root cause: React closure captures stale state in async callbacks

## Security Considerations

**No Client-Side Rate Limiting:**

- Risk: Users could spam comments, reactions, friend requests without client-side throttle
- Files: `src/services/firebase/commentService.js`, `src/services/firebase/friendshipService.js`
- Current mitigation: Firestore security rules provide some protection
- Recommendations: Add client-side debouncing/throttling for write operations

**Comment Input Validation at Display Layer Only:**

- Risk: Raw text written to Firestore without content validation at service layer
- File: `src/services/firebase/commentService.js` (lines 86-100) - `addComment()` accepts raw text; `MAX_COMMENT_LENGTH = 2000` constant exists but not enforced in service
- Current mitigation: Display layer renders text safely
- Recommendations: Enforce max length and basic sanitization in `commentService.addComment()` before write

**Signed URL Expiry:**

- Risk: Cached photo URLs become stale after 7-day expiry; old cached links fail silently
- File: `src/services/firebase/signedUrlService.js`
- Current mitigation: URL refresh on access; but cached/offline URLs may still fail
- Recommendations: Add URL freshness check before display; graceful fallback on 403

**FCM Token Stale Cleanup:**

- Risk: If user reinstalls app, old FCM token not cleaned up; notifications sent to wrong device
- File: `src/services/firebase/notificationService.js`
- Current mitigation: Token refresh on app launch updates user doc
- Recommendations: Implement multi-device token management or token invalidation

## Performance Bottlenecks

**N+1 Query Pattern in Feed:**

- Problem: `batchFetchUserData()` does individual doc reads per unique user in feed
- File: `src/services/firebase/feedService.js` (lines 60-80)
- Measurement: With 100 feed items from 20 friends, 20+ individual doc reads
- Cause: Firestore doesn't support JOIN; each user profile fetched separately
- Improvement path: Cache user profiles in-memory during feed session; batch using `getAll()`

**N+1 Comment Author Loading:**

- Problem: Comment author profiles loaded one-by-one
- File: `src/services/firebase/commentService.js`
- Cause: Each comment's author profile fetched individually
- Improvement path: Batch-fetch unique author profiles; cache for session duration

**Feed Curation on Every Load:**

- Problem: `curateTopPhotosPerFriend()` runs O(n log n) sort on every feed load
- File: `src/hooks/useFeedPhotos.js` (lines 31-70)
- Cause: No memoization of curation results
- Improvement path: Memoize curation with `useMemo` keyed on photo array reference

**Navigation Retry Loop:**

- Problem: Feed navigation retry maxes at 600 attempts (60s) without exponential backoff
- File: `src/screens/FeedScreen.js` (line 121)
- Cause: Linear polling interval for navigation readiness
- Improvement path: Exponential backoff or event-driven navigation readiness check

## Fragile Areas

**PhotoDetailContext Animation State:**

- File: `src/context/PhotoDetailContext.js`
- Why fragile: Multiple animated values (openProgress, dismissScale, cubeProgress) with complex interdependencies; animated in parallel with springs/timings
- Common failures: Rapid dismiss/open cycles can leave animation state inconsistent
- Safe modification: Test animation sequences manually on device after changes
- Test coverage: No automated animation state tests

**State Sync During Render in PhotoDetail:**

- File: `src/hooks/usePhotoDetailModal.js` (lines 64-69)
- Why fragile: `setPrevPhotosKey` and `setCurrentIndex` called during render to sync index on photo array changes
- Common failures: Extra re-renders, index out of bounds on rapid photo changes
- Safe modification: Consider useEffect-based sync instead of render-time state updates
- Test coverage: Limited; relies on manual testing

**Upload Queue Singleton State:**

- File: `src/services/uploadQueueService.js`
- Why fragile: Module-level `let queue = []` and `let isProcessing = false` act as singleton; if module re-imports differently, state could split
- Common failures: Queue loss on AsyncStorage failure (logged but not retried)
- Safe modification: Document singleton pattern; add state recovery from AsyncStorage
- Test coverage: Unit tests exist but don't cover edge cases

## Scaling Limits

**Firestore `in` Query Limit:**

- Current capacity: `FIRESTORE_IN_LIMIT = 30` - max 30 friends' photos per chunked query
- Limit: Users with 100+ friends require 4+ chunked queries per feed load
- Symptoms at limit: Slower feed loads, higher Firestore read costs
- Scaling path: Implement server-side feed generation (Cloud Function writes pre-computed feed)

## Dependencies at Risk

**No Known Critical Risks:**

- React Native Firebase SDK actively maintained
- Expo SDK 54 is current
- All major dependencies on active maintenance

## Missing Critical Features

**No Third-Party Error Tracking:**

- Problem: No Sentry, Bugsnag, or equivalent for crash reporting
- Current workaround: Custom logger writes to console only; no remote crash collection
- Blocks: Can't diagnose production crashes or ANRs
- Implementation complexity: Low (add Sentry SDK, wrap error boundary)

**No Analytics:**

- Problem: No product analytics (no Firebase Analytics, Mixpanel, etc.)
- Current workaround: Firebase Performance Monitoring only (not user behavior analytics)
- Blocks: Can't measure feature adoption, user flows, retention metrics
- Implementation complexity: Medium (choose provider, add event tracking throughout)

## Test Coverage Gaps

**Screen Components:**

- What's not tested: No screen component tests; 36 screens have zero test coverage
- Risk: UI regressions, navigation bugs, layout issues undetected
- Priority: Medium (hooks and services cover most logic)
- Difficulty to test: Requires React Native rendering context; complex mock setup

**Animation and Gesture Logic:**

- What's not tested: Reanimated animations, swipe gestures, card stack behavior
- Risk: Animation glitches and gesture conflicts on platform updates
- Priority: Medium
- Difficulty to test: Reanimated worklets run on UI thread; hard to test with Jest

**Upload Queue Edge Cases:**

- What's not tested: Queue recovery after app crash, concurrent upload handling, AsyncStorage failures
- Risk: Photos lost if queue state corrupts
- Priority: High
- Difficulty to test: Requires simulating app lifecycle events and storage failures

**Cloud Functions Integration:**

- What's not tested: Full notification flow (Firestore trigger → batch → push delivery)
- Risk: Notification delivery failures go undetected
- Priority: Medium
- Difficulty to test: Requires Firestore emulator or mock trigger system

---

_Concerns audit: 2026-02-19_
_Update as issues are fixed or new ones discovered_
