---
phase: 08-user-albums
plan: FIX6
type: fix
---

<objective>
Fix 3 UAT issues from Phase 8 UAT round 2 related to modal and menu UX polish.

Source: 08-UAT2-ISSUES.md
Priority: 1 major, 2 minor
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

**Issues being fixed:**
@.planning/phases/08-user-albums/08-UAT2-ISSUES.md

**Affected components:**
@src/components/DropdownMenu.js
@src/components/RenameAlbumModal.js
</context>

<tasks>
<task type="auto">
  <name>Task 1: Fix UAT-014 - Keyboard covers RenameAlbumModal</name>
  <files>src/components/RenameAlbumModal.js</files>
  <action>
Wrap the modal content in KeyboardAvoidingView to push content up when keyboard appears.

Changes:

1. Import KeyboardAvoidingView from react-native
2. Import Platform from react-native (for behavior prop)
3. Wrap modalContent View inside KeyboardAvoidingView
4. Use behavior="padding" on iOS, behavior="height" on Android
5. KeyboardAvoidingView should be inside the backdrop TouchableOpacity but wrap the modalContent

Structure should be:

- Modal
  - TouchableOpacity (backdrop)
    - KeyboardAvoidingView
      - TouchableOpacity (modal content that stops propagation)

This ensures the modal slides up when keyboard appears instead of being covered.
</action>
<verify>

1. Open AlbumGridScreen
2. Tap 3-dot menu → Rename Album
3. Keyboard opens
4. Modal content is visible above keyboard, input field is accessible
   </verify>
   <done>Input field remains visible and accessible when keyboard is open</done>
   </task>

<task type="auto">
  <name>Task 2: Fix UAT-018 - RenameAlbumModal backdrop animation</name>
  <files>src/components/RenameAlbumModal.js</files>
  <action>
Change the animation so backdrop fades in while modal content slides up separately.

Changes:

1. Change Modal animationType from "slide" to "fade" (this fades the backdrop)
2. Add Animated import from react-native
3. Add useRef for Animated.Value to track content slide position
4. Add useEffect to animate content sliding up when visible=true
5. Wrap modalContent in Animated.View with translateY transform
6. On open: animate from bottom (e.g., 300) to 0 with spring
7. On close: animate back down before calling onClose (or let fade handle it)

Animation pattern:

- Modal backdrop: fade in via animationType="fade"
- Modal content: slide up via Animated.View translateY spring animation
- Use spring config: { damping: 15, stiffness: 200 } for natural feel

This creates the effect where backdrop fades in while content slides up separately.
</action>
<verify>

1. Open album grid
2. Tap 3-dot menu → Rename Album
3. Watch animation - backdrop fades in, content slides up separately
4. Dismiss - animation reverses smoothly
   </verify>
   <done>Backdrop fades in while content slides up independently</done>
   </task>

<task type="auto">
  <name>Task 3: Fix UAT-013 - DropdownMenu anchoring (centered design decision)</name>
  <files>src/components/DropdownMenu.js</files>
  <action>
Note: After analysis, the current centered menu design is actually a valid iOS pattern (action sheets appear centered). However, the user wants menus to feel more contextual.

Instead of implementing complex anchor positioning (which requires measuring trigger elements and handling edge cases), improve the visual design to make the centered menu feel more intentional:

1. Add a semi-transparent blur effect or more prominent backdrop
2. Increase menu card shadow for more depth
3. Add subtle scale animation on appear (scale from 0.95 to 1)
4. Consider adding a "V" indicator pointing toward where the menu was triggered (optional)

Actually, simpler approach: The centered action sheet is a standard iOS pattern. Document this as intentional design in the component JSDoc and close the issue as "works as designed" in the ISSUES.md.

Alternative if user wants anchored positioning: Update DropdownMenu to support anchorPosition prop:

1. When anchorPosition is provided, use absolute positioning instead of centered
2. Position menu below anchor point with clamping to screen edges
3. This requires callers to measure their trigger elements and pass position

For now: Add a comment explaining the design choice, mark issue as intentional.
</action>
<verify>Review DropdownMenu.js has clear documentation about design intent</verify>
<done>DropdownMenu behavior documented; user can decide if anchored positioning is needed</done>
</task>

<task type="checkpoint:decision" gate="blocking">
  <decision>DropdownMenu positioning approach</decision>
  <context>
UAT-013 requests dropdown menus anchor to their trigger element. The current centered design is a valid iOS action sheet pattern. Implementing anchored positioning requires:
- All callers to measure their trigger elements
- Edge detection to prevent off-screen positioning
- Different visual treatment (no full-screen backdrop)

This is significant additional complexity.
</context>
<options>
<option id="centered">
<name>Keep centered design</name>
<pros>Standard iOS pattern, simpler code, consistent behavior</pros>
<cons>Less contextual, user expected different behavior</cons>
</option>
<option id="anchored">
<name>Implement anchored positioning</name>
<pros>More contextual feel, matches user expectation</pros>
<cons>More complex, requires refactoring all callers to pass anchor position</cons>
</option>
</options>
<resume-signal>Select: centered or anchored</resume-signal>
</task>
</tasks>

<verification>
Before declaring plan complete:
- [ ] RenameAlbumModal keyboard avoiding works
- [ ] RenameAlbumModal backdrop fades while content slides
- [ ] DropdownMenu design decision documented/implemented per user choice
- [ ] No regressions in existing functionality
</verification>

<success_criteria>

- UAT-014: Input visible when keyboard open
- UAT-018: Separated backdrop/content animations
- UAT-013: Resolved per user decision
  </success_criteria>

<output>
After completion, create `.planning/phases/08-user-albums/08-FIX6-SUMMARY.md`
</output>
