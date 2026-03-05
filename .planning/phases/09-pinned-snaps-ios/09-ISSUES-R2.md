# Phase 09 Issues — Round 2 (Device Testing)

**Date:** 2026-03-05
**Build:** Post gap-closure plans 09-11/12/13
**Source:** User device testing feedback

---

## Issue 1: Thumbnail still shows "F" placeholder

**Severity:** Critical
**Status:** Open — root cause uncertain

The photo still doesn't come through. The "F" branded placeholder displays instead of the actual snap photo.

**Possible causes to investigate:**
- `pinnedThumbnailUrl` may not be reaching the JS handler in `notifData` (check Cloud Function notification payload — does the Expo push format nest data under `body` as JSON string?)
- `FileSystem.downloadAsync` may be failing silently (the catch block logs a warning but still proceeds with empty `thumbnailUri`)
- The native module's `copyThumbnailToAppGroup` may fail if the URI format from `FileSystem.downloadAsync` isn't recognized (file:// vs plain path)
- App Groups entitlement may not be configured correctly for the main app target (widget and NSE have it, but main app needs it too)

**Files:** `App.js:340-368`, `modules/live-activity-manager/src/LiveActivityManagerModule.swift:300-323`, `functions/index.js` (notification payload), `functions/notifications/sender.js`

**Debug approach:** Add more granular logging to the download + copy pipeline. Check NSE diagnostics via `getNSEDiagnostics()` from Settings screen. Verify `pinnedThumbnailUrl` is present in notification data.

---

## Issue 2: No Live Activity when app is in background

**Severity:** Critical
**Status:** Open

When the app is in background, only the push notification shows — no Live Activity appears.

**Root cause analysis:**
- `addNotificationReceivedListener` (App.js:322) only fires when app is in **foreground**. It does NOT fire when app is in background.
- The NSE (`NotificationService.swift`) is the only path for background Live Activity. It should intercept the push (via `mutableContent: true`), download the thumbnail, and call `Activity.request()`.
- The NSE may not be firing (check if `mutableContent` is actually being sent by Expo Push Service)
- The NSE may be firing but `Activity.request()` may be failing in the extension context
- There is NO foreground-resume fallback: when the app comes back from background, nothing checks for unhandled pinned snap notifications

**Fix approach:** Two-pronged:
1. Debug the NSE — check diagnostics to see if it fires and where it fails
2. Add a foreground-resume handler: when app transitions to foreground (AppState 'active'), check delivered notifications for unhandled pinned snaps and start Live Activities for them

**Files:** `App.js`, `targets/FlickNotificationService/NotificationService.swift`, `functions/notifications/sender.js` (mutableContent flag)

---

## Issue 3: Polaroid frame looks wrong

**Severity:** Medium
**Status:** Open

Multiple visual issues with the Polaroid frame:
- **Borders not thick enough** — current 4pt sides/top is too thin, doesn't look like a real Polaroid
- **Photo inside has rounded edges** — the `.clipShape(RoundedRectangle(cornerRadius: 8))` on the thumbnail makes it look digital, not like a printed photo. Real Polaroids have **sharp square corners** on the photo inside the frame.
- **Bottom border not big enough** — 14pt bottom isn't thick enough to achieve the classic Polaroid look
- **No tilt/rotation** — should be slightly randomly rotated (like -3 to +5 degrees) to look like it was casually placed/pasted onto the lock screen
- **No top border** — user reports there's no visible top padding (4pt may be too thin to see)

**Fix:**
- Increase side/top padding to ~6-8pt
- Increase bottom padding to ~20-24pt (classic Polaroid proportions: bottom is roughly 3-4x the side border)
- Remove `RoundedRectangle` clipShape from the thumbnail — use plain `.clipped()` for sharp corners on the photo
- Add `.rotationEffect(Angle(degrees: X))` with a deterministic pseudo-random angle based on activityId hash (so it's consistent but looks random per snap). Range: -4 to +4 degrees.
- Keep the outer Polaroid frame corners slightly rounded (2-3pt)

**File:** `targets/FlickLiveActivity/FlickLiveActivityWidget.swift`

---

## Issue 4: Live Activity may be too tall — check max height

**Severity:** Medium
**Status:** Open — needs investigation

The Live Activity max lock screen height is **160 points** per Apple's guidelines. Content exceeding this gets truncated/clipped.

**Current height calculation (with caption layout):**
- Vertical padding: 14pt top + 14pt bottom = 28pt
- Polaroid: 4pt top pad + 160pt photo + 14pt bottom pad = 178pt (Polaroid alone exceeds 160pt!)

**The Polaroid frame alone is taller than the max allowed height.** This is why it may look truncated or weird.

**Fix:** Reduce photo height to fit within 160pt total:
- Max content height: 160pt - 28pt (outer padding) = 132pt for the Polaroid
- Polaroid inner photo: 132pt - 8pt top - 24pt bottom border = 100pt photo height
- Photo width at 4:5 ratio: 80pt wide (or adjust ratio to 3:4 → 75pt wide)
- Alternative: reduce outer padding to maximize photo size

**Recommended dimensions to maximize photo within 160pt:**
- Outer vertical padding: 8pt top + 8pt bottom = 16pt
- Polaroid: 6pt top + ~104pt photo height + 22pt bottom = 132pt
- Photo width at 3:4: ~78pt, at 4:5: ~83pt
- Total: 16pt + 132pt = 148pt (under 160pt with margin)

Or if we want to push it:
- Outer vertical padding: 6pt top + 6pt bottom = 12pt
- Polaroid: 6pt top + ~112pt photo height + 24pt bottom = 142pt
- Total: 154pt (tight but safe)

**File:** `targets/FlickLiveActivity/FlickLiveActivityWidget.swift`

---

## Summary

| # | Issue | Severity | Category |
|---|-------|----------|----------|
| 1 | Thumbnail "F" placeholder persists | Critical | Data pipeline |
| 2 | No Live Activity in background | Critical | NSE / foreground resume |
| 3 | Polaroid frame visual issues | Medium | Widget layout |
| 4 | Live Activity exceeds 160pt max height | Medium | Widget layout |

Issues 3 and 4 are closely related and should be fixed together (resize Polaroid to fit within 160pt while improving border proportions).
