# Phase 21: Full UAT — Supabase Migration Verification

**Started:** 2026-03-26
**Status:** In Progress
**Environment:** Dev Supabase
**Prerequisites:** npm test PASS (47 suites, 567 passed), TODO stubs cataloged (33 total)

## Prerequisite Gate Results

- npm test: **PASS** — 47 suites, 567 passed, 14 todo, 0 failures
- TODO(20-01) stubs: 33 total (14 simple wire, 12 new impl, 7 ignorable)
- Edge Functions: 6 found locally, deployment status unknown (verify via dashboard)
- Missing Edge Functions: process-darkroom-reveals, batch-reactions, process-account-deletion, dm-metadata

---

## Part A: iOS UAT (Migrated Account)

### Journey 1: New User Onboarding

### 1. Phone Input Screen Loads
expected: Open app. PhoneInputScreen displays with country code picker and phone number input field. Keyboard auto-focuses on the input.
result: pending

### 2. OTP Send
expected: Enter a valid phone number. Tap "Send Code". Loading indicator appears. Supabase sends OTP via Twilio. App navigates to VerificationScreen. Toast or status confirms code was sent.
result: pending

### 3. OTP Verify
expected: On VerificationScreen, enter the 6-digit OTP code. Tap verify. Supabase auth.verifyOtp() succeeds. App navigates to ProfileSetupScreen (new user) or MainTabs (existing user).
result: pending

### 4. Profile Setup — Photo Upload
expected: On ProfileSetupScreen, tap the profile photo placeholder. Camera or photo picker opens. Select or take a photo. Photo uploads to Supabase Storage. Preview shows the uploaded photo.
result: pending

### 5. Profile Setup — Username and Display Name
expected: Enter a username and display name. Username validation checks availability via profileService.checkUsernameAvailability(). Green checkmark appears for valid username. Tap continue.
result: pending

### 6. Selects Screen
expected: SelectsScreen shows content preference options. Select 3 preferences. Continue button enables after 3 selections. Preferences save to user profile. Navigates to ContactsSyncScreen.
result: pending

### 7. Contacts Sync Screen
expected: ContactsSyncScreen shows option to sync contacts. Can skip or grant permission. If granted, contacts are matched against app users via contactSyncService. Navigates to NotificationPermissionScreen.
result: pending
note: likely affected by TODO(20-01) stub in src/screens/ContactsSyncScreen.tsx (markContactsSyncCompleted)

### 8. Notification Permission and Landing
expected: NotificationPermissionScreen shows option to enable push notifications. Can skip or grant. After this screen, app navigates to MainTabs (Feed tab visible).
result: pending
note: likely affected by TODO(20-01) stub in src/screens/NotificationPermissionScreen.tsx (notificationService)

### Journey 2: Core Photo Lifecycle

### 9. Camera Screen Opens
expected: Tap Camera tab. CameraScreen loads with viewfinder. Camera permissions are granted (or prompt appears). Flash toggle, flip camera, and capture button visible.
result: pending

### 10. Capture Photo
expected: Tap capture button. Photo is taken. Brief capture animation plays. Photo is queued via uploadQueueService. Toast or indicator confirms photo was captured.
result: pending

### 11. Photo Appears in Darkroom as Developing
expected: Navigate to Darkroom (via tab or notification). DarkroomScreen shows the just-captured photo with status "developing". Film strip or developing animation visible.
result: pending

### 12. Reveal Timer Countdown
expected: DarkroomScreen shows a countdown timer for the next reveal. Timer counts down from the scheduled reveal time (0-5 minutes from capture). UI updates every second.
result: pending

### 13. Photo Reveals
expected: When countdown reaches zero (or after manual reveal trigger), developing photos transition to "revealed" status. Reveal animation plays. Photos move from developing section to revealed section.
result: pending

### 14. Revealed Photo Appears in Feed
expected: Navigate to Feed tab. The revealed photo appears in the feed, showing the user's name, timestamp, and the photo. Reverse chronological order.
result: pending

### 15. Photo Detail Opens from Feed
expected: Tap a photo in the feed. PhotoDetailScreen opens as a transparent modal. Photo displays full-screen with user info, caption area, and action buttons (react, comment, triage).
result: pending

### 16. Photo Triage — Journal and Archive
expected: In PhotoDetailScreen, use triage controls. "Journal" sets photo_state to 'journal'. "Archive" sets photo_state to 'archive'. Photo updates in the database. Feed/profile reflects the change.
result: pending
note: likely affected by TODO(20-01) stub in src/screens/PhotoDetailScreen.tsx (archivePhoto mapped to triagePhoto)

### Journey 3: Social Interactions

### 17. Search and Add Friend
expected: Navigate to FriendsScreen (from Profile or Activity). Search for a user by username. User appears in search results. Tap "Add Friend" button. Friend request is sent via friendshipService.sendFriendRequest().
result: pending

