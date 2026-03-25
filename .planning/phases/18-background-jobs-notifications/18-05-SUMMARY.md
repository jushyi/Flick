---
phase: 18-background-jobs-notifications
plan: 05
subsystem: infra
tags: [apns, live-activity, http2, jwt, es256, supabase, edge-functions, push-notifications, deno]

# Dependency graph
requires:
  - phase: 18-01
    provides: send-push-notification Edge Function pattern and _shared utilities
provides:
  - send-live-activity Edge Function for APNS HTTP/2 push-to-start delivery
  - Client-side push token storage migrated from Firestore to Supabase
affects: [phase-20-firebase-removal, phase-21-verification]

# Tech tracking
tech-stack:
  added: [node:http2 (Deno), node:crypto (Deno)]
  patterns: [APNS JWT ES256 signing with cache, dual-environment fallback, Supabase token storage]

key-files:
  created:
    - supabase/functions/send-live-activity/index.ts
  modified:
    - src/services/liveActivityService.js
    - src/services/firebase/notificationService.js

key-decisions:
  - "base64url encoding via btoa+replace in Deno (no Buffer.toString('base64url'))"
  - "JWT cached ~50 min (refresh 10 min before 1hr expiry) matching Apple recommendation"
  - "Kept FCM registration token storage in liveActivityService (still needed for messaging import)"

patterns-established:
  - "APNS Edge Function pattern: service_role auth, user lookup, JWT sign, HTTP/2 send with fallback"

requirements-completed: [LIVE-01]

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 18 Plan 05: Live Activity APNS Edge Function Summary

**APNS HTTP/2 Edge Function with ES256 JWT signing and dual-environment fallback, plus client-side token storage migrated from Firestore to Supabase**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T14:11:05Z
- **Completed:** 2026-03-25T14:13:53Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created send-live-activity Edge Function porting APNS HTTP/2 delivery from Firebase Cloud Functions to Supabase
- Implemented ES256 JWT signing with PEM key normalization and ~50 minute caching
- Dual-environment fallback (production -> sandbox on BadDeviceToken) preserved from existing implementation
- Migrated liveActivityService push_to_start_token storage from Firestore to Supabase
- Migrated notificationService push_token (Expo token) storage from Firestore to Supabase

## Task Commits

Each task was committed atomically:

1. **Task 1: Create send-live-activity Edge Function for APNS HTTP/2** - `5688901a` (feat)
2. **Task 2: Update client-side token storage to use Supabase** - `bd395487` (feat)

## Files Created/Modified
- `supabase/functions/send-live-activity/index.ts` - APNS HTTP/2 Edge Function with JWT signing, dual-environment fallback, service_role auth
- `src/services/liveActivityService.js` - Replaced Firestore token writes with Supabase for push_to_start_token and fcm_registration_token
- `src/services/firebase/notificationService.js` - Replaced Firestore fcmToken write with Supabase push_token in storeNotificationToken

## Decisions Made
- Used `btoa()` + manual base64url conversion in Deno instead of Node's `Buffer.toString('base64url')` for JWT encoding
- JWT refreshed 10 minutes before expiry (~50 min cache lifetime) per Apple's 1-hour JWT validity window
- Kept `@react-native-firebase/messaging` import in liveActivityService since `getFCMRegistrationToken` still uses it for FCM token retrieval
- Removed `@react-native-firebase/firestore` import from liveActivityService (no longer needed)

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

APNS secrets must be configured in Supabase for the Edge Function to work:

```bash
supabase secrets set APNS_KEY_ID=<key-id-from-apple-developer-console>
supabase secrets set APNS_TEAM_ID=<team-id-from-apple-developer-membership>
supabase secrets set APNS_AUTH_KEY_P8="<contents-of-p8-file>"
```

## Known Stubs

None - all data paths are fully wired.

## Issues Encountered

None

## Next Phase Readiness
- APNS Live Activity infrastructure is ported to Supabase Edge Functions
- Push-to-start debugging deferred per CONTEXT.md (requires Mac/Xcode session)
- Client token storage points to Supabase, ready for Firebase removal in Phase 20

---
*Phase: 18-background-jobs-notifications*
*Completed: 2026-03-25*
