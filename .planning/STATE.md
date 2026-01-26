# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-25)

**Core value:** Instant, delightful photo capture and reveal experience - photos capture without blocking, triage flows like flipping through a deck of cards, and every interaction feels responsive with haptic feedback.
**Current focus:** v0.7 Rewind Rebrand & Feed Overhaul - transform identity to Rewind, overhaul feed experience

## Current Position

Phase: 36 of 39 (Comments Feature)
Plan: 3 of 6 in current phase (+ 36-03-FIX, 36-03-FIX-2, 36-03-FIX-3 complete)
Status: In progress
Last activity: 2026-01-26 - Completed 36-03-FIX-3.md (UAT Round 4 fixes)

Progress: ████████░░ 80%

## Performance Metrics

**Velocity:**

- Total plans completed: 126 (8 in v0.1 + 8 in v0.2 + 4 in v0.3 + 17 in v0.4 + 37 in v0.5 + 26 in v0.6 + 26 in v0.7)
- Average duration: 16 min
- Total execution time: 22.1 hours (4.3h v0.1 + 2.1h v0.2 + 0.7h v0.3 + 1.4h v0.4 + 5.8h v0.5 + 4.6h v0.6 + 198m v0.7)

**By Milestone:**

| Milestone | Phases  | Plans | Execution Time |
| --------- | ------- | ----- | -------------- |
| v0.1      | 1-5     | 8     | 4.3 hours      |
| v0.2      | 6-8     | 8     | 2.1 hours      |
| v0.3      | 9-10    | 4     | 42 min         |
| v0.4      | 11-14   | 17    | 136 min        |
| v0.5      | 15-18.6 | 37    | 390 min        |
| v0.6      | 19-29   | 26    | 311 min        |

## Accumulated Context

### Decisions

All decisions documented in PROJECT.md Key Decisions table with outcomes.

