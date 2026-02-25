---
status: resolved
trigger: 'Investigate why tapping the tagged photo image in the TaggedPhotoBubble DM card does NOT navigate to PhotoDetail'
created: 2026-02-25T00:00:00Z
updated: 2026-02-25T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED - ConversationScreen navigates to PhotoDetail with route params but never calls openPhotoDetail() to populate the PhotoDetailContext. PhotoDetailScreen reads ALL its data from context (not route params) and returns null when contextPhoto is null.
test: Verified by reading all four files in the chain
expecting: N/A - root cause confirmed
next_action: Return diagnosis

## Symptoms

expected: Tapping the photo image on a TaggedPhotoBubble card navigates to PhotoDetail screen
actual: Nothing happens when tapping the photo (screen renders null because context is empty)
errors: None visible - the screen navigates but renders nothing (transparent modal + null content = invisible)
reproduction: Send a tagged photo DM, tap the photo image on the card
started: Likely never worked - the navigation was implemented without the context setup step

## Eliminated

- hypothesis: Touch handler not wired in TaggedPhotoBubble
  evidence: TouchableOpacity wraps the card (line 89), handlePress calls onPress(message) (lines 81-85)
  timestamp: 2026-02-25T00:05:00Z

- hypothesis: onPress not forwarded from MessageBubble
  evidence: MessageBubble passes onPress={onPress} directly to TaggedPhotoBubble (line 209)
  timestamp: 2026-02-25T00:02:00Z

- hypothesis: Gesture conflict from react-native-gesture-handler
  evidence: TaggedPhotoBubble returns BEFORE the GestureDetector in MessageBubble, uses plain RN TouchableOpacity
  timestamp: 2026-02-25T00:05:00Z

## Evidence

- timestamp: 2026-02-25T00:01:00Z
  checked: ConversationScreen renderItem (lines 408-426)
  found: pressHandler calls navigation.navigate('PhotoDetail', { photo: {...}, taggedPhotoContext: {...} }) - passes route params directly
  implication: Navigation IS being triggered

- timestamp: 2026-02-25T00:07:00Z
  checked: How FeedScreen and ActivityScreen navigate to PhotoDetail
  found: They all call openPhotoDetail({...}) FIRST to populate PhotoDetailContext, THEN call navigation.navigate('PhotoDetail') with NO route params
  implication: ConversationScreen is missing the critical openPhotoDetail() call

- timestamp: 2026-02-25T00:08:00Z
  checked: PhotoDetailScreen data source (lines 82-108)
  found: PhotoDetailScreen reads ALL data from usePhotoDetail() context hook - currentPhoto, photos, mode, currentUserId, etc. It only reads taggedPhotoContext from route.params (line 80).
  implication: Without openPhotoDetail() being called, contextPhoto is null

- timestamp: 2026-02-25T00:09:00Z
  checked: PhotoDetailScreen null guard (line 896)
  found: `if (!currentPhoto) return null;` - renders nothing when context has no photo
  implication: The screen navigates (as a transparent modal) but renders null - invisible to the user

- timestamp: 2026-02-25T00:09:30Z
  checked: ConversationScreen imports
  found: ConversationScreen does NOT import openPhotoDetail, usePhotoDetail, usePhotoDetailActions, or PhotoDetailContext
  implication: The context setup step was completely omitted when implementing tagged photo navigation from DMs

## Resolution

root_cause: ConversationScreen calls `navigation.navigate('PhotoDetail', { photo, taggedPhotoContext })` but never calls `openPhotoDetail()` to populate the PhotoDetailContext first. PhotoDetailScreen reads ALL its data from context (not route params), and when contextPhoto is null it returns null (line 896). The screen technically navigates (it's a transparent modal), but renders nothing visible. The user sees "nothing happens" because the transparent modal has null content.
fix: ConversationScreen must import `usePhotoDetailActions` from PhotoDetailContext, call `openPhotoDetail()` with the tagged photo data to populate the context, then call `navigation.navigate('PhotoDetail')`. The `taggedPhotoContext` can remain as a route param since PhotoDetailScreen already reads it from route.params.
verification:
files_changed: []
