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
- [x] **Phase 3: Signup Flow Refactor** - Multi-step signup with consistent dark styling
- [x] **Phase 3.1: Auth Input Field Fixes** - Phone number backspace fix + profile input placeholder cleanup (INSERTED)
- [ ] **Phase 4: Profile Creation Onboarding** - Extended setup flow with Selects and song
- [ ] **Phase 5: Profile Screen Layout** - Core layout and profile info display
- [ ] **Phase 6: Selects Banner** - User-selected photos slideshow
- [ ] **Phase 7: Profile Song Scaffold** - Music preview feature (provider TBD)
- [ ] **Phase 8: User Albums Display** - Horizontal scroll album bar
- [ ] **Phase 9: Monthly Albums** - Auto-generated albums by month
- [ ] **Phase 10: Empty Feed State Change UI Change** - UI improvements for empty feed state transitions
- [ ] **Phase 11: Feed Reaction Emoji Enhancements** - Randomized emoji selection per photo, custom emoji picker with "Add your own"
- [ ] **Phase 12: Own Snaps in Stories Bar** - User's journaled snaps persist on left of stories bar, can comment but not react to own photos

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
**Plans**: 2/2 complete

Plans:

- [x] 03-01: Add profile song section to ProfileSetupScreen
- [x] 03-02: Create SelectsScreen + update navigation flow

### Phase 3.1: Auth Input Field Fixes (INSERTED)

**Goal**: Fix phone number field backspace issue with parenthesis formatting and remove auto-filled letters from profile setup inputs (keep only placeholder hints)
**Depends on**: Phase 3
**Research**: Unlikely (UI bug fixes)
**Plans**: 1/1 complete

Plans:

- [x] 03.1-01: Fix phone backspace + profile input initialization

**Details:**

1. Phone number field: Erasing after entering 3 digits gets stuck on parenthesis that gets auto-generated, making it hard to correct the number
2. Profile setup screen: Remove auto-filled letters in input boxes, only show placeholder hints

### Phase 4: Profile Creation Onboarding

**Goal**: Polish profile onboarding with step indicators, redesigned SelectsScreen with preview/thumbnails, drag-to-reorder, and tutorial hints
**Depends on**: Phase 3.1
**Research**: Unlikely (extending existing ProfileSetupScreen patterns)
**Plans**: 3/4

Plans:

- [x] 04-01: Step Indicator component + ProfileSetupScreen UX updates (step dots, single "Next step" button)
- [x] 04-02: SelectsScreen layout redesign (large preview, 10 thumbnail slots, tap-to-preview)
- [x] 04-03: Drag-to-reorder implementation with delete bar
- [ ] 04-04: Tutorial hint popup, skip confirmation, load existing selects

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

### Phase 10: Empty Feed State Change UI Change

**Goal**: Implement UI improvements for empty feed state transitions
**Depends on**: Phase 9
**Research**: Unlikely (internal UI patterns)
**Plans**: TBD

Plans:

- [ ] 10-01: TBD (run /gsd:plan-phase 10 to break down)

**Details:**

[To be added during planning]

### Phase 11: Feed Reaction Emoji Enhancements

**Goal**: Enhance feed page reaction system with randomized emoji selection per photo (iOS emojis only), user custom emoji picker accessible via "Add your own" button at end of reaction picker
**Depends on**: Phase 10
**Research**: Likely (emoji picker libraries, random selection patterns)
**Research topics**: React Native emoji picker libraries, iOS emoji rendering, random selection without repetition
**Plans**: TBD

Plans:

- [ ] 11-01: TBD (run /gsd:plan-phase 11 to break down)

**Details:**

1. Randomize/rotate available reaction emojis for each photo (iOS emojis only)
2. User can select their own custom emoji to react with
3. Custom emoji gets added to the photo's reactions and can be updated
4. "Add your own" button appears at end of reaction picker scroll
5. Button opens emoji picker modal for selection

### Phase 12: Own Snaps in Stories Bar

**Goal**: Display user's own journaled snaps in stories bar (persists on left), allow comments on own photos but prevent self-reactions
**Depends on**: Phase 11
**Research**: Unlikely (extending existing stories bar patterns)
**Plans**: TBD

Plans:

- [ ] 12-01: TBD (run /gsd:plan-phase 12 to break down)

**Details:**

1. User's own journaled snaps appear in stories bar
2. Own snaps persist on the left side of the bar (always visible)
3. Users can comment on their own photos
4. Users cannot react to their own photos (disable reaction UI for self)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 3.1 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12

| Phase                          | Plans Complete | Status      | Completed  |
| ------------------------------ | -------------- | ----------- | ---------- |
| 1. Auth Shared Components      | 1/1            | Complete    | 2026-01-27 |
| 2. Login Screen Refactor       | 1/1            | Complete    | 2026-01-27 |
| 3. Signup Flow Refactor        | 2/2            | Complete    | 2026-01-27 |
| 3.1 Auth Input Field Fixes     | 1/1            | Complete    | 2026-01-27 |
| 4. Profile Creation Onboarding | 3/4            | In progress | -          |
| 5. Profile Screen Layout       | 0/?            | Not started | -          |
| 6. Selects Banner              | 0/?            | Not started | -          |
| 7. Profile Song Scaffold       | 0/?            | Not started | -          |
| 8. User Albums Display         | 0/?            | Not started | -          |
| 9. Monthly Albums              | 0/?            | Not started | -          |
| 10. Empty Feed State UI Change | 0/?            | Not started | -          |
| 11. Feed Reaction Emoji        | 0/?            | Not started | -          |
| 12. Own Snaps in Stories Bar   | 0/?            | Not started | -          |
