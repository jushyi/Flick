# Roadmap: Auth & Profile Refactor

## Overview

Transform Lapse Clone's authentication experience and profile system from inconsistent placeholders into polished, cohesive screens that match the app's established dark aesthetic. This journey starts with shared auth components, refactors login/signup flows, extends onboarding to capture full profile data, and builds out the profile screen with Selects banner, profile song, and album galleries.

## Domain Expertise

None

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Auth Shared Components** - Dark theme foundation, shared styles and reusable components
- [x] **Phase 2: Login Screen Refactor** - Full dark theme application, improved UX
- [ ] **Phase 3: Signup Flow Refactor** - Multi-step signup with consistent dark styling (1/2 plans)
- [ ] **Phase 4: Profile Creation Onboarding** - Extended setup flow with Selects and song
- [ ] **Phase 5: Profile Screen Layout** - Core layout and profile info display
- [ ] **Phase 6: Selects Banner** - User-selected photos slideshow
- [ ] **Phase 7: Profile Song Scaffold** - Music preview feature (provider TBD)
- [ ] **Phase 8: User Albums Display** - Horizontal scroll album bar
- [ ] **Phase 9: Monthly Albums** - Auto-generated albums by month

## Phase Details

### Phase 1: Auth Shared Components

**Goal**: Establish dark theme foundation with shared styles, colors, typography, and reusable components (buttons, inputs, headers) for all auth screens
**Depends on**: Nothing (first phase)
**Research**: Unlikely (existing dark theme patterns in Camera/Feed/Darkroom)
**Plans**: 1/1 complete

Plans:

- [x] 01-01: Dark theme Button/Input updates + AuthCodeInput component

### Phase 2: Login Screen Refactor

**Goal**: Apply dark theme to login screen, improve UX to match app aesthetic
**Depends on**: Phase 1
**Research**: Unlikely (internal UI using shared components)
**Plans**: 1/1 complete

Plans:

- [x] 02-01: Integrate AuthCodeInput into VerificationScreen + dark theme consistency

### Phase 3: Signup Flow Refactor

**Goal**: Refactor signup into multi-step flow with consistent dark styling and clear progression
**Depends on**: Phase 1
**Research**: Unlikely (internal UI refactor)
**Plans**: 1/2 complete

Plans:

- [x] 03-01: Add profile song section to ProfileSetupScreen
- [ ] 03-02: Create SelectsScreen + update navigation flow

### Phase 4: Profile Creation Onboarding

**Goal**: Extend profile setup to capture full profile data (username, display name, photo, bio, Selects selection, song selection)
**Depends on**: Phase 3
**Research**: Unlikely (extending existing ProfileSetupScreen patterns)
**Plans**: TBD

Plans:

- [ ] 04-01: TBD during planning

### Phase 5: Profile Screen Layout

**Goal**: Build core profile screen layout with profile info display (photo, display name, username, bio)
**Depends on**: Phase 4
**Research**: Unlikely (internal UI patterns)
**Plans**: TBD

Plans:

- [ ] 05-01: TBD during planning

### Phase 6: Selects Banner

**Goal**: Implement user-selected photos quick slideshow at top of profile
**Depends on**: Phase 5
**Research**: Likely (carousel/slideshow implementation)
**Research topics**: React Native carousel libraries, auto-play slideshow patterns, gesture handling
**Plans**: TBD

Plans:

- [ ] 06-01: TBD during planning

### Phase 7: Profile Song Scaffold

**Goal**: Scaffold music preview feature with tap-to-play (provider integration deferred)
**Depends on**: Phase 5
**Research**: Likely (music preview API patterns)
**Research topics**: Spotify/Apple Music preview APIs, audio playback in React Native, expo-av usage
**Plans**: TBD

Plans:

- [ ] 07-01: TBD during planning

### Phase 8: User Albums Display

**Goal**: Implement horizontal scroll bar for user-created albums (Instagram highlights style)
**Depends on**: Phase 5
**Research**: Unlikely (standard horizontal FlatList pattern)
**Plans**: TBD

Plans:

- [ ] 08-01: TBD during planning

### Phase 9: Monthly Albums

**Goal**: Auto-generate and display monthly albums grouping all user photos by month
**Depends on**: Phase 5
**Research**: Unlikely (internal Firestore query grouping)
**Plans**: TBD

Plans:

- [ ] 09-01: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase                          | Plans Complete | Status      | Completed  |
| ------------------------------ | -------------- | ----------- | ---------- |
| 1. Auth Shared Components      | 1/1            | Complete    | 2026-01-27 |
| 2. Login Screen Refactor       | 1/1            | Complete    | 2026-01-27 |
| 3. Signup Flow Refactor        | 1/2            | In progress | -          |
| 4. Profile Creation Onboarding | 0/?            | Not started | -          |
| 5. Profile Screen Layout       | 0/?            | Not started | -          |
| 6. Selects Banner              | 0/?            | Not started | -          |
| 7. Profile Song Scaffold       | 0/?            | Not started | -          |
| 8. User Albums Display         | 0/?            | Not started | -          |
| 9. Monthly Albums              | 0/?            | Not started | -          |
