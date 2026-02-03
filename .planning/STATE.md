# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-26)

**Core value:** All three areas (login/signup flow, profile creation onboarding, profile screen) must be solid and functional — the app's first impression and personal identity depend on it.
**Current focus:** Phase 17 — Nested Reply Comments

## Current Position

Phase: 17 of 26 (Nested Reply Comments)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-02-03 — Completed 17-01-PLAN.md

Progress: ██████████░░░░░░░░ 50% (Phase 17 in progress)

## Performance Metrics

**Velocity:**

- Total plans completed: 72 (including 17 FIX plans)
- Average duration: 11 min
- Total execution time: 785 min

**By Phase:**

| Phase | Plans | Total  | Avg/Plan |
| ----- | ----- | ------ | -------- |
| 1     | 1     | 2 min  | 2 min    |
| 2     | 1     | 5 min  | 5 min    |
| 3     | 2     | 20 min | 10 min   |
| 3.1   | 1     | 5 min  | 5 min    |
| 4     | 4     | 54 min | 13.5 min |
| 4.1   | 2     | 70 min | 35 min   |
| 5     | 2     | 26 min | 13 min   |
| 6     | 3     | 38 min | 13 min   |
| 7     | 7     | 68 min | 10 min   |
| 7.2   | 2     | 20 min | 10 min   |
| 7.3   | 1     | 15 min | 15 min   |
| 8     | 6     | 65 min | 11 min   |
| 8.1   | 1     | 3 min  | 3 min    |
| 8.2   | 1     | 12 min | 12 min   |
| 9     | 3     | 15 min | 5 min    |
| 10    | 1     | 8 min  | 8 min    |
| 11    | 2     | 32 min | 16 min   |
| 12    | 1     | 18 min | 18 min   |
| 13    | 2     | 14 min | 7 min    |
| 14    | 1     | 8 min  | 8 min    |
| 15    | 4     | 54 min | 13.5 min |
| 15.1  | 1     | 9 min  | 9 min    |
| 15.2  | 3     | 46 min | 15 min   |
| 15.3  | 2     | 27 min | 13.5 min |
| 15.4  | 3     | 28 min | 9 min    |
| 16    | 10    | 68 min | 7 min    |
| 17    | 1     | 12 min | 12 min   |

**Recent Trend:**