| Phase         | Decision                                              | Rationale                                                                            |
| ------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 17-02         | Gesture.Pan() API for swipe gestures                  | useAnimatedGestureHandler deprecated in Reanimated v4                                |
| 17-02         | View-based icons for overlays                         | Cleaner look than emoji, consistent styling                                          |
| 17-FIX        | Removed down-swipe delete gesture                     | Prevents accidental deletions during horizontal swipes                               |
| 17-FIX        | Fixed arc path formula (y = 0.4 \* \|x\|)             | Predictable card motion regardless of finger movement                                |
| 17-FIX-2      | Stack offset -20/-40px for visible peek               | Cards visibly peek from top at rest                                                  |
| 17-FIX-2      | Animation duration 400ms                              | Balances visibility with responsiveness                                              |
| 17-FIX-3      | Dark overlay for stack blur effect                    | Animatable alternative to blurRadius                                                 |
| 17-FIX-4      | Cascading prop for parallel animation sync            | Stack cards animate during exit, not after                                           |
| 17-FIX-6      | BUTTON_EXIT_DURATION 1200ms (3x swipe)                | Button taps feel instant without lead-in time                                        |
| 17.1-01       | Inline success state instead of separate screen       | Eliminates jarring navigation jump                                                   |
| 17.1-01       | Sparkles instead of confetti                          | Subtle celebration effect per user feedback                                          |
| 17.1-01-FIX   | pendingSuccess state for transition timing            | Prevents empty state flash before success                                            |
| 17.1-01-FIX   | Header-only swipe gesture                             | Avoids conflicts with photo triage gestures                                          |
| 17.1-01-FIX-2 | Screen-level translateY animation                     | Header swipe moves entire screen together                                            |
| 17.1-01-FIX-3 | Transparent GestureHandlerRootView                    | Prevents double-background during swipe                                              |
| 17.1-01-FIX-3 | goBack() for Done button                              | Consistent slide-down close animation                                                |
| 17.1-01-FIX-4 | Remove header swipe feature                           | Feature unnecessary, chevron/Done buttons sufficient                                 |
| 17.1-01-FIX-4 | isButtonDelete flag for overlay                       | Delete overlay only shows during button-triggered delete                             |
| 18-01         | In-memory pendingReactions for debouncing             | Simple, effective for single-instance Cloud Functions                                |
| 18-01         | Sliding window debounce (10s)                         | Each new reaction resets timer for better batching                                   |
| 18-02         | Red dot indicator vs count badge                      | Simpler, Instagram-style notification indicator                                      |
| 18.1-02       | Done button only on success screen                    | Cleaner triage UX without header clutter                                             |
| 18.1-02       | Ionicons for Undo button                              | Native look, no count display                                                        |
| 18.1-FIX-2    | Hidden state tracking vs array mutation               | Prevents React re-renders that cause black flash                                     |
| 18.1-FIX-2    | cascadeHandledTransition flag                         | Prevents double-animation during cascade                                             |
| 18.1-FIX-3    | expo-image instead of RN Image                        | Native caching + 200ms transition eliminates black flash                             |
| 18.1-FIX-3    | Remove blur overlay workaround                        | expo-image transition prop handles this automatically                                |
| 18.1-FIX-4    | Smoother spring config (damping: 18, stiffness: 100)  | Gradual settling instead of snappy bounce                                            |
| 18.1-FIX-4    | 100ms delay for front card transition                 | Exiting card clears space before next card settles                                   |
| 18.1-FIX-4    | 300ms fade-in for new stack cards                     | New back cards appear smoothly instead of abruptly                                   |
| 18.1-FIX-5    | Single stackIndex useEffect for animation             | Eliminates race condition between cascading and stackIndex useEffects                |
| 18.1-FIX-5    | Timing over spring animation (350ms)                  | Predictable cascade motion without mid-flight interruptions                          |
| 18.1-FIX-6    | isTransitioningToFront flag for cardStyle             | Keeps using stackOffsetAnim during transition before switching to gesture transforms |
| 18.2-01       | Fire-and-forget playSuccessSound()                    | No await to avoid blocking UI animation                                              |
| 18.2-01       | Auto-unload on playback finish                        | Prevents memory leaks from audio playback                                            |
| 18.3-01       | Callback on cardScale not translateX                  | translateX was 0→0 (instant), cardScale is 1→0.1 (actual animation)                  |
| 18.3-01       | actionInProgress override in cardStyle                | Ensures delete suction works even during card transition                             |
| 18.3-01       | Easing.in(cubic) for suction                          | Accelerating "pulled in" feel instead of decelerating                                |
| 18.4-01       | Exponential power curve (x^2.5) for arc               | Cards start flat, accelerate downward as they exit                                   |
| 18.4-01       | Linear rotation preserved                             | User preferred original tilt feel over exponential                                   |
| 18.4-01       | EXIT_DURATION 800ms                                   | Slower animation for smooth arc visibility                                           |
| 18.5-01       | initialRouteName="Camera"                             | Aligns with capture-first philosophy                                                 |
| 18.6-01       | 100ms clearance delay for cascade                     | Instant, fluid triage feel without perceptible gap                                   |
| 20-01         | firebase-functions.logger for Cloud Functions         | Structured logging with Cloud Logging integration                                    |
| 20-01         | DEBUG/INFO filtered in production                     | Zero console noise in production, only WARN/ERROR logged                             |
| 21.1-01       | git-filter-repo for history rewriting                 | GitHub recommended, Python-based (no Java for BFG)                                   |
| 21.1-01       | Force push to overwrite remote history                | Required for complete security remediation                                           |
| 21.2-01       | Sensitive visibility for EAS file env var             | Secret vars not readable during local config resolution                              |
| 21.2-01       | Development environment for active development        | Production env var can be added later when ready                                     |
| 21.3-01       | useRef for non-serializable ConfirmationResult        | Avoids iOS serialization crash in navigation params                                  |
| 21.3-01       | React Context for cross-screen sharing                | Cleaner than navigation params, no serialization                                     |
| 21.3-01-FIX   | New iOS OAuth client for com.spoodsjs.oly             | Old client was for wrong bundle ID (com.lapseclone.app)                              |
| 21.3-01-FIX   | REVERSED_CLIENT_ID in URL schemes                     | Required for Firebase Phone Auth reCAPTCHA callback                                  |
| 22-01         | grep pattern matching for secret detection            | No external dependencies, runs in husky pre-commit                                   |
| 22-01         | .secretsignore for exception handling                 | Allows intentional commits of files matching secret patterns                         |
| 23-01         | affectedKeys().hasOnly() for field-level restrictions | Restricts modifiable fields at security rule level                                   |
| 23-01         | Split photo update into owner/non-owner cases         | Clearer separation of permissions, self-reaction prevention                          |
| 24-01         | z.any() for Firestore Timestamps                      | Timestamps don't serialize cleanly to JSON                                           |
| 24-01         | Guard clauses with null returns                       | Background triggers should never throw                                               |
| 25-01         | AFTER_FIRST_UNLOCK for SecureStore                    | Non-deprecated keychainAccessible constant                                           |
| 25-01         | Skip messaging().deleteToken()                        | Project uses expo-notifications, focus on server-side cleanup                        |
| 25-01         | Firestore FCM cleanup before auth.signOut()           | User loses write permission after signing out                                        |
| 25-02         | v4 signing for Cloud Storage URLs                     | Current standard, max 7 days expiration                                              |
| 25-02         | 24-hour signed URL expiration                         | Balances security with user experience                                               |
| 25-02         | Callable function requires authentication             | No anonymous access to signed URLs                                                   |
| 26-02         | Delete auth user LAST                                 | Maintains permissions during cascade deletion                                        |
| 26-02         | Two friendship queries for deletion                   | Deterministic ID means user can be user1Id OR user2Id                                |
| 26-02         | PhoneAuthProvider always wraps entire app             | Needed for re-authentication when user is already logged in                          |
| 27-01         | jest-expo preset for Expo projects                    | Handles Expo-specific transforms and mocks automatically                             |
| 27-01         | Mock functions defined OUTSIDE jest.mock()            | Prevents "undefined" errors when using mockResolvedValue                             |
| 27-01         | Global exports for mock function assertions           | Allows tests to configure and assert on mock calls                                   |
| 27-03         | Pure function tests without mocks                     | generateFriendshipId tested directly for simplicity                                  |
| 27-03         | photoState === 'journal' filter verified              | Critical test to prevent past 'journaled' bug from recurring                         |
| 27-04         | Pure logic tests for or() query functions             | Complex or() query mocking breaks chains; unit tests cover query logic               |
| 27-04         | File-level Firestore mocks for integration tests      | jest.setup.js mocks incompatible with modular API import pattern                     |
| 28-01         | Hook handles useImperativeHandle internally           | Cleaner forwardRef pattern than passing ref through props                            |
| 28-01         | Constants kept in hook file                           | Component-specific values (thresholds, durations) not global design tokens           |
| 28-02         | Single useCamera hook vs multiple focused hooks       | Camera logic is cohesive; single hook is clearer at a glance                         |
| 28-02         | Layout constants duplicated in hook and styles        | Both need FOOTER_HEIGHT, TAB_BAR_HEIGHT for calculations/positioning                 |
| 28-03         | Single useDarkroom hook for all logic                 | Triage logic is cohesive (undo stack, batch save, hidden photos)                     |
| 28-03         | Component at 277 lines with 4 render states           | 4 distinct render branches (loading, success, empty, main) require more JSX          |
| 28-04         | FeedPhotoCard styles-only extraction                  | Presentational component with no significant state - hook unnecessary                |
| 28-04         | PhotoDetailModal full hook extraction                 | Has PanResponder, animated values, reaction state - warrants full extraction         |
| 28.1-01       | Conditional immutability for imageURL                 | Allow empty→non-empty (initial set), block non-empty→any (tampering)                 |
| 29-01         | Minimal documentation style                           | Match CLAUDE.md tone, no emojis, practical rather than formal                        |
| 30-05         | Purple base with pink fill for hold button            | Creates "anticipation → payoff" visual storytelling in reveal animation              |
| 30-03-FIX     | Defer external dashboard rebranding to TestFlight     | OAuth brand verification is heavyweight for admin-only visibility                    |
| 30-FIX        | Reinitialize EAS with new project for Rewind slug     | Cleaner than renaming old Oly project, avoids potential state issues                 |
| 31-01         | ThemeProvider between ErrorBoundary and AuthProvider  | Theme available to auth screens, follows React context best practices                |
| 32-01         | Friends screens to root stack (not nested in tabs)    | Enables Phase 33 activity page to navigate to Friends screens                        |
| 33-01         | MaterialTopTabNavigator for Activity two-tab layout   | Standard Instagram-style activity page pattern                                       |
| 33-01         | Placeholder tabs for Phase 33-02 implementation       | Allows incremental delivery without blocking navigation wiring                       |
| 33-02         | ScrollView with sections for Activity tabs            | Mixed content (requests + reactions) better than FlatList                            |
| 33-02         | useFocusEffect for mark-as-read trigger               | Marks notifications read when NotificationsTab gains focus                           |
| 33-02         | Batch Firestore updates for mark-as-read              | Efficient update of multiple notification documents                                  |
| 34-01         | Polaroid frame: cream (full contrast)                 | Classic Polaroid look that pops against dark theme (#0F0F0F)                         |
| 35-01         | blurRadius={20} for photo blur                        | React Native built-in, no expo-blur dependency needed                                |
| 35-01         | Dark frame (#2A2A2A) for story cards                  | Blends with dark theme, contrasts with gradient glow                                 |
| 35-01         | Reuse brand.gradient.developing for glow              | DRY principle, consistent with darkroom reveal colors                                |
| 34.1-01       | Pure black background (#000000) for feed              | Match stories section, seamless visual consistency                                   |
| 34.1-01       | Edge-to-edge photos (no card margins)                 | Instagram-style modern aesthetic, photos dominate                                    |
| 35-02         | 24-hour expiry for viewed state                       | Daily reset so users see friend stories again                                        |
| 35-02         | Mark as viewed on modal close (not open)              | Ensures user actually viewed content before marking                                  |
| 35-03         | MIN_REACTIONS_FOR_HOT = 2 for hot feed                | Low threshold for MVP, can increase as engagement grows                              |
| 35-03         | Stories open to first unviewed photo                  | User-requested UX improvement for resume position                                    |
| 35-03         | Mark all photos viewed on stories close               | Simpler UX - next open always starts fresh from beginning                            |
| 34.2-01       | Story cards 88x130 rectangular with profile at bottom | User wanted bigger, more rectangular cards like Instagram stories                    |
| 34.2-01       | Feed cards retain horizontal infoRow layout           | User preferred original format over overlapping profile design                       |
| 34.2-01       | Flexbox centering for overlapping elements            | Percentage-based centering was off; flexbox (left:0, right:0) is more reliable       |
| 35.1-01       | Single PhotoDetailModal with mode prop                | Reduces code duplication vs maintaining two separate modal components                |
| 35.2-01       | HEADER_HEIGHT = 68, TAB_BAR_HEIGHT = 88               | Based on padding and iOS safe area calculations                                      |
| 35.2-01       | clamp extrapolation for header animation              | Prevents header from moving beyond bounds on bounce scroll                           |
| 35.2-01       | Progress bar at bottom of modal                       | Natural info hierarchy: user info → progress → reactions                             |
| 35.3-01       | Instant cut vs fade for story photos                  | User preferred snappy feel over smooth 200ms transition                              |
| 35.3-01       | Ring color based on ALL photos viewed                 | Modal open doesn't mean content was seen; photo-level tracking is accurate           |
| 35.4-01       | Fetch ALL journal photos instead of top 5             | Show complete content in stories, not just engagement-ranked subset                  |
| 35.4-01       | Chronological order (oldest first) for stories        | Natural timeline viewing experience                                                  |
| 35.4-01       | useRef for synchronous state access                   | React setState is async; ref provides immediate access for resume calculation        |
| 35.4-01       | Mark friend viewed only when ALL photos seen          | Accurate ring color (gradient until complete, then gray)                             |
| 35.4-01-FIX   | Firestore subcollection for viewed state              | Per-user persistence, survives account switch, works across devices                  |
| 35.4-01-FIX   | Dynamic segment width with auto-scroll                | Handles any photo count while keeping segments visible                               |
| 35.4-01-FIX   | 80ms minimum display time for rapid taps              | User sees each photo briefly during rapid tapping                                    |
| 35.4-01-FIX   | 3D cube rotation for friend transitions               | Instagram-style visual feedback for context change                                   |
| 35.4-01-FIX   | Progress bar matches footer padding (16px)            | Visual consistency between progress bar and emoji pills                              |
| 35.5-01       | Progress bar/footer aligned with photo (8px padding)  | Matches photo marginHorizontal for consistent alignment                              |
| 36-03-FIX     | wasVisible ref for visibility transition tracking     | Only apply initialShowComments on false->true modal transition                       |
| 36-03-FIX     | Dynamic maxHeight removal when keyboard visible       | Keyboard.addListener with platform-specific events for proper avoidance              |
| 36-03-FIX     | TouchableWithoutFeedback only in stories mode         | Feed mode needs clean touch propagation to footer comment button                     |
| 36-03-FIX     | 4-second rotation with 200ms fade for comment preview | Readable interval, smooth transitions between rotating comments                      |
| 36-03-FIX-2   | 2-second rotation for comment preview                 | User preference for snappier feel                                                    |
| 36-03-FIX-2   | showViewAll prop for context-specific control         | Modal vs feed need different UX                                                      |
| 36-03-FIX-2   | Dynamic userInfoOverlay bottom (140/100)              | Adjust spacing based on comment presence                                             |

### Deferred Issues

- TestFlight submission (requires App Store Connect setup)
- ISS-002: External dashboard rebranding (Firebase, Google Cloud, Expo) - batch with TestFlight prep

### Blockers/Concerns

None.

### Shipped Milestones

- **v0.1** Camera/Darkroom UX Refactor: 5 phases, 8 plans - shipped 2026-01-12
- **v0.2** Phone Authentication: 3 phases, 8 plans - shipped 2026-01-19
- **v0.3** Firebase SDK Consolidation: 2 phases, 4 plans - shipped 2026-01-19
- **v0.4** Production Ready: 8 phases, 17 plans - shipped 2026-01-20
- **v0.5** Camera Performance & UX Polish: 22 phases, 37 plans - shipped 2026-01-23
- **v0.6** Code Quality, Security & Documentation: 15 phases, 26 plans - shipped 2026-01-25

**Total:** 55 phases, 100 plans, 18.9 hours execution time across 6 milestones

### Roadmap Evolution

- Milestone v0.6 complete: Code quality, security hardening, and documentation - shipped 2026-01-25
- 4 phases inserted during v0.6: 21.1, 21.2, 21.3 (security/auth fixes), 28.1 (Firestore rules fix)
- Version scheme changed from v1.x to v0.x (v1.0 reserved for TestFlight release)
- Milestone v0.7 created: Rewind rebrand & feed overhaul, 8 phases (Phase 30-37)
- Phase 34.1 inserted after Phase 34: Instagram-style full-width feed cards (URGENT) - replaces Polaroid design
- Phase 34.2 inserted after Phase 34.1: Feed & Stories UI Refinements (URGENT) - stories scroll behavior, card redesign with profile overlay
- Phase 35.1 inserted after Phase 35: Unified Photo Modal (URGENT) - identical appearance for stories/feed, story segments only in stories mode, feed photos don't trigger viewed
- Phase 35.2 inserted after Phase 35.1: Feed Header & Bottom Padding (URGENT) - black header, scroll-hide behavior, bottom padding for tab bar
- Phase 35.3 inserted after Phase 35.2: Stories Performance & View State Fix (URGENT) - clunky story navigation, incorrect view state tracking
- Phase 35.4 inserted after Phase 35.3: Stories Feed Data & Resume Fix (URGENT) - missing journaled photos from friends, incorrect story ordering, resume tracking broken
- Phase 35.5 inserted after Phase 35.4: Feed Layout Polish (URGENT) - align progress bar/emoji footer to photo width, remove "Feed" header for seamless transition
- Phase 37.1 inserted after Phase 37: Darkroom Visual Feedback (URGENT) - gradient button indicator for readiness state, swipe-to-reveal gesture for bottom sheet
- Phase 37.2 inserted after Phase 37.1: Stories Thumbnail Flash Fix & Feed Skeleton Update (URGENT) - fix stories thumbnails flashing gray on modal dismiss, update feed loading skeleton

## Session Continuity

Last session: 2026-01-26
Stopped at: Completed 36-03-FIX-3.md (UAT Round 4 fixes)
Resume file: None - ready for verification or 36-04-PLAN.md
