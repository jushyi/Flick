# PLAN-01 Summary: Service Layer -- Caption Persistence

**Status:** SUCCESS
**Completed:** 2026-02-20
**Tasks:** 2/2 complete

## One-liner

Added `updateCaption()` and `photoCaptions` param to `batchTriagePhotos()` in photoService for atomic caption persistence to Firestore.

## What Was Done

### Task 1: Add updateCaption() function to photoService.js
- **Commit:** `e4429d9`
- **Files modified:** `src/services/firebase/photoService.js`
- Added `updateCaption(photoId, caption)` exported function
- Validates: missing photoId returns error, caption > 100 chars returns error
- Normalizes empty/whitespace-only strings to `null` (never stores `""`)
- Wrapped in `withTrace('photo/updateCaption')` for performance monitoring
- Uses `logger.info` / `logger.error` per project conventions
- Follows `{ success, error }` return pattern matching all other service functions

### Task 2: Modify batchTriagePhotos() to handle captions
- **Commit:** `50e8dd1`
- **Files modified:** `src/services/firebase/photoService.js`
- Added third parameter: `batchTriagePhotos(decisions, photoTags = {}, photoCaptions = {})`
- Caption write block placed after tag write block and before `triagePhoto()` call
- Mirrors the existing tag write pattern exactly (separate `updateDoc` before triage)
- Only writes non-empty trimmed captions for matching photoIds
- `triagePhoto()` left unchanged (no signature or logic modifications)
- Existing callers unaffected (new parameter defaults to empty object)

## Verification Results

- [x] `npm run lint` passes (zero errors in photoService.js)
- [x] `npm test` passes (738/738 tests, 0 regressions, 9 pre-existing skips)
- [x] `updateCaption` is exported and callable
- [x] `batchTriagePhotos` signature includes `photoCaptions` parameter
- [x] Empty/whitespace captions normalize to `null`

## Deviations from Plan

None -- plan executed exactly as written.

## Key Decisions

- Placed `updateCaption()` immediately after `updatePhotoTags()` (line ~1183) since they follow the same single-field update pattern
- Used `PhotoService.updateCaption:` prefix for logger messages to match the established naming convention in the file

## Commits

| Task | Hash      | Message                                                      |
|------|-----------|--------------------------------------------------------------|
| 1    | `e4429d9` | feat(captions): add updateCaption() function to photoService |
| 2    | `50e8dd1` | feat(captions): add photoCaptions parameter to batchTriagePhotos() |
