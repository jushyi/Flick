# Codebase Concerns

**Analysis Date:** 2026-01-26

## Tech Debt

**Client-side sorting for feed queries:**

- Issue: Feed photos sorted client-side to avoid Firebase composite index requirement
- Files: `src/services/firebase/feedService.js` (lines 86-90, 164-168)
- Why: Simplifies Firebase setup, avoids index management
- Impact: All photos fetched before filtering/sorting; inefficient for large datasets
- Fix approach: Create composite index on `photoState` + `capturedAt` in `firestore.indexes.json`, use `orderBy` in queries

**N+1 query pattern in feed:**

- Issue: Each photo fetches its user data individually in a loop
- Files: `src/services/firebase/feedService.js` (lines 56-76, 134-154)
- Why: Firestore doesn't support JOINs; done for simplicity
- Impact: Multiple Firestore reads per feed load; latency increases with photo count
- Fix approach: Batch user lookups or cache user data locally; consider denormalization

**Scheduled function runs every 2 minutes:**

- Issue: `processDarkroomReveals` Cloud Function runs frequently regardless of pending reveals
- Files: `functions/index.js` (line 104)
- Why: Ensures timely reveals without complex scheduling
- Impact: Potential cost at scale; unnecessary function invocations
- Fix approach: Use Cloud Tasks for scheduled per-user reveals instead of polling

## Known Bugs

**No known critical bugs at this time.**

The codebase appears stable based on analysis. Previous bugs documented in CLAUDE.md have been resolved.

## Security Considerations

**FCM tokens stored in user documents:**

- Risk: If user document is compromised, push token could be used to spam notifications
- Files: `src/services/firebase/notificationService.js`, Firestore `users/{userId}/fcmToken`
- Current mitigation: Firestore rules restrict access to user's own document
- Recommendations: Consider separate secure collection for tokens; rotate tokens periodically

**Photo URLs are public Firebase Storage URLs:**

- Risk: Anyone with URL can access photos (URLs don't expire by default)
- Files: Photo documents contain `imageURL` field pointing to Storage
- Current mitigation: `getSignedPhotoUrl` Cloud Function exists for secure access
- Recommendations: Migrate to signed URLs for all photo access; implement per-user access control

**Client-side friend filtering:**

- Risk: All journaled photos are fetched before client-side filtering by friend list
- Files: `src/services/firebase/feedService.js` (lines 79-83)
- Current mitigation: Firestore rules restrict photo reads (verify this)
- Recommendations: Server-side filtering if sensitive; verify Firestore rules are strict

## Performance Bottlenecks

**Feed load fetches all journaled photos:**

- Problem: Query fetches all `photoState == 'journal'` photos, then filters client-side
- Files: `src/services/firebase/feedService.js` (line 52)
- Measurement: Not measured; concern at scale
- Cause: Avoiding composite indexes; friend filtering done client-side
- Improvement path: Use `where-in` query with friend IDs (limited to 30), or paginate with cursor

**Story data fetches all photos per friend:**

- Problem: `getFriendStoriesData` fetches ALL photos for each friend
- Files: `src/services/firebase/feedService.js` (lines 472-477)
- Measurement: Not measured; scales with friend count × photos per friend
- Cause: Need all photos for story viewer
- Improvement path: Limit to recent photos (e.g., last 30 days); lazy load older

## Fragile Areas

**Darkroom reveal timing:**

- Files: `src/services/firebase/darkroomService.js`, `functions/index.js`
- Why fragile: Depends on Cloud Function running on schedule + Firestore triggers
- Common failures: Delayed reveals if function cold starts; duplicate notifications possible
- Safe modification: Test with emulator; verify idempotency
- Test coverage: `darkroomService.test.js` covers service; function tests limited

**Navigation deep linking:**

- Files: `src/navigation/AppNavigator.js`, `App.js` (notification handling)
- Why fragile: Complex nested navigator params; timing-dependent
- Common failures: Params not propagating to nested screens; navigation before ready
- Safe modification: Test all deep link scenarios manually
- Test coverage: Not tested (manual only)

## Scaling Limits

**Firebase free tier:**

- Current capacity: 50K daily reads, 20K writes, 1GB Firestore storage
- Limit: ~1000 active users estimated before hitting limits
- Symptoms at limit: Quota exceeded errors, failed operations
- Scaling path: Upgrade to Blaze plan (pay-as-you-go)

**Cloud Function cold starts:**

- Current capacity: Functions may cold start after idle period
- Limit: Cold start adds 1-3s latency
- Symptoms at limit: Delayed notifications, slow scheduled reveals
- Scaling path: Use min instances (costs money); optimize function size

## Dependencies at Risk

**React 19.1.0:**

- Risk: Very recent major version; ecosystem compatibility uncertain
- Impact: Third-party libraries may not be fully compatible
- Migration plan: Monitor for issues; be prepared to pin to 18.x if needed

**@giphy/react-native-sdk:**

- Risk: Niche SDK; update frequency unknown
- Impact: GIF picker feature depends entirely on this
- Migration plan: Could fallback to Giphy web API if SDK becomes unmaintained

## Missing Critical Features

**Error tracking/monitoring:**

- Problem: No production error tracking (Sentry planned for Phase 10)
- Files: `src/utils/logger.js` (line 218), `src/components/ErrorBoundary.js` (line 63)
- Current workaround: Errors logged to console only
- Blocks: Can't monitor production issues, crash reporting
- Implementation complexity: Low (Sentry SDK integration is straightforward)

**Offline support:**

- Problem: App requires network connectivity; no offline queue
- Files: All Firebase service calls assume connectivity
- Current workaround: None; operations fail silently or with errors
- Blocks: Poor UX in low-connectivity situations
- Implementation complexity: Medium (Firestore has offline persistence, but UI needs handling)

## Test Coverage Gaps

**Component tests:**

- What's not tested: React components have no unit tests
- Risk: UI regressions undetected
- Priority: Low (screens are simple, business logic in services)
- Difficulty to test: Medium (need React Testing Library setup)

**Cloud Functions:**

- What's not tested: `functions/index.js` has no automated tests
- Risk: Function bugs could break notifications, reveals
- Priority: Medium (critical functionality)
- Difficulty to test: Medium (need Firebase emulator setup)

**Navigation flows:**

- What's not tested: Deep linking, tab navigation, auth flow routing
- Risk: Broken navigation after changes
- Priority: Medium (affects UX significantly)
- Difficulty to test: Medium (need Detox or similar E2E framework)

## TODOs in Codebase

**Sentry integration (3 occurrences):**

- `src/utils/logger.js:218` - TODO: In Phase 10, send to Sentry
- `src/utils/logger.js:242` - TODO: In Phase 10, send to Sentry
- `src/components/ErrorBoundary.js:63` - TODO: In Phase 10, send to Sentry

---

_Concerns audit: 2026-01-26_
_Update as issues are fixed or new ones discovered_
