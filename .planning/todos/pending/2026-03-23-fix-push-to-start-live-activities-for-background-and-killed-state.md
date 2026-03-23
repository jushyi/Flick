---
created: 2026-03-23T15:56:02.072Z
title: Fix push-to-start Live Activities for background and killed state
area: notifications
files:
  - functions/notifications/liveActivitySender.js
  - modules/live-activity-manager/src/LiveActivityManagerModule.swift
  - src/services/liveActivityService.js
  - targets/FlickNotificationService/NotificationService.swift
---

## Problem

Push-to-start Live Activities don't work when the app is in background or killed state. APNS returns `BadDeviceToken` on sandbox and `BadEnvironmentKeyInToken` on production, despite the push-to-start token being freshly generated with `pushType: .token` and `NSSupportsLiveActivitiesFrequentUpdates` enabled.

All infrastructure is built and working:
- Direct APNS sender (HTTP/2, JWT .p8 signing, dual-environment fallback)
- Push-to-start token generation via ActivityKit `pushToStartTokenUpdates`
- Token storage in Firestore via native getter + JS polling
- NSE rewrite (no longer attempts Activity.request in extension process)
- Foreground Live Activity + dismiss on snap view both work

The blocker is specifically APNS rejecting the push-to-start token. Sandbox confirms token IS sandbox (production returns BadEnvironmentKeyInToken) but sandbox itself returns BadDeviceToken.

## Solution

1. Test on a **production build** (TestFlight/App Store) first — production APNS is more reliable than sandbox
2. Consider renting a Mac for native iOS debugging (Xcode Console.app shows ActivityKit internals)
3. Investigate if EAS dev build provisioning profiles affect push-to-start token validity
4. Check if push-to-start tokens have a short validity window or require specific app state
5. APNS secrets already configured on dev project (`APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_AUTH_KEY_P8`) — need same setup on prod project (`flick-prod-49615`)
