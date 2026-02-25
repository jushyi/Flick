# Feature Landscape: v1.1 Pinned Snaps & Polish

**Domain:** Persistent lock screen content, privacy notifications, performance optimization, tech debt
**Researched:** 2026-02-25
**Confidence:** MEDIUM-HIGH (Live Activities ecosystem is still maturing in React Native/Expo; screenshot detection is well-established; darkroom optimization is HIGH confidence)

## Context: What Already Exists

The app shipped v1.0 messaging with:

- **Snap messages** -- camera-only ephemeral photo DMs, view-once with Polaroid-framed viewer, auto-cleanup on view
- **Snap streaks** -- 3-day activation, tiered expiry windows (36h/48h/72h), visual indicators on snap button/header/input
- **Darkroom system** -- photos captured in "developing" status, revealed after 0-5 minute random interval, three reveal triggers (App.js foreground check, DarkroomScreen focus, `processDarkroomReveals` cloud function every 2 minutes)
- **Push notifications** -- via `expo-notifications` and Expo Server SDK, FCM token stored per user
- **Existing message types** -- text, gif, snap, reaction, reply, tagged_photo
- **Platform support** -- iOS and Android with platform guards throughout

---

## Table Stakes (Users Expect These)

Features users assume exist once snaps and streaks are in place. Missing these makes the snap experience feel incomplete.

| Feature                                             | Why Expected                                                                                                                                  | Complexity | Notes                                                                                                                                                        |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Screenshot detection for snaps**                  | Snapchat pioneered this. Any app with ephemeral photo DMs must tell senders when content is captured. Without it, "view-once" is meaningless. | MEDIUM     | `expo-screen-capture` `addScreenshotListener()` during SnapViewer. Write `screenshotAt` to snap message doc, push notification to sender via Cloud Function. |
| **Screenshot notification to sender**               | Direct consequence of detection. Snapchat shows "X took a screenshot" as system message.                                                      | LOW        | Icon on snap message bubble + push notification. Recommend subtle icon (Instagram style) over system message (Snapchat style) to fit Flick's chill vibe.     |
| **Screen recording prevention during snap viewing** | Instagram and Snapchat both detect/prevent recording during ephemeral content viewing.                                                        | LOW        | `usePreventScreenCapture()` hook on SnapViewer mount. On iOS: blanks during recording. On Android: FLAG_SECURE.                                              |

## Differentiators (Competitive Advantage)

Features that set Flick apart. Not expected by users, but create delight and engagement.

| Feature                                  | Value Proposition                                                                                                                                                            | Complexity | Notes                                                                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pinned Snap via iOS Live Activity**    | Snap persists on lock screen with sender name and countdown timer. Creates urgency and visibility. No other disposable camera app uses Live Activities for received content. | HIGH       | `expo-live-activity` config plugin + Swift widget target. Predefined layout: image + title + countdown. Deep link back to conversation. iOS 16.2+ only. |
| **Android persistent snap notification** | Ongoing notification equivalent for Android users. Cannot be swiped away until snap is viewed or expires.                                                                    | MEDIUM     | Uses existing `expo-notifications` with `sticky: true` and custom notification channel. No new dependency.                                              |
| **Darkroom reveal timer optimization**   | Faster app opens, fewer Firestore reads (~80% reduction). Active users see immediate responsiveness.                                                                         | LOW        | AsyncStorage cache for `nextRevealAt`. Pure JS optimization, no new packages. OTA-deployable.                                                           |
| **App switcher privacy blur**            | Snap content blurred in iOS app switcher, blanked on Android. Prevents casual peek at snap content.                                                                          | LOW        | `enableAppSwitcherProtectionAsync(50)` in SnapViewer.                                                                                                   |
| **Darkroom countdown Live Activity**     | "Photos developing... 2:34 remaining" on lock screen. Makes darkroom mechanic tangible without opening app.                                                                  | MEDIUM     | Shares same Swift widget target as pinned snap. Uses iOS built-in countdown via `Text.DateStyle.timer`.                                                 |

## Anti-Features (Explicitly NOT Building)

