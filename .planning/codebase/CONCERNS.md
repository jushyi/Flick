# Codebase Concerns

**Analysis Date:** 2026-02-23

## Tech Debt

**Large monolithic screens with complex state:**

- Issue: `FeedScreen.js` (1570 lines), `PhotoDetailScreen.js` (1471 lines), and `useDarkroom.js` (722 lines) contain deeply nested logic mixing UI rendering, state management, and business logic
- Files: `src/screens/FeedScreen.js`, `src/screens/PhotoDetailScreen.js`, `src/hooks/useDarkroom.js`
- Impact: Difficult to test, high re-render costs when any part of state changes, harder to maintain and extend features
- Fix approach: Further refactor hooks into smaller units (e.g., separate hooks for animations, gesture handling, data fetching); consider moving repeated patterns into helper hooks

**State synchronization complexity in PhotoDetailContext:**

- Issue: `PhotoDetailContext.js` manages 15+ state variables for photo detail modal, with refs for callbacks to prevent re-renders. Two separate context consumers (`usePhotoDetail` and `usePhotoDetailActions`) create cognitive overhead
- Files: `src/context/PhotoDetailContext.js`, `src/screens/PhotoDetailScreen.js`, `src/screens/FeedScreen.js`
- Impact: Easy to create stale closures; callback mutations can cause silent bugs; new developers must understand the ref/callback pattern
- Fix approach: Split into smaller concerns (e.g., `usePhotoDetailState` for state, `usePhotoDetailGestures` for gesture handling)

**Unhandled promise rejections in image prefetching:**

- Issue: Image prefetch calls use `.catch(() => {})` to silently swallow all errors across 12+ locations without logging
- Files: `src/components/FriendStoryCard.js:51`, `src/components/MeStoryCard.js:50`, `src/hooks/usePhotoDetailModal.js:198,221`, `src/hooks/useSwipeableCard.js:226-238`, `src/screens/FeedScreen.js:501,551,618,702`
- Impact: Silent failures hide network issues; impossible to debug image loading problems in production
- Fix approach: Log prefetch failures at WARN level; track failure patterns to detect systematic CDN/URL issues

**Haptics calls without error handling:**

- Issue: Haptics async calls wrapped in `.catch(() => {})` without any logging on 8+ gesture interactions
- Files: `src/hooks/useSwipeableCard.js:226,230,234,238`
- Impact: Haptic feedback silently fails on some devices; users lose tactile feedback with no indication why
- Fix approach: Log haptic failures per device; add fallback UI feedback (brief visual flash) when haptics unavailable

**Magic numbers scattered throughout codebase:**

- Issue: Layout constants (padding, spacing, animation timings) hardcoded in individual files/components rather than centralized
- Files: `src/screens/PhotoDetailScreen.js:60-62` (progress bar sizing), `src/components/DarkroomBottomSheet.js:370` (interval timing), multiple screen files with inset calculations
- Impact: Changes to spacing or timing require updating multiple files; inconsistent appearance across app
- Fix approach: Move all magic numbers to `src/constants/layout.js` or `src/constants/animations.js`; reference from single source

**setTimeout/setInterval without guaranteed cleanup:**

- Issue: 20+ uses of `setTimeout`/`setInterval` stored in refs with cleanup in dependencies, but several have potential memory leaks if component unmounts during async operations
- Files: `src/components/AlbumPhotoViewer.js:332,525,926`, `src/components/DarkroomBottomSheet.js:370,506`, `src/components/CommentsBottomSheet.js:414,438,556,575,799,850,871`
- Impact: Background timers continue running after unmount; potential memory leaks in long-lived screens
- Fix approach: Always clear timers in useEffect cleanup; use `isMountedRef` pattern for async state updates

**Untested image dimension calculations on Android:**

- Issue: `ProfilePhotoCropScreen.android.js` has complex coordinate system conversions for EXIF rotation and display scaling (lines 26-60) with hand-computed formulas but no test coverage
- Files: `src/screens/ProfilePhotoCropScreen.android.js:26-60`
- Impact: Crop coordinates can be off by pixels on certain Android devices with EXIF rotation; affects all Android users uploading profile photos
- Fix approach: Add unit tests for crop formula with known EXIF rotations and screen scales; test with real camera photos on multiple Android devices

---

## Known Bugs

**Signed URL expiration not handled gracefully:**

- Symptoms: After 24 hours, photos fail to load silently with no retry or error message
- Files: `src/services/firebase/signedUrlService.js`, `src/hooks/useFeedPhotos.js`, photo display components
- Trigger: Open feed, wait 24+ hours, return to app, photos show as broken
- Workaround: Refresh feed (pull-to-refresh) to regenerate URLs; this should happen automatically on app foreground
- Fix approach: Detect 403/401 from signed URL requests and automatically regenerate; implement exponential backoff retry

