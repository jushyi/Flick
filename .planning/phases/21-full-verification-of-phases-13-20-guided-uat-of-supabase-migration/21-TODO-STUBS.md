# Phase 21: TODO Stub Catalog

**Generated:** 2026-03-26
**Total stubs:** 33 (32 TODO(20-01) + 1 TODO(20-08))
**Simple wire:** 14 | **New impl needed:** 12 | **Ignorable:** 7

## npm test Results

**Status:** PASS
- Test Suites: 47 passed, 47 total
- Tests: 567 passed, 14 todo, 581 total
- Time: 7.217s
- Warning: Worker process force exited (timer leak, non-blocking)

## Simple Wire (import + call)

These stubs have an existing Supabase service function or a trivial mapping. Fix = import + call.

| # | File | Line | Function | Supabase Equivalent | Service File |
|---|------|------|----------|---------------------|--------------|
| 1 | src/screens/FeedScreen.tsx | 35 | toggleReaction | addReaction / removeReaction | src/services/supabase/photoService.ts |
| 2 | src/screens/ProfileScreen.tsx | 40 | getUserAlbums | getUserAlbums | src/services/supabase/albumService.ts |
| 3 | src/screens/ProfileScreen.tsx | 40 | deleteAlbum | deleteAlbum | src/services/supabase/albumService.ts |
| 4 | src/screens/AlbumGridScreen.tsx | 31 | getPhotosByIds | getPhotoById (loop or batch) | src/services/supabase/photoService.ts |
| 5 | src/screens/ProfileScreen.tsx | 40 | getPhotosByIds | getPhotoById (loop or batch) | src/services/supabase/photoService.ts |
| 6 | src/components/AddToAlbumSheet.tsx | 22 | getPhotosByIds | getPhotoById (loop or batch) | src/services/supabase/photoService.ts |
| 7 | src/components/AlbumPhotoViewer.tsx | 27 | archivePhoto/restorePhoto | triagePhoto / restorePhoto | src/services/supabase/photoService.ts |
| 8 | src/screens/PhotoDetailScreen.tsx | 62 | archivePhoto | triagePhoto('archive') | src/services/supabase/photoService.ts |
| 9 | src/screens/FriendsScreen.tsx | 47 | getBlockedByUserIds / getBlockedUserIds | getBlockedUsers | src/services/supabase/blockService.ts |
| 10 | src/screens/ReportUserScreen.tsx | 20 | REPORT_REASONS | Define locally (stub is comment-only) | N/A |
| 11 | src/screens/ProfileScreen.tsx | 47 | generateFriendshipId | Not needed -- Supabase uses UUIDs | N/A (dead code) |
| 12 | src/components/MonthlyAlbumsSection.tsx | 7 | getUserPhotosByMonth | getMonthlyPhotos | src/services/supabase/albumService.ts |
| 13 | src/screens/EditProfileScreen.tsx | 31 | canChangeUsername | checkUsernameAvailability (similar) | src/services/supabase/profileService.ts |
| 14 | src/screens/RecentlyDeletedScreen.tsx | 28 | restoreDeletedPhoto | restorePhoto | src/services/supabase/photoService.ts |

## New Implementation Needed

These stubs have no direct Supabase service equivalent. New service code or queries required.

