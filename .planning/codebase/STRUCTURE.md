# Codebase Structure

**Analysis Date:** 2026-01-26

## Directory Layout

```
lapse-clone/
├── __tests__/          # Jest test files
│   ├── __mocks__/     # Firebase SDK mocks
│   ├── integration/   # Integration tests
│   ├── services/      # Service unit tests
│   └── setup/         # Jest setup and factories
├── assets/             # Static assets (images, fonts)
├── coverage/           # Jest coverage reports
├── dist/               # Build output (gitignored)
├── docs/               # Project documentation
├── functions/          # Firebase Cloud Functions
├── patches/            # patch-package patches
├── plugins/            # Expo config plugins
├── scripts/            # Build/deploy scripts
├── src/                # Application source code
│   ├── components/    # Reusable UI components
│   ├── constants/     # App constants
│   ├── context/       # React Context providers
│   ├── hooks/         # Custom React hooks
│   ├── navigation/    # Navigation configuration
│   ├── screens/       # Screen components
│   ├── services/      # Firebase services
│   ├── styles/        # Component styles
│   └── utils/         # Helper utilities
├── App.js              # Root component
├── index.js            # App entry point
└── [config files]      # Configuration files
```

## Directory Purposes

**src/screens/**

- Purpose: Full-screen UI components
- Contains: `*Screen.js` files (FeedScreen, CameraScreen, DarkroomScreen, etc.)
- Key files: `FeedScreen.js`, `CameraScreen.js`, `DarkroomScreen.js`, `ProfileScreen.js`
- Subdirectories: None (flat structure)

**src/components/**

- Purpose: Reusable UI elements
- Contains: Cards, modals, buttons, inputs
- Key files: `PhotoDetailModal.js`, `FeedPhotoCard.js`, `SwipeablePhotoCard.js`
- Subdirectories: `comments/` (CommentRow, CommentInput, CommentsBottomSheet, GifPicker)

**src/services/firebase/**

- Purpose: Firebase SDK wrapper functions
- Contains: Service modules for each Firebase feature
- Key files: `photoService.js`, `darkroomService.js`, `feedService.js`, `friendshipService.js`, `notificationService.js`
- Subdirectories: None

**src/context/**

- Purpose: Global state management via React Context
- Contains: Provider components and hooks
- Key files: `AuthContext.js`, `PhoneAuthContext.js`, `ThemeContext.js`
- Subdirectories: None

**src/hooks/**

- Purpose: Custom React hooks for reusable logic
- Contains: Stateful hooks that compose services and state
- Key files: `useFeedPhotos.js`, `useDarkroom.js`, `useCamera.js`, `useComments.js`
- Subdirectories: None

**src/constants/**

- Purpose: App-wide constants and configuration
- Contains: Colors, spacing, typography, animations, legal content
- Key files: `colors.js`, `spacing.js`, `typography.js`, `animations.js`
- Subdirectories: None

**src/styles/**

- Purpose: StyleSheet definitions for components/screens
- Contains: `*.styles.js` files matching component names
- Key files: `CameraScreen.styles.js`, `DarkroomScreen.styles.js`, `FeedPhotoCard.styles.js`
- Subdirectories: None

**src/utils/**

- Purpose: Helper functions and utilities
- Contains: Logger, time utils, validation, haptics, sound
- Key files: `logger.js`, `timeUtils.js`, `validation.js`, `haptics.js`
- Subdirectories: None

**src/navigation/**

- Purpose: React Navigation setup
- Contains: Navigator components and config
- Key files: `AppNavigator.js`
- Subdirectories: None

**functions/**

- Purpose: Firebase Cloud Functions (Node.js)
- Contains: Server-side logic, scheduled tasks
- Key files: `index.js`, `logger.js`, `validation.js`
- Subdirectories: `node_modules/` (separate from app)

****tests**/**

