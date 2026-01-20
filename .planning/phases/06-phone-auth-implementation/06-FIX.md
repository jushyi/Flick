---
phase: 06-phone-auth-implementation
plan: 06-FIX
type: fix
---

<objective>
Fix 1 UAT blocker issue from Phase 6 phone auth testing.

Source: 06-ISSUES.md
Priority: 1 blocker, 0 major, 0 minor

**Issue:** Phone auth crashes app when calling `signInWithPhoneNumber` due to missing Firebase iOS configuration (REVERSED_CLIENT_ID for reCAPTCHA fallback).
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

**Issues being fixed:**
@.planning/phases/06-phone-auth-implementation/06-ISSUES.md

**Original plans for reference:**
@.planning/phases/06-phone-auth-implementation/06-01-PLAN.md
@.planning/phases/06-phone-auth-implementation/06-02-PLAN.md

**Key files:**
@app.json
@GoogleService-Info.plist
@src/services/firebase/phoneAuthService.js
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <action>Download fresh GoogleService-Info.plist from Firebase Console</action>
  <instructions>
The current GoogleService-Info.plist is missing the REVERSED_CLIENT_ID key, which is required for Firebase phone auth reCAPTCHA fallback.

**Steps:**
1. Go to Firebase Console: https://console.firebase.google.com/
2. Select the project: **re-lapse-fa89b**
3. Click the gear icon → **Project Settings**
4. Scroll down to **Your apps** section
5. Find the iOS app (com.lapseclone.app)
6. Click **GoogleService-Info.plist** download button
7. Replace the existing `GoogleService-Info.plist` in the project root

**Verify the new file contains:**
- REVERSED_CLIENT_ID key (should look like: com.googleusercontent.apps.XXXXXX)
- This is essential for reCAPTCHA fallback when APNs isn't configured
  </instructions>
  <verification>Open GoogleService-Info.plist and confirm REVERSED_CLIENT_ID key exists</verification>
  <resume-signal>Type "done" when the new file is in place</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Configure URL scheme for reCAPTCHA callback</name>
  <files>app.json</files>
  <action>
Add the REVERSED_CLIENT_ID as a URL scheme in app.json so Firebase can handle reCAPTCHA callbacks.

1. Read the REVERSED_CLIENT_ID from the new GoogleService-Info.plist
2. Add it to app.json under `expo.ios.infoPlist.CFBundleURLTypes`:

```json
"CFBundleURLTypes": [
  {
    "CFBundleURLSchemes": ["com.googleusercontent.apps.XXXXXX"]
  }
]
```

Where XXXXXX is the app ID from REVERSED_CLIENT_ID.

**Why:** Firebase phone auth uses reCAPTCHA as fallback when APNs silent push isn't available. The reCAPTCHA flow redirects back to the app using this URL scheme.
  </action>
  <verify>app.json contains CFBundleURLTypes with the REVERSED_CLIENT_ID scheme</verify>
  <done>URL scheme configured for Firebase reCAPTCHA callback</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <action>Rebuild EAS development build with updated configuration</action>
  <instructions>
The native iOS build needs to be rebuilt to include:
1. The new GoogleService-Info.plist with REVERSED_CLIENT_ID
2. The URL scheme configuration in Info.plist

**Run:**
```bash
eas build --profile development --platform ios
```

Wait for the build to complete and install it on your device.

**Note:** This requires your Apple Developer account to be active.
  </instructions>
  <verification>New build installed and app launches without immediate crash</verification>
  <resume-signal>Type "done" when the new build is installed</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Firebase phone auth with reCAPTCHA fallback support</what-built>
  <how-to-verify>
1. Open the newly built app
2. Navigate to PhoneInputScreen
3. Enter a valid phone number
4. Tap Continue/Submit
5. You should see one of:
   - reCAPTCHA verification screen (web view), then SMS sent
   - Silent verification (if APNs works), then SMS sent
   - Navigate to VerificationScreen (success!)
6. Check that you receive SMS code
7. Enter the code and verify it works
  </how-to-verify>
  <resume-signal>Type "approved" if phone auth works, or describe any issues</resume-signal>
</task>

</tasks>

<verification>
Before declaring fix complete:
- [ ] GoogleService-Info.plist contains REVERSED_CLIENT_ID
- [ ] app.json has URL scheme configured
- [ ] EAS build completed with new configuration
- [ ] Phone number submission doesn't crash
- [ ] SMS verification code is received
- [ ] Code verification works (user can sign in)
</verification>

<success_criteria>
- UAT-001 resolved: Phone auth no longer crashes
- User can complete full phone auth flow
- Ready for re-verification with /gsd:verify-work
</success_criteria>

<output>
After completion, create `.planning/phases/06-phone-auth-implementation/06-FIX-SUMMARY.md`
</output>
