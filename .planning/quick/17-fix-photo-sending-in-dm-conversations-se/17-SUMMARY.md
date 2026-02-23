---
phase: quick
plan: 17
subsystem: messaging
tags: [dm, photo-messages, cloud-functions, ux]
dependency_graph:
  requires: [quick-14]
  provides: [image-message-preview, cropless-photo-picker]
  affects: [conversation-list, push-notifications, dm-input, message-bubble]
tech_stack:
  added: []
  patterns: [ternary-type-dispatch]
key_files:
  created: []
  modified:
    - functions/index.js
    - src/components/DMInput.js
    - src/components/MessageBubble.js
decisions:
  - '4:5 aspect ratio (200x250) for image message bubbles'
metrics:
  duration: 65s
  completed: 2026-02-23T21:09:06Z
---

# Quick Task 17: Fix Photo Sending in DM Conversations Summary

Image messages in DMs now show "Sent a photo" in conversation preview and push notifications instead of blank text, image picker skips the crop editor for direct sending, and message bubbles use 4:5 aspect ratio for non-square photos.

## Tasks Completed

| #   | Task                                             | Commit    | Key Changes                                                                                                            |
| --- | ------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | Fix Cloud Function to handle image message type  | `2f316e8` | Added `message.type === 'image'` check to both `lastMessagePreview` and notification `body` in `onNewMessage` function |
| 2   | Remove crop requirement and update MessageBubble | `90d41e0` | Set `allowsEditing: false`, removed `aspect: [1, 1]` from image picker; changed messageImage height from 200 to 250    |

## Changes Made

### functions/index.js

- **Line 2656** (`lastMessagePreview`): Added `message.type === 'image' ? 'Sent a photo'` to the ternary chain, between the GIF check and the text fallback
- **Line 2706** (notification `body`): Added matching `message.type === 'image' ? 'Sent a photo'` check for push notification content

### src/components/DMInput.js

- Removed `allowsEditing: true` and `aspect: [1, 1]` from `launchImageLibraryAsync` options
- Set `allowsEditing: false` so the image picker opens directly without forcing a crop step

### src/components/MessageBubble.js

- Changed `messageImage` style from `200x200` (1:1) to `200x250` (4:5 ratio)
- This accommodates non-square photos now that the crop editor is removed

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

1. `grep "Sent a photo" functions/index.js` -- 2 matches (lastMessagePreview and notification body)
2. `grep "allowsEditing: false" src/components/DMInput.js` -- 1 match
3. `grep -A1 "messageImage:" src/components/MessageBubble.js` -- shows 200x250
4. `grep "aspect:" src/components/DMInput.js` -- 0 matches (removed)

## Deployment Reminder

1. **JS changes (OTA):** `eas update --branch production --message "Fix photo sending in DMs: show 'Sent a photo' preview, remove crop requirement"`
2. **Cloud Function:** `cd functions && firebase deploy --only functions`

## Self-Check: PASSED

- All 3 modified files exist on disk
- Both task commits verified (2f316e8, 90d41e0)
- Summary file created at expected path
