# Architecture

**Analysis Date:** 2026-02-23

## Pattern Overview

**Overall:** Layered + Service-Oriented with Context-based Global State

The app follows a clear separation of concerns with distinct layers for navigation, screens/UI, business logic (services), and state management (contexts). The service layer abstracts all Firebase operations, allowing screens to remain focused on presentation.

**Key Characteristics:**

- Abstraction of Firebase operations isolated in src/services/firebase/
- Stateless services export pure functions returning { success, error } objects
- Custom hooks encapsulate business logic (darkroom, feed, comments, photos)
- Context for global state (Auth, PhotoDetail, Theme)
- Deep navigation structure with nested navigators
- Async-first photo lifecycle: queue immediately, upload in background, reveal on schedule

## Layers

**Entry Point & Setup:**

- Purpose: Bootstrap the app, initialize services, listen for lifecycle events
- Location: /App.js
- Contains: Splash screen, font loading, notification listeners, OTA updates, app state listeners

**Navigation Layer:**

- Purpose: Route management and screen orchestration
- Location: src/navigation/AppNavigator.js
- Contains: Stack navigators, tab navigators, modal presentations, deep linking config

**Screens/UI Layer:**

- Purpose: User-facing components that consume state and dispatch actions
- Location: src/screens/
- Contains: ~30 screen components (FeedScreen, CameraScreen, ProfileScreen, etc.)

**Component Layer:**

- Purpose: Reusable UI elements (buttons, cards, modals, input fields)
- Location: src/components/
- Contains: PressStart2P pixel font UI, animations, form inputs, cards

**Custom Hooks Layer:**

- Purpose: Extract and share business logic across screens
- Location: src/hooks/
- Contains: useCamera, useDarkroom, useFeedPhotos, useComments, usePhotoDetailModal, useSwipeableCard

**Context/Global State Layer:**

- Purpose: Manage app-wide state without prop drilling
- Location: src/context/
- Contains: AuthContext, PhoneAuthContext, PhotoDetailContext, ThemeProvider

**Service Layer:**

- Purpose: Abstract Firebase operations and external integrations
- Location: src/services/ and src/services/firebase/
- Contains: 20+ specialized services for photos, feeds, auth, notifications, albums, comments

**Utilities & Constants:**

- Purpose: Shared helpers, constants, logging
- Location: src/utils/, src/constants/, src/config/

## Data Flow

**Authentication Flow:**

1. App.js checks Firebase Auth state via onAuthStateChanged
2. AuthProvider loads user profile from Firestore
3. Navigation updates: unauthenticated → onboarding → main app
4. PhoneAuthContext shares ConfirmationResult between PhoneInputScreen and VerificationScreen
5. ProfileSetup → Selects → ContactsSync → NotificationPermission (onboarding stack)

**Photo Capture & Upload Flow:**

1. CameraScreen captures photo, calls addToUploadQueue()
2. uploadQueueService stores queue item in AsyncStorage, returns immediately
3. Camera returns to ready state
4. uploadQueueService processes queue sequentially in background with retry logic
5. Upload persists across app restarts

**Photo Reveal Flow:**

1. Darkroom stores nextRevealAt timestamp (0-5 minutes random)
2. Three reveal triggers: App.js on foreground, DarkroomScreen on focus, Cloud Function every 2 minutes
3. revealPhotos batch-updates status developing → revealed
4. Clients listen in real-time via Firestore subscriptions

**Feed Loading & Real-time Updates:**

1. FeedScreen mounts, calls useFeedPhotos()
2. feedService.getFeedPhotos() chunks friend IDs, server-side filters journaled photos from last day
3. User data batch-fetched in single query (avoids N+1)
4. Feed curated by engagement: top 5 photos per friend ranked by reactionCount
5. Real-time listener updates feed incrementally via subscribeFeedPhotos()

**Photo Detail Modal Flow:**

1. FeedScreen registers callbacks via usePhotoDetailActions()
2. User taps photo card, calls openPhotoDetail()
3. PhotoDetailContext stores state, navigation navigates to PhotoDetail modal
4. Swipe left/right/down navigates and dismisses
5. Callbacks propagate optimistic updates back to FeedScreen

**State Management:**

- Global (Context): Auth, PhotoDetail, Theme
- Local (Hooks): Feed photos, camera permissions, comments, darkroom countdown
- Persistent (AsyncStorage): Upload queue, "Whats New" modal dismissal
- Real-time (Firestore subscriptions): Feed, comments, reactions, notifications

## Key Abstractions

**Service Functions:**

- Isolate Firebase operations from screens
- All services export async functions returning { success, error }
- Examples: src/services/firebase/photoService.js, feedService.js, darkroomService.js

**Custom Hooks:**

- Encapsulate business logic for reuse
- Examples: useCamera(), useFeedPhotos(), useDarkroom()
- Manage state, effects, subscriptions internally

**Context Providers:**

- Share state without prop drilling
- Examples: AuthContext, PhotoDetailContext
- Separate state context from actions context to avoid unnecessary re-renders

## Entry Points

**App.js:**

- Location: /App.js
- Responsibilities: OTA updates, font loading, splash screen, notification listeners, foreground reveal check

**AppNavigator.js:**

- Location: src/navigation/AppNavigator.js
- Responsibilities: Conditional auth/onboarding/main app navigation, deep linking, permissions reconciliation

**Key Screens:**

- FeedScreen (src/screens/FeedScreen.js): Real-time feed, photo detail modal
- CameraScreen (src/screens/CameraScreen.js): Photo capture, upload queue, darkroom nav
- DarkroomScreen (src/screens/DarkroomScreen.js): Triage, captions, reveal countdown
- PhotoDetailScreen (src/screens/PhotoDetailScreen.js): Swipe nav, reactions, comments
- ProfileScreen (src/screens/ProfileScreen.js): User profile, photo grid, albums

## Error Handling

**Strategy:** Layered error handling with logging, user feedback, graceful degradation

**Patterns:**

- Service layer: All services return { success: boolean, error: string, data?: T }
- Hook level: Handle success/error, log, update UI state
- Screen level: User-facing error alerts for critical failures
- Error Boundary: Catches render errors at src/components/ErrorBoundary.js
- Logging: Centralized logger sanitizes sensitive data at src/utils/logger.js

## Cross-Cutting Concerns

**Logging:** src/utils/logger.js

- Levels: DEBUG (dev only), INFO, WARN, ERROR
- Sanitizes tokens, passwords, API keys

**Validation:** src/utils/validation.js

- Phone number, username, caption length, email format

**Performance Monitoring:** src/services/firebase/performanceService.js

- withTrace() wrapper, useScreenTrace() hook
- Disabled in **DEV** to avoid polluting production metrics

**Haptics & Sound:** src/utils/haptics.js, src/utils/soundUtils.js

- Feedback on button press, photo capture, errors

**Secure Storage:** src/services/secureStorageService.js

- Stores sensitive data (auth tokens)
- Uses react-native-keychain

**Theme & Styling:**

- Constants: src/constants/colors.js, spacing.js, typography.js, layout.js
- Provider: ThemeProvider in src/context/ThemeContext.js (dark-only)
- All styles reference constants; no magic numbers

---

_Architecture analysis: 2026-02-23_
