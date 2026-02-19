---
plan: 04
title: "Chat Thread Components"
status: success
completed: 2026-02-19
commits:
  - aa453b3 feat(dm): add ConversationRow component for conversation list
notes: MessageBubble and TimeDivider already existed from prior work on this branch
---

## What was done

Created three presentational UI components for the direct messaging feature:

### 1. ConversationRow (`src/components/ConversationRow.js`)
- Pressable row for the conversation list showing avatar, display name, last message preview, and relative timestamp
- Profile photo uses `expo-image` with `cachePolicy="memory-disk"`, falls back to PixelIcon `tab-profile`
- Unread indicator: 8px cyan dot (`colors.interactive.primary`) when `unreadCount[currentUserId] > 0`
- Display name switches from `fontWeight: '600'` to `'700'` when unread
- Last message preview: shows text, "Sent a GIF" for gif type, or "No messages yet"
- Timestamp formatting: "now" / "2m" / "3h" / "Yesterday" / "Mon" / "Feb 14" using `date-fns`
- Supports `onPress` and `onLongPress` callbacks
- Border bottom using `StyleSheet.hairlineWidth` with `colors.border.subtle`

### 2. MessageBubble (`src/components/MessageBubble.js`)
- Individual message bubble with user/friend styling differentiation
- User bubbles: `colors.interactive.primary` background, `colors.text.inverse` text, right-aligned, bottom-right radius 4
- Friend bubbles: `colors.background.tertiary` background, `colors.text.primary` text, left-aligned, bottom-left radius 4
- GIF support via `expo-image` with `contentFit="contain"`
- Tap-to-reveal timestamp: "h:mm a" format shown below bubble when `showTimestamp` is true
- Max width 75%, border radius 16, font size 15

### 3. TimeDivider (`src/components/TimeDivider.js`)
- Centered timestamp label between message groups
- Smart date formatting: "Today" / "Yesterday" / "EEE, MMM d" (same year) / "MMM d, yyyy" (other years)
- Supports optional `label` prop override
- `colors.text.secondary`, font size 12, margin vertical 16

## Verification checklist

- [x] `npm run lint` passes (all three files, zero errors)
- [x] All three component files exist in `src/components/`
- [x] Components use named imports from color constants (`colors` from `../constants/colors`)
- [x] Profile photos use `expo-image` (not `react-native` Image)
- [x] No hardcoded color values -- all from `colors` constant
- [x] No `console.log` usage
- [x] All components are purely presentational (no Firestore calls, no hooks)
- [x] Existing tests unaffected (735 passed, 3 pre-existing failures in photoLifecycle.test.js)

## Deviations

- **MessageBubble and TimeDivider already existed**: These two files were already committed on the `feat/dm` branch in prior work (commit `034b9e9`). The content I wrote matched exactly what was already present (after prettier formatting), so no new commit was needed for Task 2. Only ConversationRow required a new commit.
