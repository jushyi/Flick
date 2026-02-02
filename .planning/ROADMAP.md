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
- [x] **Phase 4: Profile Creation Onboarding** - Extended setup flow with Selects and song
- [x] **Phase 4.1: Drag-Reorder Visual Feedback** - Animated thumbnail repositioning during drag (INSERTED)
- [x] **Phase 5: Profile Screen Layout** - Core layout and profile info display
- [x] **Phase 6: Selects Banner** - User-selected photos slideshow
- [x] **Phase 7: Profile Song Scaffold** - Music preview feature (iTunes 30s previews)
- [x] **Phase 7.2: Song Modal Stacking Fix** - Convert SongSearchModal to screen for stacked navigation (INSERTED)
- [x] **Phase 7.3: Simplify Clip Selection Modal** - Simplified waveform with drag-to-seek, no range handles (INSERTED)
- [x] **Phase 8: User Albums Display** - Horizontal scroll album bar
- [x] **Phase 8.1: Grid Header Safe Area Fix** - Fix grid views showing photos behind status bar when scrolling (INSERTED)
- [x] **Phase 8.2: Album Creation Animation** - Visual feedback when new album is created (INSERTED)
- [x] **Phase 9: Monthly Albums** - Auto-generated albums by month
- [x] **Phase 10: Empty Feed State UI Change** - Contextual empty states for new users and established users
- [x] **Phase 11: Feed Reaction Emoji Enhancements** - Curated 5-emoji rotation per photo, custom emoji picker with rn-emoji-keyboard
- [x] **Phase 12: Own Snaps in Stories Bar** - User's journaled snaps persist on left of stories bar, can comment but not react to own photos
- [x] **Phase 13: Split Activity into Notifications & Friends** - Separate activity page into two screens: heart icon → notifications, new friend icon on header left → friends list
- [x] **Phase 14: Profile Field Character Limits** - Enforce max lengths: display name (24), username (24), bio (240)
- [ ] **Phase 15: Friends Screen & Other Profiles** - Friends screen refactor and wiring up the ability to view other peoples profile
- [x] **Phase 15.1: Profile Setup Cancel Flow** - Cancel profile setup with verification, return to phone input, delete partial profile (INSERTED)
- [ ] **Phase 15.2: Modal State Preservation** - Return to story/comment modal after viewing profile instead of feed (INSERTED)
- [ ] **Phase 16: Color Constants Standardization** - Standardize all colors to use constants, eliminate hardcoded values, enable future theming
- [ ] **Phase 17: Nested Reply Comments** - Reply to replies with @mention tagging, Instagram-style inline threading
- [ ] **Phase 18: Content Visibility Duration** - Define how long stories and feed pictures stay visible for friends
- [ ] **Phase 19: Delete Account Fallback** - Ensure delete account function works properly with proper fallback
- [ ] **Phase 20: Friend Suggestions via Contacts Sync** - Suggest friends based on synced phone contacts
- [ ] **Phase 21: Remove/Block Friends** - Add ability to remove or block friends
- [ ] **Phase 22: Ability to Edit Profile** - Edit profile screen for updating user info
- [ ] **Phase 23: Photo Deletion & Archiving** - Delete photos or remove from journal (archive)
- [ ] **Phase 24: Social Media Feature Audit** - Full audit to ensure all expected social media app features are present

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
**Plans**: 4/4 complete

Plans:

- [x] 04-01: Step Indicator component + ProfileSetupScreen UX updates (step dots, single "Next step" button)
- [x] 04-02: SelectsScreen layout redesign (large preview, 10 thumbnail slots, tap-to-preview)
- [x] 04-03: Drag-to-reorder implementation with delete bar
- [x] 04-04: Tutorial hint popup, skip confirmation, load existing selects

### Phase 4.1: Drag-Reorder Visual Feedback (INSERTED)

**Goal**: Improve drag-to-reorder UX with animated thumbnail repositioning - thumbnails slide into position during drag, creating visual space when dragged between photos and collapsing when moved away or toward delete bar
**Depends on**: Phase 4
**Research**: Unlikely (animation refinement of existing drag implementation)
**Plans**: 1/1 complete

Plans:

