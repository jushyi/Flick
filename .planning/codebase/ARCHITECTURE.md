# Architecture

**Analysis Date:** 2026-01-26

## Pattern Overview

**Overall:** Mobile App with Firebase BaaS (Backend-as-a-Service)

**Key Characteristics:**

- React Native single-page mobile application
- Firebase for all backend services (auth, database, storage, functions)
- Context API for global state management
- Service layer abstraction over Firebase SDK
- Cloud Functions for server-side logic and scheduled tasks

## Layers

**Presentation Layer (Screens):**

- Purpose: UI rendering and user interaction handling
- Contains: Screen components, navigation handling
- Location: `src/screens/*.js`
- Depends on: Components, Hooks, Context
- Used by: Navigation (AppNavigator)

**Component Layer:**

- Purpose: Reusable UI building blocks
- Contains: FeedPhotoCard, PhotoDetailModal, Button, Input, etc.
- Location: `src/components/*.js`, `src/components/comments/*.js`
- Depends on: Constants (colors, typography), Styles
- Used by: Screens

**Hook Layer:**

- Purpose: Encapsulate stateful logic and side effects
- Contains: useCamera, useDarkroom, useFeedPhotos, useComments
- Location: `src/hooks/*.js`
- Depends on: Services, Context
- Used by: Screens, Components

**Context Layer:**

- Purpose: Global state management and cross-cutting concerns
- Contains: AuthContext, PhoneAuthContext, ThemeContext
- Location: `src/context/*.js`
- Depends on: Services
- Used by: Entire app via Provider tree

**Service Layer:**

- Purpose: Firebase SDK abstraction, business logic
- Contains: photoService, feedService, friendshipService, notificationService, etc.
- Location: `src/services/firebase/*.js`
- Depends on: Firebase SDK, Logger
- Used by: Hooks, Context, Screens

**Utility Layer:**

- Purpose: Shared helpers and utilities
- Contains: logger, timeUtils, validation, haptics
- Location: `src/utils/*.js`
- Depends on: Nothing (leaf modules)
- Used by: All layers

**Cloud Functions Layer:**

- Purpose: Server-side logic, scheduled tasks, push notifications
- Contains: Firestore triggers, scheduled functions, callable functions
- Location: `functions/index.js`
- Depends on: Firebase Admin SDK
- Used by: Triggered by Firestore events, Expo Push API

## Data Flow

**Photo Capture Flow:**

1. User opens Camera tab → `CameraScreen.js`
2. User captures photo → `useCamera.js` handles camera interaction
3. Photo compressed → `expo-image-manipulator`
4. Photo uploaded → `storageService.js` → Firebase Storage
5. Photo metadata saved → `photoService.js` → Firestore (status: 'developing')
6. Darkroom badge updates → Real-time listener in `useDarkroom.js`

**Darkroom Reveal Flow:**

1. Cloud Function `processDarkroomReveals` runs every 2 minutes
2. Checks darkrooms with overdue `nextRevealAt`
3. Reveals all developing photos (batch update)
4. Triggers `sendPhotoRevealNotification` via Firestore update
5. User opens app → `DarkroomScreen.js` shows revealed photos
6. User triages (Journal/Archive/Delete) → `photoService.js` updates status

**Feed Display Flow:**

1. User navigates to Feed tab → `FeedScreen.js`
2. `useFeedPhotos.js` calls `feedService.getFeedPhotos()`
3. Query: `photoState == 'journal'` (friends-only filter client-side)
4. Results sorted client-side by `capturedAt` DESC
5. Real-time subscription via `subscribeFeedPhotos()`

**Reaction Flow:**

1. User taps photo → `PhotoDetailModal.js` opens
2. User taps emoji → `handleReaction()` in `FeedScreen.js`
3. Optimistic UI update → Local state updated immediately
4. Firebase update → `feedService.toggleReaction()`
5. Cloud Function `sendReactionNotification` triggered
6. Debounced notification sent to photo owner

**State Management:**

- Global auth state: `AuthContext` (Firebase Auth listener)
- Local component state: React `useState` / `useReducer`
- Async data: Custom hooks with loading/error states
- Real-time updates: Firestore `onSnapshot` listeners

## Key Abstractions

**Service:**

- Purpose: Encapsulate Firebase operations with consistent return types
- Examples: `feedService.js`, `photoService.js`, `friendshipService.js`
- Pattern: `{ success: boolean, data?: T, error?: string }`

**Custom Hook:**

- Purpose: Manage async data fetching and local state
- Examples: `useFeedPhotos.js`, `useDarkroom.js`, `useComments.js`
- Pattern: Returns `{ data, loading, error, refresh }` style object

**Context Provider:**

- Purpose: Share global state across component tree
- Examples: `AuthProvider`, `ThemeProvider`
- Pattern: Wrap app in `App.js`, consumed via `useContext`

**Screen:**

- Purpose: Top-level route component
- Examples: `FeedScreen.js`, `CameraScreen.js`, `DarkroomScreen.js`
- Pattern: Compose hooks + components, handle navigation

## Entry Points

**App Entry:**

- Location: `App.js`
- Triggers: Expo app launch
- Responsibilities:
  - Initialize providers (SafeAreaProvider, ErrorBoundary, ThemeProvider, AuthProvider)
  - Setup notification listeners
  - Handle splash screen
  - Check for pending reveals on foreground

**Navigation Entry:**

- Location: `src/navigation/AppNavigator.js`
- Triggers: After auth state determined
- Responsibilities:
  - Route to Auth flow or Main tabs based on auth state
  - Deep linking configuration
  - Navigation ref export for programmatic navigation

**Cloud Functions Entry:**

- Location: `functions/index.js`
- Triggers: Firestore events, scheduled (pub/sub), callable
- Responsibilities:
  - Photo reveals, push notifications, signed URLs, account deletion

## Error Handling

**Strategy:** Try/catch with structured logging, graceful degradation

**Patterns:**

- Services return `{ success: false, error: message }` on failure
- Hooks track `error` state for UI display
- `ErrorBoundary` component catches React render errors
- Logger utility records errors with context
- Cloud Functions return `null` on non-critical errors, throw `HttpsError` on critical

**Example:**

```javascript
// Service pattern
try {
  const result = await someOperation();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', { error: error.message });
  return { success: false, error: error.message };
}
```

## Cross-Cutting Concerns

**Logging:**

- Custom logger: `src/utils/logger.js`
- Environment-aware (debug filtered in prod)
- Structured logging with context objects
- Planned: Sentry integration (Phase 10)

**Validation:**

- Cloud Functions: Zod schemas in `functions/validation.js`
- Client: Manual validation in service functions
- Firestore: Security rules for access control

**Authentication:**

- Firebase Auth with phone + Apple Sign-In
- AuthContext provides global auth state
- Protected routes via `AppNavigator.js` conditional rendering

**Haptic Feedback:**

- `src/utils/haptics.js` wraps `expo-haptics`
- Used for reactions, captures, navigation

---

_Architecture analysis: 2026-01-26_
_Update when major patterns change_
