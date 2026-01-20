# Lapse Clone - Camera/Darkroom UX Refactor

## What This Is

A comprehensive UI/UX refactor of the Camera and Darkroom experience in the Lapse social media clone app, now with phone-only authentication. This consolidates the two separate tabs into a unified camera experience with native iOS gestures for photo triage, a press-and-hold reveal interaction, visual consistency across all camera controls, and streamlined phone-based sign-in.

## Core Value

Seamless, native-feeling photo capture and reveal experience that combines the camera and darkroom into one intuitive flow with smooth iOS gestures, haptic feedback, and frictionless phone authentication.

## Current State (v1.4 Shipped)

**Shipped:** 2026-01-20
**Execution time:** 8.5 hours total (v1.1: 4.3h + v1.2: 2.1h + v1.3: 0.7h + v1.4: 1.4h)
**Phases:** 18 phases, 37 plans across four milestones

The Production Ready milestone is complete. The app is now ready for App Store distribution:
- All Firebase operations use modular API (v22+) - zero namespaced patterns
- Instagram-style Stories feature with curated top 5 photos per friend
- Oly branding (aperture-inspired icon, animated splash with shutter effect)
- iOS build available via EAS internal distribution
- Server-side darkroom reveals via scheduled Cloud Function (every 2 min)
- All 3 notification types verified working (photo reveals, friend requests, reactions)

Previous v1.3 features remain:
- React Native Firebase SDK exclusively (no JS SDK)
- Unified auth state across all Firebase operations
- Efficient putFile pattern for photo uploads

Previous v1.2 features remain:
- Phone-only authentication with SMS verification
- ErrorBoundary protection against white-screen crashes

Previous v1.1 features remain:
- Single camera tab with darkroom button
- Press-and-hold to reveal photos with haptic milestones
- Swipe gestures for triage like iOS Mail
- Celebration page with confetti after triage

## Requirements

### Validated

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

(None - v1.4 complete, ready for next milestone or App Store submission)

### Out of Scope

- No changes to photo capture logic (compression, upload, storage) - Only UI/UX updates
- No changes to darkroom reveal timing system (batch scheduling, random intervals) - Backend logic stays the same
- No changes to Feed, Friends, or Profile tabs - Strictly Camera/Darkroom + Auth refactor
- No changes to Firestore schema or photo lifecycle states - Keep existing data structure
- Email/password authentication - Replaced with phone auth in v1.2
- Apple Sign-In - Removed in v1.2 for simpler phone-only flow

## Context

**Codebase State (v1.4):**
- React Native mobile app with Expo managed workflow (SDK ~54.0.30)
- 80 files modified in v1.4 milestone (+8,203 / -391 lines)
- All Firebase services use modular API (v22+) - zero namespaced patterns
- New components: FriendStoryCard, StoriesViewerModal
- New Cloud Function: processDarkroomReveals (scheduled every 2 min)
- iOS build available via EAS internal distribution

**Tech Stack:**
- Firebase BaaS for backend (Firestore, Storage, Functions)
- React Native Firebase for all Firebase operations (@react-native-firebase/app, auth, firestore, storage)
- React Navigation 7.x for screen navigation (bottom tabs + nested stacks)
- expo-camera for camera access, expo-image-manipulator for compression
- react-native-gesture-handler for swipe gestures
- expo-haptics for tactile feedback
- react-native-svg for icon components
- libphonenumber-js for phone validation and formatting
- expo-splash-screen for animated splash
- eas-cli for iOS builds and distribution

**User Feedback:**
- Stories feature makes browsing friends' photos more engaging
- Server-side reveals ensure photos are ready when expected
- Push notifications keep users engaged
- Oly branding feels professional and polished

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

---
*Last updated: 2026-01-20 after v1.4 milestone*
