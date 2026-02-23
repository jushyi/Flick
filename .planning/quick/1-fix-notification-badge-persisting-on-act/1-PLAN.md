---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/ActivityScreen.js
autonomous: true
requirements: [NOTIF-BADGE-FIX]

must_haves:
  truths:
    - 'Notification red dot on Feed header heart icon clears after user opens Activity screen'
    - 'Notifications still appear as unread (blue dot) in the Activity list until individually tapped'
    - 'Read all button still works as before'
  artifacts:
    - path: 'src/screens/ActivityScreen.js'
      provides: 'Auto mark-as-read on screen load'
      contains: 'markNotificationsAsRead'
  key_links:
    - from: 'src/screens/ActivityScreen.js'
      to: 'src/services/firebase/notificationService.js'
      via: 'markNotificationsAsRead call after data loads'
      pattern: 'markNotificationsAsRead'
    - from: 'src/screens/FeedScreen.js'
      to: 'Firestore notifications collection'
      via: 'onSnapshot listener for read==false'
      pattern: 'onSnapshot.*read.*false'
---

<objective>
Fix the notification badge (red dot) on the Feed header heart icon persisting after the user has opened the Activity screen and viewed all their notifications.

Purpose: Currently, the red dot only clears when users explicitly tap "Read all" or tap each individual notification. The standard UX expectation is that opening the notifications list marks them as read, clearing the badge. The FeedScreen has a real-time onSnapshot listener filtering for `read == false` notifications -- once all are marked read in Firestore, the dot disappears automatically.

Output: Updated ActivityScreen.js that marks all unread notifications as read in Firestore when the screen finishes loading data, so the onSnapshot listener in FeedScreen detects zero unread and clears the badge.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/screens/ActivityScreen.js
@src/screens/FeedScreen.js (lines 306-332 — onSnapshot listener for unread notifications)
@src/services/firebase/notificationService.js (markNotificationsAsRead function)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Auto-mark notifications as read when Activity screen loads</name>
  <files>src/screens/ActivityScreen.js</files>
  <action>
In ActivityScreen.js, add an effect that fires after notifications are loaded (i.e., after `loadData()` completes and `loading` becomes `false`) to mark all unread notifications as read in Firestore. This clears the FeedScreen's onSnapshot-driven red dot.

Specific changes:

1. Add a new `useEffect` after the existing `loadData` effect (around line 362). This effect should:
   - Guard on `!loading` (data has loaded), `user?.uid` exists, and `notifications.length > 0`
   - Check if any notification in the `notifications` array has `read !== true` (i.e., there are unread ones to mark)
   - If unread exist, call `markNotificationsAsRead(user.uid)` — this is already imported
   - Do NOT update local state here — the local list should still show blue unread dots for individual notifications the user hasn't tapped yet. The Firestore update is solely to clear the FeedScreen badge via onSnapshot.
   - Log the action: `logger.debug('ActivityScreen: Auto-marking notifications as read for badge clearance')`

2. Important: Do NOT change the local `notifications` state in this effect. The visual unread dots in the Activity list should remain until the user taps individual items or "Read all". This effect only updates Firestore so the FeedScreen onSnapshot picks it up and clears the red dot.

3. The effect dependency array should be `[loading, user?.uid, notifications]`. Since `notifications` is a state array, it will only re-run when notifications actually change (initial load or refresh). The `loading` guard prevents it from running on mount when data hasn't loaded yet. The `notifications.length > 0` guard prevents it from running when the list is empty.

Why this approach: The FeedScreen badge is driven by a Firestore onSnapshot query for `read == false`. Marking all as read in Firestore clears that query result. The local state in ActivityScreen is separate — it still shows which notifications the user hasn't individually interacted with.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/screens/ActivityScreen.js --no-error-on-unmatched-pattern</automated>
<manual>Open the app, trigger a notification (e.g., have a friend react to your photo), see the red dot on the heart icon, navigate to Activity screen, navigate back to Feed — the red dot should be gone.</manual>
</verify>
<done> - ActivityScreen calls markNotificationsAsRead(user.uid) in Firestore after loading notifications - The red dot on the Feed header heart icon clears when returning from Activity screen - Local unread dots in the Activity notification list are NOT affected (still show blue dots for untapped items) - "Read all" button still works as before (marks local state + Firestore) - No duplicate Firestore writes if user also taps "Read all" (markNotificationsAsRead is idempotent — it queries for read==false and skips if none found)
</done>
</task>

</tasks>

<verification>
1. ESLint passes on ActivityScreen.js
2. Manual test: Create unread notification -> see red dot on heart icon -> open Activity -> go back to Feed -> red dot is gone
3. Manual test: Open Activity with unread notifications -> individual notification rows still show blue unread dots until tapped
4. Manual test: "Read all" button still works (marks local dots + Firestore)
</verification>

<success_criteria>

- Notification badge (red dot) on Feed header heart icon clears after opening Activity screen
- No visual regression on the Activity screen's individual unread indicators
- No unnecessary Firestore writes when there are zero unread notifications
  </success_criteria>

<output>
After completion, create `.planning/quick/1-fix-notification-badge-persisting-on-act/1-SUMMARY.md`
</output>
