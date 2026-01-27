# External Integrations

**Analysis Date:** 2026-01-26

## APIs & External Services

**Push Notifications:**

- Expo Push Notification Service - Push notifications to devices
  - SDK/Client: expo-notifications ~0.32.16
  - Auth: Expo Push Tokens (ExponentPushToken[...])
  - Endpoints: `https://exp.host/--/api/v2/push/send`
  - Used in: `functions/index.js` (Cloud Functions send notifications)
  - Client: `src/services/firebase/notificationService.js`

**GIF Integration:**

- Giphy API - GIF picker for comments
  - SDK/Client: @giphy/react-native-sdk ^5.0.1
  - Auth: GIPHY_API_KEY env var
  - Usage: `src/components/comments/GifPicker.js`
  - Initialize: `App.js` (initializeGiphy call)

## Data Storage

**Databases:**

- Cloud Firestore - Primary data store
  - Connection: @react-native-firebase/firestore ^23.8.2
  - Collections: users, photos, darkrooms, friendships, notifications, photoViews
  - Security: `firestore.rules` (comprehensive rules)
  - Indexes: `firestore.indexes.json`

**File Storage:**

- Firebase Cloud Storage - Photo uploads
  - SDK/Client: @react-native-firebase/storage ^23.8.2
  - Security: `storage.rules`
  - Buckets: Default project bucket
  - Usage: `src/services/firebase/storageService.js`
  - Signed URLs: `functions/index.js` (getSignedPhotoUrl)

**Local Storage:**

- AsyncStorage - Auth state persistence
  - SDK: @react-native-async-storage/async-storage 2.2.0
  - Usage: `src/context/AuthContext.js`

- Expo SecureStore - Sensitive data
  - SDK: expo-secure-store ~15.0.8
  - Usage: `src/services/secureStorageService.js`

**Caching:**

- None (direct Firestore queries)
- Image caching via expo-image

## Authentication & Identity

**Auth Provider:**

- Firebase Auth - Phone number authentication
  - SDK: @react-native-firebase/auth ^23.8.2
  - Implementation: `src/services/firebase/phoneAuthService.js`
  - Context: `src/context/AuthContext.js`, `src/context/PhoneAuthContext.js`
  - Token storage: Managed by Firebase SDK
  - Session: Persisted via AsyncStorage

**Auth Flow:**

1. Phone number input → `sendVerificationCode()`
2. SMS code verification → `verifyCode()`
3. Profile setup (username, bio, photo)
4. Auth state persisted, auto-login on app restart

## Monitoring & Observability

**Error Tracking:**

- Planned: Sentry (Phase 10)
  - Current: `src/utils/logger.js` logs to console
  - TODOs in code for Sentry integration
  - Files: `src/utils/logger.js:218`, `src/components/ErrorBoundary.js:63`

**Analytics:**

- None implemented
- Planned: Phase 2+

**Logs:**

- Development: Console via logger utility
- Production: Console (captured by Expo/device logs)
- Cloud Functions: Firebase Functions logs (console-based)

## CI/CD & Deployment

**App Hosting:**

- EAS Build - iOS app builds
  - Config: `eas.json`
  - Project ID: b7da185a-d3e1-441b-88f8-0d4379333590
  - Distribution: TestFlight (planned)

**Cloud Functions:**

- Firebase Cloud Functions - Server-side logic
  - Location: `functions/`
  - Runtime: Node.js 20
  - Deploy: `firebase deploy --only functions`
  - Region: us-central1

**CI Pipeline:**

- Not configured (local deployment)
- Lint/test via npm scripts

## Environment Configuration

**Development:**

- Required env vars: GIPHY_API_KEY
- Secrets location: `.env` (gitignored)
- Firebase config: `GoogleService-Info.plist` (iOS)
- Mock services: Expo Go for testing

**Staging:**

- Same Firebase project (no separate staging)
- Test via Expo Go development builds

**Production:**

- EAS Build for standalone iOS app
- Secrets: EAS Secrets for GOOGLE_SERVICES_PLIST
- Firebase: Production Firestore rules deployed

## Webhooks & Callbacks

**Incoming:**

- None (Firebase handles internally)

**Outgoing:**

- Expo Push API - Push notifications from Cloud Functions
  - Endpoint: `https://exp.host/--/api/v2/push/send`
  - Triggered by: Firestore document changes
  - Functions: sendPhotoRevealNotification, sendFriendRequestNotification, sendReactionNotification, sendCommentNotification

## Cloud Functions Summary

Located in `functions/index.js`:

| Function                      | Trigger                             | Purpose                              |
| ----------------------------- | ----------------------------------- | ------------------------------------ |
| processDarkroomReveals        | Scheduled (every 2 min)             | Reveal overdue photos                |
| sendPhotoRevealNotification   | darkrooms/{userId} onUpdate         | Notify user of revealed photos       |
| sendFriendRequestNotification | friendships/{id} onCreate           | Notify of new friend request         |
| sendReactionNotification      | photos/{id} onUpdate                | Notify of new reactions (debounced)  |
| sendCommentNotification       | photos/{id}/comments/{cid} onCreate | Notify of new comments               |
| getSignedPhotoUrl             | onCall                              | Generate signed URL for photo access |
| deleteUserAccount             | onCall                              | Delete user and all associated data  |

## Deep Linking

**Configuration:**

- Prefixes: `lapse://`, `com.lapseclone.app://`
- Config: `src/navigation/AppNavigator.js`

**Routes:**

- `lapse://feed` → Feed tab
- `lapse://camera` → Camera tab
- `lapse://profile` → Profile tab
- `lapse://darkroom` → Darkroom screen
- `lapse://friends/requests` → Friend requests
- `lapse://notifications` → Activity screen

---

_Integration audit: 2026-01-26_
_Update when adding/removing external services_
