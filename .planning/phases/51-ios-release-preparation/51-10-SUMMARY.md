---
phase: 51-ios-release-preparation
plan: 10
subsystem: infra
tags: [firebase, cloud-functions, smtp, gmail, eas-build, app-store]

# Dependency graph
requires:
  - phase: 51-09
    provides: App Store Connect listing complete, ascAppId configured
provides:
  - Production Cloud Functions deployed with SMTP email routing
  - Ready for production EAS build (deferred to UAT)
affects: [52-systematic-uat, app-store-submission]

# Tech tracking
tech-stack:
  added: []
  patterns: [cloud-functions-config, gmail-smtp, firebase-production]

key-files:
  created: []
  modified: []

key-decisions:
  - 'Defer production EAS build and App Store submission until after UAT'
  - 'Use Gmail SMTP (reports@flickcam.app) for Cloud Functions email delivery'
  - 'Enable legacy runtime config commands temporarily (deprecated March 2026)'

patterns-established:
  - 'Production Cloud Functions deployment with SMTP config for report emails'
  - 'Firebase project switching workflow (use production → deploy → use default)'

issues-created: []

# Metrics
duration: 13min
completed: 2026-02-13
---

# Phase 51 Plan 10: Production Build and App Store Submission Summary

**Cloud Functions deployed to production with SMTP config; production build and App Store submission deferred to UAT**

## Performance

- **Duration:** 13 min
- **Started:** 2026-02-13T21:44:02Z
- **Completed:** 2026-02-13T21:56:47Z
- **Tasks:** 1 of 4 (Tasks 2-4 deferred)
- **Files modified:** 0

## Accomplishments

- Cloud Functions deployed to production Firebase project (flick-prod-49615)
- SMTP email configuration set for report delivery (reports@flickcam.app)
- All 22 Cloud Functions deployed successfully to us-central1
- New onReportCreated function deployed and ready to send report emails
- Production deployment verified

## Task Commits

**Task 1: Configure Cloud Functions secrets and deploy to production** - No commit (server-side config only)

**Tasks 2-4 deferred to UAT:**

- Task 2: Run production EAS build
- Task 3: Submit build to App Store Connect
- Task 4: Checkpoint - TestFlight verification

These will be executed during Phase 52 (Systematic UAT) or a subsequent plan.

## Files Created/Modified

None - Cloud Functions config is stored server-side in Firebase.

## Decisions Made

**Defer production build to UAT** - User decided to run systematic UAT before building and submitting production binary to App Store. This ensures full testing on TestFlight before App Review submission.

**Use Gmail SMTP for report emails** - Configured reports@flickcam.app with Gmail App Password for sending report emails via Cloud Functions. Support emails are received at support@flickcam.app.

**Enable legacy runtime config** - Temporarily enabled `legacyRuntimeConfigCommands` experiment flag since functions.config() API is deprecated (March 2026). Will need to migrate to params package before deprecation deadline.

## Deviations from Plan

**Plan adjustment: Tasks 2-4 deferred**

- **Found during:** Task 2 (Run production EAS build)
- **Issue:** User wants to run systematic UAT before production build/submit
- **Action:** Completed Task 1 (Cloud Functions), deferred remaining tasks to UAT phase
- **Rationale:** Better to test thoroughly via TestFlight during UAT before submitting to App Review
- **Impact:** No blocker - just changes execution order

## Issues Encountered

None - Cloud Functions deployed successfully on first attempt.

## Cloud Functions Deployed (22 total)

**Callable functions (v2):**

- backfillFriendCounts
- cancelUserAccountDeletion
- deleteUserAccount
- getMutualFriendSuggestions
- getMutualFriendsForComments
- getSignedPhotoUrl
- scheduleUserAccountDeletion

**Firestore triggers (v1):**

- onReportCreated (NEW - sends report emails via SMTP)
- incrementFriendCountOnAccept
- decrementFriendCountOnRemove

**Notification triggers (v1):**

- sendCommentNotification
- sendDeletionReminderNotification
- sendFriendAcceptedNotification
- sendFriendRequestNotification
- sendPhotoRevealNotification
- sendReactionNotification
- sendStoryNotification
- sendTaggedPhotoNotification

**Scheduled functions (v1):**

- checkPushReceipts
- processDarkroomReveals
- processScheduledDeletions
- processScheduledPhotoDeletions

All functions running on Node.js 20 in us-central1.

## SMTP Configuration

```
smtp.email: reports@flickcam.app
smtp.password: [Gmail App Password - 16 chars]
support.email: support@flickcam.app
```

Report email flow: User submits report → Firestore trigger → onReportCreated function → Gmail SMTP → support@flickcam.app

## Next Phase Readiness

**Phase 51 status:** 9 of 10 plans complete (this is partial completion)

**Remaining work for Phase 51:**

- Production EAS build (deferred to UAT)
- App Store submission (deferred to UAT)
- TestFlight verification (deferred to UAT)

**Ready for Phase 52 (Systematic UAT)** - Can begin UAT with development builds, then complete production build/submit when ready.

**Note:** Phase 51 will be fully complete after UAT when production build is submitted to App Store.

---

_Phase: 51-ios-release-preparation_
_Completed: 2026-02-13 (partial)_
