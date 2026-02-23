---
phase: quick-03
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/hooks/useMessages.js
  - src/screens/ConversationScreen.js
autonomous: true
requirements: [QUICK-03]

must_haves:
  truths:
    - 'Friend profile photos display correctly in the MessagesScreen conversation list'
    - 'Friend profile photos display correctly in the ConversationScreen header'
    - 'Profile photos update when a friend changes their photo (without app restart)'
  artifacts:
    - path: 'src/hooks/useMessages.js'
      provides: 'Friend profile cache with TTL-based invalidation'
    - path: 'src/screens/ConversationScreen.js'
      provides: 'Fresh friend profile fetch on conversation open'
  key_links:
    - from: 'src/hooks/useMessages.js'
      to: 'Firestore users collection'
      via: 'getDoc with cache TTL check'
      pattern: 'friendProfileCacheRef'
    - from: 'src/screens/ConversationScreen.js'
      to: 'Firestore users collection'
      via: 'getDoc on mount for fresh friendProfile'
      pattern: 'getDoc.*doc.*db.*users'
---

<objective>
Fix profile photos not showing properly in the Messages tab chat previews and conversation headers.

Purpose: Friend profile photos fail to load because the `useMessages` hook caches friend profile data (including download URLs) in a `useRef(new Map())` that never invalidates. When a friend updates their profile photo, Firebase Storage overwrites the same path (`profile-photos/{userId}/profile.jpg`) and generates a new download token, but the cached URL still has the old (now-invalid) token. The image silently fails to load. Additionally, `ConversationScreen` receives `friendProfile` via navigation params (a snapshot of the stale cache), so the conversation header also shows broken photos.

Output: Updated `useMessages.js` with TTL-based cache invalidation, and updated `ConversationScreen.js` that fetches fresh friend profile data on mount.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/hooks/useMessages.js
@src/components/ConversationRow.js
@src/components/ConversationHeader.js
@src/screens/ConversationScreen.js
@src/screens/MessagesScreen.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add TTL-based cache invalidation to useMessages friend profile cache</name>
  <files>src/hooks/useMessages.js</files>
  <action>
The `friendProfileCacheRef` (line 35) stores friend profiles forever. Add a TTL (time-to-live) mechanism so cached entries expire after 5 minutes.

Specific changes to `src/hooks/useMessages.js`:

1. Change the cache structure from `Map<string, ProfileData>` to `Map<string, { data: ProfileData, fetchedAt: number }>`. Each entry stores the profile data plus the timestamp when it was fetched.

2. In `fetchFriendProfiles` (line 46), update the `uncachedIds` filter to also include IDs whose cached entry is older than 5 minutes (300000ms):

   ```javascript
   const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
   const now = Date.now();
   const uncachedIds = friendIds.filter(id => {
     const entry = cache.get(id);
     if (!entry) return true;
     return now - entry.fetchedAt > CACHE_TTL_MS;
   });
   ```

3. When storing fetched profiles (line 58-69), wrap the profile data with a `fetchedAt` timestamp:

   ```javascript
   cache.set(id, {
     data: {
       uid: id,
       username: data.username || 'unknown',
       displayName: data.displayName || 'Unknown User',
       profilePhotoURL: data.profilePhotoURL || data.photoURL || null,
       nameColor: data.nameColor || null,
       readReceiptsEnabled: data.readReceiptsEnabled,
     },
     fetchedAt: Date.now(),
   });
   ```

4. When reading from the cache (line 137 in the enrichedConversations map), extract `.data` from the cache entry:

   ```javascript
   const friendProfile = friendId ? profileCache.get(friendId)?.data : null;
   ```

5. Move the `CACHE_TTL_MS` constant to the top of the file (above the hook function) so it is clear and configurable.

Do NOT change the return shape of `useMessages` or any external API. The `friendProfile` objects attached to each conversation should retain the same fields: `uid`, `username`, `displayName`, `profilePhotoURL`, `nameColor`, `readReceiptsEnabled`.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/hooks/useMessages.js --no-error-on-unmatched-pattern</automated>
<manual>Open Messages tab -- conversation list rows should display friend profile photos. Navigate away and back -- photos should still show (cache hit). After 5 minutes, fresh data is fetched.</manual>
</verify>
<done>Friend profile cache entries expire after 5 minutes, forcing a re-fetch of profile data (including fresh download URLs) on the next subscription callback. Photos that previously failed to load due to stale tokens now display correctly.</done>
</task>

