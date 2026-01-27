# Lapse Clone - Camera/Darkroom UX Refactor

## What This Is

A comprehensive UI/UX refactor of the Camera and Darkroom experience in the Lapse social media clone app. The app features instant photo capture with background uploads, a redesigned darkroom with fluid triage animations, batched undo capability, and a polished notification system - all with phone-only authentication and native iOS gestures throughout.

## Core Value

Instant, delightful photo capture and reveal experience - photos capture without blocking, triage flows like flipping through a deck of cards, and every interaction feels responsive with haptic feedback.

## Current State (v0.7.1 Shipped)

**Shipped:** 2026-01-26
**Execution time:** 23.3 hours total (v0.1: 4.3h + v0.2: 2.1h + v0.3: 0.7h + v0.4: 1.4h + v0.5: 5.8h + v0.6: 4.6h + v0.7.1: 4.4h)
**Phases:** 74 phases, 134 plans across seven milestones

The Rewind Rebrand & Feed Overhaul milestone is complete:

- Complete rebrand to Rewind with cassette tape icon and purple/pink gradient palette
- Instagram-style 3-tab navigation (Feed, Camera center, Profile)
- Activity feed with notifications and friend requests (mark-as-read functionality)
- Edge-to-edge feed cards replacing Polaroid design
- Stories redesign with gradient glow, 3D cube transitions, per-user Firestore viewed state
- Full comments system with threading, likes, image/GIF support, and push notifications
- Comment sheet fullscreen expand with bidirectional gesture
- Darkroom visual feedback with gradient state indicators
- Feed loading skeleton updated for current design

Previous v0.6 features remain:

- ESLint 9 + Prettier + Husky pre-commit hooks for code quality
- Security hardening (API key remediation, Firestore rules audit, Zod validation)
- SecureStore for iOS Keychain encrypted storage
- Privacy features (Settings, legal screens, account deletion)
- Jest test suite (25 unit tests + 6 integration tests)
- Component refactoring (4 major components extracted into hooks)
- Project documentation (README, CONTRIBUTING, ANIMATIONS, JSDoc)

Previous v0.5 features remain:

- Background photo upload with instant capture (camera releases immediately)
- Camera UI overhaul with card stack darkroom button, zoom controls (0.5x-3x), DSLR haptics
- Darkroom bottom sheet with dark theme, neon purple hold-to-reveal, crescendo haptics
- Flick-style triage animations with arc motion, on-card overlays, three-stage haptics
- Batched triage with undo - decisions saved locally, reverse card animation on undo
- Notification feed with reaction debouncing (10-second batching window)
- Camera launches as default screen (capture-first philosophy)

Previous v0.4 features remain:

- All Firebase operations use modular API (v22+)
- Instagram-style Stories feature with curated top 5 photos per friend
- Oly branding (aperture-inspired icon, animated splash)
- Server-side darkroom reveals via scheduled Cloud Function (every 2 min)
- All 3 notification types working (photo reveals, friend requests, reactions)

Previous v0.3 features remain:

- React Native Firebase SDK exclusively (no JS SDK)
- Unified auth state across all Firebase operations

Previous v0.2 features remain:

- Phone-only authentication with SMS verification
- ErrorBoundary protection against white-screen crashes

Previous v0.1 features remain:

- Single camera tab with darkroom button
- Press-and-hold to reveal photos with haptic milestones

## Requirements

### Validated

**v0.7.1 Rewind Rebrand & Feed Overhaul:**

- ✓ Rewind brand identity with cassette tape icon and purple/pink gradient — v0.7.1
- ✓ Animated splash with blur-to-focus effect — v0.7.1
- ✓ ThemeContext infrastructure for future personalization — v0.7.1
- ✓ 3-tab navigation (Feed, Camera, Profile) Instagram-style — v0.7.1
- ✓ Activity screen with notifications and friend requests tabs — v0.7.1
- ✓ Mark-as-read functionality for notifications — v0.7.1
- ✓ Edge-to-edge feed cards with black background — v0.7.1
- ✓ Stories row with gradient glow thumbnails — v0.7.1
- ✓ Per-user Firestore viewed state for stories — v0.7.1
- ✓ 3D cube transitions between friend stories — v0.7.1
- ✓ Unified PhotoDetailModal for stories and feed — v0.7.1
- ✓ Header scroll-hide behavior — v0.7.1
- ✓ Full comments system (CRUD, threading, likes) — v0.7.1
- ✓ Comment image attachments with Firebase Storage — v0.7.1
- ✓ Giphy SDK integration for GIF comments — v0.7.1
- ✓ Comment notifications via Cloud Function — v0.7.1
- ✓ Comment sheet fullscreen expand gesture — v0.7.1
- ✓ Darkroom gradient state indicators — v0.7.1
- ✓ expo-image for story thumbnails (no gray flash) — v0.7.1
- ✓ Feed loading skeleton updated for current design — v0.7.1

