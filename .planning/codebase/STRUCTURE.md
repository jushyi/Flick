# Codebase Structure

**Analysis Date:** 2026-02-19

## Directory Layout

```
Lapse Clone/
├── src/                    # Main application source
│   ├── navigation/         # React Navigation configuration
│   ├── screens/            # Screen components (36 screens)
│   ├── components/         # Reusable UI components (44+ components)
│   │   ├── comments/       # Comment-related components
│   │   └── ProfileSong/    # Song selection component
│   ├── hooks/              # Custom React hooks (11 hooks)
│   ├── context/            # React Context providers (4 contexts)
│   ├── services/           # Business logic & API layer
│   │   └── firebase/       # Firebase service modules (21 services)
│   ├── utils/              # Utility functions
│   ├── constants/          # App-wide constants & design tokens
│   └── styles/             # Shared style modules (25+ files)
├── functions/              # Firebase Cloud Functions (Node 20)
│   ├── notifications/      # Notification modules
│   ├── tasks/              # Cloud Task handlers
│   └── __tests__/          # Cloud function tests
├── __tests__/              # Jest test suite
│   ├── setup/              # Test setup & factories
│   ├── __mocks__/          # Service mocks
│   ├── hooks/              # Hook tests
│   ├── services/           # Service tests
│   ├── integration/        # Integration tests
│   └── utils/              # Utility tests
├── plugins/                # Custom Expo plugins
├── assets/                 # App icons, splash screens
├── docs/                   # Documentation
├── .github/                # GitHub Actions workflows
├── .husky/                 # Git hooks (pre-commit)
├── .maestro/               # Maestro E2E test configs
├── .planning/              # Project planning documents
│   └── codebase/           # Codebase analysis (this directory)
├── App.js                  # Main app component
├── index.js                # Expo root entry point
├── app.json                # Expo/native configuration
├── app.config.js           # Dynamic Expo config (dev/prod switching)
├── babel.config.js         # Babel configuration
├── eslint.config.js        # ESLint configuration
├── jest.config.js          # Jest configuration
├── eas.json                # EAS Build profiles
├── firebase.json           # Firebase project config
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore composite indexes
└── storage.rules           # Cloud Storage security rules
```

## Directory Purposes

**src/navigation/**

- Purpose: React Navigation route definitions
- Contains: `AppNavigator.js` (single file with full navigation tree)
- Key files: `AppNavigator.js` - Auth stack, onboarding stack, main tabs, modals
- Exports: `navigationRef` for programmatic navigation outside components

**src/screens/**

- Purpose: Full-screen components for each route
- Contains: 39 screen files (PascalCase + `Screen` suffix)
- Key files: `FeedScreen.js`, `CameraScreen.js`, `ProfileScreen.js`, `DarkroomScreen.js`, `PhotoDetailScreen.js`, `MessagesScreen.js`, `ConversationScreen.js`, `NewMessageScreen.js`
- Subdirectories: None (flat structure)

**src/components/**

- Purpose: Reusable UI building blocks
- Contains: 49+ components (PascalCase naming)
- Key files: `FeedPhotoCard.js`, `Button.js`, `CustomBottomTabBar.js`, `ErrorBoundary.js`, `ConversationRow.js`, `MessageBubble.js`, `DMInput.js`, `ConversationHeader.js`, `TimeDivider.js`
- Subdirectories: `comments/` (8 comment-related components), `ProfileSong/` (song selection)
- Barrel export: `index.js` re-exports all components

**src/hooks/**

- Purpose: Custom React hooks for business logic
- Contains: 13 hook files (camelCase + `use` prefix)
- Key files: `useCamera.ios.js`, `useCamera.android.js`, `useCameraBase.js`, `useFeedPhotos.js`, `useDarkroom.js`, `useComments.js`, `usePhotoDetailModal.js`, `useSwipeableCard.js`, `useMessages.js`, `useConversation.js`
- Platform variants: `useCamera.ios.js` / `useCamera.android.js` (Metro auto-resolves)

**src/context/**

- Purpose: React Context providers for global state
- Contains: 4 context files
- Key files: `AuthContext.js` (user + profile), `PhoneAuthContext.js` (auth confirmation ref), `PhotoDetailContext.js` (modal state with 2 consumer hooks), `ThemeContext.js` (unused, dark-only)
- Barrel export: `index.js`

**src/services/firebase/**

- Purpose: Firebase operation abstractions (all return `{ success, error }`)
- Contains: 22 service files (camelCase + `Service` suffix)
- Key files: `photoService.js`, `feedService.js`, `darkroomService.js`, `commentService.js`, `friendshipService.js`, `notificationService.js`, `signedUrlService.js`, `albumService.js`, `monthlyAlbumService.js`, `messageService.js`
- Barrel export: `index.js`

**src/services/ (root level)**

- Purpose: Non-Firebase services
- Contains: `uploadQueueService.js`, `iapService.js`, `iTunesService.js`, `audioPlayer.js`, `audioDownloader.js`, `secureStorageService.js`, `downloadPhotosService.js`, `searchService.js`

**src/utils/**

- Purpose: Shared utility functions
- Contains: `logger.js`, `timeUtils.js`, `phoneUtils.js`, `imageUtils.js`, `haptics.js`, `soundUtils.js`, `validation.js`, `emojiRotation.js`

**src/constants/**

- Purpose: App-wide constants and design tokens
- Contains: `colors.js`, `typography.js`, `spacing.js`, `layout.js`, `animations.js`, `pixelIcons.js`, `emojiPools.js`, `legalContent.js`
- Reference: `COLOR_REFERENCE.md`
- Barrel export: `index.js`

**src/styles/**

- Purpose: Shared style modules (separated from components)
- Contains: 25+ `*.styles.js` files matching screen/component names

**functions/**

- Purpose: Firebase Cloud Functions backend (Node 20)
- Contains: `index.js` (~2500 lines), `validation.js` (Zod schemas), `logger.js`
- Subdirectories: `notifications/` (batching, receipts, sender), `tasks/` (scheduled jobs)
- Tests: `__tests__/` with separate jest config

****tests**/**

