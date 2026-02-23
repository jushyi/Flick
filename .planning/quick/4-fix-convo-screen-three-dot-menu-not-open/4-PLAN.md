---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ConversationHeader.js
autonomous: true
requirements: [QUICK-4]
must_haves:
  truths:
    - 'Tapping the three-dot menu in the conversation header opens a DropdownMenu overlay anchored near the button'
    - "The dropdown contains a 'Report User' option with destructive styling"
    - 'Tapping outside the dropdown dismisses it'
    - "Tapping 'Report User' navigates to the ReportUser screen and closes the dropdown"
  artifacts:
    - path: 'src/components/ConversationHeader.js'
      provides: 'DropdownMenu integration replacing Alert.alert'
      contains: 'DropdownMenu'
  key_links:
    - from: 'src/components/ConversationHeader.js'
      to: 'src/components/DropdownMenu.js'
      via: 'import and render'
      pattern: 'DropdownMenu'
---

<objective>
Replace the Alert.alert-based three-dot menu in ConversationHeader with the app's existing DropdownMenu component, matching how FriendCard, ProfileScreen, AlbumGridScreen, and PhotoDetailScreen implement their dropdown menus.

Purpose: The conversation screen's three-dot menu currently fires a native Alert.alert dialog, which is inconsistent with every other dropdown menu in the app. All other screens use the custom DropdownMenu component with anchored positioning.

Output: Updated ConversationHeader.js using DropdownMenu with anchored positioning.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/ConversationHeader.js
@src/components/DropdownMenu.js
@src/components/FriendCard.js (reference pattern for anchored DropdownMenu)
@src/screens/ConversationScreen.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace Alert.alert with anchored DropdownMenu in ConversationHeader</name>
  <files>src/components/ConversationHeader.js</files>
  <action>
Refactor ConversationHeader to use the existing DropdownMenu component instead of Alert.alert, following the exact pattern used in FriendCard.js:

1. Add imports:
   - `import { useState, useRef } from 'react'` (add useState and useRef to existing React import)
   - `import DropdownMenu from './DropdownMenu'`

2. Add state and ref inside the component:
   - `const [menuVisible, setMenuVisible] = useState(false)`
   - `const [menuAnchor, setMenuAnchor] = useState(null)`
   - `const menuButtonRef = useRef(null)`

3. Replace handleMenuPress implementation:
   - Instead of calling Alert.alert, use `menuButtonRef.current?.measureInWindow((x, y, width, height) => { setMenuAnchor({ x, y, width, height }); setMenuVisible(true); })`

4. Add `ref={menuButtonRef}` to the three-dot TouchableOpacity (the one with styles.menuButton).

5. Render the DropdownMenu component after the closing View of contentRow (but still inside the container View), with:
   - `visible={menuVisible}`
   - `onClose={() => setMenuVisible(false)}`
   - `anchorPosition={menuAnchor}`
   - `options` array containing a single option: `{ label: 'Report User', icon: 'flag', destructive: true, onPress: onReportPress }`

6. Keep the useCallback import but remove it from handleMenuPress since it no longer needs Alert.alert's dependency on friendProfile.displayName. Actually, keep useCallback on handleMenuPress for consistency -- its dependency array can just be empty `[]` since measureInWindow + setters are stable.

Do NOT change the component's external API (props). The onReportPress callback is still passed in from ConversationScreen and invoked by DropdownMenu's option.onPress.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/components/ConversationHeader.js --no-error-on-unmatched-pattern</automated>
<manual>Open a conversation in the app, tap the three-dot menu. A styled dropdown should appear anchored near the button with "Report User" in red. Tapping outside should dismiss it. Tapping "Report User" should navigate to the report screen.</manual>
</verify>
<done>The three-dot menu in ConversationHeader opens a DropdownMenu overlay (not an Alert.alert) anchored to the menu button, containing a destructive "Report User" option with a flag icon. Tapping outside dismisses the menu. Behavior matches FriendCard, ProfileScreen, and other dropdown menus in the app.</done>
</task>

</tasks>

<verification>
- ConversationHeader renders DropdownMenu component (not Alert.alert)
- Menu appears anchored near the three-dot button, not centered on screen
- "Report User" option has destructive red text and flag icon
- Tapping backdrop closes the menu
- Tapping "Report User" triggers onReportPress callback and closes menu
- No lint errors
</verification>

<success_criteria>
The conversation screen's three-dot menu is visually and behaviorally consistent with all other dropdown menus in the app, using the shared DropdownMenu component with anchored positioning.
</success_criteria>

<output>
After completion, create `.planning/quick/4-fix-convo-screen-three-dot-menu-not-open/4-SUMMARY.md`
</output>
