# Codebase Structure

**Analysis Date:** 2026-01-23

## Directory Layout

```
lapse-clone-app/
├── Root Configuration
│   ├── App.js                     # Root component & entry point (6.8 KB)
│   ├── index.js                   # Expo registration wrapper
│   ├── app.json                   # Expo configuration
│   ├── package.json               # Dependencies & build scripts
│   ├── eas.json                   # EAS Build profiles
│   ├── firebase.json              # Firebase CLI configuration
│   ├── babel.config.js            # Babel transpilation config
│   ├── react-native.config.js     # React Native auto-linking
│   ├── CLAUDE.md                  # AI development guide (33.4 KB)
│   ├── .env                       # Environment variables (gitignored)
│   └── GoogleService-Info.plist   # iOS Firebase config
│
├── src/                           # Application source code
│   ├── components/                # Reusable UI components (15 files)
│   │   ├── AnimatedSplash.js      # Animated intro screen
│   │   ├── Button.js              # Generic button component
│   │   ├── Card.js                # Generic card wrapper
│   │   ├── DarkroomBottomSheet.js # Photo triage sheet (17.8 KB)
│   │   ├── ErrorBoundary.js       # Error boundary wrapper
│   │   ├── FeedLoadingSkeleton.js # Loading placeholder
│   │   ├── FeedPhotoCard.js       # Photo card for feed
│   │   ├── FriendRequestCard.js   # Friend request item
│   │   ├── FriendStoryCard.js     # Story card display
│   │   ├── Input.js               # Generic text input
│   │   ├── PhotoDetailModal.js    # Full-screen photo viewer (13.1 KB)
│   │   ├── ReactionDisplay.js     # Emoji reactions display
│   │   ├── StoriesViewerModal.js  # Story viewer modal (10.9 KB)
│   │   ├── SwipeablePhotoCard.js  # Swipeable photo card (30.8 KB)
│   │   ├── UserSearchCard.js      # User search result
│   │   └── index.js               # Barrel exports (16 components)
│   │
│   ├── screens/                   # Full-screen route components (13 files)
│   │   ├── CameraScreen.js        # Photo capture (30.2 KB, 937 lines)
│   │   ├── DarkroomScreen.js      # Batch photo reveal (32.9 KB, 889 lines)
│   │   ├── FeedScreen.js          # Friends' photos feed (14.3 KB)
│   │   ├── FriendRequestsScreen.js# Friend request management (9.7 KB)
│   │   ├── FriendsListScreen.js   # Friends list (13.1 KB)
│   │   ├── NotificationsScreen.js # Notifications display (7.9 KB)
│   │   ├── PhoneInputScreen.js    # Phone entry (12.3 KB)
│   │   ├── ProfileScreen.js       # User profile (6.7 KB)
│   │   ├── ProfileSetupScreen.js  # Profile creation (10.1 KB)
│   │   ├── SuccessScreen.js       # Success confirmation (6.2 KB)
│   │   ├── UserSearchScreen.js    # Search & add friends (8.7 KB)
│   │   ├── VerificationScreen.js  # OTP verification (10.4 KB)
│   │   └── index.js               # Barrel exports
│   │
│   ├── navigation/                # React Navigation config (1 file)
│   │   └── AppNavigator.js        # Main navigation tree (11.2 KB)
│   │
│   ├── context/                   # Global state management (1 file)
│   │   └── AuthContext.js         # Auth state provider (7.6 KB)
│   │
│   ├── hooks/                     # Custom React hooks (1 file)
│   │   └── useFeedPhotos.js       # Feed data management (7.7 KB)
│   │
│   ├── services/                  # Business logic & API integration
│   │   ├── firebase/              # Firebase service modules (9 files)
│   │   │   ├── darkroomService.js # Batch reveal system (7.4 KB)
│   │   │   ├── feedService.js     # Feed queries & reactions (17.3 KB)
│   │   │   ├── friendshipService.js# Friend relationships (14.4 KB)
│   │   │   ├── index.js           # Barrel exports (36 functions)
│   │   │   ├── notificationService.js# Push notifications (8.9 KB)
│   │   │   ├── phoneAuthService.js# Phone auth (9.0 KB)
│   │   │   ├── photoService.js    # Photo lifecycle (12.5 KB)
│   │   │   ├── storageService.js  # Cloud storage ops (5.4 KB)
│   │   │   └── userService.js     # User profile ops (3.1 KB)
│   │   │
│   │   └── uploadQueueService.js  # Offline upload queue (10.3 KB)
│   │
│   ├── utils/                     # Helper functions & utilities (6 files)
│   │   ├── haptics.js             # Haptic feedback wrapper (1.8 KB)
│   │   ├── logger.js              # Structured logging (6.6 KB)
│   │   ├── phoneUtils.js          # Phone number utilities (3.2 KB)
│   │   ├── soundUtils.js          # Audio playback (1.5 KB)
│   │   ├── timeUtils.js           # Date/time formatting (5.2 KB)
│   │   └── validation.js          # Input validation (10.3 KB)
│   │
│   └── constants/                 # App constants (empty directory)
│
├── functions/                     # Firebase Cloud Functions
│   ├── index.js                   # 3 notification functions (19.5 KB)
│   ├── package.json               # Function dependencies
│   ├── README.md                  # Deployment guide (3.2 KB)
│   └── node_modules/              # Dependencies
│
├── assets/                        # Static resources
│   ├── icon.png                   # App icon (50.8 KB)
│   ├── splash.png                 # Splash screen (83.6 KB)
│   ├── adaptive-icon.png          # Android adaptive icon (29.3 KB)
│   ├── splash-icon.png            # Legacy splash icon (17.5 KB)
│   ├── favicon.png                # Web favicon (1.3 KB)
│   └── theburntpeanut-hooray.mp3  # Success sound (27.2 KB)
│
├── docs/                          # Project documentation (8 files)
│   ├── MVP_ROADMAP.md             # Feature roadmap (18.4 KB)
│   ├── PROJECT_ROADMAP.md         # Project timeline (19.7 KB)
│   ├── DATABASE_SCHEMA.md         # Firestore data models (19.2 KB)
│   ├── LAPSE_FEATURES_DOCUMENTATION.md# Feature specs (22.6 KB)
│   ├── LOGGING_IMPLEMENTATION_GUIDE.md# Logging standards (24.8 KB)
│   ├── WEEK_11_COMPLETE.md        # Week 11 summary (16.2 KB)
│   ├── WIREFRAMES.md              # UI wireframes (21.1 KB)
│   └── REFACTORING_MASTER_PLAN.md # Technical debt plan (46.9 KB)
│
├── scripts/                       # Build & utility scripts (2 files)
│   ├── generate-icons.js          # Generate app icons (4.1 KB)
│   └── generate-splash.js         # Generate splash screens (1.7 KB)
│
├── plugins/                       # Expo plugins (1 file)
│   └── withFirebaseFix.js         # Custom Firebase fix plugin (1.6 KB)
│
├── patches/                       # Patch-package patches
│
├── .planning/                     # AI project planning artifacts
│   ├── codebase/                  # Codebase analysis (7 files)
│   ├── milestones/                # Version roadmaps (v1.1-v1.5)
│   ├── phases/                    # Phase plans & summaries
│   ├── config.json                # Planning config
│   ├── ISSUES.md                  # Known issues & blockers
│   └── MILESTONES.md              # Release tracking
│
├── .expo/                         # Expo local configuration (generated)
│
├── dist/                          # Build output (generated)
│
└── node_modules/                  # Dependencies (generated, gitignored)
```

