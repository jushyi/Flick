# Technology Stack

**Analysis Date:** 2026-02-19

## Languages

**Primary:**

- JavaScript (ES2020+) - All application code (`src/**/*.js`, `App.js`)

**Secondary:**

- JavaScript (Node.js 20) - Cloud Functions backend (`functions/**/*.js`)
- JSON - Configuration files (`app.json`, `firebase.json`, `eas.json`, `.firebaserc`)

## Runtime

**Environment:**

- React Native 0.81.5 - Cross-platform mobile framework (`package.json`)
- Expo SDK 54 (v54.0.33) - Managed build environment (`package.json`, `app.json`)
- Node.js 20 - Cloud Functions runtime (`functions/package.json`, engines: "node": "20")

**Package Manager:**

- npm 10.x
- Lockfile: `package-lock.json` present
- Workspace: Root app + `functions/` subdirectory with separate `package.json`

## Frameworks

**Core:**

- React Native 0.81.5 + Expo SDK 54 - Mobile UI framework (`package.json`)
- React Navigation 7 - Navigation (`@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`, `@react-navigation/material-top-tabs`)
- React Native Reanimated 4.1.1 - Gesture animations (`react-native-reanimated`)
- React Native Gesture Handler ~2.28.0 - Touch gesture recognition

**Testing:**

- Jest 29.7.0 - Test runner (`jest.config.js`)
- jest-expo ~54.0.17 - Expo-specific Jest preset
- @testing-library/react-native 13.3.3 - Component testing utilities
- firestore-jest-mock - Firebase mocking for tests

**Build/Dev:**

- Babel 7 with babel-preset-expo ~54.0.10 (`babel.config.js`)
- babel-plugin-react-compiler - React Compiler optimization
- EAS (Expo Application Services) - Cloud builds (`eas.json`)
- expo-updates - OTA update system
- expo-dev-client - Custom development client

**Code Quality:**

- ESLint 9.39.2 with eslint-config-expo (`eslint.config.js`)
- Prettier 3.8.1 (`.prettierrc`)
- husky 9.1.7 - Git hooks (`.husky/pre-commit`)
- lint-staged 16.2.7 - Staged file linting
- patch-package 8.0.1 - Dependency patching

## Key Dependencies

**Critical:**

- `@react-native-firebase/app` v23.8.6 - Core Firebase SDK (NOT the web SDK)
- `@react-native-firebase/auth` v23.8.6 - Phone-only authentication
- `@react-native-firebase/firestore` v23.8.6 - Real-time database
- `@react-native-firebase/storage` v23.8.6 - Photo storage with signed URLs
- `@react-native-firebase/functions` v23.8.6 - Cloud Functions client
- `@react-native-firebase/perf` v23.8.6 - Performance monitoring
- `expo-notifications` v0.32.16 - Push notifications (NOT Firebase Cloud Messaging)
- `expo-camera` - Camera capture
- `expo-image` - Image loading with disk caching

**Infrastructure:**

- `firebase-admin` v12.0.0 - Firebase Admin SDK (Cloud Functions - `functions/package.json`)
- `firebase-functions` v4.5.0 - Cloud Functions SDK
- `expo-server-sdk` v5.0.0 - Expo push notification delivery (Cloud Functions)
- `zod` v4.3.6 - Request validation in Cloud Functions (`functions/validation.js`)
- `@google-cloud/tasks` v6.2.1 - Cloud Tasks for scheduled jobs

**UI/UX:**

- `@expo-google-fonts/press-start-2p` - Retro pixel font (16-bit theme)
- `@expo-google-fonts/silkscreen` - Bitmap font
- `react-native-svg` v15.12.1 - SVG rendering
- `rn-emoji-keyboard` v1.7.0 - Emoji picker for reactions
- `@giphy/react-native-sdk` v5.0.1 - GIF picker

**Utilities:**

- `date-fns` v4.1.0 - Date manipulation
- `libphonenumber-js` v1.12.34 - Phone number parsing
- `react-native-iap` v14.7.11 - In-App Purchases
- `react-native-dotenv` v3.4.11 - Environment variables via `@env` imports

## Configuration

**Environment:**

- Firebase config via native files (`GoogleService-Info.plist`, `google-services.json`) - NOT env vars
- Optional env vars via `react-native-dotenv`: `GIPHY_API_KEY`, `FUNCTIONS_EMULATOR`
- `app.config.js` switches Firebase projects based on `APP_ENV` (dev vs production)

**Build:**

- `babel.config.js` - Babel plugins (Expo preset, react-native-dotenv, react-compiler, reanimated)
- `eslint.config.js` - ESLint rules (Expo config + Prettier)
- `.prettierrc` - Formatting (2-space, single quotes, 100 char width, trailing commas)
- `jest.config.js` - Test runner (jest-expo preset, Firebase mocks)
- `eas.json` - EAS Build profiles (development, preview, production)
- `app.json` / `app.config.js` - Expo/native configuration

## Platform Requirements

**Development:**

- macOS/Windows/Linux (any platform with Node.js)
- iOS Simulator or Android Emulator
- Expo Dev Client for testing native modules
- Firebase native config files (git-ignored, injected via EAS Secrets)

**Production:**

- iOS: App Store (ASC App ID: 6759178451)
- Android: Play Store (package: `com.spoodsjs.flick`)
- OTA updates via `eas update --branch production`
- Cloud Functions: Firebase hosting (Node.js 20)
- Native builds via EAS Build (development, preview, production profiles)

---

_Stack analysis: 2026-02-19_
_Update after major dependency changes_
