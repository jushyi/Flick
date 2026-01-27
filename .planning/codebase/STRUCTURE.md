# Codebase Structure

**Analysis Date:** 2026-01-26

## Directory Layout

```
lapse-clone/
├── .planning/              # GSD planning documents
│   └── codebase/          # Codebase analysis documents
├── __tests__/             # Jest test files
│   ├── setup/             # Test configuration
│   ├── services/          # Service unit tests
│   └── integration/       # Integration tests
├── assets/                # Static assets (images, fonts)
├── coverage/              # Jest coverage reports (gitignored)
├── docs/                  # Project documentation
├── functions/             # Firebase Cloud Functions
├── node_modules/          # npm dependencies (gitignored)
├── patches/               # patch-package patches
├── plugins/               # Expo config plugins
├── scripts/               # Build/dev scripts
├── src/                   # Application source code
│   ├── components/        # Reusable UI components
│   │   └── comments/      # Comment-related components
│   ├── constants/         # App constants
│   ├── context/           # React Context providers
│   ├── hooks/             # Custom React hooks
│   ├── navigation/        # React Navigation config
│   ├── screens/           # Screen components
│   ├── services/          # Service modules
│   │   └── firebase/      # Firebase service wrappers
│   ├── styles/            # Shared StyleSheet modules
│   └── utils/             # Utility functions
├── App.js                 # Root component
├── index.js               # Entry point (registerRootComponent)
├── app.json               # Expo static config
├── app.config.js          # Expo dynamic config
├── babel.config.js        # Babel configuration
├── eslint.config.js       # ESLint flat config
├── jest.config.js         # Jest configuration
├── package.json           # Project manifest
├── firebase.json          # Firebase CLI config
├── firestore.rules        # Firestore security rules
├── firestore.indexes.json # Firestore indexes
├── storage.rules          # Storage security rules
└── eas.json               # EAS Build config
```

## Directory Purposes

**src/components/**

- Purpose: Reusable UI components shared across screens
- Contains: Button, Card, Input, FeedPhotoCard, PhotoDetailModal, etc.
- Key files:
  - `index.js` - Barrel export for all components
  - `FeedPhotoCard.js` - Photo card for feed display
  - `PhotoDetailModal.js` - Full-screen photo viewer with reactions
  - `SwipeablePhotoCard.js` - Darkroom triage card with gestures
  - `ErrorBoundary.js` - React error boundary
  - `AnimatedSplash.js` - App launch animation
- Subdirectories: `comments/` for comment-related components

**src/components/comments/**

- Purpose: Comment system components
- Contains: CommentRow, CommentInput, CommentsBottomSheet, GifPicker
- Key files:
  - `index.js` - Barrel export
  - `CommentsBottomSheet.js` - Slide-up comment panel
  - `GifPicker.js` - Giphy SDK integration
  - `CommentInput.js` - Text/GIF input component

**src/screens/**

- Purpose: Top-level route components (one per screen)
- Contains: FeedScreen, CameraScreen, DarkroomScreen, ProfileScreen, etc.
- Key files:
  - `index.js` - Barrel export
  - `FeedScreen.js` - Main photo feed
  - `CameraScreen.js` - Photo capture with darkroom integration
  - `DarkroomScreen.js` - Photo reveal and triage
  - `ProfileScreen.js` - User profile
  - `FriendsListScreen.js` - Friends management
  - `SettingsScreen.js` - App settings

**src/services/firebase/**

- Purpose: Firebase SDK wrappers with consistent return types
- Contains: photoService, feedService, friendshipService, notificationService, etc.
- Key files:
  - `index.js` - Barrel export
  - `photoService.js` - Photo CRUD, reveal operations
  - `feedService.js` - Feed queries, reactions
  - `friendshipService.js` - Friend requests, relationships
  - `darkroomService.js` - Darkroom state management
  - `notificationService.js` - Push notification handling
  - `userService.js` - User profile operations
  - `commentService.js` - Comment CRUD
  - `storageService.js` - File upload/download

**src/hooks/**

- Purpose: Custom React hooks for stateful logic
- Contains: useCamera, useDarkroom, useFeedPhotos, useComments, etc.
- Key files:
  - `useCamera.js` - Camera state and capture logic
  - `useDarkroom.js` - Darkroom state and reveal status
  - `useFeedPhotos.js` - Feed data fetching with pagination
  - `useComments.js` - Comment data and operations
  - `usePhotoDetailModal.js` - Modal state management

**src/context/**

- Purpose: React Context providers for global state
- Contains: AuthContext, PhoneAuthContext, ThemeContext
- Key files:
  - `index.js` - Barrel export
  - `AuthContext.js` - Auth state, user profile, sign in/out
  - `PhoneAuthContext.js` - Phone verification flow state
  - `ThemeContext.js` - Theme/styling context

**src/navigation/**

- Purpose: React Navigation configuration
- Contains: AppNavigator with all routes
- Key files:
  - `AppNavigator.js` - Stack/Tab navigator setup, deep linking config

**src/constants/**

- Purpose: App-wide constants
- Contains: colors, typography, spacing, animations, layout
- Key files:
  - `index.js` - Barrel export
  - `colors.js` - Color palette
  - `typography.js` - Font sizes, weights
  - `spacing.js` - Margin/padding values
  - `animations.js` - Animation durations, easings

**src/styles/**

- Purpose: Shared StyleSheet modules (co-located styles for complex components)
- Contains: Component-specific stylesheets
- Key files:
  - `index.js` - Barrel export
  - `CameraScreen.styles.js` - Camera screen styles
  - `FeedPhotoCard.styles.js` - Feed card styles
  - `PhotoDetailModal.styles.js` - Modal styles

**src/utils/**

- Purpose: Pure utility functions
- Contains: logger, timeUtils, validation, haptics, etc.
- Key files:
  - `logger.js` - Environment-aware logging utility
  - `timeUtils.js` - Date formatting (getTimeAgo, formatDate)
  - `validation.js` - Input validation helpers
  - `haptics.js` - Haptic feedback wrapper
  - `phoneUtils.js` - Phone number formatting
  - `soundUtils.js` - Audio playback utilities

**functions/**

- Purpose: Firebase Cloud Functions (server-side)
- Contains: Firestore triggers, scheduled functions, callable functions
- Key files:
  - `index.js` - All exported functions
  - `logger.js` - Server-side logging
  - `validation.js` - Zod schemas for request validation
  - `package.json` - Functions dependencies

****tests**/**

