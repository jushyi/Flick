# Phase 21: TODO Stub Catalog

**Generated:** 2026-03-26
**Total stubs:** 33 (32 TODO(20-01) + 1 TODO(20-08))
**Simple wire:** 14 | **New impl needed:** 12 | **Ignorable:** 7

## npm test Results

**Status:** PASS
- Test Suites: 47 passed, 47 total
- Tests: 567 passed, 14 todo, 581 total
- Time: 8.121s
- Warning: Worker process force exited (timer leak, non-blocking)

## Simple Wire (import + call)

These stubs have an existing Supabase service function or a trivial mapping. Fix = import + call.

| # | File | Line | Function | Supabase Equivalent | Service File |
|---|------|------|----------|---------------------|--------------|
| 1 | src/screens/FeedScreen.tsx | 36 | toggleReaction | addReaction / removeReaction | src/services/supabase/photoService.ts |
| 2 | src/screens/ProfileScreen.tsx | 41 | getUserAlbums | getUserAlbums | src/services/supabase/albumService.ts |
| 3 | src/screens/ProfileScreen.tsx | 43 | deleteAlbum | deleteAlbum | src/services/supabase/albumService.ts |
| 4 | src/screens/AlbumGridScreen.tsx | 31 | getPhotosByIds | getPhotoById (loop or batch) | src/services/supabase/photoService.ts |
| 5 | src/screens/ProfileScreen.tsx | 42 | getPhotosByIds | getPhotoById (loop or batch) | src/services/supabase/photoService.ts |
| 6 | src/components/AddToAlbumSheet.tsx | 22 | getPhotosByIds | getPhotoById (loop or batch) | src/services/supabase/photoService.ts |
| 7 | src/components/AlbumPhotoViewer.tsx | 27 | archivePhoto/restorePhoto | triagePhoto (already imported) | src/services/supabase/photoService.ts |
| 8 | src/screens/PhotoDetailScreen.tsx | 62 | archivePhoto | triagePhoto (already aliased) | src/services/supabase/photoService.ts |
| 9 | src/screens/FriendsScreen.tsx | 47 | getBlockedByUserIds / getBlockedUserIds | getBlockedUsers | src/services/supabase/blockService.ts |
| 10 | src/screens/ReportUserScreen.tsx | 20 | REPORT_REASONS | Define locally (already done, stub is just a comment) | N/A (local constant) |
| 11 | src/screens/ProfileScreen.tsx | 47 | generateFriendshipId | Not needed -- Supabase uses UUIDs | N/A (dead code removal) |
| 12 | src/components/MonthlyAlbumsSection.tsx | 7 | getUserPhotosByMonth | getMonthlyPhotos | src/services/supabase/albumService.ts |
| 13 | src/screens/EditProfileScreen.tsx | 31 | canChangeUsername | checkUsernameAvailability (similar) | src/services/supabase/profileService.ts |
| 14 | src/screens/RecentlyDeletedScreen.tsx | 28 | restoreDeletedPhoto | restorePhoto | src/services/supabase/photoService.ts |

## New Implementation Needed

These stubs have no direct Supabase service equivalent. New service code or an Edge Function is required.

| # | File | Line | Function | What's Missing | Estimated Complexity |
|---|------|------|----------|----------------|---------------------|
| 1 | src/screens/FeedScreen.tsx | 37 | getFriendStoriesData | No stories aggregation query in feedService -- needs RPC or multi-query to group friend photos as "stories" | Medium - new feedService function |
| 2 | src/screens/FeedScreen.tsx | 38 | getUserStoriesData | No user stories query -- similar to above but for current user | Medium - new feedService function |
| 3 | src/screens/FeedScreen.tsx | 39 | getRandomFriendPhotos | No random photo query in feedService | Low - SQL `ORDER BY random() LIMIT n` |
| 4 | src/screens/ActivityScreen.tsx | 33 | markSingleNotificationAsRead / markNotificationsAsRead | No notification mark-read service exists | Low - simple Supabase update query |
| 5 | src/screens/ActivityScreen.tsx | 38 | getUserStoriesData | Same as FeedScreen #2 above | (shared) |
| 6 | src/hooks/useViewedStories.ts | 2 | viewedStoriesService (loadViewedPhotos, markPhotosAsViewed) | No viewed-stories tracking service | Medium - needs new table or column + service |
| 7 | src/screens/DeleteAccountScreen.tsx | 21 | scheduleAccountDeletion | No account deletion service (process-account-deletion Edge Function exists but no client service) | Medium - new accountService.ts |
| 8 | src/screens/RecentlyDeletedScreen.tsx | 28 | getDeletedPhotos / permanentlyDeletePhoto | getDeletedPhotos needs soft-deleted query; permanentlyDeletePhoto needs storage cleanup | Medium - extend photoService |
| 9 | src/screens/PhotoDetailScreen.tsx | 64 | updatePhotoTags / subscribePhoto | No photo tag update service or real-time subscription | Medium - new photoTagService |
| 10 | src/screens/PhotoDetailScreen.tsx | 70 | addTaggedPhotoToFeed | No tag-to-feed flow in Supabase | Medium - new photoTagService |
| 11 | src/components/TaggedPhotoBubble.tsx | 28 | addTaggedPhotoToFeed | Same as above (shared) | (shared) |
| 12 | src/screens/HelpSupportScreen.tsx | 19 | submitSupportRequest | No support request table or service | Low - could use Supabase insert or mailto |

