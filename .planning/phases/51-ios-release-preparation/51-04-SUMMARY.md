---
phase: 51-ios-release-preparation
plan: 04
subsystem: infra
tags: [domain, email, google-workspace, oauth, firebase]

# Dependency graph
requires:
  - phase: 51-03
    provides: Firebase production configuration, iOS app.json setup
provides:
  - Professional domain (flickcam.app) for production release
  - Google Workspace email (support@flickcam.app) for support/reports
  - OAuth 2.0 client ID for phone authentication reCAPTCHA
  - Clean Google Cloud Console project structure
affects: [51-05, 51-06, 51-07, 51-08, 51-09, 51-10, 53]

# Tech tracking
tech-stack:
  added: [Google Workspace]
  patterns: [Professional email infrastructure, OAuth configuration for Firebase Auth]

key-files:
  created: []
  modified:
    - src/screens/SettingsScreen.js
    - app.json

key-decisions:
  - 'Chose flickcam.app as production domain (short, memorable, ties to camera concept)'
  - 'Used Google Workspace instead of email forwarding for professional integration with Google Cloud/Firebase'
  - 'Kept both Flick Development (re-lapse-fa89b) and Flick Production (flick-prod-49615) projects for testing vs production'
  - 'Created new iOS OAuth 2.0 Client ID for production Firebase project to fix phone auth reCAPTCHA'

patterns-established:
  - 'Google Workspace email as Owner/Admin on Firebase and GCP for unified permissions'
  - 'support@flickcam.app as canonical support contact across app and App Store'

issues-created: []

# Metrics
duration: 35min
completed: 2026-02-13
---

# Phase 51 Plan 04: Domain and Support Email Summary

**Production domain registered (flickcam.app), Google Workspace configured, Google Cloud Console cleaned up, OAuth client ID updated for phone authentication**

## Performance

- **Duration:** 35 min
- **Started:** 2026-02-13T16:20:00Z (estimated)
- **Completed:** 2026-02-13T16:55:00Z (estimated)
- **Tasks:** 3 (2 checkpoints + 1 auto)
- **Files modified:** 2

## Accomplishments

- Chose and registered flickcam.app domain for production release
- Set up Google Workspace with support@flickcam.app email
- Added Workspace email as Owner to Firebase and Google Cloud Console
- Renamed GCP projects for clarity (Flick Development / Flick Production)
- Cleaned up IAM permissions and API credentials
- Created new iOS OAuth 2.0 Client ID for production Firebase project
- Updated in-app support email to support@flickcam.app
- Verified no stale support email references remain

## Task Commits

1. **Task 3: Update support email and OAuth client ID** - `317f6e7` (feat)

_Note: Tasks 1-2 were checkpoints (decision and human-action) requiring manual setup, no code changes._

## Files Created/Modified

- [src/screens/SettingsScreen.js](../../../src/screens/SettingsScreen.js#L54) - Updated support email mailto link
- [app.json](../../../app.json#L47) - Updated iOS OAuth 2.0 client ID URL scheme

## Decisions Made

**1. Domain choice: flickcam.app**

- Rationale: Short, memorable, directly ties to camera/photo concept, .app TLD is modern and HTTPS-enforced

**2. Google Workspace over email forwarding**

- Rationale: Professional email with seamless Firebase/GCP integration, can send from support@flickcam.app, room for team growth

**3. Keep separate dev and production GCP projects**

- Rationale: Allows safe testing without affecting production data, clear separation of environments

**4. Created new OAuth 2.0 Client ID for production**

- Rationale: Old OAuth client (958995611148-...) was from re-lapse project, new production project (904439256658-...) needed matching credentials

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Google Cloud Console cleanup and OAuth configuration**

- **Found during:** Task 2 (Google Workspace setup, adding email to Firebase/GCP)
- **Issue:**
  - GCP project still named "re-lapse" (old branding)
  - Confusing IAM permissions not understood
  - OAuth 2.0 Client ID in app.json was from old project (958995611148) instead of production (904439256658)
  - Phone authentication reCAPTCHA verification required proper OAuth client ID
- **Fix:**
  - Renamed projects: "re-lapse-fa89b" → "Flick Development", "flick-prod-49615" → "Flick Production"
  - Reviewed and documented all IAM permissions (all were necessary service accounts)
  - Created new iOS OAuth 2.0 Client ID for production Firebase project
  - Updated app.json CFBundleURLSchemes with production OAuth client
  - Configured OAuth consent screen with flickcam.app domain
- **Files modified:** app.json (OAuth client ID)
- **Verification:** OAuth consent screen configured, iOS client ID created, app.json updated with matching credentials
- **Committed in:** 317f6e7 (combined with Task 3 commit)

### Deferred Enhancements

None.

---

**Total deviations:** 1 auto-fixed (missing critical: OAuth configuration for phone auth)
**Impact on plan:** OAuth fix was critical for phone authentication to work properly with production Firebase project. Console cleanup improves professionalism and reduces confusion for future work.

## Issues Encountered

None - all checkpoints completed successfully, Google Workspace setup went smoothly.

## Next Phase Readiness

**Ready for next plan (51-05):**

- ✅ Domain registered and owned
- ✅ Support email functional (support@flickcam.app)
- ✅ Google Workspace integrated with Firebase/GCP
- ✅ OAuth credentials properly configured for phone auth
- ✅ In-app support link updated
- ✅ No stale references to old domains/emails

**Domain will be used for:**

- App Store Connect "Support URL" field (required)
- Privacy Policy and Terms of Service links
- User support and report handling
- Potential landing page

**No blockers for next plan.**

---

_Phase: 51-ios-release-preparation_
_Completed: 2026-02-13_
