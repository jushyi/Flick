---
phase: quick-33
plan: 01
subsystem: snap-display
tags: [ios, snap, photo, contentFit, polaroid]
dependency-graph:
  requires: []
  provides: [snap-cover-fit]
  affects: [SnapPreviewScreen, SnapViewer]
tech-stack:
  added: []
  patterns: [contentFit-cover-with-overflow-hidden]
key-files:
  created: []
  modified:
    - src/screens/SnapPreviewScreen.js
    - src/components/SnapViewer.js
decisions:
  - contentFit="cover" fills Polaroid frame edge-to-edge, cropping minimally rather than letterboxing
  - overflow:'hidden' added to SnapPreviewScreen photo style to clip cover-fit overflow (SnapViewer already had it)
metrics:
  duration: 37s
  completed: 2026-02-24T21:10:10Z
  tasks: 1/1
  files-modified: 2
---

# Quick Task 33: Fix Snap Photo Black Bars on iOS

Changed snap photo display from `contentFit="contain"` to `contentFit="cover"` in both SnapPreviewScreen and SnapViewer, eliminating black bars / letterboxing within the Polaroid frame on iOS.

## What Changed

### Task 1: Change contentFit to "cover" in SnapPreviewScreen and SnapViewer

**Commit:** `79b1e39`

**SnapPreviewScreen.js:**

- Line 205: Changed `contentFit="contain"` to `contentFit="cover"` on the Image component
- Added `overflow: 'hidden'` to the `photo` style to ensure the cover-fit image is clipped to container bounds

**SnapViewer.js:**

- Line 267: Changed `contentFit="contain"` to `contentFit="cover"` on the Image component
- `photoContainer` style already had `overflow: 'hidden'` so no additional style change needed

## Verification

- `grep -n "contentFit"` on both files confirms only `"cover"` present (no `"contain"`)
- `overflow: 'hidden'` confirmed in SnapPreviewScreen photo style (line 321) and SnapViewer photoContainer (line 353)
- Android unaffected: `contentFit="cover"` is platform-agnostic and Android already displayed correctly

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] `src/screens/SnapPreviewScreen.js` modified with contentFit="cover" and overflow:'hidden'
- [x] `src/components/SnapViewer.js` modified with contentFit="cover"
- [x] Commit `79b1e39` exists in git log
