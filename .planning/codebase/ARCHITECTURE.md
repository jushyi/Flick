# Architecture

**Analysis Date:** 2026-02-19

## Pattern Overview

**Overall:** Layered Monolithic Mobile Application (React Native + Expo)

**Key Characteristics:**

- Presentation layer (Screens + Components) with thin UI logic
- Business logic layer (Custom Hooks + Services) with `{ success, error }` return pattern
- Data layer (Firebase backend + Context-based global state)
- Platform-specific modules (`.ios.js` / `.android.js` file extensions)
- Real-time subscriptions for live data updates
- Phone-only authentication with onboarding flow

## Layers

**Presentation Layer (Screens & Components):**

- Purpose: Render UI, handle user input, delegate logic to hooks/context
- Contains: 36 screen components (`src/screens/`), 44+ reusable components (`src/components/`)
- Depends on: Hooks for business logic, Context for global state, Constants for theming
- Used by: Navigation system (`src/navigation/AppNavigator.js`)

**Business Logic Layer (Hooks):**

- Purpose: Encapsulate stateful logic, subscriptions, side effects
- Contains: 13 custom hooks (`src/hooks/`) - camera, feed, darkroom, comments, gestures, messaging
- Depends on: Services for data operations, Context for auth state
- Used by: Screens that need complex state management

**Service Layer (Firebase + External):**

- Purpose: Abstract all data operations behind `{ success, error }` interface
- Contains: 22 Firebase services (`src/services/firebase/`), 7 root services (`src/services/`)
- Depends on: Firebase SDK, external APIs (iTunes, Giphy)
- Used by: Hooks, Context providers, and occasionally Screens directly

**State Management Layer (Context API):**

- Purpose: Provide global state across component tree
- Contains: AuthContext, PhoneAuthContext, PhotoDetailContext, ThemeContext (`src/context/`)
- Depends on: Services for data fetching, Firebase Auth for user state
- Used by: Any component that needs auth state, photo detail state

**Utility Layer:**

- Purpose: Shared helpers, constants, and styles
- Contains: Logger, date/phone/image utils (`src/utils/`), design tokens (`src/constants/`), shared styles (`src/styles/`)
- Depends on: Node.js/RN built-ins only
- Used by: All other layers

## Data Flow

**Photo Capture & Upload:**

1. User taps capture in `CameraScreen` (via `useCamera` hook)
2. Photo queued in `uploadQueueService.js` (persists to AsyncStorage)
3. `photoService.createPhoto()` creates Firestore doc (status: `'developing'`)
4. `storageService.uploadPhoto()` uploads to Firebase Storage
5. Photo appears in `DarkroomScreen` via real-time subscription
6. Next day at 9am: `revealPhotos()` batch-updates status to `'revealed'`
7. Cloud Function sends push notifications to friends
8. Photo appears in friends' `FeedScreen` via `useFeedPhotos` subscription

**Authentication Flow:**

1. `PhoneInputScreen` → `phoneAuthService.sendVerificationCode()` (Firebase SMS OTP)
2. `VerificationScreen` → confirms code via `PhoneAuthContext.confirmationRef`
3. `AuthContext` checks Firestore for existing user profile
4. New user → `ProfileSetupScreen` → `SelectsScreen` → `ContactsSyncScreen` → `NotificationPermissionScreen`
5. Complete profile → `MainTabs` (Feed, Camera, Profile)

**Feed & Comments Subscription:**

1. `FeedScreen` mounts → `useFeedPhotos.subscribeFeedPhotos()`
2. Real-time Firestore `onSnapshot` on friends' revealed photos
3. `curateTopPhotosPerFriend()` selects top photos per friend
4. User adds comment → `commentService.createComment()` writes to Firestore
5. Cloud Function sends mention notifications if @mentions detected

**State Management:**

- Global auth state via `AuthContext` (Firebase user + Firestore profile)
- Photo detail modal state via `PhotoDetailContext` (two hooks to avoid over-renders)
- Phone auth confirmation via `PhoneAuthContext` (ref for non-serializable Firebase object)
- Local state via `useState` / `useRef` in hooks and screens
- Persistent state via AsyncStorage (upload queue, viewed stories)

## Key Abstractions

**Service:**

- Purpose: Encapsulate Firebase/external operations with consistent API
- Examples: `src/services/firebase/photoService.js`, `src/services/firebase/feedService.js`, `src/services/firebase/commentService.js`
- Pattern: All return `{ success: true, data }` or `{ success: false, error: string }`

**Custom Hook:**

- Purpose: Encapsulate stateful business logic for screens
- Examples: `src/hooks/useCamera.js`, `src/hooks/useDarkroom.js`, `src/hooks/useFeedPhotos.js`
- Pattern: Return state + action functions; screens are thin wrappers

**Context Provider:**

- Purpose: Share global state across component tree
- Examples: `src/context/AuthContext.js` (user + profile), `src/context/PhotoDetailContext.js` (modal state)
- Pattern: Provider wraps app tree; consumer hooks (`useAuth()`, `usePhotoDetail()`)

**Platform Module:**

- Purpose: Platform-specific implementations with shared base
- Examples: `src/hooks/useCamera.ios.js`, `src/hooks/useCamera.android.js`, `src/hooks/useCameraBase.js`
- Pattern: Metro auto-resolves `.ios.js` / `.android.js`; shared logic in base file

## Entry Points

**App Entry:**

- Location: `index.js` → `App.js`
- Triggers: App launch
- Responsibilities: Register root component, load fonts, init Firebase Perf, Giphy SDK, check OTA updates, set up push notification listeners, check darkroom reveals on foreground

**Navigation Root:**

- Location: `src/navigation/AppNavigator.js`
- Triggers: After app initialization
- Responsibilities: Route auth vs onboarding vs main app, export `navigationRef` for programmatic nav

**Cloud Functions:**

- Location: `functions/index.js` (~2700 lines)
- Triggers: HTTP callable, Firestore triggers, Cloud Tasks
- Responsibilities: Push notifications, signed URL generation, account deletion, email sending, reaction batching, DM metadata updates

## Error Handling

**Strategy:** Services catch and return `{ success: false, error }`, consumers decide how to display

**Patterns:**

- Services: try/catch wrapping all Firebase operations, log via `logger.error()`, return error object
- Hooks: Check service return values, set error state for UI display
- Screens: Show alerts or inline error messages based on hook error state
- App root: `ErrorBoundary` component wraps app for crash recovery
- Cloud Functions: Zod validation at entry, structured error responses (`functions/validation.js`)

## Cross-Cutting Concerns

**Logging:**

- Custom logger (`src/utils/logger.js`) - Structured logging with sensitive data redaction
- Levels: debug (dev only), info, warn, error
- Production: `console.log` stripped by Babel `transform-remove-console`

**Validation:**

- Client: Manual validation in services and screens (no Zod on client)
- Cloud Functions: Zod schemas for request validation (`functions/validation.js`)

**Authentication:**

- Firebase Auth phone-only via `PhoneAuthContext` and `AuthContext`
- Auth state drives navigation (unauthenticated → auth screens, authenticated → main app)

**Performance:**

- Firebase Performance Monitoring via `useScreenTrace()` hook and `withTrace()` wrapper
- Disabled in `__DEV__` mode

**Navigation:**

- `navigationRef` exported from `AppNavigator.js` for programmatic navigation outside components
- Deep linking: `lapse://` and `com.lapseclone.app://` prefixes

---

_Architecture analysis: 2026-02-19_
_Update when major patterns change_