**v0.6 Code Quality, Security & Documentation:**

- ✓ ESLint 9 flat config with Expo rules — v0.6
- ✓ Prettier code formatting with pre-commit hooks — v0.6
- ✓ Husky + lint-staged for automated linting — v0.6
- ✓ API key exposure remediation (git history rewrite) — v0.6
- ✓ EAS secure Google Services file configuration — v0.6
- ✓ Firestore security rules hardening (self-reaction prevention, immutable fields) — v0.6
- ✓ Cloud Functions Zod validation and input guards — v0.6
- ✓ SecureStore for iOS Keychain encrypted storage — v0.6
- ✓ Comprehensive secure logout (6-step cleanup) — v0.6
- ✓ Signed photo URLs with 24-hour expiration — v0.6
- ✓ Settings screen with logout and legal links — v0.6
- ✓ Privacy policy and terms of service screens — v0.6
- ✓ Account deletion with re-authentication flow — v0.6
- ✓ Jest test infrastructure with Firebase mocking — v0.6
- ✓ Unit tests for core services (25 tests) — v0.6
- ✓ Integration tests for photo lifecycle and friendships — v0.6
- ✓ Component refactoring into custom hooks — v0.6
- ✓ README.md and CONTRIBUTING.md documentation — v0.6
- ✓ ANIMATIONS.md system documentation — v0.6
- ✓ JSDoc documentation on all services — v0.6

**v0.5 Camera Performance & UX Polish:**

- ✓ Background photo upload with instant capture (no blocking) — v0.5
- ✓ Camera UI overhaul (card stack button, zoom controls, DSLR haptics) — v0.5
- ✓ Darkroom bottom sheet redesign (dark theme, neon purple hold-to-reveal) — v0.5
- ✓ Flick-style triage animations with arc motion and overlays — v0.5
- ✓ Batched triage with undo capability — v0.5
- ✓ Notification feed with reaction debouncing — v0.5
- ✓ 0.5x ultra-wide zoom on supported iOS devices — v0.5
- ✓ Reveal timing reduced to 0-5 minutes — v0.5
- ✓ Success sound effect on triage completion — v0.5
- ✓ Delete suction animation with button pulse — v0.5
- ✓ Camera as default launch screen — v0.5
- ✓ Fluid cascade animation with early trigger — v0.5

**v0.4 Production Ready:**

- ✓ Migrate all services to Firebase modular API (v22+) — v0.4
- ✓ Instagram-style Stories feature with friend avatars — v0.4
- ✓ Curated feed showing top 5 photos per friend by engagement — v0.4
- ✓ Full-screen Stories viewer with tap/swipe navigation — v0.4
- ✓ Oly brand identity (aperture icon, animated splash) — v0.4
- ✓ EAS Build for iOS internal distribution — v0.4
- ✓ Server-side darkroom reveals via scheduled Cloud Function — v0.4
- ✓ All 3 notification types working end-to-end — v0.4

**v0.3 Firebase SDK Consolidation:**

- ✓ Migrate all Firestore services to React Native Firebase — v0.3
- ✓ Migrate storageService to React Native Firebase — v0.3
- ✓ Remove Firebase JS SDK from codebase — v0.3
- ✓ Unified auth state across all Firebase operations — v0.3

**v0.2 Phone Authentication:**

- ✓ Phone-only authentication with SMS verification — v0.2
- ✓ React Native Firebase for native phone auth — v0.2
- ✓ Phone number validation with libphonenumber-js — v0.2
- ✓ Country code picker (15 common countries) — v0.2
- ✓ Auto-submit verification when 6 digits entered — v0.2
- ✓ Real-time phone number formatting (AsYouType) — v0.2
- ✓ Remove email/password and Apple Sign-In — v0.2
- ✓ ErrorBoundary for crash resilience — v0.2
- ✓ Custom app icon and splash screen — v0.2

**v0.1 Camera/Darkroom UX:**

- ✓ Remove Darkroom tab from bottom navigation, keep Camera tab only — v0.1
- ✓ Add darkroom button on left side of capture button in CameraScreen — v0.1
- ✓ Darkroom button disabled/greyed out when no photos ready to reveal — v0.1
- ✓ Darkroom button opens bottom sheet with "press and hold to reveal" UI — v0.1
- ✓ Press-and-hold interaction with progress bar (left-to-right fill) — v0.1
- ✓ Haptic feedback during press-and-hold progress — v0.1
- ✓ Progress bar completion opens photo triage view — v0.1
- ✓ Replace Archive/Journal buttons with iOS Mail-style swipe gestures — v0.1
- ✓ Swipe left reveals Archive action, swipe right reveals Journal action — v0.1
- ✓ Native iOS swipe-to-action animations and behavior — v0.1
- ✓ Success page after triage with animated celebration (confetti/animation) — v0.1
- ✓ "Return to Camera" button on success page — v0.1
- ✓ Update camera control icons to match bottom nav icon design system — v0.1
- ✓ Visual consistency across all camera UI elements — v0.1

