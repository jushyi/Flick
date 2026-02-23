# Technology Stack

**Analysis Date:** 2026-02-23

## Languages

**Primary:**

- JavaScript (ES2021+) - All application code (both app and Cloud Functions)

**Secondary:**

- TypeScript 5.9.3 - Optional type checking (not enforced project-wide)

## Runtime

**Environment:**

- React Native 0.81.5 - Cross-platform mobile framework
- Expo SDK 54 - Managed workflow with native module integration
- Node.js 20 - Required for Cloud Functions (can use any version for app development)
- Platform targets: iOS 15.1+, Android (managed by Expo)

**Package Manager:**

- npm (monolithic: app root + `functions/` subdirectory)
- Lockfile: `package-lock.json` in both app root and functions directory

## Frameworks

**Core:**

- React 19.1.0 - UI library
- React Native 0.81.5 - Mobile framework
- Expo ~54.0.33 - Managed builds and OTA updates via EAS

**Navigation:**

- React Navigation 7.x - Router with nested navigators
  - `@react-navigation/native-stack` ^7.9.0 - iOS/Android native stack
  - `@react-navigation/bottom-tabs` ^7.9.0 - Tab navigation
  - `@react-navigation/material-top-tabs` ^7.4.13 - Top tab navigator
  - `@react-navigation/core` ^7.14.0 - Navigation utilities

**Firebase (React Native SDK - NOT web SDK):**

- `@react-native-firebase/app` ^23.8.6 - Core module
- `@react-native-firebase/auth` ^23.8.6 - Phone number authentication
- `@react-native-firebase/firestore` ^23.8.6 - Realtime database
- `@react-native-firebase/storage` ^23.8.6 - Cloud Storage
- `@react-native-firebase/functions` ^23.8.6 - Cloud Functions client
- `@react-native-firebase/perf` ^23.8.6 - Performance Monitoring

**Backend (Cloud Functions):**

- `firebase-functions` ^4.5.0 - Serverless function framework
- `firebase-admin` ^12.0.0 - Admin SDK
- `expo-server-sdk` ^5.0.0 - Server-side push notification delivery
- `@google-cloud/tasks` ^6.2.1 - Background task scheduling
- `zod` ^4.3.6 - Request validation schema
- `nodemailer` ^8.0.1 - Email delivery

**Gestures & Animations:**

- `react-native-reanimated` ~4.1.1 - GPU-accelerated animations and gesture worklets
- `react-native-gesture-handler` ~2.28.0 - Low-level gesture detection
- `react-native-worklets` 0.5.1 - JavaScript worklet execution
- `react-native-pager-view` 6.9.1 - Swipeable view container

**State Management:**

- Context API (built-in) - Global state
  - `src/context/AuthContext.js` - Auth user and profile
  - `src/context/PhoneAuthContext.js` - Phone OTP confirmation ref
  - `src/context/PhotoDetailContext.js` - Photo modal and swipe nav
  - `src/context/ThemeProvider.js` - Dark mode toggle (unused, dark-only)
- `@react-native-async-storage/async-storage` 2.2.0 - Persistent local storage
- `expo-secure-store` ~15.0.8 - Encrypted credential storage

**Media & Capture:**

- `expo-camera` ~17.0.10 - Camera access and photo capture
- `expo-image` ~3.0.11 - Optimized image rendering with memory/disk cache
- `expo-image-picker` ~17.0.10 - Photo library and camera roll access
- `expo-image-manipulator` ~14.0.8 - Image cropping and rotation
- `expo-media-library` ~18.2.1 - Device media enumeration
- `expo-audio` ~1.1.1 - Audio playback for music preview
- `expo-file-system` ~19.0.21 - File I/O (upload queue persistence)
- `react-native-svg` 15.12.1 - SVG rendering
- `expo-blur` ~15.0.8 - Blur background effect
- `expo-linear-gradient` ~15.0.8 - Gradient UI elements

**Typography & Assets:**

- `@expo-google-fonts/press-start-2p` ^0.4.1 - 8-bit pixel font (retro aesthetic)
- `@expo-google-fonts/silkscreen` ^0.4.2 - Pixel art font variant
- `@expo-google-fonts/space-mono` ^0.4.2 - Monospace typography
- `expo-font` ~14.0.11 - Font loading and caching

**Notifications & Social:**

- `expo-notifications` ~0.32.16 - Push notification handling (local/remote)
- `@giphy/react-native-sdk` ^5.0.1 - GIF picker for comments
- `rn-emoji-keyboard` ^1.7.0 - Emoji selector component
- `react-native-iap` ^14.7.11 - In-app purchase integration

**Device & Platform Access:**

- `expo-contacts` ~15.0.11 - Contact list (friend suggestions)
- `expo-device` ~8.0.10 - Device model and ID
- `expo-haptics` ~15.0.8 - Haptic feedback (vibration)
- `expo-application` ~7.0.8 - App version and package info
- `expo-status-bar` ~3.0.9 - Status bar visibility/style
- `expo-splash-screen` ~31.0.13 - Splash screen management
- `expo-updates` ~29.0.16 - OTA update management

**Web & Utility:**