**Android KeyboardAvoidingView padding inconsistency:**

- Symptoms: Keyboard pushes UI up inconsistently on Android; sometimes overlaps input fields
- Files: `src/screens/PhotoDetailScreen.js:648,700` (Platform.select for keyboard behavior), comment input screens
- Trigger: Open comments sheet on Android and type in comment input
- Workaround: Use `behavior="height"` instead of `behavior="padding"` on Android
- Fix approach: Audit all KeyboardAvoidingView usage; standardize behavior per platform; test on multiple Android versions

**Reaction count race condition in feed:**

- Symptoms: Reaction count jumps or shows incorrect value briefly when rapidly clicking reaction emoji
- Files: `src/screens/FeedScreen.js` (reaction state management), `src/context/PhotoDetailContext.js` (reaction callbacks)
- Trigger: Tap reaction emoji multiple times rapidly in feed or photo detail
- Workaround: Wait between reaction taps; refresh feed
- Fix approach: Add debounce/throttle to reaction toggle; use optimistic updates with rollback on failure

**Darkroom reveal timing drift:**

- Symptoms: Photos don't reveal at exactly the expected time; sometimes delayed by minutes
- Files: `src/services/firebase/darkroomService.js`, `src/hooks/useDarkroom.js`, `functions/index.js:revealUserPhotos`
- Trigger: Send photo, wait for reveal window, check darkroom
- Workaround: Pull-to-refresh darkroom; manually trigger reveal check
- Fix approach: Ensure reveal times are consistent across three check points (App.js foreground, DarkroomScreen focus, cloud function); add logging to detect skipped reveals

**Message pagination cursor not persisting:**

- Symptoms: After scrolling up to load older messages, scrolling down and back up reloads duplicate messages
- Files: `src/services/firebase/messageService.js` (pagination logic), conversation screens
- Trigger: Open conversation, scroll up to load older messages, scroll down, scroll back up
- Workaround: Refresh conversation or close/reopen
- Fix approach: Store last-loaded cursor in state; validate cursor still exists before using; add deduplication on merge

---

## Security Considerations

**Phone auth confirmation ref passed between screens:**

- Risk: `PhoneAuthConfirmationResult` from `signInWithPhoneNumber()` is non-serializable and passed via context ref. If ref becomes stale, re-auth in DeleteAccount could fail silently
- Files: `src/context/PhoneAuthContext.js`, `src/screens/DeleteAccountScreen.js`, auth flow screens
- Current mitigation: Context provider stores ref; DeleteAccount accesses via context
- Recommendations: Add guard checks to verify confirmationRef is still valid before use; log if ref becomes null; implement fallback re-auth flow

**Firebase Storage signed URL 24-hour expiry:**

- Risk: If photos are cached by clients for >24 hours without refresh, URLs silently fail (403) with no automatic recovery
- Files: `src/services/firebase/signedUrlService.js`, all photo display components
- Current mitigation: Signed URLs generated with 24-hour expiry; none documented in code
- Recommendations: Implement automatic URL refresh on 403 response; log expired URL attempts for monitoring; document 24-hour limitation in comments

**Unvalidated Cloud Function request payloads:**

- Risk: Cloud Functions validate payloads with Zod, but client-side has no matching validation. Misconfigured requests could cause silent failures or unexpected server behavior
- Files: `functions/index.js` (validation schemas), `src/services/firebase/` (service calls)
- Current mitigation: Zod validation in cloud functions; errors logged server-side
- Recommendations: Export validation schemas from cloud functions or duplicate in app; validate locally before sending; add request/response logging for debugging

**Email credentials in environment variables:**

- Risk: SMTP credentials stored in `functions/.env` for email sends. If leaked, attacker can send emails as app
- Files: `functions/index.js:getTransporter()` (references SMTP_EMAIL, SMTP_PASSWORD)
- Current mitigation: .env file in .gitignore; EAS secrets for production builds
- Recommendations: Rotate email credentials regularly; implement rate limiting on email sends; monitor for suspicious email activity

**Contact sync stores friend list in AsyncStorage:**

- Risk: If device is compromised, attacker gains access to plaintext friend list in AsyncStorage
- Files: `src/services/firebase/contactSyncService.js`
- Current mitigation: AsyncStorage persists unencrypted on device
- Recommendations: Use secure storage (expo-secure-store) for sensitive contact/friend data; limit what is cached locally

---