### Active

(None - v0.7.1 complete, ready for profile redesign or TestFlight submission)

### Out of Scope

- No changes to photo capture logic (compression, upload, storage) - Only UI/UX updates
- No changes to darkroom reveal timing system (batch scheduling, random intervals) - Backend logic stays the same
- Full profile redesign - Deferred to later milestone (current is minimal placeholder)
- No changes to Firestore schema or photo lifecycle states - Keep existing data structure
- Email/password authentication - Replaced with phone auth in v0.2
- Apple Sign-In - Removed in v0.2 for simpler phone-only flow

## Context

**Codebase State (v0.7.1):**

- React Native mobile app with Expo managed workflow (SDK ~54.0.30)
- 175 files changed in v0.7.1 milestone (+23,006 / -1,002 lines)
- Total codebase: ~68,000 lines JavaScript across 90+ source files
- New features: Comments system, Activity feed, Stories redesign, Rewind rebrand
- New tech: Giphy SDK (disabled for Expo Go), viewedStoriesService, commentService
- iOS build available via EAS internal distribution

**Tech Stack:**

- Firebase BaaS for backend (Firestore, Storage, Functions)
- React Native Firebase for all Firebase operations (@react-native-firebase/app, auth, firestore, storage)
- React Navigation 7.x for screen navigation (bottom tabs + nested stacks)
- expo-camera for camera access, expo-image-manipulator for compression
- react-native-gesture-handler + react-native-reanimated for gestures and animations
- expo-haptics for tactile feedback
- expo-image for optimized image loading with native caching
- expo-av for audio playback (success sounds)
- expo-linear-gradient for gradient UI elements
- libphonenumber-js for phone validation and formatting
- expo-splash-screen for animated splash
- eas-cli for iOS builds and distribution

**User Feedback:**

- Instant capture feels responsive and professional
- Triage animations are fluid and satisfying
- Undo feature provides confidence during triage
- Notification feed keeps users engaged with reactions

## Constraints

- **Platform**: Standalone iOS build via EAS - Full notification support enabled
- **Backend**: Keep existing Firebase structure - No schema changes to Firestore collections
- **Photo Lifecycle**: Preserve existing states - developing/revealed/triaged status logic unchanged
- **Real-time Sync**: Maintain Firestore listeners - Badge counts and photo updates must remain real-time
- **Navigation**: React Navigation 7.x - Use existing navigation framework and patterns
- **Testing**: Physical iOS device with standalone build for full feature testing

## Key Decisions

