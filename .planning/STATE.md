# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-26)

**Core value:** All three areas (login/signup flow, profile creation onboarding, profile screen) must be solid and functional — the app's first impression and personal identity depend on it.
**Current focus:** Phase 8 — User Albums Display

## Current Position

Phase: 7.2 of 14 (Song Modal Stacking Fix)
Plan: 1 of 1 + 1 FIX in current phase
Status: Phase complete (with FIX)
Last activity: 2026-01-28 — Completed 07.2-01-FIX.md

Progress: █████████░ 85%

## Performance Metrics

**Velocity:**

- Total plans completed: 25 (including 5 FIX plans)
- Average duration: 12 min
- Total execution time: 308 min

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

**Recent Trend:**

- Last 5 plans: 10 min, 16 min, 8 min, 12 min, 8 min
- Trend: Consistent pace, Phase 7.2 FIX complete (UAT issues resolved)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| Phase | Decision                                              | Rationale                                                              |
| ----- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| 1     | Use colors.js constants throughout components         | Ensures consistency and maintainability for dark theme                 |
| 1     | AuthCodeInput uses hidden TextInput pattern           | Better UX while maintaining keyboard support and iOS autofill          |
| 2     | Use AuthCodeInput's onComplete callback               | Eliminates need for manual auto-submit useEffect                       |
| 2     | Updated branding from LAPSE to REWIND                 | Matches current app identity                                           |
| 3     | Use Ionicons instead of emojis                        | Consistency with other screens using Ionicons                          |
| 3     | Debounce username check at 500ms                      | Balance responsiveness with Firestore query efficiency                 |
| 3     | Require username/display name on skip                 | Essential fields even when skipping optional ones                      |
| 3     | Conditional nav rendering over manual replace         | Navigator branches auto-transition on auth state change                |
| 3     | Store photo URIs directly in selects array            | Simpler MVP; future could upload to Firebase Storage                   |
| 3.1   | Text length comparison for deletion detection         | Catches formatting char deletion, not just digits                      |
| 3.1   | Show raw digits when deleting                         | Prevents cursor trap on parentheses during phone correction            |
| 3.1   | Detect defaults in ProfileSetupScreen                 | Keep AuthContext defaults for DB uniqueness, detect in UI              |
| 4     | Single "Next step" button replaces Complete + Skip    | Cleaner UX, users must complete required fields                        |
| 4     | Step indicator with dots and "Step X of Y" text       | Clear progress indication for multi-screen onboarding                  |
| 4     | Preview tap: multi-select when empty, disabled after  | Users add via thumbnails once photos exist for granular control        |
| 4     | 4:5 aspect ratio for preview area                     | Matches Instagram portrait style                                       |
| 4     | Skip confirmation from Complete button                | Single button, shows alert if no photos selected                       |
| 4     | Tutorial hint shows only with 2+ photos               | Need multiple photos to demonstrate reorder feature                    |
| 4     | AsyncStorage for hint dismissal persistence           | Hint state persists across sessions                                    |
| 4.1   | Animate dragged item to target before array update    | Prevents visual flash by completing animation before React re-render   |
| 4.1   | Use photoId tracking to detect slot content changes   | Allows clean animation reset when photo at slot changes                |
| 4.1   | withTiming callback for post-animation state updates  | Sequences visual animation completion before triggering reorder        |
| 4.1   | LayoutAnimation for array state transitions           | Smooth visual transitions when reordering/deleting photos              |
| 4.1   | photoId as React key instead of index                 | Stable component identity prevents content flash during reorder        |
| 4.1   | withDelay(16ms) + withTiming(200ms) for reset         | Syncs transform reset with LayoutAnimation timing                      |
| 4.1   | Duplicate photo validation in pickers                 | Prevents React key collision from same photo selected twice            |
| 4.1   | Select dragged photo in preview during drag           | User sees which photo they're manipulating                             |
| 5     | Left-align profile info for best friends feature      | Reserve right half of section for future best friends feature          |
| 5     | Profile info in gray card (left half)                 | Visual separation and prepares for split layout                        |
| 5     | Remove edit button from profile                       | Editing via profile photo tap or Settings navigation (future)          |
| 5     | useSafeAreaInsets for header positioning              | Better control than SafeAreaView for absolute positioned headers       |
| 5     | Circular tab thumbnail 28x28 with 2px focused border  | Matches Instagram-style profile icon in tab bar                        |
| 5     | ProfileIcon SVG fallback when no photoURL             | Graceful degradation for users without profile photos                  |
| 5     | isOwnProfile pattern with route params                | Clean conditional rendering for own vs other user views                |
| 5     | Placeholder data for other users (TODO: Firestore)    | Layout scaffolding now, data fetching deferred                         |
| 6     | 150ms threshold for tap vs hold detection             | Quick taps trigger onTap, holds pause cycling                          |
| 6     | Gesture.Exclusive pattern for tap/hold                | LongPress wins if held, Tap wins if quick release                      |
| 6     | GestureHandlerRootView wrapper for gesture components | Required for gesture recognition in component context                  |
| 6     | Copy DraggableThumbnail into SelectsEditOverlay       | Simpler than extracting to shared, avoids breaking existing code       |
| 6     | 750ms cycle interval for slideshow                    | Faster cycling for snappier highlight experience                       |
| 6     | 3:4 aspect ratio for edit overlay preview             | Taller preview with better visual centering                            |
| 6     | useSafeAreaInsets for modal safe area handling        | SafeAreaView edges prop unreliable on first render after app launch    |
| 7     | No debounce in iTunes service                         | UI layer handles debounce for better UX control                        |
| 7     | No caching in iTunes service                          | Simple API calls sufficient for MVP, avoids stale data                 |
| 7     | No background audio mode for profile songs            | Songs should stop when navigating away from profile (desired)          |
| 7     | 300x300 album art from iTunes                         | Higher quality display by replacing 100x100 in API response            |
| 7     | Component manages own audio state (not global)        | Simpler for MVP, component self-contained                              |
| 7     | Empty state uses dashed border pattern                | Consistent with other add prompts in app                               |
| 7     | Glow uses brand purple color                          | Consistency with app accent color                                      |
| 7     | 500ms search debounce in SongSearchModal              | Balance UX responsiveness with API call efficiency                     |
| 7     | WYSIWYG result cards match ProfileSongCard layout     | Users see exactly what their selected song will look like              |
| 7     | Separate tap targets for preview vs selection         | Clear distinction between previewing and selecting a song              |
| 7     | Simulated waveform over native library                | Native waveform library had Metro bundling issues; visual bars work    |
| 7     | Worklet directive + runOnJS for gesture state         | Prevents crash when updating React state from gesture callbacks        |
| 7     | 5-second minimum clip gap                             | Ensures meaningful clip selection, prevents degenerate ranges          |
| 7     | Sequential modal flow for song/clip selection         | iOS React Native doesn't support stacked modals; cancel reopens search |
| 7     | 50ms progress update interval for audio               | 20 updates/sec provides smooth playback indicator animation            |
| 7     | Linear easing with matching animation duration        | Constant speed movement for audio playback (not spring/ease-in-out)    |
| 7     | Immediate audio cut on stop (no fade out)             | User preference for clean cut over gradual fade                        |
| 7     | playsInSilentModeIOS: true for audio                  | Profile songs play through speakers regardless of silent switch        |
| 7     | Alert.alert for edit menu pattern                     | Consistent with other menus in app, simple and reliable                |
| 7     | useFocusEffect for navigation audio cleanup           | Component detects parent screen blur without prop drilling             |
| 7.2   | Screen + Modal overlay pattern                        | iOS doesn't support stacked modals; screen + modal on top works        |
| 7.2   | Cancel always stays on search                         | User can pick different song after previewing current clip             |
| 7.2   | Combined Edit Song menu option                        | Single option opens clip first, cancel goes to search for different    |
| 7.2   | Backdrop fades + content slides animation pattern     | Modal animationType='fade' for backdrop, Animated.spring for content   |

### Deferred Issues

None yet.

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
  - Remove waveform scrubber since iTunes clips are only 30 seconds
  - Replace with simple preview + submit buttons
  - Simplifies UX by removing unnecessary clip trimming

## Session Continuity

Last session: 2026-01-28
Stopped at: Completed 07.2-01-FIX.md - UAT issues resolved (Phase 7.2 fully complete)
Resume file: None
