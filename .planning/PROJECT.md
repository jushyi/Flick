# Lapse Clone - Camera/Darkroom UX Refactor

## What This Is

A comprehensive UI/UX refactor of the Camera and Darkroom experience in the Lapse social media clone app. The app features instant photo capture with background uploads, a redesigned darkroom with fluid triage animations, batched undo capability, and a polished notification system - all with phone-only authentication and native iOS gestures throughout.

## Core Value

Instant, delightful photo capture and reveal experience - photos capture without blocking, triage flows like flipping through a deck of cards, and every interaction feels responsive with haptic feedback.

## Current State (v1.5 Shipped)

**Shipped:** 2026-01-23
**Execution time:** 14.3 hours total (v1.1: 4.3h + v1.2: 2.1h + v1.3: 0.7h + v1.4: 1.4h + v1.5: 5.8h)
**Phases:** 40 phases, 74 plans across five milestones

The Camera Performance & UX Polish milestone is complete:
- Background photo upload with instant capture (camera releases immediately)
- Camera UI overhaul with card stack darkroom button, zoom controls (0.5x-3x), DSLR haptics
- Darkroom bottom sheet with dark theme, neon purple hold-to-reveal, crescendo haptics
- Flick-style triage animations with arc motion, on-card overlays, three-stage haptics
- Batched triage with undo - decisions saved locally, reverse card animation on undo
- Notification feed with reaction debouncing (10-second batching window)
- Camera launches as default screen (capture-first philosophy)

Previous v1.4 features remain:
- All Firebase operations use modular API (v22+)
- Instagram-style Stories feature with curated top 5 photos per friend
- Oly branding (aperture-inspired icon, animated splash)
- Server-side darkroom reveals via scheduled Cloud Function (every 2 min)
- All 3 notification types working (photo reveals, friend requests, reactions)

Previous v1.3 features remain:
- React Native Firebase SDK exclusively (no JS SDK)
- Unified auth state across all Firebase operations

Previous v1.2 features remain:
- Phone-only authentication with SMS verification
- ErrorBoundary protection against white-screen crashes

Previous v1.1 features remain:
- Single camera tab with darkroom button
- Press-and-hold to reveal photos with haptic milestones

## Requirements

### Validated

**v1.5 Camera Performance & UX Polish:**
- ✓ Background photo upload with instant capture (no blocking) — v1.5
- ✓ Camera UI overhaul (card stack button, zoom controls, DSLR haptics) — v1.5
- ✓ Darkroom bottom sheet redesign (dark theme, neon purple hold-to-reveal) — v1.5
- ✓ Flick-style triage animations with arc motion and overlays — v1.5
- ✓ Batched triage with undo capability — v1.5
- ✓ Notification feed with reaction debouncing — v1.5
- ✓ 0.5x ultra-wide zoom on supported iOS devices — v1.5
- ✓ Reveal timing reduced to 0-5 minutes — v1.5
- ✓ Success sound effect on triage completion — v1.5
- ✓ Delete suction animation with button pulse — v1.5
- ✓ Camera as default launch screen — v1.5
- ✓ Fluid cascade animation with early trigger — v1.5

**v1.4 Production Ready:**
- ✓ Migrate all services to Firebase modular API (v22+) — v1.4
- ✓ Instagram-style Stories feature with friend avatars — v1.4
- ✓ Curated feed showing top 5 photos per friend by engagement — v1.4
- ✓ Full-screen Stories viewer with tap/swipe navigation — v1.4
- ✓ Oly brand identity (aperture icon, animated splash) — v1.4
- ✓ EAS Build for iOS internal distribution — v1.4
- ✓ Server-side darkroom reveals via scheduled Cloud Function — v1.4
- ✓ All 3 notification types working end-to-end — v1.4

**v1.3 Firebase SDK Consolidation:**
- ✓ Migrate all Firestore services to React Native Firebase — v1.3
- ✓ Migrate storageService to React Native Firebase — v1.3
- ✓ Remove Firebase JS SDK from codebase — v1.3
- ✓ Unified auth state across all Firebase operations — v1.3

**v1.2 Phone Authentication:**
- ✓ Phone-only authentication with SMS verification — v1.2
- ✓ React Native Firebase for native phone auth — v1.2
- ✓ Phone number validation with libphonenumber-js — v1.2
- ✓ Country code picker (15 common countries) — v1.2
- ✓ Auto-submit verification when 6 digits entered — v1.2
- ✓ Real-time phone number formatting (AsYouType) — v1.2
- ✓ Remove email/password and Apple Sign-In — v1.2
- ✓ ErrorBoundary for crash resilience — v1.2
- ✓ Custom app icon and splash screen — v1.2

**v1.1 Camera/Darkroom UX:**
- ✓ Remove Darkroom tab from bottom navigation, keep Camera tab only — v1.1
- ✓ Add darkroom button on left side of capture button in CameraScreen — v1.1
- ✓ Darkroom button disabled/greyed out when no photos ready to reveal — v1.1
- ✓ Darkroom button opens bottom sheet with "press and hold to reveal" UI — v1.1
- ✓ Press-and-hold interaction with progress bar (left-to-right fill) — v1.1
- ✓ Haptic feedback during press-and-hold progress — v1.1
- ✓ Progress bar completion opens photo triage view — v1.1
- ✓ Replace Archive/Journal buttons with iOS Mail-style swipe gestures — v1.1
- ✓ Swipe left reveals Archive action, swipe right reveals Journal action — v1.1
- ✓ Native iOS swipe-to-action animations and behavior — v1.1
- ✓ Success page after triage with animated celebration (confetti/animation) — v1.1
- ✓ "Return to Camera" button on success page — v1.1
- ✓ Update camera control icons to match bottom nav icon design system — v1.1
- ✓ Visual consistency across all camera UI elements — v1.1

