# External Integrations

**Analysis Date:** 2026-01-26

## APIs & External Services

**Push Notifications:**

- Expo Push Notification Service - Notification delivery
  - SDK/Client: `expo-notifications` ~0.32.16
  - Auth: Expo Push Token stored in Firestore `users/{userId}/fcmToken`
  - Endpoint: `https://exp.host/--/api/v2/push/send` (called from Cloud Functions)
  - Implementation: `src/services/firebase/notificationService.js`, `functions/index.js`

**GIF Provider:**

- Giphy API - GIF picker for comments
  - SDK/Client: `@giphy/react-native-sdk` ^5.0.1
  - Auth: API key in `GIPHY_API_KEY` env var
  - Implementation: `src/components/comments/GifPicker.js`

## Data Storage

**Databases:**

- Cloud Firestore - Primary data store
  - Connection: via `@react-native-firebase/firestore`
  - Collections: `users`, `photos`, `darkrooms`, `friendships`, `notifications`
  - Rules: `firestore.rules`
  - Indexes: `firestore.indexes.json`

**File Storage:**

- Firebase Cloud Storage - Photo storage
  - SDK/Client: `@react-native-firebase/storage`
  - Auth: Firebase Auth integration
  - Rules: `storage.rules`
  - Structure: `photos/{userId}/{photoId}` (inferred)

**Local Storage:**

- AsyncStorage - Non-sensitive local data
  - SDK: `@react-native-async-storage/async-storage`
- SecureStore - Sensitive data (credentials)
  - SDK: `expo-secure-store`
  - Implementation: `src/services/secureStorageService.js`

## Authentication & Identity

**Auth Provider:**

- Firebase Authentication - Phone + Apple Sign-In
  - SDK/Client: `@react-native-firebase/auth`
  - Phone auth: `src/services/firebase/phoneAuthService.js`
  - Context: `src/context/AuthContext.js`, `src/context/PhoneAuthContext.js`
  - Session: Managed by Firebase SDK, persisted automatically

**OAuth Integrations:**

- Apple Sign-In - Social login for iOS
  - Configured via Firebase Console
  - Native integration via Expo

## Monitoring & Observability

**Error Tracking:**

- Planned: Sentry (Phase 10)
  - Current: Console logging via `src/utils/logger.js`
  - TODOs reference Sentry integration

**Analytics:**

- Not currently implemented

**Logs:**

- Custom logger utility: `src/utils/logger.js`
  - Environment-aware (debug/info/warn/error)
  - Structured logging with context objects

## CI/CD & Deployment

**Hosting:**

- EAS Build - Expo Application Services
  - Config: `eas.json`
  - Project ID: `b7da185a-d3e1-441b-88f8-0d4379333590`
  - Distribution: TestFlight (iOS)

**Cloud Functions:**

- Firebase Cloud Functions - Server-side logic
  - Location: `functions/` directory
  - Runtime: Node.js (Firebase Functions v2)
  - Deploy: `firebase deploy --only functions`
  - Functions: `processDarkroomReveals`, `sendPhotoRevealNotification`, `sendFriendRequestNotification`, `sendReactionNotification`, `sendCommentNotification`, `getSignedPhotoUrl`, `deleteUserAccount`

## Environment Configuration

**Development:**

- Required env vars: `GIPHY_API_KEY` (optional for GIF feature)
- Firebase config: `GoogleService-Info.plist` (iOS native file)
- Secrets location: `.env` (gitignored), `.env.example` for template

**Production:**

- EAS Secrets for build-time injection
- `GOOGLE_SERVICES_PLIST` - Base64 encoded Firebase config
- Firebase project configured via console

## Webhooks & Callbacks

**Incoming:**

- None (Firebase handles all server-to-server communication)

**Outgoing:**

- Expo Push API - Called from Cloud Functions for notifications
  - Endpoint: `https://exp.host/--/api/v2/push/send`
  - Implementation: `functions/index.js` → `sendPushNotification()`

## Scheduled Jobs

**Cloud Functions:**

- `processDarkroomReveals` - Runs every 2 minutes
  - Checks darkrooms with overdue `nextRevealAt`
  - Reveals photos and schedules next reveal
  - Triggers notification via Firestore update

---

_Integration audit: 2026-01-26_
_Update when adding/removing external services_
