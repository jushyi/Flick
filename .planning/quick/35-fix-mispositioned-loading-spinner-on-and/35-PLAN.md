---
phase: 35-fix-mispositioned-loading-spinner-on-and
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/PixelSpinner.js
autonomous: true
requirements:
  - QUICK-35
must_haves:
  truths:
    - "PixelSpinner renders centered within its parent on Android"
    - "PixelSpinner renders centered within its parent on iOS (no regression)"
  artifacts:
    - path: "src/components/PixelSpinner.js"
      provides: "Cross-platform centered pixel art spinner"
      contains: "View"
  key_links:
    - from: "src/components/PixelSpinner.js"
      to: "src/navigation/AppNavigator.js"
      via: "component import"
      pattern: "PixelSpinner"
---

<objective>
Fix PixelSpinner rendering at top-left (0,0) on Android instead of centering within its parent View.

Purpose: On Android, bare `react-native-svg` `<Svg>` elements do not properly inherit flexbox centering from parent Views. They default to top-left positioning. iOS handles this correctly, so the bug is Android-only.

Output: Updated PixelSpinner.js that centers correctly on both platforms.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/PixelSpinner.js
@src/navigation/AppNavigator.js (lines 411-444 — usage during initializing/profile-loading states)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wrap SVG in centering View inside PixelSpinner</name>
  <files>src/components/PixelSpinner.js</files>
  <action>
    In `src/components/PixelSpinner.js`:

    1. Add `View` to the import from `react-native`:
       ```javascript
       import { View } from 'react-native';
       ```

    2. Wrap the `<Svg>` element in a `<View>` that handles centering. The wrapper View should:
       - Use `alignItems: 'center'` and `justifyContent: 'center'` to center the SVG
       - Pass the incoming `style` prop to the wrapper View (not the Svg), so callers can still apply margin, position, etc.
       - Remove the `style={style}` from the `<Svg>` element since it moves to the wrapper

    The result should look like:
    ```jsx
    return (
      <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
        <Svg
          width={resolvedSize}
          height={resolvedSize}
          viewBox={`0 0 ${resolvedSize} ${resolvedSize}`}
        >
          {/* existing Rect map unchanged */}
        </Svg>
      </View>
    );
    ```

    This fixes ALL usages of PixelSpinner across the app (AppNavigator loading states, and any future usages) without needing to patch each call site.

    Do NOT change anything else in the component — the animation logic, memo wrapper, displayName, and pixel rendering are all correct.
  </action>
  <verify>
    <automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/components/PixelSpinner.js --no-error-on-unmatched-pattern</automated>
    <manual>Launch on Android emulator or device. Kill and reopen the app. Verify the loading spinner appears centered on screen during the initial auth check, not stuck at top-left corner. Also verify iOS still shows it centered (no regression).</manual>
  </verify>
  <done>PixelSpinner SVG is wrapped in a centering View. Spinner renders centered on both Android and iOS during app initialization.</done>
</task>

</tasks>

<verification>
- `npx eslint src/components/PixelSpinner.js` passes with no errors
- PixelSpinner.js contains a `<View>` wrapper with centering styles around the `<Svg>` element
- The `style` prop is applied to the outer View, not the Svg
- No other files are modified (fix is self-contained in the component)
</verification>

<success_criteria>
- Android: Loading spinner appears centered on screen during app launch (initializing state)
- iOS: No regression — spinner remains centered as before
- Lint passes cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/35-fix-mispositioned-loading-spinner-on-and/35-SUMMARY.md`
</output>