| Decision                                        | Rationale                                                                              | Outcome |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- | ------- |
| RN Firebase method chaining pattern             | Consistent with RN Firebase SDK conventions, works with native modules                 | ✓ Good  |
| Filter.or for OR queries                        | JS SDK or() unavailable in RN Firebase; Filter.or provides same functionality          | ✓ Good  |
| putFile over uploadBytes                        | RN Firebase putFile accepts local paths directly, eliminating blob conversion overhead | ✓ Good  |
| Delete firestoreService.js                      | Unused legacy functions; all services migrated to dedicated files                      | ✓ Good  |
| Delete firebaseConfig.js                        | JS SDK init no longer needed; RN Firebase auto-inits from google-services              | ✓ Good  |
| Remove Darkroom tab from nav                    | User wants unified camera experience, darkroom accessed via button                     | ✓ Good  |
| iOS Mail-style swipe actions                    | Native gesture pattern users already know, feels polished                              | ✓ Good  |
| Press-and-hold to reveal                        | Adds ceremony and engagement to photo reveal moment                                    | ✓ Good  |
| Animated celebration success page               | Positive reinforcement after completing triage                                         | ✓ Good  |
| Darkroom button left of capture                 | Positions secondary action away from primary (capture)                                 | ✓ Good  |
| Disable darkroom button when not ready          | Clear visual affordance, prevents confusion                                            | ✓ Good  |
| Keep existing photoService/darkroomService      | No need to refactor backend logic, only UI layer changes                               | ✓ Good  |
| Absolute positioning for CameraView overlays    | CameraView doesn't support children well in some expo-camera versions                  | ✓ Good  |
| TAB_BAR_HEIGHT = 65px                           | Accounts for bottom tab navigator height including safe area                           | ✓ Good  |
| Milestone-based haptics (25/50/75/100%)         | Prevents battery drain and haptic fatigue while providing tactile confirmation         | ✓ Good  |
| React Native Firebase for phone auth            | JS SDK cannot support silent APNs verification; native SDK enables seamless phone auth | ✓ Good  |
| libphonenumber-js for validation                | Lightweight validation, can enhance UI later                                           | ✓ Good  |
| Manual country picker (15 countries)            | Simpler implementation, covers common cases                                            | ✓ Good  |
| Auto-submit on 6 digits                         | Better UX - no need to press verify button                                             | ✓ Good  |
| reCAPTCHA fallback over APNs                    | Simpler than configuring APNs certificates; works without full push notification setup | ✓ Good  |
| RN Firebase Firestore for phone auth users      | JS SDK Firestore doesn't share auth state with RN Firebase Auth                        | ✓ Good  |
| Full deletion of authService.js                 | All email auth removed; cleaner than keeping utility functions                         | ✓ Good  |
| ErrorBoundary inside NavigationContainer        | Catches UI errors while allowing auth state listeners to work normally                 | ✓ Good  |
| AsYouType formatter for phone input             | Better UX without blocking input, shows formatted preview as user types                | ✓ Good  |
| 3-second retry delay after verification errors  | Prevents rapid retry spam while not frustrating legitimate users                       | ✓ Good  |
| Minimalist L letterform for app icon            | Matches Lapse brand aesthetic, professional appearance                                 | ✓ Good  |
| Sharp library for programmatic icon generation  | Reproducible assets, scripts can be rerun for updates                                  | ✓ Good  |
| or(where(), where()) for OR queries             | RN Firebase v22 modular API pattern for complex queries                                | ✓ Good  |
| Parse document IDs in Firestore rules           | Allow reads on non-existent docs for checkFriendshipStatus                             | ✓ Good  |
| 2-minute schedule for processDarkroomReveals    | Balance responsiveness vs cost for server-side reveals                                 | ✓ Good  |
| Bundle ID com.spoodsjs.oly                      | Original com.oly.app was already registered                                            | ✓ Good  |
| Feed curation top 5 per friend by reactionCount | No comments system exists; engagement = reactions                                      | ✓ Good  |
| Stories viewer with tap-to-advance              | Matches Instagram Stories UX patterns                                                  | ✓ Good  |
| Animated splash with shutter effect             | Reinforces camera app identity                                                         | ✓ Good  |
| Gesture.Pan() API for swipe gestures            | useAnimatedGestureHandler deprecated in Reanimated v4                                  | ✓ Good  |
| expo-image instead of RN Image                  | Native caching + 200ms transitions eliminates black flash                              | ✓ Good  |
| onExitClearance callback for early cascade      | Fluid triage without perceptible gaps                                                  | ✓ Good  |
| 100ms clearance delay                           | Instant cascade feel while card still visible                                          | ✓ Good  |
| Exponential power curve (x^2.5) for arc         | Cards start flat, accelerate downward naturally                                        | ✓ Good  |
| Red dot indicator vs count badge                | Instagram-style simplicity                                                             | ✓ Good  |
| Silent close after Done tap                     | Haptic-only feedback, no celebration screen needed                                     | ✓ Good  |
| initialRouteName="Camera"                       | Capture-first philosophy                                                               | ✓ Good  |
| ESLint 9 flat config                            | Modern config format, better Expo integration                                          | ✓ Good  |
| git-filter-repo for history rewrite             | GitHub recommended, Python-based (no Java for BFG)                                     | ✓ Good  |
| EAS file environment variables                  | Secure plist handling without version control                                          | ✓ Good  |
| useRef for ConfirmationResult                   | Avoids iOS serialization crash in navigation params                                    | ✓ Good  |
| PhoneAuthContext for cross-screen sharing       | Cleaner than navigation params, no serialization                                       | ✓ Good  |
| grep pattern for secret detection               | No external dependencies, runs in husky pre-commit                                     | ✓ Good  |
| affectedKeys().hasOnly() for Firestore          | Restricts modifiable fields at security rule level                                     | ✓ Good  |
| Zod validation in Cloud Functions               | Type-safe input validation with guard clauses                                          | ✓ Good  |
| AFTER_FIRST_UNLOCK for SecureStore              | Non-deprecated keychainAccessible constant                                             | ✓ Good  |
| v4 signing for Cloud Storage URLs               | Current standard, max 7 days expiration                                                | ✓ Good  |
| Delete auth user LAST                           | Maintains permissions during cascade deletion                                          | ✓ Good  |
| jest-expo preset                                | Handles Expo-specific transforms and mocks                                             | ✓ Good  |
| Three-way component separation                  | hook + styles + thin component pattern                                                 | ✓ Good  |
| Conditional imageURL immutability               | Allow empty→non-empty, block non-empty→any                                             | ✓ Good  |

---

_Last updated: 2026-01-26 after v0.7.1 milestone_