| # | File | Line | Function | What's Missing | Estimated Complexity |
|---|------|------|----------|----------------|---------------------|
| 1 | src/screens/FeedScreen.tsx | 35 | getFriendStoriesData | No stories aggregation query -- needs RPC or multi-query to group friend photos as stories | Medium |
| 2 | src/screens/FeedScreen.tsx | 35 | getUserStoriesData | No user stories query -- similar to above for current user | Medium |
| 3 | src/screens/FeedScreen.tsx | 35 | getRandomFriendPhotos | No random photo query -- SQL `ORDER BY random() LIMIT n` | Low |
| 4 | src/screens/ActivityScreen.tsx | 33 | markSingleNotificationAsRead / markNotificationsAsRead | No notification mark-read service | Low |
| 5 | src/screens/ActivityScreen.tsx | 38 | getUserStoriesData | Same as #2 (shared) | (shared) |
| 6 | src/hooks/useViewedStories.ts | 2 | viewedStoriesService (entire module) | No viewed-stories tracking -- needs new table or column + service | Medium |
| 7 | src/screens/DeleteAccountScreen.tsx | 21 | scheduleAccountDeletion / cancelDeletion | No account deletion service | Medium |
| 8 | src/screens/RecentlyDeletedScreen.tsx | 28 | getDeletedPhotos / permanentlyDeletePhoto | Need soft-deleted query + storage cleanup | Medium |
| 9 | src/screens/PhotoDetailScreen.tsx | 62 | updatePhotoTags / subscribePhoto | No photo tag service or realtime subscription | Medium |
| 10 | src/screens/PhotoDetailScreen.tsx | 70 | photoTagService (addTaggedPhotoToFeed) | No tag-to-feed flow | Medium |
| 11 | src/components/TaggedPhotoBubble.tsx | 28 | photoTagService | Same as #10 (shared) | (shared) |
| 12 | src/screens/HelpSupportScreen.tsx | 19 | submitSupportRequest + SUPPORT_CATEGORIES | No support request table/service | Low |

## Ignorable for UAT

These stubs return safe defaults or affect non-critical paths. Won't block core UAT flows.

| # | File | Line | Function | Why Ignorable |
|---|------|------|----------|---------------|
| 1 | src/navigation/AppNavigator.tsx | 29 | notificationService (permission check) | Returns safe defaults; app navigates correctly |
| 2 | src/navigation/AppNavigator.tsx | 34 | getContactsPermissionStatus | Returns 'undetermined'; contacts sync still works via contactSyncService |
| 3 | src/screens/NotificationsScreen.tsx | 27 | notificationService (permission + token) | Screen renders; permission prompting is secondary |
| 4 | src/screens/NotificationPermissionScreen.tsx | 7 | notificationService (onboarding step) | Onboarding proceeds past this screen |
| 5 | src/screens/NotificationSettingsScreen.tsx | 9 | notificationService (settings toggles) | Settings screen renders; toggles are non-critical |
| 6 | src/screens/ContactsSyncScreen.tsx | 9 | markContactsSyncCompleted | Onboarding proceeds; flag is convenience |
| 7 | src/screens/ContactsSettingsScreen.tsx | 8 | contacts permission helpers | Settings screen renders; non-critical path |

## Edge Functions Status

**6 Edge Functions found locally** in `supabase/functions/`:

| Function | Purpose | Deployment Status |
|----------|---------|-------------------|
| check-push-receipts | Verify push notification delivery | Unknown -- check dev dashboard |
| cleanup-storage | Delete orphaned storage files | Unknown -- check dev dashboard |
| migrate-firebase-auth | Silent Firebase-to-Supabase auth migration | Unknown -- check dev dashboard |
| send-live-activity | iOS Live Activity push notifications | Unknown -- check dev dashboard |
| send-push-notification | Push notification sending (all types) | Unknown -- check dev dashboard |
| snap-cleanup | Delete expired snap photos from storage | Unknown -- check dev dashboard |

**Missing from local Edge Functions vs CLAUDE.md references:**
- `process-darkroom-reveals` -- not found (may be pg_cron SQL function, not Edge Function)
- `batch-reactions` -- not found
- `process-account-deletion` -- not found (related to accountService stub)
- `cleanup-expired` -- `cleanup-storage` may serve this purpose
- `dm-metadata` -- not found (may be handled by triggers)

**Deployment verification requires `supabase functions list` with active CLI login or Supabase dashboard.**

## Stubs by UAT Impact

**Will cause visible UAT failures (fix during walkthrough):**
- Feed stories empty (getFriendStoriesData, getUserStoriesData)
- Feed reactions broken (toggleReaction)
- Profile albums empty (getUserAlbums, getPhotosByIds, deleteAlbum)
- Activity screen notifications don't mark read
- Recently deleted photos empty
- Account deletion fails
- Viewed stories tracking broken

**May cause subtle issues:**
- Random friend photos in empty feed state
- Username change validation
- Help/support submissions fail
- Monthly albums param mapping

**Non-blocking:**
- Notification permission stubs (7 items)
- Contacts sync completion flag
- generateFriendshipId (dead code)
