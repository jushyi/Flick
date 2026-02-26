---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/imageUtils.js
  - src/components/CustomBottomTabBar.js
  - src/components/comments/CommentRow.js
  - src/components/comments/MentionSuggestionsOverlay.js
  - src/components/InAppNotificationBanner.js
autonomous: true
requirements: [QUICK-3]
must_haves:
  truths:
    - 'When a user updates their profile photo, all profile photo displays show the new image immediately'
    - 'Other users viewing the updated profile see the new photo, not a stale cached version'
    - 'The bottom tab bar profile icon reflects the current profile photo'
  artifacts:
    - path: 'src/utils/imageUtils.js'
      provides: 'Cache key generation that invalidates when photo URL changes'
      contains: 'token'
  key_links:
    - from: 'src/utils/imageUtils.js'
      to: 'All components using profileCacheKey'
      via: 'Cache key includes URL-unique token'
      pattern: 'profileCacheKey'
---

<objective>
Fix stale profile photo caching so that updated profile pictures display correctly for all viewers.

Purpose: Users who update their profile photo are seeing an old cached version on their own device, while some other users also see stale images. This is a cache invalidation bug in the `profileCacheKey` utility.

Output: Fixed cache key generation that properly invalidates when the Firebase Storage download URL changes, plus fixed static cache keys in components that never invalidate.
</objective>

<root_cause>

## Investigation Findings

The bug has been identified through code analysis. There are TWO distinct caching problems:

### Problem 1: `profileCacheKey` uses path-only hashing (affects 10 components)

In `src/utils/imageUtils.js`, the cache key is derived from the last 8 characters of the URL **path** (before the `?` query string):

```js
const base = photoURL.split('?')[0];
return `${prefix}-${base.slice(-8)}`;
```

Firebase Storage download URLs follow the pattern:
`https://firebasestorage.googleapis.com/.../profile-photos%2F{userId}%2Fprofile.jpg?alt=media&token={unique-token}`

Since the storage path is always `profile-photos/{userId}/profile.jpg`, the URL path never changes. The last 8 chars are always `ile.jpg` (or similar). The cache key is therefore IDENTICAL before and after a photo update.

The **token** query parameter is the ONLY part of the URL that changes when a new file is uploaded. But `profileCacheKey` explicitly strips it via `split('?')[0]`.

### Problem 2: Hardcoded static cache keys (affects 3 components)

Three components use completely static cache keys that never invalidate:

- `CustomBottomTabBar.js`: `cacheKey: 'profile-tab-icon'`
- `CommentRow.js`: `cacheKey: 'avatar-${comment.userId}'`
- `MentionSuggestionsOverlay.js`: `cacheKey: 'mention-${item.userId}'`
- `InAppNotificationBanner.js`: `cacheKey: 'notif-avatar'`

These cache keys contain no URL-derived component, so they will serve a stale image forever (until the user signs out, which clears the expo-image cache).

### Why it appears inconsistent across users

- Users who NEVER cached the old photo (new friends, new installs) see the correct new image because expo-image fetches fresh.
- Users who HAVE the old photo cached see the stale version because the cache key hasn't changed, so expo-image serves from disk/memory cache.
- The profile owner sees the old photo on their own ProfileScreen because `profileCacheKey` generates the same key, and the bottom tab bar uses a completely static key.
  </root_cause>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/utils/imageUtils.js
@src/components/CustomBottomTabBar.js
@src/components/comments/CommentRow.js
@src/components/comments/MentionSuggestionsOverlay.js
@src/components/InAppNotificationBanner.js
@src/screens/ProfileScreen.js (lines 906-918 — profile photo Image usage)
@src/services/firebase/storageService.js (lines 60-87 — upload generates new token URL)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix profileCacheKey to include URL token for proper cache invalidation</name>
  <files>src/utils/imageUtils.js</files>
  <action>
Fix the `profileCacheKey` function to derive the cache key from a URL component that actually changes when the file is re-uploaded. The Firebase Storage download URL token is the differentiator.

Replace the current implementation:

```js
const base = photoURL.split('?')[0];
return `${prefix}-${base.slice(-8)}`;
```

With a version that extracts the `token` query parameter from the Firebase Storage URL and uses it as the cache suffix. This is the only part of the URL that changes when a new file is uploaded to the same storage path.

Implementation:

```js
export const profileCacheKey = (prefix, photoURL) => {
  if (!photoURL) return prefix;
  // Firebase Storage URLs contain a unique token param that changes on re-upload.
  // Use the last 8 chars of the token as a cheap cache-busting identifier.
  const tokenMatch = photoURL.match(/token=([^&]+)/);
  if (tokenMatch) {
    return `${prefix}-${tokenMatch[1].slice(-8)}`;
  }
  // Fallback: use last 8 chars of full URL (includes query params) for non-Firebase URLs
  return `${prefix}-${photoURL.slice(-8)}`;
};
```

