# UAT Issues: Phase 17 Darkroom UX Polish

**Tested:** 2026-01-22
**Source:** .planning/phases/17-darkroom-ux-polish/17-01-SUMMARY.md, 17-02-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

None - all issues resolved in 17-FIX.

## Resolved Issues

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