### 18. Friend Request Appears for Other User
expected: On the recipient's device/account, Activity or FriendsScreen shows the incoming friend request with sender's name and profile photo.
result: pending

### 19. Accept Friend Request
expected: Tap "Accept" on the incoming friend request. friendshipService.acceptFriendRequest() is called. Friendship status changes to 'accepted'. Both users now show as friends.
result: pending

### 20. Friend's Photos Appear in Feed
expected: After accepting friendship, navigate to Feed. Friend's revealed photos now appear in the feed alongside the user's own photos. Photos are sorted reverse chronologically.
result: pending

### 21. Comment on Photo
expected: Open a friend's photo in PhotoDetail. Tap comment button. Comment input appears. Type a comment and submit. Comment appears below the photo with user name and timestamp.
result: pending

### 22. @Mention Autocomplete in Comment
expected: In the comment input, type "@" followed by a few letters. Autocomplete dropdown shows matching friends. Select a friend. Their username is inserted as a mention. Submit comment with mention.
result: pending

### 23. React to Photo
expected: In PhotoDetailScreen or Feed, tap the reaction button on a friend's photo. Reaction is recorded via photoService.addReaction(). Reaction count updates. Reaction icon shows as active.
result: pending
note: likely affected by TODO(20-01) stub in src/screens/FeedScreen.tsx (toggleReaction)

### 24. Block User
expected: Navigate to a user's profile. Tap block. Confirm block. blockService.blockUser() is called. User disappears from feed, friends list, and search. Blocked users list in Settings shows the blocked user.
result: pending

### Journey 4: Messaging

### 25. Start New Conversation
expected: Navigate to Messages tab. Tap new message button. NewMessage screen shows friend list. Select a friend. Conversation screen opens (new or existing).
result: pending

### 26. Send Text Message
expected: In conversation, type a text message. Tap send. Message appears in the conversation with sent status. messageService.sendMessage() is called.
result: pending

### 27. Message Appears for Recipient
expected: On the recipient's device/account, the message appears in their conversation list and within the conversation. Unread indicator shows.
result: pending

### 28. Send Reaction to Message
expected: Long-press or tap reaction button on a message. Select a reaction emoji. messageService.sendReaction() is called. Reaction appears on the message for both users.
result: pending

### 29. Reply to Message
expected: Swipe or tap reply on a specific message. Reply input shows the original message as context. Type reply and send. messageService.sendReply() creates threaded reply. Reply shows linked to original.
result: pending

### 30. Send Snap Photo
expected: In conversation, tap camera/snap button. Take or select a photo. snapService.uploadAndSendSnap() uploads to snaps bucket and sends message. Snap appears in conversation as a photo message.
result: pending

### 31. View Snap (One-Time)
expected: Recipient taps snap message. Photo displays full-screen via SnapViewer. After viewing, snapService.markSnapViewed() is called. Snap shows as "opened" and cannot be re-viewed.
result: pending

### 32. Read Receipts
expected: When recipient opens conversation, messageService.markConversationRead() is called. Sender sees read indicator on their messages. Read status updates in real-time.
result: pending

### 33. Send GIF
expected: In conversation, tap GIF button. GIPHY picker opens. Search and select a GIF. GIF sends as a message with gif_url. GIF renders inline in conversation.
result: pending

### 34. Delete/Unsend Message
expected: Long-press own message. Tap "Unsend" or "Delete for me". messageService.unsendMessage() or deleteMessageForMe() is called. Message disappears or shows "deleted" placeholder.
result: pending

### 35. Tagged Photo in DM
expected: From PhotoDetailScreen, share/tag a photo to a friend via DM. messageService.sendTaggedPhotoMessage() sends the photo reference. Recipient sees tagged photo bubble in conversation.
result: pending

### 36. Streak Indicator
expected: Conversations with active streaks show streak indicator (fire emoji + day count). streakService.deriveStreakState() calculates streak. Color changes based on streak length via getStreakColor().
result: pending

### Journey 5: Profile & Albums

### 37. Edit Display Name
expected: Navigate to Profile > Edit Profile. Change display name. Save. profileService.updateUserProfile() updates the name. Profile screen reflects the new name immediately.
result: pending

### 38. Change Profile Photo
expected: In Edit Profile, tap profile photo. Select new photo. Photo uploads to Supabase Storage via storageService.uploadProfilePhoto(). Profile photo updates across the app.
result: pending

### 39. Set Profile Song
expected: In Edit Profile, tap song field. SongSearch screen opens. Search for a song. Select it. Song saves to profile. Profile shows the selected song.
result: pending

