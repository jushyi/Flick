# Phase 26: Privacy Features - Research

**Researched:** 2026-01-25
**Domain:** iOS App Store compliance (privacy policy, ToS, account deletion)
**Confidence:** HIGH

<research_summary>

## Summary

Researched iOS App Store requirements for privacy features in social photo-sharing apps. Apple requires three things for App Store approval: (1) a privacy policy accessible both in-app and on App Store Connect, (2) terms of service accessible in-app, and (3) in-app account deletion for any app that supports account creation (Guideline 5.1.1(v)).

The account deletion requirement (effective June 30, 2022) is strict: users must be able to initiate full account deletion from within the app - not just account deactivation. Deletion can be delayed (manual processing is acceptable), but the process must start in-app and users must be notified of timeline and what happens to their data.

For this project (React Native + Firebase with phone auth), the implementation involves: (1) re-authenticating the user via phone verification before deletion, (2) using a Cloud Function to cascade-delete all user data (photos, friendships, darkroom, user document), (3) calling `user.delete()` on the Firebase Auth user, and (4) providing scrollable in-app screens for privacy policy and ToS content.

**Primary recommendation:** Implement settings screen with gear icon on Profile, re-authentication flow before account deletion using existing phone auth patterns, Cloud Function for cascade deletion (batch operations), and static legal content screens. Focus on App Store compliance - functional over fancy.
</research_summary>

<standard_stack>

## Standard Stack

No new libraries required. This phase uses existing project dependencies.

### Core (Already in Project)

| Library                          | Version  | Purpose                                | Why Standard                   |
| -------------------------------- | -------- | -------------------------------------- | ------------------------------ |
| @react-native-firebase/auth      | existing | Re-authentication before deletion      | Already used for phone auth    |
| @react-native-firebase/firestore | existing | Delete user data                       | Already used for data storage  |
| firebase-functions               | existing | Cascade deletion Cloud Function        | Already used for notifications |
| react-native                     | existing | Settings UI, ScrollView for legal docs | Core framework                 |

### Supporting (Already in Project)

| Library                        | Version  | Purpose                                  | When to Use                      |
| ------------------------------ | -------- | ---------------------------------------- | -------------------------------- |
| @react-navigation/native-stack | existing | Settings screen navigation               | Push SettingsScreen from Profile |
| expo-secure-store              | existing | Clear any cached credentials on deletion | Already added in Phase 25        |
| libphonenumber-js              | existing | Phone validation for re-auth             | Already used in phoneAuthService |

### No New Dependencies Needed

The project already has everything required:

- Phone auth flow (PhoneAuthContext, phoneAuthService)
- Firestore batch operations pattern (functions/index.js)
- Logger utility for consistent logging
- Dark theme colors (src/constants/)

</standard_stack>

<architecture_patterns>

## Architecture Patterns

### Recommended Project Structure

```
src/
├── screens/
│   ├── SettingsScreen.js           # Main settings menu
│   ├── PrivacyPolicyScreen.js      # Scrollable privacy policy
│   ├── TermsOfServiceScreen.js     # Scrollable ToS
│   └── DeleteAccountScreen.js      # Deletion flow with re-auth
├── services/firebase/
│   └── accountService.js           # Account deletion functions (NEW)
└── constants/
    └── legalContent.js             # Privacy policy & ToS text (NEW)

functions/
└── index.js                        # Add deleteUserData Cloud Function
```

### Pattern 1: Settings Screen Navigation

**What:** Gear icon on ProfileScreen pushes to SettingsScreen
**When to use:** Any settings access point
**Example:**

```typescript
// ProfileScreen.js - add header right button
<TouchableOpacity onPress={() => navigation.navigate('Settings')}>
  <Ionicons name="settings-outline" size={24} color="#fff" />
</TouchableOpacity>

// SettingsScreen.js - menu items
const settingsItems = [
  { label: 'Privacy Policy', screen: 'PrivacyPolicy', icon: 'document-text-outline' },
  { label: 'Terms of Service', screen: 'TermsOfService', icon: 'document-outline' },
  { label: 'Delete Account', screen: 'DeleteAccount', icon: 'trash-outline', danger: true },
];
```

