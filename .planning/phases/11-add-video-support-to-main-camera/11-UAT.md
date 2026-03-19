---
status: testing
phase: 11-add-video-support-to-main-camera
source: [11-00-SUMMARY.md, 11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md, 11-04-SUMMARY.md, 11-05-SUMMARY.md, 11-06-SUMMARY.md, 11-07-SUMMARY.md]
started: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:00:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, any seed/migration completes, and a primary query (health check, homepage load, or basic API call) returns live data.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state. Start the application from scratch. App boots without errors, no crash on launch, and the feed or home screen loads with live data.
result: [pending]

### 2. Hold-to-Record Video Capture
expected: On the camera screen, tap the shutter button briefly — a photo is taken as normal. Press and hold the shutter button for more than half a second — the camera switches to video recording mode. Release the button to stop recording. The recorded video is queued for upload.
result: [pending]

### 3. Recording Progress Ring
expected: While holding the shutter to record video, a red circular progress ring animates clockwise around the shutter button, filling over the maximum recording duration (30 seconds). The shutter button inner area turns red with a rounded-square "stop" shape during recording.
result: [pending]

### 4. Camera Facing Lock During Recording
expected: While actively recording a video, the camera flip button and zoom controls are disabled. You cannot switch between front/back camera mid-recording.
result: [pending]

### 5. Video Autoplay in Feed
expected: Videos in the feed autoplay silently (muted) when they scroll into the viewport (at least 50% visible). When a video scrolls out of view, it pauses. Videos that scroll back into view resume playing.
result: [pending]

### 6. Feed Video Tap-to-Unmute
expected: Tapping on a video in the feed toggles the audio on/off. Unmuting one video and scrolling to another video — the new video also plays with sound (global mute state shared across all videos).
result: [pending]

### 7. Feed Video Duration Badge & Icon
expected: Video posts in the feed show a small video icon overlay in the top-left corner and a duration badge (e.g., "0:15") in the bottom-right corner of the video.
result: [pending]

### 8. Video Playback in PhotoDetail
expected: Opening a video post in the PhotoDetail view plays the video with a progress bar and mute toggle control. In feed mode, the video loops continuously.
result: [pending]

### 9. Stories Mode Video Auto-Advance
expected: In stories mode, a video plays once to completion, then automatically advances to the next photo/video in the stories sequence. The progress bar segment for a video fills based on actual video playback time (not a fixed timer).
result: [pending]

### 10. Darkroom Video Icon
expected: In the darkroom card stack, video items show a small play icon badge in the bottom-left corner to distinguish them from photos.
result: [pending]

### 11. Global Mute State Persistence
expected: Unmuting a video in the feed, then opening PhotoDetail for a different video — the second video also plays with sound. Mute state persists across feed, PhotoDetail, and stories views within the same session.
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0

## Gaps

[none yet]
