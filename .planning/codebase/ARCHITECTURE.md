# Architecture

**Analysis Date:** 2026-01-26

## Pattern Overview

**Overall:** Mobile App with Firebase Backend-as-a-Service (BaaS)

**Key Characteristics:**

- Single React Native mobile application
- Firebase for all backend services (auth, database, storage, functions)
- Context-based state management (no Redux/MobX)
- Service layer for Firebase operations
- Presentation layer with screens and components

## Layers

**Presentation Layer (Screens):**

- Purpose: UI screens for user interaction
- Contains: Full-screen components, navigation handlers, state management
- Location: `src/screens/*.js`
- Depends on: Context providers, hooks, services, components
- Used by: AppNavigator

**Component Layer:**

- Purpose: Reusable UI elements
- Contains: Cards, modals, buttons, inputs, comment components
- Location: `src/components/*.js`, `src/components/comments/*.js`
- Depends on: Styles, constants, utilities
- Used by: Screens

**Context Layer (State Management):**

- Purpose: Global state and authentication
- Contains: AuthContext (user state), PhoneAuthContext (auth flow), ThemeContext
- Location: `src/context/*.js`
- Depends on: Firebase auth services
- Used by: Screens, components

**Hooks Layer:**

- Purpose: Reusable stateful logic
- Contains: useFeedPhotos, useDarkroom, useCamera, useComments, useSwipeableCard
- Location: `src/hooks/*.js`
- Depends on: Services, context
- Used by: Screens

**Service Layer:**

- Purpose: Firebase operations and business logic
- Contains: photoService, darkroomService, feedService, friendshipService, etc.
- Location: `src/services/firebase/*.js`
- Depends on: Firebase SDK, validation utilities
- Used by: Hooks, screens, context

**Cloud Functions (Server):**

- Purpose: Server-side logic, scheduled tasks, notifications
- Contains: Scheduled reveals, push notifications, account deletion
- Location: `functions/index.js`
- Depends on: Firebase Admin SDK, Expo Push API
- Triggers: Firestore events, scheduled (pub/sub)

## Data Flow

**Photo Capture Flow:**

1. User opens CameraScreen, camera initializes
2. User captures photo via expo-camera
3. Photo compressed via expo-image-manipulator
4. uploadPhoto() uploads to Firebase Storage
5. Photo document created in Firestore with status='developing'
6. Darkroom badge count updates

**Darkroom Reveal Flow:**

1. processDarkroomReveals Cloud Function runs every 2 minutes
2. Queries darkrooms where nextRevealAt <= now
3. Updates all 'developing' photos to 'revealed'
4. Schedules next reveal (0-5 minutes)
5. sendPhotoRevealNotification triggers push notification

**Feed Display Flow:**

1. FeedScreen mounts, useFeedPhotos hook initializes
2. Hook subscribes to Firestore photos collection (photoState='journal')
3. Client-side filters by friend user IDs
4. FeedPhotoCard components render with reactions
5. PhotoDetailModal opens on card tap
6. Reactions update via toggleReaction in feedService

**State Management:**

- AuthContext: User authentication state, persisted via AsyncStorage
- Local state in screens/hooks for UI state
- Firestore for persistent data (no local database)

## Key Abstractions

**Service:**

- Purpose: Encapsulate Firebase operations
- Examples: `src/services/firebase/photoService.js`, `src/services/firebase/feedService.js`
- Pattern: Exported async functions, no classes

**Context Provider:**

- Purpose: Share state across component tree
- Examples: `AuthProvider`, `PhoneAuthProvider`, `ThemeProvider`
- Pattern: React Context with useContext hook

**Custom Hook:**

- Purpose: Encapsulate reusable stateful logic
- Examples: `useFeedPhotos`, `useDarkroom`, `useComments`
- Pattern: useState + useEffect + service calls

**Screen:**

- Purpose: Full-screen UI component
- Examples: `FeedScreen`, `CameraScreen`, `DarkroomScreen`
- Pattern: Functional component with hooks

## Entry Points

**App Entry:**

- Location: `App.js`
- Triggers: App launch
- Responsibilities: Initialize notifications, Giphy SDK, wrap with providers, render AppNavigator

**Navigation Entry:**

- Location: `src/navigation/AppNavigator.js`
- Triggers: App.js render
- Responsibilities: Auth flow routing, tab navigation, deep linking

**Cloud Functions Entry:**

- Location: `functions/index.js`
- Triggers: Firestore events, scheduled pub/sub, callable functions
- Responsibilities: Photo reveals, notifications, account deletion

## Error Handling

**Strategy:** Try/catch in services, error logging via logger utility, user-facing alerts

**Patterns:**

- Services return `{ success: true/false, data/error }` objects
- Screens/hooks check success and show appropriate UI
- ErrorBoundary component catches React render errors
- Logger utility sanitizes and logs errors (console in dev, future Sentry)

## Cross-Cutting Concerns

**Logging:**

- Custom logger utility: `src/utils/logger.js`
- Levels: debug, info, warn, error
- Sanitizes sensitive data automatically
- TODO: Sentry integration planned

**Authentication:**

- Phone-based auth via Firebase Auth
- AuthContext provides user state globally
- Protected routes via AppNavigator conditional rendering

**Notifications:**

- expo-notifications for device permissions and tokens
- Cloud Functions send via Expo Push API
- Deep linking for notification tap navigation

**Styling:**

- Separate style files: `src/styles/*.js`
- Constants for colors, spacing, typography: `src/constants/`
- No CSS-in-JS library (StyleSheet.create)

---

_Architecture analysis: 2026-01-26_
_Update when major patterns change_
