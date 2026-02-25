---
status: diagnosed
phase: 05-photo-tag-integration
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md
started: 2026-02-25T12:00:00Z
updated: 2026-02-25T12:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Tagged Photo DM Card

expected: Tag a friend in a photo. The tagged friend opens the DM conversation with the tagger. A large teal-accented card appears showing a header (e.g., "tagged you in a photo"), a 4:3 photo preview, and an "Add to feed" button.
result: issue
reported: "ok the card should not be teal, it should look similar to how the reply looks but without the darkening. it should show full photo. the add to feed button should be inside the picture at the bottom centered."
severity: major

### 2. Add Tagged Photo to Feed

expected: On the tagged photo DM card, tap "Add to feed". The button shows a loading state, then changes to "Added" (disabled). The photo now appears in your feed immediately (no darkroom wait) with "Photo by @username" attribution below the poster's name.
result: issue
reported: "spinner doesn't match the other spinners. everything else good."
severity: cosmetic

### 3. Tagged Photo Card → PhotoDetail

expected: Tap the photo image on the tagged photo DM card. PhotoDetail opens showing the full photo, "Photo by @username" attribution text, and an "Add to feed" button.
result: issue
reported: "doesn't open anything"
severity: major

### 4. Attribution → Photographer Profile

expected: In the feed or PhotoDetail, tap the "Photo by @username" attribution text on a reshared photo. Navigates to the photographer's profile screen.
result: issue
reported: "wrong type of navigation, it appears behind the photo detail"
severity: major

### 5. Tagged Photo Push Notification

expected: When tagged in a photo, a push notification arrives. Tapping the notification navigates to the DM conversation with the tagger (not the Activity screen).
result: pass

### 6. Add to Feed Idempotency

expected: After already adding a tagged photo to your feed, the "Add to feed" button on the DM card shows "Added" (disabled state). Tapping it again does nothing — no duplicate photo created.
result: pass

## Summary

total: 6
passed: 2
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "Tagged photo DM card uses reply-like styling without darkening, full photo, and Add to feed button inside photo at bottom center"
  status: failed
  reason: "User reported: ok the card should not be teal, it should look similar to how the reply looks but without the darkening. it should show full photo. the add to feed button should be inside the picture at the bottom centered."
  severity: major
  test: 1
  root_cause: "TaggedPhotoBubble.styles.js uses teal accent constants (TAG_ACCENT, TAG_BG, TAG_BORDER) for card border/background/shadow. photoContainer has aspectRatio: 4/3 constraining photo. Add to feed button is in a separate buttonContainer View below the photo instead of overlaid inside it."
  artifacts:
  - path: "src/styles/TaggedPhotoBubble.styles.js"
    issue: "Teal color constants and card styles with colored border/bg; aspectRatio 4/3 on photoContainer; buttonContainer as sibling below photo"
  - path: "src/components/TaggedPhotoBubble.js"
    issue: "Add to feed button JSX is outside photoContainer, needs to be moved inside with absolute positioning"
    missing:
  - "Remove teal accent styling, match MessageBubble bubbleMedia transparent style"
  - "Remove aspectRatio 4/3, use natural photo dimensions or fixed width with auto height"
  - "Move Add to feed button inside photoContainer with position absolute, bottom center"
    debug_session: ".planning/debug/tagged-photo-bubble-styling.md"

- truth: "Add to feed loading spinner matches app-wide spinner style"
  status: failed
  reason: "User reported: spinner doesn't match the other spinners. everything else good."
  severity: cosmetic
  test: 2
  root_cause: "TaggedPhotoBubble.js imported and used ActivityIndicator from react-native instead of the app-wide PixelSpinner component used in 30+ other files."
  artifacts:
  - path: "src/components/TaggedPhotoBubble.js"
    issue: "Used ActivityIndicator instead of PixelSpinner"
    missing:
  - "Replace ActivityIndicator with PixelSpinner import and usage"
    debug_session: ".planning/debug/tagged-photo-spinner-mismatch.md"

- truth: "Tapping tagged photo card in DM opens PhotoDetail with attribution and Add to feed button"
  status: failed
  reason: "User reported: doesn't open anything"
  severity: major
  test: 3
  root_cause: "ConversationScreen navigates to PhotoDetail by passing photo data as route params, but PhotoDetailScreen reads all photo data from PhotoDetailContext (not route params). openPhotoDetail() is never called before navigation, so context is empty. PhotoDetailScreen hits guard (if !currentPhoto return null) and renders nothing behind the transparent modal."
  artifacts:
  - path: "src/screens/ConversationScreen.js"
    issue: "Tagged photo pressHandler navigates without calling openPhotoDetail() first; no import of usePhotoDetailActions"
  - path: "src/screens/PhotoDetailScreen.js"
    issue: "Line 896 returns null when context photo is empty (expected behavior, ConversationScreen must populate context)"
    missing:
  - "Import usePhotoDetailActions in ConversationScreen"
  - "Call openPhotoDetail() with photo data before navigating to PhotoDetail"
    debug_session: ".planning/debug/tagged-photo-tap-no-nav.md"

- truth: "Tapping Photo by @username attribution navigates to photographer profile on top of current screen"
  status: failed
  reason: "User reported: wrong type of navigation, it appears behind the photo detail"
  severity: major
  test: 4
  root_cause: "handlePhotographerPress in PhotoDetailScreen uses navigation.navigate('OtherUserProfile') which has card presentation. PhotoDetail is a transparentModal. Cards render behind transparentModals in React Navigation. Should use contextAvatarPress() which navigates to ProfileFromPhotoDetail (fullScreenModal, renders above transparentModal) — same pattern used by handleAvatarPress and handleCommentAvatarPress."
  artifacts:
  - path: "src/screens/PhotoDetailScreen.js"
    issue: "handlePhotographerPress (line 547-555) navigates to OtherUserProfile (card) instead of using contextAvatarPress for ProfileFromPhotoDetail (fullScreenModal)"
    missing:
  - "Replace navigation.navigate('OtherUserProfile') with contextAvatarPress(photographerId, photographerDisplayName)"
    debug_session: ".planning/debug/attribution-navigates-behind-modal.md"
