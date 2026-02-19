# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lapse Clone (branded as "Flick") is a friends-only social media app built with React Native and Expo. It recreates the disposable camera experience: photos are captured instantly but revealed later in batches through a "darkroom" system. The app uses Firebase for authentication (phone-only), Firestore, Storage, and Cloud Functions. The UI uses a retro 16-bit pixel art aesthetic with CRT-inspired dark theme.

## Production Build & Deployment

**The app is on a production build (EAS).** Changes to JS/TS code are deployed as OTA updates via EAS Update — they do NOT require a new native build unless native code changes.

After completing any code changes, **the user must manually trigger** the EAS update command. Do NOT run it automatically:

```bash
# iOS only
eas update --branch production --platform ios --message "description of change"

# Android only
eas update --branch production --platform android --message "description of change"

# Both platforms at once
eas update --branch production --message "description of change"
```

Never run `eas update` autonomously. Always remind the user to run it after changes are complete.

Changes that require a full native build (NOT just `eas update`):
- Adding/removing native modules or Expo plugins
- Changes to `app.json`/`app.config.js` (icons, splash, permissions, etc.)
- Modifying native files in `ios/` or `android/`

## Android Development

The app supports both iOS and Android. Android was added after the initial iOS-only build. Keep the following in mind when working on Android.

### Firebase Config (Android)

Two Firebase projects exist — dev and prod. Android Firebase config is handled via `google-services.json` files (never committed to git) stored as EAS secrets:

- `GOOGLE_SERVICES_JSON_DEV` — dev Firebase project (`re-lapse-fa89b`), used for development/preview builds
- `GOOGLE_SERVICES_JSON_PROD` — prod Firebase project (`flick-prod-49615`), used for production builds

`app.config.js` selects between them based on `APP_ENV === 'production'`. Local development falls back to `./google-services.json` at the project root.

### EAS Build Profiles (Android)

```bash
# Dev client build — connects to expo start, for active development
eas build --platform android --profile development

# Preview build — standalone APK, no dev server needed, uses dev Firebase
eas build --platform android --profile preview

# Production build — Play Store AAB, uses prod Firebase (set up later)
eas build --platform android --profile production
```

### Making Android-Only JS Changes

**Never use Android-only logic without a platform guard** — it will crash or misbehave on iOS. Always isolate it with one of these patterns:

**Option 1 — Inline guard (for small differences):**
```javascript
import { Platform } from 'react-native';

// Logic
if (Platform.OS === 'android') { /* android only */ }

// Styles
const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
});

// Platform.select (cleanest for multiple values)
const behavior = Platform.select({ ios: 'padding', android: 'height' });
```

**Option 2 — Platform file extensions (for large component differences):**
```
MyComponent.android.js   ← loaded only on Android
MyComponent.ios.js       ← loaded only on iOS
MyComponent.js           ← fallback for both
```
Import as normal — Metro automatically resolves the right file. No changes to import statements needed.

### Known Android Behavior Differences

| Area | Android Behavior | What to do |
|------|-----------------|------------|
| `KeyboardAvoidingView` | `behavior="padding"` doesn't work well | Use `behavior={Platform.select({ ios: 'padding', android: 'height' })}` |
| Status bar | Overlaps content unless handled | Use `<StatusBar translucent backgroundColor="transparent" />` |
| Safe area | Bottom inset includes gesture nav bar | Use `useSafeAreaInsets()` — already used project-wide |
| Back button | Hardware back button exists | Handle with `BackHandler` or `useEffect` + navigation listener for modal-like screens |
| Edge-to-edge | Enabled in `app.json` — gesture nav bar overlaps tab bar | May need extra bottom padding in tab bar on Android |
| Font rendering | Pixel/bitmap fonts render differently | Test visually; may need `fontWeight` adjustments per platform |
| Shadows | `shadow*` props don't work | Use `elevation` on Android instead of iOS shadow props |
| Overflow | `overflow: 'hidden'` clips differently | Test clipping behavior on both platforms |
| Animations | Reanimated works the same, but frame rate can differ | Test gesture animations on a real Android device |

### Screen Size & Responsive Layout

Android has hundreds of screen sizes and densities. Follow these rules to ensure the app works across all of them.

**Never hardcode pixel dimensions for layout:**
```javascript
// Bad — assumes a specific screen size
<View style={{ width: 390, height: 844 }} />

// Good — percentage or flex
<View style={{ width: '100%', flex: 1 }} />
```

