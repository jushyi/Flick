---
phase: 1-auth-shared-components
plan: 01
type: execute
---

<objective>
Create dark theme foundation with updated Button, Input, and new AuthCodeInput components for all auth screens.

Purpose: Establish consistent dark theme components that carry the Lapse identity from the first screen.
Output: Updated Button and Input components with dark variants, new AuthCodeInput component for verification codes.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/1-auth-shared-components/1-CONTEXT.md

**Codebase Context:**
@.planning/codebase/CONVENTIONS.md
@.planning/codebase/STRUCTURE.md

**Existing Components (to update):**
@src/components/Button.js
@src/components/Input.js

**Constants (use these):**
@src/constants/colors.js
@src/constants/typography.js
@src/constants/spacing.js

**Reference Screens (for dark theme patterns):**
@src/screens/PhoneInputScreen.js
@src/screens/VerificationScreen.js

**Tech stack available:** React Native, Expo, existing constants (colors, typography, spacing)
**Established patterns:** Component files with StyleSheet, camelCase functions, default exports

**Design Direction from CONTEXT.md:**

- Match Camera/Feed/Darkroom dark aesthetic
- Phone input: Large, centered, hero
- Verification code: Individual boxes with auto-advance, iOS autofill compatible
  </context>

<tasks>

<task type="auto">
  <name>Task 1: Update Button component with dark theme variants</name>
  <files>src/components/Button.js</files>
  <action>
Update Button.js to use colors.js constants instead of hardcoded hex values. Add new variants for dark theme auth:

1. Import colors from '../constants/colors'
2. Replace hardcoded colors:
   - Primary button: `colors.background.secondary` background, `colors.text.primary` text (inverted for dark theme CTA)
   - Secondary button: `colors.background.tertiary` background, `colors.text.primary` text
   - Outline button: transparent background, `colors.border.subtle` border, `colors.text.primary` text
   - Danger button: `colors.status.danger` background, `colors.text.primary` text
   - Disabled: Apply 0.5 opacity to all variants
3. ActivityIndicator color should be `colors.text.primary` for dark variants

Keep backward compatibility - existing screens using Button should still work (dark theme is now the default).
</action>
<verify>Button component renders correctly in PhoneInputScreen with dark theme styling. Visual inspection shows consistent dark aesthetic.</verify>
<done>Button uses colors.js constants, primary/secondary/outline/danger variants work on dark backgrounds, ActivityIndicator visible on loading state.</done>
</task>

<task type="auto">
  <name>Task 2: Update Input component with dark theme styling</name>
  <files>src/components/Input.js</files>
  <action>
Update Input.js to use colors.js constants for dark theme:

1. Import colors from '../constants/colors'
2. Replace hardcoded colors:
   - Container background: `colors.background.secondary`
   - Text color: `colors.text.primary`
   - Placeholder color: `colors.text.tertiary`
   - Border color: `colors.border.subtle`
   - Error border: `colors.status.danger`
   - Error text: `colors.status.danger`
   - Label color: `colors.text.primary`
3. Input height remains 52 (standard touch target)
4. Border radius remains 8

Keep existing functionality (label, error, password toggle). Component should look cohesive with dark theme.
</action>
<verify>Input component renders correctly in PhoneInputScreen with dark theme styling. Text input is readable on dark background, error states visible.</verify>
<done>Input uses colors.js constants, text readable on dark background, error styling visible, password toggle icon visible.</done>
</task>

<task type="auto">
  <name>Task 3: Create AuthCodeInput component for verification codes</name>
  <files>src/components/AuthCodeInput.js, src/components/index.js</files>
  <action>
Create new AuthCodeInput component for 6-digit verification code entry:

**Component Requirements:**

1. Display 6 individual digit boxes (not one long input)
2. Each box: 48x56px, border radius 12, `colors.background.secondary` background, `colors.border.subtle` border
3. Active box (current focus): `colors.text.primary` border (white border on active)
4. Digit text: 24px, semibold, `colors.text.primary`, centered
5. Spacing between boxes: 8px

**Behavior:**

1. Single hidden TextInput captures all input (keyboardType="number-pad", textContentType="oneTimeCode", autoComplete="sms-otp")
2. Auto-advance: As digits are entered, visual focus moves to next box
3. Backspace: Deletes current digit and moves focus back
4. Auto-submit: Call onComplete(code) when 6 digits entered
5. iOS autofill: textContentType="oneTimeCode" enables SMS autofill

**Props:**

- value: string (current code, max 6 chars)
- onChange: (code: string) => void
- onComplete: (code: string) => void (called when 6 digits)
- error: boolean (shows error styling on all boxes)
- disabled: boolean
- autoFocus: boolean

**Error State:**

- All boxes get `colors.status.danger` border when error=true

**Implementation Pattern:**

- Use useRef for hidden TextInput
- Render 6 View boxes with conditional styling based on index and value.length
- Hidden TextInput positioned absolutely, transparent

Export from src/components/index.js.
</action>
<verify>

1. Component renders 6 separate digit boxes
2. Typing fills boxes left to right with visual focus moving
3. SMS autofill works on iOS (textContentType="oneTimeCode")
4. Backspace clears and moves focus back
5. onComplete fires when 6 digits entered
6. Error state shows red borders
   </verify>
   <done>AuthCodeInput component created with 6 digit boxes, auto-advance behavior, iOS autofill support, error state styling, exported from components/index.js.</done>
   </task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Button component uses colors.js constants, renders correctly on dark background
- [ ] Input component uses colors.js constants, text readable on dark background
- [ ] AuthCodeInput renders 6 individual boxes with proper styling
- [ ] AuthCodeInput supports iOS SMS autofill (textContentType="oneTimeCode")
- [ ] All components exported from src/components/index.js
- [ ] No TypeScript/ESLint errors
- [ ] npm run lint passes (or npm run lint:fix applied)
</verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- Components use established colors.js constants
- AuthCodeInput enables iOS SMS autofill
- Dark theme is consistent across all auth components
  </success_criteria>

<output>
After completion, create `.planning/phases/1-auth-shared-components/1-01-SUMMARY.md`:

# Phase 1 Plan 01: Auth Shared Components Summary

**[One-liner: what shipped]**

## Accomplishments

- [Key outcome 1]
- [Key outcome 2]

## Files Created/Modified

- `path/to/file.js` - Description

## Decisions Made

[Key decisions and rationale, or "None"]

## Issues Encountered

[Problems and resolutions, or "None"]

## Next Step

Phase 1 complete, ready for Phase 2 (Login Screen Refactor)
</output>