<task type="auto">
  <name>Task 2: Fetch fresh friend profile in ConversationScreen on mount</name>
  <files>src/screens/ConversationScreen.js</files>
  <action>
The `ConversationScreen` currently receives `friendProfile` entirely from navigation params (a snapshot from the cached data at navigation time). If the cache was stale, the conversation header also shows a broken photo.

Add a fresh Firestore fetch of the friend's profile on mount, falling back to the navigation param data while loading:

1. Add imports at the top of the file (following project import order):

   ```javascript
   import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
   ```

   Also import `useState` and `useEffect` (already partially imported -- ensure `useEffect` is added to the existing destructure from React).

2. After extracting `friendId` from `route.params`, add state + effect:

   ```javascript
   const [liveFriendProfile, setLiveFriendProfile] = useState(friendProfile);

   useEffect(() => {
     if (!friendId) return;
     let cancelled = false;
     const fetchProfile = async () => {
       try {
         const db = getFirestore();
         const snap = await getDoc(doc(db, 'users', friendId));
         if (snap.exists() && !cancelled) {
           const data = snap.data();
           setLiveFriendProfile({
             uid: friendId,
             username: data.username || friendProfile?.username || 'unknown',
             displayName: data.displayName || friendProfile?.displayName || 'Unknown User',
             profilePhotoURL: data.profilePhotoURL || data.photoURL || null,
             nameColor: data.nameColor || null,
             readReceiptsEnabled: data.readReceiptsEnabled,
           });
         }
       } catch (err) {
         // Silently fall back to navigation param profile on error
         logger.warn('ConversationScreen: Failed to fetch fresh friend profile', {
           friendId,
           error: err.message,
         });
       }
     };
     fetchProfile();
     return () => {
       cancelled = true;
     };
   }, [friendId]);
   ```

   Also import `logger` from `'../utils/logger'`.

3. Replace ALL references to `friendProfile` in the JSX and useMemo/useCallback blocks with `liveFriendProfile`:
   - `ConversationHeader friendProfile={liveFriendProfile}` (two places: loading state and main render)
   - `EmptyConversation displayName={liveFriendProfile?.displayName || 'them'}`
   - `navigation.navigate('OtherUserProfile', { userId: friendId, username: liveFriendProfile?.username })` (two places)
   - `navigation.navigate('ReportUser', { userId: friendId, username: liveFriendProfile?.username })` (two places)

4. Keep `friendProfile` from route.params as the initial value for `liveFriendProfile` so the screen renders immediately without a flash.

5. The `recipientEnabled` variable (line 59) already reads from `friendProfile?.readReceiptsEnabled`. Update it to use `liveFriendProfile?.readReceiptsEnabled` so read receipt privacy also reflects the latest data.

Do NOT change the `useConversation` hook call or any message-related logic. Only the friend profile display data changes.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/screens/ConversationScreen.js --no-error-on-unmatched-pattern</automated>
<manual>Open a conversation -- header should show the friend's current profile photo. If friend recently changed their photo, the header should update to the new photo after the fetch completes (near-instant, no visible flash since initial value is the nav param).</manual>
</verify>
<done>ConversationScreen fetches fresh friend profile data from Firestore on mount, ensuring the header profile photo and display name are always current, regardless of cache staleness in useMessages.</done>
</task>

</tasks>

<verification>
1. `npx eslint src/hooks/useMessages.js src/screens/ConversationScreen.js --no-error-on-unmatched-pattern` passes with no errors
2. `npm test` passes (existing tests unaffected -- no behavioral changes to message subscription or conversation logic)
3. Visual: Messages tab shows friend profile photos in conversation rows
4. Visual: Conversation screen header shows friend profile photo
5. Stale cache scenario: If a friend changes their profile photo, it updates in the messages list within 5 minutes (next subscription callback after TTL expires)
</verification>

<success_criteria>

- Friend profile photos render correctly in MessagesScreen conversation list (ConversationRow)
- Friend profile photos render correctly in ConversationScreen header (ConversationHeader)
- Profile photo updates propagate without requiring an app restart (5-minute TTL cache)
- No regressions in message subscription, unread counts, or read receipts
  </success_criteria>

<output>
After completion, create `.planning/quick/3-fix-profile-photos-not-showing-properly-/3-SUMMARY.md`
</output>
