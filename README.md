# Flick

A friends-only social media app inspired by disposable cameras.

## What It Is

Flick recreates the nostalgic experience of disposable film cameras. Photos are captured instantly but revealed later in batches through a "darkroom" system, encouraging authentic moments over polished content. Share only with friends, react with emoji, and experience the anticipation of waiting for your photos to develop.

## Tech Stack

- **React Native + Expo** - Cross-platform mobile framework
- **Firebase Authentication** - Phone number authentication with OTP
- **Cloud Firestore** - Real-time NoSQL database for users, photos, friendships
- **Firebase Cloud Storage** - Photo storage with signed URLs
- **Firebase Cloud Functions** - Push notifications, reaction debouncing
- **Expo Push Notifications** - Real-time alerts for reveals, reactions, friend requests

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Expo CLI (`npm install -g expo-cli`)
- A Firebase project with Auth, Firestore, Storage, and Functions enabled
- iOS Simulator (macOS) or physical iOS device with Expo Go

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/lapse-clone.git
   cd lapse-clone
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure Firebase:
   - Create a Firebase project at console.firebase.google.com
   - Enable Phone Authentication
   - Create a Firestore database
   - Set up Cloud Storage
   - Download `GoogleService-Info.plist` and configure via EAS environment variables (see `eas.json`)

4. Deploy Cloud Functions:
   ```bash
   cd functions
   npm install
   firebase deploy --only functions
   ```

### Running the App

```bash
npx expo start
```

Press `i` to open in iOS Simulator or scan the QR code with Expo Go on your device.

## Project Structure

```
src/
  components/     Reusable UI components (cards, modals, buttons)
  constants/      Design tokens and configuration values
  context/        React Context providers (Auth, PhoneAuth)
  hooks/          Custom hooks for camera, darkroom, feed logic
  navigation/     React Navigation configuration
  screens/        Full-screen views (Camera, Feed, Profile, etc.)
  services/       Firebase service layer (auth, photos, friendships)
  styles/         Shared component styles
  utils/          Helpers (logger, haptics, time formatting)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for code conventions and development guidelines.