- Purpose: Jest test files
- Contains: Service tests, integration tests
- Key files:
  - `setup/jest.setup.js` - Test setup and mocks
  - `services/*.test.js` - Unit tests for services
  - `integration/*.test.js` - Integration test flows

## Key File Locations

**Entry Points:**

- `index.js` - Expo entry point
- `App.js` - Root component with providers
- `src/navigation/AppNavigator.js` - Navigation root
- `functions/index.js` - Cloud Functions entry

**Configuration:**

- `package.json` - Dependencies, scripts
- `app.json` / `app.config.js` - Expo config
- `babel.config.js` - Babel preset
- `eslint.config.js` - Linting rules
- `jest.config.js` - Test configuration
- `.prettierrc` - Code formatting
- `firebase.json` - Firebase CLI
- `eas.json` - EAS Build profiles

**Core Logic:**

- `src/services/firebase/*.js` - Firebase operations
- `src/hooks/*.js` - Stateful business logic
- `src/context/AuthContext.js` - Auth state management

**Security:**

- `firestore.rules` - Database access rules
- `storage.rules` - File storage access rules

**Documentation:**

- `CLAUDE.md` - AI assistant instructions
- `README.md` - Project overview
- `CONTRIBUTING.md` - Contribution guidelines
- `docs/*.md` - Feature documentation, weekly summaries

## Naming Conventions

**Files:**

- PascalCase: React components (`FeedPhotoCard.js`, `AuthContext.js`)
- camelCase: Services, hooks, utils (`feedService.js`, `useCamera.js`)
- kebab-case: Style files (`FeedPhotoCard.styles.js`)
- lowercase: Config files (`babel.config.js`, `eslint.config.js`)

**Directories:**

- lowercase: All directories (`components`, `services`, `hooks`)
- Plural for collections (`screens`, `hooks`, `services`)

**Special Patterns:**

- `index.js` - Barrel exports in each directory
- `*.test.js` - Test files in `__tests__/`
- `*.styles.js` - Co-located style modules

## Where to Add New Code

**New Feature:**

- Screen: `src/screens/{FeatureName}Screen.js`
- Service: `src/services/firebase/{featureName}Service.js`
- Hook: `src/hooks/use{FeatureName}.js`
- Tests: `__tests__/services/{featureName}Service.test.js`
- Styles (if complex): `src/styles/{FeatureName}Screen.styles.js`

**New Component:**

- Implementation: `src/components/{ComponentName}.js`
- Export: Add to `src/components/index.js`
- Styles (if complex): `src/styles/{ComponentName}.styles.js`
- Tests: `__tests__/components/{ComponentName}.test.js` (if needed)

**New Screen:**

- Implementation: `src/screens/{Name}Screen.js`
- Export: Add to `src/screens/index.js`
- Navigation: Register in `src/navigation/AppNavigator.js`
- Styles (if complex): `src/styles/{Name}Screen.styles.js`

**New Service:**

- Implementation: `src/services/firebase/{name}Service.js`
- Export: Add to `src/services/firebase/index.js`
- Tests: `__tests__/services/{name}Service.test.js`

**New Hook:**

- Implementation: `src/hooks/use{Name}.js`
- Tests: `__tests__/hooks/use{Name}.test.js` (if needed)

**New Cloud Function:**

- Implementation: Add to `functions/index.js`
- Document in `functions/README.md`

**Utilities:**

- Shared helpers: `src/utils/{name}.js`
- Constants: `src/constants/{category}.js`

## Special Directories

**coverage/**

- Purpose: Jest coverage reports
- Source: Auto-generated by `npm run test:coverage`
- Committed: No (gitignored)

**node_modules/**

- Purpose: npm dependencies
- Source: `npm install`
- Committed: No (gitignored)

**.expo/**

- Purpose: Expo cache and local config
- Source: Expo CLI
- Committed: No (gitignored)

**dist/**

- Purpose: Build output (if any)
- Source: Build process
- Committed: No (gitignored)

---

_Structure analysis: 2026-01-26_
_Update when directory structure changes_
