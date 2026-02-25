---
phase: quick-34
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/styles/TaggedPhotoBubble.styles.js
  - src/components/TaggedPhotoBubble.js
  - src/screens/PhotoDetailScreen.js
autonomous: true
requirements: [QUICK-34]
must_haves:
  truths:
    - 'Add to feed button in conversation view is cyan with rectangular shape, centered at bottom of photo'
    - 'Add to feed button in fullscreen PhotoDetail view is cyan with rectangular shape, centered horizontally at bottom area'
    - 'Disabled/already-added state dims correctly on both views'
  artifacts:
    - path: 'src/styles/TaggedPhotoBubble.styles.js'
      provides: 'Cyan rectangular button styling for conversation tagged photo card'
      contains: '#00D4FF'
    - path: 'src/screens/PhotoDetailScreen.js'
      provides: 'Cyan rectangular centered button styling for fullscreen tagged photo view'
      contains: '#00D4FF'
  key_links:
    - from: 'src/components/TaggedPhotoBubble.js'
      to: 'src/styles/TaggedPhotoBubble.styles.js'
      via: 'styles import'
      pattern: "styles\\.addButton"
    - from: 'src/screens/PhotoDetailScreen.js'
      to: 'localStyles'
      via: 'inline StyleSheet'
      pattern: "localStyles\\.addToFeedButton"
---

