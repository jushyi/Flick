---
phase: 51-ios-release-preparation
plan: 02
subsystem: infra
tags: [firebase, eas, production, environment-config, rebrand]

# Dependency graph
requires:
  - phase: 51-01
    provides: Flick rebrand (icon, splash, app name)
provides:
  - Production Firebase project (flick-prod-49615) isolated from dev
  - Environment-based Firebase switching via EAS build profiles
  - Bundle ID rebrand: com.spoodsjs.flick
  - Firestore/Storage rules and Cloud Functions deployed to production
affects: [51-03, 51-07, app-store-release]

# Tech tracking
tech-stack:
  added: []
  patterns: [environment-based config via EAS env vars, Firebase multi-project setup]

key-files:
  created: [GoogleService-Info-prod.plist]
  modified: [app.json, eas.json, .firebaserc]

key-decisions:
  - 'Rebrand bundle ID from com.spoodsjs.rewind → com.spoodsjs.flick during production Firebase setup'
  - 'Use EAS build profile env vars (GOOGLE_SERVICES_PLIST) for Firebase project switching'
  - 'Firebase region: us-central1 for Firestore and Storage'

patterns-established:
  - 'Build profile determines Firebase project: development/preview → dev, production → prod'
  - '.firebaserc aliases: default (dev), production (prod) for firebase CLI operations'

issues-created: []

# Metrics
duration: 89min
completed: 2026-02-13
---

# Phase 51 Plan 02: Production Firebase Environment Setup Summary

**Production Firebase project created with environment-based switching via EAS, bundle ID rebranded to com.spoodsjs.flick, all security rules and 21 Cloud Functions deployed to production**

## Performance

- **Duration:** 89 min (1h 29m)
- **Started:** 2026-02-13T15:06:35Z
- **Completed:** 2026-02-13T16:35:28Z
- **Tasks:** 3
- **Files modified:** 3 (+ 1 plist created)

## Accomplishments

- Production Firebase project created (`flick-prod-49615`) with Auth (Phone), Firestore (us-central1), and Storage enabled
- Complete bundle ID rebrand: `com.spoodsjs.rewind` → `com.spoodsjs.flick` (iOS & Android)
- Environment-based Firebase project switching configured in EAS build profiles
- All Firestore rules, Storage rules, and 21 Cloud Functions deployed to production
- Production database is clean (no dev data) with identical security rules as dev

## Task Commits

1. **Task 1: Create production Firebase project** - (human-action checkpoint, no commit)
2. **Task 2: Configure Firebase switching & rebrand** - `67de0ff` (chore)

**Plan metadata:** (pending - will be committed with SUMMARY)

## Files Created/Modified

- `GoogleService-Info-prod.plist` - Production Firebase iOS config (bundle ID: com.spoodsjs.flick)
- `app.json` - Updated iOS bundleIdentifier and Android package to com.spoodsjs.flick
- `eas.json` - Added GOOGLE_SERVICES_PLIST env var to all build profiles
- `.firebaserc` - Added production project alias (flick-prod-49615)

## Decisions Made

**Bundle ID Rebrand:** During Task 1, user confirmed intent to rebrand app from "Rewind" to "Flick" for App Store release. Updated bundle ID immediately as part of production Firebase setup rather than deferring to separate task. This decision affects:

- Production Firebase iOS app registration (uses new bundle ID)
- Apple Developer Portal (will need new app registration)
- All EAS builds from this point forward

**Firebase Region:** Selected `us-central1` (Iowa) for production Firestore and Storage. This is the default region with best service availability and lowest cost. Cannot be changed after database creation.

**EAS Environment Switching:** Used build profile `env` variables rather than EAS Secrets for GOOGLE_SERVICES_PLIST path. This approach:

- Keeps config in eas.json (version controlled, visible)
- No need for separate secrets management
- Clear mapping: development/preview → dev Firebase, production → prod Firebase

## Deviations from Plan

### Architectural Change with User Approval

**Bundle ID Rebrand (Task 2 scope expansion)**

- **Found during:** Task 1 (Firebase Console iOS app setup)
- **Discovery:** User requested rebrand from "Rewind" to "Flick" when asked about bundle ID
- **Action taken:** Updated app.json bundle IDs (iOS & Android) as part of Task 2 alongside Firebase config
- **Files modified:** app.json (bundleIdentifier + package fields)
- **Rationale:** Logical to handle rebrand during production Firebase setup since we're already configuring environment-based switching
- **Committed in:** 67de0ff (Task 2 commit)

---

**Total deviations:** 1 architectural change (user-approved scope expansion)
**Impact on plan:** Rebrand completed earlier than potentially planned, production Firebase properly configured with new bundle ID from day one.

## Issues Encountered

**Cloud Functions Artifact Registry Permissions:** Initial deployment failed with permission errors for `artifactregistry.repositories.get`. This is normal for new Firebase projects - service account permissions take a few minutes to propagate after first enabling Cloud Functions API. Retry succeeded after ~2 minutes.

**Cloud Functions Cleanup Policy:** Functions deployed successfully but Firebase CLI warned about missing cleanup policy for container images in us-central1. This is a minor billing optimization, not a deployment failure. Can be configured later with `firebase functions:artifacts:setpolicy` if needed.

## Next Phase Readiness

**Ready for 51-03:** Production Firebase fully configured and isolated from dev. EAS build profiles will now automatically connect to correct Firebase project based on build type.

**Blockers:** None. Production environment is clean and ready.

**Considerations for next plans:**

- Apple Developer Portal needs new app registration for `com.spoodsjs.flick` bundle ID (covered in 51-03)
- Deep linking, associated domains, push certificates may need bundle ID updates
- Any hardcoded "rewind" references in code should be audited (app name already handled in 51-01)

---

_Phase: 51-ios-release-preparation_
_Completed: 2026-02-13_
