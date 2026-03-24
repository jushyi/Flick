# Flick

A friends-only social media app that recreates the disposable camera experience.

## What It Is

Flick is a personal project building a nostalgic, disposable-camera-inspired social app. Photos are captured instantly but revealed later in batches through a "darkroom" system -- encouraging authentic moments over polished content. Sharing is limited to friends only, with emoji reactions, direct messaging, and a retro 16-bit pixel art aesthetic throughout.

## Key Features

- Photo capture with delayed darkroom reveal (0-5 minute random developing time)
- Friends-only feed with emoji reactions and comments with @mentions
- Direct messaging with GIF support
- User-created and auto-generated monthly albums
- Push notifications for reveals, reactions, friend requests, and messages
- Retro pixel art UI with CRT-inspired dark theme
- iOS and Android support

## Tech Stack

**Current production:**

- React Native + Expo (SDK 54)
- Firebase Auth (phone OTP), Firestore, Storage, Cloud Functions
- React Navigation 7
- react-native-reanimated

**v1.2 migration (in progress):**

- Supabase (PostgreSQL, Auth, Storage, Edge Functions, Realtime)
- PowerSync (offline-first SQLite)
- TanStack Query (caching and persistence)
- Sentry (monitoring)

## Getting Started

**Prerequisites:** Node.js 18+, Expo CLI, Firebase project (or Supabase for v1.2 branch)

```bash
npm install
npx expo start
```

Both iOS and Android are supported. Press `i` for iOS Simulator, `a` for Android emulator, or scan the QR code with Expo Go on a physical device.

See [CLAUDE.md](CLAUDE.md) for detailed architecture, Firebase setup, and development conventions.

## Development Commands

| Command                 | Description                    |
| ----------------------- | ------------------------------ |
| `npx expo start`        | Start development server       |
| `npm run lint`          | Check for linting errors       |
| `npm run lint:fix`      | Auto-fix linting errors        |
| `npm run format`        | Format with Prettier           |
| `npm test`              | Run all tests                  |
| `npm run test:watch`    | Run tests in watch mode        |
| `npm run test:coverage` | Run tests with coverage report |

## Project Structure

```
src/
  components/     Reusable UI components (cards, modals, buttons)
  constants/      Design tokens and configuration values
  context/        React Context providers (Auth, PhoneAuth, PhotoDetail, Theme)
  hooks/          Custom hooks (camera, darkroom, feed, comments, messages)
  navigation/     React Navigation configuration
  screens/        Full-screen views (Camera, Feed, Profile, Darkroom, Messages)
  services/       Service layer (Firebase services, Supabase services, IAP, audio)
  styles/         Shared component styles
  utils/          Helpers (logger, haptics, time formatting)
```

---

See [CLAUDE.md](CLAUDE.md) for detailed architecture, conventions, and development guide.
