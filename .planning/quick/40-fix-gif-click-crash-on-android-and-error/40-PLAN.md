---
phase: 40-fix-gif-click-crash
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/comments/GifPicker.js
  - src/components/DMInput.js
  - src/components/comments/CommentInput.js
autonomous: true
requirements: [GIF-CRASH-01]

must_haves:
  truths:
    - "Tapping the GIF button in conversation does not crash on Android"
    - "Tapping the GIF button in conversation does not show error screen on iOS"
    - "User sees a clear Alert if Giphy SDK is unavailable"
    - "GIF picker opens normally when SDK is properly initialized"
  artifacts:
    - path: "src/components/comments/GifPicker.js"
      provides: "Giphy initialization tracking and guarded openGifPicker"
      contains: "isGiphyInitialized"
    - path: "src/components/DMInput.js"
      provides: "Safe GIF button that checks SDK availability"
    - path: "src/components/comments/CommentInput.js"
      provides: "Same GIF safety guard for comment GIF picker"
  key_links:
    - from: "src/components/DMInput.js"
      to: "src/components/comments/GifPicker.js"
      via: "openGifPicker import"
      pattern: "openGifPicker"
---

<objective>
Fix the GIF button crash on Android and error screen on iOS when tapping the GIF
button in a conversation. The Giphy SDK's `GiphyDialog.show()` is being called
without checking whether the SDK was successfully initialized, causing a native
crash on Android (NullPointerException on uninitialized singleton) and the Giphy
error UI on iOS ("Something went wrong").

Purpose: Prevent app crashes and error states when the Giphy SDK is unavailable
(missing API key, initialization failure, or SDK not configured).

Output: Guarded GIF picker that gracefully handles uninitialized Giphy SDK state.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/comments/GifPicker.js
@src/components/DMInput.js
@src/components/comments/CommentInput.js
@src/screens/ConversationScreen.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Giphy SDK initialization tracking and guard openGifPicker</name>
  <files>src/components/comments/GifPicker.js</files>
  <action>
    Add a module-level boolean `let isGiphyInitialized = false;` to GifPicker.js.

    In `initializeGiphy()`:
    - Set `isGiphyInitialized = true` ONLY after `GiphySDK.configure({ apiKey })` succeeds
      (inside the try block, after the configure call).
    - Ensure it stays `false` if configure throws or if the early return triggers
      (missing/placeholder API key).

    Export a new function `isGiphyReady()` that returns the `isGiphyInitialized` boolean.
    Add it to the default export object as well.

    In `openGifPicker()`:
    - Add a guard at the top: if `!isGiphyInitialized`, call `Alert.alert('GIF Unavailable', 'GIF picker is not available right now.')` and return early. Import Alert from react-native.
    - Keep the existing try/catch around `GiphyDialog.configure()` and `GiphyDialog.show()`.
    - This prevents calling native Giphy methods on an uninitialized SDK.

    Follow project import organization: React/RN core first, then third-party, then internal.
    Use logger (not console.log) for any logging.
  </action>
  <verify>
    <automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/components/comments/GifPicker.js --max-warnings=0</automated>
    <manual>Verify the guard logic: openGifPicker should show Alert and return if SDK not initialized.</manual>
  </verify>
  <done>
    - `isGiphyInitialized` flag tracks SDK state
    - `isGiphyReady()` exported for external checks
    - `openGifPicker()` guards against uninitialized SDK with user-facing Alert
    - No native crash possible from calling GiphyDialog.show() on uninitialized SDK
  </done>
</task>

<task type="auto">
  <name>Task 2: Apply the same guard pattern to DMInput and CommentInput GIF buttons</name>
  <files>src/components/DMInput.js, src/components/comments/CommentInput.js</files>
  <action>
    In both DMInput.js and CommentInput.js:

    1. Import `isGiphyReady` from GifPicker:
       - DMInput: `import { openGifPicker, useGifSelection, isGiphyReady } from './comments/GifPicker';`
       - CommentInput: `import { openGifPicker, useGifSelection, isGiphyReady } from './GifPicker';`

    2. In the GIF button's press handler (DMInput: `handleGifPress`, CommentInput: `handleGifPick`),
       add a guard before calling `openGifPicker()`:
       ```
       if (!isGiphyReady()) {
         Alert.alert('GIF Unavailable', 'GIF picker is not available right now.');
         return;
       }
       ```
       This provides a double safety net (the guard in openGifPicker is the primary safety,
       this is defensive depth).

    Note: Alert is already imported in both files so no new import needed for Alert.
    Note: Do NOT change any other behavior -- send logic, media handling, etc. stay the same.

    Follow project conventions: camelCase functions, logger for logging (not console.log),
    import organization order (RN core, third-party, internal services, components, context, utils).
  </action>
  <verify>
    <automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/components/DMInput.js src/components/comments/CommentInput.js --max-warnings=0</automated>
    <manual>Read both files to confirm isGiphyReady guard is present before openGifPicker calls.</manual>
  </verify>
  <done>
    - DMInput GIF button guards against uninitialized Giphy SDK
    - CommentInput GIF button guards against uninitialized Giphy SDK
    - Both show user-friendly Alert when GIF picker is unavailable
    - No crash possible on either platform when tapping GIF button
  </done>
</task>

</tasks>

<verification>
1. `npx eslint src/components/comments/GifPicker.js src/components/DMInput.js src/components/comments/CommentInput.js --max-warnings=0` passes
2. Manual verification: Trace the code path from GIF button tap through to GiphyDialog.show() --
   the call should be blocked if isGiphyInitialized is false.
3. The fix is defensive -- works regardless of WHY the SDK failed to initialize (missing key,
   SDK error, race condition).
</verification>

<success_criteria>
- Tapping GIF button with uninitialized Giphy SDK shows Alert instead of crashing
- Tapping GIF button with initialized Giphy SDK works exactly as before (no regression)
- Both DMInput (conversations) and CommentInput (photo comments) are protected
- ESLint passes on all modified files
</success_criteria>

<output>
After completion, create `.planning/quick/40-fix-gif-click-crash-on-android-and-error/40-SUMMARY.md`

Remind user to deploy: `eas update --branch production --message "fix: guard GIF picker against uninitialized Giphy SDK"`
</output>
