---
phase: quick-24
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - functions/index.js
  - functions/notifications/sender.js
autonomous: false
requirements:
  - QUICK-24
must_haves:
  truths:
    - Push notifications are delivered to the dev app when a DM is sent
    - Push notifications are delivered to the dev app when a friend request is received
    - Push notifications are delivered to the dev app when photos are revealed
  artifacts:
    - path: functions/index.js
      provides: Cloud Functions with notification triggers
    - path: functions/notifications/sender.js
      provides: Expo Push Notification sender
  key_links:
    - from: functions/index.js
      to: functions/notifications/sender.js
      via: sendPushNotification call
      pattern: sendPushNotification
---

<objective>
Diagnose and fix push notifications not being delivered on the dev app.

Purpose: The dev app (using Firebase project `re-lapse-fa89b`) is not sending any push notifications. This is a multi-layer pipeline that needs systematic diagnosis: token registration (client), Cloud Functions deployment (server), and Expo Push Service routing (infrastructure).

Output: Working push notifications on the dev app build.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@functions/index.js
@functions/notifications/sender.js
@src/services/firebase/notificationService.js
@App.js
@src/navigation/AppNavigator.js
@.firebaserc
@eas.json
@app.config.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Diagnose the push notification pipeline end-to-end</name>
  <files>functions/index.js, functions/notifications/sender.js, src/services/firebase/notificationService.js</files>
  <action>
Systematically diagnose each layer of the push notification pipeline for the dev app. The dev Firebase project is `re-lapse-fa89b` (set as `default` in `.firebaserc`). The prod Firebase project is `flick-prod-49615`.

**Layer 1 -- Are Cloud Functions deployed to the dev Firebase project?**
Run: `firebase functions:list --project re-lapse-fa89b`
If no functions are listed, this is the root cause. The dev Firestore triggers (onNewMessage, sendPhotoRevealNotification, sendFriendRequestNotification, etc.) have never been deployed to the dev project, so no Firestore trigger fires to send push notifications.

**Layer 2 -- Is the EXPO_ACCESS_TOKEN set on the dev Firebase Functions environment?**
Run: `firebase functions:secrets:get EXPO_ACCESS_TOKEN --project re-lapse-fa89b` or check `functions/.env`
The `sender.js` uses `process.env.EXPO_ACCESS_TOKEN` for higher rate limits. If this is missing, the Expo client still works (falls back to undefined/anonymous), but rate limits may cause silent drops.

**Layer 3 -- Is the Expo Push Token being stored correctly in the dev Firestore?**
Check if user documents in the dev Firestore (`re-lapse-fa89b`) have a non-empty `fcmToken` field. The client code in `App.js` (lines 280-300) registers the token on every auth state change if permissions are granted. If users granted permissions via the NotificationPermissionScreen, the token should be stored.

**Layer 4 -- Are the functions environment variables (SMTP_EMAIL, SMTP_PASSWORD, etc.) set on the dev project?**
Run: `firebase functions:config:get --project re-lapse-fa89b` and check `functions/.env` contents.

**Layer 5 -- Does the Expo Push Token format match what the sender validates?**
The sender checks `Expo.isExpoPushToken(token)` -- tokens must start with `ExponentPushToken[` or `ExpoPushToken[`. Verify that the dev app generates tokens in this format by checking a sample user doc.

Based on findings, proceed to Task 2 to apply the fix.

IMPORTANT: Do NOT modify any code in this task. This is pure diagnosis. Record all findings.
</action>
<verify>
Run `firebase functions:list --project re-lapse-fa89b` and record whether functions exist.
Run `firebase projects:list` to confirm both projects are accessible.
</verify>
<done>Root cause identified with specific evidence (which layer(s) failed).</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Present findings and apply fix</name>
  <files>functions/index.js, functions/notifications/sender.js</files>
  <action>
Present the diagnostic findings to the user and apply the appropriate fix. The most likely root causes (in order of probability) are:

A) Cloud Functions not deployed to dev project -- If functions only exist on prod (`flick-prod-49615`), the dev Firestore has zero triggers. No Firestore write in the dev project will ever fire a Cloud Function.

B) EXPO_ACCESS_TOKEN or other env vars missing on dev Functions -- The `functions/.env` may only be deployed to prod, so even if functions exist on dev, the Expo Push Service call may fail silently.

C) Expo Push Token not stored in dev Firestore user docs -- The dev app may not have notification permissions, or token registration failed.

Apply the fix matching the root cause:

- If A: `firebase deploy --only functions --project re-lapse-fa89b`
- If B: Copy `functions/.env` values and set on dev: `firebase functions:secrets:set EXPO_ACCESS_TOKEN --project re-lapse-fa89b`
- If C: Guide user to re-enable notifications on device and restart dev app
  </action>
  <what-built>
  Diagnostic results and the applied fix for push notifications on the dev app.
  </what-built>
  <how-to-verify> 1. Run the diagnostic commands from Task 1 in terminal 2. Apply the appropriate fix based on findings 3. Send a test DM from one test account to another on the dev app 4. Verify the recipient receives a push notification within ~5 seconds 5. Also test: send a friend request from one account -- verify push arrives 6. Check Cloud Functions logs: `firebase functions:log --project re-lapse-fa89b`
  </how-to-verify>
  <verify>Send a DM between two test accounts on the dev app and confirm the recipient receives a push notification.</verify>
  <done>Dev app push notifications working for at least DM and friend request notification types.</done>
  <resume-signal>Type "fixed" with which root cause was confirmed, or describe what you found so we can dig deeper.</resume-signal>
  </task>

</tasks>

<verification>
- Push notification received on dev app when a DM is sent
- Push notification received on dev app when a friend request is sent
- Push notification received on dev app when photos are revealed in darkroom
- Firebase Functions logs show successful notification sends (check via `firebase functions:log --project re-lapse-fa89b`)
</verification>

<success_criteria>

- Dev app receives push notifications for all notification types (DM, friend request, photo reveal, reactions, comments, tags)
- Cloud Functions are confirmed deployed and active on the dev Firebase project
- Expo Push Token is correctly stored in dev Firestore user documents
  </success_criteria>

<output>
After completion, create `.planning/quick/24-push-notifs-for-dev-app-doesn-t-seem-to-/24-SUMMARY.md`
</output>
