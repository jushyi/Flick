---
status: diagnosed
trigger: 'SnapViewer looks bare, photo orientation/aspect ratio issues cross-platform'
created: 2026-02-24T00:00:00Z
updated: 2026-02-24T00:00:00Z
---

## Current Focus

hypothesis: Multiple distinct issues found — opaque background, missing reaction bar, hardcoded 4:3 aspect ratio, EXIF orientation not normalized before upload
test: Code review and cross-referencing sender vs viewer rendering
expecting: Confirm each issue with specific code evidence
next_action: Return diagnosis

## Symptoms

expected: SnapViewer shows Polaroid over transparent/blurred conversation; recipient can react; photos display identically on both platforms
actual: SnapViewer has opaque black background; no reaction bar exists; iOS photos show black bars on Android viewer; sender preview and viewer show different aspect ratios
errors: No runtime errors — visual/UX issues
reproduction: Send snap from iOS to Android (or vice versa), open SnapViewer
started: Since snap feature was built

## Eliminated

(none — direct code evidence found for all issues)

## Evidence

- timestamp: 2026-02-24
  checked: SnapViewer overlay background color
  found: styles.overlay has `backgroundColor: '#000000'` (solid opaque black) — line 272 of SnapViewer.js
  implication: Conversation behind the modal is completely hidden; user wants transparent/semi-transparent background

- timestamp: 2026-02-24
  checked: SnapViewer for any reaction UI
  found: No reaction bar, reaction component, or reaction handler exists in SnapViewer.js — only close button, sender name, Polaroid frame, and caption strip
  implication: Feature is entirely missing; needs to be designed and built

- timestamp: 2026-02-24
  checked: SnapViewer photo dimensions calculation
  found: Lines 69-74 hardcode 4:3 aspect ratio — `photoHeight = photoWidth * (4 / 3)` with fixed container
  implication: All photos forced into 4:3 box regardless of actual camera output aspect ratio

- timestamp: 2026-02-24
  checked: SnapPreviewScreen photo dimensions
  found: Lines 73-75 also hardcode 4:3 — `photoHeight = photoWidth * (4 / 3)` but uses `contentFit="cover"` (line 204)
  implication: Sender sees cropped-to-fill preview; recipient sees `contentFit="contain"` which letterboxes non-4:3 images

- timestamp: 2026-02-24
  checked: expo-camera takePictureAsync output aspect ratio
  found: `takePictureAsync({ quality: 0.8 })` in useCameraBase.js line 226 — no explicit photo size/ratio option. expo-camera outputs photos at the sensor's native aspect ratio which varies by device (typically 4:3 on iOS, but can be 16:9 or other on Android)
  implication: Camera produces device-native ratios; both screens force 4:3 display; mismatch creates letterboxing/cropping inconsistency

- timestamp: 2026-02-24
  checked: Snap compression function (snapService.js lines 66-79)
  found: `ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1080 } }], { compress: 0.7, format: SaveFormat.JPEG })` — resizes to 1080px width, preserves whatever height the source had. No EXIF rotation actions applied.
  implication: On Android, EXIF orientation metadata may not be baked into pixel data. ImageManipulator.manipulateAsync with resize DOES normalize EXIF on most platforms, but behavior is inconsistent. The ProfilePhotoCropScreen.android.js explicitly calls manipulateAsync with empty actions `[]` specifically to bake EXIF rotation — the snap path does not do this deliberately.

- timestamp: 2026-02-24
  checked: Front camera photo handling (useCameraBase.js lines 233-246)
  found: Front camera photos get horizontal flip via ImageManipulator. This re-encodes the image and normalizes EXIF as a side effect. Back camera photos get NO manipulation before being passed to SnapPreviewScreen.
  implication: Back camera photos retain raw EXIF orientation from the sensor. On iOS, the Image component auto-applies EXIF rotation. On Android, behavior depends on the image loading library — expo-image generally handles EXIF, but the uploaded JPEG file may have orientation metadata that some viewers interpret differently.

- timestamp: 2026-02-24
  checked: SnapPreviewScreen contentFit vs SnapViewer contentFit
  found: SnapPreviewScreen uses `contentFit="cover"` (line 204); SnapViewer uses `contentFit="contain"` (line 242)
  implication: Sender sees a cropped photo that fills the frame; recipient sees the full photo with potential letterboxing. This is the primary reason sender and recipient see different presentations.

- timestamp: 2026-02-24
  checked: SnapViewer Modal configuration
  found: `<Modal visible={visible} transparent animationType="fade" statusBarTranslucent>` — the Modal IS set to transparent, but the inner overlay View has solid black background, negating the transparency
  implication: The Modal itself supports transparency; only the overlay style needs to change to make conversation visible behind

## Resolution

root_cause: |
Five distinct issues identified:

1. OPAQUE BACKGROUND: SnapViewer's overlay has `backgroundColor: '#000000'` (solid black). The Modal is set to `transparent` but the inner View is fully opaque, hiding the conversation behind it.

2. MISSING REACTION BAR: No reaction UI exists in SnapViewer. The component only has: close button, sender name label, Polaroid frame with image, and caption strip. There is no mechanism for the recipient to react to a snap.

3. HARDCODED 4:3 ASPECT RATIO: Both SnapPreviewScreen (sender) and SnapViewer (recipient) hardcode `photoHeight = photoWidth * (4 / 3)`. expo-camera outputs photos at the device sensor's native ratio which varies by device (4:3, 16:9, or other). This forces non-4:3 photos into a mismatched container.

4. CONTENTFIT MISMATCH (sender vs recipient): SnapPreviewScreen uses `contentFit="cover"` (crops to fill) while SnapViewer uses `contentFit="contain"` (fits entire image, adds letterboxing). The sender sees a cropped version; the recipient sees the full image with black bars in the unfilled space.

5. NO EXIF NORMALIZATION FOR BACK CAMERA SNAPS: Front camera photos get EXIF baked in as a side effect of the horizontal flip operation. Back camera photos go directly from takePictureAsync -> SnapPreviewScreen -> snapService.compressSnapImage with only a resize. The resize in compressSnapImage likely normalizes EXIF on most paths, but this is not guaranteed (the Android ProfilePhotoCropScreen explicitly normalizes EXIF with an empty-action manipulateAsync call, suggesting the team has encountered this issue before). Cross-platform EXIF interpretation differences may cause rotation mismatches.

fix: (not applied — diagnosis only)
verification: (not applied — diagnosis only)
files_changed: []
