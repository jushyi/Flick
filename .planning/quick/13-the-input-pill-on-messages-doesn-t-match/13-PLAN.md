---
phase: quick
plan: 13
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/DMInput.js
autonomous: true
requirements: []
must_haves:
  truths:
    - 'DM input bar looks like it belongs in the same retro 16-bit UI as the message bubbles, buttons, and other pixel-styled components'
    - 'GIF button has a visible retro chip/pill border matching the pixel aesthetic'
    - 'Send button has a retro-styled container instead of being a bare floating icon'
    - 'Container top border is a solid retro line, not a modern hairline'
    - 'Input text field retains the existing retro borderRadius 4 and 1px border from quick-11'
  artifacts:
    - path: 'src/components/DMInput.js'
      provides: 'Retro 16-bit styled DM input bar with pixel borders on all interactive elements'
  key_links:
    - from: 'src/components/DMInput.js'
      to: 'src/constants/colors.js'
      via: 'Uses retro color palette for borders and backgrounds'
      pattern: 'colors.border|colors.pill|colors.interactive|colors.background'
---

<objective>
Restyle the DM input bar to match the app's 16-bit retro pixel art aesthetic.

Purpose: The input bar container and its interactive elements (GIF button, send button) still look modern/generic despite the input text field itself getting retro borders in quick-11. The GIF button is plain floating text, the send button is a bare icon, and the container top border uses a sub-pixel hairline. These elements clash with the blocky, pixel-bordered style used everywhere else (MessageBubble, Button, Input, PixelToggle).

Output: DMInput.js restyled so the entire input bar -- container, GIF button, send button, and disabled state -- all use the retro 16-bit pixel aesthetic with blocky borders, pixel fonts, and consistent colors from the retro palette.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/DMInput.js
@src/constants/colors.js
@src/constants/typography.js
@src/constants/layout.js
@src/components/Button.js (reference for retro button styling patterns)
@src/components/Input.js (reference for retro input styling patterns)
@src/components/MessageBubble.js (reference for retro bubble styling)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restyle DMInput bar to full retro 16-bit aesthetic</name>
  <files>src/components/DMInput.js</files>
  <action>
    Update DMInput.js styles to make the entire input bar match the retro 16-bit pixel art aesthetic. Reference the established retro patterns from Button.js (borderWidth: 2, borderRadius: layout.borderRadius.sm which is 2, Silkscreen font), Input.js (borderWidth: 2, cyan glow on focus, secondary background), and MessageBubble.js (borderRadius: 4, 1px borders).

    Changes to make:

    1. **Container top border** -- Replace `borderTopWidth: StyleSheet.hairlineWidth` with `borderTopWidth: 1`. Hairline borders are a modern iOS pattern; the retro theme uses solid 1px borders everywhere. Keep `borderTopColor: colors.border.default` (retro indigo #353555).

    2. **GIF button** -- Give it a retro chip/pill style instead of plain floating text:
       - Add `backgroundColor: colors.background.tertiary` (#252540)
       - Add `borderWidth: 1`
       - Add `borderColor: colors.border.default` (#353555)
       - Add `borderRadius: 2` (matches layout.borderRadius.sm, the retro standard for small UI elements)
       - Adjust padding to `paddingHorizontal: 10, paddingVertical: 6` for a compact chip look
       - Keep `marginRight: 8`
       - Keep the Silkscreen bold font and secondary text color

    3. **Send button** -- Give it a retro container instead of being a bare floating icon:
       - Add `backgroundColor: colors.background.tertiary` (#252540)
       - Add `borderWidth: 1`
       - Add `borderColor: 'rgba(0, 212, 255, 0.3)'` (subtle cyan glow border, matching the user message bubble border)
       - Add `borderRadius: 2` (retro blocky)
       - Change padding to `padding: 8` (equal padding for a small square-ish button)
       - Keep `marginLeft: 8`

    4. **Disabled state text** -- Change `disabledText` fontFamily from `typography.fontFamily.readable` (SpaceMono) to `typography.fontFamily.body` (Silkscreen) to use the pixel font for UI messages, matching how other status/label text uses Silkscreen throughout the app.

    Do NOT change:
    - The inputWrapper styles (borderRadius: 4, borderWidth: 1, borderColor already correct from quick-11)
    - The textInput styles (SpaceMono readable font is correct for actual message text)
    - Any padding/margin values on the container or inputRow (except as specified above)
    - Platform-specific keyboard behavior
    - Any functional logic (GIF picker, send handler, keyboard listeners)
    - The PixelIcon used for the send button (arrow-up icon and cyan color are correct)

  </action>
  <verify>
    <automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/components/DMInput.js --no-error-on-unmatched-pattern 2>&1 | head -20</automated>
    <manual>Open a DM conversation. The GIF button should appear as a small bordered retro chip (dark background with pixel border). The send button (appears when typing) should have a dark background with a subtle cyan border instead of being a bare icon. The top border of the input area should be a solid line, not a barely-visible hairline. The input text field itself should still have the blocky retro style from quick-11.</manual>
  </verify>
  <done>DMInput bar container uses solid 1px top border, GIF button has a retro chip style with background and pixel border, send button has a retro container with cyan glow border, disabled text uses Silkscreen pixel font. All interactive elements in the input bar now match the 16-bit retro aesthetic used throughout the app.</done>
</task>

</tasks>

<verification>
- Open any DM conversation in the app
- Verify the GIF button appears as a small retro chip with a dark background and visible border (not plain floating text)
- Verify the send button (type something to make it appear) has a dark retro container with subtle cyan border
- Verify the top border of the input area is a solid visible line
- Verify the text input field itself still has the blocky retro style (borderRadius 4, 1px border)
- Verify the disabled state message ("You can no longer message this person") uses the Silkscreen pixel font
- Test on both iOS and Android if possible
</verification>

<success_criteria>
The DM input bar -- container, GIF button, send button, and disabled state -- all use the retro 16-bit pixel aesthetic with blocky borders, pixel fonts, and retro color palette, matching the visual style of MessageBubble, Button, and Input components.
</success_criteria>

<output>
After completion, create `.planning/quick/13-the-input-pill-on-messages-doesn-t-match/13-SUMMARY.md`
</output>