This ensures that when `uploadProfilePhoto` returns a new download URL with a new token, all components using `profileCacheKey` will compute a DIFFERENT cache key, causing expo-image to fetch the fresh image instead of serving the stale cached one.

Note: The fallback uses the full URL (not stripped of query params) to handle any non-Firebase URLs that might be passed.
</action>
<verify>
<automated>node -e "const { profileCacheKey } = require('./src/utils/imageUtils.js'); const url1 = 'https://firebasestorage.googleapis.com/v0/b/app.firebasestorage.app/o/profile-photos%2Fabc%2Fprofile.jpg?alt=media&token=aaa-bbb-111'; const url2 = 'https://firebasestorage.googleapis.com/v0/b/app.firebasestorage.app/o/profile-photos%2Fabc%2Fprofile.jpg?alt=media&token=ccc-ddd-222'; const key1 = profileCacheKey('profile-abc', url1); const key2 = profileCacheKey('profile-abc', url2); console.log('key1:', key1); console.log('key2:', key2); console.log('keys differ:', key1 !== key2); if (key1 === key2) { process.exit(1); }"</automated>
<manual>Verify the two different token URLs produce different cache keys</manual>
</verify>
<done>profileCacheKey generates different cache keys when the Firebase Storage token changes, ensuring expo-image fetches fresh images after profile photo updates</done>
</task>

<task type="auto">
  <name>Task 2: Fix static cache keys in components that never invalidate</name>
  <files>
    src/components/CustomBottomTabBar.js
    src/components/comments/CommentRow.js
    src/components/comments/MentionSuggestionsOverlay.js
    src/components/InAppNotificationBanner.js
  </files>
  <action>
Fix the four components that use completely static cache keys by switching them to use `profileCacheKey` (which was just fixed in Task 1).

**CustomBottomTabBar.js:**

1. Add import: `import { profileCacheKey } from '../utils/imageUtils';`
2. Change line 48 from:
   `source={{ uri: userProfile.photoURL, cacheKey: 'profile-tab-icon' }}`
   to:
   `source={{ uri: userProfile.photoURL, cacheKey: profileCacheKey('profile-tab', userProfile.photoURL) }}`

**CommentRow.js:**

1. Add import: `import { profileCacheKey } from '../../utils/imageUtils';`
2. Change the cacheKey from:
   `cacheKey: 'avatar-${comment.userId}'` (template literal with backticks)
   to:
   `cacheKey: profileCacheKey('avatar-' + comment.userId, profilePhotoURL)`

**MentionSuggestionsOverlay.js:**

1. Add import: `import { profileCacheKey } from '../../utils/imageUtils';`
2. Change from:
   `cacheKey: 'mention-${item.userId}'` (template literal with backticks)
   to:
   `cacheKey: profileCacheKey('mention-' + item.userId, item.profilePhotoURL)`

**InAppNotificationBanner.js:**

1. Add import: `import { profileCacheKey } from '../utils/imageUtils';`
2. Change from:
   `cacheKey: avatarUrl ? 'notif-avatar' : undefined`
   to:
   `cacheKey: avatarUrl ? profileCacheKey('notif-avatar', avatarUrl) : undefined`

All four changes follow the same pattern: replace static string cache keys with `profileCacheKey(prefix, url)` so the cache key includes URL-derived content that changes on photo updates.
</action>
<verify>
<automated>npx eslint src/components/CustomBottomTabBar.js src/components/comments/CommentRow.js src/components/comments/MentionSuggestionsOverlay.js src/components/InAppNotificationBanner.js --no-error-on-unmatched-pattern 2>&1; echo "---"; grep -n "profileCacheKey" src/components/CustomBottomTabBar.js src/components/comments/CommentRow.js src/components/comments/MentionSuggestionsOverlay.js src/components/InAppNotificationBanner.js</automated>
<manual>Verify all four files now use profileCacheKey instead of static strings</manual>
</verify>
<done>All profile photo cache keys across the app use URL-derived cache keys via profileCacheKey, ensuring no stale cached profile photos are served after updates</done>
</task>

</tasks>

<verification>
1. Run the inline node test for profileCacheKey to confirm different tokens produce different keys
2. Grep the entire src/ directory for any remaining static profile photo cacheKey strings:
   `grep -rn "cacheKey:.*'profile-tab-icon'\|cacheKey:.*'avatar-\|cacheKey:.*'mention-\|cacheKey:.*'notif-avatar'" src/`
   Should return zero results.
3. Grep for all profileCacheKey usages to confirm consistent adoption:
   `grep -rn "profileCacheKey" src/`
   Should show all profile photo Image components using the utility.
</verification>

<success_criteria>

- profileCacheKey generates unique cache keys when the Firebase Storage token changes
- No component uses a static/hardcoded cache key for profile photos
- All 14 profile photo display sites use profileCacheKey for cache key generation
- Zero lint errors in modified files
  </success_criteria>

<output>
After completion, create `.planning/quick/3-investigate-why-for-some-users-viewing-t/3-SUMMARY.md`
</output>
