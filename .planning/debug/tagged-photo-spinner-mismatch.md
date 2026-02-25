---
status: resolved
trigger: "Investigate why the loading spinner on the Add to feed button in TaggedPhotoBubble doesn't match other spinners in the app"
created: 2026-02-25T00:00:00Z
updated: 2026-02-25T00:00:00Z
---

## Current Focus

hypothesis: TaggedPhotoBubble uses React Native's built-in ActivityIndicator instead of the app's custom PixelSpinner component
test: Compare spinner usage in TaggedPhotoBubble vs rest of codebase
expecting: TaggedPhotoBubble is the outlier using ActivityIndicator where PixelSpinner is standard
next_action: Document root cause and fix

## Symptoms

expected: Loading spinner on "Add to feed" button matches the retro pixel-art aesthetic of all other spinners in the app
actual: The spinner is a standard iOS/Android system spinner (ActivityIndicator) instead of the 16-bit pixel-art PixelSpinner used everywhere else
errors: None (functional, visual mismatch only)
reproduction: Tap "Add to feed" on a tagged photo in DM conversation, observe the loading spinner
started: Since TaggedPhotoBubble was created

## Eliminated

(none needed - root cause identified on first hypothesis)

## Evidence

- timestamp: 2026-02-25T00:00:00Z
  checked: TaggedPhotoBubble.js line 18 and line 126
  found: Imports and uses `ActivityIndicator` from react-native with `size="small" color={TAG_ACCENT}`
  implication: Uses the native system spinner, not the app's custom component

- timestamp: 2026-02-25T00:00:00Z
  checked: PixelSpinner.js and all usages across codebase
  found: PixelSpinner is a custom 16-bit pixel-art SVG spinner used in 30+ locations across the app. It is the standard spinner component.
  implication: PixelSpinner is the established app-wide pattern; ActivityIndicator is the outlier

- timestamp: 2026-02-25T00:00:00Z
  checked: Remaining ActivityIndicator usages in codebase
  found: Only 5 files still use ActivityIndicator (ContributionsScreen, NewMessageScreen, PhotoDetailScreen, SnapPreviewScreen, TaggedPhotoBubble). All other loading states use PixelSpinner.
  implication: TaggedPhotoBubble should use PixelSpinner to match the dominant pattern

## Resolution

root_cause: TaggedPhotoBubble.js imports and renders React Native's built-in `ActivityIndicator` (line 18, line 126) instead of the app's custom `PixelSpinner` component. PixelSpinner is a 16-bit pixel-art SVG spinner that matches the app's retro aesthetic and is used in 30+ other locations. The ActivityIndicator renders a native iOS/Android system spinner which looks visually out of place.
fix: Replace ActivityIndicator import with PixelSpinner import, and swap the JSX on line 126
verification: pending
files_changed:

- src/components/TaggedPhotoBubble.js
