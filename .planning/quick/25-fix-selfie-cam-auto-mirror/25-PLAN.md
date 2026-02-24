---
phase: quick
plan: 25
type: execute
wave: 1
depends_on: []
files_modified:
  - src/hooks/useCameraBase.js
autonomous: true
requirements: []
must_haves:
  truths:
    - 'Photos taken with the front-facing camera are NOT mirrored/flipped'
    - 'Photos taken with the back camera remain unchanged (no regression)'
    - 'Snap mode photos from front camera are also not mirrored'
  artifacts:
    - path: 'src/hooks/useCameraBase.js'
      provides: 'Camera capture logic with correct front camera orientation'
      contains: 'skipProcessing'
  key_links:
    - from: 'src/hooks/useCameraBase.js'
      to: 'expo-camera CameraView.takePictureAsync'
      via: 'cameraRef.current.takePictureAsync options'
      pattern: 'takePictureAsync'
---

<objective>
Fix selfie camera auto-mirror: photos captured with the front-facing camera should NOT be horizontally flipped/mirrored.

Purpose: Currently, `takePictureAsync` is called with `skipProcessing: true`, which bypasses expo-camera's image processing pipeline. This means the raw sensor data is saved as-is. On the front camera, the preview layer mirrors the image (standard behavior), but the sensor data is the "true" un-mirrored perspective. When `skipProcessing: true` skips orientation correction, the saved photo can appear flipped relative to the real world. Removing `skipProcessing: true` lets expo-camera properly process the captured image — applying correct orientation and scaling it to match the preview — so selfie photos come out with the correct orientation.

Output: Updated `useCameraBase.js` with correct `takePictureAsync` options.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/hooks/useCameraBase.js
@src/screens/CameraScreen.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove skipProcessing flag from takePictureAsync</name>
  <files>src/hooks/useCameraBase.js</files>
  <action>
In `src/hooks/useCameraBase.js`, in the `takePicture` callback (around line 224), change the `takePictureAsync` call from:

```js
const photo = await cameraRef.current.takePictureAsync({
  quality: 0.8,
  skipProcessing: true,
});
```

to:

```js
const photo = await cameraRef.current.takePictureAsync({
  quality: 0.8,
});
```

Remove the `skipProcessing: true` option entirely. This allows expo-camera to process the captured image normally:

- Rotates the photo to match the device orientation
- Scales it to match the preview dimensions
- Ensures the front camera output is oriented correctly (not mirrored/flipped)

Do NOT add `mirror: true` to the CameraView component or the takePictureAsync options. The default `mirror: false` is correct — the captured photo should reflect reality (not the mirrored preview).

Note: Removing `skipProcessing` may add a small processing delay (~50-200ms) to photo capture. This is acceptable because:

1. The flash effect animation already provides visual feedback during this time
2. Correct photo orientation is more important than shaving milliseconds off capture
3. Both snap mode and normal mode benefit from proper image processing
   </action>
   <verify>
   <automated>cd "C:/Users/maser/Lapse Clone" && node -e "const fs=require('fs'); const c=fs.readFileSync('src/hooks/useCameraBase.js','utf8'); if(c.includes('skipProcessing')){console.error('FAIL: skipProcessing still present');process.exit(1)} if(!c.includes('takePictureAsync')){console.error('FAIL: takePictureAsync call missing');process.exit(1)} if(!c.includes('quality: 0.8')){console.error('FAIL: quality option missing');process.exit(1)} console.log('PASS: skipProcessing removed, takePictureAsync with quality preserved')"</automated>
   <manual>Take a selfie with the front camera. The captured photo should NOT be mirrored/flipped — text in the background should read correctly (not reversed). Also take a photo with the back camera to verify no regression.</manual>
   </verify>
   <done>The `skipProcessing: true` flag is removed from `takePictureAsync`. Front camera photos are no longer mirrored/flipped. Back camera photos continue to work correctly.</done>
   </task>

</tasks>

<verification>
1. Automated: Verify `skipProcessing` is no longer present in `useCameraBase.js`
2. Manual: Take a selfie — text in the background should read left-to-right (not mirrored)
3. Manual: Take a photo with the back camera — should look normal (no regression)
4. Manual: Take a snap (DM camera mode) with front camera — should also not be mirrored
</verification>

<success_criteria>

- Front camera photos are correctly oriented and not mirrored
- Back camera photos continue to work as before
- Both normal mode and snap mode produce correctly oriented photos
- No `skipProcessing` flag remains in the codebase camera capture logic
  </success_criteria>

<output>
After completion, create `.planning/quick/25-fix-selfie-cam-auto-mirror/25-SUMMARY.md`
</output>
