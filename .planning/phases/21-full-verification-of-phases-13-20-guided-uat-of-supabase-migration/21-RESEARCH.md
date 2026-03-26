# Phase 21: Full Verification of Phases 13-20 - Research

**Researched:** 2026-03-26
**Domain:** Manual UAT regression testing of Supabase migration
**Confidence:** HIGH

## Summary

Phase 21 is a comprehensive manual UAT covering every user flow in the app after the full Supabase migration (phases 13-20). The phase is interactive: Claude presents test cases one at a time, the user runs them on device, reports pass/fail, and failures are fixed inline before continuing. The goal is zero failures across all flows on both iOS and Android against the dev Supabase environment.

A critical finding from research: **32 TODO(20-01) stubs remain across 25 source files.** These are functions that were stubbed out during Phase 20's Firebase removal but never wired to their Supabase service equivalents. Many core flows (feed stories, notifications, account deletion, recently deleted photos, albums, friend suggestions, viewed stories, and more) will fail UAT because these stubs return empty/error responses. The fix-inline workflow from D-08 will handle these, but the planner must anticipate significant inline development work, not just testing.

**Primary recommendation:** Structure the UAT in two plans -- (1) prerequisite gate running `npm test` and cataloging TODO(20-01) stubs, then (2) the guided interactive walkthrough organized as user journeys first, feature-area sweeps second, with fixes applied inline per D-08.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Comprehensive regression suite -- every user flow tested end-to-end on new Supabase stack. Goes beyond Phase 20's migration validation to cover ALL app functionality in final post-Firebase state.
- **D-02:** Both iOS and Android tested with full UAT on each platform. Equal coverage.
- **D-03:** Test the final state only -- don't re-run individual blocked/failed items from Phase 13-14 UATs. Comprehensive regression covers those flows.
- **D-04:** Every user flow tested -- auth, camera, darkroom, feed, stories, profiles, friends, messaging, albums, notifications, settings, blocking, reporting, account deletion. No flows skipped.
- **D-05:** Dev Supabase environment only. Prod testing is separate (Phase 21.1 scope).
- **D-06:** Both migrated data AND fresh seed data tested. Migrated dev Firebase data proves migration pipeline. Fresh accounts prove new user signup on pure Supabase stack.
- **D-07:** Zero failures required. Every test case must pass. No severity-based exceptions.
- **D-08:** Fix inline, re-test. Stop UAT on failure, fix immediately, re-test, then continue. Phase 21 includes both testing AND fixing.
- **D-09:** Claude-guided interactive walkthrough. Claude presents each test case one at a time. User runs on device and reports pass/fail. Claude logs results, handles failures, guides to next test.
- **D-10:** Organization: user journeys first, feature-area gaps second. Start with key end-to-end user journeys, then sweep by feature area for edge cases.

