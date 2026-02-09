# Phase 43: Comment Cleanup and Audit - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<vision>
## How This Should Work

A full sweep of code comments across the codebase. Many comments have drifted out of sync with the code they describe — they say one thing, the code does another. This phase reads through the codebase, identifies every comment that's inaccurate, outdated, or unnecessary, and either fixes it or removes it.

After this phase, every remaining comment in the codebase should accurately describe what the code actually does. No misleading information, no stale TODOs, no obvious restating of what the code already says.

</vision>

<essential>
## What Must Be Nailed

- **Accuracy above all** — Every remaining comment must truthfully describe what the code does. No misleading or outdated descriptions.
- **Remove stale TODOs/FIXMEs** — Clean out TODO, FIXME, and HACK comments that were already addressed or are no longer relevant.
- **Cut the noise** — Remove comments that just restate what the code obviously does. Comments should earn their place.

</essential>

<boundaries>
## What's Out of Scope

- No code behavior changes — only touch comments, never change the logic they describe
- No adding new documentation — don't add JSDoc or comments where none existed before
- No refactoring — if the code is messy but works, leave it; only fix what the comments say about it

</boundaries>

<specifics>
## Specific Ideas

No specific requirements — straightforward audit and cleanup of existing code comments across all source files.

</specifics>

<notes>
## Additional Context

This is the final phase of v1.7 Engagement & Polish. The codebase has grown through 42 phases of active development, so comment drift is expected. The goal is codebase hygiene — making sure the comments that remain are trustworthy for future development.

</notes>

---

_Phase: 43-comment-cleanup-audit_
_Context gathered: 2026-02-09_