- Last 5 plans: 5 min, 5 min, 8 min, 10 min, 12 min
- Trend: Phase 17 started - reply-to-reply infrastructure complete

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| Phase | Decision                                              | Rationale                                                               |
| ----- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| 1     | Use colors.js constants throughout components         | Ensures consistency and maintainability for dark theme                  |
| 1     | AuthCodeInput uses hidden TextInput pattern           | Better UX while maintaining keyboard support and iOS autofill           |
| 2     | Use AuthCodeInput's onComplete callback               | Eliminates need for manual auto-submit useEffect                        |
| 2     | Updated branding from LAPSE to REWIND                 | Matches current app identity                                            |
| 3     | Use Ionicons instead of emojis                        | Consistency with other screens using Ionicons                           |
| 3     | Debounce username check at 500ms                      | Balance responsiveness with Firestore query efficiency                  |
| 3     | Require username/display name on skip                 | Essential fields even when skipping optional ones                       |
| 3     | Conditional nav rendering over manual replace         | Navigator branches auto-transition on auth state change                 |
| 3     | Store photo URIs directly in selects array            | Simpler MVP; future could upload to Firebase Storage                    |
| 3.1   | Text length comparison for deletion detection         | Catches formatting char deletion, not just digits                       |
| 3.1   | Show raw digits when deleting                         | Prevents cursor trap on parentheses during phone correction             |
| 3.1   | Detect defaults in ProfileSetupScreen                 | Keep AuthContext defaults for DB uniqueness, detect in UI               |
| 4     | Single "Next step" button replaces Complete + Skip    | Cleaner UX, users must complete required fields                         |
| 4     | Step indicator with dots and "Step X of Y" text       | Clear progress indication for multi-screen onboarding                   |
| 4     | Preview tap: multi-select when empty, disabled after  | Users add via thumbnails once photos exist for granular control         |
| 4     | 4:5 aspect ratio for preview area                     | Matches Instagram portrait style                                        |
| 4     | Skip confirmation from Complete button                | Single button, shows alert if no photos selected                        |
| 4     | Tutorial hint shows only with 2+ photos               | Need multiple photos to demonstrate reorder feature                     |
| 4     | AsyncStorage for hint dismissal persistence           | Hint state persists across sessions                                     |
| 4.1   | Animate dragged item to target before array update    | Prevents visual flash by completing animation before React re-render    |
| 4.1   | Use photoId tracking to detect slot content changes   | Allows clean animation reset when photo at slot changes                 |
| 4.1   | withTiming callback for post-animation state updates  | Sequences visual animation completion before triggering reorder         |
| 4.1   | LayoutAnimation for array state transitions           | Smooth visual transitions when reordering/deleting photos               |
| 4.1   | photoId as React key instead of index                 | Stable component identity prevents content flash during reorder         |
| 4.1   | withDelay(16ms) + withTiming(200ms) for reset         | Syncs transform reset with LayoutAnimation timing                       |
| 4.1   | Duplicate photo validation in pickers                 | Prevents React key collision from same photo selected twice             |
| 4.1   | Select dragged photo in preview during drag           | User sees which photo they're manipulating                              |
| 5     | Left-align profile info for best friends feature      | Reserve right half of section for future best friends feature           |
| 5     | Profile info in gray card (left half)                 | Visual separation and prepares for split layout                         |
| 5     | Remove edit button from profile                       | Editing via profile photo tap or Settings navigation (future)           |
| 5     | useSafeAreaInsets for header positioning              | Better control than SafeAreaView for absolute positioned headers        |
| 5     | Circular tab thumbnail 28x28 with 2px focused border  | Matches Instagram-style profile icon in tab bar                         |
| 5     | ProfileIcon SVG fallback when no photoURL             | Graceful degradation for users without profile photos                   |
| 5     | isOwnProfile pattern with route params                | Clean conditional rendering for own vs other user views                 |
| 5     | Placeholder data for other users (TODO: Firestore)    | Layout scaffolding now, data fetching deferred                          |
| 6     | 150ms threshold for tap vs hold detection             | Quick taps trigger onTap, holds pause cycling                           |
| 6     | Gesture.Exclusive pattern for tap/hold                | LongPress wins if held, Tap wins if quick release                       |
| 6     | GestureHandlerRootView wrapper for gesture components | Required for gesture recognition in component context                   |
| 6     | Copy DraggableThumbnail into SelectsEditOverlay       | Simpler than extracting to shared, avoids breaking existing code        |
| 6     | 750ms cycle interval for slideshow                    | Faster cycling for snappier highlight experience                        |
| 6     | 3:4 aspect ratio for edit overlay preview             | Taller preview with better visual centering                             |
| 6     | useSafeAreaInsets for modal safe area handling        | SafeAreaView edges prop unreliable on first render after app launch     |
| 7     | No debounce in iTunes service                         | UI layer handles debounce for better UX control                         |
| 7     | No caching in iTunes service                          | Simple API calls sufficient for MVP, avoids stale data                  |
| 7     | No background audio mode for profile songs            | Songs should stop when navigating away from profile (desired)           |
| 7     | 300x300 album art from iTunes                         | Higher quality display by replacing 100x100 in API response             |
| 7     | Component manages own audio state (not global)        | Simpler for MVP, component self-contained                               |
| 7     | Empty state uses dashed border pattern                | Consistent with other add prompts in app                                |
| 7     | Glow uses brand purple color                          | Consistency with app accent color                                       |
| 7     | 500ms search debounce in SongSearchModal              | Balance UX responsiveness with API call efficiency                      |
| 7     | WYSIWYG result cards match ProfileSongCard layout     | Users see exactly what their selected song will look like               |
| 7     | Separate tap targets for preview vs selection         | Clear distinction between previewing and selecting a song               |
| 7     | Simulated waveform over native library                | Native waveform library had Metro bundling issues; visual bars work     |
| 7     | Worklet directive + runOnJS for gesture state         | Prevents crash when updating React state from gesture callbacks         |
| 7     | 5-second minimum clip gap                             | Ensures meaningful clip selection, prevents degenerate ranges           |
| 7     | Sequential modal flow for song/clip selection         | iOS React Native doesn't support stacked modals; cancel reopens search  |
| 7     | 50ms progress update interval for audio               | 20 updates/sec provides smooth playback indicator animation             |
| 7     | Linear easing with matching animation duration        | Constant speed movement for audio playback (not spring/ease-in-out)     |
| 7     | Immediate audio cut on stop (no fade out)             | User preference for clean cut over gradual fade                         |
| 7     | playsInSilentModeIOS: true for audio                  | Profile songs play through speakers regardless of silent switch         |
| 7     | Alert.alert for edit menu pattern                     | Consistent with other menus in app, simple and reliable                 |
| 7     | useFocusEffect for navigation audio cleanup           | Component detects parent screen blur without prop drilling              |
| 7.2   | Screen + Modal overlay pattern                        | iOS doesn't support stacked modals; screen + modal on top works         |
| 7.2   | Cancel always stays on search                         | User can pick different song after previewing current clip              |
| 7.2   | Combined Edit Song menu option                        | Single option opens clip first, cancel goes to search for different     |
| 7.2   | Backdrop fades + content slides animation pattern     | Modal animationType='fade' for backdrop, Animated.spring for content    |
| 7.3   | Keep waveform with drag-to-seek (no range handles)    | User preference for scrubbing through preview; visual feedback helpful  |
| 7.3   | Dual state tracking (shared value + JS ref)           | Shared values for worklet, JS ref for useEffect reactivity              |
| 8     | First photo becomes cover on album creation           | Simplest UX - user's first selected photo is the default cover          |
| 8     | Photos added to beginning of array (newest first)     | Matches expected behavior where new additions appear first              |
| 8     | Auto-update cover when current cover removed          | Prevents broken cover state; falls back to first remaining photo        |
| 8     | 150x150 card size for album display                   | Matches visual spec, good balance of size and scroll density            |
| 8     | Dashed border pattern for add album button            | Consistent with other add prompts in app (SelectsScreen)                |
| 8     | Empty photoUrls map for now                           | Cover URL resolution deferred to later plan                             |
| 8     | Two-screen album creation flow (name → photos)        | Cleaner UX separating naming from photo selection                       |
| 8     | 3-column grid for photo picker                        | Matches common photo picker patterns in iOS apps                        |
| 8     | Navigate to ProfileMain on album create success       | Pops both CreateAlbum and PhotoPicker screens cleanly                   |
| 8     | resizeMode cover for full-screen photo viewer         | Photos fill entire screen, may crop edges for non-matching aspect       |
| 8     | onScroll with 16ms throttle for position indicator    | Smooth real-time updates during fast swipes                             |
| 8     | Header overlay pattern for photo viewer               | Controls float over photo with semi-transparent background              |
| 8     | Silent cover update (no success dialog)               | Cleaner UX, visual feedback from cover change is sufficient             |
| 8     | useFocusEffect for ProfileScreen album refresh        | Ensures data consistency when returning from nested edits               |
| 8     | AddToAlbumSheet deferred integration                  | Component ready, wiring to photo menus in future phase                  |
| 8     | 50x67 thumbnail bar at viewer bottom                  | 3:4 ratio matching album grid, 2px white border for active              |
| 8     | Swipe dismiss: 150px or 500px/s threshold             | Standard gesture threshold for natural dismissal feel                   |
| 8     | Last photo removal prompts album deletion             | Cascading deletion prevents orphaned empty albums                       |
| 8     | DropdownMenu for option menus, not Alert.alert        | Better UX, modal-based dropdown with icons and dark theme               |
| 8     | RenameAlbumModal for text input, not Alert.prompt     | Half-screen modal with styled input, character count                    |
| 8     | Anchored positioning for DropdownMenu                 | User preference for contextual feel over centered iOS action sheet      |
| 8.2   | Spring animation (damping 8, stiffness 300)           | iOS-native feel for scale bounce animation                              |
| 8.2   | Animation timing: 0/300/500ms staggered sequence      | Predictable visual flow for scroll + highlight                          |
| 8.2   | forwardRef + useImperativeHandle for FlatList scroll  | Exposes scrollToAlbum method to parent component                        |
| 9     | LayoutAnimation.configureNext for expand/collapse     | Smooth height transitions when toggling year sections                   |
| 9     | Animated.Value interpolation for chevron rotation     | 0-180deg rotation for collapsible indicator                             |
| 9     | Empty state renders nothing (section disappears)      | Cleaner UI when no monthly data exists                                  |
| 9     | Row-based FlatList for mixed day headers and photos   | SectionList doesn't support numColumns; row grouping works              |
| 9     | isOwnProfile=false for read-only AlbumPhotoViewer     | Hides edit options (remove, set cover) in monthly album viewer          |
| 9     | Square aspect ratio for month cards                   | User preference for visual balance in monthly albums section            |
| 10    | Dashed border styling for prompt cards                | Consistent with existing patterns (SelectsScreen, ProfileSongCard)      |
| 10    | totalFriendCount in feedService return                | Enables distinguishing "no friends" vs "friends but no posts"           |
| 10    | Sad emoji (Ionicons) for established user empty state | Clean icon-based approach consistent with other screens                 |
| 11    | 8 emoji categories with 10 emojis each                | Provides enough variety for curated rotation while keeping manageable   |
| 11    | Deterministic hash selection for emoji rotation       | Same photo always shows same emojis, prevents UI flickering             |
| 11    | Prime multiplier (31) for pool distribution           | Better spread across categories for varied curated emoji selection      |
| 11    | Immediate selection for custom emoji (no confirm)     | User feedback: faster UX, emoji appears at front with highlight         |
| 11    | Purple highlight with 1s fade for all emoji taps      | Visual feedback for reactions, applies to both curated and custom       |
| 12    | MeStoryCard always first in stories bar (leftmost)    | User's own content most relevant, consistent with Instagram pattern     |
| 12    | Empty state shows "M" initial placeholder             | Card should always be visible even without photos                       |
| 12    | isOwnStory prop for reaction disabling                | Pattern for differentiating own vs friend content in modals             |
| 12    | Reactions visible but grayed out (opacity 0.4)        | Users can see friend reactions but can't react to themselves            |
| 12    | Comments remain functional for own stories            | Users may want to add self-notes/captions to their photos               |
| 13    | Mirror notification button positioning for friends    | Absolute left: 24 matches right: 24 pattern for visual symmetry         |
| 13    | Chevron-back icon for FriendsListScreen back nav      | Consistent with iOS navigation patterns and other screens               |
| 13    | Inline NotificationsTab into ActivityScreen           | Simpler structure for single-purpose notifications screen               |
| 13    | Remove TabNavigator from ActivityScreen               | No tabs needed when screen has single purpose                           |
| 14    | 24/24/240 character limits for profile fields         | More breathing room than original 16/16/160 while keeping fields tight  |
| 14    | Character counter visible only on focus               | Keeps UI clean, shows feedback when user needs it                       |
| 14    | 200ms shake animation (4px amplitude) for limit       | Tactile feedback without being intrusive or annoying                    |
| 15    | State-based tabs over material-top-tabs               | Simpler implementation using useState                                   |
| 15    | Unified FriendCard for all relationship states        | One component with props instead of separate components                 |
| 15    | 500ms debounce for user search in Requests tab        | Balance UX responsiveness with Firestore query efficiency               |
| 15    | Long press to remove friend                           | Consistent with other list interaction patterns in app                  |
| 15.2  | Deferred navigation via returned function             | Allows PhotoDetailModal to control timing (close first, then navigate)  |
| 15.2  | Skip feed refresh on profile peek return              | Prevents visible flash before modal restoration                         |
| 15.2  | Close sequence: comments → modal → navigate           | Prevents frozen UI from overlapping modal animations                    |
| 15.2  | fullScreenModal for OtherUserProfile                  | Keeps parent (feed+modals) mounted; accept bottom slide (iOS limit)     |
| 15.2  | Direct navigation for avatar presses                  | Removed deferred pattern; profile is modal overlay                      |
| 15.3  | Context + refs pattern for callbacks                  | Store callbacks in refs to avoid re-renders when callbacks change       |
| 15.3  | transparentModal for PhotoDetail                      | Keeps previous screen visible underneath, enables proper modal stacking |
| 15.3  | PhotoDetailProvider wraps entire app                  | Context available throughout navigation hierarchy for photo detail      |
| 15.4  | useRef for storiesCurrentIndex (not useState)         | Refs read at call-time, fixing closure capture in callbacks             |
| 15.4  | updatePhotoAtIndex context method for reactions       | Updates context state so PhotoDetailScreen re-renders with new data     |
| 16    | Pure black (#000000) for all backgrounds              | True black for consistent dark theme, eliminates near-black variations  |
| 16    | #111111 for cards (barely visible lift)               | Very subtle separation from pure black creates content hierarchy        |
| 16    | Icons stay white/gray (not purple)                    | Purple reserved for interactive elements and highlights only            |
| 16    | border.subtle updated to #222222                      | Subtler on pure black than previous #333333                             |
| 17    | Flat thread structure for reply-to-reply              | All replies use original thread's parentId for visual flatness          |
| 17    | mentionedCommentId tracks specific reply target       | Enables scroll-to and @mention highlighting in Plan 02                  |
| 17    | Reply button shown on all comments                    | Changed from isTopLevel to onReply callback presence                    |
| 17    | initialMention flows through component hierarchy      | useComments → CommentsBottomSheet → CommentInput for auto @mention      |

### Deferred Issues

- ISS-001: Optimize photo capture for full-screen display
- ISS-004: Comments sheet closes when navigating to profile (suggested: Phase 16)
- ISS-005: Swipe up on photo to open comments (suggested: Phase 16)

**Closed (2026-02-03):** ISS-002, ISS-003, ISS-006, ISS-007, ISS-008

### Blockers/Concerns

None yet.

### Roadmap Evolution

- Phase 3.1 inserted after Phase 3: Auth Input Field Fixes (URGENT)
  - Phone number field backspace gets stuck on parenthesis after 3 digits
  - Profile setup inputs show auto-filled letters instead of just placeholder hints
- Phase 10 added: Empty Feed State Change UI Change
  - UI improvements for empty feed state transitions
- Phase 11 added: Feed Reaction Emoji Enhancements
  - Randomized emoji selection per photo (iOS emojis only)
  - Custom emoji picker with "Add your own" button at end of reaction picker
- Phase 12 added: Own Snaps in Stories Bar
  - User's journaled snaps persist on left of stories bar
  - Can comment but not react to own photos
- Phase 4.1 inserted after Phase 4: Drag-Reorder Visual Feedback (URGENT)
  - Thumbnails slide into position during drag operations
  - Visual feedback shows drop target, space collapses when moving away
- Phase 13 added: Split Activity into Notifications & Friends
  - Heart icon → notifications screen
  - New friend icon on header left → friends list screen
- Phase 14 added: Profile Field Character Limits
  - Display name: max 16 characters
  - Username: max 16 characters
  - Bio: max 160 characters
- Phase 15 added: Friends Screen & Other Profiles
  - Friends screen refactor
  - Wire up ability to view other peoples profile
- Phase 7.1 removed: Full Song Music Integration
  - Research showed Spotify cannot stream in third-party mobile apps (SDK deprecated 2022)
  - Keeping iTunes 30s previews as the approach
- Phase 7.2 inserted after Phase 7: Song Modal Stacking Fix (UAT-007)
  - Convert SongSearchModal to screen for stacked navigation
  - ClipSelectionModal overlays SongSearchScreen instead of replacing it
  - Connected flow where user sees both modal layers
- Phase 7.3 inserted after Phase 7: Simplify Clip Selection Modal (URGENT)
  - Original plan: Remove waveform scrubber entirely
  - User preference: Keep waveform visualization with drag-to-seek
  - Removed dual range handles, simplified to single-point seeking
  - Tap or drag to scrub through 30-second preview
- Phase 8.1 inserted after Phase 8: Grid Header Safe Area Fix (URGENT)
  - Album grid view and photo picker header gets cut off when scrolling up
  - Photos visible behind notch/status bar area
  - Header background should extend to cover safe area with black
- Phase 16 added: Color Constants Standardization
  - Standardize all colors to use constants, eliminate hardcoded values
  - One consistent background color (black for dark theme)
  - Documentation for adding new screens/modals
  - Enable future theme/palette switching
- Phase 8.2 inserted after Phase 8.1: Album Creation Animation (URGENT)
  - No visual feedback when new album is created
  - User navigated to profile but must look for the new album
  - Add scroll-to and highlight animation for new album card
- Phase 17 added: Nested Reply Comments
  - Reply to replies with @mention tagging (Instagram-style)
  - All replies stay inline, no nested threading
  - @mention at front of comment when replying to a reply
- Phase 18 added: Content Visibility Duration
  - Define how long stories stay visible in stories bar
  - Define how long feed pictures remain visible in feed tab
  - Clarify visibility rules for friends' content
- Phase 19 added: Delete Account Fallback
  - Ensure delete account function works properly
  - Proper fallback handling for errors and edge cases
- Phase 20 added: Friend Suggestions via Contacts Sync
  - Suggest friends based on synced phone contacts
  - Permissions handling and contact matching
- Phase 21 added: Remove/Block Friends
  - Add ability to remove or block friends
- Phase 22 added: Ability to Edit Profile
  - Edit profile screen for updating display name, username, bio, profile photo, and profile song
- Phase 23 added: Photo Deletion & Archiving
  - Delete photos permanently or archive/remove from journal
  - Access archived photos from profile or settings
  - Cascade handling for albums, selects, reactions, comments
- Phase 24 added: Social Media Feature Audit
  - Full audit to ensure all expected social media app features are present
  - Identify gaps compared to standard social media functionality
- Phase 15.1 inserted after Phase 15: Profile Setup Cancel Flow (URGENT)
  - Allow users to cancel profile setup and return to phone number input
  - Show confirmation dialog before canceling
  - Delete partial profile data from database on cancel
- Phase 15.2 inserted after Phase 15.1: Modal State Preservation
  - Return to story/comment modal after viewing profile instead of feed
  - Preserve modal state during profile navigation
  - Source: Enhancement from 15-03 UAT testing
- Phase 15.3 inserted after Phase 15.2: Modal Architecture Fix (ISS-002, ISS-003)
  - Fix comment avatar profile navigation (ISS-002)
  - Convert PhotoDetailModal from Modal component to navigation screen
  - Keep underlying interfaces visible when navigating to profiles
  - Research: Instagram/TikTok use transparentModal or navigation screens
- Phase 15.4 inserted after Phase 15.3: Story Viewed State Fix (URGENT)
  - Story viewed tracking broken by 15.3 navigation changes
  - Feed screen not updating to reflect viewed stories
  - Regression from PhotoDetailScreen/navigation architecture changes

## Session Continuity

Last session: 2026-02-03
Stopped at: Completed 17-01-PLAN.md - Reply infrastructure done
Resume file: None
