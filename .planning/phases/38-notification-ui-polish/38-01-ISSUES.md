# UAT Issues: Phase 38 Plan 01

**Tested:** 2026-02-09
**Source:** .planning/phases/38-notification-ui-polish/38-01-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

### UAT-001: Banner ignores iOS safe area — no top padding

**Discovered:** 2026-02-09
**Phase/Plan:** 38-01
**Severity:** Major
**Feature:** In-app notification banner positioning
**Description:** The notification banner starts at the very top of the screen with no safe area offset. It sits behind the iOS status bar icons (clock, signal, battery) and the notch area rather than below them.
**Expected:** Banner should appear below the notch and status bar icons, respecting the iOS safe area insets.
**Actual:** Banner renders from the very top of the screen with no top padding, overlapping with native iOS UI elements.
**Repro:**

1. Open the app on an iOS device with a notch (iPhone X or later)
2. Trigger a push notification while the app is in the foreground
3. Observe the banner position relative to the status bar and notch

## Resolved Issues

[None yet]

---

_Phase: 38-notification-ui-polish_
_Plan: 01_
_Tested: 2026-02-09_