### Claude's Discretion
- Exact user journeys to define (based on app's feature set and common usage patterns)
- Order of feature-area gap testing after journeys complete
- How to structure the fix-and-retest cycle (inline code fix vs creating a quick plan)
- Whether to run `npm test` as a prerequisite gate before starting manual UAT

### Deferred Ideas (OUT OF SCOPE)
- "Set up Supabase phone auth with Twilio SMS provider" -- auth setup, not verification testing. Belongs in Phase 13 scope or infrastructure setup.
</user_constraints>

## Standard Stack

No new libraries needed. Phase 21 is testing and fixing, not building new infrastructure.

### Core (already in project)
| Library | Version | Purpose | Role in Phase 21 |
|---------|---------|---------|-------------------|
| Jest + jest-expo | 29.x | Unit/integration tests | Prerequisite gate (`npm test`) |
| Expo (SDK 54) | 54.x | App runtime | Build and run on device |
| Supabase JS SDK | 2.x | Backend | All services being tested |

### Tools Needed
| Tool | Purpose | Available |
|------|---------|-----------|
| iOS device/simulator | iOS UAT | User provides |
| Android device/emulator | Android UAT | User provides |
| Dev Supabase project | Backend environment | Already configured |

## Architecture Patterns

### UAT Document Structure

Phase 21 produces a `21-UAT.md` file tracking all test results in the established format from phases 13 and 14:

```markdown
### N. Test Case Name
expected: [what should happen]
result: pass | fail | blocked | issue
reported: [user observation if not pass]
severity: [critical | major | minor]
fix: [commit hash or inline description]
```

### User Journey Organization (D-10)

Based on the app's navigation structure and feature set, these are the recommended user journeys:

**Journey 1: New User Onboarding**
Phone input -> OTP verification -> Profile setup -> Selects -> Contacts sync -> Notification permission -> Main app

**Journey 2: Core Photo Lifecycle**
Camera capture -> Darkroom (developing) -> Reveal -> Feed display -> Photo detail -> Triage (journal/archive)

**Journey 3: Social Interactions**
Friend request send -> Accept -> Feed shows friend's photos -> Comment with @mention -> React to photo

**Journey 4: Messaging**
New conversation -> Send text -> Send reaction -> Reply -> Send snap -> View snap -> Read receipts -> Streaks

**Journey 5: Profile & Albums**
Edit profile (photo, name, song) -> Create album -> Add photos -> View album -> Monthly albums -> Recently deleted

**Journey 6: Settings & Account**
Notification settings -> Sound settings -> Privacy/terms -> Blocked users -> Report user -> Delete account -> Cancel deletion

**Journey 7: Stories & Navigation**
Feed stories view -> Swipe between friends -> Photo detail from story -> Profile from photo detail -> Back navigation

### Feature-Area Gap Sweep (after journeys)

After user journeys cover happy paths, sweep these areas for edge cases:

1. **Auth edge cases:** Session persistence across restart, re-auth for sensitive ops
2. **Offline behavior:** App opens with cached data, queue works offline
3. **Real-time:** Feed updates when friend posts, friend request notifications
4. **Platform differences:** Android back button, edge-to-edge, shadows, keyboard
5. **Empty states:** New user with no photos/friends/messages sees skeleton/empty screens
6. **Error states:** Network failure during upload, expired session handling

### Fix-and-Retest Workflow (D-08)

When a test fails:
1. Claude identifies the root cause (often a TODO(20-01) stub)
2. Claude writes the fix inline (no separate plan needed for small fixes)
3. User rebuilds/reloads the app
4. User re-tests the specific flow
5. Claude logs the fix and result
6. Continue to next test

For larger issues (architectural problems, missing Edge Functions), Claude creates a mini-plan within the UAT document.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test case tracking | Custom test runner | 21-UAT.md markdown format | Established pattern from phases 13/14 |
| Regression coverage | Automated E2E suite | Manual guided walkthrough | D-09 specifies Claude-guided interactive format |
| Cross-platform testing | Platform abstraction | Separate iOS/Android passes | D-02 requires equal coverage on both |

## Common Pitfalls

### Pitfall 1: TODO(20-01) Stubs Causing Silent Failures
**What goes wrong:** 32 functions across 25 files are stubbed with no-op implementations returning empty data. Screens appear to "work" but show no data (stories, notifications, albums, etc.).
**Why it happens:** Phase 20 removed Firebase imports but not all Supabase equivalents were wired in.
**How to avoid:** Catalog all TODO(20-01) stubs before starting UAT. When a flow fails, check the stub list first.
**Key files with stubs:**
- `FeedScreen.tsx` -- toggleReaction, getFriendStoriesData, getUserStoriesData, getRandomFriendPhotos
- `NotificationsScreen.tsx` -- notificationService (requestPermission, getToken)
- `ActivityScreen.tsx` -- notificationService mark functions, getUserStoriesData
- `FriendsScreen.tsx` -- getMutualFriendSuggestions, batchGetUsers, hasUserSyncedContacts, subscribeFriendships, getBlockedByUserIds
- `DeleteAccountScreen.tsx` -- accountService
- `RecentlyDeletedScreen.tsx` -- getDeletedPhotos, restoreDeletedPhoto, permanentlyDeletePhoto
- `ProfileScreen.tsx` -- getUserAlbums, getPhotosByIds, deleteAlbum
- `PhotoDetailScreen.tsx` -- updatePhotoTags, subscribePhoto
- `EditProfileScreen.tsx` -- canChangeUsername
- `AppNavigator.tsx` -- notificationService, getContactsPermissionStatus
- `AuthContext.tsx` -- clearLocalNotificationToken
- `useViewedStories.ts` -- viewedStoriesService
- `HelpSupportScreen.tsx` -- submitSupportRequest
- `ContactsSyncScreen.tsx` -- markContactsSyncCompleted
- `ContactsSettingsScreen.tsx` -- contacts permission helpers
- `ReportUserScreen.tsx` -- REPORT_REASONS constant
- `ProfileSetupScreen.tsx` -- cancelProfileSetup
- `screenshotQueueService.ts` -- (TODO 20-08) full screenshotService

### Pitfall 2: Testing Migrated vs Fresh Data Separately
**What goes wrong:** Some flows work with migrated data but fail for new users (or vice versa) due to different data shapes.
**Why it happens:** Migrated data may have legacy field formats; fresh data goes through new code paths.
**How to avoid:** D-06 requires testing both paths. Use the existing dev user for migrated data tests, create a new account for fresh data tests.

### Pitfall 3: Forgetting Android-Specific Behavior
**What goes wrong:** Test passes on iOS, fails on Android due to platform differences (back button, edge-to-edge, keyboard behavior).
**Why it happens:** iOS is the primary development platform.
**How to avoid:** Run the FULL journey suite on both platforms per D-02. Don't skip Android.

### Pitfall 4: OTA Update Not Including Fixes
**What goes wrong:** Inline fixes require rebuilding the dev client to test. OTA updates work for JS changes but not native module changes.
**Why it happens:** Dev builds use expo-dev-client, fixes are JS-only.
**How to avoid:** For JS-only fixes: shake device -> reload. For native changes (unlikely in this phase): new dev build required.

### Pitfall 5: CLEAN-01/CLEAN-02 Still Pending
**What goes wrong:** REQUIREMENTS.md shows CLEAN-01 (remove Firebase packages) and CLEAN-02 (remove Cloud Functions directory) as Pending.
**Why it happens:** These are Phase 20 deliverables that may not be complete yet.
**How to avoid:** Phase 21 tests the app AS-IS. If Firebase packages still exist but are unused, that's fine for UAT. CLEAN-01/CLEAN-02 completion is Phase 21.1's concern.

### Pitfall 6: Edge Functions Not Deployed to Dev
**What goes wrong:** Background jobs (darkroom reveals, streak expiry, snap cleanup) don't run because Edge Functions aren't deployed.
**Why it happens:** Edge Functions need explicit deployment via `supabase functions deploy`.
**How to avoid:** Verify Edge Functions are deployed to dev before starting UAT. Check pg_cron jobs are scheduled.

## Code Examples

### UAT Test Case Format (from Phase 13/14)
```markdown
### N. Test Case Name
expected: Open the Feed tab. Photos from friends load in reverse chronological order. Each photo shows the user's name, timestamp, and photo. Tapping a photo opens PhotoDetail.
result: pass
```

### UAT Test Case with Failure and Fix
```markdown
### N. Stories Data Loads in Feed
expected: Feed screen shows friend stories at the top. Each friend with recent photos shows as a story circle. Tapping opens the stories viewer.
result: fail
reported: "Stories section is empty despite having friends with recent photos"
severity: critical
fix: Wired getFriendStoriesData to feedService.getFriendStories() -- commit abc1234
retest: pass
```

### TODO Stub Resolution Pattern
```typescript
// BEFORE (stub):
// TODO(20-01): toggleReaction - map to supabase equivalent
const toggleReaction = async (..._args: any[]): Promise<any> => ({});

// AFTER (wired to Supabase service):
import { toggleReaction } from '../services/supabase/photoService';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Firebase Firestore | Supabase PostgreSQL | Phases 13-20 | All data access patterns changed |
| Firebase Auth | Supabase Auth OTP | Phase 13 | Phone auth flow rewritten |
| Firebase Storage | Supabase Storage | Phase 13 | URL patterns changed (CDN vs signed) |
| Firebase Cloud Functions | Supabase Edge Functions | Phase 18 | Deno runtime, different deployment |
| Console.log | Logger utility | Pre-existing | Must use logger in any new code |

## Open Questions

1. **How many TODO(20-01) stubs will need full service implementation vs simple wiring?**
   - What we know: 32 stubs across 25 files. Many are likely simple imports from existing Supabase services.
   - What's unclear: Some (e.g., notificationService standalone, viewedStoriesService, accountService) may need new service code.
   - Recommendation: The planner should structure the first plan to catalog and triage stubs before the interactive walkthrough begins.

2. **Are Edge Functions deployed to dev Supabase?**
   - What we know: 6 Edge Functions exist in `supabase/functions/`.
   - What's unclear: Whether they're currently deployed and pg_cron jobs are scheduled.
   - Recommendation: Add a prerequisite check in the first plan.

3. **Can both migrated and fresh accounts coexist in dev?**
   - What we know: Dev has migrated Firebase data. New signups go through Supabase Auth.
   - What's unclear: Whether a new phone number can sign up fresh (Twilio SMS delivery issue noted in 21.1-CONTEXT.md D-03).
   - Recommendation: Test fresh signup early in Journey 1. If Twilio is broken on dev, flag but don't block -- migrated account testing can proceed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.x with jest-expo preset |
| Config file | `jest.config.js` |
| Quick run command | `npm test -- --bail` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map

Phase 21 has no specific requirement IDs -- it validates ALL requirements from phases 13-20. The test map is the UAT document itself (21-UAT.md), which maps every user flow to the underlying requirements.

| Req Category | Flows Covered | Test Type | Automated? |
|-------------|---------------|-----------|------------|
| AUTH-01/02/03 | Journey 1 (onboarding) | manual UAT | No |
| STOR-01/02/03 | Journey 2 (photo lifecycle) | manual UAT | No |
| CORE-01 to CORE-10 | Journeys 2-7 | manual UAT | No |
| MSG-01 to MSG-11 | Journey 4 (messaging) | manual UAT | No |
| JOBS-01 to JOBS-10 | Background verification | manual UAT | No |
| PERF-01 to PERF-11 | Observed during all journeys | manual UAT | No |
| TS-01 to TS-04 | Prerequisite (`npm test`) | automated | Yes |
| CLEAN-03/04/05 | Prerequisite (grep check) | automated | Yes |

### Sampling Rate
- **Pre-UAT gate:** `npm test` must pass (automated)
- **Per fix commit:** `npm test -- --bail` (quick check fixes don't break tests)
- **Phase gate:** All UAT test cases pass on both platforms

### Wave 0 Gaps
None -- existing test infrastructure is sufficient. The UAT is primarily manual.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Scripts, Jest | TBD (check at runtime) | -- | -- |
| Dev Supabase project | All testing | Yes | -- | -- |
| iOS device/simulator | iOS UAT | User provides | -- | -- |
| Android device/emulator | Android UAT | User provides | -- | -- |
| Expo Dev Client | Running app on device | Already built | -- | -- |
| Twilio SMS (dev) | Fresh signup testing | Possibly broken (21.1 D-03) | -- | Use migrated account |

## Sources

### Primary (HIGH confidence)
- Project codebase: 32 TODO(20-01) stubs cataloged via grep
- `21-CONTEXT.md` -- all decisions D-01 through D-10
- `13-UAT.md`, `14-UAT.md` -- established UAT format
- `20-VALIDATION.md`, `20-08-SUMMARY.md` -- Phase 20 completion state
- `REQUIREMENTS.md` -- full requirements traceability (CLEAN-01/02 still pending)
- `21.1-CONTEXT.md` -- Twilio SMS issue noted, prod scope separation

### Secondary (MEDIUM confidence)
- CLAUDE.md navigation structure -- used to derive user journeys
- Screen and service file listings -- used to map features to test coverage

## Metadata

**Confidence breakdown:**
- UAT structure and workflow: HIGH -- decisions are locked and clear
- TODO stub count and locations: HIGH -- verified via codebase grep
- Fix complexity estimates: MEDIUM -- some stubs may need new service code
- Platform-specific issues: MEDIUM -- based on CLAUDE.md docs, not runtime testing

**Research date:** 2026-03-26
**Valid until:** 2026-04-10 (stable -- codebase is frozen for testing)
