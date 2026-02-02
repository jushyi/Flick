# UAT Issues: Phase 15 Plan 02

**Tested:** 2026-02-02
**Source:** .planning/phases/15-friends-screen-other-profiles/15-02-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

[None - all issues resolved in 15-02-FIX]

## Resolved Issues

### UAT-001: Empty profile song state visible and actionable on other users' profiles

**Discovered:** 2026-02-02
**Phase/Plan:** 15-02
**Severity:** Major
**Feature:** Other user profile viewing
**Resolution:** Fixed in 15-02-FIX (commit 74edd35)
**Fix:** Added conditional rendering - only show ProfileSongCard for other users if they have a song set

### UAT-002: Albums section not showing for friends

**Discovered:** 2026-02-02
**Phase/Plan:** 15-02
**Severity:** Major
**Feature:** Friend content visibility
**Resolution:** Fixed in 15-02-FIX (commits 969933b, ddc9a34)
**Fix:** Added friendshipStatusLoaded flag to prevent race condition, updated Firestore rules to allow friends to read albums

### UAT-003: Navigation issues with other user profiles - goes to Profile tab

**Discovered:** 2026-02-02
**Phase/Plan:** 15-02
**Severity:** Major
**Feature:** Profile navigation
**Resolution:** Fixed in 15-02-FIX (commit c2d9d20)
**Fix:** Added OtherUserProfile screen to root stack, updated FriendsScreen navigation to use modal overlay pattern

### UAT-004: Monthly albums section hidden for friends

**Discovered:** 2026-02-02
**Phase/Plan:** 15-02
**Severity:** Major
**Feature:** Friend content visibility
**Resolution:** Fixed in 15-02-FIX (commits 969933b, ddc9a34)
**Fix:** Removed isOwnProfile gate on MonthlyAlbumsSection, updated Firestore rules to allow friends to read photos

## Notes

- Friend albums may still show permission errors in some cases - additional Firestore rules or query structure changes may be needed
- This is noted for potential follow-up investigation

---

_Phase: 15-friends-screen-other-profiles_
_Plan: 02_
_Fixed: 2026-02-02 in 15-02-FIX_
