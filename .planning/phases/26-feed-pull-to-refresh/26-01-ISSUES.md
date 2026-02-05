# UAT Issues: Phase 26 Plan 01

**Tested:** 2026-02-05
**Source:** .planning/phases/26-feed-pull-to-refresh/26-01-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

[None]

## Resolved Issues

### UAT-001: Pull-to-refresh requires excessive scroll distance to trigger

**Discovered:** 2026-02-05
**Resolved:** 2026-02-05 - Inline fix during UAT
**Phase/Plan:** 26-01
**Severity:** Major
**Feature:** Pull-to-refresh functionality
**Description:** Pull-to-refresh requires an unusually long downward swipe to trigger. Users must scroll much farther than expected compared to standard iOS/Android pull-to-refresh behavior.
**Expected:** Pull-to-refresh should trigger with a moderate pull distance (standard 80-100px threshold)
**Actual:** Requires excessive scroll distance to trigger refresh
**Fix:** Removed custom `canRefresh` threshold gating (REFRESH_THRESHOLD = -70) that was blocking native RefreshControl behavior. Now uses standard RefreshControl behavior.
**Repro:**

1. Go to feed screen
2. Pull down to trigger refresh
3. Notice the distance required is much longer than expected

### UAT-002: Story bar skeleton shows circular shapes instead of rectangular cards

**Discovered:** 2026-02-05
**Resolved:** 2026-02-05 - Inline fix during UAT
**Phase/Plan:** 26-01
**Severity:** Cosmetic
**Feature:** Loading skeleton appearance
**Description:** When pull-to-refresh shows the loading skeleton, the story bar shows circular placeholder shapes instead of rectangular card shapes that match the actual story cards.
**Expected:** Story skeleton shapes should be rectangular to match the actual FriendStoryCard components
**Actual:** Story skeleton shows circles instead of rectangles
**Fix:**

- Updated `renderStoriesLoadingSkeleton` in FeedScreen.js to use rectangular placeholders (94x136 with borderRadius: 14)
- Added shimmer animation (800ms sweep) to match FeedLoadingSkeleton behavior
- Added small name text placeholders under cards
- Updated condition to show skeleton during both initial load and pull-to-refresh
  **Repro:**

1. Go to feed screen
2. Pull down to refresh (when it triggers)
3. Observe story bar skeleton shows circles, not rectangles

---

_Phase: 26-feed-pull-to-refresh_
_Plan: 01_
_Tested: 2026-02-05_
