# Project Milestones: Lapse Clone

## v1.4 Production Ready (Shipped: 2026-01-20)

**Delivered:** Production-ready iOS build with Firebase Modular API migration, Instagram-style Stories feature, Oly branding, server-side darkroom reveals, and verified push notifications.

**Phases completed:** 11-14 (17 plans total, including 4 inserted fix phases: 12.1, 12.2, 13.1, 13.2)

**Key accomplishments:**

- Migrated all services/screens from Firebase namespaced API to modular API (v22+)
- Added Feed Stories feature with Instagram-style viewer and curated top 5 per friend
- Created Oly brand assets (aperture-inspired icon, animated splash screen with shutter effect)
- Built and deployed iOS app via EAS Build for internal distribution
- Implemented server-side darkroom reveal via scheduled Cloud Function (every 2 min)
- Verified all 3 notification types end-to-end (photo reveals, friend requests, reactions)

**Stats:**

- 80 files created/modified
- 8,203 lines added, 391 removed (net +7,812)
- 8 phases (4 planned + 4 inserted), 17 plans
- 1.4 hours execution time (1 day elapsed)

**Git range:** `4db6def` (feat 11-01) → `d19586c` (feat 14-01)

**What's next:** App Store submission, reaction notification debouncing, additional polish

---

## v1.3 Firebase SDK Consolidation (Shipped: 2026-01-19)

**Delivered:** Consolidated all Firebase operations to React Native Firebase SDK, eliminating JS SDK and unifying auth state across Firestore and Storage.

**Phases completed:** 9-10 (4 plans total)

**Key accomplishments:**

- Migrated all 6 Firestore services (32 functions) to React Native Firebase SDK
- Migrated storageService.js to RN Firebase with efficient putFile pattern
- Eliminated Firebase JS SDK entirely (deleted firebaseConfig.js, firestoreService.js)
- Unified auth state across Auth, Firestore, and Storage operations
- Established Filter.or pattern for complex OR queries in friendship service

**Stats:**

- 25 files modified, 2 deleted
- 1,853 lines added, 776 removed (net +1,077)
- 2 phases, 4 plans
- 42 min execution time (13 days elapsed)

**Git range:** `eaf67dd` (docs 09) → `83077cf` (docs 10-02)

**What's next:** Production release preparation - TestFlight distribution, remote notification testing, final bug fixes

---

## v1.2 Phone Authentication (Shipped: 2026-01-19)

**Delivered:** Migrated authentication from email/Apple Sign-In to phone-only with SMS verification, removing legacy auth code and adding polish.

**Phases completed:** 6-8 (8 plans total, including 1 FIX plan)

**Key accomplishments:**

- Migrated to phone-only authentication using React Native Firebase with SMS verification
- Fixed phone auth reCAPTCHA configuration (URL scheme, GoogleService-Info.plist)
- Removed 973 lines of legacy auth code (email/password, Apple Sign-In)
- Added ErrorBoundary component for crash resilience with user-friendly fallback
- Polished phone auth UX with real-time formatting, shake animations, retry delays
- Created custom app branding (minimalist "L" icon, LAPSE splash screen)

**Stats:**

- 44 files created/modified
- 4,679 lines added, 1,089 removed (net +3,590)
- 3 phases, 8 plans
- 2.1 hours execution time (14 days elapsed)

**Git range:** `b72b9d4` (chore 06-01) → `44b236f` (docs 08-03)

**What's next:** v1.3 or production release - TestFlight distribution, remote notification testing, final bug fixes

---

## v1.1 Camera/Darkroom UX Refactor (Shipped: 2026-01-12)

**Delivered:** Unified camera and darkroom experience with native iOS gestures, press-and-hold reveals, swipe-to-triage actions, and visual polish.

**Phases completed:** 1-5 (8 plans total)

**Key accomplishments:**

- Unified camera/darkroom into single tab with darkroom button access
- Press-and-hold reveal interaction with progress bar and haptic feedback
- iOS Mail-style swipe gestures for photo triage (left=Archive, right=Journal)
- Animated celebration page with confetti after completing triage
- SVG camera control icons matching bottom nav design system
- Real-time badge updates and proper developing/revealed state management

**Stats:**

- 29 files created/modified
- 4,344 lines added, 245 removed
- 5 phases, 8 plans
- 4.3 hours execution time (1 day)

**Git range:** `83de0e3` (refactor 01-01) → `aa71fd1` (docs 05-01)

**What's next:** Week 12 Final Polish & Testing - standalone build, remote notification testing, app icon, TestFlight prep

---