### 40. Create Album
expected: Navigate to Profile > Create Album. Enter album title (max 24 chars). Select photos from grid. albumService.createAlbum() creates the album. Album appears in profile's albums section.
result: pending
note: likely affected by TODO(20-01) stub in src/screens/ProfileScreen.tsx (getUserAlbums)

### 41. Add Photos to Album
expected: Open an album. Tap add photos. Photo picker shows user's photos. Select additional photos. albumService.addPhotosToAlbum() updates the album. New photos appear in album grid.
result: pending

### 42. View Album Grid
expected: Tap an album on profile. AlbumGridScreen loads showing all album photos in a grid. Photos load from Supabase Storage. Tapping a photo opens PhotoDetail.
result: pending
note: likely affected by TODO(20-01) stub in src/screens/AlbumGridScreen.tsx (getPhotosByIds)

### 43. Monthly Albums
expected: Profile shows auto-generated monthly albums section. MonthlyAlbumsSection displays months with photos. Tapping opens MonthlyAlbumGrid with that month's photos.
result: pending
note: likely affected by TODO(20-01) stub in src/components/MonthlyAlbumsSection.tsx (getUserPhotosByMonth)

### 44. Recently Deleted Photos
expected: Navigate to Profile > Settings > Recently Deleted. RecentlyDeletedScreen shows soft-deleted photos within the 30-day window. Options to restore or permanently delete.
result: pending
note: likely affected by TODO(20-01) stub in src/screens/RecentlyDeletedScreen.tsx (getDeletedPhotos)

### Journey 6: Settings & Account

### 45. Notification Settings
expected: Navigate to Profile > Settings > Notification Settings. Toggles display for different notification types. Toggling saves preferences.
result: pending

### 46. Sound Settings
expected: Navigate to Profile > Settings > Sound Settings. Sound options display. Changing a sound plays preview and saves preference.
result: pending

### 47. View Privacy Policy
expected: Navigate to Profile > Settings > Privacy Policy. PrivacyPolicy screen loads with policy content. Scrollable. Back navigation works.
result: pending

### 48. View Terms of Service
expected: Navigate to Profile > Settings > Terms of Service. TermsOfService screen loads with terms content. Scrollable. Back navigation works.
result: pending

### 49. Blocked Users List
expected: Navigate to Profile > Settings > Blocked Users. BlockedUsers screen shows list of blocked users (or empty state). Unblock option available for each.
result: pending

### 50. Report User Flow
expected: Navigate to another user's profile. Tap report. ReportUserScreen shows report reasons. Select reason and submit. reportService.reportUser() is called. Confirmation shown.
result: pending

### 51. Schedule Account Deletion
expected: Navigate to Profile > Settings > Delete Account. DeleteAccountScreen shows deletion info and recovery period. Confirm deletion. Account deletion is scheduled.
result: pending
note: likely affected by TODO(20-01) stub in src/screens/DeleteAccountScreen.tsx (accountService)

### 52. Cancel Account Deletion
expected: If deletion is scheduled, DeletionRecoveryModal shows countdown. Tap "Cancel Deletion". AuthContext.cancelDeletion() is called. Deletion is cancelled. Normal app access resumes.
result: pending
note: likely affected by TODO(20-01) stub in src/screens/DeleteAccountScreen.tsx (accountService)

### Journey 7: Stories & Navigation

### 53. Stories Circles in Feed
expected: Feed screen shows friend story circles at the top. Friends with recent revealed photos appear as circular avatars. Unviewed stories have a colored ring border.
result: pending
note: likely affected by TODO(20-01) stub in src/screens/FeedScreen.tsx (getFriendStoriesData)

### 54. Tap Story Opens Viewer
expected: Tap a friend's story circle. PhotoDetailScreen opens in 'stories' mode showing that friend's recent photos. Swipe left/right navigates between photos.
result: pending

### 55. Swipe Between Friends' Stories
expected: After viewing all of one friend's photos in stories mode, swipe to advance to the next friend's stories. PhotoDetailContext handles friend-to-friend navigation.
result: pending

### 56. Photo Detail from Story
expected: In stories viewer, full photo detail is available — reactions, comments, triage options all work the same as feed mode.
result: pending

### 57. Navigate to Profile from Photo Detail
expected: In PhotoDetailScreen, tap the user's name/avatar. ProfileFromPhotoDetail screen opens showing that user's profile. Back navigation returns to photo detail.
result: pending

