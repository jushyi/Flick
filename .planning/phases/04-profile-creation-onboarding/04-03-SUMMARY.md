# Plan 04-03 Summary: Drag-to-Reorder with Delete Bar

## What Was Built

Implemented drag-to-reorder functionality for the SelectsScreen thumbnail strip with a delete bar that appears when dragging.

## Key Changes

### DraggableThumbnail Component

- Created inline component with Pan gesture (react-native-gesture-handler)
- Long press (200ms) activates drag mode
- Horizontal drag reorders thumbnails
- Tracks absolute Y position for delete zone detection
- Visual feedback: scale up (1.1x) when dragging, other thumbnails dim (0.6 opacity)

### Delete Bar

- Replaces "Complete Profile Setup" button when dragging
- Shows "Drop to remove" text with trash icon
- Highlights when thumbnail hovers over it ("Release to delete")
- Uses absolute Y position detection for accurate drop targeting

### Reorder Logic

- Calculates target index based on horizontal translation
- Updates selectedPhotos array with moved item
- Adjusts selectedIndex appropriately when items shift

### Layout Alignment

- Thumbnail strip edges aligned with preview and button using marginHorizontal
- overflow: visible throughout hierarchy for drag escape

## Files Modified

- `src/screens/SelectsScreen.js` - All changes in this file

## Technical Decisions

1. **Absolute Y position for delete detection**: Used `event.absoluteY >= deleteZoneY` instead of translation threshold since the delete bar is directly below the thumbnail strip
2. **Button/delete bar swap**: When dragging, the button area transforms into the delete zone - cleaner UX than a separate delete overlay
3. **Long press activation**: 200ms delay distinguishes tap (preview selection) from drag (reorder/delete)

## Commits

- `374c533` - feat(04-03): implement draggable thumbnails with reorder
- `735fd67` - feat(04-03): add delete bar that appears when dragging
- `f98b0e2` - fix(04-03): restore horizontal ScrollView for thumbnails
- `1cfa0e0` - fix(04-03): fix preview/thumbnail overlap with spacer
- `8698807` - fix(04-03): increase button padding to prevent clipping
- `d7f3ced` - fix(04-03): make delete bar absolute, only render when dragging
- `acf819e` - fix(04-03): combine delete bar with button area
- `169ceee` - fix(04-03): allow thumbnail overflow for drag visibility
- `51be4cf` - fix(04-03): increase delete zone threshold
- `7b8bd3d` - fix(04-03): use absolute Y position for delete zone detection
- `eb507c8` - fix(04-03): align thumbnail strip edges with preview and button
- `ce19a78` - fix(04-03): use marginHorizontal to align thumbnail strip
- `b7b6676` - fix(04-03): remove overflow visible to fix thumbnail alignment
- `4cb790a` - fix(04-03): add overflow visible to section for drag escape
- `f0143c1` - fix(04-03): add overflow visible throughout hierarchy for drag

## Verification

- [x] Thumbnails can be dragged horizontally
- [x] Reorder updates the array correctly
- [x] Visual feedback during drag (scale, opacity changes)
- [x] Delete bar appears when dragging (replaces button)
- [x] Delete bar highlights when thumbnail hovers over it
- [x] Dropping on delete bar removes the photo
- [x] X buttons removed from thumbnails (drag-to-delete replaces them)
- [x] Short taps still work for preview selection
- [x] Thumbnail strip edges aligned with preview and button
- [x] No crashes or jank during interactions
