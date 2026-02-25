# Research Summary: Flick v1.1 -- Pinned Snaps & Polish

**Domain:** iOS Live Activities, screenshot detection, darkroom optimization, tech debt resolution
**Researched:** 2026-02-25
**Overall confidence:** MEDIUM-HIGH

## Executive Summary

The v1.1 milestone adds three feature areas to Flick: pinned snaps via iOS Live Activities (with an Android ongoing notification fallback), screenshot detection for snap messages, and darkroom client-side reveal check optimization. Additionally, five known tech debt items from v1.0 need resolution.

The stack impact is minimal: only two new npm dependencies are needed. `expo-screen-capture` (official Expo SDK package, HIGH confidence) handles screenshot detection and screen recording prevention. `expo-live-activity` (Software Mansion Labs, MEDIUM confidence -- "early development stage") bridges iOS ActivityKit Live Activities to React Native. Both are native modules that require a new EAS build. The Android equivalent of Live Activities uses the already-installed `expo-notifications` with `sticky: true` ongoing notifications -- no new package needed.

The darkroom optimization is purely client-side: cache the `nextRevealAt` timestamp in AsyncStorage to avoid redundant Firestore reads on every app foreground. This eliminates approximately 80% of unnecessary darkroom document reads and can ship as an OTA update. The existing `processDarkroomReveals` Cloud Function (every 2 minutes) remains the server-side safety net.

The highest-risk area is iOS Live Activities. The `expo-live-activity` library is in early development with breaking changes possible in minor versions. It creates a Swift widget extension target via config plugin, and the Live Activity UI is defined through predefined layouts (title, subtitle, image, countdown timer). For Flick's pinned snap display (sender name + countdown + tap-to-view CTA), the predefined layouts are sufficient. Voltra (v1.2.0, Callstack) was evaluated as an alternative and is the documented fallback if `expo-live-activity` proves insufficient -- it offers JSX-to-SwiftUI rendering but adds unnecessary complexity for this use case.

## Key Findings

**Stack:** Two new dependencies needed: `expo-screen-capture` (screenshot detection, HIGH confidence) and `expo-live-activity` (iOS Live Activities, MEDIUM confidence). Android pinned snaps use existing `expo-notifications`. Darkroom optimization uses existing `AsyncStorage`.

**Architecture:** Three integration points -- `useScreenshotDetection` hook wrapping `expo-screen-capture` in SnapViewer, `liveActivityService.js` wrapping `expo-live-activity` with token management, and AsyncStorage caching layer in `darkroomService.js`.

**Critical pitfall:** The Live Activity widget extension runs in a separate iOS process with NO access to React Native, Firebase SDK, or app state. All snap data must be passed through ActivityKit attributes or App Groups shared UserDefaults. The Live Activity cannot display the snap photo (4KB image limit) -- only sender name and countdown.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Tech Debt + Darkroom Optimization** - Quick wins, no native build required
   - Addresses: 5 known tech debt items (test gaps, naming, infra config), darkroom caching optimization
   - Avoids: Shipping new native features on top of unresolved debt
   - Can ship as OTA update immediately

2. **Screenshot Detection** - Moderate complexity, requires EAS build
   - Addresses: `expo-screen-capture` integration, `useScreenshotDetection` hook, SnapViewer integration, `onSnapScreenshot` Cloud Function
   - Avoids: Over-scoping (detection on snap messages only, NOT all message types)
   - Requires new EAS build (native module)

3. **iOS Live Activity Foundation** - Highest complexity, iOS-only
   - Addresses: `expo-live-activity` setup, Swift widget target, `liveActivityService.js`, pin/unpin UI in conversation
   - Avoids: Scope creep into Dynamic Island, push-to-start, server-initiated activities
   - Requires EAS build (combine with Phase 2 build to avoid two build cycles)

4. **Android Persistent Notification + Polish** - Lower complexity, uses existing packages
   - Addresses: Android ongoing notification for snaps, notification channel setup, dismissal on view
   - Avoids: Attempting full Android Live Updates parity (no stable RN bridge exists)
   - Can ship as OTA update after Phase 2/3 build

**Phase ordering rationale:**

- Tech debt first: clean foundation before adding complexity
- Screenshot detection before Live Activities: simpler feature validates native build pipeline
- Combine Phase 2 and 3 into one EAS build to avoid multiple rebuild cycles
- Android notification last: uses existing infrastructure, lowest risk, independent of iOS work

**Research flags for phases:**

- Phase 3: `expo-live-activity` is early-stage. Pin version strictly. Have Voltra as documented fallback.
- Phase 2: Verify `expo-screen-capture` screenshot listener works on Android 14+ in SDK 54 build. Known issue (#31678) has fix merged but needs runtime verification.
- Phase 1: Standard patterns, no additional research needed.
- Phase 4: Standard `expo-notifications` usage, verify `sticky` property support.

## Confidence Assessment

| Area         | Confidence  | Notes                                                                                                                                              |
| ------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | MEDIUM-HIGH | `expo-screen-capture` is HIGH (official Expo); `expo-live-activity` is MEDIUM (early development); Android notification is HIGH (existing package) |
| Features     | MEDIUM-HIGH | Screenshot detection is well-established (Snapchat/Instagram pattern). Live Activities in RN is newer territory but multiple tutorials exist.      |
| Architecture | HIGH        | Extends existing service/hook/component layers. No new architectural patterns needed.                                                              |
| Pitfalls     | HIGH        | Verified against official Apple/Firebase/Expo docs, GitHub issues, and existing codebase analysis                                                  |

## Gaps to Address

- **`expo-live-activity` SDK 54 compatibility:** Not explicitly documented. Uses Expo Module API which is SDK-stable, but runtime verification needed during `npx expo prebuild`.
- **`expo-screen-capture` exact version for SDK 54:** Auto-resolved by `npx expo install`. Version ~8.0.x expected but exact number not confirmed via web research.
- **Live Activity push token via FCM:** Firebase docs describe FCM HTTP v1 API supporting `live_activity_token` field for APNs Live Activity pushes. Not verified in practice with `expo-live-activity` specifically.
- **Android `sticky` notification support in `expo-notifications`:** `sticky` and `autoCancel: false` properties should work but need verification in SDK 54 build.
- **`expo-live-activity` vs Expo SDK 55 `expo-widgets`:** SDK 55 introduces official widget/Live Activity support. If the project upgrades to SDK 55 during or after v1.1, migration path from `expo-live-activity` to `expo-widgets` needs evaluation.

---

_Research summary: Flick v1.1 -- Pinned Snaps & Polish_
_Researched: 2026-02-25_
