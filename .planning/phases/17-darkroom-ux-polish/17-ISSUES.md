# UAT Issues: Phase 17 Darkroom UX Polish

**Tested:** 2026-01-22
**Source:** .planning/phases/17-darkroom-ux-polish/17-01-SUMMARY.md, 17-02-SUMMARY.md, 17-FIX-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

None - all Phase 17 issues resolved.

## Resolved Issues

### UAT-010: Cascade animation - card flashes gray before revealing
**Fixed:** 2026-01-22 in 17-FIX-3
**Commit:** 1f372da
**Solution:** Added fadeDuration={0} to Image component and backgroundColor matching card container to prevent gray flash during cascade.

### UAT-011: Enhancement request - blur background cards
**Fixed:** 2026-01-22 in 17-FIX-3
**Commit:** 367a8c3
**Solution:** Added animated stackBlurOpacityAnim with dark overlay (15% for index 1, 30% for index 2) that fades out as card moves to front.

### UAT-006: Stacked cards should peek from top at rest
**Fixed:** 2026-01-22 in 17-FIX-2
**Commit:** f2dbba9
**Solution:** Increased stack offset/opacity for visible deck at rest - stackIndex 1: -20px offset, 0.96 scale, 0.85 opacity; stackIndex 2: -40px offset, 0.92 scale, 0.70 opacity.

### UAT-007: Unwanted black border on photo cards
**Fixed:** 2026-01-22 in 17-FIX-2
**Commit:** f2dbba9
**Solution:** Removed borderWidth and borderColor from cardContainer style.

### UAT-008: Button-triggered animation too fast
**Fixed:** 2026-01-22 in 17-FIX-2
**Commit:** f2dbba9
**Solution:** Increased EXIT_DURATION from 250ms to 400ms for more visible arc motion.

### UAT-009: Next card appears with jump/flicker
**Fixed:** 2026-01-22 in 17-FIX-2
**Commit:** f2dbba9
**Solution:** Added animated shared values (stackScaleAnim, stackOffsetAnim, stackOpacityAnim) with useEffect to smoothly animate when stackIndex changes.

### UAT-001: Fixed arc path for card swipes
**Fixed:** 2026-01-22 in 17-FIX
**Commit:** ceb7712
**Solution:** Card now follows mathematically consistent arc (y = 0.4 * |x|) regardless of finger movement.

### UAT-002: Removed down-swipe delete gesture
**Fixed:** 2026-01-22 in 17-FIX
**Commit:** dc62132
**Solution:** Down-swipe delete gesture removed entirely. Delete only available via button.

### UAT-003: Button taps trigger flick animations
**Fixed:** 2026-01-22 in 17-FIX
**Commit:** ee3739b
**Solution:** Added forwardRef and useImperativeHandle for triggerArchive/Journal/Delete methods.

### UAT-004: Next photo card appears after swipe
**Fixed:** 2026-01-22 in 17-FIX
**Commit:** fe18b1a
**Solution:** Added key={currentPhoto.id} prop to force React remount with fresh animated values.

### UAT-005: Stacked deck visual with cascade animation
**Fixed:** 2026-01-22 in 17-FIX
**Commit:** 5dc3772
**Solution:** Render up to 3 cards stacked with scale/offset/opacity by depth, spring animation for cascade.

---

*Phase: 17-darkroom-ux-polish*
*Tested: 2026-01-22*
