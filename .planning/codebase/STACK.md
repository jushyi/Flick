# Technology Stack

**Analysis Date:** 2026-01-26

## Languages

**Primary:**

- JavaScript (ES6+) - All application code

**Secondary:**

- JSON - Configuration files, manifests

## Runtime

**Environment:**

- React Native 0.81.5 - Mobile app framework
- Expo SDK 54 - Managed workflow with native modules
- Node.js - Development tooling

**Package Manager:**

- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**

- React 19.1.0 - UI framework
- React Native 0.81.5 - Mobile platform
- Expo ~54.0.31 - Managed workflow, build tooling
- React Navigation 7.x - Navigation (native-stack, bottom-tabs, material-top-tabs)

**Testing:**

- Jest ~29.7.0 - Test runner
- jest-expo ~54.0.16 - Expo/React Native test preset
- firestore-jest-mock ^0.26.0 - Firebase mocking

**Build/Dev:**

- Babel (babel-preset-expo) - Transpilation
- ESLint 9.x - Linting
- Prettier 3.x - Code formatting
- Husky 9.x - Git hooks
- lint-staged - Pre-commit linting
- patch-package - Dependency patching

## Key Dependencies

**Critical:**

- @react-native-firebase/app ^23.8.2 - Firebase core
- @react-native-firebase/auth ^23.8.2 - Phone authentication
- @react-native-firebase/firestore ^23.8.2 - Database
- @react-native-firebase/storage ^23.8.2 - File storage
- @react-native-firebase/functions ^23.8.2 - Cloud Functions client

**UI & Animation:**

- expo-camera ~17.0.10 - Camera capture
- expo-image ~3.0.11 - Optimized image loading
- expo-image-manipulator ~14.0.8 - Photo processing
- react-native-reanimated ~4.1.1 - Animations
- react-native-gesture-handler ~2.28.0 - Gestures

**Infrastructure:**

- expo-notifications ~0.32.16 - Push notifications
- expo-secure-store ~15.0.8 - Secure storage
- @react-native-async-storage/async-storage 2.2.0 - Local storage
- @giphy/react-native-sdk ^5.0.1 - GIF picker integration

**Utilities:**

- date-fns ^4.1.0 - Date formatting
- libphonenumber-js ^1.12.34 - Phone number validation

## Configuration

**Environment:**

- react-native-dotenv for `.env` files - `babel.config.js`
- Environment variables accessed via `@env` module alias
- Key configs: GIPHY_API_KEY, GOOGLE_SERVICES_PLIST (EAS)

**Build:**

- `babel.config.js` - Babel presets and plugins (expo, dotenv, reanimated)
- `app.config.js` - Dynamic Expo config (extends app.json)
- `app.json` - Static Expo/app configuration
- `eas.json` - EAS Build configuration
- `metro.config.js` - Metro bundler (if exists)

**Firebase:**

- `firebase.json` - Firebase project config
- `firestore.rules` - Firestore security rules
- `firestore.indexes.json` - Firestore indexes
- `storage.rules` - Cloud Storage security rules
- `GoogleService-Info.plist` - iOS Firebase config

## Platform Requirements

**Development:**

- macOS/Windows/Linux
- Node.js (LTS recommended)
- Expo CLI (`npx expo`)
- iOS Simulator or physical device
- Expo Go app for development testing

**Production:**

- EAS Build for iOS standalone builds
- Firebase project (Blaze plan for Cloud Functions)
- Apple Developer account for App Store distribution
- Expo account for push notifications

---

_Stack analysis: 2026-01-26_
_Update after major dependency changes_
