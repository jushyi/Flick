# Phase 15.3 Issues / Enhancements

## Enhancement Request: Back navigation from profile to story/comment modal

**Reported:** During avatar navigation testing

**Current behavior:**
When clicking someone's profile from the stories modal or comments sheet, navigating to their profile and pressing back goes to the feed with a refresh.

**Desired behavior:**
Back navigation should return to the story/comment modal that was open before navigating to the profile.

**UX concern:**
The current behavior feels disconnected - users expect to return to where they were viewing content, not start fresh on the feed.

**Technical considerations:**

- This would require preserving modal state across navigation
- Options:
  1. Don't close modals when navigating to profile (keep them in background)
  2. Store modal state and reopen on back navigation
  3. Use navigation state to track where user came from
- React Navigation may need custom back handler or state persistence
- Could get complex with nested modals (comments sheet inside photo modal)

**Priority:** Enhancement (not blocking)

**Status:** Logged for future consideration
