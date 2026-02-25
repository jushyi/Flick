---
status: resolved
trigger: "Tapping 'Photo by @username' attribution text navigates to photographer's profile BEHIND the PhotoDetail modal"
created: 2026-02-25T00:00:00Z
updated: 2026-02-25T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - handlePhotographerPress uses navigation.navigate('OtherUserProfile') which pushes a card-presentation screen that renders BEHIND the transparentModal PhotoDetail, instead of using 'ProfileFromPhotoDetail' which is a fullScreenModal that renders ON TOP.
test: Compare navigation method in handlePhotographerPress vs contextAvatarPress
expecting: handlePhotographerPress navigates to wrong route
next_action: Fix handlePhotographerPress to use ProfileFromPhotoDetail route

## Symptoms

expected: Tapping "Photo by @username" attribution text should show the photographer's profile ON TOP of the PhotoDetail modal
actual: Profile screen appears BEHIND the PhotoDetail modal (user can't see it)
errors: None (navigation succeeds, just renders in wrong z-order)
reproduction: Open a photo with attribution in PhotoDetail, tap the attribution text
started: Since attribution feature was added

## Eliminated

(none needed - root cause found immediately)

## Evidence

- timestamp: 2026-02-25T00:00:00Z
  checked: PhotoDetailScreen.js lines 547-555 - handlePhotographerPress handler
  found: Uses `navigation.navigate('OtherUserProfile', ...)` which is a card-presentation screen in the root stack
  implication: Card presentation renders BEHIND transparentModal in React Navigation's native stack

- timestamp: 2026-02-25T00:00:00Z
  checked: PhotoDetailScreen.js lines 594-603 - handleCommentAvatarPress (comments avatar press)
  found: Uses `contextAvatarPress(userId, userName)` which delegates to FeedScreen's onAvatarPress callback
  implication: This is the CORRECT pattern - it goes through the context callback

- timestamp: 2026-02-25T00:00:00Z
  checked: FeedScreen.js lines 369-375 - onAvatarPress callback
  found: Uses `navigation.navigate('ProfileFromPhotoDetail', { userId, username })` which is a fullScreenModal
  implication: ProfileFromPhotoDetail has `presentation: 'fullScreenModal'` which renders ABOVE transparentModal

- timestamp: 2026-02-25T00:00:00Z
  checked: AppNavigator.js lines 534-555 - Screen registration
  found: PhotoDetail = transparentModal, ProfileFromPhotoDetail = fullScreenModal, OtherUserProfile = card
  implication: In native stack, screen z-order is: card < transparentModal < fullScreenModal. So OtherUserProfile (card) renders below PhotoDetail (transparentModal).

## Resolution

root_cause: `handlePhotographerPress` in PhotoDetailScreen.js (line 549) navigates directly to 'OtherUserProfile' (a card-presentation screen) instead of using 'ProfileFromPhotoDetail' (a fullScreenModal screen). In React Navigation's native stack, card presentations render below transparentModal presentations, so the profile screen ends up behind the PhotoDetail modal.
fix: Change handlePhotographerPress to use contextAvatarPress (the same pattern used by handleCommentAvatarPress and handleAvatarPress), which routes through PhotoDetailContext to FeedScreen's onAvatarPress callback that correctly navigates to 'ProfileFromPhotoDetail'.
verification: pending
files_changed:

- src/screens/PhotoDetailScreen.js
