# Codebase Concerns

**Analysis Date:** 2026-01-23

## Executive Summary

The Lapse Clone codebase is **91% feature-complete** (Week 11 of 12) with solid architectural patterns. Key concerns identified:

| Severity | Count | Timeline |
|----------|-------|----------|
| 🔴 Critical | 3 | Before TestFlight |
| 🟡 High | 5 | Week 12 |
| 🟢 Medium | 6 | Post-MVP |

## Tech Debt

**Debug console.log() Statements in Production Code:**
- Issue: 10 `console.log/error()` statements left in production code
- Files:
  - `src/components/SwipeablePhotoCard.js` (6 instances, lines 116, 130, 135, 153, 162, 172) - `[CASCADE DEBUG]` prefix from UAT-006
  - `src/utils/timeUtils.js` (4 instances, lines 55, 81, 112, 150) - `console.error()` in error handlers
- Why: Debug code from animation cascade troubleshooting not removed
- Impact: Noise in production logs, unprofessional
- Fix approach: Remove cascade debug logs, replace `console.error()` with `logger.error()`

**N+1 Query Patterns in Feed/Search:**
- Issue: Multiple Firestore lookups in loops instead of batch operations
- Files:
  - `src/services/firebase/feedService.js` (lines 27-47, 102-122) - 20 `getDoc()` calls for 20 photos
  - `src/screens/UserSearchScreen.js` (lines 109-116) - 10 friendship checks per search
  - `src/screens/FriendsListScreen.js` (lines 61-73) - 50 user lookups for friends list
  - `src/services/firebase/feedService.js` (lines 436-475) - Multiple queries per friend for stories
- Why: Simpler implementation, acceptable for MVP scale (<100 users)
- Impact: Performance degradation at scale (100+ users), increased Firestore reads
- Fix approach: Implement user profile caching or batch operations post-MVP

**Client-Side Feed Sorting:**
- Issue: Feed photos sorted client-side instead of Firestore query
- Files: `src/services/firebase/feedService.js`, `src/hooks/useFeedPhotos.js`
- Why: Avoids manual Firestore composite index creation
- Impact: Performance degradation with 1000+ photos
- Fix approach: Add composite index `(photoState, capturedAt DESC)` if scale requires

**No Test Coverage:**
- Issue: Zero automated tests for entire codebase (11 weeks of development)
- Files: All `src/**/*.js` files lack corresponding tests
- Why: Focus on MVP feature completion, testing deferred
- Impact: Regression risk, manual testing burden
- Fix approach: Add Jest/Vitest, start with critical path tests (auth, photo lifecycle, feed)

**ProfileScreen Photo Gallery "Coming Soon":**
- Issue: ProfileScreen photo gallery feature is a placeholder
- Files: `src/screens/ProfileScreen.js`
- Why: Post-MVP feature, not in Week 1-12 scope
- Impact: Users can't view their own photo history in app
- Fix approach: Phase 2 feature - add photo grid query and component

**Large Component Files:**
- Issue: Some component files exceed 700+ lines
- Files:
  - `src/components/SwipeablePhotoCard.js` (785 lines) - Complex gesture + animation
  - `src/screens/CameraScreen.js` (937 lines) - Camera + zoom management
  - `src/screens/DarkroomScreen.js` (889 lines) - Photo triage + animations
- Why: Complex features accumulated without refactoring
- Impact: Hard to maintain, understand, and modify
- Fix approach: Extract to custom hooks (`useCardAnimation.js`, `useDarkroomState.js`) post-MVP

## Known Bugs

**None currently documented** - Week 9 cleanup resolved previous issues (infinite re-render loop, permission errors).

## Security Considerations

**Missing .env.example Template:**
- Risk: New developers don't know what environment variables to configure
- Files: `.env` exists but `.env.example` is missing
- Current mitigation: Firebase keys documented in CLAUDE.md
- Recommendations: Create `.env.example` with placeholder values:
  ```
  FIREBASE_API_KEY=your_api_key_here
  FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
  FIREBASE_PROJECT_ID=your_project_id
  FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
  ```

**Cloud Functions Missing Input Validation:**
- Risk: Functions process Firestore updates without validating data
- Files: `functions/index.js` (all 3 notification functions)
- Current mitigation: Firestore security rules provide some protection
- Recommendations: Add validation for userId, token format, document existence before processing