- `react-native-webview` 13.15.0 - Web content embedding (legal/policy)
- `react-native-safe-area-context` ~5.6.0 - Safe area inset tracking
- `react-native-screens` ~4.16.0 - Native screen wrappers
- `react-native-dotenv` ^3.4.11 - Environment variable injection
- `expo-dev-client` ~6.0.20 - Custom development client
- `date-fns` ^4.1.0 - Date formatting and manipulation
- `libphonenumber-js` ^1.12.34 - Phone number parsing/validation

**Image Processing (Dev/Optional):**

- `jimp` ^1.6.0 - Image manipulation (Node.js, used in functions)
- `sharp` ^0.34.5 - Optional native image processing

## Testing

**Framework & Runner:**

- Jest ~29.7.0 - Test runner with Babel transpilation
- `jest-expo` ~54.0.17 - Expo-optimized preset (handles React Native transforms)
- `@testing-library/react-native` ^13.3.3 - Component testing utilities

**Mocking:**

- `firestore-jest-mock` ^0.26.0 - Firestore mock (used in `jest.setup.js`)

**Configuration:**

- Test setup: `/__tests__/setup/jest.setup.js` - Firebase module mocks, globals
- Coverage: Collected from `src/**/*.{js,jsx}` only
- Config file: `jest.config.js` (app), `functions/jest.config.js` (Cloud Functions)

**Run Commands:**

```bash
npm test                       # Run all tests (app + functions)
npm run test:watch             # Watch mode
npm run test:coverage          # Generate coverage report
```

## Configuration

**Environment Variables:**

- Source: `.env` file (via `react-native-dotenv` babel plugin)
- Accessed via: `import { VAR_NAME } from '@env'`
- Variables:
  - `GIPHY_API_KEY` - GIF search (optional)
  - `FUNCTIONS_EMULATOR` - Local Firebase emulator flag (dev only)
- Firebase credentials via native files, NOT env vars (see below)

**Firebase Configuration:**

- iOS: `GoogleService-Info.plist` (local dev fallback)
  - Production: EAS secret `GOOGLE_SERVICES_PLIST` (injected at build time)
- Android: `google-services.json` (dev) / `google-services-prod.json` (prod)
  - Production: EAS secrets `GOOGLE_SERVICES_JSON_DEV` and `GOOGLE_SERVICES_JSON_PROD`
- Selected in `app.config.js` based on `APP_ENV === 'production'`

**Build Configuration:**

- `app.json` - Static Expo config (name, icon, splash, plugins, entitlements)
- `app.config.js` - Dynamic config processor (extends app.json, manages Firebase selection)
- `eas.json` - EAS Build profiles (development, preview, production)
- `babel.config.js` - Babel presets and plugins
- `eslint.config.js` - ESLint flat config (Expo rules + Prettier)
- `jest.config.js` - Jest configuration
- `react-native.config.js` - React Native auto-linking config (empty, uses defaults)

**Firebase Backend Configuration:**

- `firebase.json` - Firebase CLI config
- `.firebaserc` - Firebase project reference
- `firestore.indexes.json` - Custom Firestore composite indexes
- Cloud Functions: `functions/index.js` (~2700 lines), utilities in `functions/notifications/` and `functions/tasks/`

**Code Quality Tools:**

- Linter: ESLint 9.39.2 (flat config)
  - Base: `eslint-config-expo` ^10.0.0
  - Prettier integration: `eslint-plugin-prettier` ^5.5.5
- Formatter: Prettier 3.8.1
  - Config: `.prettierrc` (100 char width, trailing commas, semicolons, single quotes)
  - Integration: `eslint-plugin-prettier` (as ESLint rule)
- Pre-commit hooks: Husky 9.1.7 + lint-staged 16.2.7
  - Runs ESLint fix + Prettier write on staged files

**Babel:**

- Preset: `babel-preset-expo` ~54.0.10
- Plugins:
  - `react-native-dotenv` - Environment variable injection
  - `babel-plugin-react-compiler` ^1.0.0 - Automatic memoization
  - `react-native-reanimated/plugin` - Worklet preprocessing
  - `transform-remove-console` (production only) - Strip console.log for production builds

**Dependency Patching:**

- Tool: `patch-package` ^8.0.1
- Applied on: `npm install` postinstall hook
- Used for: Fixing incompatibilities in dependencies (stored in `patches/` directory)

## Platform Requirements

**Development:**

- Node.js (any LTS version, functions require Node 20)
- npm (bundled with Node.js)
- Expo CLI (`npm install -g expo-cli` or `npx expo`)
- iOS: Xcode and iOS Simulator (macOS only)
- Android: Android Studio and Android Emulator (macOS/Windows/Linux)

**Production:**

- iOS 15.1+ device support
- Android: Managed by Expo (minSdkVersion varies by Expo version)
- Expo Account (for EAS Build and OTA updates)
- Firebase Projects:
  - Dev project: `re-lapse-fa89b`
  - Prod project: `flick-prod-49615`
- Cloud Functions: Firebase Functions (Node 20 runtime)
- App Stores:
  - Apple App Store (iOS)
  - Google Play Store (Android)

**Deployment Pipeline:**

- Native builds: EAS Build (`eas build --platform ios` or `--platform android`)
- OTA updates: EAS Update (`eas update --platform ios|android|web`)
- Cloud Functions: Firebase CLI (`firebase deploy --only functions`)

---

_Stack analysis: 2026-02-23_
