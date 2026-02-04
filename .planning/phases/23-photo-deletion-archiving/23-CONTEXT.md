# Phase 23: Photo Deletion & Archiving - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<vision>
## How This Should Work

Two distinct actions available from the photo viewer menu (three-dot menu, bottom right corner):

1. **Delete Forever** - Permanently removes the photo from storage and all references
2. **Remove from Journal** (Archive) - Hides photo from active views while preserving it in collection

When a photo is archived, it disappears from feed, stories bar, and the "Me" story card. The photo remains accessible through user-created albums and monthly albums on profile.

Restore works symmetrically — when viewing an archived photo in monthly albums, the same menu shows "Restore to Journal" to bring it back to active views.

The implementation is straightforward: an `archived` state on the photo document. All active view queries (feed, stories, Me card) filter by `archived: false`. Albums and monthly albums don't filter by this flag, so archived photos remain visible there.

Different menu options for different viewers: photo owner sees delete/archive options, friends viewing the photo see different options (report, etc.).

</vision>

<essential>
## What Must Be Nailed

- **Clear confirmation** - Users must clearly understand the difference between delete (permanent) and archive (hide) before acting
- **Safe cascading** - When deleting, properly clean up album references, reactions, comments — no orphaned data
- **Reversibility** - Archived photos can be easily restored to the journal via the same menu pattern

</essential>

<boundaries>
## What's Out of Scope

- Bulk selection — one photo at a time for delete/archive actions
- Trash with timer — delete means immediate permanent deletion, no 30-day recovery concept
- Storage management UI — no "you have X photos using Y storage" dashboard
- Selects impact — Selects pulls from device photos, completely separate from journal photos

</boundaries>

<specifics>
## Specific Ideas

- Three-dot menu positioned in **bottom right corner** of fullscreen photo viewer (thumb-friendly)
- Use existing **DropdownMenu pattern** from album photo viewer for consistency
- Archive keeps photos in user-created albums, delete removes them
- Menu shows different options based on viewer (owner vs friend)

</specifics>

<notes>
## Additional Context

The `archived` flag approach means visibility changes emerge naturally from existing query patterns — just add a filter condition. This keeps the implementation focused on:

1. Adding the archived state to photo documents
2. Updating active view queries (feed, stories, Me card) to filter archived photos
3. Adding menu options and confirmation dialogs
4. Implementing the permanent delete with cascade cleanup

</notes>

---

_Phase: 23-photo-deletion-archiving_
_Context gathered: 2026-02-04_
