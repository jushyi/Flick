# Pitfalls Research: v1.1 Pinned Snaps & Polish

**Domain:** iOS Live Activities for snap pinning, Android equivalent, screenshot detection integration, darkroom optimization, and tech debt resolution -- all added to an existing production React Native + Expo app
**Researched:** 2026-02-25
**Confidence:** MEDIUM-HIGH (verified against official Apple/Google/Expo docs, GitHub issues, existing codebase analysis; Live Activities in RN is newer territory with fewer battle-tested patterns)

## Critical Pitfalls

### Pitfall 1: Live Activity Widget Extension Cannot Access React Native State or Firebase SDK

**What goes wrong:**
You try to display snap data (sender name, photo thumbnail, countdown timer) in the Live Activity widget, but the widget extension runs in a completely separate process from the React Native app. It has no access to Firestore, no access to AuthContext, no access to expo-image cache, and no access to the Firebase SDK. The widget renders blank or crashes because you assumed shared state.

**Why it happens:**
iOS Widget Extensions (which power Live Activities) are isolated targets in Xcode. They have their own bundle, their own process, and cannot import React Native modules or Firebase SDKs. The Live Activity UI is SwiftUI-only -- you cannot use React Native components. Developers coming from React Native assume the widget is "just another screen" but it is architecturally a separate app.

**How to avoid:**

- Accept that the Live Activity widget extension is native Swift/SwiftUI only. No React Native code runs there.
- Use **App Groups** to share data between the main app and the widget extension. The React Native side writes snap data to a shared `UserDefaults` suite (via an Expo native module), and the widget reads from the same suite.
- Keep the Live Activity UI minimal: sender display name, countdown text ("5:00 remaining"), and a static icon. Do NOT try to load photos in the widget (Live Activities cannot make web requests and cannot easily load images hosted on the web -- they are limited to bundled assets and SF Symbols).
- For dynamic updates, use **ActivityKit push notifications** via APNs, which requires a separate server-side push pipeline (different from the existing `expo-notifications` / FCM pipeline). The Cloud Function must send APNs pushes directly to the Live Activity push token, not through FCM.
- Consider using `expo-live-activity` from Software Mansion Labs for a simplified bridge, but understand its limitation: it offers a predefined SwiftUI layout (title, subtitle, progress, image) with no custom SwiftUI views. If the snap pin UI needs custom layout, you will need a custom Expo native module.

**Warning signs:**

- Widget extension fails to build because it imports `@react-native-firebase/firestore`
- Live Activity shows stale data because it cannot read Firestore in real-time
- Push updates to the Live Activity fail because they use FCM instead of APNs

**Phase to address:**
Phase 1 (Live Activities for iOS) -- the architecture must be designed around the process isolation constraint from day one. This is not something you can fix with a patch later.

---

### Pitfall 2: Live Activity Push Token Management is Separate from FCM Tokens

**What goes wrong:**
You send a Live Activity update using the user's existing FCM push token (stored in the `users` Firestore document as `fcmToken`). Nothing happens. The Live Activity stays frozen. Meanwhile, the Activity's push token changes mid-lifecycle and you miss the update because you only captured the initial token.

**Why it happens:**
ActivityKit Live Activities have their **own push tokens** that are completely separate from the FCM/APNs push tokens used by `expo-notifications`. Each Live Activity instance generates a unique push token when started, and this token can change during the activity's lifecycle (e.g., when the activity transitions between states). The existing `fcmToken` in the user's Firestore document is useless for Live Activity updates.

**How to avoid:**

- When a Live Activity is started from the React Native side (via the native module bridge), capture the activity's push token and send it to a Cloud Function that stores it in Firestore (e.g., `liveActivities/{activityId}` with `pushToken`, `userId`, `snapId`, `createdAt`).
- Subscribe to `Activity.pushTokenUpdates` in the native module and forward new tokens to the Cloud Function whenever they change.
- Use APNs HTTP/2 API directly from Cloud Functions to send updates (not FCM). This requires an APNs authentication key (.p8 file) stored as a Firebase secret, and a different push payload format than FCM.
- Track multiple concurrent activities: a user could have multiple pinned snaps, each with its own push token.

**Warning signs:**

- Live Activity updates work in development (via ActivityKit local update) but fail in production (push updates do not arrive)
- Token stored once at activity creation becomes stale and updates silently fail
- Cloud Function uses `admin.messaging().send()` (FCM) instead of APNs HTTP/2 for Live Activity updates

**Phase to address:**
Phase 1 (Live Activities for iOS) -- token management is the hardest part of the implementation and must be solved before any push-based update logic.