- [x] 04.1-01: Animated thumbnail repositioning + verification

**Details:**

1. Thumbnails animate/slide to make space when item is dragged between them
2. Space collapses when item moves away from a position
3. Visual feedback shows where item will be dropped
4. Smooth animations during drag movement toward delete bar

### Phase 5: Profile Screen Layout

**Goal**: Build core profile screen layout with profile info display (photo, display name, username, bio)
**Depends on**: Phase 4.1
**Research**: Unlikely (internal UI patterns)
**Plans**: 2/2 complete

Plans:

- [x] 05-01: Core layout (header with Friends/Settings, Selects placeholder, overlapping profile photo, info section, future feature placeholders)
- [x] 05-02: Profile integration (nav bar thumbnail, other user profile adaptation)

### Phase 6: Selects Banner

**Goal**: Implement user-selected photos quick slideshow at top of profile
**Depends on**: Phase 5
**Research**: Unlikely (using existing gesture-handler and reanimated)
**Plans**: 2/2 complete

Plans:

- [x] 06-01: SelectsBanner component with auto-play, hold-to-pause, tap callback
- [x] 06-02: Fullscreen view + edit mode navigation

### Phase 7: Profile Song Scaffold

**Goal**: Scaffold music preview feature with tap-to-play (provider integration deferred)
**Depends on**: Phase 5
**Research**: Complete (iTunes API selected for free 30s previews)
**Plans**: 5/5 complete (+ 2 FIX plans)

Plans:

- [x] 07-01: Audio infrastructure (iTunes service + audio player)
- [x] 07-02: ProfileSongCard component + ProfileScreen integration
- [x] 07-03: Song search modal
- [x] 07-04: Clip selection with WaveformScrubber
- [x] 07-04-FIX: UX fixes (partial height modal, playback indicator, cancel flow)
- [x] 07-04-FIX2: Silent mode audio + smooth animations
- [x] 07-05: Full integration (setup screen, edit menu, navigation cleanup)

### Phase 7.2: Song Modal Stacking Fix (INSERTED)

**Goal**: Fix modal navigation so clip selection overlays song search instead of replacing it (UAT-007)
**Depends on**: Phase 7
**Research**: Unlikely (React Navigation screen conversion)
**Plans**: 1/1 complete (+ 1 FIX)

Plans:

- [x] 07.2-01: SongSearchScreen + ClipSelectionModal overlay
- [x] 07.2-01-FIX: UAT fixes (onboarding navigation + modal animation)

**Details:**

1. Convert SongSearchModal from Modal to a navigation screen
2. ClipSelectionModal stacks on top of SongSearchScreen
3. User sees both layers, creating connected flow
4. Cancel in clip selection pops back to song search screen

**Source issue:** UAT-007 from .planning/phases/07-profile-song/07-04-ISSUES.md

### Phase 7.3: Simplify Clip Selection Modal (INSERTED)

**Goal**: Simplify waveform scrubber - remove dual range handles, keep drag-to-seek for scrubbing through preview
**Depends on**: Phase 7
**Research**: Unlikely (UI simplification)
**Plans**: 1/1 complete

Plans:

- [x] 07.3-01: Simplified waveform with drag-to-seek

**Details:**

1. Removed dual-handle range selection from WaveformScrubber
2. Implemented drag-to-seek (touch and drag to scrub through preview)
3. Tap-to-seek also supported (tap anywhere to jump)
4. Playback starts from scrubbed position
5. Preview + confirm button flow unchanged

### Phase 8: User Albums Display

**Goal**: Implement horizontal scroll bar for user-created albums (Instagram highlights style)
**Depends on**: Phase 5
**Research**: Unlikely (standard horizontal FlatList pattern)
**Plans**: 6/6 complete (+ 7 FIX plans + 1 ENH plan)

Plans:

- [x] 08-01: Album data layer (albumService.js with CRUD operations)
- [x] 08-02: Album display components (AlbumCard, AlbumBar, ProfileScreen integration)
- [x] 08-03: Album creation flow (CreateAlbumScreen, AlbumPhotoPickerScreen)
- [x] 08-04: Album grid view (AlbumGridScreen, cover photos, navigation)
- [x] 08-05: Album photo viewer (full-screen, swipe navigation, set cover, remove)
- [x] 08-06: Album management (rename, delete, change cover, AddToAlbumSheet)
- [x] 08-FIX1: UAT cosmetic fixes (UAT-001, UAT-003, UAT-005)
- [x] 08-FIX2: Photo grid aspect ratio fixes (UAT-002, UAT-004)
- [x] 08-FIX3: Empty album state redesign (UAT-012)
- [x] 08-FIX4: Photo viewer enhancements (UAT-006, UAT-008, UAT-010, UAT-011)
- [x] 08-FIX5: Menu system overhaul (UAT-007, UAT-009)
- [x] 08-FIX6: Modal/menu UX polish (UAT-013, UAT-014, UAT-018)
- [x] 08-FIX7: Photo picker/viewer fixes (UAT-015, UAT-016, UAT-017)
- [x] 08-ENH1: Stacked card effect (visual depth for album cards)

### Phase 8.1: Grid Header Safe Area Fix (INSERTED)

**Goal**: Fix album grid view and photo picker showing photos behind status bar/notch when scrolling up - header should have black background extending to safe area
**Depends on**: Phase 8
**Research**: Unlikely (safe area styling fix)
**Plans**: 1/1 complete

Plans:

- [x] 08.1-01: Safe area background for AlbumGridScreen + header background for AlbumPhotoPickerScreen

**Details:**

1. Album grid view (AlbumGridScreen) header gets cut off when scrolling up
2. Photo picker (AlbumPhotoPickerScreen) has same issue
3. Photos visible behind the notch/iOS status bar indicators
4. Header background should extend to cover the entire safe area with black

### Phase 8.2: Album Creation Animation (INSERTED)

**Goal**: Add visual feedback animation when a new album is created - scroll album bar to new album and highlight it so user sees confirmation of their action
**Depends on**: Phase 8.1
**Research**: Unlikely (React Native animation patterns)
**Plans**: 1/1 complete

Plans:

- [x] 08.2-01: Scroll-to and scale bounce animation for new album creation

**Details:**

1. Currently after album creation, user is navigated to profile screen with no indication of success
2. New album appears in album bar but user must scroll/look to find it
3. Add animation to scroll album bar to the new album position
4. Highlight/pulse the new album card to draw attention
5. Provides clear visual confirmation that album was created successfully

### Phase 9: Monthly Albums

**Goal**: Auto-generate and display monthly albums grouping all user photos by month
**Depends on**: Phase 5
**Research**: Unlikely (internal Firestore query grouping)
**Plans**: 3/3 complete

Plans:

- [x] 09-01: Data layer + MonthlyAlbumCard component
- [x] 09-02: YearSection + MonthlyAlbumsSection with animations
- [x] 09-03: Grid view + ProfileScreen integration

### Phase 10: Empty Feed State UI Change

**Goal**: Implement contextual empty states that guide users toward meaningful actions
**Depends on**: Phase 9
**Research**: Unlikely (internal UI patterns)
**Plans**: 1/1 complete

Plans:

- [x] 10-01: Data layer + empty state components + FeedScreen integration

**Details:**

Two distinct empty states based on user state:

1. **New user** (no friends): Stories bar shows "Add friends" prompt (taps to FriendsList), feed shows "Take your first photo" card (taps to Camera)
2. **Established user** (has friends but no posts): Sad emoji with "Nothing yet, tell your friends to post"

Changes:

- feedService.getFriendStoriesData returns totalFriendCount
- AddFriendsPromptCard component (matches FriendStoryCard styling)
- TakeFirstPhotoCard component (matches FeedPhotoCard styling)
- FeedScreen conditional rendering based on friend count and photo availability

### Phase 11: Feed Reaction Emoji Enhancements

**Goal**: Curated 5-emoji rotation per photo with custom emoji picker using rn-emoji-keyboard
**Depends on**: Phase 10
**Research**: Complete (rn-emoji-keyboard selected)
**Plans**: 1/1 complete

Plans:

- [x] 11-01: Curated emoji infrastructure, hook updates, and UI integration

**Details:**