### Pattern 2: Re-authentication Before Deletion

**What:** Require phone verification before allowing account deletion
**When to use:** Any security-sensitive operation (deletion, email change)
**Example:**

```typescript
// DeleteAccountScreen.js - re-auth flow
// 1. Show warning and confirmation
// 2. Send verification code to user's phone
// 3. Verify code (reuses existing phone auth flow)
// 4. Call Cloud Function to delete all data
// 5. Sign out user

const handleDeleteAccount = async () => {
  // Get user's phone number from profile
  const phoneNumber = auth().currentUser.phoneNumber;

  // Re-authenticate using existing phone auth service
  const result = await sendVerificationCode(phoneNumber, countryCode);
  if (result.success) {
    setConfirmation(result.confirmation);
    setStep('verify');
  }
};

const handleVerifyAndDelete = async code => {
  // Verify code
  const verifyResult = await confirmation.confirm(code);

  // Call deletion Cloud Function
  const deleteResult = await deleteUserAccount();

  // Sign out
  await signOut();
};
```

### Pattern 3: Cloud Function Cascade Deletion

**What:** Firebase Function that deletes all user data in correct order
**When to use:** Account deletion - ensures complete data removal
**Example:**

```javascript
// functions/index.js
exports.deleteUserAccount = onCall({ cors: true }, async request => {
  // Require authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = request.auth.uid;
  const batch = admin.firestore().batch();

  // 1. Delete photos (and storage files)
  const photos = await admin.firestore().collection('photos').where('userId', '==', userId).get();

  for (const doc of photos.docs) {
    // Delete from Storage
    const photoData = doc.data();
    if (photoData.imageURL) {
      await admin.storage().bucket().file(extractPath(photoData.imageURL)).delete();
    }
    batch.delete(doc.ref);
  }

  // 2. Delete friendships (where user is participant)
  // ... query and delete

  // 3. Delete darkroom document
  batch.delete(admin.firestore().doc(`darkrooms/${userId}`));

  // 4. Delete user document
  batch.delete(admin.firestore().doc(`users/${userId}`));

  // 5. Commit batch
  await batch.commit();

  // 6. Delete auth user
  await admin.auth().deleteUser(userId);

  return { success: true };
});
```

### Pattern 4: Static Legal Content Screens

**What:** Simple ScrollView with styled text for legal documents
**When to use:** Privacy Policy, Terms of Service
**Example:**

```typescript
// PrivacyPolicyScreen.js
const PrivacyPolicyScreen = () => (
  <SafeAreaView style={styles.container}>
    <ScrollView style={styles.scrollView}>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.lastUpdated}>Last updated: January 2026</Text>
      <Text style={styles.body}>{PRIVACY_POLICY_CONTENT}</Text>
    </ScrollView>
  </SafeAreaView>
);
```

### Anti-Patterns to Avoid

- **Requiring email/phone call for deletion:** App Store will reject - must start in-app
- **Only offering account deactivation:** Must offer full deletion, not just disable
- **Deleting auth user before data:** User loses permissions - delete data first
- **Hardcoding legal text inline:** Extract to constants file for maintainability
- **Skipping re-authentication:** Firebase throws error if session too old
  </architecture_patterns>

<dont_hand_roll>

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                   | Don't Build              | Use Instead                                          | Why                                                |
| ------------------------- | ------------------------ | ---------------------------------------------------- | -------------------------------------------------- |
| Phone re-authentication   | Custom OTP flow          | Existing phoneAuthService.sendVerificationCode()     | Already handles reCAPTCHA, error codes, formatting |
| Batch Firestore deletion  | Manual doc-by-doc delete | Firebase batch operations (max 500/batch)            | Atomic, better performance, handles errors         |
| Storage file deletion     | Manual URL parsing       | admin.storage().bucket().file() with path extraction | Handles auth, retries, edge cases                  |
| Privacy policy generation | Writing from scratch     | Use generator template + customize                   | Legal compliance patterns established              |
| Settings screen styling   | Custom theme system      | Use existing constants/theme.js colors               | Consistent with rest of app                        |

