# Technology Stack

**Analysis Date:** 2026-01-26

## Languages

**Primary:**

- JavaScript (ES6+) - All application code, no TypeScript

**Secondary:**

- JSON - Configuration files, package manifests

## Runtime

**Environment:**

- React Native 0.81.5 - Cross-platform mobile framework
- Expo SDK 54 (~54.0.31) - Managed workflow, iOS-focused
- React 19.1.0 - UI library

**Package Manager:**

- npm (via package-lock.json)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**

- React Native 0.81.5 - Mobile app framework
- Expo ~54.0.31 - Development and build tooling
- React Navigation 7.x - Navigation (stack, bottom tabs, material top tabs)

**Testing:**

- Jest ~29.7.0 - Test runner (`jest.config.js`)
- jest-expo ~54.0.16 - Expo-specific Jest preset

**Build/Dev:**

- Babel (babel-preset-expo) - JavaScript transpilation
- Metro bundler (via Expo) - React Native bundler
- EAS Build - Production builds (`eas.json`)

## Key Dependencies

**Critical:**

- `@react-native-firebase/app` ^23.8.2 - Firebase SDK core
- `@react-native-firebase/auth` ^23.8.2 - Authentication
- `@react-native-firebase/firestore` ^23.8.2 - Database
- `@react-native-firebase/storage` ^23.8.2 - Photo storage
- `@react-native-firebase/functions` ^23.8.2 - Cloud Functions client
- `expo-camera` ~17.0.10 - Camera functionality
- `expo-notifications` ~0.32.16 - Push notifications
- `expo-image` ~3.0.11 - Optimized image display

**UI/UX:**

- `react-native-gesture-handler` ~2.28.0 - Gesture handling
- `react-native-reanimated` ~4.1.1 - Animations
- `expo-haptics` ~15.0.8 - Haptic feedback
- `@giphy/react-native-sdk` ^5.0.1 - GIF picker

**Infrastructure:**

- `@react-native-async-storage/async-storage` 2.2.0 - Local storage
- `expo-secure-store` ~15.0.8 - Secure credential storage
- `date-fns` ^4.1.0 - Date utilities

## Configuration

**Environment:**

- `.env` files via `react-native-dotenv`
- Firebase config via native files (`GoogleService-Info.plist`)
- Key configs: `GIPHY_API_KEY` (optional)

**Build:**

- `babel.config.js` - Babel configuration
- `app.json` / `app.config.js` - Expo configuration
- `eas.json` - EAS Build profiles
- `firebase.json` - Firebase project config

## Platform Requirements

**Development:**

- macOS recommended (iOS development)
- Node.js (version not explicitly specified)
- Xcode for iOS simulator/device
- Expo Go app for rapid development

**Production:**

- iOS target (primary platform)
- Distributed via EAS Build + TestFlight
- Firebase project (us-central1 region)

---

_Stack analysis: 2026-01-26_
_Update after major dependency changes_
