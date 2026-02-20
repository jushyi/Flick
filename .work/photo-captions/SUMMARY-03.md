# PLAN-03 Summary: Firestore Rules -- Caption Validation

**Plan:** PLAN-03
**Feature:** photo-captions
**Status:** Complete
**Duration:** ~5 minutes
**Completed:** 2026-02-20

## One-liner

Server-side caption validation added to Firestore photo update rules via `isValidCaptionIfPresent()` helper function.

## What Was Done

### Task 1: Add caption validation to Firestore photo update rules

Added a new helper function `isValidCaptionIfPresent()` and AND'd it into the owner update rule for the `photos/{photoId}` collection.

**Helper function logic:**
- If `caption` is NOT present in the document after update: allow (existing writes without caption continue to work)
- If `caption` IS present and is `null`: allow (clearing a caption)
- If `caption` IS present and is a string with length <= 100: allow
- Otherwise: deny (rejects oversized strings, non-string non-null values)

**Changes made:**
- Added `isValidCaptionIfPresent()` helper function (lines 88-96)
- Added `&& isValidCaptionIfPresent()` to the owner update condition (line 151)
- Added changelog comment at file header (line 5)

**Commit:** `391c6d1` - `feat(captions): add caption length validation to Firestore photo update rules`

## Files Modified

| File | Change |
|------|--------|
| `firestore.rules` | Added `isValidCaptionIfPresent()` helper, AND'd into owner update rule, added changelog comment |

## Verification

- [x] `firestore.rules` has valid syntax (all braces/parens balanced, no broken operators)
- [x] Caption validation is AND'd into the owner update rule
- [x] No changes to non-owner rules (reaction updates, comment count updates)
- [x] No changes to other collections (users, darkrooms, friendships, notifications, albums, blocks, reports, support requests)
- [x] Rule allows: no caption field, null caption, string <= 100 chars
- [x] Rule denies: string > 100 chars, non-string non-null values
- [x] All 82 tests pass
- [x] No new lint issues introduced

## Deviations from Plan

None - plan executed exactly as written.

## Notes

- The `request.resource.data` in Firestore rules represents the full document as it would exist after the update, not just the changed fields. This means `'caption' in request.resource.data` is true if the field exists in the resulting document, even if it was set in a previous write. For existing photos that have no caption field, writes that do not touch caption will have `caption` absent from `request.resource.data`, passing the first check.
- This is defense-in-depth. The client-side `maxLength={100}` on TextInput is the primary enforcement. These rules prevent malicious or buggy clients from writing oversized captions.
- The rules file must be deployed to Firebase separately from the app's OTA updates. Remind the user to deploy rules: `firebase deploy --only firestore:rules`