**Key insight:** Account deletion is a high-stakes operation where bugs = App Store rejection or data leaks. Use Firebase's built-in methods and the project's existing patterns rather than inventing new approaches.
</dont_hand_roll>

<common_pitfalls>

## Common Pitfalls

### Pitfall 1: Deleting Auth User Before Firestore Data

**What goes wrong:** After auth.deleteUser(), the Cloud Function loses the user's identity context and subsequent Firestore deletes may fail due to security rules.
**Why it happens:** Security rules often check `request.auth.uid == userId` which fails after auth deletion.
**How to avoid:** Delete all Firestore data FIRST, then delete the auth user as the final step.
**Warning signs:** Permission denied errors during data cleanup.

### Pitfall 2: Not Handling Friendships as "Other User"

**What goes wrong:** Friendships use deterministic IDs (user1_user2). When deleting, you must query where the user appears as EITHER user1Id or user2Id.
**Why it happens:** Only querying one field misses half the friendships.
**How to avoid:** Query friendships twice: once for user1Id, once for user2Id, or use Firebase "in" query.
**Warning signs:** Deleted user still appears in other users' friend lists.

### Pitfall 3: Session Too Old for Deletion

**What goes wrong:** Firebase throws `auth/requires-recent-login` error when trying to delete account.
**Why it happens:** Sensitive operations require recent authentication (usually within 5 minutes).
**How to avoid:** Always re-authenticate user immediately before calling delete().
**Warning signs:** "This operation is sensitive and requires recent authentication" error.

### Pitfall 4: Missing Storage Cleanup

**What goes wrong:** Photos deleted from Firestore but files remain in Cloud Storage (orphaned blobs).
**Why it happens:** Firestore document deletion doesn't cascade to Storage.
**How to avoid:** Extract file path from imageURL and explicitly delete from Storage before Firestore.
**Warning signs:** Storage usage doesn't decrease after account deletions.

### Pitfall 5: App Store Rejection - Deletion Not Prominent

**What goes wrong:** App rejected because reviewers can't find account deletion option.
**Why it happens:** Buried too deep in settings hierarchy.
**How to avoid:** Settings accessible from Profile (one tap), Delete Account clearly labeled in settings list.
**Warning signs:** Reviewer feedback mentions "unable to locate account deletion".

### Pitfall 6: Incomplete Privacy Policy

**What goes wrong:** App rejected for missing required privacy policy sections.
**Why it happens:** Not covering all data types collected or third-party sharing.
**How to avoid:** Include: data collected (photos, phone, profile), how used, third parties (Firebase), retention, deletion process.
**Warning signs:** Rejection citing Guideline 5.1.1(i).
</common_pitfalls>

<code_examples>

## Code Examples

Verified patterns from official sources:

### Firebase User Deletion (React Native Firebase)

```typescript
// Source: https://rnfirebase.io/reference/auth/user
import auth from '@react-native-firebase/auth';

// Delete current user - requires recent authentication
const deleteCurrentUser = async () => {
  const user = auth().currentUser;
  if (!user) throw new Error('No user signed in');

  await user.delete();
  // User is now signed out and deleted
};
```

### Re-authentication with Phone Credential

```typescript
// Source: React Native Firebase auth patterns
import auth from '@react-native-firebase/auth';

// Re-authenticate before sensitive operation
const reauthenticateWithPhone = async (verificationId, code) => {
  const credential = auth.PhoneAuthProvider.credential(verificationId, code);
  await auth().currentUser.reauthenticateWithCredential(credential);
  // Now safe to perform sensitive operations
};
```

### Firestore Batch Delete (Cloud Function)

```javascript
// Source: https://firebase.google.com/docs/firestore/manage-data/delete-data
const deleteCollection = async (collectionPath, batchSize = 500) => {
  const collectionRef = admin.firestore().collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
};

const deleteQueryBatch = async (query, resolve) => {
  const snapshot = await query.get();

  if (snapshot.size === 0) {
    resolve();
    return;
  }

  const batch = admin.firestore().batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  // Recurse for remaining documents
  process.nextTick(() => deleteQueryBatch(query, resolve));
};
```

