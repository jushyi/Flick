# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** All three areas (login/signup flow, profile creation onboarding, profile screen) must be solid and functional — the app's first impression and personal identity depend on it.
**Current focus:** v1.0.0 Release Readiness — Performance, testing, and iOS release

## Current Position

Phase: 52 of 53 (Systematic UAT)
Plan: 10 of 10 in current phase
Status: Complete
Last activity: 2026-02-27 - Completed quick task 4: fix blank profile photos in Friends Request search results

Progress: █████████████ 13/13 (v1.0.0 phases)

## Performance Metrics

**v1.6 Milestone:**

- Total plans completed: 108 (including 18 FIX plans)
- Total phases: 45 (31 integer + 14 decimal)
- Average duration: 10 min/plan
- Total execution time: 1,076 min (~18 hours)
- Timeline: 16 days (2026-01-20 → 2026-02-06)
- Commits: 1,229
- Codebase: 40,354 lines JavaScript/JSX

**v0.9.0 Milestone:**

- Total plans completed: 30 (27 + 3 FIX)
- Total phases: 14
- Timeline: 4 days (2026-02-06 → 2026-02-10)
- Commits: 138
- Codebase: 57,005 lines JavaScript/JSX

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full history.

| Phase   | Decision                                                  | Rationale                                                             |
| ------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| 46.1    | OtherUserProfile card instead of fullScreenModal          | fullScreenModal prevents child card screens from pushing on iOS       |
| 47      | Custom code traces, not startScreenTrace()                | startScreenTrace() crashes on iOS                                     |
| 47      | **DEV** guard skips trace creation entirely               | Prevent polluting production metrics with dev data                    |
| 47.1    | Direct set intersection for mutual friend tagging         | Simpler/cheaper than friends-of-friends graph traversal               |
| 47.1    | Inline overlay (not Modal/Portal) for mention suggestions | CommentsBottomSheet uses Animated.View — Modal breaks layering        |
| 48      | Callback pattern for SongSearch navigation                | Preserves source screen local state; matches ProfilePhotoCrop         |
| 48      | Edge masks for directional overflow clipping              | RN lacks overflow-x/y; opaque masks clip H while allowing V           |
| 47.1    | requestAnimationFrame for Text.onPress navigation         | Text.onPress vs TouchableOpacity.onPress differ in Animated.View      |
| 48      | Modal screens skip paddingTop: insets.top                 | presentation: 'modal' already offsets from status bar on iOS          |
| 49      | --legacy-peer-deps for RNTL v13 install                   | react-test-renderer deprecated in React 19, RNTL makes it optional    |
| 48.1    | fullScreenModal for ProfileFromPhotoDetail                | iOS modal stacking: fullScreenModal renders above transparentModal    |
| 48.1    | Accept slide-from-bottom + no gesture dismiss             | Native iOS modal behavior, user confirmed acceptable trade-off        |
| 50      | APP_ENV env var for aps-environment switching             | Dynamic config in app.config.js, production set via eas.json env      |
| 50      | expo export for free PR bundle verification               | No EAS build credits consumed, validates JS bundle compiles           |
| 50      | Developer role (not Admin) for EXPO_TOKEN robot           | Minimum necessary permissions for EAS Build/Submit                    |
| 50.1    | Sequential test runner (&&) not Jest projects             | Two suites have incompatible presets (jest-expo vs node)              |
| 50.1    | Local service mocks, not global for block/album           | Global mocks break those services' own test suites                    |
| 50.1    | Prioritize service tests over integration tests           | Service tests verify core logic; integration test failures deferred   |
| 51      | Bundle ID rebrand: com.spoodsjs.rewind → flick            | Production Firebase setup + App Store release preparation             |
| 51      | EAS env vars for Firebase project switching               | Build profiles set GOOGLE_SERVICES_PLIST path deterministically       |
| 51      | Firebase region us-central1 for production                | Default region, best availability, lowest cost (cannot change)        |
| 51      | supportsTablet: false (iPad disabled)                     | Phone-only by design, avoids iPad review risk and UI complexity       |
| 51-04   | Domain: flickcam.app                                      | Short, memorable, ties to camera concept, .app TLD is professional    |
| 51-04   | Google Workspace instead of email forwarding              | Professional email, Firebase/GCP integration, can send from domain    |
| 51-04   | New iOS OAuth 2.0 Client ID for production                | Phone auth reCAPTCHA needs production project OAuth credentials       |
| 51-05   | Fire-and-forget email for reports                         | Email failure logged but doesn't prevent report submission            |
| 51-05   | Gmail SMTP for Cloud Functions email                      | Simplest approach for single-developer app, uses App Password         |
| 51-09   | App name: Flick - Photo Journal                           | Base name "Flick" taken on App Store, hyphenated version available    |
| 51-09   | EU trader status: Non-Trader                              | Individual developer, not registered business                         |
| 51-09   | Age rating: 12+                                           | User-generated content with infrequent/mild profanity                 |
| 51-09   | Defer screenshot capture until pre-submission             | Allows UI polish before captures; infrastructure ready now            |
| 51-10   | Defer production build/submit to UAT                      | Systematic testing on TestFlight before App Review submission         |
| 52.1    | 30-second batching window for reactions                   | Better aggregation than 10s, balances responsiveness vs efficiency    |
| 52.1    | Firestore-based batching state                            | Persists across stateless Cloud Function instances, prevents dupes    |
| 52.1    | Cloud Tasks for delayed execution                         | Reliable delayed sends in serverless (replaces setTimeout)            |
| 52.1    | User data fetching at send time                           | Respects preference changes during 30-second batch window             |
| 52-03   | Clear expo-image cache on sign out                        | Prevents stale gray photos when user re-authenticates                 |
| 52-03   | perf.dataCollectionEnabled instead of modular function    | setPerformanceCollectionEnabled not exported in RN Firebase v23       |
| 52-04   | Feed must filter both blocker and blocked-by directions   | Previously only filtered users who blocked you, not users you blocked |
| 52-06   | expo-image cacheKey must include coverPhotoId             | Static albumId-only key served stale cached cover after change        |
| 52-08   | Migrate functions.config() to process.env                 | Runtime Config deprecated March 2026, prevents future deploy failures |
| quick-3 | profileCacheKey uses Firebase Storage token param         | Token is the only URL part that changes on re-upload to same path     |

