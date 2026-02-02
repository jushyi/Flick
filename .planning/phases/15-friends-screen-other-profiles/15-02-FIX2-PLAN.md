---
phase: 15-friends-screen-other-profiles
plan: 02-FIX2
type: fix
---

<objective>
Fix 3 UAT issues from plan 15-02-FIX related to album navigation and read-only viewing on other user profiles.

Source: 15-02-FIX-ISSUES.md
Priority: 0 critical, 3 major, 0 minor
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

**Issues being fixed:**
@.planning/phases/15-friends-screen-other-profiles/15-02-FIX-ISSUES.md

**Original plan for reference:**
@.planning/phases/15-friends-screen-other-profiles/15-02-FIX-PLAN.md

**Key files:**
@src/navigation/AppNavigator.js
@src/screens/ProfileScreen.js
@src/screens/AlbumGridScreen.js
@src/screens/MonthlyAlbumGridScreen.js
</context>

<tasks>
<task type="auto">
  <name>Fix UAT-001 & UAT-002: Add AlbumGrid and MonthlyAlbumGrid to root stack</name>
  <files>src/navigation/AppNavigator.js</files>
  <action>
Add AlbumGrid and MonthlyAlbumGrid screens to the root stack navigator (alongside OtherUserProfile) so they're accessible when viewing other users' profiles.

In the "Main App" section of AppNavigator.js (after OtherUserProfile screen), add:

1. AlbumGrid screen with same options as OtherUserProfile (presentation: 'card', animation: 'slide_from_right')
2. MonthlyAlbumGrid screen with same options

The screens are already imported at the top of the file.
This makes these routes accessible from any context in the main app, including when navigating from OtherUserProfile.
</action>
<verify>No more navigation errors when tapping albums from friend's profile. Run the app and verify navigation works from OtherUserProfile context.</verify>
<done>AlbumGrid and MonthlyAlbumGrid accessible from root stack, navigation from OtherUserProfile works without errors</done>
</task>

<task type="auto">
  <name>Fix UAT-003: Make album views read-only for other users</name>
  <files>src/screens/AlbumGridScreen.js, src/screens/MonthlyAlbumGridScreen.js</files>
  <action>
Update AlbumGridScreen and MonthlyAlbumGridScreen to respect the isOwnProfile parameter and hide edit/delete options when viewing other users' albums.

For AlbumGridScreen:

1. Check if isOwnProfile is passed (defaults to true for backwards compatibility)
2. If isOwnProfile is false:
   - Hide the edit/delete menu button in header
   - Disable "Set as cover" functionality
   - Disable "Remove from album" functionality
   - Hide "Add photos" button if present

For MonthlyAlbumGridScreen:

1. The screen should already pass isOwnProfile to AlbumPhotoViewer (check this exists)
2. Ensure header doesn't show edit options for non-owners
3. Verify photo viewer respects read-only mode

The isOwnProfile param is already being passed from ProfileScreen.js (line 429, 475, 497).
</action>
<verify>When viewing friend's album/monthly album, no edit/delete/set-cover options appear. Only viewing is possible.</verify>
<done>Album views are read-only for non-owners, edit/delete options hidden when isOwnProfile=false</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
  - AlbumGrid and MonthlyAlbumGrid screens accessible from root stack
  - Album views are read-only when viewing other users' content
  </what-built>
  <how-to-verify>
1. Start the app: `npx react-native start` then run on iOS/Android
2. Navigate to Friends screen
3. Tap on a friend who has albums
4. Verify profile opens as modal
5. Tap on any album card - should navigate to AlbumGrid without errors
6. Verify NO edit/delete options appear (no menu button, no "set as cover", no "remove" options)
7. Go back and tap on a monthly album card - should navigate without errors
8. Verify NO edit options appear in monthly album view either
9. Photos should be viewable but not editable
  </how-to-verify>
  <resume-signal>Type "approved" if all navigation works and views are read-only, or describe issues</resume-signal>
</task>
</tasks>

<verification>
Before declaring plan complete:
- [ ] AlbumGrid screen added to root stack
- [ ] MonthlyAlbumGrid screen added to root stack
- [ ] No navigation errors when tapping albums from friend's profile
- [ ] AlbumGridScreen hides edit options when isOwnProfile=false
- [ ] MonthlyAlbumGridScreen hides edit options when isOwnProfile=false
- [ ] Photo viewer respects read-only mode for other users
</verification>

<success_criteria>

- All 3 UAT issues from 15-02-FIX-ISSUES.md addressed
- Navigation works from OtherUserProfile to album views
- Album views are read-only for non-owners
- Ready for re-verification
  </success_criteria>

<output>
After completion, create `.planning/phases/15-friends-screen-other-profiles/15-02-FIX2-SUMMARY.md`
</output>
