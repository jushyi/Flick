# UAT Issues: Phase 33

**Tested:** 2026-01-25
**Source:** .planning/phases/33-feed-header-notifications/33-01-SUMMARY.md, 33-02-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

[None]

## Resolved Issues

### UAT-001: RNCViewPager native module missing from dev client

**Discovered:** 2026-01-25
**Resolved:** 2026-01-25 - Dev client rebuilt with new native modules
**Phase/Plan:** 33-01
**Severity:** Blocker
**Feature:** Activity screen tab navigation (MaterialTopTabNavigator)
**Description:** Activity screen shows "Unimplemented component: <RNCViewPager>" error when navigating to it
**Expected:** Activity screen displays with two swipeable tabs (Notifications, Friends)
**Actual:** Error screen showing unimplemented native component

**Root Cause:** `react-native-pager-view` was added as a dependency in Phase 33-01, but the dev client was built before this addition. The native module was not compiled into the dev client build.

**Resolution:** User rebuilt dev client with `npx expo run:ios`, which compiled the new native modules.

---

_Phase: 33-feed-header-notifications_
_Tested: 2026-01-25_
