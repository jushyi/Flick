---
phase: quick-33
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/SnapPreviewScreen.js
  - src/components/SnapViewer.js
autonomous: true
requirements: [QUICK-33]
must_haves:
  truths:
    - 'Snap preview photo fills the entire Polaroid frame on iOS with no black bars'
    - 'Snap viewer photo fills the entire Polaroid frame on iOS with no black bars'
    - 'Android snap display is unaffected (already works correctly)'
  artifacts:
    - path: 'src/screens/SnapPreviewScreen.js'
      provides: 'Snap preview with cover-fit photo'
      contains: 'contentFit="cover"'
    - path: 'src/components/SnapViewer.js'
      provides: 'Snap viewer with cover-fit photo'
      contains: 'contentFit="cover"'
  key_links:
    - from: 'src/screens/SnapPreviewScreen.js'
      to: 'expo-image Image component'
      via: 'contentFit prop'
      pattern: 'contentFit.*cover'
    - from: 'src/components/SnapViewer.js'
      to: 'expo-image Image component'
      via: 'contentFit prop'
      pattern: 'contentFit.*cover'
---

<objective>
Fix snap photo black bars on iOS by changing contentFit from "contain" to "cover" in both the snap preview screen and snap viewer component.

Purpose: On iOS, camera photos may not exactly match the 4:3 Polaroid frame aspect ratio. Using `contentFit="contain"` causes the image to be letterboxed/pillarboxed with visible black bars on the sides. Switching to `contentFit="cover"` fills the entire frame, cropping minimally at the edges instead of showing gaps.

Output: Both SnapPreviewScreen and SnapViewer display snap photos edge-to-edge within the Polaroid frame on iOS.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/screens/SnapPreviewScreen.js
@src/components/SnapViewer.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Change contentFit to "cover" in SnapPreviewScreen and SnapViewer</name>
  <files>src/screens/SnapPreviewScreen.js, src/components/SnapViewer.js</files>
  <action>
    **SnapPreviewScreen.js:**
    1. Line 205: Change `contentFit="contain"` to `contentFit="cover"` on the Image component that displays the captured snap photo.
    2. In the `photo` style (line 318-320), add `overflow: 'hidden'` to ensure the cover-fit image is clipped to the photo container bounds. This is necessary because unlike SnapViewer's `photoContainer`, the `photo` style in SnapPreviewScreen has no overflow clipping.

    **SnapViewer.js:**
    1. Line 272: Change `contentFit="contain"` to `contentFit="cover"` on the Image component that displays the snap photo.
    2. The `photoContainer` style (line 363-366) already has `overflow: 'hidden'`, so no additional style change is needed here.

    Both changes affect the same visual behavior: the photo fills the 4:3 Polaroid frame completely instead of being letterboxed. The crop is minimal since camera photos are close to 4:3 already. The `overflow: 'hidden'` on the container ensures any excess is clipped cleanly.

  </action>
  <verify>
    <automated>cd "C:/Users/maser/Lapse Clone" && grep -n "contentFit" src/screens/SnapPreviewScreen.js src/components/SnapViewer.js | grep -v "contain"</automated>
    <manual>Take a snap photo on iOS. Verify the photo fills the entire Polaroid frame in both SnapPreviewScreen (before sending) and SnapViewer (when viewing received snap) with no black bars on any side.</manual>
  </verify>
  <done>Both SnapPreviewScreen and SnapViewer use contentFit="cover". Snap photos fill the Polaroid frame edge-to-edge on iOS with no black bars.</done>
</task>

</tasks>

<verification>
- `grep -n "contentFit" src/screens/SnapPreviewScreen.js src/components/SnapViewer.js` shows "cover" in both files, no "contain"
- SnapPreviewScreen photo style includes `overflow: 'hidden'`
- Visual check on iOS: no black bars in snap preview or snap viewer
</verification>

<success_criteria>

- Snap photos fill the entire Polaroid frame on iOS without black bars
- Photos are cropped minimally (cover fit) rather than letterboxed (contain fit)
- No regression on Android snap display
  </success_criteria>

<output>
After completion, create `.planning/quick/33-on-ios-only-the-photo-you-take-for-a-sna/33-SUMMARY.md`
</output>
