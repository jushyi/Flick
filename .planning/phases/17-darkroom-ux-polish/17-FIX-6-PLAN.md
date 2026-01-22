---
phase: 17-darkroom-ux-polish
plan: FIX-6
type: fix
---

<objective>
Fix 2 UAT issues from plan FIX-5.

Source: 17-FIX-5-ISSUES.md
Priority: 0 critical, 2 major, 0 minor
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

**Issues being fixed:**
@.planning/phases/17-darkroom-ux-polish/17-FIX-5-ISSUES.md

**Original plan for reference:**
@.planning/phases/17-darkroom-ux-polish/17-FIX-4-PLAN.md

**Source files:**
@src/components/SwipeablePhotoCard.js
@src/screens/DarkroomScreen.js
</context>

<tasks>
<task type="auto">
  <name>Task 1: Fix UAT-015 (black flash after cascade)</name>
  <files>src/components/SwipeablePhotoCard.js, src/screens/DarkroomScreen.js</files>
  <action>
The black flash occurs at the end of the cascade animation because the photo is removed from state immediately after the exit animation completes, but the cascade animation (spring-based) may still be in progress. This causes a brief moment where the stack cards haven't fully animated to their new positions.

Root cause analysis:
1. Exit animation is 400ms with cubic easing (deterministic timing)
2. Cascade animation uses springs (variable timing, typically ~300-400ms)
3. Photo removal happens in the handleArchive/handleJournal callback AFTER exit animation
4. If cascade hasn't finished, the new front card may not be in position 0 yet

Fix approach (two-pronged):
1. Make backgrounds transparent so even if timing gap exists, no flash is visible
2. Add small delay before photo removal as a safety net

Implementation:
1. In SwipeablePhotoCard.js:
   - Change cardContainer backgroundColor from '#000000' to 'transparent'
   - Change photoImage backgroundColor from '#000000' to 'transparent'
2. In DarkroomScreen.js:
   - Add a 150ms delay before removing the photo from state in handleTriage
   - This gives spring animations time to settle as a backup

The transparent backgrounds eliminate the flash entirely - the delay is just extra insurance.
  </action>
  <verify>
1. Open darkroom with 2+ photos
2. Swipe or tap to remove front card
3. Observe smooth transition with no black flash after cascade completes
4. The next card should appear seamlessly as it animates to front position
  </verify>
  <done>No black flash visible after cascade animation - smooth continuous transition from one card to the next</done>
</task>

<task type="auto">
  <name>Task 2: Fix UAT-016 (button animation too fast)</name>
  <files>src/components/SwipeablePhotoCard.js</files>
  <action>
The button-triggered animations use the same EXIT_DURATION (400ms) as swipe-triggered animations, but the user reports button animations feel too fast and need to be ~3x slower (i.e., ~1200ms duration).

The difference in perception likely comes from:
- Swipe gestures have natural lead-in time as user drags the card
- Button taps trigger instant animation from rest position with no build-up
- The abrupt start makes the same duration feel faster

Fix: Create a separate constant for button-triggered animation duration (BUTTON_EXIT_DURATION = 1200ms) and use it in the imperative triggerArchive, triggerJournal, and triggerDelete methods. Keep the swipe gesture exit at 400ms since that already feels right with the drag lead-in.

Implementation:
1. Add BUTTON_EXIT_DURATION constant at 1200ms (3x the current 400ms)
2. Update triggerArchive to use BUTTON_EXIT_DURATION for translateX and translateY timing
3. Update triggerJournal to use BUTTON_EXIT_DURATION for translateX and translateY timing
4. Update triggerDelete to use BUTTON_EXIT_DURATION for translateY timing
5. Keep swipe gesture onEnd animations at EXIT_DURATION (400ms)
  </action>
  <verify>
1. Open darkroom with revealed photos
2. Tap Archive button - observe slower, more satisfying animation
3. Tap Journal button - observe slower, more satisfying animation
4. Swipe left/right - observe unchanged swipe animation speed (still 400ms)
5. Button animations should now feel similar in pace to swipe gestures
  </verify>
  <done>Button-triggered animations are ~3x slower (1200ms vs 400ms), matching the satisfying pace of swipe gestures</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Fixed cascade flash timing and slowed button animations</what-built>
  <how-to-verify>
1. Run: npx expo start
2. Open app on iOS device
3. Navigate to darkroom with 2+ revealed photos
4. Test UAT-015 fix:
   - Swipe card left or right
   - Watch cascade animation complete
   - Confirm NO black flash appears after cascade
   - Next card should appear smoothly
5. Test UAT-016 fix:
   - Tap Archive button - animation should be ~3x slower (satisfying pace)
   - Tap Journal button - animation should be ~3x slower
   - Tap Delete button - animation should be ~3x slower
   - Swipe gestures should still feel normal (unchanged)
6. Verify overall triage flow feels smooth and polished
  </how-to-verify>
  <resume-signal>Type "approved" if both issues fixed, or describe any remaining problems</resume-signal>
</task>
</tasks>

<verification>
Before declaring plan complete:
- [ ] No black flash after cascade animation (UAT-015)
- [ ] Button animations are ~3x slower, matching swipe pace (UAT-016)
- [ ] Swipe gesture animations unchanged (still 400ms)
- [ ] Overall triage flow feels smooth
</verification>

<success_criteria>
- All UAT issues from 17-FIX-5-ISSUES.md addressed
- App runs without errors
- Ready for re-verification
</success_criteria>

<output>
After completion, create `.planning/phases/17-darkroom-ux-polish/17-FIX-6-SUMMARY.md`
</output>
