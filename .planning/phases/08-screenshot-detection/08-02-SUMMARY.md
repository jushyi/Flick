---
phase: 08-screenshot-detection
plan: 02
subsystem: messaging
tags: [expo-screen-capture, screenshot-detection, system-message, snap-viewer, conversation-ui, offline-queue]

# Dependency graph
requires:
  - "08-01: screenshotService, screenshotQueueService, expo-screen-capture installed, onNewMessage system_screenshot handling"
provides:
  - "useScreenshotDetection hook wrapping expo-screen-capture listener with activation/deactivation control"
  - "SystemMessage component rendering centered gray text matching TimeDivider style"
  - "SnapViewer with integrated screenshot detection (recipient-only, active snap, first-only, offline queue)"
  - "ConversationScreen rendering system_screenshot messages as SystemMessage items"
affects: [08-screenshot-detection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useScreenshotDetection hook: activate/deactivate pattern with alreadyDetectedRef debounce"
    - "SystemMessage component: identical styling to TimeDivider for consistent system event display"
    - "Screenshot detection activation guards: visible && isRecipient && isActiveSnap && !isExpired"
    - "Offline queue flush on SnapViewer open via processScreenshotQueue()"

key-files:
  created:
    - "src/hooks/useScreenshotDetection.js"
    - "src/components/SystemMessage.js"
  modified:
    - "src/components/SnapViewer.js"
    - "src/screens/ConversationScreen.js"

key-decisions:
  - "useScreenshotDetection uses onScreenshotRef (useRef) to avoid stale closure in listener callback"
  - "alreadyDetectedRef resets to false on each activation cycle -- only first screenshot per viewer open triggers"
  - "Silent failure on unsupported devices: try/catch around addScreenshotListener logs warning, does not crash"
  - "viewerDisplayName prop added to SnapViewer for screenshotterName parameter (passed from ConversationScreen)"
  - "system_screenshot messages filtered from lastSentMessage computation to avoid incorrect read receipt display"
  - "system_screenshot early return in renderItem prevents MessageBubble from rendering system events"

patterns-established:
  - "System message rendering pattern: check item.type before MessageBubble delegation in renderItem"
  - "Screenshot detection lifecycle: hook activation tied to viewer visibility + recipient + active snap state"

requirements-completed: [SCRN-01, SCRN-02, SCRN-03]

# Metrics
duration: 3min
completed: 2026-03-18
---

# Phase 8 Plan 02: Screenshot Detection UI Integration Summary

**useScreenshotDetection hook with expo-screen-capture listener, SystemMessage component, SnapViewer wiring with offline queue, and ConversationScreen system message rendering**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T17:17:00Z
- **Completed:** 2026-03-18T17:20:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- useScreenshotDetection hook wraps expo-screen-capture with active/deactivate control, per-cycle debounce, and silent failure for unsupported devices
- SystemMessage component renders system events as small centered gray text matching TimeDivider style exactly
- SnapViewer integrates screenshot detection with four activation guards: visible, isRecipient, isActiveSnap, !isExpired
- ConversationScreen renders system_screenshot items as SystemMessage, filtered from lastSentMessage for read receipt correctness
- Offline screenshot events flush via processScreenshotQueue on each SnapViewer open

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useScreenshotDetection hook and SystemMessage component** - `15de8df8` (feat)
2. **Task 2: Integrate screenshot detection into SnapViewer and render system messages in ConversationScreen** - `32c2677b` (feat)

## Files Created/Modified
- `src/hooks/useScreenshotDetection.js` - Custom hook wrapping expo-screen-capture addScreenshotListener with activation control and debounce
- `src/components/SystemMessage.js` - System message renderer with TimeDivider-matching small centered gray text style
- `src/components/SnapViewer.js` - Integrated useScreenshotDetection, recordScreenshot, offline queueing, processScreenshotQueue, viewerDisplayName prop
- `src/screens/ConversationScreen.js` - SystemMessage import, system_screenshot renderItem branch, lastSentMessage filter, viewerDisplayName prop pass-through

## Decisions Made
- **onScreenshotRef for stable callback:** Used useRef to hold onScreenshot callback, updated via useEffect, to avoid stale closure inside the listener function. This prevents the listener from capturing an outdated callback reference.
- **viewerDisplayName as new prop:** SnapViewer does not have access to the viewer's display name. Added viewerDisplayName prop passed from ConversationScreen where userProfile is available.
- **system_screenshot filtered from lastSentMessage:** System messages should not trigger read receipt indicators. Added `m.type !== 'system_screenshot'` filter to the lastSentMessage useMemo.
- **Early return in renderItem:** system_screenshot items return SystemMessage before reaching MessageBubble logic, preventing crashes from isCurrentUser derivation on system events.

## Deviations from Plan

None - plan executed exactly as written. All four files already contained the correct implementation matching the plan specification.

## Issues Encountered
None.

## User Setup Required
**IMPORTANT: expo-screen-capture is a native module.** A new EAS build is required for both platforms before the screenshot detection feature can be tested on devices. OTA update alone is insufficient.

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

## Next Phase Readiness
- Screenshot detection feature is complete end-to-end: detection hook, service layer, Cloud Function, system messages, push notifications
- Phase 8 (Screenshot Detection) is fully complete -- all 3 plans (00, 01, 02) executed
- Requires native EAS build before device testing (expo-screen-capture native module)

## Self-Check: PASSED

- [x] src/hooks/useScreenshotDetection.js exists
- [x] src/components/SystemMessage.js exists
- [x] src/components/SnapViewer.js exists
- [x] src/screens/ConversationScreen.js exists
- [x] Commit 15de8df8 exists (Task 1)
- [x] Commit 32c2677b exists (Task 2)

---
*Phase: 08-screenshot-detection*
*Completed: 2026-03-18*