1. Each photo shows 5 curated emojis (from 8 categories: faces, love, fire, animals, food, gestures, nature, expressions)
2. Deterministic hash-based selection ensures same photo shows same emojis
3. "+" add button at end of emoji row opens rn-emoji-keyboard picker
4. Preview → confirm flow: selecting emoji shows preview, tapping confirms reaction

### Phase 12: Own Snaps in Stories Bar

**Goal**: Display user's own journaled snaps in stories bar (persists on left), allow comments on own photos but prevent self-reactions
**Depends on**: Phase 11
**Research**: Unlikely (extending existing stories bar patterns)
**Plans**: 1/1 complete

Plans:

- [x] 12-01: MeStoryCard component, getUserStoriesData service, FeedScreen integration, disabled self-reactions

**Details:**

1. User's own journaled snaps appear in stories bar
2. Own snaps persist on the left side of the bar (always visible)
3. Users can comment on their own photos
4. Users cannot react to their own photos (disable reaction UI for self)

### Phase 13: Split Activity into Notifications & Friends

**Goal**: Separate the current activity page into two distinct screens - notifications (accessed via heart icon) and friends list (accessed via new friend icon on left side of feed header)
**Depends on**: Phase 12
**Research**: Unlikely (internal UI restructuring)
**Plans**: 2/2 complete

Plans:

- [x] 13-01: Feed header navigation icons (friend icon left, heart icon right)
- [x] 13-02: Activity screen cleanup (remove FriendsTab, notifications-only)

**Details:**

1. Heart icon in feed header navigates to notifications screen
2. New friend icon added to left side of feed header bar
3. Friend icon navigates to friends list screen
4. Split existing activity page content between the two screens

### Phase 14: Profile Field Character Limits

**Goal**: Enforce maximum character lengths for profile fields - display name (24 chars), username (24 chars), bio (240 chars)
**Depends on**: Phase 13
**Research**: Unlikely (input validation patterns)
**Plans**: 1/1 complete

Plans:

- [x] 14-01: Input component enhancements + ProfileSetupScreen integration

**Details:**

1. Display name: maximum 24 characters
2. Username: maximum 24 characters
3. Bio: maximum 240 characters
4. Apply limits in ProfileSetupScreen and any edit profile screens
5. Show subtle character counter on focus (e.g., "12/24")
6. Subtle shake animation when hitting limit

### Phase 15: Friends Screen & Other Profiles

**Goal**: Refactor friends screen and wire up the ability to view other peoples profile
**Depends on**: Phase 14
**Research**: Unlikely (internal UI patterns)
**Plans**: 2/3 complete (+ 2 FIX plans)

Plans:

- [x] 15-01: Unified Friends screen with Requests | Friends tabs
- [x] 15-02: Wire up profile navigation from avatar taps
- [x] 15-02-FIX: UAT fixes for other user profile viewing
- [x] 15-02-FIX2: Album navigation and read-only fixes
- [ ] 15-03: Conditional profile display (friends vs non-friends)

**Details:**

1. Friends screen redesign with unified FriendCard component
2. Two-tab structure: Requests | Friends with search in both
3. Profile navigation from any avatar tap (stories, comments, friend cards)
4. Conditional profile display: friends see everything, non-friends see limited info

### Phase 15.1: Profile Setup Cancel Flow (INSERTED)

**Goal:** Allow users to cancel profile setup and return to phone number input screen with proper cleanup of partial profile data
**Depends on:** Phase 15
**Research:** Unlikely (internal navigation and cleanup patterns)
**Plans:** 1/1 complete

Plans:

- [x] 15.1-01: Cancel button with confirmation dialog + user doc deletion

**Details:**

1. Add cancel/back option during profile setup for new phone numbers
2. Show confirmation dialog ("Are you sure?") before canceling
3. Delete in-progress profile data from database on cancel confirmation
4. Navigate back to phone number input screen via auth state listener
5. Handle edge cases (network errors during cleanup, etc.)

### Phase 15.2: Modal State Preservation (INSERTED)

**Goal**: Preserve modal state when navigating to profiles from story/comment modals - back navigation returns users to the modal they were viewing instead of the feed
**Depends on**: Phase 15
**Research**: Likely (React Navigation state persistence patterns)
**Plans**: TBD

Plans:

- [ ] 15.2-01: TBD (run /gsd:plan-phase 15.2 to break down)

**Details:**

1. When tapping avatar in story viewer or comments sheet, navigate to profile
2. Back navigation should return to the story/comment modal that was open
3. Current behavior: back goes to feed with refresh (feels disconnected)
4. Technical options:
   - Keep modals in background during profile navigation
   - Store modal state and reopen on back navigation
   - Use navigation state to track origin
5. Handle nested modals (comments sheet inside photo modal)

**Source:** Enhancement request from 15-03 UAT testing

### Phase 16: Color Constants Standardization

**Goal**: Standardize all colors throughout every screen, modal, and component to use constants from a centralized theme system. Eliminate all hardcoded color values to enable future theme/palette changes.
**Depends on**: Phase 15.2
**Research**: Unlikely (internal refactoring)
**Plans**: TBD

Plans:

- [ ] 16-01: TBD (run /gsd:plan-phase 16 to break down)

**Details:**

1. Audit all screens, modals, and components for hardcoded color values
2. Establish single source of truth for color constants (background, text, accents, etc.)
3. One consistent background color throughout (black for dark theme)
4. Replace all hardcoded hex/rgb values with constant references
5. Create documentation and guidelines for adding new screens/modals
6. Ensure architecture supports future color palette/theme switching

### Phase 17: Nested Reply Comments

**Goal**: Enable users to reply to existing replies with Instagram-style inline threading - all replies stay flat/inline, but replying to someone's reply adds @mention tag at the front of the comment
**Depends on**: Phase 16
**Research**: Unlikely (extending existing comment system)
**Plans**: TBD

Plans:

- [ ] 17-01: TBD (run /gsd:plan-phase 17 to break down)

**Details:**

1. Replying to a reply tags the original commenter at the front (e.g., "@username your comment")
2. All replies remain inline (no nested/indented threading)
3. @mention is tappable to highlight or scroll to referenced comment
4. Instagram-style UX - simple, flat comment list with contextual @mentions

### Phase 18: Content Visibility Duration

**Goal**: Define and implement visibility duration rules for stories and feed pictures - clarify how long content stays visible in the stories bar and feed tab for friends
**Depends on**: Phase 17
**Research**: Likely (clarify desired behavior with user before planning)
**Plans**: TBD

Plans:

- [ ] 18-01: TBD (run /gsd:plan-phase 18 to break down)

**Details:**

[To be clarified during planning - key questions:]

1. How long should stories stay visible in the stories bar? (e.g., 24 hours like Instagram/Snapchat?)
2. How long should feed pictures remain visible in the feed tab?
3. Should content disappear entirely or just move to a different view (e.g., archive)?
4. Different rules for own content vs friends' content?
5. Visual indicators for content expiration?

### Phase 19: Delete Account Fallback

**Goal**: Ensure delete account function works properly with proper fallback handling for errors and edge cases
**Depends on**: Phase 18
**Research**: Unlikely (internal account management)
**Plans**: TBD

Plans:

- [ ] 19-01: TBD (run /gsd:plan-phase 19 to break down)

**Details:**

[To be added during planning]

### Phase 20: Friend Suggestions via Contacts Sync

**Goal**: Suggest potential friends to users based on phone contacts synced from their device
**Depends on**: Phase 19
**Research**: Likely (permissions handling, contact matching algorithms)
**Plans**: TBD

Plans:

- [ ] 20-01: TBD (run /gsd:plan-phase 20 to break down)

**Details:**

[To be added during planning]

### Phase 21: Remove/Block Friends

**Goal**: Add ability to remove or block friends
**Depends on**: Phase 20
**Research**: Unlikely (internal UI patterns)
**Plans**: TBD

Plans:

- [ ] 21-01: TBD (run /gsd:plan-phase 21 to break down)

**Details:**

[To be added during planning]

### Phase 22: Ability to Edit Profile

**Goal**: Edit profile screen for updating display name, username, bio, profile photo, and profile song
**Depends on**: Phase 21
**Research**: Unlikely (internal UI patterns, reusing existing components)
**Plans**: TBD

Plans:

- [ ] 22-01: TBD (run /gsd:plan-phase 22 to break down)

**Details:**