### Deferred Issues

~~ISS-012: Friends screen N+1 query pattern causes slow initial load~~ → Fixed in Phase 48-04
~~ISS-014: Profile navigation from PhotoDetail renders behind transparentModal~~ → Fixed in Phase 48.1
~~ISS-015: Reaction notification batching broken (Cloud Functions stateless instances causing duplicates)~~ → Fixed in Phase 52.1
~~ISS-016: Photo tagging lag (tag doesn't update without feed refresh)~~ → Fixed in Phase 52.2

**Closed:** ISS-001, ISS-002, ISS-003, ISS-004, ISS-005, ISS-006, ISS-007, ISS-008, ISS-011, ISS-012, ISS-013, ISS-014, ISS-015, ISS-016

### Blockers/Concerns

None.

### Quick Tasks Completed

| #   | Description                                                                                        | Date       | Commit  | Directory                                                                                         |
| --- | -------------------------------------------------------------------------------------------------- | ---------- | ------- | ------------------------------------------------------------------------------------------------- |
| 1   | regression in the keyboard avoiding view for android in the comments input                         | 2026-02-26 | 3ce419d | [1-regression-in-the-keyboard-avoiding-view](./quick/1-regression-in-the-keyboard-avoiding-view/) |
| 2   | skip What's New modal for silent OTA patch (keyboard avoiding view bug fix)                        | 2026-02-26 | d3cb02a | [2-skip-ota-update-modal-for-small-bug-fix-](./quick/2-skip-ota-update-modal-for-small-bug-fix-/) |
| 3   | fix stale profile photo caching — profileCacheKey uses Firebase Storage token                      | 2026-02-26 | fd1b9d2 | [3-investigate-why-for-some-users-viewing-t](./quick/3-investigate-why-for-some-users-viewing-t/) |
| 4   | search results in Friends Request tab show blank photo — profilePhotoURL not mapped in searchUsers | 2026-02-27 | 6643af6 | [4-when-searching-people-in-the-friends-req](./quick/4-when-searching-people-in-the-friends-req/) |

### Roadmap Evolution

- Milestone v1.6 shipped: Auth & Profile Refactor, 31 phases (Phase 1-31)
- Milestone v0.9.0 shipped: Engagement & Polish, 14 phases (Phase 32-45)
- Milestone v1.0.0 created: Release Readiness, 8 phases (Phase 46-53)
- Phase 46.1 inserted after Phase 46: Other Users Albums View Fix (URGENT)
- Phase 46.2 inserted after Phase 46: Album Viewer Nav Bar Optimistic Updates (URGENT)
- Phase 47.1 inserted after Phase 47: Comment @-Tagging for Mutual Friends (URGENT)
- Phase 48.1 inserted after Phase 48: PhotoDetail Profile Navigation Fix — ISS-014 (URGENT)
- Phase 50.1 inserted after Phase 50: Fix Failing Test Suites — 76 tests across 10 suites (URGENT)
- Phase 52.1 inserted after Phase 52: Fix Reaction Notification Batching — ISS-015 (URGENT) — COMPLETE
- Phase 52.2 inserted after Phase 52: Fix Photo Tagging Lag — ISS-016 (URGENT) — COMPLETE

## Session Continuity

Last session: 2026-02-27
Stopped at: Completed quick task 4 (Fix blank profile photos in Friends Request search results)
Resume file: None
Next: Ready for Phase 53 (App Store Release)