| Anti-Feature                                    | Why Avoid                                                                                                                                                          | What to Do Instead                                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Screenshot blocking on iOS**                  | iOS does not allow preventing screenshots (OS limitation). Claiming "screenshot proof" would be misleading.                                                        | Detect and notify. Frame as "screenshot awareness" not "screenshot protection."                                                                               |
| **Live Activity showing actual snap photo**     | iOS Live Activities have a hard 4KB image limit. Snap photos are far too large. More importantly, showing the photo on lock screen defeats view-once ephemerality. | Show sender avatar (small, under 4KB) + "X sent you a snap" + tap-to-reveal CTA. The mystery drives engagement.                                               |
| **Custom SwiftUI Live Activity layout**         | Writing custom SwiftUI requires Swift knowledge and maintenance burden.                                                                                            | Use `expo-live-activity` preset layouts (title + subtitle + countdown). Sufficient for pinned snap display. Fallback to Voltra if customization needed later. |
| **Dynamic Island support (v1.1)**               | Additional complexity for iPhone 14 Pro+ only feature.                                                                                                             | Defer to v1.2. Lock screen is the primary value. Dynamic Island comes free if `expo-live-activity` supports it via config.                                    |
| **Push-to-start Live Activities from server**   | Requires iOS 17.2+, APNs cert management, cuts off iOS 16.x users.                                                                                                 | Start Live Activity client-side when push notification is received and app wakes. Explore push-to-start in v1.2.                                              |
| **Real-time countdown on Android notification** | Android does not have native countdown timer in notifications like iOS Live Activities.                                                                            | Show static "Snap from X -- tap to view" ongoing notification. Dismiss on tap or expiry.                                                                      |
| **Screenshot detection for all message types**  | Extending to non-ephemeral content creates anxiety and social friction. Instagram only notifies on ephemeral content.                                              | Scope to snap messages only. Ephemeral content deserves protection; regular messages do not.                                                                  |
| **Complex darkroom real-time listener**         | Persistent Firestore onSnapshot listener for a document that changes every 0-5 minutes. Battery drain for minimal benefit.                                         | Client-side timestamp cache. Compare locally, read Firestore only when cache indicates reveal time has passed.                                                |
| **Snap replay**                                 | Flick's view-once is stricter than Snapchat's by design -- matches disposable camera metaphor.                                                                     | Keep view-once strict. Users who want to keep a snap screenshot it -- and the sender gets notified.                                                           |

---

## Feature Dependencies

```
expo-screen-capture install --> Screenshot detection --> Screenshot notification
expo-live-activity install --> iOS Live Activity --> Pin snap UI in conversation
AsyncStorage cache --> Darkroom optimization (no dependency on other features)
Tech debt fixes --> Independent of all features (can be done in parallel)

Screenshot detection is INDEPENDENT of Live Activities.
Both share the EAS native build requirement but have no code dependencies.
```

### Dependency Notes

- **Both new native modules share one EAS build:** `expo-screen-capture` and `expo-live-activity` both require a native rebuild. Combine into one build cycle.
- **Darkroom optimization is fully independent:** Pure JS, OTA-deployable, no native build needed.
- **Android persistent notification is independent:** Uses existing `expo-notifications`, no native rebuild needed.
- **Tech debt is independent:** Can run in parallel with any feature work.
- **Darkroom countdown Live Activity shares widget target:** Same Swift extension target as pinned snap. Define two `ActivityConfiguration` layouts within it.

---

## MVP Recommendation

### Phase 1: Quick Wins (No Native Build)

Ship via OTA update immediately.

- Darkroom client-side reveal check optimization -- pure JS, reduces Firestore reads by ~80%, improves app responsiveness
- Tech debt resolution -- test gaps, stale assertions, variable naming, infra config (5 known items from v1.0)

### Phase 2: Screenshot Detection (Requires EAS Build)

Ship together with Phase 3 in one build.

- Screenshot detection for snap viewing -- `expo-screen-capture` `addScreenshotListener()` during SnapViewer
- Screen recording prevention during snap viewing -- `usePreventScreenCapture()` during SnapViewer
- Screenshot notification to sender -- write `screenshotAt` to snap doc, push notification via Cloud Function
- App switcher privacy blur -- `enableAppSwitcherProtectionAsync()` during snap viewing

### Phase 3: Live Activities (Requires Same EAS Build)

Combined with Phase 2 build.

- iOS Pinned Snap Live Activity -- `expo-live-activity` config plugin, Swift widget target, `liveActivityService.js`
- Android persistent snap notification -- `expo-notifications` with `sticky: true`, custom channel

### Deferred to v1.2+

- Darkroom countdown Live Activity (share widget target, lower priority)
- Push-to-start Live Activities (iOS 17.2+ only)
- Dynamic Island support (if not free via config)
- Android Live Updates (when Android 16 adoption is sufficient)