### Active

(None - v1.5 complete, ready for App Store submission)

### Out of Scope

- No changes to photo capture logic (compression, upload, storage) - Only UI/UX updates
- No changes to darkroom reveal timing system (batch scheduling, random intervals) - Backend logic stays the same
- No changes to Feed, Friends, or Profile tabs - Strictly Camera/Darkroom + Auth refactor
- No changes to Firestore schema or photo lifecycle states - Keep existing data structure
- Email/password authentication - Replaced with phone auth in v1.2
- Apple Sign-In - Removed in v1.2 for simpler phone-only flow

## Context

**Codebase State (v1.5):**
- React Native mobile app with Expo managed workflow (SDK ~54.0.30)
- 156 files changed in v1.5 milestone (+21,126 / -964 lines)
- Total codebase: ~14,500 lines JavaScript across 48 source files
- New components: uploadQueueService, soundUtils
- New dependencies: expo-linear-gradient, expo-av, expo-image
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

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| RN Firebase method chaining pattern | Consistent with RN Firebase SDK conventions, works with native modules | ✓ Good |
| Filter.or for OR queries | JS SDK or() unavailable in RN Firebase; Filter.or provides same functionality | ✓ Good |
| putFile over uploadBytes | RN Firebase putFile accepts local paths directly, eliminating blob conversion overhead | ✓ Good |
| Delete firestoreService.js | Unused legacy functions; all services migrated to dedicated files | ✓ Good |
| Delete firebaseConfig.js | JS SDK init no longer needed; RN Firebase auto-inits from google-services | ✓ Good |
| Remove Darkroom tab from nav | User wants unified camera experience, darkroom accessed via button | ✓ Good |
| iOS Mail-style swipe actions | Native gesture pattern users already know, feels polished | ✓ Good |
| Press-and-hold to reveal | Adds ceremony and engagement to photo reveal moment | ✓ Good |
| Animated celebration success page | Positive reinforcement after completing triage | ✓ Good |
| Darkroom button left of capture | Positions secondary action away from primary (capture) | ✓ Good |
| Disable darkroom button when not ready | Clear visual affordance, prevents confusion | ✓ Good |
| Keep existing photoService/darkroomService | No need to refactor backend logic, only UI layer changes | ✓ Good |
| Absolute positioning for CameraView overlays | CameraView doesn't support children well in some expo-camera versions | ✓ Good |
| TAB_BAR_HEIGHT = 65px | Accounts for bottom tab navigator height including safe area | ✓ Good |
| Milestone-based haptics (25/50/75/100%) | Prevents battery drain and haptic fatigue while providing tactile confirmation | ✓ Good |
| React Native Firebase for phone auth | JS SDK cannot support silent APNs verification; native SDK enables seamless phone auth | ✓ Good |
| libphonenumber-js for validation | Lightweight validation, can enhance UI later | ✓ Good |
| Manual country picker (15 countries) | Simpler implementation, covers common cases | ✓ Good |
| Auto-submit on 6 digits | Better UX - no need to press verify button | ✓ Good |
| reCAPTCHA fallback over APNs | Simpler than configuring APNs certificates; works without full push notification setup | ✓ Good |
| RN Firebase Firestore for phone auth users | JS SDK Firestore doesn't share auth state with RN Firebase Auth | ✓ Good |
| Full deletion of authService.js | All email auth removed; cleaner than keeping utility functions | ✓ Good |
| ErrorBoundary inside NavigationContainer | Catches UI errors while allowing auth state listeners to work normally | ✓ Good |
| AsYouType formatter for phone input | Better UX without blocking input, shows formatted preview as user types | ✓ Good |
| 3-second retry delay after verification errors | Prevents rapid retry spam while not frustrating legitimate users | ✓ Good |
| Minimalist L letterform for app icon | Matches Lapse brand aesthetic, professional appearance | ✓ Good |
| Sharp library for programmatic icon generation | Reproducible assets, scripts can be rerun for updates | ✓ Good |
| or(where(), where()) for OR queries | RN Firebase v22 modular API pattern for complex queries | ✓ Good |
| Parse document IDs in Firestore rules | Allow reads on non-existent docs for checkFriendshipStatus | ✓ Good |
| 2-minute schedule for processDarkroomReveals | Balance responsiveness vs cost for server-side reveals | ✓ Good |
| Bundle ID com.spoodsjs.oly | Original com.oly.app was already registered | ✓ Good |
| Feed curation top 5 per friend by reactionCount | No comments system exists; engagement = reactions | ✓ Good |
| Stories viewer with tap-to-advance | Matches Instagram Stories UX patterns | ✓ Good |
| Animated splash with shutter effect | Reinforces camera app identity | ✓ Good |
| Gesture.Pan() API for swipe gestures | useAnimatedGestureHandler deprecated in Reanimated v4 | ✓ Good |
| expo-image instead of RN Image | Native caching + 200ms transitions eliminates black flash | ✓ Good |
| onExitClearance callback for early cascade | Fluid triage without perceptible gaps | ✓ Good |
| 100ms clearance delay | Instant cascade feel while card still visible | ✓ Good |
| Exponential power curve (x^2.5) for arc | Cards start flat, accelerate downward naturally | ✓ Good |
| Red dot indicator vs count badge | Instagram-style simplicity | ✓ Good |
| Silent close after Done tap | Haptic-only feedback, no celebration screen needed | ✓ Good |
| initialRouteName="Camera" | Capture-first philosophy | ✓ Good |

---
*Last updated: 2026-01-23 after v1.5 milestone*