<objective>
Fix the "Add to feed" button styling on tagged photos in both the conversation bubble view and the fullscreen PhotoDetail modal. The button should be cyan (#00D4FF) with a rectangular shape, centered horizontally at the bottom of the photo/screen area.

Purpose: The current button uses a dark overlay pill style and is misaligned (left-positioned) in the fullscreen view. User wants a distinct, visually prominent cyan rectangular button centered at bottom.
Output: Consistent cyan rectangular "Add to feed" button in both TaggedPhotoBubble and PhotoDetailScreen.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/TaggedPhotoBubble.js
@src/styles/TaggedPhotoBubble.styles.js
@src/screens/PhotoDetailScreen.js
@src/constants/colors.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restyle "Add to feed" button in TaggedPhotoBubble (conversation view)</name>
  <files>src/styles/TaggedPhotoBubble.styles.js, src/components/TaggedPhotoBubble.js</files>
  <action>
Update the button overlay and addButton styles in TaggedPhotoBubble.styles.js:

1. `addButton` style changes:
   - Change `backgroundColor` from `'rgba(0, 0, 0, 0.6)'` to `colors.interactive.primary` (`#00D4FF` electric cyan)
   - Change `borderRadius` from `16` (pill) to `4` (rectangular with slight rounding)
   - Keep `flexDirection: 'row'`, `alignItems: 'center'`, `justifyContent: 'center'`
   - Keep `paddingHorizontal: 12`, `height: 32`, `gap: 4`

2. `addButtonDisabled` style changes:
   - Change `backgroundColor` from `'rgba(0, 0, 0, 0.4)'` to `colors.interactive.primaryPressed` (`#00A3CC` darker cyan) with reduced opacity
   - Set `opacity: 0.6` instead of changing background color alone

3. `addButtonText` style:
   - Change `color` from `colors.text.inverse` to `colors.background.primary` (dark text on cyan button for contrast). If `colors.background.primary` is too dark/light, use `'#0A0A1A'` (the app's dark background) for strong contrast on cyan.

4. `addButtonTextDisabled` style:
   - Change `color` to `colors.background.secondary` for dimmed contrast on disabled cyan

5. In TaggedPhotoBubble.js, update the PixelIcon color for the non-disabled state:
   - Change `color={colors.text.inverse}` to `color={'#0A0A1A'}` (dark icon on cyan) for the `add` icon
   - For `hasAdded` checkmark icon, use a slightly transparent dark: `'rgba(10, 10, 26, 0.5)'`

6. The `buttonOverlay` positioning is already correct (absolute, bottom: 10, left/right: 0, alignItems: center). Keep it as-is.
   </action>
   <verify>
   <automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/styles/TaggedPhotoBubble.styles.js src/components/TaggedPhotoBubble.js --no-error-on-unmatched-pattern 2>&1 | head -20</automated>
   <manual>Open a DM conversation with a tagged photo. The "Add to feed" button should be cyan (#00D4FF), rectangular, centered at the bottom of the photo thumbnail.</manual>
   </verify>
   <done>TaggedPhotoBubble "Add to feed" button renders as a cyan rectangular button centered at the bottom of the photo in conversation view. Disabled state shows dimmed cyan.</done>
   </task>

<task type="auto">
  <name>Task 2: Restyle and center "Add to feed" button in PhotoDetailScreen (fullscreen modal)</name>
  <files>src/screens/PhotoDetailScreen.js</files>
  <action>
Update the localStyles for the "Add to feed" button in PhotoDetailScreen.js:

1. `addToFeedButton` style changes:
   - Remove `left: 22` (was left-aligned, causing misalignment)
   - Add `alignSelf: 'center'` for horizontal centering
   - Change positioning approach: keep `position: 'absolute'`, set `bottom: 150`, add `left: 0`, `right: 0`, `alignItems: 'center'` on a wrapper OR use `left: '50%'` with negative margin. The simplest approach: change the button's container in JSX.

   Better approach for centering an absolutely positioned button:
   - Keep `position: 'absolute'` and `bottom: 150`
   - Remove `left: 22`
   - Add `left: 0`, `right: 0`, and `alignItems: 'center'` to make it full-width then center children. BUT since the TouchableOpacity itself is the absolute element, wrap it in a View or use `alignSelf: 'center'` with `left: 0, right: 0`.

   Cleanest solution: In the JSX (around line 1140-1165), wrap the existing TouchableOpacity in an absolutely positioned View container:

   ```jsx
   {
     showAddToFeedButton && (
       <View
         style={[
           localStyles.addToFeedContainer,
           Platform.OS === 'android' && { bottom: 150 + insets.bottom },
         ]}
       >
         <TouchableOpacity
           style={[
             localStyles.addToFeedButton,
             (hasAddedToFeed || isAddingToFeed) && localStyles.addToFeedButtonDisabled,
           ]}
           onPress={handleAddToFeed}
           disabled={hasAddedToFeed || isAddingToFeed}
           activeOpacity={0.7}
         >
           ...icon and text...
         </TouchableOpacity>
       </View>
     );
   }
   ```

2. Add `addToFeedContainer` to localStyles:

   ```js
   addToFeedContainer: {
     position: 'absolute',
     bottom: 150,
     left: 0,
     right: 0,
     alignItems: 'center',
     zIndex: 10,
   },
   ```

3. Update `addToFeedButton` in localStyles:
   - Remove `position: 'absolute'`, `bottom: 150`, `left: 22`, `zIndex: 10` (moved to container)
   - Change `backgroundColor` from `colors.overlay.dark` to `colors.interactive.primary` (`#00D4FF`)
   - Change `borderRadius` from `20` (pill) to `4` (rectangular)
   - Keep `flexDirection: 'row'`, `alignItems: 'center'`, `gap: 6`
   - Keep `paddingHorizontal: 14`, `paddingVertical: 8`

4. `addToFeedButtonDisabled`:
   - Keep `opacity: 0.5`

5. `addToFeedText`:
   - Change `color` from `colors.text.primary` (white) to `'#0A0A1A'` (dark text on cyan)
   - Keep `fontSize: 12`, `fontFamily: 'Silkscreen_700Bold'`

6. `addToFeedTextDisabled`:
   - Change `color` from `colors.text.tertiary` to `'rgba(10, 10, 26, 0.5)'` (dimmed dark on cyan)

7. Update the PixelIcon inside the addToFeed button (around line 1151):
   - Change the non-disabled color from `colors.text.primary` to `'#0A0A1A'`
   - Change the hasAddedToFeed color from `colors.text.tertiary` to `'rgba(10, 10, 26, 0.5)'`

8. Remove the `Platform.OS === 'android' && { bottom: 150 + insets.bottom }` from the TouchableOpacity and move it to the new container View.
   </action>
   <verify>
   <automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/screens/PhotoDetailScreen.js --no-error-on-unmatched-pattern 2>&1 | head -20</automated>
   <manual>Tap a tagged photo in a DM to open PhotoDetail fullscreen. The "Add to feed" button should be cyan (#00D4FF), rectangular, and centered horizontally at the bottom area of the screen.</manual>
   </verify>
   <done>PhotoDetailScreen "Add to feed" button is cyan rectangular and horizontally centered. Works correctly on both iOS and Android (with safe area inset adjustment). Disabled state shows dimmed cyan.</done>
   </task>

</tasks>

<verification>
- Both buttons use `colors.interactive.primary` (#00D4FF) as background color
- Both buttons use `borderRadius: 4` for rectangular shape
- Both buttons are centered horizontally at bottom
- Both buttons have dark text/icon on cyan background for contrast
- Disabled states dim correctly
- No lint errors in modified files
</verification>

<success_criteria>

1. TaggedPhotoBubble in conversation: cyan rectangular "Add to feed" button centered at bottom of photo thumbnail
2. PhotoDetailScreen fullscreen: cyan rectangular "Add to feed" button centered horizontally at bottom area
3. Both states (active + disabled/already-added) render correctly with appropriate contrast
4. Works on both iOS and Android
   </success_criteria>

<output>
After completion, create `.planning/quick/34-fix-tagged-photo-add-to-feed-button-styl/34-SUMMARY.md`
</output>
