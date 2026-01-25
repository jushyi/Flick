---
phase: 30-rewind-rebrand
plan: FIX-2
type: fix
---

<objective>
Fix 2 UAT issues from Phase 30 Rewind Rebrand testing.

Source: 30-ISSUES.md
Priority: 0 critical, 1 major, 1 minor

**Issues:**

- UAT-002 (Minor): Animated splash should have black blades on transparent camera background
- UAT-003 (Major): Dark theme not applied to Feed, Profile, Friends, Auth screens
  </objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

**Issues being fixed:**
@.planning/phases/30-rewind-rebrand/30-ISSUES.md

**Relevant files:**
@src/components/AnimatedSplash.js
@src/constants/colors.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update AnimatedSplash for transparent background with black blades</name>
  <files>src/components/AnimatedSplash.js</files>
  <action>
Modify AnimatedSplash.js to:
1. Change APERTURE_COLOR from colors.brand.purple to '#000000' (pure black)
2. Change BACKGROUND_COLOR from colors.background.primary to 'transparent'
3. Update styles.background to use backgroundColor: 'transparent' instead of BACKGROUND_COLOR
4. The blur effect should still work over the transparent background (revealing camera underneath)

This creates the effect of black aperture blades opening to reveal the camera view behind.
</action>
<verify>Visual verification needed - rebuild app and test splash animation</verify>
<done>AnimatedSplash uses black blades with transparent background</done>
</task>

<task type="auto">
  <name>Task 2: Apply dark theme to FeedScreen</name>
  <files>src/screens/FeedScreen.js</files>
  <action>
Update FeedScreen.js to use dark theme:
1. Import colors from '../constants/colors'
2. Update container/background style to use colors.background.primary (#0F0F0F)
3. Update text colors to use colors.text.primary (#FFFFFF) for main text
4. Update any secondary text to use colors.text.secondary (#888888)
5. Ensure any card/list backgrounds use colors.background.secondary (#1A1A1A)
  </action>
  <verify>Visual verification needed - rebuild app and check FeedScreen</verify>
  <done>FeedScreen has dark background and appropriate text colors</done>
</task>

<task type="auto">
  <name>Task 3: Apply dark theme to ProfileScreen</name>
  <files>src/screens/ProfileScreen.js</files>
  <action>
Update ProfileScreen.js to use dark theme:
1. Import colors from '../constants/colors' if not already
2. Update container/background style to use colors.background.primary (#0F0F0F)
3. Update text colors to use colors.text.primary (#FFFFFF) for main text
4. Update any secondary text to use colors.text.secondary (#888888)
5. Update any card/section backgrounds to use colors.background.secondary (#1A1A1A)
  </action>
  <verify>Visual verification needed - rebuild app and check ProfileScreen</verify>
  <done>ProfileScreen has dark background and appropriate text colors</done>
</task>

<task type="auto">
  <name>Task 4: Apply dark theme to FriendsListScreen</name>
  <files>src/screens/FriendsListScreen.js</files>
  <action>
Update FriendsListScreen.js to use dark theme:
1. Import colors from '../constants/colors' if not already
2. Update container/background style to use colors.background.primary (#0F0F0F)
3. Update text colors to use colors.text.primary (#FFFFFF) for main text
4. Update any secondary text to use colors.text.secondary (#888888)
5. Update list item backgrounds to use colors.background.secondary (#1A1A1A) if applicable
  </action>
  <verify>Visual verification needed - rebuild app and check FriendsListScreen</verify>
  <done>FriendsListScreen has dark background and appropriate text colors</done>
</task>

<task type="auto">
  <name>Task 5: Apply dark theme to FriendRequestsScreen</name>
  <files>src/screens/FriendRequestsScreen.js</files>
  <action>
Update FriendRequestsScreen.js to use dark theme:
1. Import colors from '../constants/colors' if not already
2. Update container/background style to use colors.background.primary (#0F0F0F)
3. Update text colors to use colors.text.primary (#FFFFFF) for main text
4. Update tab/segment colors appropriately for dark theme
5. Update list item backgrounds to use colors.background.secondary (#1A1A1A) if applicable
  </action>
  <verify>Visual verification needed - rebuild app and check FriendRequestsScreen</verify>
  <done>FriendRequestsScreen has dark background and appropriate text colors</done>
</task>

<task type="auto">
  <name>Task 6: Apply dark theme to UserSearchScreen</name>
  <files>src/screens/UserSearchScreen.js</files>
  <action>
Update UserSearchScreen.js to use dark theme:
1. Import colors from '../constants/colors' if not already
2. Update container/background style to use colors.background.primary (#0F0F0F)
3. Update search input styling for dark theme (dark background, light text, appropriate placeholder color)
4. Update text colors to use colors.text.primary (#FFFFFF) for main text
5. Update search results list item backgrounds appropriately
  </action>
  <verify>Visual verification needed - rebuild app and check UserSearchScreen</verify>
  <done>UserSearchScreen has dark background and appropriate text colors</done>
</task>

<task type="auto">
  <name>Task 7: Apply dark theme to Auth screens (PhoneInputScreen, VerificationScreen, ProfileSetupScreen)</name>
  <files>src/screens/PhoneInputScreen.js, src/screens/VerificationScreen.js, src/screens/ProfileSetupScreen.js</files>
  <action>
Update all three auth screens to use dark theme:

For PhoneInputScreen.js:

1. Import colors from '../constants/colors' if not already
2. Update container/background to colors.background.primary (#0F0F0F)
3. Update text colors to colors.text.primary (#FFFFFF)
4. Update input fields for dark theme (dark background, light text)
5. Update button styling to use brand colors

For VerificationScreen.js:

1. Same pattern as PhoneInputScreen

For ProfileSetupScreen.js:

1. Same pattern as PhoneInputScreen
2. Update any form inputs, buttons for dark theme consistency
   </action>
   <verify>Visual verification needed - rebuild app and check all auth screens</verify>
   <done>All auth screens have dark backgrounds and appropriate text colors</done>
   </task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Dark theme applied across all screens + transparent splash with black blades</what-built>
  <how-to-verify>
1. Force-close and relaunch the app
2. Verify splash screen has BLACK blades with transparent background (showing camera behind)
3. Navigate to Feed - should have dark background (#0F0F0F)
4. Navigate to Profile - should have dark background
5. Go to Friends list - should have dark background
6. Go to Friend Requests - should have dark background
7. Check User Search - should have dark background
8. Sign out and verify auth screens (Phone Input, Verification) have dark backgrounds
  </how-to-verify>
  <resume-signal>Type "approved" or describe any remaining issues</resume-signal>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] AnimatedSplash has black blades with transparent background
- [ ] FeedScreen has dark theme
- [ ] ProfileScreen has dark theme
- [ ] FriendsListScreen has dark theme
- [ ] FriendRequestsScreen has dark theme
- [ ] UserSearchScreen has dark theme
- [ ] Auth screens (PhoneInputScreen, VerificationScreen, ProfileSetupScreen) have dark theme
- [ ] All screens have consistent text colors (white primary, gray secondary)
</verification>

<success_criteria>

- All UAT issues from 30-ISSUES.md addressed (UAT-002, UAT-003)
- App build succeeds
- Visual consistency across all screens (dark theme throughout)
- Ready for re-verification with /gsd:verify-work
  </success_criteria>

<output>
After completion, create `.planning/phases/30-rewind-rebrand/30-FIX-2-SUMMARY.md`
</output>