---

## Feature Prioritization Matrix

| Feature                              | User Value | Implementation Cost | Risk   | Priority |
| ------------------------------------ | ---------- | ------------------- | ------ | -------- |
| Darkroom client-side caching         | MEDIUM     | LOW                 | LOW    | P1       |
| Tech debt resolution                 | LOW        | LOW                 | LOW    | P1       |
| Screenshot detection for snaps       | HIGH       | MEDIUM              | LOW    | P1       |
| Screen recording prevention          | HIGH       | LOW                 | LOW    | P1       |
| Screenshot notification to sender    | HIGH       | LOW                 | LOW    | P1       |
| Pinned Snap Live Activity (iOS)      | MEDIUM     | HIGH                | MEDIUM | P2       |
| Android persistent snap notification | MEDIUM     | MEDIUM              | LOW    | P2       |
| App switcher privacy blur            | LOW        | LOW                 | LOW    | P2       |
| Darkroom Countdown Live Activity     | LOW        | MEDIUM              | MEDIUM | P3       |

**Priority key:**

- P1: Must have -- core privacy feature (screenshot) or easy performance win (caching)
- P2: Should have -- engagement differentiators with clear UX value
- P3: Nice to have -- delightful but not essential for the milestone

---

## Competitor Feature Analysis

| Feature                      | Snapchat                                  | Instagram                      | Lapse (original)          | Flick (v1.1 plan)                                                      |
| ---------------------------- | ----------------------------------------- | ------------------------------ | ------------------------- | ---------------------------------------------------------------------- |
| Screenshot detection (DMs)   | All chat content                          | View Once and Vanish Mode only | N/A (no DMs)              | Snap messages only                                                     |
| Screenshot notification UX   | System message in chat                    | Small icon next to message     | N/A                       | Icon on snap bubble + push to sender                                   |
| Screen recording prevention  | Detects and notifies                      | Detects on ephemeral content   | N/A                       | Prevent recording + detect screenshots                                 |
| Lock screen presence         | Widgets for camera access, streak display | Not prominent                  | Widget for camera capture | Live Activity for received snaps (iOS), ongoing notification (Android) |
| Persistent snap notification | Standard push                             | Standard push                  | Push when photos develop  | Ongoing notification (Android) + Live Activity (iOS)                   |

### Key Insight

Live Activities for social content is a genuinely unexplored space. Snapchat uses lock screen widgets for streaks and quick access, but no social app uses Live Activities to surface received ephemeral content. This is a real differentiator if executed well.

Screenshot detection scope matches content ephemerality across competitors: Snapchat detects on everything (ephemeral-first platform), Instagram only on explicitly ephemeral content. Flick should follow Instagram's model -- detect on snaps only.

---

## Sources

### Live Activities

- [expo-live-activity GitHub (Software Mansion Labs)](https://github.com/software-mansion-labs/expo-live-activity) -- MEDIUM confidence, early development
- [Voltra GitHub (Callstack)](https://github.com/callstackincubator/voltra) -- HIGH confidence, evaluated as fallback
- [Expo Live Activities Tutorial (Kutay, Dec 2025)](https://kutay.boo/blog/expo-live-activity/) -- MEDIUM confidence, community guide
- [Live Activities Implementation (Fizl)](https://fizl.io/blog/posts/live-activities) -- MEDIUM confidence, community guide

### Screenshot Detection

- [Expo ScreenCapture API (SDK 54)](https://docs.expo.dev/versions/v54.0.0/sdk/screen-capture/) -- HIGH confidence, official docs
- [expo-screen-capture Android 14+ Issue (#31678)](https://github.com/expo/expo/issues/31678) -- HIGH confidence, fix merged

### Competitor UX

- [Snapchat screenshot notification behavior](https://www.accio.com/blog/does-snapchat-notify-when-you-screenshot-a-story-a-complete-guide) -- community reference
- [Instagram screenshot notification scope](https://www.spocket.co/blogs/does-instagram-notify-when-you-screenshot-a-dm) -- community reference

### Darkroom Optimization

- Existing codebase analysis: `darkroomService.js`, `useDarkroom.js`, `App.js` -- HIGH confidence (primary source)

---

_Feature research for: Flick v1.1 -- Pinned Snaps, Screenshot Detection, Darkroom Optimization_
_Researched: 2026-02-25_
