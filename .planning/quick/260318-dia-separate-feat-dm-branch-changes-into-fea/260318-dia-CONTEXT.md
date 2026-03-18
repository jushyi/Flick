# Quick Task 260318-dia: Separate feat/dm branch changes — Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Task Boundary

Review all 426 commits on feat/dm branch (since main), summarize them, categorize each as "new feature" vs "bug fix/perf enhancement applicable to production main", then create a single hotfix branch off main with cherry-picked production-safe fixes that can be OTA deployed independently.

</domain>

<decisions>
## Implementation Decisions

### Cherry-pick Scope
- **Only fixes to code that exists on production main** — the current production build has NO DM, snap, streak, pinned snap, or photo tag features
- Bug fixes specific to new features (DM bubble restyle, snap viewer layout, streak UI tweaks) stay on feat/dm
- Only cherry-pick fixes that affect pre-existing screens/services: camera, feed, darkroom, profile, auth, notifications, Android platform fixes, etc.

### Branch Strategy
- Single hotfix branch off main (e.g., `hotfix/production-fixes`)
- All cherry-picked fixes go into one branch for a single OTA push
- feat/dm branch stays as-is with all feature work

### Conflict Resolution
- Cherry-pick and manually resolve conflicts when a fix touches files also modified by feature work
- Extract just the fix portion from mixed commits
- If a commit is too entangled with feature code, note it as "skipped — too entangled" in the summary

### Claude's Discretion
- Determining the exact list of cherry-pickable commits based on the scope rules above
- Ordering of cherry-picks (chronological recommended)
- Summary format and categorization taxonomy

</decisions>

<specifics>
## Specific Ideas

- User wants a comprehensive summary of ALL changes first, then the separation
- Production main has: camera, feed, darkroom, profile, auth, notifications, friends, albums, comments, activity — but NO messaging/DM, snaps, streaks, photo tags, pinned snaps, Live Activities
- The hotfix branch should be OTA-deployable via `eas update --branch production`

</specifics>
