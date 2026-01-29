---
phase: 08-user-albums
plan: FIX7
type: fix
---

<objective>
Fix 3 UAT issues from Phase 8 UAT round 2 related to photo picker and viewer functionality.

Source: 08-UAT2-ISSUES.md
Priority: 1 major, 2 minor
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

**Issues being fixed:**
@.planning/phases/08-user-albums/08-UAT2-ISSUES.md

**Affected components:**
@src/screens/AlbumPhotoPickerScreen.js
@src/components/AlbumPhotoViewer.js
</context>

<tasks>
<task type="auto">
  <name>Task 1: Fix UAT-017 - Add Photos navigates to wrong screen</name>
  <files>src/screens/AlbumPhotoPickerScreen.js</files>
  <action>
When adding photos to an existing album, navigate back to the album grid instead of ProfileMain.

Current behavior (line 116):

```javascript
navigation.navigate('ProfileMain');
```

Fix:

1. Check if isAddingToExisting (line 102 condition)
2. If adding to existing album: use navigation.goBack() to return to album grid
3. If creating new album: keep navigation.navigate('ProfileMain') to pop both screens

Updated handleCreatePress:

```javascript
if (result.success) {
  if (isAddingToExisting) {
    // Return to album grid
    navigation.goBack();
  } else {
    // Pop both CreateAlbum and PhotoPicker screens
    navigation.navigate('ProfileMain');
  }
}
```

  </action>
  <verify>
1. Open an existing album
2. Tap "Add Photos" button (or appropriate trigger)
3. Select some photos and tap Add
4. Should return to album grid showing updated photos, NOT Profile screen
  </verify>
  <done>Add Photos to existing album returns to album grid</done>
</task>

<task type="auto">
  <name>Task 2: Fix UAT-016 - Improve visual for photos already in album</name>
  <files>src/screens/AlbumPhotoPickerScreen.js</files>
  <action>
Make photos already in the album more visually distinct so users know they can't select them.

Current state: Photos in album show a gray checkmark overlay, but it's not distinct enough.

Improvements:

1. Change the disabled overlay to have higher opacity (e.g., 0.6 instead of 0.5)
2. Add "In Album" text label overlay on photos already in album
3. Use a different icon (checkmark-done-circle) or add badge-style indicator
4. Add subtle border or different background treatment

Implementation:

1. Update disabledOverlay style: backgroundColor 'rgba(0, 0, 0, 0.6)'
2. Add a small "In Album" text badge at bottom of photo
3. Replace checkmark icon with something like 'checkmark-done-circle' filled

Style additions needed:

```javascript
inAlbumBadge: {
  position: 'absolute',
  bottom: 6,
  left: 6,
  right: 6,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  borderRadius: 4,
  paddingVertical: 4,
},
inAlbumText: {
  fontSize: 10,
  color: '#fff',
  textAlign: 'center',
  fontWeight: '500',
},
```

Update renderPhoto to show "In Album" badge when isInAlbum is true.
</action>
<verify>

1. Create an album with some photos
2. Open album grid
3. Tap Add Photos button
4. Photos already in album show clearly as "In Album" and not selectable
5. Tapping them does nothing
   </verify>
   <done>Photos already in album have clear visual indicator (badge + overlay)</done>
   </task>

<task type="auto">
  <name>Task 3: Fix UAT-015 - Thumbnail indicator oscillation</name>
  <files>src/components/AlbumPhotoViewer.js</files>
  <action>
The thumbnail border indicator bounces back and forth during swipe because onScroll fires continuously during the gesture. Fix by using onMomentumScrollEnd instead.

Current behavior:

- handleScroll called on every scroll event (scrollEventThrottle={16})
- Updates currentIndex based on calculated position
- During fast swipes, index changes multiple times causing visual flicker

Fix approach:

1. Keep onScroll for smooth real-time position tracking during scroll
2. Add onMomentumScrollEnd handler for final index setting
3. In handleScroll: only update if scroll is NOT decelerating (user is actively swiping)
4. In onMomentumScrollEnd: set the final, definitive index

Actually simpler fix:

1. Remove currentIndex dependency from renderThumbnail to avoid re-renders
2. Use onMomentumScrollEnd for setting currentIndex instead of onScroll
3. Keep scrollEventThrottle but don't update state during scroll

Implementation:

```javascript
// Remove onScroll handler from FlatList for currentIndex updates
// Add onMomentumScrollEnd instead:
const handleMomentumScrollEnd = useCallback(
  event => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / SCREEN_WIDTH);
    if (newIndex >= 0 && newIndex < photos.length) {
      setCurrentIndex(newIndex);
    }
  },
  [photos.length]
);
```

Keep handleScroll but only for logging/debugging if needed, or remove it entirely.

On FlatList:

- Remove onScroll={handleScroll}
- Add onMomentumScrollEnd={handleMomentumScrollEnd}
  </action>
  <verify>

1. Open photo viewer with multiple photos
2. Swipe left/right to navigate between photos
3. Watch thumbnail bar - border indicator should move smoothly to final position
4. No bouncing or oscillation between thumbnails
   </verify>
   <done>Thumbnail indicator snaps cleanly to final position without oscillation</done>
   </task>
   </tasks>

<verification>
Before declaring plan complete:
- [ ] Add Photos returns to album grid (not Profile) when adding to existing album
- [ ] Photos already in album show clear "In Album" visual indicator
- [ ] Thumbnail indicator in viewer doesn't oscillate during swipes
- [ ] No regressions in create new album flow
- [ ] No regressions in photo viewer basic functionality
</verification>

<success_criteria>

- UAT-017: Add Photos navigation fixed
- UAT-016: Existing photos clearly marked
- UAT-015: Thumbnail indicator stable during navigation
  </success_criteria>

<output>
After completion, create `.planning/phases/08-user-albums/08-FIX7-SUMMARY.md`
</output>
