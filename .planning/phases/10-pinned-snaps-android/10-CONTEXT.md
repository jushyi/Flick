# Phase 10: Pinned Snaps Android - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Android recipients see a persistent notification for pinned snaps with the snap photo thumbnail and tap-to-open behavior, matching the iOS experience as closely as possible. The sender-side "pin to screen" toggle (from Phase 9) is reused — this phase is about the Android recipient notification experience.

</domain>

<decisions>
## Implementation Decisions

### Notification appearance
- Use Android's built-in `BigPictureStyle` for the snap thumbnail — native feel, no custom RemoteViews
- Title: "Pinned snap from [Name]", body: caption text (or "Tap to view" if no caption)
- Notification arrives as heads-up (high priority) then persists in the notification shade
- Sound + vibrate on arrival, matching existing snap notification channel behavior

### Pin-to-screen UX
- Mirror the iOS "pin to screen" toggle exactly — same position, same visual treatment
- If recipient has app notifications disabled, silently fall back to a regular snap — sender is not informed
- Multiple pinned snaps from different senders stack as separate notifications (Android notification grouping)
- One active pinned snap per sender-recipient pair — sending a new pin replaces the previous one

### Deep link experience
- Tapping the notification opens the conversation screen with the sender
- On cold start: full app boot (auth, splash), then auto-navigate to the conversation
- If the snap has expired or already been viewed when tapped: open conversation anyway, no error shown
- Auto-open the snap viewer immediately upon landing (marks as viewed, which triggers notification dismissal)

### Dismissal behavior
- Notification is swipeable — user can dismiss it permanently (no re-posting)
- Notification cancels immediately when the snap is viewed (opened in snap viewer)
- 48-hour auto-expiry matching iOS, implemented via cloud function that sends a cancel-notification payload
- Cloud function approach ensures expiry works regardless of app state or battery optimization

### Claude's Discretion
- Notification channel configuration details
- FCM data message vs notification message structure
- How to download and attach the thumbnail to BigPictureStyle
- Navigation stack construction for deep link (ensuring back button works correctly)
- Cloud function scheduling mechanism for 48h expiry checks

</decisions>

<specifics>
## Specific Ideas

- The notification should feel like a native Android experience (BigPictureStyle), not a custom widget — PINA-05 (rich custom layout) is explicitly deferred to the backlog
- Cross-platform consistency matters for the sender toggle since friends may be on different platforms
- The auto-open snap behavior on notification tap creates a seamless "tap to reveal" experience — the notification is the prompt, the snap viewer is the payoff

</specifics>

<deferred>
## Deferred Ideas

- PINA-05: Rich snap notification with custom BigPictureStyle layout (sender avatar + styled text) — already in backlog
- PINA-04: Android Live Updates (native progress notifications) when Android 16 adoption is sufficient — already in backlog

</deferred>

---

*Phase: 10-pinned-snaps-android*
*Context gathered: 2026-02-25*
