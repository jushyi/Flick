---
phase: quick
plan: 11
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/MessageBubble.js
  - src/components/DMInput.js
autonomous: true
requirements: []
must_haves:
  truths:
    - 'Message bubbles have a blocky, pixelated look matching the 16-bit retro aesthetic'
    - 'User and friend bubbles are visually distinct but both use the retro style'
    - 'GIF messages also use the retro border style'
    - 'DM text input matches the retro bubble style'
  artifacts:
    - path: 'src/components/MessageBubble.js'
      provides: 'Retro-styled message bubbles with low border radius and pixel borders'
    - path: 'src/components/DMInput.js'
      provides: 'Retro-styled input wrapper matching bubble aesthetic'
  key_links:
    - from: 'src/components/MessageBubble.js'
      to: 'src/constants/colors.js'
      via: 'border colors from retro/border palette'
      pattern: "colors\\.border"
---

<objective>
Restyle DM message bubbles and input bar to match the app's 16-bit retro pixel art aesthetic.

Purpose: The current message bubbles use borderRadius: 16 (smooth, rounded, modern iOS-style) which clashes with the rest of the app's blocky pixel art look. Other retro components like PixelToggle use borderRadius: 2 and pixel-sharp borders. The bubbles need to match.

Output: MessageBubble.js and DMInput.js restyled with low border radii and subtle pixel-style borders.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/MessageBubble.js
@src/components/DMInput.js
@src/constants/colors.js
@src/constants/typography.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restyle MessageBubble to retro 16-bit aesthetic</name>
  <files>src/components/MessageBubble.js</files>
  <action>
    Update MessageBubble.js styles to replace the smooth rounded bubble look with a blocky retro pixel-art style:

    1. Change `bubble.borderRadius` from 16 to 4 (blocky, matches retro elements like PixelToggle which uses 2, but slightly larger for readability since bubbles hold text).

    2. Change `bubbleUser.borderBottomRightRadius` from 4 to 1 (sharper tail corner for the sender).

    3. Change `bubbleFriend.borderBottomLeftRadius` from 4 to 1 (sharper tail corner for friend).

    4. Add a subtle 1px border to both bubble types to give them that defined pixel-edge look:
       - `bubbleUser`: add `borderWidth: 1` and `borderColor: 'rgba(0, 212, 255, 0.3)'` (subtle cyan glow edge, matches the electric cyan accent).
       - `bubbleFriend`: add `borderWidth: 1` and `borderColor: colors.border.default` (retro indigo border '#353555').

    5. Change `gifImage.borderRadius` from 12 to 3 (match the blocky retro style for GIF corners inside bubbles).

    6. Change the timestamp `fontFamily` from `typography.fontFamily.readable` (SpaceMono) to `typography.fontFamily.body` (Silkscreen) to use the pixel font for timestamps, reinforcing the retro feel. Keep fontSize at 10.

    Do NOT change: bubble maxWidth, padding values, text font (readable/SpaceMono is correct for message body text readability), colors (the cyan user bubble and tertiary friend bubble colors are correct).

  </action>
  <verify>
    <automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/components/MessageBubble.js --no-error-on-unmatched-pattern 2>&1 | head -20</automated>
    <manual>Open a DM conversation in the app. Message bubbles should look blocky/pixelated with sharp corners and subtle borders instead of smooth rounded pills. Both sent (cyan) and received (dark) bubbles should have the retro style. GIFs should also have sharp corners.</manual>
  </verify>
  <done>Message bubbles use borderRadius 4 (main) and 1 (tail corners), have 1px pixel-style borders, GIF images have borderRadius 3, timestamps use Silkscreen pixel font.</done>
</task>

<task type="auto">
  <name>Task 2: Restyle DMInput wrapper to match retro bubbles</name>
  <files>src/components/DMInput.js</files>
  <action>
    Update DMInput.js styles to make the text input wrapper match the retro bubble aesthetic:

    1. Change `inputWrapper.borderRadius` from 20 to 4 (matches the new bubble borderRadius for visual consistency).

    2. Add a subtle border to the input wrapper: `borderWidth: 1` and `borderColor: colors.border.default` ('#353555' retro indigo border).

    Do NOT change: any padding values, font settings, container background colors, send button styling, GIF button styling, or platform-specific behavior. Only the inputWrapper shape is being updated.

  </action>
  <verify>
    <automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/components/DMInput.js --no-error-on-unmatched-pattern 2>&1 | head -20</automated>
    <manual>Open a DM conversation. The text input bar at the bottom should have a blocky rectangular shape with sharp corners matching the message bubbles above it, instead of the smooth pill shape.</manual>
  </verify>
  <done>DM input wrapper uses borderRadius 4 with a 1px retro indigo border, visually consistent with the restyled message bubbles.</done>
</task>

</tasks>

<verification>
- Open any DM conversation in the app
- Verify sent message bubbles (cyan) have blocky corners with a subtle cyan border glow
- Verify received message bubbles (dark) have blocky corners with a subtle indigo border
- Verify the tail corners (bottom-right for sent, bottom-left for received) are sharper than the other corners
- Verify GIF messages also display with sharp corners
- Verify timestamps below messages use the pixel font (Silkscreen)
- Verify the text input bar at the bottom has matching blocky corners
- Verify message text itself is still readable (SpaceMono font unchanged)
- Test on both iOS and Android if possible
</verification>

<success_criteria>
All DM message bubbles and the input bar use the retro 16-bit blocky style (borderRadius 4, 1px borders) instead of smooth rounded corners, consistent with the app's pixel art aesthetic.
</success_criteria>

<output>
After completion, create `.planning/quick/11-the-message-bubbles-don-t-match-the-16-b/11-SUMMARY.md`
</output>
