---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/FriendsScreen.js
autonomous: true
requirements: [QUICK-4]

must_haves:
  truths:
    - "Search results in the friends request tab show the user's actual profile photo, not the empty placeholder"
    - 'All other profile photo displays (friends list, incoming/sent requests, suggestions) continue working'
  artifacts:
    - path: 'src/screens/FriendsScreen.js'
      provides: 'Fixed searchUsers function with profilePhotoURL mapping'
      contains: 'profilePhotoURL'
  key_links:
    - from: 'src/screens/FriendsScreen.js (searchUsers)'
      to: 'src/components/FriendCard.js'
      via: 'user.profilePhotoURL prop'
      pattern: 'profilePhotoURL.*photoURL'
---

<objective>
Fix empty profile photo placeholders showing for search results in the Friends Request tab.

Purpose: When searching for people to add as friends, the FriendCard component expects `profilePhotoURL` on the user object, but the `searchUsers` function passes raw Firestore document data which stores the photo URL under the field name `photoURL`. This mismatch causes the FriendCard to see `profilePhotoURL` as undefined and render the empty placeholder instead of the actual profile photo.

Output: Search results display profile photos correctly.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/screens/FriendsScreen.js
@src/components/FriendCard.js
@src/utils/imageUtils.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Map profilePhotoURL in searchUsers results</name>
  <files>src/screens/FriendsScreen.js</files>
  <action>
In the `searchUsers` function (around line 554-562), the search results are constructed by spreading raw Firestore document data:

```js
results.push({
  userId: docSnap.id,
  ...docSnap.data(),
});
```

The Firestore user document stores the profile photo URL under the field `photoURL` (set by ProfileSetupScreen and EditProfileScreen). However, `FriendCard` destructures `profilePhotoURL` from the user prop (line 49 of FriendCard.js). Since raw Firestore data has `photoURL` but not `profilePhotoURL`, the photo never renders.

Fix: Explicitly map `profilePhotoURL` from the raw Firestore data, consistent with how `fetchFriends`, `fetchRequests`, and `handleSubscriptionChanges` already do it. Change the results.push block to:

```js
const data = docSnap.data();
results.push({
  userId: docSnap.id,
  ...data,
  profilePhotoURL: data.profilePhotoURL || data.photoURL,
});
```

This ensures `profilePhotoURL` is always set if either field exists in the Firestore document, matching the pattern used in every other user data mapping in FriendsScreen (lines 139, 197, 218, 395, 441).

Do NOT change FriendCard.js or any other file -- the FriendCard contract expecting `profilePhotoURL` is correct and consistent across the app. The bug is specifically in searchUsers not mapping the field.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx grep-ast "profilePhotoURL.\*photoURL" src/screens/FriendsScreen.js | head -20</automated>
<manual>Search for a user in the Friends Request tab and confirm their profile photo displays instead of the placeholder initial.</manual>
</verify>
<done>The searchUsers function in FriendsScreen.js explicitly maps profilePhotoURL from raw Firestore data (using profilePhotoURL || photoURL fallback), matching the pattern used in fetchFriends, fetchRequests, and handleSubscriptionChanges. Search results in the request tab show actual profile photos.</done>
</task>

</tasks>

<verification>
- Verify that the `searchUsers` function now includes `profilePhotoURL: data.profilePhotoURL || data.photoURL` in the results mapping
- Verify no other data flows were broken (friends list, incoming requests, sent requests, suggestions all still show photos)
- Grep for all `profilePhotoURL` references in FriendsScreen.js to confirm consistency
</verification>

<success_criteria>

- Searching for users in the Friends Request tab shows their actual profile photos
- Existing profile photo displays (friends list, requests, suggestions) remain unaffected
- The fix follows the same `profilePhotoURL || photoURL` pattern used throughout FriendsScreen.js
  </success_criteria>

<output>
After completion, create `.planning/quick/4-when-searching-people-in-the-friends-req/4-SUMMARY.md`
</output>