### Cloud Storage File Deletion

```javascript
// Source: Firebase Admin SDK documentation
const deleteStorageFile = async fileUrl => {
  // Extract path from download URL
  // URL format: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?alt=media&token=TOKEN
  const decodedUrl = decodeURIComponent(fileUrl);
  const pathMatch = decodedUrl.match(/\/o\/(.+?)\?/);

  if (pathMatch) {
    const filePath = pathMatch[1];
    await admin.storage().bucket().file(filePath).delete();
  }
};
```

</code_examples>

<sota_updates>

## State of the Art (2025-2026)

What's changed recently:

| Old Approach               | Current Approach          | When Changed | Impact                                  |
| -------------------------- | ------------------------- | ------------ | --------------------------------------- |
| Email support for deletion | Must start in-app         | June 2022    | Hard requirement - rejection if not met |
| Privacy policy optional    | Required for all apps     | Oct 2018     | Even "no data" apps need policy         |
| Manual privacy labels      | Privacy Nutrition Labels  | Dec 2020     | Must complete Data Safety form          |
| Vague deletion timing      | Must communicate timeline | 2022         | Users must know when deletion completes |

**New requirements to consider:**

- **Privacy Manifests (iOS 17+):** Third-party SDKs must include privacy manifests. Firebase SDK already includes this.
- **Automated Privacy Scanning:** Apple now uses automated tools to verify privacy labels match actual app behavior.

**Still valid:**

- Re-authentication requirement for sensitive operations
- Callable Cloud Functions for secure backend operations
- Batch operations for Firestore deletion (500 docs/batch limit)
  </sota_updates>

<open_questions>

## Open Questions

Things that couldn't be fully resolved:

1. **Legal Content Review**
   - What we know: App Store accepts generated privacy policies that cover required topics
   - What's unclear: Whether generated content is sufficient for actual legal compliance (vs just App Store approval)
   - Recommendation: Use comprehensive template covering all data types, note "not legal advice" internally, can upgrade to lawyer-reviewed in future

2. **Deletion Timeline Communication**
   - What we know: Apple requires communicating timeline to users
   - What's unclear: Whether instant deletion is expected or if "within 30 days" is acceptable
   - Recommendation: Implement immediate deletion (best UX), but if technical issues arise, communicate clear timeline
     </open_questions>

<sources>
## Sources

### Primary (HIGH confidence)

- [Apple Developer - Offering Account Deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/) - Full requirements and implementation guidance
- [App Store Review Guidelines 5.1.1](https://developer.apple.com/app-store/review/guidelines/) - Official requirements for privacy policy, data handling, account deletion
- [React Native Firebase Auth - User](https://rnfirebase.io/reference/auth/user) - delete(), reauthenticateWithCredential() methods

### Secondary (MEDIUM confidence)

- [Firebase Delete Data Documentation](https://firebase.google.com/docs/firestore/manage-data/delete-data) - Batch deletion patterns
- [Termly App Privacy Policy Guide](https://termly.io/resources/templates/app-privacy-policy/) - Privacy policy template structure verified against Apple requirements

### Tertiary (LOW confidence - validated during implementation)

- Medium articles on Firebase cascade deletion - patterns verified against official Firebase docs
  </sources>

<metadata>
## Metadata

**Research scope:**

- Core technology: iOS App Store compliance requirements
- Ecosystem: React Native Firebase auth/firestore/functions
- Patterns: Re-authentication, cascade deletion, settings UI
- Pitfalls: App Store rejection reasons, data leakage, order of operations

**Confidence breakdown:**

- Apple requirements: HIGH - from official Apple Developer documentation
- Firebase patterns: HIGH - from official RNFirebase and Firebase docs
- UI patterns: HIGH - standard React Native, matches existing project patterns
- Legal content: MEDIUM - generated templates acceptable for MVP, not lawyer-reviewed

**Research date:** 2026-01-25
**Valid until:** 2026-03-25 (60 days - App Store guidelines relatively stable)
</metadata>

---

_Phase: 26-privacy-features_
_Research completed: 2026-01-25_
_Ready for planning: yes_
