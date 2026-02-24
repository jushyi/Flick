---
phase: quick-26
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/CameraScreen.js
  - src/styles/CameraScreen.styles.js
autonomous: true
requirements: [QUICK-26]

must_haves:
  truths:
    - 'Snap camera preview has the same height and rounded-corner shape as the main Camera tab preview'
    - 'Snap camera footer bar is positioned and sized identically to the main Camera tab footer bar'
    - 'Snap camera floating controls (flash, zoom bar, flip) sit at the same position as the main Camera tab'
    - 'Snap camera shows the zoom bar with all zoom levels (0.5x, 1x, 2x, 3x) just like the main Camera tab'
    - 'Snap camera capture button is horizontally centered in the footer, with no darkroom card button or spacer'
    - 'Snap camera still has an X close button overlaid on the camera preview to dismiss'
  artifacts:
    - path: 'src/screens/CameraScreen.js'
      provides: 'Snap mode uses normal camera styles with darkroom hidden and close button overlaid'
    - path: 'src/styles/CameraScreen.styles.js'
      provides: 'Snap-specific footer style that centers capture button without darkroom spacer'
  key_links:
    - from: 'src/screens/CameraScreen.js'
      to: 'src/styles/CameraScreen.styles.js'
      via: 'snap mode conditionals for container and footer styles'
      pattern: 'isSnapMode.*styles'
---

<objective>
Make the snap camera (opened from DM conversations) look and function identically to the main Camera tab, except without the darkroom card button. Currently the snap camera uses a completely different full-screen layout with custom positioning for controls and footer, making it visually inconsistent with the main camera experience.

Purpose: Visual consistency -- users should recognize the same camera interface whether they are taking a regular photo or a snap.
Output: Updated CameraScreen.js and CameraScreen.styles.js where snap mode reuses the normal camera layout.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/screens/CameraScreen.js
@src/styles/CameraScreen.styles.js
@src/hooks/useCameraBase.js
@src/hooks/useCamera.ios.js
@src/constants/layout.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make snap camera use normal camera layout with darkroom hidden</name>
  <files>src/screens/CameraScreen.js, src/styles/CameraScreen.styles.js</files>
  <action>
The snap camera currently uses entirely different styles (snapStyles.floatingControls, snapStyles.footerBar, snapStyles.footerControls, styles.cameraContainerSnap) that position everything differently from the main camera. Fix this so snap mode reuses the normal camera layout:

**In CameraScreen.js:**

1. Camera container: Change line 308 to always use `styles.cameraContainer` (remove the `isSnapMode ? styles.cameraContainerSnap :` ternary). The snap camera should NOT be full-screen; it should have the same calculated CAMERA_HEIGHT with rounded bottom corners as the normal camera.

2. Floating controls: Change line 334 to always use `styles.floatingControls` (remove the `isSnapMode ? snapStyles.floatingControls :` ternary). Flash, zoom bar, and flip camera should sit at the exact same position.

3. Zoom bar: The zoom bar (lines 342-371) is already rendered unconditionally which is correct. The prior decision "Zoom hidden in snap mode" is now superseded by this task which says to match the main camera tab. Keep zoom visible.

4. Footer bar: Change line 380 to always use `styles.footerBar` (remove the `isSnapMode ? snapStyles.footerBar :` ternary).

5. Footer controls: Change line 381 to always use `styles.footerControls` (remove the `isSnapMode ? snapStyles.footerControls :` ternary). BUT the snap footer should center the capture button without the darkroom card button or spacer. The current conditional hiding of DarkroomCardButton (line 383-391) and footerSpacer (line 412) via `!isSnapMode` is already correct -- keep those as-is. However, the `styles.footerControls` uses `flexDirection: 'row'` with `justifyContent: 'space-between'` which works for 3 items (darkroom, capture, spacer) but will left-align a single item. Add a new style `footerControlsSnap` in the styles file that is identical to `footerControls` but uses `justifyContent: 'center'` instead of `'space-between'`. Use `isSnapMode ? styles.footerControlsSnap : styles.footerControls` on line 381.

6. Close button: Keep the existing snap close button overlay (lines 323-331) -- this is the X button at top-left that lets users dismiss the snap camera. Keep `snapStyles.closeButton` as-is since it's an absolute-positioned overlay and doesn't affect the camera layout.

7. Delete the `snapStyles.floatingControls`, `snapStyles.footerBar`, and `snapStyles.footerControls` entries from the `snapStyles` StyleSheet at the bottom of the file. Keep only `snapStyles.closeButton`.

**In CameraScreen.styles.js:**

8. Remove the `cameraContainerSnap` style (lines 46-50) since snap mode now uses `cameraContainer`.

9. Add a new `footerControlsSnap` style after `footerControls`:

```javascript
footerControlsSnap: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  paddingBottom: 20,
  paddingHorizontal: spacing.xxl,
  width: '100%',
},
```

This is identical to `footerControls` except `justifyContent: 'center'` instead of `'space-between'`.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/screens/CameraScreen.js src/styles/CameraScreen.styles.js --no-error-on-unmatched-pattern 2>&1 | head -30</automated>
<manual>Open the app, go to a DM conversation, tap the snap camera icon. Verify: (1) Camera preview has rounded bottom corners and is NOT full-screen -- there is a black footer area below it identical to the main Camera tab. (2) Flash, zoom bar (with all zoom levels), and flip camera buttons float at the same position as on the main Camera tab. (3) Capture button is centered in the footer without darkroom card or spacer. (4) X close button appears at top-left overlaying the camera preview. (5) Compare side-by-side with the main Camera tab to confirm identical layout (minus darkroom button).</manual>
</verify>
<done>Snap camera uses the exact same camera container height, floating controls position, footer position, and zoom bar as the main Camera tab. Only differences: no darkroom card button/spacer (capture button centered), and an X close button overlay at top-left.</done>
</task>

</tasks>

<verification>
- ESLint passes on both modified files
- No references to deleted styles (cameraContainerSnap, snapStyles.floatingControls, snapStyles.footerBar, snapStyles.footerControls) remain
- Snap camera visual layout matches main Camera tab layout when compared side-by-side
</verification>

<success_criteria>

- Snap camera preview container is identical to main camera (same CAMERA_HEIGHT, same border radius)
- Floating controls (flash, zoom, flip) positioned identically to main camera
- Zoom bar visible with all zoom levels in snap mode
- Footer bar positioned and sized identically to main camera
- Capture button centered in footer (no darkroom button or spacer)
- X close button still present at top-left for dismissing snap camera
- No visual regressions on the main Camera tab
  </success_criteria>

<output>
After completion, create `.planning/quick/26-fix-snap-camera-to-match-main-camera-tab/26-SUMMARY.md`
</output>
