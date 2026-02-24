---
phase: quick-31
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/SnapViewer.js
autonomous: true
requirements: [QUICK-31]
must_haves:
  truths:
    - 'Reaction emojis appear inside a single unified bar, not individual circular buttons'
    - 'No sender name visible at the top of the snap viewer'
    - 'X close button remains functional in the top-right corner'
    - "Reaction bar matches the app's retro CRT dark theme"
  artifacts:
    - path: 'src/components/SnapViewer.js'
      provides: 'Unified reaction bar and clean header'
      contains: 'reactionBar'
  key_links:
    - from: 'src/components/SnapViewer.js'
      to: 'colors'
      via: 'import from constants/colors'
      pattern: "colors\\.(background|border|overlay)"
---

<objective>
Fix snap viewer reaction bar and header to match the app's retro 16-bit theme.

Purpose: The current snap viewer has two visual issues: (1) the reaction bar renders each emoji in its own separate circular button instead of a single unified bar, and (2) the sender name is displayed at the top-left and is visible through the semi-transparent overlay, cluttering the view.

Output: Updated SnapViewer.js with a single-bar reaction row and header showing only the X close button.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/SnapViewer.js
@src/constants/colors.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove sender name and restyle reaction bar as unified themed bar</name>
  <files>src/components/SnapViewer.js</files>
  <action>
Make two changes to SnapViewer.js:

**1. Remove the sender name from the header:**

- Delete the entire `senderName` JSX block (lines 249-251): the `{senderName && (...)}` conditional rendering
- Delete the `senderName` style from the StyleSheet
- Remove `senderName` from the component's destructured props (it can stay in the function signature for backwards compatibility but should not be rendered)

**2. Restyle the reaction bar as a single unified bar:**

- Replace the individual circular `reactionButton` backgrounds with a single container bar
- The `reactionBar` container itself becomes the visible bar: use `backgroundColor: colors.background.tertiary` (#252540), `borderRadius: 24`, `paddingHorizontal: 16`, `paddingVertical: 10`, and `borderWidth: 1` with `borderColor: colors.border.default` (#353555)
- Remove the `backgroundColor` from individual `reactionButton` styles -- each button should be transparent (just the emoji, no circle behind it)
- Remove `borderRadius` and fixed `width`/`height` from `reactionButton` -- use `padding: 6` instead for tap targets
- Keep the `gap: 12` between emoji buttons (reduce from 16 to tighten spacing within the bar)
- Keep `marginTop: 20` on the reaction bar for spacing below the Polaroid
- The result: one dark indigo rounded pill containing all 6 emojis in a row, consistent with the app's `colors.background.tertiary` / `colors.border.default` pattern used elsewhere for pills and controls

**Style values summary:**

```javascript
reactionBar: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 20,
  gap: 12,
  backgroundColor: colors.background.tertiary,
  borderRadius: 24,
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderWidth: 1,
  borderColor: colors.border.default,
},
reactionButton: {
  padding: 6,
  justifyContent: 'center',
  alignItems: 'center',
},
reactionEmoji: {
  fontSize: 22,
},
```

  </action>
  <verify>
    <automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/components/SnapViewer.js --quiet</automated>
    <manual>Open a conversation with a snap, view the snap. Verify: (1) No sender name at the top, only the X button; (2) Reaction emojis are in a single dark indigo rounded bar, not separate circles.</manual>
  </verify>
  <done>Snap viewer shows only X close button at top (no sender name). Reaction emojis appear inside one unified dark-themed bar that matches the app's retro aesthetic. All 6 emojis remain tappable.</done>
</task>

</tasks>

<verification>
- ESLint passes on SnapViewer.js with no errors
- Visual check: sender name is gone from snap viewer header
- Visual check: reaction bar is one unified pill-shaped bar with all emojis inside
- Reaction taps still trigger haptic feedback and send reactions
- Swipe-down dismiss still works
- Android back button still dismisses the viewer
</verification>

<success_criteria>

- No sender name rendered in snap viewer (only X button visible at top)
- All 6 reaction emojis displayed in a single themed bar (colors.background.tertiary background, colors.border.default border, borderRadius: 24)
- Reaction functionality unchanged (haptic + onReaction callback fires)
  </success_criteria>

<output>
After completion, create `.planning/quick/31-fix-snap-viewer-reaction-bar-and-header-/31-SUMMARY.md`
</output>
