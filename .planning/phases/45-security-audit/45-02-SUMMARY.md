---
phase: 45-security-audit
plan: 02
subsystem: security
tags: [cloud-functions, cors, authorization, firebase, signed-urls]

# Dependency graph
requires:
  - phase: 45-01
    provides: Storage rules hardened to owner-only — getSignedPhotoUrl is now sole non-owner access path
provides:
  - getSignedPhotoUrl enforces ownership/friendship authorization
  - Destructive Cloud Functions CORS-restricted (no cross-origin calls)
  - Sanitized error messages on all destructive endpoints
affects: [45-03, 45-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [friendship-check-authorization, deterministic-friendship-id, error-sanitization]

key-files:
  created: []
  modified: [functions/index.js]

key-decisions:
  - 'Profile-photos paths allow any authenticated user (semi-public within app)'
  - 'Friendship check uses deterministic sorted ID format already established in codebase'
  - "CORS removed entirely from destructive functions — React Native doesn't need it"

patterns-established:
  - 'Authorization pattern: parse Storage path to extract owner, check friendship if non-owner'
  - 'Error sanitization pattern: log full error, throw generic message to client'

issues-created: []

# Metrics
duration: 3min
completed: 2026-02-10
---

# Phase 45 Plan 02: Cloud Functions Access Control Summary

**getSignedPhotoUrl authorization with ownership/friendship checks, CORS removal on destructive functions, and error message sanitization**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-10T03:11:36Z
- **Completed:** 2026-02-10T03:14:42Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- getSignedPhotoUrl now validates that requester is photo owner or accepted friend before generating signed URL
- Profile-photo paths handled separately — any authenticated user can access
- CORS removed from deleteUserAccount, scheduleUserAccountDeletion, cancelUserAccountDeletion
- Error messages sanitized — no raw error.message leaked to clients
- Internal logging preserved with full error details for debugging

## Task Commits

Each task was committed atomically:

1. **Task 1: Add photo access validation to getSignedPhotoUrl** - `10553a6` (feat)
2. **Task 2: Restrict CORS on destructive functions and sanitize errors** - `82960e3` (fix)

**Plan metadata:** (pending)

## Files Created/Modified

- `functions/index.js` - Added authorization checks to getSignedPhotoUrl, removed CORS from destructive functions, sanitized error messages

## Decisions Made

- Profile-photos paths allow any authenticated user (these are semi-public within the app)
- Friendship check uses the deterministic sorted ID format (`[lowerUserId]_[higherUserId]`) already established in the codebase
- CORS removed entirely from destructive functions rather than restricting to specific origins — React Native HTTP requests are not subject to CORS

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- Cloud Functions access control hardened, ready for 45-03 (input validation)
- getSignedPhotoUrl is now the secure access path for non-owner photo access

---

_Phase: 45-security-audit_
_Completed: 2026-02-10_