- Purpose: Application test suite
- Contains: Unit tests, integration tests, setup files
- Subdirectories: `setup/` (jest.setup.js, testFactories.js), `hooks/`, `services/`, `integration/`, `utils/`, `__mocks__/`

## Key File Locations

**Entry Points:**

- `index.js` - Expo root (calls `registerRootComponent(App)`)
- `App.js` - Main component (fonts, OTA updates, Firebase Perf, notifications, darkroom check)
- `src/navigation/AppNavigator.js` - Navigation tree root

**Configuration:**

- `app.json` / `app.config.js` - Expo/native config (permissions, plugins, Firebase project switching)
- `eas.json` - EAS Build profiles (development, preview, production)
- `babel.config.js` - Babel (Expo preset, react-compiler, reanimated, dotenv)
- `eslint.config.js` - ESLint rules
- `.prettierrc` - Prettier formatting
- `jest.config.js` - Jest test runner
- `firebase.json` - Firebase project settings
- `firestore.rules` / `storage.rules` / `firestore.indexes.json` - Firebase security

**Core Logic:**

- `src/services/firebase/photoService.js` - Photo CRUD, reveal, triage
- `src/services/firebase/feedService.js` - Feed fetching + subscription
- `src/services/firebase/darkroomService.js` - Reveal scheduling
- `src/services/firebase/friendshipService.js` - Friend relationships
- `src/services/uploadQueueService.js` - Persistent upload queue
- `functions/index.js` - Cloud Functions (notifications, signed URLs, deletion)

**Testing:**

- `__tests__/setup/jest.setup.js` - Firebase + Expo mocks (~2500+ lines)
- `__tests__/setup/testFactories.js` - Test data factories
- `__tests__/services/*.test.js` - Service unit tests
- `__tests__/hooks/*.test.js` - Hook unit tests
- `__tests__/integration/*.test.js` - Cross-service integration tests

## Naming Conventions

**Files:**

- PascalCase + `Screen` suffix: Screens (`FeedScreen.js`, `DarkroomScreen.js`)
- PascalCase: Components (`Button.js`, `FeedPhotoCard.js`)
- camelCase + `use` prefix: Hooks (`useCamera.js`, `useDarkroom.js`)
- camelCase + `Service` suffix: Services (`photoService.js`, `feedService.js`)
- camelCase: Utilities (`logger.js`, `timeUtils.js`)
- ComponentName + `.styles.js`: Style files (`FeedScreen.styles.js`)
- SourceName + `.test.js`: Tests (`feedService.test.js`)

**Directories:**

- Lowercase: All directories (`screens/`, `components/`, `hooks/`)
- Plural: Collection directories (`screens/`, `services/`, `hooks/`)
- PascalCase: Component subdirectories (`ProfileSong/`)

**Special Patterns:**

- `index.js` - Barrel exports for `components/`, `context/`, `services/firebase/`, `constants/`
- `.ios.js` / `.android.js` - Platform-specific variants (Metro auto-resolves)
- `__tests__/` - Test directory at project root (not co-located)

## Where to Add New Code

**New Screen:**

- Screen file: `src/screens/NewScreen.js`
- Styles: `src/styles/NewScreen.styles.js`
- Navigation: Add route in `src/navigation/AppNavigator.js`
- Tests: `__tests__/screens/NewScreen.test.js` (if needed)

**New Component:**

- Component: `src/components/NewComponent.js`
- Export: Add to `src/components/index.js` barrel
- Styles: Inline or `src/styles/NewComponent.styles.js`

**New Hook:**

- Hook: `src/hooks/useNewHook.js`
- Platform variants: `useNewHook.ios.js` + `useNewHook.android.js` if needed
- Tests: `__tests__/hooks/useNewHook.test.js`

**New Firebase Service:**

- Service: `src/services/firebase/newService.js`
- Export: Add to `src/services/firebase/index.js` barrel
- Tests: `__tests__/services/newService.test.js`

**New Cloud Function:**

- Function: Add to `functions/index.js` or create module in `functions/`
- Validation: Add Zod schema in `functions/validation.js`
- Tests: `functions/__tests__/newFunction.test.js`

**New Utility:**

- Utility: `src/utils/newUtil.js`
- Tests: `__tests__/utils/newUtil.test.js`

**New Constants:**

- Constants: Add to existing file in `src/constants/` or create new one
- Export: Add to `src/constants/index.js` barrel

## Special Directories

**plugins/**

- Purpose: Custom Expo config plugins
- Contains: `withFirebaseFix.js` (iOS-only Firebase + Expo 54 Podfile fix)
- Committed: Yes

**.maestro/**

- Purpose: Maestro E2E test configurations
- Source: Manual test flow definitions
- Committed: Yes

**.planning/**

- Purpose: Project planning and codebase analysis documents
- Contains: `codebase/` (this analysis), phase plans, roadmaps
- Committed: Yes (except deprecated phases deleted in current branch)

**assets/**

- Purpose: App icons, splash screens, adaptive icons
- Contains: PNG images for iOS/Android app assets
- Committed: Yes

---

_Structure analysis: 2026-02-19_
_Update when directory structure changes_
