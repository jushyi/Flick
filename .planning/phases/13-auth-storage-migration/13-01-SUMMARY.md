---
phase: 13-auth-storage-migration
plan: 01
subsystem: auth
tags: [supabase, phone-auth, otp, storage, signed-urls, rls, typescript, jest]

# Dependency graph
requires:
  - phase: 12-schema-infrastructure
    provides: Supabase client (src/lib/supabase.ts), database schema (users table), TypeScript config
provides:
  - Supabase phone OTP auth service (phoneAuthService.ts)
  - Supabase signed URL service (signedUrlService.ts)
  - firebase_uid column for silent auth migration lookups
  - 5 storage buckets with RLS policies (photos, snaps, profile-photos, selects, comment-images)
  - Jest TypeScript test infrastructure with Supabase mocks
  - Auth migration integration test scaffold
affects: [13-02-edge-function, 13-03-auth-context, 14-powersync, 15-core-services, 16-storage-migration]

# Tech tracking
tech-stack:
  added: []
  patterns: [supabase-service-pattern, stateless-otp, public-vs-signed-urls, tdd-red-green]

key-files:
  created:
    - src/services/supabase/phoneAuthService.ts
    - src/services/supabase/signedUrlService.ts
    - supabase/migrations/20260323000009_add_firebase_uid_and_storage_buckets.sql
    - __tests__/services/phoneAuthService.test.ts
    - __tests__/services/signedUrlService.test.ts
    - __tests__/integration/authMigration.test.ts
    - __tests__/__mocks__/react-native-url-polyfill.js
  modified:
    - jest.config.js
    - __tests__/setup/jest.setup.js

key-decisions:
  - "Stateless OTP pattern: no ConfirmationResult stored (Supabase handles state server-side)"
  - "Public CDN URLs for photos (synchronous), 5-minute signed URLs for snaps (async)"
  - "Test phone numbers use 202 area code (valid per libphonenumber-js, unlike 555 prefix)"
  - "react-native-url-polyfill mocked via moduleNameMapper (not jest.mock) since package not in node_modules"

patterns-established:
  - "Supabase service files in src/services/supabase/ with {success, error} return pattern"
  - "Supabase mocks on global.__supabaseMocks for test access"
  - "TypeScript test files (.test.ts) alongside existing JS tests"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 6min
completed: 2026-03-23
---

# Phase 13 Plan 01: Auth & Storage Migration Foundation Summary

**Supabase phone OTP auth service with stateless verification, public/signed URL service for storage buckets, and firebase_uid migration column with full RLS policy set**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-23T18:33:01Z
- **Completed:** 2026-03-23T18:39:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Supabase phone auth service with sendVerificationCode, verifyCode, signOut using stateless OTP pattern
- Signed URL service returning instant CDN URLs for public buckets and 5-minute signed URLs for private snaps bucket
- Database migration adding firebase_uid column (for silent auth migration) and 5 storage buckets with 14 RLS policies
- Jest infrastructure updated for TypeScript tests with comprehensive Supabase mocks (auth, storage, functions including setSession)
- TDD workflow: RED tests committed before GREEN implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Jest TS config + Supabase mocks + database migration** - `a1b6ce0f` (chore)
2. **Task 2: Failing test scaffolds (RED phase)** - `20389ddc` (test)
3. **Task 3: Implement phoneAuthService.ts + signedUrlService.ts (GREEN phase)** - `7f759099` (feat)

## Files Created/Modified
- `src/services/supabase/phoneAuthService.ts` - Supabase phone OTP auth with send/verify/signOut/validate/errorMapping
- `src/services/supabase/signedUrlService.ts` - Public CDN URLs for photos, signed URLs for snaps
- `supabase/migrations/20260323000009_add_firebase_uid_and_storage_buckets.sql` - firebase_uid column + 5 buckets + 14 RLS policies
- `jest.config.js` - Updated testMatch, collectCoverageFrom for TS, added Supabase to transformIgnorePatterns
- `__tests__/setup/jest.setup.js` - Added Supabase auth/storage/functions mocks with setSession
- `__tests__/services/phoneAuthService.test.ts` - 10 tests for phone auth service
- `__tests__/services/signedUrlService.test.ts` - 3 tests for signed URL service
- `__tests__/integration/authMigration.test.ts` - 3 integration tests for Edge Function response shape
- `__tests__/__mocks__/react-native-url-polyfill.js` - Mock for URL polyfill in test env

## Decisions Made
- Stateless OTP pattern (no ConfirmationResult needed) -- Supabase handles verification state server-side
- Public CDN URLs for photos are synchronous (no network call), signed URLs for snaps are async with 300s expiry
- Used 202 area code for test phone numbers since 555 prefix is rejected by libphonenumber-js validation
- Mocked react-native-url-polyfill via moduleNameMapper rather than jest.mock since package is not in node_modules for tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] react-native-url-polyfill not resolvable in test environment**
- **Found during:** Task 3 (GREEN implementation)
- **Issue:** src/lib/supabase.ts imports react-native-url-polyfill which cannot be resolved by Jest
- **Fix:** Added moduleNameMapper in jest.config.js pointing to an empty mock file
- **Files modified:** jest.config.js, __tests__/__mocks__/react-native-url-polyfill.js
- **Verification:** All 16 tests pass
- **Committed in:** 7f759099 (Task 3 commit)

**2. [Rule 1 - Bug] Test phone number 5551234567 invalid per libphonenumber-js**
- **Found during:** Task 3 (GREEN implementation)
- **Issue:** 555 prefix numbers are reserved/fictitious in NANP, libphonenumber-js correctly rejects them
- **Fix:** Changed test numbers to use 2025551234 (valid 202 area code)
- **Files modified:** __tests__/services/phoneAuthService.test.ts
- **Verification:** validatePhoneNumber test passes with valid result
- **Committed in:** 7f759099 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for tests to pass. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phone auth service ready for AuthContext integration (Plan 03)
- Signed URL service ready for storage migration (Phase 16)
- firebase_uid column ready for Edge Function migration (Plan 02)
- Integration test scaffold ready for Plan 02 to implement actual migration bridge
- Supabase mocks available globally for all future Supabase service tests

## Self-Check: PASSED

All 7 created files verified present. All 3 task commits (a1b6ce0f, 20389ddc, 7f759099) verified in git log.

---
*Phase: 13-auth-storage-migration*
*Completed: 2026-03-23*
