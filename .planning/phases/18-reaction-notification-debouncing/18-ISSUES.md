# UAT Issues: Phase 18 (Full Phase)

**Tested:** 2026-01-22
**Source:** .planning/phases/18-reaction-notification-debouncing/18-01-SUMMARY.md, 18-02-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

### UAT-001: Firestore permission denied for notifications collection

**Discovered:** 2026-01-22
**Phase/Plan:** 18-01 / 18-02
**Severity:** Blocker
**Feature:** NotificationsScreen data fetching
**Description:** NotificationsScreen fails to fetch notifications with Firestore permission error: "The caller does not have permission to execute the specified operation."
**Expected:** Notifications should load from Firestore when user navigates to NotificationsScreen
**Actual:** Error logged: `[firestore/permission-denied]` and empty list shown
**Repro:**
1. Open app and log in
2. Navigate to Feed tab
3. Tap heart button to open NotificationsScreen
4. Observe error in console

**Root Cause:** The `notifications` collection was created in 18-01 but Firestore security rules were not updated to allow users to read their own notifications.

---

### UAT-002: Missing back button on NotificationsScreen

**Discovered:** 2026-01-22
**Phase/Plan:** 18-02
**Severity:** Minor
**Feature:** NotificationsScreen navigation
**Description:** The NotificationsScreen has no visible back button. Users can swipe back but there's no header button.
**Expected:** Back arrow/chevron button in header to return to previous screen
**Actual:** No back button visible, only swipe gesture works
**Repro:**
1. Navigate to NotificationsScreen via heart button
2. Look at header - no back button visible

---

### UAT-003: Empty state message not centered on screen

**Discovered:** 2026-01-22
**Phase/Plan:** 18-02
**Severity:** Cosmetic
**Feature:** NotificationsScreen empty state
**Description:** The "No notifications yet" empty state message appears towards the bottom of the screen rather than centered vertically.
**Expected:** Empty state content (icon + text) should be vertically centered on screen
**Actual:** Content positioned towards the bottom of the screen
**Repro:**
1. Navigate to NotificationsScreen with no notifications
2. Observe empty state message position

---

## Resolved Issues

[None yet]

---

*Phase: 18-reaction-notification-debouncing*
*Tested: 2026-01-22*
