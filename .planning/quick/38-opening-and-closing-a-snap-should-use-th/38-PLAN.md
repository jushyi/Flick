---
phase: quick-38
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/SnapViewer.js
  - src/components/SnapBubble.js
  - src/screens/ConversationScreen.js
autonomous: true
requirements: [QUICK-38]
must_haves:
  truths:
    - "Tapping an unopened snap expands from the bubble position to full-screen Polaroid"
    - "Closing the snap viewer (X, swipe-down, back button) shrinks the Polaroid back to the bubble position"
    - "If no source rect is available (e.g., notification deep link auto-open), graceful fallback to current fade animation"
    - "Reaction bar, caption, close button, and mark-as-viewed all still work exactly as before"
  artifacts:
    - path: "src/components/SnapViewer.js"
      provides: "Expand/suck-back animation matching story viewer pattern"
    - path: "src/components/SnapBubble.js"
      provides: "measureInWindow call to supply source rect on press"
    - path: "src/screens/ConversationScreen.js"
      provides: "Wiring source rect from SnapBubble through to SnapViewer"
  key_links:
    - from: "src/components/SnapBubble.js"
      to: "src/screens/ConversationScreen.js"
      via: "onPress callback now receives sourceRect from measureInWindow"
      pattern: "measureInWindow.*onPress"
    - from: "src/screens/ConversationScreen.js"
      to: "src/components/SnapViewer.js"
      via: "sourceRect prop passed alongside snapMessage state"
      pattern: "sourceRect.*snapViewerMessage"
---

<objective>
Replace the SnapViewer's fade-in/slide-down animation with the same expand-from-source / suck-back-to-source animation used by the story photo viewer (PhotoDetailScreen + usePhotoDetailModal).

Purpose: Snaps currently open with a basic Modal fade and close with a slide-down. Stories use a satisfying expand-from-card / suck-back-to-card animation. The user wants snaps to feel the same.

Output: SnapViewer opens by expanding from the tapped SnapBubble position and closes by shrinking back to it, matching the story viewer UX.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/SnapViewer.js (current snap viewer - Modal with fade/slide)
@src/components/SnapBubble.js (snap bubble in conversation - needs measureInWindow)
@src/screens/ConversationScreen.js (wires SnapBubble press to SnapViewer)
@src/hooks/usePhotoDetailModal.js (reference: expand/suck-back animation pattern, lines 107-183 for open, lines 609-683 for close)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add sourceRect measurement to SnapBubble and wire through ConversationScreen</name>
  <files>src/components/SnapBubble.js, src/screens/ConversationScreen.js</files>
  <action>
**SnapBubble.js:**

1. Add a `useRef` for the bubble container (the TouchableOpacity when interactive). Import `useRef` from React.

2. Modify `handlePress` to measure the bubble position before calling `onPress`. When the bubble is tapped and `isUnopened && onPress`:
   - Call `bubbleRef.current.measureInWindow((x, y, width, height) => { onPress({ x, y, width, height, borderRadius: 4 }); })`
   - The borderRadius 4 matches the bubble's `borderRadius: 4` in styles.
   - Fallback: if measureInWindow fails or ref is null, call `onPress(null)` so the viewer still opens.

3. Attach `ref={bubbleRef}` to the TouchableOpacity that wraps interactive snaps (the one at line ~130).

**ConversationScreen.js:**

1. Add a new state: `const [snapSourceRect, setSnapSourceRect] = useState(null);`

2. Modify `handleSnapPress` (line ~377) to accept `sourceRect` as a second parameter:
   ```javascript
   const handleSnapPress = useCallback(
     (message, sourceRect) => {
       const isCurrentUser = message.senderId === user.uid;
       const isViewed = message.viewedAt !== null && message.viewedAt !== undefined;
       if (!isCurrentUser && !isViewed) {
         setSnapSourceRect(sourceRect || null);
         setSnapViewerMessage(message);
       }
     },
     [user.uid]
   );
   ```

3. Update the snap press handler in `renderItem` (line ~446) to pass sourceRect through:
   Change `() => handleSnapPress(item)` to `(sourceRect) => handleSnapPress(item, sourceRect)`

4. Pass `sourceRect={snapSourceRect}` as a new prop to the SnapViewer component (line ~695).

5. On close, clear the sourceRect: update the `onClose` callback to also `setSnapSourceRect(null)`:
   ```javascript
   onClose={() => {
     setSnapViewerMessage(null);
     setSnapSourceRect(null);
   }}
   ```
  </action>
  <verify>
    Run `npx expo lint src/components/SnapBubble.js src/screens/ConversationScreen.js` -- no errors.
    Grep for `measureInWindow` in SnapBubble.js to confirm it exists.
    Grep for `snapSourceRect` in ConversationScreen.js to confirm wiring.
  </verify>
  <done>SnapBubble measures its position on press and passes it through ConversationScreen to SnapViewer as a sourceRect prop.</done>
</task>

<task type="auto">
  <name>Task 2: Replace SnapViewer Modal fade with expand/suck-back animation</name>
  <files>src/components/SnapViewer.js</files>
  <action>
Replace the current `Modal animationType="fade"` approach with a custom Reanimated expand/suck-back animation matching the story viewer pattern from `usePhotoDetailModal.js`.

**Key changes:**

1. **Accept `sourceRect` prop** in the component signature (add after `currentUserId`).

2. **Add new shared values** for the expand/collapse animation (keep existing `translateY` and `opacity`):
   ```javascript
   const scale = useSharedValue(1);
   const animTranslateX = useSharedValue(0);
   const openProgress = useSharedValue(0); // 0 = source position, 1 = full screen
   ```