## Performance Bottlenecks

**FeedScreen re-renders on every state change:**

- Problem: FeedScreen has 29 useState/useEffect calls managing feed data, animations, and UI state. Changes to any state cause full component re-render
- Files: `src/screens/FeedScreen.js:60-250`
- Cause: State not separated by concern; no useMemo for expensive computations
- Improvement path: Extract state into smaller custom hooks; memoize story grouping; use FlatList key-based diffing

**Album photo grid loads all photos at once:**

- Problem: Album grids load all photos and render in FlatList. With 100+ photos, causes scrolling stutter
- Files: `src/screens/AlbumGridScreen.js`, `src/screens/MonthlyAlbumGridScreen.js`
- Cause: No pagination or virtualization; all photos rendered simultaneously
- Improvement path: Implement cursor-based pagination; use FlatList's `onEndReached` for lazy loading

**CommentsBottomSheet FlatList scrolls unnecessarily:**

- Problem: When opening comments, FlatList auto-scrolls to reply target, causing jank. Multiple setTimeout calls queue up
- Files: `src/components/comments/CommentsBottomSheet.js:414,438,556`
- Cause: Three sequential setTimeout calls to handle scroll positioning
- Improvement path: Consolidate scroll logic into single useEffect; use FlatList's `scrollToIndex` after layout

**Image prefetching blocks render:**

- Problem: Prefetching 10+ image URLs at once on screen enter causes brief render delay
- Files: `src/hooks/usePhotoDetailModal.js:198,221`, `src/screens/FeedScreen.js:501,551`
- Cause: Prefetch called in useEffect with no delay between URLs
- Improvement path: Batch prefetch calls with setImmediate; prefetch only visible images

**Gesture animations on lower-end devices:**

- Problem: Reanimated gesture animations drop frames on Android budget phones
- Files: `src/hooks/useSwipeableCard.js`, `src/hooks/usePhotoDetailModal.js`
- Cause: Unoptimized animated values; complex worklet calculations
- Improvement path: Profile on real Android devices; simplify worklet calculations

**Darkroom batch triage writes large Firestore batch:**

- Problem: Batch write with 50+ documents can hit Firestore write limits
- Files: `src/services/firebase/photoService.js:batchTriagePhotos`, `src/hooks/useDarkroom.js`
- Cause: Single `writeBatch()` with all triage operations
- Improvement path: Split large batches into chunks of 20 documents

---

## Fragile Areas

**PhotoDetailContext state management:**

- Files: `src/context/PhotoDetailContext.js`, `src/screens/PhotoDetailScreen.js`, `src/screens/FeedScreen.js`
- Why fragile: Manages 15+ state variables with ref-based callbacks creating stale closures; easy to forget state reset
- Safe modification: Always reset state in `handleClose`; validate callback refs; add debug logging for state transitions
- Test coverage: No unit tests; only integration tests via screens

**usePhotoDetailModal gesture handling:**

- Files: `src/hooks/usePhotoDetailModal.js:1-600`
- Why fragile: Complex gesture worklet with 4 animated values; small math changes break swiping
- Safe modification: Test on actual device; add visual debug overlay; implement gesture replay
- Test coverage: No tests; only manual testing

**Darkroom reveal timing system:**

- Files: `src/services/firebase/darkroomService.js`, `src/hooks/useDarkroom.js`, `functions/index.js:revealUserPhotos`
- Why fragile: Three reveal triggers can race; missing reveal if app crashes
- Safe modification: Add comprehensive logging; centralize logic; implement idempotent reveals
- Test coverage: No unit tests; only manual testing

**Album cascade delete operations:**

- Files: `src/services/firebase/albumService.js`, `src/screens/RecentlyDeletedScreen.js`
- Why fragile: Deleting album requires multi-collection updates; orphaned references if operation fails
- Safe modification: Use Firestore transactions; validate cascade before committing
- Test coverage: No tests; tested manually

**Contact sync AsyncStorage persistence:**

- Files: `src/services/firebase/contactSyncService.js`, `src/screens/ContactsSyncScreen.js`
- Why fragile: No version management; migrating storage format requires migration logic
- Safe modification: Add schema version; implement migration function; add checksums
- Test coverage: No tests

---

## Scaling Limits

**Firestore read/write rates:**

- Current capacity: ~100 DAU (5-10 reads per session)
- Limit: At 10K DAU, feed queries become bottleneck
- Scaling path: Feed caching layer; Firestore read replicas; batch reaction updates

**Firebase Storage bandwidth:**

- Current capacity: ~1000 simultaneous users
- Limit: At 100K DAU, bandwidth costs prohibitive
- Scaling path: Firebase CDN integration; Cloudflare edge caching