- Purpose: Jest test suite
- Contains: Unit and integration tests
- Key files: Service tests (`*.test.js`), integration tests
- Subdirectories: `__mocks__/`, `setup/`, `services/`, `integration/`

## Key File Locations

**Entry Points:**

- `App.js` - Root component (providers, notification setup)
- `index.js` - App registration
- `src/navigation/AppNavigator.js` - Navigation root
- `functions/index.js` - Cloud Functions entry

**Configuration:**

- `app.json` / `app.config.js` - Expo configuration
- `babel.config.js` - Babel transpilation
- `jest.config.js` - Jest test configuration
- `eslint.config.js` - ESLint rules
- `firebase.json` - Firebase project config
- `firestore.rules` - Firestore security rules
- `eas.json` - EAS Build configuration

**Core Logic:**

- `src/services/firebase/` - All Firebase operations
- `src/context/AuthContext.js` - Authentication state
- `src/hooks/useFeedPhotos.js` - Feed data management
- `src/hooks/useDarkroom.js` - Darkroom state

**Testing:**

- `__tests__/services/` - Service unit tests
- `__tests__/integration/` - Integration tests
- `__tests__/setup/jest.setup.js` - Jest configuration
- `__tests__/__mocks__/` - Firebase mocks

**Documentation:**

- `README.md` - Project overview
- `CLAUDE.md` - Development instructions
- `CONTRIBUTING.md` - Contribution guidelines
- `docs/` - Feature documentation

## Naming Conventions

**Files:**

- PascalCase for screens: `FeedScreen.js`, `CameraScreen.js`
- PascalCase for components: `PhotoDetailModal.js`, `FeedPhotoCard.js`
- camelCase for services: `photoService.js`, `darkroomService.js`
- camelCase for hooks: `useFeedPhotos.js`, `useDarkroom.js`
- camelCase for utils: `logger.js`, `timeUtils.js`
- `.styles.js` suffix for style files: `CameraScreen.styles.js`
- `.test.js` suffix for tests: `photoService.test.js`

**Directories:**

- lowercase for all directories
- Plural for collections: `components/`, `screens/`, `services/`

**Special Patterns:**

- `index.js` for barrel exports in directories
- `__mocks__/` for Jest mocks (matching module paths)

## Where to Add New Code

**New Screen:**

- Implementation: `src/screens/NewScreen.js`
- Styles: `src/styles/NewScreen.styles.js`
- Navigation: Add to `src/navigation/AppNavigator.js`
- Export: Add to `src/screens/index.js`

**New Component:**

- Implementation: `src/components/NewComponent.js`
- Styles: `src/styles/NewComponent.styles.js` (if complex)
- Export: Add to `src/components/index.js`

**New Firebase Service:**

- Implementation: `src/services/firebase/newService.js`
- Export: Add to `src/services/firebase/index.js`
- Tests: `__tests__/services/newService.test.js`

**New Hook:**

- Implementation: `src/hooks/useNewHook.js`
- No barrel file (import directly)

**New Cloud Function:**

- Implementation: Add to `functions/index.js`
- Export: `exports.newFunction = ...`

**Utilities:**

- Shared helpers: `src/utils/newUtil.js`
- Constants: `src/constants/newConstants.js`

## Special Directories

**node_modules/**

- Purpose: npm dependencies
- Source: `npm install`
- Committed: No (gitignored)

**functions/node_modules/**

- Purpose: Cloud Functions dependencies (separate)
- Source: `cd functions && npm install`
- Committed: No (gitignored)

**coverage/**

- Purpose: Jest coverage reports
- Source: `npm run test:coverage`
- Committed: No (gitignored)

**dist/**

- Purpose: Build output
- Source: Build process
- Committed: No (gitignored)

**.expo/**

- Purpose: Expo cache
- Source: Expo CLI
- Committed: No (gitignored)

---

_Structure analysis: 2026-01-26_
_Update when directory structure changes_