**Firestore Security Rules Need Audit:**
- Risk: Security rules may not cover all edge cases
- Files: Firebase Console (Firestore Rules), `docs/DATABASE_SCHEMA.md`
- Current mitigation: Basic rules in place (user can only modify own data)
- Recommendations: Comprehensive security rule audit before production launch

**FCM Tokens Stored Indefinitely:**
- Risk: Expo Push Tokens stored in Firestore never cleaned up
- Files: `src/services/firebase/notificationService.js`, `users/{userId}/fcmToken` field
- Current mitigation: None (tokens become invalid over time)
- Recommendations: Add token cleanup on logout or periodic validation

**No Rate Limiting on Friend Requests:**
- Risk: Users could spam friend requests
- Files: `src/services/firebase/friendshipService.js` (sendFriendRequest)
- Current mitigation: None
- Recommendations: Add client-side throttling or Cloud Functions rate limiting

**Email Validation Regex Too Permissive:**
- Risk: Accepts questionable emails like `a@b.c`
- File: `src/utils/validation.js` line 23
- Pattern: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Current mitigation: Firebase Auth validates server-side
- Recommendations: Improve regex or use validation library post-MVP

## Performance Bottlenecks

**Real-Time Feed Listeners:**
- Problem: Firestore onSnapshot listener fetches entire feed dataset on every update
- Files: `src/services/firebase/feedService.js` (subscribeFeedPhotos)
- Measurement: Not measured yet (acceptable for small user base)
- Cause: onSnapshot doesn't support pagination with live updates
- Improvement path: Windowed real-time updates or polling for older photos

**Image Compression on Capture:**
- Problem: Photos compressed synchronously on UI thread
- Files: `src/screens/CameraScreen.js` (expo-image-manipulator call)
- Measurement: ~500ms-1s delay on older devices
- Cause: Image manipulation is CPU-intensive
- Improvement path: Move to background thread or use Web Worker equivalent

**Feed FlatList with 100+ Photos:**
- Problem: No virtualization limit on FlatList
- Files: `src/screens/FeedScreen.js` (FlatList component)
- Measurement: Not measured yet (acceptable for MVP)
- Cause: Simple implementation, no pagination limits
- Improvement path: Add pagination limit (20 at a time), implement getItemLayout

## Fragile Areas

**Firebase Cloud Functions:**
- Files: `functions/index.js` (3 notification functions)
- Why fragile: Recently deployed (Week 11), minimal error handling, no retry logic
- Common failures: Expo API rate limits, invalid FCM tokens, network timeouts
- Safe modification: Add comprehensive error logging, retry logic with exponential backoff
- Test coverage: Local notifications only, remote untested

**Photo Reveal Timing Logic:**
- Files: `src/services/firebase/darkroomService.js` (batch reveal system)
- Why fragile: Complex timing logic (0-2 hour random intervals), client-side checks
- Common failures: User might miss reveal window if app closed
- Safe modification: Test with different timezones, app states (background, killed)
- Test coverage: Manual testing only

**Deep Linking Navigation:**
- Files: `src/navigation/AppNavigator.js`, `App.js` (notification handlers)
- Why fragile: navigationRef routing, multiple navigation states
- Common failures: Race condition if app not fully initialized when notification tapped
- Safe modification: Add navigation readiness checks before routing
- Test coverage: Manual testing only

**Animation Cascade in SwipeablePhotoCard:**
- Files: `src/components/SwipeablePhotoCard.js` (lines 103-173)
- Why fragile: Complex coordination between shared values, gestures, and callbacks
- Common failures: UAT-005 race condition (fixed), timing issues with onExitClearance
- Safe modification: Keep `CASCADE_DELAY_MS = 0`, use `prevStackIndex` shared value
- Test coverage: Manual UAT testing only

## Scaling Limits

**Firebase Free Tier (Spark Plan):**
- Current capacity: Unlimited reads/writes, 10GB storage, 360MB/day Cloud Functions
- Limit: ~10k monthly active users
- Symptoms at limit: Cloud Functions throttled, notification delays
- Scaling path: Upgrade to Blaze ($25-100/mo for 10k-50k users)

