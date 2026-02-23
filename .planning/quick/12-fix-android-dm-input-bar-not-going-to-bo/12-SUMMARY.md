---
phase: quick-12
plan: 1
subsystem: ui
tags: [react-native, android, keyboard, KeyboardAvoidingView, platform]

# Dependency graph
requires:
  - phase: quick-9
    provides: iOS DM input bar padding and keyboard tracking
provides:
  - Android DM input bar keyboard dismiss fix
  - Android-specific keyboard event tracking (keyboardDidShow/keyboardDidHide)
  - Reduced Android bottom spacing on DM input bar
affects: [dm-input, conversation-screen]

# Tech tracking
tech-stack:
  added: []
  patterns: [platform-conditional keyboard events, platform-conditional padding]

key-files:
  created: []
  modified:
    - src/components/DMInput.js
    - src/screens/ConversationScreen.js

key-decisions:
  - "Use behavior='padding' on Android KAV instead of 'height' to fix floating input bar on keyboard dismiss"
  - 'Use keyboardDidShow/keyboardDidHide for Android (keyboardWill* not supported on Android)'
  - 'Reduce Android resting bottom padding by 4px from safe area inset to tighten spacing'

patterns-established:
  - 'Platform-conditional keyboard events: keyboardWillShow/Hide for iOS, keyboardDidShow/Hide for Android'

requirements-completed: [QUICK-12]

# Metrics
duration: 1min
completed: 2026-02-23
---

# Quick Task 12: Fix Android DM Input Bar Not Going to Bottom Summary

**Android DM input bar fix: switched KAV to padding behavior and added keyboardDidShow/Hide tracking with reduced bottom spacing**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-23T20:53:15Z
- **Completed:** 2026-02-23T20:54:20Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Fixed Android DM input bar floating in mid-screen after keyboard dismiss by switching KeyboardAvoidingView from behavior="height" to behavior="padding"
- Extended keyboard visibility tracking to Android using keyboardDidShow/keyboardDidHide events (iOS still uses keyboardWillShow/keyboardWillHide)
- Reduced Android bottom spacing below input pill: 4px when keyboard open, insets.bottom-4 (min 8px) when keyboard closed
- All iOS behavior preserved exactly as implemented in quick-9

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Android KeyboardAvoidingView behavior and add Android keyboard tracking** - `4f1cee0` (fix)

## Files Created/Modified

- `src/components/DMInput.js` - Extended keyboard tracking to both platforms with platform-appropriate events; updated bottomPadding calculation with Android-specific values
- `src/screens/ConversationScreen.js` - Changed both KeyboardAvoidingView instances from behavior="height" to behavior="padding" on Android (simplified to just behavior="padding" since both platforms now use same value)

## Decisions Made

- Used `behavior="padding"` instead of `behavior="height"` on Android -- the `height` behavior has a known React Native bug where it fails to recalculate after keyboard dismiss, leaving the input bar floating
- Used `keyboardDidShow`/`keyboardDidHide` for Android since Android does not fire `keyboardWill*` events -- iOS continues to use `keyboardWillShow`/`keyboardWillHide`
- Subtracted 4px from Android safe area inset (`insets.bottom - 4`) for resting state to tighten spacing while maintaining gesture bar clearance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Steps

- Remind user to deploy via EAS Update to both platforms to test on real Android device

## Self-Check: PASSED

- FOUND: src/components/DMInput.js
- FOUND: src/screens/ConversationScreen.js
- FOUND: .planning/quick/12-fix-android-dm-input-bar-not-going-to-bo/12-SUMMARY.md
- FOUND: commit 4f1cee0

---

_Quick Task: 12_
_Completed: 2026-02-23_