**Use `useWindowDimensions()` for anything size-dependent** (better than `Dimensions.get()` which is a static snapshot and doesn't update on orientation change):
```javascript
import { useWindowDimensions } from 'react-native';
const { width, height } = useWindowDimensions();
```

**Trust flexbox** — it scales to any screen automatically. Most Android layout issues come from fighting flexbox rather than using it.

**Safe areas already handle notches and punch-holes** — `useSafeAreaInsets()` covers every Android camera cutout, status bar height, and gesture nav bar shape. The project already uses this everywhere.

**Camera screen** — `CAMERA_HEIGHT` in `useCamera()` is calculated from screen dimensions. Verify it looks correct on tall phones (20:9 ratio, the most common modern Android ratio) vs wider ones.

**Photo aspect ratios in feed** — Use `aspectRatio` style rather than fixed heights for photo cards so they adapt to different screen widths.

**Pixel art assets** — Android has more density buckets than iOS (mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi). Use `PixelRatio.get()` if pixel art elements need precise scaling per density.

**Testing target** — If the layout looks correct at 360dp wide (small/budget phone) and 430dp wide (large flagship), it will work for ~95% of Android users. Use Android Studio emulator presets to test both.

### `withFirebaseFix.js` Plugin

This custom plugin is **iOS-only** — it modifies the Podfile to fix a React Native Firebase + Expo 54 compile issue. Android does not need it; the `@react-native-firebase/app` Gradle plugin handles Android automatically.

### Android-Specific `app.json` Fields

```json
"android": {
  "package": "com.spoodsjs.flick",
  "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png", "backgroundColor": "#0A0A1A" },
  "permissions": ["android.permission.CAMERA", "android.permission.RECORD_AUDIO"],
  "edgeToEdgeEnabled": true
}
```

## Development Commands

### Running the App
```bash
npx expo start        # Start development server
npx expo start --web  # Run in web browser
npm run ios           # Run on iOS simulator
npm run android       # Run on Android emulator
```

### Code Quality
```bash
npm run lint         # Check for linting errors
npm run lint:fix     # Auto-fix linting errors
npm run format       # Format with Prettier
```

### Testing
```bash
npm test                       # Run all tests once
npm run test:watch             # Run tests in watch mode
npm run test:coverage          # Run tests with coverage report
npm test -- path/to/test.test.js  # Run a single test file
```

Tests use Jest with `jest-expo` preset. Firebase modules are mocked in `__tests__/setup/jest.setup.js`. Mock functions are defined outside `jest.mock()` blocks and referenced inside mock returns. Coverage is collected from `src/` only.

### Firebase Functions
```bash
cd functions && npm install
firebase deploy --only functions
```

Functions use Node 20, Firebase Admin SDK, Expo Server SDK, and Zod for request validation.

### Pre-commit Hooks
The project uses husky + lint-staged. Commits automatically run linting and formatting on staged files. `patch-package` runs on `npm install` via postinstall script.

## Architecture

### Core Stack
- **React Native + Expo (SDK 54)** - Cross-platform mobile framework
- **React Native Firebase SDK** (`@react-native-firebase/*`) - Auth, Firestore, Storage (NOT the web SDK)
- **React Navigation 7** - Nested navigators (Native Stack + Bottom Tabs)
- **Context API** - Global state management (Auth, PhoneAuth, PhotoDetail, Theme)
- **Custom Hooks** - Business logic abstraction (camera, darkroom, feed, comments)
- **react-native-reanimated** - Gesture animations (swipe, card stacks)

### Service Layer Pattern

All Firebase operations are abstracted into service modules in `src/services/firebase/`. Each service exports functions that return `{ success, error }` objects:

```javascript
export const uploadPhoto = async (userId, photoUri) => {
  try {
    // ... upload logic
    return { success: true, photoId: result.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

Key services:
- `photoService.js` - Photo upload, deletion, reveal, triage (journal/archive)
- `darkroomService.js` - Darkroom state, reveal scheduling
- `feedService.js` - Real-time feed subscriptions
- `friendshipService.js` - Friend requests, relationships
- `phoneAuthService.js` - Phone number authentication
- `notificationService.js` - Push notifications via Expo
- `storageService.js` - Firebase Storage operations
- `commentService.js` - Photo comments with @mentions
- `albumService.js` / `monthlyAlbumService.js` - User-created and auto-generated albums
- `signedUrlService.js` - Firebase Storage signed URL generation/refresh (7-day expiry)
- `accountService.js` - Account deletion scheduling and recovery
- `uploadQueueService.js` - Photo upload queue with retry, persists across restarts
- `blockService.js` / `reportService.js` - User blocking and reporting
- `messageService.js` - Direct messaging: conversation CRUD, message sending, subscriptions, pagination, soft deletion

Additional non-Firebase services exist at `src/services/` root level: `iapService.js` (in-app purchases), `iTunesService.js` / `searchService.js` (music search), `audioPlayer.js`, `secureStorageService.js`.

### Authentication Flow

Phone-only authentication using React Native Firebase Auth:

1. **PhoneInputScreen** - User enters phone number, receives OTP
2. **VerificationScreen** - User enters 6-digit code
3. **ProfileSetupScreen** - New users set username, display name, profile photo
4. **SelectsScreen** - New users pick 3 content preferences
5. **ContactsSyncScreen** - Optional contact sync for friend suggestions
6. **NotificationPermissionScreen** - Optional push notification permission
7. **MainTabs** - Main app (Feed, Messages, Camera, Profile)

AuthContext manages user state and profile. PhoneAuthContext shares the non-serializable `ConfirmationResult` via ref between auth screens.

### Navigation Structure

```
NavigationContainer (DarkTheme + custom colors)
└── Stack.Navigator (root)
    ├── PhoneInput / Verification (unauthenticated)
    ├── Onboarding Stack (authenticated, profile incomplete)
    │   ├── ProfileSetup, Selects, ContactsSync, NotificationPermission
    │   ├── SongSearch (card modal)
    │   └── ProfilePhotoCrop (fullScreenModal)
    └── Main App (authenticated, profile complete)
        ├── MainTabs (BottomTabNavigator)
        │   ├── Feed
        │   ├── Messages (MessagesStackNavigator)
        │   │   ├── MessagesList, Conversation, NewMessage
        │   ├── Camera
        │   └── Profile (ProfileStackNavigator)
        │       ├── ProfileMain, Settings, EditProfile, CreateAlbum
        │       ├── AlbumPhotoPicker, AlbumGrid, MonthlyAlbumGrid
        │       ├── NotificationSettings, SoundSettings, Contributions
        │       ├── PrivacyPolicy, TermsOfService, DeleteAccount
        │       ├── RecentlyDeleted, BlockedUsers, ProfilePhotoCrop
        │       └── SongSearch
        ├── PhotoDetail (transparentModal, swipe-dismissible)
        ├── ProfileFromPhotoDetail (fullScreenModal, nested navigation)
        ├── Darkroom (slide_from_bottom)
        ├── Success, Activity, FriendsList, OtherUserProfile (slide_from_right)
        ├── AlbumGrid, MonthlyAlbumGrid (top-level card)
        └── ReportUser, HelpSupport (modal)
```

Deep linking: `lapse://` and `com.lapseclone.app://` prefixes with routes for feed, messages, camera, profile, darkroom, notifications, friends, and auth flows.

Use `navigationRef` (exported from AppNavigator) for programmatic navigation outside components (e.g., notification handlers in App.js).

### Photo Lifecycle

1. **Capture** - CameraScreen captures photo, queued via `uploadQueueService`
2. **Developing** - Photo in Firestore with `status: 'developing'`, visible in DarkroomScreen
3. **Reveal** - After a random 0-5 minute developing period, `revealPhotos()` changes `status: 'revealed'`, triggers push notifications
4. **Feed** - Revealed photos appear in FeedScreen for user and friends
5. **Triage** - User can set `photoState: 'journal'` (keep), `'archive'` (hide), or delete permanently

The darkroom uses a rolling random reveal system:
- `calculateNextRevealTime()` - Returns a timestamp 0-5 random minutes from now
- `scheduleNextReveal(userId)` - Sets `nextRevealAt` in the darkroom document
- `isDarkroomReadyToReveal(userId)` - Checks if current time >= `nextRevealAt`
- `revealPhotos(userId)` - Updates all developing photos to revealed status
- Three reveal triggers: App.js on foreground, DarkroomScreen on focus, `processDarkroomReveals` cloud function every 2 minutes

### Custom Hooks

- `useCamera()` - Camera permissions, capture, flash, facing, zoom levels, upload queue. Exports layout constants: `TAB_BAR_HEIGHT`, `FOOTER_HEIGHT`, `CAMERA_HEIGHT`
- `useDarkroom()` - Developing/revealed photos subscription, countdown timer, reveal logic
- `useFeedPhotos()` - Real-time feed subscription, photo grouping by user
- `useComments()` - Comment CRUD, real-time subscriptions, mention parsing
- `useMentionSuggestions()` - Autocomplete for @mentions in comments
- `usePhotoDetailModal()` - Modal state, swipe navigation, photo context
- `useSwipeableCard()` - Gesture handling for tinder-style swiping
- `useViewedStories()` - Track which users' photos have been viewed
- `useScreenTrace()` - Firebase Performance Monitoring screen traces
- `useMessages()` - Conversation list subscription, friend data joining, unread count aggregation, optimistic delete
- `useConversation()` - Individual conversation messages subscription, cursor pagination, send, read tracking

### Context Providers

- **AuthContext** - Firebase user, userProfile (Firestore document), `signOut()`, `updateProfile()`, `cancelDeletion()`
- **PhoneAuthContext** - Shares phone auth `confirmationRef` between PhoneInput/Verification screens and DeleteAccount re-auth
- **PhotoDetailContext** - Two hooks: `usePhotoDetail()` for full state + actions, `usePhotoDetailActions()` for actions only (avoids re-renders). Supports two modes: `'feed'` and `'stories'` (with friend-to-friend navigation)
- **ThemeProvider** - Dark mode toggle (currently unused, app is dark-only)

### Logging

**Never use `console.log()` directly.** Always use the logger utility:

```javascript
import logger from '../utils/logger';

logger.debug('Detailed info', { userId, count }); // Dev only
logger.info('Important events', { photoId });     // Production
logger.warn('Recoverable issues', { error });     // Production
logger.error('Failures', { error: error.message }); // Production
```

Logger redacts sensitive data (tokens, passwords, keys). `console.log` is stripped from production builds via babel `transform-remove-console`.

### Import Organization

Organize imports in this exact order with blank lines between groups:

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

import { collection, query } from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';

import { feedService } from '../services/firebase/feedService';

import { FeedPhotoCard } from '../components';

import { useAuth } from '../context/AuthContext';

import { logger } from '../utils/logger';
```

1. React and React Native core
2. Third-party packages (Firebase, navigation, etc.)
3. Internal services
4. Components
5. Context and hooks
6. Utilities

## Firebase Specifics

### React Native Firebase vs Web SDK

This project uses **React Native Firebase SDK** (`@react-native-firebase/*`), NOT the web SDK:

```javascript
// CORRECT - React Native Firebase (modular)
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
const db = getFirestore();
const userDoc = await getDoc(doc(db, 'users', userId));

// WRONG - Web SDK (don't use this)
import { getFirestore } from 'firebase/firestore';
```

### Firestore Collections

- `users/` - User profiles (uid, username, displayName, photoURL, friends, fcmToken, nextRevealAt, etc.)
- `photos/` - All photos (userId, photoURL, status: `'developing'`|`'revealed'`, photoState: `'journal'`|`'archive'`|null, createdAt)
- `friendships/` - Friend relationships (user1Id, user2Id, status: `'pending'`|`'accepted'`)
- `comments/` - Photo comments (photoId, userId, text, mentions, createdAt)
- `albums/` - User-created albums (userId, title, photoIds, coverPhotoId)
- `notifications/` - In-app notifications (userId, type, read, createdAt). Auto-deleted after 30 days.
- `blocks/` - User blocking relationships (blockerId, blockedId)
- `reports/` - User reports (reporterId, reportedId, reason)
- `reactionBatches/` - Batched reaction notifications (photoId, reactorId, reactions, status, sentAt). Auto-deleted 7 days after sending.
- `conversations/` - Direct messaging conversations (participants, lastMessage, deletedAt, unreadCount). Document ID: `[lowerUserId]_[higherUserId]`
- `conversations/{id}/messages/` - Individual messages (senderId, text, gifUrl, type, createdAt). Messages are permanent (never deleted, retained for moderation).

### Cloud Functions Structure

```
functions/
├── index.js            # Main functions (~2700 lines): notifications, cleanup, signed URLs, account deletion, DM metadata
├── validation.js       # Zod schemas for request validation
├── logger.js           # Logging utility
├── notifications/      # Modular notification logic
│   ├── batching.js     # Reaction debouncing/batching
│   ├── receipts.js     # Reaction receipts
│   └── sender.js       # Push notification sending
└── tasks/
    └── sendBatchedNotification.js
```

Notification templates are randomized for a non-robotic feel (e.g., "X tagged you in a photo", "You're in X's latest snap").

### Environment Variables

Firebase config is provided via native files (`GoogleService-Info.plist`, `google-services.json`), NOT environment variables. Optional env vars via `react-native-dotenv` (imported from `@env`): `GIPHY_API_KEY`, `FUNCTIONS_EMULATOR`.

## Code Conventions

### File Naming
- Components: PascalCase (`FeedPhotoCard.js`)
- Services/Utilities: camelCase (`feedService.js`, `timeUtils.js`)
- Screens: PascalCase with `Screen` suffix (`FeedScreen.js`)
- Hooks: camelCase with `use` prefix (`useCamera.js`)

### Function Naming
- All functions: camelCase (`uploadPhoto`, `sendFriendRequest`)
- Event handlers: `handle` prefix (`handleCapturePhoto`, `handleLogin`)
- Boolean returns: `is`/`has` prefix (`isDarkroomReady`, `hasPermission`)

### Commit Messages

Format: `type(scope): description`

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

After completing each plan or phase of work, commit the changes before moving on. Do not batch multiple plans into a single commit.

## Common Gotchas

1. **Phone Auth Confirmation Ref** - `PhoneAuthConfirmResult` from `signInWithPhoneNumber()` cannot be serialized. Share it via `PhoneAuthContext`, not navigation params.

2. **Firestore Timestamps** - Use `serverTimestamp()` for createdAt/updatedAt. When reading, check if timestamp has `.toDate()` method (Firestore Timestamp) vs ISO string.

3. **Darkroom Reveal Timing** - After each reveal, `calculateNextRevealTime()` schedules the next reveal 0-5 random minutes in the future. Reveals are triggered three ways: App.js checks on foreground, DarkroomScreen checks on focus, and `processDarkroomReveals` cloud function runs every 2 minutes as a background catch-all.

4. **Navigation Params in Nested Navigators** - When navigating to a tab screen with params, use a two-step approach:
   ```javascript
   navigationRef.current.navigate('MainTabs', { screen: 'Camera' });
   setTimeout(() => {
     navigationRef.current.navigate('MainTabs', {
       screen: 'Camera',
       params: { openDarkroom: true }
     });
   }, 100);
   ```

5. **Image Caching** - Use `expo-image` (not `react-native` Image) for automatic caching. Set `cachePolicy="memory-disk"` for profile photos.

6. **Push Notifications** - The app uses `expo-notifications`, NOT `@react-native-firebase/messaging`. FCM tokens are stored in user documents and sent to cloud functions for delivery.

7. **Signed URLs** - Photos use Firebase Storage signed URLs with 7-day expiry. `signedUrlService` handles URL generation and refresh.

8. **Account Deletion** - Soft delete with recovery period via `accountService`. `DeletionRecoveryModal` shows countdown. `cancelDeletion()` in AuthContext to recover.

9. **PhotoDetail Modes** - PhotoDetailContext supports `'feed'` mode (single user's photos) and `'stories'` mode (swipe between friends). Use `usePhotoDetailActions()` when you only need to trigger actions without subscribing to state changes.

10. **Performance Monitoring** - Firebase Performance is integrated via `useScreenTrace()` hook and `withTrace()` wrapper in `performanceService`. Disabled in `__DEV__` to avoid polluting production metrics.

11. **Android Platform Guards** - Always wrap Android-only code in `Platform.OS === 'android'` checks or use `.android.js` file extensions. Never apply Android-specific styles (e.g. `elevation`) unconditionally — they are ignored on iOS but can cause unexpected layout on Android if misused.

12. **Android Shadows** - iOS uses `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`. Android uses `elevation`. Use `Platform.select` when shadows are needed on both platforms.

13. **Android Back Button** - Android has a hardware/gesture back button. For screens that are modals or overlays, add a `BackHandler` listener (or `useFocusEffect` + `BackHandler`) to prevent unexpected back navigation. React Navigation handles this for standard stack screens automatically.

14. **Edge-to-Edge on Android** - `edgeToEdgeEnabled: true` in `app.json` means the app draws behind the system gesture navigation bar. Use `useSafeAreaInsets()` bottom inset to add padding where needed (tab bar, bottom sheets, fixed footers).