## Directory Purposes

**assets/**
- Purpose: Static resources (images, icons, audio)
- Contains: App icon, splash screen, adaptive icons, success audio
- Key files: `icon.png`, `splash.png`, `adaptive-icon.png`, `theburntpeanut-hooray.mp3`
- Subdirectories: None

**docs/**
- Purpose: Project documentation for development
- Contains: 8 markdown files (210 KB total)
- Key files:
  - `MVP_ROADMAP.md` - Feature roadmap and sprint planning (Weeks 1-12)
  - `DATABASE_SCHEMA.md` - Firestore data models with examples
  - `LOGGING_IMPLEMENTATION_GUIDE.md` - Logging standards
  - `REFACTORING_MASTER_PLAN.md` - Technical debt and optimization plan
- Subdirectories: None

**functions/**
- Purpose: Firebase Cloud Functions (serverless backend)
- Contains: Node.js functions for notifications
- Key files:
  - `index.js` - 3 notification functions (photo reveals, friend requests, reactions)
  - `package.json` - Function dependencies (Firebase Admin, Expo notifications)
  - `README.md` - Deployment and testing guide
- Runtime: Node.js 20, deployed to us-central1
- Deploy: `firebase deploy --only functions`

**src/components/**
- Purpose: Reusable UI components (15 files, ~160 KB total)
- Contains: React Native functional components with hooks
- Key files:
  - `SwipeablePhotoCard.js` - Gesture-enabled photo card (785 lines)
  - `DarkroomBottomSheet.js` - Photo triage bottom sheet (530 lines)
  - `PhotoDetailModal.js` - Full-screen photo viewer with reactions
  - `FeedPhotoCard.js` - Photo display card for feed
  - `index.js` - Barrel exports (16 components)
- Pattern: PascalCase naming, functional components

**src/screens/**
- Purpose: Full-screen route components (13 files, ~150 KB total)
- Contains: One screen per navigation route
- Key files:
  - `CameraScreen.js` - Photo capture with zoom, flash control (937 lines)
  - `DarkroomScreen.js` - Batch reveal and triage (889 lines)
  - `FeedScreen.js` - Real-time feed with infinite scroll
  - `ProfileSetupScreen.js` - Username, bio, photo, notification permissions
- Pattern: PascalCase, `*Screen.js` suffix

**src/services/firebase/**
- Purpose: Firebase operations and business logic (9 files, ~130 KB total)
- Contains: Service modules for each domain
- Key files:
  - `photoService.js` - Photo upload, reveal, delete, status (12 functions)
  - `feedService.js` - Feed queries, reactions, pagination (8 functions)
  - `friendshipService.js` - Friend requests, search, relationships (11 functions)
  - `notificationService.js` - Push permissions, tokens, handlers (8 functions)
  - `index.js` - Barrel exports (36 functions total)
- Pattern: camelCase, `*Service.js` suffix, export functions

**src/utils/**
- Purpose: Helper functions and utilities (6 files, ~48 KB total)
- Contains: Pure utility functions
- Key files:
  - `logger.js` - Structured logging with data sanitization
  - `validation.js` - Email, username, password, phone validation
  - `timeUtils.js` - Date formatting (getTimeAgo, formatDate)
  - `haptics.js` - Haptic feedback wrapper
- Pattern: camelCase, `*Utils.js` suffix

**src/navigation/**
- Purpose: React Navigation configuration
- Contains: `AppNavigator.js` - Complete navigation tree (11.2 KB)
- Structure: Auth Stack → Main Tab Navigator (5 tabs) → Friends Stack (nested)
- Features: Deep linking configuration for notification routing

**src/context/**
- Purpose: React Context providers for global state
- Contains: `AuthContext.js` - Authentication and user state provider
- Provides: user, userProfile, loading, signup(), login(), logout()

**src/hooks/**
- Purpose: Custom React hooks for reusable stateful logic
- Contains: `useFeedPhotos.js` - Feed data management
- Returns: photos[], loading, hasMore, loadMorePhotos(), refreshFeed()

## Key File Locations

**Entry Points:**
- `App.js` - Root component, notifications setup, auth provider, animated splash
- `index.js` - Expo registration wrapper
- `src/navigation/AppNavigator.js` - Navigation root with deep linking

**Configuration:**
- `app.json` - Expo config (bundle ID, permissions, plugins, EAS project)
- `package.json` - 48 npm packages, build scripts
- `eas.json` - Development, preview, production build profiles
- `firebase.json` - Firestore rules, Cloud Functions source
- `.env` - Firebase keys (gitignored)
- `GoogleService-Info.plist` - iOS Firebase credentials

**Core Logic:**
- `src/services/firebase/*.js` - All business logic (9 modules, 36 functions)
- `src/context/AuthContext.js` - Global auth state
- `src/hooks/useFeedPhotos.js` - Feed state management

**Testing:**
- No test directory (testing not implemented yet)
- Future: `src/**/__tests__/` or `__tests__/`

**Documentation:**
- `CLAUDE.md` - AI development guide (33.4 KB)
- `docs/*.md` - Sprint plans, schemas, guides (210 KB total)
- `functions/README.md` - Cloud Functions documentation

## Naming Conventions

**Files:**
- PascalCase for React components: `FeedScreen.js`, `PhotoDetailModal.js`, `AuthContext.js`
- camelCase for services and utilities: `feedService.js`, `timeUtils.js`, `useFeedPhotos.js`
- SCREAMING_SNAKE_CASE for docs: `MVP_ROADMAP.md`, `DATABASE_SCHEMA.md`

**Directories:**
- lowercase for all directories: `components/`, `services/`, `utils/`
- Plural names for collections: `screens/`, `hooks/`, `functions/`

**Special Patterns:**
- `index.js` for barrel exports: `src/components/index.js`
- `*Service.js` for Firebase service modules
- `*Screen.js` for screen components
- `*Context.js` for React Context providers
- `use*.js` for custom hooks
- `*Card.js`, `*Modal.js`, `*Sheet.js` for component types

## Where to Add New Code

**New Screen:**
- File: `src/screens/NewScreen.js`
- Navigation: Add route to `src/navigation/AppNavigator.js`
- Export: Add to `src/screens/index.js` if shared
- Pattern: PascalCase, functional component, use logger

**New Component:**
- File: `src/components/NewComponent.js`
- Export: Add to `src/components/index.js` barrel
- Pattern: PascalCase, functional component, props destructuring

**New Service:**
- File: `src/services/firebase/newService.js`
- Export: Add to `src/services/firebase/index.js` barrel
- Pattern: camelCase, export async functions, try/catch with logger

**New Utility:**
- File: `src/utils/newUtil.js` (or add to existing)
- Pattern: camelCase, pure functions, named exports

**New Context:**
- File: `src/context/NewContext.js`
- Integration: Wrap in `App.js` if global
- Pattern: PascalCase, createContext + Provider + useHook pattern

**New Hook:**
- File: `src/hooks/useNewHook.js`
- Pattern: `use` prefix, return { state, functions }

**New Cloud Function:**
- File: Add to `functions/index.js`
- Deploy: `firebase deploy --only functions`
- Document: Update `functions/README.md`

## Special Directories

**functions/**
- Purpose: Firebase Cloud Functions source code
- Committed: Yes (source of truth)
- Runtime: Node.js 20, us-central1 region
- Contains: 3 notification functions (photo reveals, friend requests, reactions)
- Deploy: `firebase deploy --only functions`

**docs/**
- Purpose: Development documentation (not user-facing)
- Committed: Yes (project documentation)
- Update: Per sprint review

**assets/**
- Purpose: Static assets bundled with app
- Committed: Yes (part of app bundle)
- Contains: Icons, splash screens, audio (182 KB)

**.planning/**
- Purpose: AI project planning artifacts
- Committed: Yes (planning documentation)
- Contains: Codebase analysis, milestones, phase plans

**dist/**
- Purpose: Build output from EAS/Expo
- Gitignored: Yes (generated)

**.expo/**
- Purpose: Expo development server config
- Gitignored: Yes (generated by `expo start`)

**patches/**
- Purpose: NPM dependency patches (patch-package)
- Committed: Yes (applied on `npm install`)

## File Inventory Summary

| Category | Location | Count | Size |
|----------|----------|-------|------|
| Screens | `src/screens/*.js` | 13 | ~150 KB |
| Components | `src/components/*.js` | 15 | ~160 KB |
| Services | `src/services/firebase/*.js` | 9 | ~130 KB |
| Utilities | `src/utils/*.js` | 6 | ~48 KB |
| Context | `src/context/*.js` | 1 | 7.6 KB |
| Hooks | `src/hooks/*.js` | 1 | 7.7 KB |
| Navigation | `src/navigation/*.js` | 1 | 11.2 KB |
| **Total Source** | `src/**/*.js` | **47** | **~525 KB** |

---

*Structure analysis: 2026-01-23*
*Update when directory structure changes*
