---
phase: 13-auth-storage-migration
plan: 02
subsystem: storage, auth
tags: [supabase-storage, webp, image-compression, edge-function, firebase-migration, base64-arraybuffer]

# Dependency graph
requires:
  - phase: 12-schema-infrastructure-foundation
    provides: Supabase client setup, TypeScript config, database schema
provides:
  - Supabase Storage upload/delete/URL service for all media types
  - Edge Function for silent Firebase-to-Supabase auth migration with session tokens
  - WebP compression pipeline for photos and profile images
affects: [13-auth-storage-migration (plans 03/04), 15-core-services-photos-feed-darkroom]

# Tech tracking
tech-stack:
  added: [base64-arraybuffer]
  patterns: [ArrayBuffer upload via base64 decode, WebP compression, public CDN URLs, Edge Function token bridge]

key-files:
  created:
    - src/services/supabase/storageService.ts
    - supabase/functions/migrate-firebase-auth/index.ts
    - __tests__/services/storageService.test.ts
  modified:
    - __tests__/setup/jest.setup.js
    - package.json

key-decisions:
  - "WebP compression at 0.9 for photos (1080px) and 0.9 for snaps (1080px), 0.7 for profile photos (400px)"
  - "Firebase token verified via Google Identity Toolkit REST API (Firebase Admin SDK does not work in Deno)"
  - "GoTrue session tokens generated via temporary password strategy (set temp password, sign in, clear password)"
  - "Phone lookup via direct users table query, not auth.admin.listUsers() pagination"

patterns-established:
  - "Storage upload pattern: compress -> base64 -> ArrayBuffer -> supabase.storage.upload()"
  - "Public bucket CDN URLs for regular photos, private bucket for snaps"
  - "Edge Function CORS handling with preflight OPTIONS response"

requirements-completed: [AUTH-02, STOR-01, STOR-02]

# Metrics
duration: 6min
completed: 2026-03-23
---

# Phase 13 Plan 02: Storage Service & Auth Migration Edge Function Summary

**Supabase Storage service with WebP compression for all media types, plus Edge Function token bridge returning GoTrue session tokens for silent Firebase-to-Supabase auth migration**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-23T18:33:14Z
- **Completed:** 2026-03-23T18:39:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Full Supabase Storage service with 10 exported functions matching Firebase storageService API surface
- WebP compression pipeline: photos at 0.9/1080px, profile photos at 0.7/400px, snaps at 0.9/1080px
- Edge Function validates Firebase tokens via REST API, creates Supabase auth users, returns real access_token + refresh_token
- 20 unit tests covering all storage operations (TDD: RED then GREEN)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing storage service tests** - `9304e219` (test)
2. **Task 1 (dep): Install base64-arraybuffer** - `af6fc9b7` (chore)
3. **Task 1 (GREEN): Implement storage service** - `9fdbef95` (feat)
4. **Task 2: Edge Function for auth migration** - `f23dfcf9` (feat)

## Files Created/Modified
- `src/services/supabase/storageService.ts` - All upload/delete/URL operations for Supabase Storage (10 exports)
- `supabase/functions/migrate-firebase-auth/index.ts` - Edge Function for silent Firebase-to-Supabase auth migration
- `__tests__/services/storageService.test.ts` - 20 unit tests for storage service
- `__tests__/setup/jest.setup.js` - Added WEBP to SaveFormat mock, expo-file-system/legacy mock, base64-arraybuffer mock
- `package.json` - Added base64-arraybuffer dependency

## Decisions Made
- Used Google Identity Toolkit REST API for Firebase token verification in Deno Edge Function (Firebase Admin SDK is Node.js-only)
- GoTrue session token generation via temporary password strategy: set temp password, sign in via /auth/v1/token endpoint, immediately clear password
- Phone user lookup via direct users table query instead of auth.admin.listUsers() for scalability
- Profile photos use upsert:true (can be replaced), regular photos use upsert:false

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Jest cache causing module resolution failure**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** react-native-url-polyfill mock file existed but Jest resolver failed to locate it
- **Fix:** Cleared Jest cache with `npx jest --clearCache`
- **Files modified:** None (cache only)
- **Verification:** All 20 tests pass after cache clear

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Trivial cache issue, no scope change.

## Issues Encountered
None beyond the Jest cache issue noted above.

## User Setup Required
Before deploying the Edge Function, set the `FIREBASE_API_KEY` secret:
```bash
supabase secrets set FIREBASE_API_KEY=<your-firebase-web-api-key>
supabase functions deploy migrate-firebase-auth
```

## Next Phase Readiness
- Storage service ready for upload queue rewrite (Plan 03)
- Edge Function ready for AuthContext integration (Plan 03)
- All storage operations use the base64-arraybuffer pattern required for React Native

## Self-Check: PASSED

All created files verified on disk. All 4 commit hashes found in git history.

---
*Phase: 13-auth-storage-migration*
*Completed: 2026-03-23*