---

### Pitfall 3: Removing Client-Side Darkroom Reveal Triggers Breaks the User Experience

**What goes wrong:**
The v1.1 goal is to optimize darkroom reveals by reducing redundant client-side checks. You remove one or both client-side triggers (App.js foreground check, DarkroomScreen focus check) and rely solely on the `processDarkroomReveals` Cloud Function that runs every 2 minutes. Result: users open the darkroom and see "developing" photos that should have been revealed minutes ago. The app feels broken because the Cloud Function has up to a 2-minute lag, and if the function execution is delayed (cold start, GCP scheduling variance), the lag can be 3-5 minutes.

**Why it happens:**
The three reveal triggers exist for a reason -- they are not truly "redundant":

1. **App.js foreground check** (`isDarkroomReadyToReveal` + `revealPhotos`): catches reveals when user returns to app after backgrounding
2. **DarkroomScreen focus check** (same logic in `useDarkroom.loadDevelopingPhotos`): catches reveals when user navigates to darkroom
3. **Cloud Function `processDarkroomReveals`** (every 2 min): catches reveals when app is not open at all

Removing #1 or #2 means the user must wait for #3 to run, which introduces noticeable lag. The Cloud Function is a background safety net, not the primary mechanism.

**How to avoid:**

- **Do NOT remove** the DarkroomScreen focus check (#2). This is the critical path -- the user expects instant reveals when they open the darkroom.
- The App.js foreground check (#1) can potentially be optimized but not removed. The optimization: only run the check if `nextRevealAt` is in the past (which it already does via `isDarkroomReadyToReveal`). The real optimization opportunity is reducing Firestore reads by caching `nextRevealAt` locally and only hitting Firestore when the cached time has passed.
- The Cloud Function (#3) should remain as the background safety net for users who do not open the app.
- If the goal is reducing Firestore reads, cache `nextRevealAt` in AsyncStorage after each check. On foreground/focus, compare `Date.now()` to the cached value first. Only call `isDarkroomReadyToReveal` (which does a Firestore read) if the cached time has passed.

**Warning signs:**

- After optimization, users report "my photos are stuck on developing"
- Darkroom shows developing photos for several minutes after the reveal time has passed
- The countdown timer in the darkroom reaches zero but photos do not flip to revealed

**Phase to address:**
Phase 3 (Darkroom Optimization) -- this must be approached as a caching optimization, not a trigger removal. All three triggers should remain; the optimization is in reducing unnecessary Firestore reads.

---

### Pitfall 4: `expo-screen-capture` Crashes on Android 14 with Wrong SDK Version

**What goes wrong:**
You add `expo-screen-capture` to the project, build a new EAS binary, and it immediately crashes on Android 14 devices with the error "The current activity is no longer available" (`MissingActivity` exception in `ScreenCaptureModule`). The app is completely unusable on Android 14 -- not just the screenshot feature, but the entire app crashes on startup.

**Why it happens:**
In `expo-screen-capture` versions prior to SDK 51, the module attempted to access the Android activity reference during initialization, which on Android 14 (SDK 34) would fail because the activity reference was not yet available. This was a hard crash, not a graceful degradation. The fix was merged in PR #28244 and shipped in Expo SDK 51.

**How to avoid:**

- Flick uses Expo SDK 54, which includes the fix. **Verify this before building.** Check that `expo-screen-capture` resolves to version 6.x+ (the version shipped with SDK 54, not a manually pinned older version).
- Run `npx expo install expo-screen-capture` to install the SDK-compatible version, never `npm install expo-screen-capture@latest` or a manually pinned version.
- Test the EAS build on an Android 14 physical device before production deployment. Do not rely on emulator-only testing.
- Wrap all `expo-screen-capture` calls in platform checks and try/catch blocks to prevent a secondary crash path:
  ```javascript
  try {
    if (Platform.OS === 'android') {
      await ScreenCapture.preventScreenCaptureAsync();
    }
  } catch (error) {
    logger.warn('Screen capture prevention failed', { error: error.message });
    // Gracefully degrade -- snap viewing still works, just without capture prevention
  }
  ```

**Warning signs:**

- Android 14 crash reports immediately after EAS build deployment
- Crash log contains `MissingActivity` or `ScreenCaptureModule` in the stack trace
- App crashes before any screen renders (crash during module initialization, not during use)

**Phase to address:**
Phase 2 (Screenshot Detection) -- verify SDK compatibility during the initial EAS build that adds the native module. This is a build-time concern, not a runtime concern.

---

### Pitfall 5: Firestore TTL Policy on `messages` Collection Retroactively Deletes Existing Data

**What goes wrong:**
You configure the Firestore TTL policy on the `messages` collection group with the `expiresAt` field (INFRA-03 from tech debt). The policy activates, and within 24 hours it bulk-deletes every existing snap message document that has an `expiresAt` timestamp in the past. This includes snap messages that were already viewed and processed correctly -- they just had not been cleaned up yet by the `cleanupExpiredSnaps` function. If any of those documents were still needed for conversation context (e.g., "Replied to a snap" references), the reply context is now orphaned.

**Why it happens:**
Per official Firestore TTL docs: "Applying a TTL policy on an existing collection group results in a bulk deletion of all expired data according to the new TTL policy." This is by design. The TTL system does not distinguish between "old data that should have been cleaned up" and "old data that is still needed." Any document in the `messages` collection group where `expiresAt` is in the past will be deleted once the policy is active.

Additionally, TTL deletion does NOT delete subcollections. If snap messages had any subcollections (they do not currently, but this is a future-proofing concern), those would be orphaned.

**How to avoid:**

- **Audit existing data before enabling TTL.** Run a query to count how many `messages` documents have `expiresAt` in the past:
  ```javascript
  // In Cloud Shell or admin script
  const expired = await db
    .collectionGroup('messages')
    .where('expiresAt', '<=', admin.firestore.Timestamp.now())
    .count()
    .get();
  console.log(`Documents that will be deleted: ${expired.data().count}`);
  ```
- Ensure that `expiresAt` is ONLY set on snap-type messages, not on text/reaction/reply/tagged_photo messages. Verify this in the `onNewMessage` Cloud Function. If any non-snap message accidentally has an `expiresAt` field, TTL will delete it.
- Consider that `cleanupExpiredSnaps` already handles expired snaps every 2 hours. TTL is truly a safety net for edge cases where the scheduled function misses documents. The risk of enabling TTL may outweigh its benefit if the existing cleanup is reliable.
- If proceeding: run the audit, verify only snap messages have `expiresAt`, accept that existing expired snap docs will be bulk-deleted (which is likely fine since they were already expired), and monitor for 48 hours after activation.

**Warning signs:**

- After TTL activation, reply messages show broken "Replied to a snap" references because the original snap document was deleted
- Unexpected document count drops in the `messages` collection
- TTL policy takes over 10 minutes to become active (per docs, this is normal for large collections)

**Phase to address:**
Phase 4 (Tech Debt - INFRA-03) -- the TTL configuration is a one-time infrastructure task but requires careful auditing of existing data first.

---

### Pitfall 6: GCS Lifecycle Rule Deletes Active (Unviewed) Snap Photos

**What goes wrong:**
You configure the Firebase Storage (GCS) lifecycle rule to delete objects in the `snap-photos/` prefix older than 7 days (INFRA-04 from tech debt). A user sends a snap, the recipient does not open the app for 8 days, and when they finally open the conversation the snap photo file is already deleted from Storage. The signed URL returns 404. The snap message document still exists in Firestore (pointing to a deleted file), so the UI shows a broken snap.

**Why it happens:**
GCS lifecycle rules evaluate objects based on their creation timestamp (`age` condition), not based on whether the photo has been viewed or is still needed. The rule is retroactive -- it applies to existing objects immediately (within 24 hours of rule activation). The 7-day window was designed as a safety net, but it becomes the primary deletion mechanism for users who do not open the app frequently.

Additionally, per GCS docs: "Changes to a bucket's lifecycle configuration can take up to 24 hours to go into effect, and Object Lifecycle Management might still perform actions based on the old configuration during this time."

**How to avoid:**

- Choose the lifecycle age carefully. 7 days may be too aggressive. The `cleanupExpiredSnaps` Cloud Function already handles cleanup of unviewed snaps after their `expiresAt` timestamp (currently set during snap creation). The GCS lifecycle rule should have a longer age than any possible snap lifetime -- e.g., 14 or 30 days -- to serve as a true last-resort safety net, not a primary cleanup path.
- Use `matchesPrefix: ["snap-photos/"]` in the lifecycle rule condition (already planned in INFRA-04 comments) to ensure only snap photos are affected, not feed photos, profile photos, or other Storage content.
- Verify the lifecycle rule JSON before applying to production:
  ```json
  {
    "rule": [
      {
        "action": { "type": "Delete" },
        "condition": { "age": 14, "matchesPrefix": ["snap-photos/"] }
      }
    ]
  }
  ```
- Test on the dev Firebase project (`re-lapse-fa89b`) first, not production (`flick-prod-49615`). Upload test files to `snap-photos/`, wait for the rule to take effect, and verify only the intended files are deleted.
- Verify that soft-delete is enabled on the bucket (GCS default: 7-day soft-delete retention). This provides a recovery window if the rule deletes something it should not have.

**Warning signs:**

- Users report "snap not found" or blank snap viewers after the lifecycle rule is activated
- Storage file count drops sharply within 24 hours of rule activation
- The `getSignedSnapUrl` Cloud Function starts returning "File not found" errors for recently sent snaps

**Phase to address:**
Phase 4 (Tech Debt - INFRA-04) -- configure with a longer age (14+ days) and test on dev project first.

---

### Pitfall 7: Android "Live Updates" Have No Stable React Native Bridge

**What goes wrong:**
You commit to building an Android equivalent of iOS Live Activities using Android 14's "Live Updates" API, expecting a comparable developer experience. You discover that: (a) the Android Live Updates API requires Kotlin implementation with no React Native bridge library, (b) the API surface is completely different from ActivityKit, (c) it requires a foreground service type declaration in the manifest, and (d) the feature scope balloons into a separate native module project.

**Why it happens:**
iOS Live Activities have multiple React Native bridge libraries (`expo-live-activity`, `react-native-live-activity`, custom Expo modules). Android Live Updates (introduced in Android 14) have zero production-ready React Native libraries. The Android implementation requires:

1. Kotlin native module in `android/` directory
2. Foreground service type declaration in `AndroidManifest.xml` (`<service android:foregroundServiceType="...">`)
3. `FOREGROUND_SERVICE` permission and type-specific permissions (e.g., `FOREGROUND_SERVICE_SPECIAL_USE`)
4. Notification channel setup and persistent notification management
5. Battery optimization exemptions (Android will kill foreground services in Doze mode)

This is 5-10x the effort of the iOS implementation.

**How to avoid:**

- **Do not commit to full parity.** The v1.1 milestone should ship iOS Live Activities and defer Android to a research/exploration task, not a required deliverable.
- For Android, use an **enhanced notification** approach instead of Live Updates: send a high-priority FCM notification with a custom layout (expandable notification with countdown) that updates via data-only FCM pushes. This uses existing infrastructure (FCM + `expo-notifications`) and requires no native module.
- If Android Live Updates are required, budget 2-3x the iOS development time and plan for a native Kotlin module. Do not attempt to share code between iOS SwiftUI and Android Kotlin -- they are completely different APIs.
- Be aware of Android background restrictions: manufacturers like Samsung, Xiaomi, and Huawei aggressively kill foreground services. A foreground service that works on a Pixel may not survive on a Samsung Galaxy. Use Notifee's documentation on background restrictions as a reference.

**Warning signs:**

- The Android implementation is scoped at "same as iOS, just Android" with equal time estimates
- No native Android developer is available for Kotlin module development
- Testing only on Pixel devices (which have the least aggressive battery optimization)

**Phase to address:**
Phase 1 (Live Activities) -- decide iOS-only vs cross-platform scope before any implementation begins. The milestone context suggests "Android equivalent exploration" which is the correct framing: exploration, not commitment.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut                                                               | Immediate Benefit                                        | Long-term Cost                                                                                                                      | When Acceptable                                                                                             |
| ---------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Using `expo-live-activity` predefined layout instead of custom SwiftUI | Ship in days instead of weeks; no Swift knowledge needed | Cannot customize beyond title/subtitle/progress/image; locked to library's update cycle; must rewrite if UI needs change            | Acceptable for v1.1 MVP if the predefined layout matches snap pin requirements                              |
| Skipping APNs push for Live Activities, using local updates only       | No server-side APNs setup needed; simpler architecture   | Live Activity cannot update when app is backgrounded or killed; snap timer freezes on lock screen                                   | Never for production -- defeats the purpose of a lock screen timer                                          |
| Caching `nextRevealAt` in component state instead of AsyncStorage      | No async storage overhead; simpler code                  | Lost on app restart; multiple components may cache different values; no persistence across foreground/background cycles             | Only for within-session optimization; AsyncStorage needed for cross-session                                 |
| Adding screenshot detection to all screens instead of just snap viewer | Simpler implementation (one global toggle)               | Users cannot screenshot their own feed, profile, or settings; permission dialog appears at app start instead of during snap viewing | Never -- screen capture prevention must be scoped to snap viewing only                                      |
| Enabling Firestore TTL without auditing existing documents             | Quick one-command setup; tech debt resolved immediately  | Unexpected bulk deletion of expired documents; possible data loss for reply references                                              | Never without audit -- the 5 minutes of auditing prevents hours of debugging                                |
| Using 7-day GCS lifecycle age matching the existing comment in code    | Matches documented plan; simple configuration            | Too aggressive for infrequent users who may not open snaps within 7 days                                                            | Only if the scheduled cleanup (`cleanupExpiredSnaps`) is verified reliable and runs before the 7-day window |

## Integration Gotchas

Common mistakes when connecting Live Activities and screen capture to the existing snap infrastructure.

| Integration                                                  | Common Mistake                                                                                                         | Correct Approach                                                                                                                                                                                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live Activity + existing snap viewer                         | Starting a Live Activity for every snap received, even if the user has the app open                                    | Only start a Live Activity when the app is backgrounded or the snap is "pinned" by the user. Do not create activities for snaps the user is actively viewing.                                                                         |
| Live Activity + `onNewMessage` Cloud Function                | Extending `onNewMessage` to also manage Live Activity push tokens and APNs updates                                     | Create a **separate** Cloud Function for Live Activity management. `onNewMessage` is already the routing hub for 5 message types -- adding APNs push logic increases its complexity and cold start time.                              |
| `expo-screen-capture` + snap viewer                          | Calling `preventScreenCaptureAsync` globally in App.js                                                                 | Use `usePreventScreenCapture()` hook in the SnapViewer component only. Pair with `useFocusEffect` to enable on snap screen focus and disable on blur. This prevents blocking screenshots everywhere in the app.                       |
| `expo-screen-capture` + existing camera flow                 | Forgetting that `preventScreenCaptureAsync` sets `FLAG_SECURE` on Android, which also blocks the camera preview        | If the snap camera and snap viewer share a navigation stack, ensure `allowScreenCaptureAsync()` is called before the camera screen mounts. `FLAG_SECURE` hides the entire window, including the camera viewfinder.                    |
| Darkroom optimization + existing `ensureDarkroomInitialized` | Removing the inline reveal logic in `ensureDarkroomInitialized` (lines 182-213 of darkroomService.js) during "cleanup" | This inline logic exists to avoid circular imports with `photoService`. It also handles the stale-darkroom-on-capture case. Removing it breaks photo capture for users with overdue reveals. Optimize the callers, not this function. |
| Firestore TTL + `cleanupExpiredSnaps` function               | Assuming TTL replaces the scheduled cleanup function and removing it                                                   | TTL takes up to 24 hours; the scheduled function runs every 2 hours. They serve different time windows. Keep both: scheduled function for prompt cleanup, TTL for true orphans.                                                       |
| GCS lifecycle + `onSnapViewed` function                      | Assuming the lifecycle rule replaces the view-triggered deletion                                                       | The lifecycle rule uses a days-based age condition (minimum 1 day granularity). `onSnapViewed` deletes immediately on view. They cannot replace each other. Both are needed.                                                          |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap                                                                     | Symptoms                                                                                            | Prevention                                                                                                                | When It Breaks                                                          |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Starting a Live Activity for every incoming snap                         | Battery drain, "too many activities" OS error (iOS limits to ~5 concurrent activities)              | Only start Live Activities for explicitly "pinned" snaps, not all incoming snaps. Let the user choose which snaps to pin. | > 5 concurrent snap conversations per user                              |
| Darkroom `isDarkroomReadyToReveal` called on every foreground event      | Extra Firestore read every time user switches apps, even if reveal is hours away                    | Cache `nextRevealAt` timestamp locally. Compare `Date.now()` to cache. Only hit Firestore if cached time has passed.      | > 500 DAU foregrounding app 10+ times/day = 5000+ unnecessary reads/day |
| `addScreenshotListener` registered globally with no cleanup              | Listener accumulates on every screen navigation (memory leak), callback fires on irrelevant screens | Use `useEffect` cleanup or `useFocusEffect` to add/remove the listener only on snap viewer screens                        | > 50 screen navigations per session (listener count grows linearly)     |
| Live Activity push token stored only in memory, not persisted            | Token lost on app restart; Live Activity cannot receive updates until next app open                 | Store activity ID + push token mapping in Firestore via Cloud Function immediately on activity start                      | App killed by OS while Live Activity is visible on lock screen          |
| Querying all `snap-photos/` in GCS to check lifecycle rule effectiveness | Full bucket listing on large Storage buckets is extremely slow and expensive                        | Use Firestore document queries (which have indexes) to check snap status; only access GCS for specific files              | > 10,000 snap photos in Storage                                         |

## Security Mistakes

Domain-specific security issues for v1.1 features.

| Mistake                                                        | Risk                                                                                                                   | Prevention                                                                                                                                                                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live Activity displays snap photo content on lock screen       | Anyone who picks up the phone can see the snap content without unlocking -- defeats ephemeral purpose                  | Live Activity should show only sender name and countdown timer, NEVER the snap photo. Photos are viewed only inside the authenticated app.                                                                      |
| APNs push token for Live Activity stored without scoping       | Leaked token allows anyone to send arbitrary updates to the user's Live Activity                                       | Store tokens in Firestore with strict security rules: only the Cloud Function (admin SDK) can write, and tokens are scoped to user ID + activity ID. Delete token document when activity ends.                  |
| `preventScreenCaptureAsync` disabled during screen transitions | Brief window between snap viewer unmount and new screen mount where FLAG_SECURE is lifted, allowing a timed screenshot | Add a small delay (100ms) before calling `allowScreenCaptureAsync()` on blur, or use a wrapper component that keeps prevention active during transitions.                                                       |
| Screenshot notification reveals sender metadata                | Push notification for "User X screenshotted your snap" leaks that the recipient viewed the snap and when               | This is acceptable social behavior (Snapchat does this). But ensure the notification does not include additional metadata (message content, conversation ID in the payload visible to notification extensions). |
| Firestore TTL deletes snap documents but not related data      | Snap is deleted by TTL, but the conversation's `lastMessage` preview still says "Snap" with no document to reference   | When setting `expiresAt` on snap messages, also set a `lastMessage` fallback in the conversation document that says "Snap expired" or similar, so the conversation list does not break.                         |

## UX Pitfalls

Common user experience mistakes for v1.1 features.

| Pitfall                                                      | User Impact                                                                                                                                                                           | Better Approach                                                                                                                                                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Live Activity auto-starts for all snaps without user opt-in  | Lock screen fills with snap activities; feels spammy; user disables Live Activities entirely in iOS Settings                                                                          | Let the user explicitly "pin" a snap to the lock screen via a button in the snap viewer or conversation. Default: no Live Activity.                                                                                            |
| Screenshot detection notification is delayed                 | Sender gets "X screenshotted your snap" notification 5 minutes later (if routed through FCM + Cloud Function). Feels unreliable.                                                      | Send screenshot notification via the existing `onNewMessage` pipeline with high priority. Consider local notification on the sender's device if both users are in the same conversation in real-time.                          |
| Darkroom optimization removes visual feedback during "check" | Previously, user saw a brief loading state while darkroom checked reveal status. After optimization, cached check returns instantly but photos might not reflect latest server state. | Always show a brief loading shimmer (minimum 300ms) when entering darkroom to mask any cache-vs-server inconsistency. Fetch server state in background and update if different.                                                |
| Screen goes completely black during snap viewing (Android)   | On Android, `preventScreenCaptureAsync` sets `FLAG_SECURE` which blacks out the entire window in recent apps / screen recording. User thinks the app crashed.                         | Show a clear "This content is protected" overlay or message when the user tries to screenshot, rather than silently blacking out. On iOS, use `enableAppSwitcherProtectionAsync(blurIntensity)` for a blurred overlay instead. |
| Live Activity timer shows wrong time after timezone change   | User travels to a new timezone; the Live Activity countdown was calculated client-side and is now off by hours                                                                        | Calculate all countdown values server-side using UTC timestamps. The Live Activity widget should display countdown-to-UTC-target, not a duration calculated at creation time.                                                  |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Live Activity (iOS):** Often missing push token persistence -- verify activity push tokens are sent to Cloud Function and stored in Firestore, not just held in memory
- [ ] **Live Activity (iOS):** Often missing token refresh handling -- verify `Activity.pushTokenUpdates` is observed and new tokens are forwarded to server
- [ ] **Live Activity (iOS):** Often missing activity cleanup -- verify `Activity.end()` is called when snap expires or is viewed, and the Firestore token document is deleted
- [ ] **Live Activity (iOS):** Often missing App Group configuration -- verify the main app target and widget extension target share an App Group for data passing
- [ ] **Live Activity (iOS):** Often missing APNs entitlement -- verify the widget extension has the push notification entitlement configured in the provisioning profile and EAS build config
- [ ] **Screenshot detection:** Often missing Android permission for API < 14 -- verify `READ_MEDIA_IMAGES` is in AndroidManifest.xml and permission is requested at runtime
- [ ] **Screenshot detection:** Often missing Android 14+ registration workaround -- verify `allowScreenCaptureAsync()` is called before `addScreenshotListener()` on Android 14+ to trigger callback registration
- [ ] **Screenshot detection:** Often missing scope isolation -- verify `preventScreenCaptureAsync` is only active during snap viewing, not globally (which would block camera and other screens)
- [ ] **Darkroom optimization:** Often missing fallback -- verify that removing/caching a Firestore read still falls back to a server check if cached value is stale
- [ ] **Darkroom optimization:** Often missing `ensureDarkroomInitialized` preservation -- verify the inline reveal logic in darkroomService.js (lines 182-213) is not removed during "cleanup"
- [ ] **Firestore TTL (INFRA-03):** Often missing data audit -- verify that ONLY snap-type messages have the `expiresAt` field before enabling TTL
- [ ] **Firestore TTL (INFRA-03):** Often missing conversation lastMessage handling -- verify that TTL-deleted snap docs do not leave orphaned `lastMessage` references in conversation documents
- [ ] **GCS lifecycle (INFRA-04):** Often missing dev-first testing -- verify the lifecycle rule is tested on dev project before production
- [ ] **GCS lifecycle (INFRA-04):** Often missing age buffer -- verify the lifecycle age is longer than the maximum snap lifetime (currently `expiresAt` is ~24h, so age should be 14+ days, not 7)

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall                                                 | Recovery Cost | Recovery Steps                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live Activity stuck on lock screen (activity not ended) | LOW           | Call `Activity.end()` from the app on next launch. Add a scheduled Cloud Function that sends `end` push to activities older than 24 hours. iOS automatically removes Live Activities after 12 hours of inactivity on the lock screen (moves to notification center for 4 hours, then removed). |
| Android crash from expo-screen-capture on Android 14    | MEDIUM        | Push an OTA update (not a new build) that wraps all screen capture calls in try/catch. If the crash is in module initialization (cannot be caught), a new EAS build with the fixed version is required.                                                                                        |
| Darkroom reveals broken after optimization              | LOW           | Revert the optimization via OTA update. Restore the original triple-trigger pattern. No data loss since the darkroom documents in Firestore are unchanged.                                                                                                                                     |
| Firestore TTL bulk-deletes unexpected documents         | HIGH          | Data is gone. Firestore has no built-in point-in-time recovery. If Firestore export/backup was enabled, restore from the most recent backup. If not, the documents are lost. **Prevention is the only strategy** -- audit before enabling.                                                     |
| GCS lifecycle deletes active snap photos                | MEDIUM        | If soft-delete is enabled on the bucket (default 7-day retention), restore objects via `gsutil`. If soft-delete is disabled, files are permanently lost. Increase the lifecycle age and verify soft-delete is enabled before configuring.                                                      |
| Screenshot listener not firing on Android               | LOW           | OTA update to add the `allowScreenCaptureAsync()` workaround before registering the listener. No native build required if the workaround is JS-only.                                                                                                                                           |
| Live Activity shows stale data                          | LOW           | Send an `end` push notification to the stale activity and start a new one with current data. Add client-side freshness check on app foreground.                                                                                                                                                |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall                                                    | Prevention Phase               | Verification                                                                                                   |
| ---------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Widget extension process isolation (no RN/Firebase access) | Phase 1: Live Activities iOS   | Architecture review: confirm native module bridge design before coding                                         |
| Live Activity push token management (not FCM)              | Phase 1: Live Activities iOS   | Integration test: background the app, verify Live Activity updates via APNs push                               |
| Android Live Updates scope creep                           | Phase 1: Live Activities iOS   | Decision document: confirm iOS-only for v1.1, Android deferred                                                 |
| expo-screen-capture Android 14 crash                       | Phase 2: Screenshot Detection  | QA: test EAS build on physical Android 14 device, verify no crash on startup                                   |
| Screenshot listener not firing Android 14+                 | Phase 2: Screenshot Detection  | QA: take screenshot on Android 14+ device during snap viewing, verify callback fires                           |
| FLAG_SECURE blocking camera preview on Android             | Phase 2: Screenshot Detection  | QA: navigate from snap viewer to snap camera, verify camera viewfinder renders                                 |
| Screen capture scope isolation                             | Phase 2: Screenshot Detection  | QA: verify screenshots work on feed, profile, settings screens while snap prevention is active                 |
| Darkroom optimization breaking reveals                     | Phase 3: Darkroom Optimization | QA: take photo, wait for reveal time, open darkroom, verify photos are revealed (not stuck developing)         |
| `ensureDarkroomInitialized` inline logic removal           | Phase 3: Darkroom Optimization | Code review: verify darkroomService.js lines 182-213 are preserved                                             |
| Cached `nextRevealAt` staleness                            | Phase 3: Darkroom Optimization | QA: take photo, background app for 10 minutes, foreground, verify reveal happens (cache did not prevent check) |
| Firestore TTL bulk deletion of existing data               | Phase 4: Tech Debt (INFRA-03)  | Audit script: run count query of expired messages documents before enabling TTL                                |
| TTL orphaning conversation lastMessage                     | Phase 4: Tech Debt (INFRA-03)  | QA: wait for TTL to delete an expired snap, verify conversation list still renders correctly                   |
| GCS lifecycle deleting active snap photos                  | Phase 4: Tech Debt (INFRA-04)  | QA: send snap, wait 8 days (on dev project with 7-day rule), verify 14-day rule does not delete                |
| GCS lifecycle retroactive deletion                         | Phase 4: Tech Debt (INFRA-04)  | Test on dev project: add lifecycle rule, verify only objects older than age threshold are deleted              |
| Test gaps in useConversation hook                          | Phase 4: Tech Debt             | Unit tests: verify Phase 2 additions to useConversation are covered                                            |
| Stale test assertion in snapFunctions.test.js              | Phase 4: Tech Debt             | Test fix: update assertion, verify test passes                                                                 |

## Sources

- [Using Live Activities in a React Native App - AddJam](https://addjam.com/blog/2025-02-04/using-live-activities-react-native-app/) -- App Groups, token management, push notification requirements (MEDIUM confidence)
- [Implementing Live Activities in React-Native with Expo - Fizl](https://fizl.io/blog/posts/live-activities) -- Attributes.swift synchronization, widget extension setup, 12-hour timeout (MEDIUM confidence)
- [expo-live-activity - Software Mansion Labs](https://github.com/software-mansion-labs/expo-live-activity) -- Predefined layout limitations, no custom SwiftUI, enablePushNotifications prop (MEDIUM confidence -- library is in labs, not stable release)
- [Expo ScreenCapture Documentation](https://docs.expo.dev/versions/latest/sdk/screen-capture/) -- API reference, platform differences, permission requirements (HIGH confidence)
- [expo-screen-capture Android 14 Crash - GitHub Issue #27921](https://github.com/expo/expo/issues/27921) -- MissingActivity exception, fixed in SDK 51 via PR #28244 (HIGH confidence)
- [expo-screen-capture Android 14+ Screenshot Detection - GitHub Issue #31678](https://github.com/expo/expo/issues/31678) -- Listener not firing, fix in PR #31702, workaround: call allowScreenCaptureAsync first (HIGH confidence)
- [Firestore TTL Policies - Official Firebase Docs](https://firebase.google.com/docs/firestore/ttl) -- Deletion within 24 hours, bulk deletion on existing data, no subcollection deletion (HIGH confidence)
- [Firestore TTL - Google Cloud Docs](https://docs.cloud.google.com/firestore/docs/ttl) -- TTL field requirements, timing caveats, lower priority than other operations (HIGH confidence)
- [GCS Object Lifecycle Management](https://docs.cloud.google.com/storage/docs/lifecycle) -- matchesPrefix condition, retroactive application, 24-hour propagation delay, age evaluation (HIGH confidence)
- [Android Foreground Service in React Native - Varun Kukade](https://medium.com/@varunkukade999/part-1-realtime-live-notifications-via-android-foreground-service-in-react-native-865dc0c29841) -- Service type requirements, Android 14 restrictions (MEDIUM confidence)
- [Notifee Background Restrictions](https://notifee.app/react-native/docs/android/background-restrictions/) -- Manufacturer-specific battery optimization killing foreground services (MEDIUM confidence)
- [Android Foreground Services in Android 14 - ProAndroidDev](https://proandroiddev.com/foreground-services-in-android-14-whats-changing-dcd56ad72788) -- FOREGROUND_SERVICE_TYPE requirements, permission declarations (MEDIUM confidence)
- Existing codebase analysis: `darkroomService.js`, `useDarkroom.js`, `App.js` foreground check, `functions/index.js` (INFRA-03/INFRA-04 comments, `processDarkroomReveals`, `onSnapViewed`, `cleanupExpiredSnaps`) (HIGH confidence -- direct code inspection)

---

_Pitfalls research for: Flick v1.1 -- Pinned Snaps, Screenshot Detection, Darkroom Optimization, Tech Debt_
_Researched: 2026-02-25_
