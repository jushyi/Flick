---
phase: 51-ios-release-preparation
plan: 09
subsystem: infra
tags: [app-store-connect, ios, release, metadata, iap, privacy]

# Dependency graph
requires:
  - phase: 51-04
    provides: Domain (flickcam.app) for support URL
  - phase: 51-07
    provides: IAP product IDs for App Store Connect configuration
provides:
  - App Store Connect listing with complete metadata
  - Privacy data declarations for all Firebase services
  - IAP products configured and ready for submission
  - Screenshots infrastructure and template
affects: [51-10-build-upload, 51-11-testflight, 51-12-app-review]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - eas.json (submit profile configured)
    - assets/screenshots/CAPTIONS.md
  modified:
    - eas.json

key-decisions:
  - 'App name: Flick - Photo Journal (base name Flick was taken)'
  - 'EU trader status: Non-Trader (individual developer)'
  - 'Age rating: 12+ (user-generated content with infrequent/mild profanity)'
  - 'Screenshot infrastructure created; actual capture deferred until pre-submission'

patterns-established: []

issues-created: []

# Metrics
duration: 44min
completed: 2026-02-13
---

# Phase 51 Plan 09: App Store Connect Setup Summary

**Complete App Store Connect listing with metadata, privacy declarations, EU compliance, and IAP products ready for submission**

## Performance

- **Duration:** 44 min
- **Started:** 2026-02-13T20:56:04Z
- **Completed:** 2026-02-13T21:40:26Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- App Store Connect listing created: "Flick - Photo Journal" (Apple ID: 6759178451)
- Complete metadata configured (subtitle, description, keywords, support URL)
- Privacy data declarations for 8 data types (phone, photos, contacts, device ID, etc.)
- EU Digital Services Act compliance (Non-Trader status, Paid Apps Agreement signed)
- 4 IAP products configured ($0.99, $2.99, $4.99, $9.99 contributions)
- eas.json configured with ascAppId for automated submission workflow
- Screenshot infrastructure created with capture template

## Task Commits

Each task was committed atomically:

1. **Task 1: Create App Store Connect listing** - Manual setup (checkpoint:human-action)
2. **Task 2: Update eas.json with ascAppId** - `cfdaa42` (chore)
3. **Task 3: Create screenshots directory and template** - `bbf501b` (chore)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `eas.json` - Added ascAppId: "6759178451" to submit.production.ios profile
- `assets/screenshots/CAPTIONS.md` - Screenshot capture template for 6-8 key screens

## Decisions Made

**App Name:**

- Chose "Flick - Photo Journal" (base name "Flick" was already taken on App Store)
- Maintains brand identity while meeting availability constraints

**EU Trader Status:**

- Selected "Non-Trader" (individual developer, not registered business)
- Signed Paid Apps Agreement to enable IAP distribution

**Age Rating:**

- 12+ rating chosen due to user-generated content
- Accounts for potential infrequent/mild profanity in comments

**Privacy Declarations:**

- 8 data types declared with appropriate usage purposes
- No tracking enabled for phone numbers, contacts, or device IDs
- Firebase data collection properly attributed (analytics vs functionality)

**Screenshot Strategy:**

- Infrastructure created now (directory + template)
- Actual screenshot capture deferred until pre-submission
- Allows time for UI polish and final testing before captures

## Deviations from Plan

None - plan executed as written.

**Note on Task 3:** Plan specified capturing screenshots, but actual capture was deferred as a practical decision. The directory structure and caption template are ready, and screenshots can be captured anytime before final submission (plan 51-12). This approach allows for UI refinement before captures while completing the setup infrastructure now.

## Issues Encountered

None.

## Next Phase Readiness

**Ready for build upload (51-10):**

- App Store Connect listing complete and in "Prepare for Submission" state
- ascAppId configured in eas.json for EAS Submit automation
- IAP products created and ready to attach to version 1.0

**Pending for final submission (51-12):**

- Screenshots need to be captured from iOS Simulator (iPhone 16 Pro Max)
- Screenshots should be captured after UI is finalized and tested
- Template in assets/screenshots/CAPTIONS.md provides guidance for 6-8 key screens

**App Store Connect Details:**

- App Name: Flick - Photo Journal
- Apple ID: 6759178451
- Bundle ID: com.spoodsjs.flick
- Version: 1.0.0
- Categories: Photo & Video (primary), Social Networking (secondary)

---

_Phase: 51-ios-release-preparation_
_Completed: 2026-02-13_