**Cloud Functions execution time:**

- Current capacity: <3 seconds for reveal/notification operations
- Limit: Notification batching >50 recipients pushes >10 seconds
- Scaling path: Pub/Sub background tasks; notification queue system

**AsyncStorage on high-volume devices:**

- Current capacity: <50 MB total
- Limit: At 500+ messages, read/write becomes slow (1-2 seconds)
- Scaling path: SQLite migration; streaming message pagination

**Reanimated animation complexity:**

- Current capacity: 2-3 simultaneous animations on iPhone 13+
- Limit: Budget Android phones drop to 30 FPS with multiple animations
- Scaling path: Frame rate detection; animation complexity adaptation

---

## Dependencies at Risk

**React 19.1.0 - Early adoption in mobile context:**

- Risk: Very recent; React Native 0.81 only added experimental support
- Impact: Potential breakage in future updates; memory leaks or reconciliation bugs
- Migration plan: Monitor React/RN release notes; test thoroughly before updates

**Expo SDK 54 - Near end-of-life:**

- Risk: Unsupported in ~6 months; Firebase SDK also approaching major bump
- Impact: Security patches stop; new device models may not be supported
- Migration plan: Plan upgrade to Expo 56+ by Q3 2026

**react-native-reanimated 4.1.1 - Complex dependency:**

- Risk: Native code; breaking Worklet API changes between versions
- Impact: App crashes if Worklet compilation fails; performance regressions
- Migration plan: Test every update in development build before production

**@react-native-firebase/app 23.8.6 - Breaking changes between versions:**

- Risk: Major versions introduce breaking API changes
- Impact: API compatibility breaks; functions fail silently
- Migration plan: Lock versions; test migration before committing

**patch-package - Brittle workarounds:**

- Risk: Patches are fragile; bug fixes in dependencies won't auto-apply
- Impact: Accumulating patches create version management debt
- Migration plan: Document patches; review quarterly; contribute upstream fixes

---

## Missing Critical Features

**No automatic photo upload retry on network failure:**

- Problem: Offline captures lost if app force-closes; upload queue tries once
- Blocks: Can't guarantee photo delivery in poor network
- Fix approach: Exponential backoff retries; UI notification of stuck uploads

**No optimistic updates for reactions/comments:**

- Problem: 200-500ms delay on reactions; 1-2 second delay on comments
- Blocks: App feels laggy; poor perceived responsiveness
- Fix approach: Optimistic UI updates; rollback on error

**No message read receipts:**

- Problem: Can't tell if DM was read; one-way only
- Blocks: No "delivered" vs "read" status users expect
- Fix approach: readAt timestamp; real-time updates via onSnapshot

**No notification preferences fine-tuning:**

- Problem: Can only toggle on/off globally; no per-type preferences
- Blocks: Active users get bombarded
- Fix approach: Granular notification toggles in user document

**No search functionality:**

- Problem: Can't search friends, photos, or messages
- Blocks: Impossible to find specific content with large datasets
- Fix approach: Algolia or Meilisearch integration

---

## Test Coverage Gaps

**Untested Firebase operations:**

- What's not tested: Photo creation with upload, batch triage, reveal timing, comment mentions
- Files: `src/services/firebase/photoService.js`, `src/services/firebase/commentService.js`, `src/hooks/useDarkroom.js`
- Risk: Silent failures in critical operations
- Priority: **High**

**No integration tests for screen flows:**

- What's not tested: Auth flow, feed loading, photo detail modal
- Files: `src/screens/` (all screens), navigation
- Risk: Navigation bugs, state mismatches undetected
- Priority: **High**

**Untested gesture interactions:**

- What's not tested: Swipe gestures, pan responder interactions
- Files: `src/hooks/usePhotoDetailModal.js`, `src/hooks/useSwipeableCard.js`, `src/components/CommentsBottomSheet.js`
- Risk: Gesture bugs only found on real devices
- Priority: **Medium**

**No Android-specific device testing:**

- What's not tested: Layout on actual phones, EXIF crop math, keyboard behavior
- Files: `src/screens/ProfilePhotoCropScreen.android.js`, `src/hooks/useCamera.android.js`
- Risk: Android users experience layout bugs, crop errors
- Priority: **High**

**No performance/memory leak tests:**

- What's not tested: Memory usage with 500+ photos, leak detection
- Files: `src/screens/FeedScreen.js`, `src/hooks/usePhotoDetailModal.js`
- Risk: Long-term memory leaks accumulate
- Priority: **Medium**

---

_Concerns audit: 2026-02-23_
