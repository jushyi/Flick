# Codebase Concerns

**Analysis Date:** 2026-01-26

## Tech Debt

**Sentry Integration Deferred:**

- Issue: Error tracking sends to console instead of Sentry
- Files: `src/utils/logger.js:218`, `src/utils/logger.js:242`, `src/components/ErrorBoundary.js:63`
- Why: Sentry integration planned for Phase 10
- Impact: Production errors only visible in device/Expo logs
- Fix approach: Implement Sentry SDK integration in logger.js and ErrorBoundary

**Client-Side Friend Filtering:**

- Issue: Feed queries all journaled photos, filters friends client-side
- Files: `src/services/firebase/feedService.js`, `src/hooks/useFeedPhotos.js`
- Why: Firestore doesn't support `in` queries with dynamic friend lists efficiently
- Impact: Fetches more data than needed, potential performance concern at scale
- Fix approach: Denormalize friend IDs into photo documents or use Firebase Extensions

## Known Bugs

_No critical bugs identified during analysis._

## Security Considerations

**Firestore Rules - Comprehensive:**

- Status: Well-implemented security rules in `firestore.rules`
- Features:
  - Self-reaction prevention
  - Immutable field protection on photos
  - Friendship accept restricted to recipient
  - Notification update restricted to read/readAt only
- Last audit: 2026-01-24 (Phase 23)

**Storage Rules:**

- File: `storage.rules`
- Status: Configured for authenticated access
- Recommendation: Verify rules match current requirements

**Environment Variables:**

- Risk: GIPHY_API_KEY in client-side code via @env
- Current mitigation: API key is for public Giphy API (low risk)
- Recommendation: Acceptable for Giphy, avoid adding sensitive keys to client

## Performance Bottlenecks

**Feed Loading:**

- Problem: Fetches all friends' journaled photos, then filters
- Files: `src/services/firebase/feedService.js`, `src/hooks/useFeedPhotos.js`
- Measurement: Not profiled, potential concern with many friends
- Cause: Client-side filtering after Firestore query
- Improvement path: Pagination, denormalization, or Firebase Extensions

**Darkroom Polling:**

- Problem: 30-second interval polling for darkroom count
- File: `src/navigation/AppNavigator.js:76`
- Measurement: Runs every 30 seconds while app active
- Cause: No real-time listener for developing photo count
- Improvement path: Replace polling with Firestore onSnapshot listener

## Fragile Areas

**Cloud Function Debouncing:**

- File: `functions/index.js` (pendingReactions object)
- Why fragile: In-memory state for reaction debouncing
- Common failures: State lost on function cold start
- Safe modification: State is ephemeral by design, handles lost state gracefully
- Test coverage: Manual testing, no automated tests for debounce logic

**Navigation Deep Linking:**

- File: `src/navigation/AppNavigator.js`
- Why fragile: Complex nested navigation with deep link config
- Common failures: Wrong screen navigation on notification tap
- Safe modification: Test deep links manually after changes
- Test coverage: Manual testing only

## Scaling Limits

**Firestore Free Tier:**

- Current capacity: Depends on Firebase plan
- Limit: Document reads/writes per day
- Symptoms at limit: Quota exceeded errors
- Scaling path: Firebase Blaze plan (pay-as-you-go)

**Cloud Functions Cold Starts:**

- Current capacity: Adequate for MVP
- Limit: Cold start latency on first request
- Symptoms at limit: Slow notification delivery
- Scaling path: Keep functions warm, use min instances

## Dependencies at Risk

_No critical dependency risks identified._

All major dependencies are actively maintained:

- @react-native-firebase/\* - Active development
- expo-\* - Expo team maintains
- react-navigation - Active community

## Missing Critical Features

**Sentry Error Tracking:**

- Problem: Production errors not tracked centrally
- Current workaround: Console logging, device logs
- Blocks: Proactive error detection, user impact analysis
- Implementation complexity: Low (SDK integration + logger update)

**Analytics:**

- Problem: No user behavior analytics
- Current workaround: None
- Blocks: Understanding user engagement, feature usage
- Implementation complexity: Medium (choose provider, instrument events)

## Test Coverage Gaps

**Component Tests:**

- What's not tested: React components (screens, UI components)
- Risk: UI regressions undetected
- Priority: Medium
- Difficulty to test: Need React Native Testing Library setup

**Cloud Functions Tests:**

- What's not tested: Firebase Cloud Functions
- Risk: Notification logic errors
- Priority: Medium
- Difficulty to test: Need Firebase emulators or mocking setup

**E2E Tests:**

- What's not tested: Full user flows (capture → reveal → feed)
- Risk: Integration issues between features
- Priority: Low (manual testing currently sufficient)
- Difficulty to test: Need Detox or Maestro setup

## Code Quality Notes

**Positive Patterns:**

- Comprehensive logging throughout services
- Consistent error handling pattern `{ success, data/error }`
- Well-structured service layer
- Security rules thoroughly implemented
- Good separation of concerns

**Areas for Improvement:**

- Add TypeScript for type safety
- Increase test coverage for components
- Document complex business logic in code comments

---

_Concerns audit: 2026-01-26_
_Update as issues are fixed or new ones discovered_
