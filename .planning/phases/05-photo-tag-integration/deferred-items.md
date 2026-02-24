# Deferred Items - Phase 05

## Pre-existing Test Failure

**File:** `functions/__tests__/triggers/notifications.test.js`
**Test:** `onNewMessage - reaction handling > should not update lastMessage or unreadCount for reaction messages`
**Issue:** Test asserts `mockConvUpdate` should NOT be called for reaction messages, but the production code intentionally updates `lastMessage` for reactions (only `shouldIncrementUnread` is false). The test assertion is wrong -- it should verify that `unreadCount` is NOT incremented, not that `update` is never called.
**Discovery:** During 05-01-PLAN.md execution (Task 2)
**Impact:** Low -- pre-existing, not caused by Phase 05 changes