**Expo Push Notification Rate Limits:**
- Current capacity: Unknown (Expo doesn't publish limits)
- Limit: ~1000 notifications/hour per project (estimated)
- Symptoms at limit: Notifications queued or dropped
- Scaling path: Batch notifications, use FCM directly

## Dependencies at Risk

**Firebase SDK 12.7.0:**
- Risk: Major version (v12) released recently, potential breaking changes
- Impact: Auth, Firestore, Storage, Functions - entire backend
- Migration plan: Pin version, test thoroughly before upgrading

**Expo SDK 54:**
- Risk: Expo releases new SDK every 3-4 months with breaking changes
- Impact: Camera, notifications, image manipulator
- Migration plan: Review changelog before upgrading, test all Expo APIs

**React Native 0.81.5:**
- Risk: Frequent breaking changes between versions
- Impact: Core app functionality
- Migration plan: Use Expo's managed upgrade path

## Missing Critical Features

**Remote Push Notification Testing:**
- Problem: Push notifications work locally but not tested end-to-end remotely
- Files: `functions/index.js`, `src/services/firebase/notificationService.js`
- Current workaround: Local notifications tested in Expo Go
- Blocks: Can't verify notification delivery until standalone build
- Implementation: Build standalone app via EAS, test full flow (Week 12 priority)

**Comprehensive Error Handling:**
- Problem: Many error cases show generic "Error" alerts
- Current workaround: Users see vague error messages
- Blocks: Difficult to debug user-reported issues
- Implementation: Improve error messages, add error tracking

**App Icon and Splash Screen:**
- Problem: Using placeholder assets
- Current workaround: Default icons work but unprofessional
- Blocks: Can't submit to App Store without custom assets
- Implementation: Design assets, add to `assets/` (Week 12)

## Test Coverage Gaps

**All Critical Paths Untested:**
- What's not tested: Everything (no test suite exists)
- Risk: Regressions undetected, manual testing burden
- Priority: High
- Difficulty: Medium (need Jest, Firebase Emulators, mocks)

**Priority Testing Needs for Week 12:**
1. Auth flow (signup, login, profile setup, session persistence)
2. Photo lifecycle (capture, upload, darkroom reveal, triage)
3. Friend system (send request, accept, decline, remove)
4. Reactions system (toggle reaction, multi-reaction support)
5. Push notifications (permissions, token storage, deep linking)

## Documentation Gaps

**Complex Animation Code Undocumented:**
- Files: `src/components/SwipeablePhotoCard.js` (lines 103-173)
- What's missing: Why `prevStackIndex` must be shared value, why `CASCADE_DELAY_MS = 0`
- Risk: Future modifications could break cascade timing
- Fix: Add explanatory comments for magic numbers and shared value requirements

**Firebase Security Rules Not In Repo:**
- What's missing: Actual deployed Firestore Security Rules
- Risk: Can't track changes, no version control
- Fix: Export rules to `firestore.rules` file

**API Documentation:**
- What's missing: No JSDoc comments on service functions
- Risk: Hard to understand function contracts
- Fix: Add JSDoc to `src/services/firebase/*.js`

---

## Week 12 Priority Action Items

### 🔴 CRITICAL (Before TestFlight)

1. **Remove Debug Code**
   - Delete 6 `console.log()` from `src/components/SwipeablePhotoCard.js`
   - Replace 4 `console.error()` with `logger.error()` in `src/utils/timeUtils.js`

2. **Test Remote Notifications**
   - Build standalone app with EAS
   - Test all notification types on physical iPhone
   - Verify deep linking works

3. **Create .env.example**
   - Document required Firebase configuration variables

### 🟡 HIGH (Should Address)

4. **Validate Cloud Functions**
   - Add input validation to all 3 notification functions
   - Add null checks on fetched documents

5. **Security Rule Audit**
   - Review Firestore rules in Firebase Console
   - Export to `firestore.rules` file

### 🟢 MEDIUM (Post-MVP)

6. **Performance Optimization**
   - Implement user profile caching
   - Add Firestore composite indexes

7. **Code Refactoring**
   - Extract large files to custom hooks
   - Add documentation to animation code

---

## Codebase Health Assessment

**Overall:** GOOD ✅

**Strengths:**
- Solid architectural patterns (services, context, hooks)
- Comprehensive logging throughout
- Good error handling in services
- Consistent naming conventions
- Clean separation of concerns

**Areas for Improvement:**
- Performance (N+1 queries, caching)
- Code size (large components)
- Testing (zero coverage)
- Documentation (animation logic)

**Ready for TestFlight?** Almost - after addressing critical items above.

---

*Concerns audit: 2026-01-23*
*Update as issues are fixed or new ones discovered*