3. **Compute source transform** from sourceRect (same pattern as usePhotoDetailModal lines 121-134):
   ```javascript
   const sourceTransform = useMemo(() => {
     if (!sourceRect) return null;
     const scaleX = sourceRect.width / screenWidth;
     const scaleY = sourceRect.height / screenHeight;
     const s = Math.min(scaleX, scaleY);
     const cx = sourceRect.x + sourceRect.width / 2;
     const cy = sourceRect.y + sourceRect.height / 2;
     return {
       scale: s,
       translateX: cx - screenWidth / 2,
       translateY: cy - screenHeight / 2,
       borderRadius: sourceRect.borderRadius || 4,
     };
   }, [sourceRect, screenWidth, screenHeight]);
   ```

4. **Opening animation** (in the existing `useEffect` that resets on `visible`):
   - If `sourceTransform` exists: set initial position at source (openProgress=0, opacity=0), then animate openProgress to 1 with `withTiming` (duration 280ms, easing out cubic) and opacity to 1 with `withTiming` (duration 150ms).
   - If no sourceTransform (fallback): just animate opacity from 0 to 1 (withTiming 200ms) -- same as current fade behavior.

5. **Animated container style** that interpolates between source and full-screen positions:
   ```javascript
   const animatedContainerStyle = useAnimatedStyle(() => {
     if (!sourceTransform) {
       // Fallback: just translateY (existing swipe behavior) + opacity
       return {
         transform: [{ translateY: translateY.value }],
         opacity: opacity.value,
       };
     }
     const progress = openProgress.value;
     const currentScale = interpolate(progress, [0, 1], [sourceTransform.scale, 1]);
     const currentTX = interpolate(progress, [0, 1], [sourceTransform.translateX, 0]);
     const currentTY = interpolate(progress, [0, 1], [sourceTransform.translateY, 0]);
     return {
       transform: [
         { translateX: currentTX + animTranslateX.value },
         { translateY: currentTY + translateY.value },
         { scale: currentScale * scale.value },
       ],
       opacity: opacity.value,
     };
   });
   ```

6. **Close animation** -- replace current dismiss logic. Create a `closeWithAnimation` function:
   - If sourceTransform exists: animate back to source (openProgress -> 0, opacity -> 0, duration 200ms, easing in cubic), then call handleDismiss.
   - If no sourceTransform: animate translateY to screenHeight + opacity to 0 (existing behavior), then call handleDismiss.
   - Update the close button's onPress to call `closeWithAnimation` instead of `handleDismiss` directly.

7. **Swipe-down gesture update** -- modify the `panGesture.onEnd`:
   - If threshold exceeded: call `closeWithAnimation()` instead of directly sliding off screen.
   - During the swipe, also drive `scale` down slightly (e.g., `1 - yTranslation / (screenHeight * 3)`) for the "shrinking while dragging" feel matching stories.

8. **Modal changes**:
   - Change `animationType="fade"` to `animationType="none"` since we handle our own animation.
   - The overlay background opacity should be driven by `opacity.value` so it fades in/out with the animation.

9. **Apply animated styles**:
   - Wrap the overlay in `Animated.View` with the overlay opacity style.
   - Wrap the polaroid container in `Animated.View` with `animatedContainerStyle` (replacing the current `animatedPolaroidStyle`).
   - The close button should also fade with the overlay.

10. **Import changes**: Add `interpolate, Easing as ReanimatedEasing` to the reanimated imports. Add `useMemo` to the React import.

**Important: Do NOT change any of the following behavior:**
- Reaction bar functionality (emoji press, selected state)
- Caption strip display
- Image loading/error states
- markSnapViewed on dismiss
- Live Activity ending on dismiss
- Android back button handling
- Haptic feedback on dismiss
  </action>
  <verify>
    Run `npx expo lint src/components/SnapViewer.js` -- no errors.
    Grep for `interpolate` and `openProgress` in SnapViewer.js to confirm expand/collapse is implemented.
    Grep for `animationType.*none` in SnapViewer.js to confirm Modal fade is disabled.
    Grep for `sourceRect` in SnapViewer.js to confirm prop is accepted.
  </verify>
  <done>
    SnapViewer expands from the source bubble position when opening and suck-backs to it when closing (X, swipe-down, or back button).
    When no sourceRect is available (notification auto-open), falls back to fade-in / slide-down behavior.
    All existing functionality (reactions, caption, mark-as-viewed, Live Activity, haptics) is preserved.
  </done>
</task>

</tasks>

<verification>
1. Open a conversation with an unopened snap. Tap the snap bubble. Verify the Polaroid expands outward from the bubble position.
2. Tap the X close button. Verify the Polaroid shrinks back to the bubble position.
3. Open the snap again. Swipe down to dismiss. Verify the suck-back animation plays (Polaroid shrinks as you drag, then springs back to bubble on release past threshold).
4. Verify reaction emojis still work (tap an emoji, see selection highlight).
5. Verify snap is marked as viewed after closing.
6. Test notification deep link auto-open (no sourceRect) -- should fall back to fade animation gracefully.
7. Test on Android: back button should trigger suck-back close animation.
</verification>

<success_criteria>
- Snap viewer open animation matches story viewer: expands from source bubble to full screen
- Snap viewer close animation matches story viewer: suck-back from full screen to source bubble
- Swipe-down dismiss includes scale-down effect during drag (matching stories)
- Fallback to fade when no sourceRect (notification auto-open, edge cases)
- All existing SnapViewer functionality unchanged (reactions, caption, viewed marking, Live Activity)
</success_criteria>

<output>
After completion, create `.planning/quick/38-opening-and-closing-a-snap-should-use-th/38-SUMMARY.md`
</output>
