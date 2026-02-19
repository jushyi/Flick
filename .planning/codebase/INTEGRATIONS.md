# External Integrations

**Analysis Date:** 2026-02-19

## APIs & External Services

**Music Search:**

- iTunes Search API - Song search for profile song feature
  - Integration method: REST API via fetch (`src/services/iTunesService.js`)
  - Auth: None (public API)
  - Used for: Song preview URLs, album art, artist info

**GIF/Sticker Picker:**

- Giphy SDK - GIF picker in comments
  - SDK/Client: `@giphy/react-native-sdk` v5.0.1
  - Auth: API key via `GIPHY_API_KEY` env var (`app.config.js` plugins)
  - Used in: `src/components/comments/GifPicker.js`

**In-App Purchases:**

- Apple App Store / Google Play - Contributions ($0.99-$9.99)
  - SDK/Client: `react-native-iap` v14.7.11 (`src/services/iapService.js`)
  - Auth: Native Store credentials
  - Submit config: ASC App ID 6759178451 (`eas.json`)

**Email:**

- Gmail SMTP - Account deletion notifications, support emails
  - SDK/Client: `nodemailer` v8.0.1 (Cloud Functions only - `functions/index.js`)
  - Auth: Gmail app password in Cloud Functions config

## Data Storage

**Databases:**

- Firebase Firestore - Primary data store
  - Connection: React Native Firebase SDK (`@react-native-firebase/firestore`)
  - Collections: `users/`, `photos/`, `friendships/`, `comments/`, `albums/`, `notifications/`, `blocks/`, `reports/`, `reactionBatches/`
  - Rules: `firestore.rules`
  - Indexes: `firestore.indexes.json`

**File Storage:**

- Firebase Cloud Storage - Photo uploads
  - SDK/Client: `@react-native-firebase/storage`
  - Auth: Firebase Auth token (automatic)
  - Signed URLs: 7-day expiry via `src/services/firebase/signedUrlService.js`
  - Rules: `storage.rules`

**Local Storage:**

- AsyncStorage - Upload queue persistence, viewed stories, app state (`@react-native-async-storage/async-storage`)
- Expo Secure Store - Sensitive credentials (`expo-secure-store`, `src/services/secureStorageService.js`)
- Expo File System - Audio file caching (`expo-file-system`)

**Caching:**

- expo-image disk cache - Automatic image caching with `cachePolicy="memory-disk"`
- No server-side caching (Redis, etc.)

## Authentication & Identity

**Auth Provider:**

- Firebase Phone Authentication - SMS OTP only
  - Implementation: React Native Firebase Auth SDK (`src/services/firebase/phoneAuthService.js`)
  - Token storage: Managed by Firebase SDK internally
  - Session management: Firebase Auth handles token refresh automatically
  - No social login; phone-only authentication

**OAuth Integrations:**

- None (phone-only auth)

## Monitoring & Observability

**Performance Monitoring:**

- Firebase Performance Monitoring - Screen traces and custom metrics
  - SDK: `@react-native-firebase/perf`
  - Implementation: `src/services/firebase/performanceService.js`
  - Hooks: `src/hooks/useScreenTrace.js` (screen traces), `withTrace()` (operation traces)
  - Disabled in `__DEV__` to avoid polluting production metrics

**Error Tracking:**

- None (no Sentry, Bugsnag, etc.)
- Errors logged via custom logger (`src/utils/logger.js`)

**Analytics:**

- None (no Firebase Analytics, Mixpanel, etc.)

**Logs:**

- Custom logger: `src/utils/logger.js` - Structured logging with sensitive data redaction
- Cloud Functions: `functions/logger.js` - Uses Firebase `functions.logger.*`
- Production: `console.log` stripped via Babel `transform-remove-console`

## CI/CD & Deployment

**Hosting:**

- EAS (Expo Application Services) - Native builds and OTA updates
  - Build profiles: development, preview, production (`eas.json`)
  - OTA: `eas update --branch production` for JS changes
  - Submit: `eas submit` for App Store / Play Store

**CI Pipeline:**

- GitHub Actions - Automated workflows (`.github/` directory)
- Pre-commit hooks: husky + lint-staged (ESLint, Prettier, secret detection)

**Cloud Functions:**

- Firebase hosting - `firebase deploy --only functions`
- Node.js 20 runtime
- Deployed to Firebase project via `firebase.json`

## Environment Configuration

**Development:**

- Required: Firebase native config files (`GoogleService-Info.plist`, `google-services.json`)
- Optional env vars: `GIPHY_API_KEY`, `FUNCTIONS_EMULATOR`
- Firebase dev project: `re-lapse-fa89b` (`.firebaserc` default)
- Expo Dev Client for native module testing

**Production:**

- Firebase prod project: `flick-prod-49615` (`.firebaserc` prod alias)
- Native configs injected via EAS Secrets: `GOOGLE_SERVICES_PLIST`, `GOOGLE_SERVICES_JSON_DEV`, `GOOGLE_SERVICES_JSON_PROD`
- `app.config.js` selects config based on `APP_ENV === 'production'`
- OTA updates: Manual `eas update --branch production`

## Webhooks & Callbacks

**Incoming:**

- None (no external webhook endpoints)

**Outgoing:**

- Expo Push Notification Server - Cloud Functions send push via Expo Server SDK
  - Endpoint: Expo push API (`functions/notifications/sender.js`)
  - FCM tokens stored in user documents, sent via `expo-server-sdk`
  - Batched reaction notifications via Cloud Tasks (`functions/tasks/sendBatchedNotification.js`)

## Not Used (Explicitly)

- **Firebase Cloud Messaging (FCM)** - Uses Expo Push Notifications instead
- **Firebase Web SDK** - Uses React Native Firebase SDK only
- **Social auth** - Phone-only, no Google/Apple Sign-In
- **Analytics** - Firebase Performance only (perf monitoring, not analytics)
- **Third-party payment** - Apple/Google IAP only (no Stripe, RevenueCat)
- **Third-party error tracking** - No Sentry, Bugsnag (custom logger only)
- **CDN** - Firebase Storage with signed URLs only

---

_Integration audit: 2026-02-19_
_Update when adding/removing external services_
