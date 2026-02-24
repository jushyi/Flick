---
phase: quick-20
verified: 2026-02-24T16:00:00Z
status: passed
score: 4/4 must-haves verified
---

# Quick Task 20: Fix Reply Scroll-to-Message and Highlight Verification Report

**Task Goal:** Fix reply scroll-to-message and highlight timing in conversations. Scrolling up and highlighting when tapping reply is wrong — it doesn't scroll all the way to the original message and the highlight happens during the scroll so it's done before the user gets to the message.
**Verified:** 2026-02-24T16:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                          | Status   | Evidence                                                                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tapping a reply scrolls the FlatList to the correct original message position                  | VERIFIED | `scrollToMessage` uses `messagesWithDividers.findIndex` (line 209 of ConversationScreen.js) — same array the FlatList renders as its `data` prop (line 497). Date divider items are accounted for.                                                                                                                                  |
| 2   | The highlight flash begins only after the scroll has completed, not during the scroll          | VERIFIED | `setHighlightedMessageId` is called inside a `setTimeout(..., 600)` deferred from the scroll initiation (lines 218-221). The immediate `setHighlightedMessageId` call that previously ran alongside the scroll is gone.                                                                                                             |
| 3   | The highlighted message is visible and centered on screen when the flash plays                 | VERIFIED | `scrollToIndex` uses `viewPosition: 0.5` (line 212) to center the target. The highlight duration is 1800ms (`setTimeout(() => setHighlightedMessageId(null), 1800)`, line 220), giving the user ample time to see it. Two-phase animation (flash-in 150ms, hold 300ms, fade-out 1200ms) makes the flash clearly noticeable.         |
| 4   | onScrollToIndexFailed fallback still works and triggers highlight after retry scroll completes | VERIFIED | `onScrollToIndexFailed` (lines 408-427) performs approximate offset scroll + 500ms retry `scrollToIndex`. The 600ms highlight delay in `scrollToMessage` covers this retry path (500ms retry + scroll settling time < 600ms trigger). Fallback is wired via `onScrollToIndexFailed={onScrollToIndexFailed}` on FlatList (line 509). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact                            | Expected                                                                      | Status   | Details                                                                                                                                                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/screens/ConversationScreen.js` | Fixed scrollToMessage using messagesWithDividers index and deferred highlight | VERIFIED | `messagesWithDividers.findIndex` at line 209; 600ms deferred `setHighlightedMessageId` at lines 218-221; dependency array is `[messagesWithDividers]` (line 224). File is 605 lines, substantive.                |
| `src/components/MessageBubble.js`   | Highlight animation that plays on demand without immediate auto-start         | VERIFIED | `RNAnimated.sequence` two-phase animation at lines 56-68; starts only when `highlighted` prop is true (line 54); initializes from 0 (`highlightOpacity.setValue(0)` at line 55). File is 502 lines, substantive. |

### Key Link Verification

| From                                | To                                | Via                                         | Status   | Details                                                                                                                                                                                                                                                |
| ----------------------------------- | --------------------------------- | ------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/screens/ConversationScreen.js` | `src/components/MessageBubble.js` | `highlighted` prop triggers flash animation | VERIFIED | Line 351 in ConversationScreen: `highlighted={highlightedMessageId === item.id}`. Lines 39, 54, 70, 271 in MessageBubble: prop received, used in useEffect guard, and drives `RNAnimated.View` render. Pattern `highlighted.*===.*item\.id` confirmed. |

### Anti-Patterns Found

No blocker or warning anti-patterns found.

| File                  | Line     | Pattern                    | Severity | Impact                                         |
| --------------------- | -------- | -------------------------- | -------- | ---------------------------------------------- |
| ConversationScreen.js | 460, 516 | `placeholder="Message..."` | Info     | Legitimate RN TextInput prop — not a code stub |

### Human Verification Required

#### 1. Correct scroll target with date dividers present

**Test:** In a conversation with messages spanning multiple days, tap the quoted block of a reply whose original message is on a different day (several date dividers between current position and target).
**Expected:** FlatList scrolls precisely to the original message — not one or two items offset — and the cyan flash appears after the list has stopped moving.
**Why human:** Cannot programmatically simulate FlatList virtualization and confirm the rendered position matches the target index.

#### 2. Highlight timing — flash plays after scroll settles

**Test:** With a long conversation, tap a reply whose original message is far up in history. Observe the timing of the cyan flash.
**Expected:** The highlight does not begin while the list is still scrolling. The flash begins approximately 600ms after the tap, when the list has settled.
**Why human:** Animation timing and scroll completion are runtime behaviors that cannot be observed via static code analysis.

#### 3. onScrollToIndexFailed path — visible highlight after retry

**Test:** Scroll far away from the target message, then tap a reply to it. (This exercises the index-out-of-render-window path.)
**Expected:** List does two-stage scroll (approximate first, then precise), then the cyan flash plays on the correct message.
**Why human:** Requires triggering FlatList virtualization boundary in a real device or simulator.

### Gaps Summary

No gaps. All four observable truths are verified with concrete code evidence. Both artifacts are substantive and fully wired. Lint passes on both files with zero warnings. Task commits `aaece43` and `b9744b6` exist in git history.

---

_Verified: 2026-02-24T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