[To be added during planning]

### Phase 23: Photo Deletion & Archiving

**Goal**: Enable users to delete photos entirely or remove them from their journal (archive for later access)
**Depends on**: Phase 22
**Research**: Unlikely (internal data management patterns)
**Plans**: TBD

Plans:

- [ ] 23-01: TBD (run /gsd:plan-phase 23 to break down)

**Details:**

1. Delete photo: permanently removes photo from storage and all references
2. Archive/remove from journal: hides photo from feed/stories but preserves in archive
3. Access archived photos from profile or settings
4. Confirmation dialogs for destructive actions
5. Cascade handling for photos in albums, selects, reactions, comments

### Phase 24: Social Media Feature Audit

**Goal**: Full audit to ensure all expected social media app features are present and identify any gaps
**Depends on**: Phase 23
**Research**: Likely (competitive analysis of social media apps)
**Plans**: TBD

Plans:

- [ ] 24-01: TBD (run /gsd:plan-phase 24 to break down)

**Details:**

[To be added during planning]

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 3.1 → 4 → 4.1 → 5 → 6 → 7 → 7.2 → 7.3 → 8 → 8.1 → 8.2 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 15.1 → 15.2 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24

| Phase                            | Plans Complete | Status      | Completed  |
| -------------------------------- | -------------- | ----------- | ---------- |
| 1. Auth Shared Components        | 1/1            | Complete    | 2026-01-27 |
| 2. Login Screen Refactor         | 1/1            | Complete    | 2026-01-27 |
| 3. Signup Flow Refactor          | 2/2            | Complete    | 2026-01-27 |
| 3.1 Auth Input Field Fixes       | 1/1            | Complete    | 2026-01-27 |
| 4. Profile Creation Onboarding   | 4/4            | Complete    | 2026-01-27 |
| 4.1 Drag-Reorder Visual Feedback | 1/1            | Complete    | 2026-01-27 |
| 5. Profile Screen Layout         | 2/2            | Complete    | 2026-01-27 |
| 6. Selects Banner                | 2/2            | Complete    | 2026-01-28 |
| 7. Profile Song Scaffold         | 5/5 + 2 FIX    | Complete    | 2026-01-28 |
| 7.2 Song Modal Stacking Fix      | 1/1 + 1 FIX    | Complete    | 2026-01-28 |
| 7.3 Simplify Clip Selection      | 1/1            | Complete    | 2026-01-29 |
| 8. User Albums Display           | 6/6 + 7 FIX    | Complete    | 2026-01-29 |
| 8.1 Grid Header Safe Area Fix    | 1/1            | Complete    | 2026-01-29 |
| 8.2 Album Creation Animation     | 1/1            | Complete    | 2026-01-29 |
| 9. Monthly Albums                | 3/3            | Complete    | 2026-01-29 |
| 10. Empty Feed State UI Change   | 1/1            | Complete    | 2026-01-29 |
| 11. Feed Reaction Emoji          | 1/1            | Complete    | 2026-01-30 |
| 12. Own Snaps in Stories Bar     | 1/1            | Complete    | 2026-01-30 |
| 13. Split Activity/Friends       | 2/2            | Complete    | 2026-01-30 |
| 14. Profile Field Limits         | 1/1            | Complete    | 2026-02-02 |
| 15. Friends Screen & Profiles    | 2/3            | In progress | -          |
| 15.1 Profile Setup Cancel        | 1/1            | Complete    | 2026-02-02 |
| 15.2 Modal State Preservation    | 0/?            | Not started | -          |
| 16. Color Constants              | 0/?            | Not started | -          |
| 17. Nested Reply Comments        | 0/?            | Not started | -          |
| 18. Content Visibility Duration  | 0/?            | Not started | -          |
| 19. Delete Account Fallback      | 0/?            | Not started | -          |
| 20. Friend Suggestions Contacts  | 0/?            | Not started | -          |
| 21. Remove/Block Friends         | 0/?            | Not started | -          |
| 22. Ability to Edit Profile      | 0/?            | Not started | -          |
| 23. Photo Deletion & Archiving   | 0/?            | Not started | -          |
| 24. Social Media Feature Audit   | 0/?            | Not started | -          |