## Ignorable for UAT

These stubs are either already functional (just have a residual TODO comment), affect non-critical paths, or are comments-only.

| # | File | Line | Function | Why Ignorable |
|---|------|------|----------|---------------|
| 1 | src/navigation/AppNavigator.tsx | 29 | notificationService (permission check) | Notification permissions use expo-notifications directly; stub returns safe defaults. App still navigates correctly. |
| 2 | src/navigation/AppNavigator.tsx | 34 | getContactsPermissionStatus | Returns 'undetermined' -- contacts sync still works via contactSyncService, just skips auto-prompt |
| 3 | src/screens/NotificationsScreen.tsx | 27 | notificationService (permission + token) | Notifications screen still renders; permission prompting is secondary to core flows |
| 4 | src/screens/NotificationPermissionScreen.tsx | 7 | notificationService (onboarding step) | Onboarding can proceed past this screen without real permission grant |
| 5 | src/screens/NotificationSettingsScreen.tsx | 9 | notificationService (settings toggles) | Settings screen renders; toggles are non-critical for UAT pass |
| 6 | src/screens/ContactsSyncScreen.tsx | 9 | markContactsSyncCompleted | Onboarding proceeds; flag is convenience not blocker |
| 7 | src/screens/ContactsSettingsScreen.tsx | 8 | contacts permission helpers | Settings screen renders; contacts settings are non-critical path |

## Stubs by Severity for UAT

**Will cause visible UAT failures (fix during walkthrough):**
- Feed stories empty (getFriendStoriesData, getUserStoriesData)
- Feed reactions broken (toggleReaction)
- Profile albums empty (getUserAlbums, getPhotosByIds, deleteAlbum)
- Activity screen notifications don't mark read
- Recently deleted photos empty
- Account deletion fails
- Photo tags/subscriptions broken
- Viewed stories tracking broken

**May cause subtle issues (test but lower priority):**
- Random friend photos in empty feed state
- Username change validation always returns true
- Help/support submissions fail
- Monthly albums param mapping

**Non-blocking (ignorable for core UAT):**
- Notification permission stubs (7 items above)
- Contacts sync completion flag
- generateFriendshipId (dead code)

## Edge Functions Status

**Local Edge Functions found (7):**

| Function | Purpose | Deployment Status |
|----------|---------|-------------------|
| `_shared/` | Shared utilities (supabaseAdmin, validation, notifications) | N/A (not deployed independently) |
| `check-push-receipts/` | Verify push notification delivery | Unknown -- check dev dashboard |
| `cleanup-storage/` | Delete orphaned storage files | Unknown -- check dev dashboard |
| `migrate-firebase-auth/` | Silent Firebase-to-Supabase auth migration | Unknown -- check dev dashboard |
| `send-live-activity/` | iOS Live Activity push notifications | Unknown -- check dev dashboard |
| `send-push-notification/` | Push notification sending (all 14 types) | Unknown -- check dev dashboard |
| `snap-cleanup/` | Delete expired snap photos from storage | Unknown -- check dev dashboard |

**Note:** The `process-darkroom-reveals` Edge Function referenced in CLAUDE.md is NOT present in `supabase/functions/`. Darkroom reveals may be handled differently (pg_cron + SQL function, or client-side only). This needs verification during UAT Journey 2 (Photo Lifecycle).

**Missing from local Edge Functions vs CLAUDE.md references:**
- `process-darkroom-reveals` -- not found (may be pg_cron SQL, not Edge Function)
- `batch-reactions` -- not found (may be handled differently)
- `process-account-deletion` -- not found (related to TODO stub for accountService)
- `cleanup-expired` -- `cleanup-storage` may serve this purpose
- `dm-metadata` -- not found (may be handled by triggers)

**Deployment verification requires `supabase functions list` with active CLI login to the dev project, or checking the Supabase dashboard directly.**

## FriendsScreen Special Notes

FriendsScreen.tsx has the highest concentration of stubs (5 TODO comments covering ~10 functions):
- `getMutualFriendSuggestions` -- no equivalent (needs RPC or complex query)
- `batchGetUsers` -- could use profileService with `.in()` filter
- `hasUserSyncedContacts` -- needs column check on users table
- `checkContactsPermission` -- expo-contacts, not Supabase
- `getDismissedSuggestionIds` / `filterDismissedSuggestions` / `dismissSuggestion` -- needs new dismissed_suggestions storage
- `getBlockedByUserIds` / `getBlockedUserIds` -- blockService.getBlockedUsers exists but returns different shape
- `subscribeFriendships` -- needs Supabase Realtime subscription on friendships table