### 58. Deep Link Navigation
expected: Open a deep link (lapse://feed, lapse://camera, lapse://profile). App navigates to the correct screen. Works from both foreground and background states.
result: pending

### Feature-Area Gap Sweep

### 59. Session Persistence Across Restart
expected: Force-close the app. Reopen. Auth session persists (no re-login required). App loads directly to MainTabs with cached data.
result: pending

### 60. Cached Data on Cold Start
expected: With airplane mode on, open the app. Previously loaded data (feed, profile, conversations) should display from TanStack Query cache or PowerSync local database.
result: pending

### 61. Real-Time Feed Updates
expected: While on Feed screen, have a friend post and reveal a photo (from another device/account). The new photo should appear in the feed via Supabase Realtime subscription without manual refresh.
result: pending

### 62. Friend Request Push Notification
expected: Send a friend request from another account. The recipient should receive a push notification (if notifications are enabled and Edge Functions deployed).
result: pending

### 63. Empty States — No Photos
expected: On a new or photo-less account, Feed shows an appropriate empty state (not a blank screen or error). Camera prompt or "Take your first photo" message.
result: pending

### 64. Empty States — No Friends
expected: On an account with no friends, Feed shows empty state. FriendsScreen shows "Find friends" prompt. No errors or blank screens.
result: pending

### 65. Empty States — No Messages
expected: Messages tab with no conversations shows appropriate empty state. "Start a conversation" prompt or friend suggestions.
result: pending

### 66. Activity/Notification Screen
expected: Navigate to Activity screen. Shows notifications (friend requests, reactions, comments, reveals). Each notification type renders correctly with icon, text, and timestamp.
result: pending
note: likely affected by TODO(20-01) stub in src/screens/ActivityScreen.tsx (notificationService mark functions)

### 67. Upload Queue Retry
expected: Capture a photo while offline or with poor connection. uploadQueueService queues the upload. When connection restores, upload retries automatically. Photo eventually appears in darkroom.
result: pending

### 68. Pull-to-Refresh on Feed
expected: On Feed screen, pull down to refresh. Loading indicator appears. Feed data refreshes from Supabase. New photos appear.
result: pending

### 69. Viewed Stories Tracking
expected: View a friend's story. Return to feed. That friend's story circle no longer shows the unviewed ring. useViewedStories tracks which photos have been seen.
result: pending
note: likely affected by TODO(20-01) stub in src/hooks/useViewedStories.ts (viewedStoriesService)

### 70. Profile Photo Crop
expected: During profile photo selection (setup or edit), ProfilePhotoCrop screen allows cropping/positioning the photo. Cropped image uploads correctly.
result: pending

### 71. Other User Profile Navigation
expected: From Feed, tap a user's name. OtherUserProfile screen loads showing their public profile, shared friends count, and photo grid. Friend/unfriend button works.
result: pending

### 72. Help & Support Screen
expected: Navigate to Profile > Settings > Help & Support. HelpSupportScreen loads with support categories and submission form.
result: pending
note: likely affected by TODO(20-01) stub in src/screens/HelpSupportScreen.tsx (submitSupportRequest)

### 73. Batch Photo Triage
expected: In profile photo grid, select multiple photos. Batch triage to journal or archive. photoService.batchTriagePhotos() updates all selected photos.
result: pending

### 74. Contributions Screen
expected: Navigate to Profile > Contributions. ContributionsScreen loads showing user's contribution stats or history.
result: pending

---

## Part B: Android UAT (Migrated Account)

*Placeholder — filled by Plan 03. Repeats all 7 journeys on Android with additional platform-specific checks:*
- Hardware back button behavior on modal screens
- Edge-to-edge layout (gesture nav bar overlap)
- Shadow rendering (elevation vs iOS shadow props)
- KeyboardAvoidingView behavior differences
- Font rendering for pixel/bitmap fonts
- Responsive layout on 360dp (small) and 430dp (large) screens

---

## Part C: Fresh Account Testing

*Placeholder — filled by Plan 04. Creates a brand new account on pure Supabase stack and verifies:*
- Fresh signup flow (no migrated data)
- Empty states for all screens
- First photo capture and reveal
- First friend request
- First message

---

## Summary

| Section | Total | Pass | Fail | Blocked | Pending |
|---------|-------|------|------|---------|---------|
| Journey 1: Onboarding | 8 | 0 | 0 | 0 | 8 |
| Journey 2: Photo Lifecycle | 8 | 0 | 0 | 0 | 8 |
| Journey 3: Social | 8 | 0 | 0 | 0 | 8 |
| Journey 4: Messaging | 12 | 0 | 0 | 0 | 12 |
| Journey 5: Profile & Albums | 8 | 0 | 0 | 0 | 8 |
| Journey 6: Settings & Account | 8 | 0 | 0 | 0 | 8 |
| Journey 7: Stories & Navigation | 6 | 0 | 0 | 0 | 6 |
| Gap Sweep | 16 | 0 | 0 | 0 | 16 |
| **iOS Total** | **74** | **0** | **0** | **0** | **74** |
| Android (Plan 03) | -- | -- | -- | -- | -- |
| Fresh Account (Plan 04) | -- | -- | -- | -- | -- |
