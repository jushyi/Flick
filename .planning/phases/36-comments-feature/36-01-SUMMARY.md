# Phase 36-01: Comment Service Layer - Summary

**Completed:** 2026-01-26
**Duration:** ~20 minutes
**Status:** COMPLETE

## What Was Built

### Task 1: Comment Service (commentService.js)

Created a comprehensive comment service with 5 core functions following established service patterns:

**Functions Implemented:**

1. **addComment(photoId, userId, text, mediaUrl, mediaType, parentId)**
   - Creates comments in subcollection `photos/{photoId}/comments/{commentId}`
   - Supports threading via `parentId` (single-level replies only)
   - Validates photo and parent comment existence
   - Prevents nested replies (replies to replies)
   - Atomically increments `commentCount` on photo document
   - Returns `{ success, commentId }` or `{ success: false, error }`

2. **deleteComment(photoId, commentId, requestingUserId)**
   - Authorization: comment author OR photo owner can delete
   - Cascading delete: if top-level comment, deletes all replies
   - Atomically decrements `commentCount` based on deleted count
   - Returns `{ success }` or `{ success: false, error }`

3. **getComments(photoId, limitCount)**
   - Fetches comments ordered by `createdAt` ascending (oldest first)
   - Joins user data (displayName, profilePhotoURL, username)
   - Uses shared `fetchUserData` helper with duplicate elimination
   - Returns `{ success, comments }` with user data merged

4. **subscribeToComments(photoId, callback, limitCount)**
   - Real-time listener using `onSnapshot`
   - Joins user data for all comments in snapshot
   - Callback receives `{ success, comments }` or `{ success: false, error, comments: [] }`
   - Returns unsubscribe function

5. **getPreviewComments(photoId, photoOwnerId)**
   - Fetches top-level comments only (no replies)
   - Prioritizes photo owner's comment first (caption behavior)
   - Returns 1-2 comments max for feed card preview
   - Returns `{ success, previewComments }` with user data

**Data Structure:**

```javascript
photos/{photoId}/comments/{commentId}
{
  userId: string,
  text: string,
  mediaUrl: string | null,
  mediaType: 'image' | 'gif' | null,
  parentId: string | null,  // null = top-level, id = reply
  likeCount: number,
  createdAt: serverTimestamp(),
}
```

### Task 2: Firestore Security Rules

Updated `firestore.rules` with comprehensive access control:

**Helper Functions Added:**

- `onlyChangesCommentCount()` - for comment count increment validation
- `onlyChangesReactionOrCommentFields()` - for combined field validation

**Photo Document Rules Updated:**

- Added Case 3: Any authenticated user can update `commentCount`

**Comments Subcollection Rules:**

- **Read:** Authenticated users can read comments
- **Create:** Must use own userId, likeCount must be 0, required fields validated
- **Update:** Only author can edit, restricted to text field only
- **Delete:** Comment author OR photo owner (via `get()` lookup)

**Likes Subcollection Rules (nested under comments):**

- **Read:** Authenticated users can read likes
- **Create:** Must use own userId
- **Delete:** Can only delete own likes

**Rules deployed successfully to Firebase.**

## Files Changed

| File                                      | Action   | Lines   |
| ----------------------------------------- | -------- | ------- |
| `src/services/firebase/commentService.js` | Created  | 553     |
| `firestore.rules`                         | Modified | +61, -3 |

## Commits

1. `4b918e4` - feat(36-01): create comment service with CRUD operations
2. `35d1428` - feat(36-01): add Firestore security rules for comments

## Patterns Used

- **Service pattern:** `{ success, data, error }` return objects
- **Logging:** Debug on entry, info on success, error on failure
- **User data joining:** Shared `fetchUserData` helper with deduplication
- **Atomic updates:** `FieldValue.increment()` for comment counts
- **Real-time listeners:** `onSnapshot` with cleanup via unsubscribe
- **Threading model:** Parent reference (`parentId`) for single-level replies
- **Security rules:** Field-level restrictions, owner OR author delete access

## Verification

- [x] commentService.js exists in `src/services/firebase/`
- [x] All 5 functions exported and follow service patterns
- [x] Firestore rules updated with comments subcollection
- [x] Firestore rules deployed successfully
- [x] No ESLint errors (auto-fixed by pre-commit hook)
- [x] Owner comment prioritized in preview (caption behavior)

## What's Next

Phase 36-02 will build the UI components:

- CommentsBottomSheet (main container)
- CommentInput (text entry with media buttons)
- CommentRow (individual comment display)
- CommentPreview (inline feed card preview)

---

_Phase: 36-comments-feature_
_Plan: 36-01-PLAN.md_
_Completed: 2026-01-26_
