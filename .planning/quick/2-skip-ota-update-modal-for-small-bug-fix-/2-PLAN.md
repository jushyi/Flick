---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/config/whatsNew.js
autonomous: true
requirements: [QUICK-2]
must_haves:
  truths:
    - "Next OTA update does not show the What's New modal to users"
    - 'The update ID is silently stored so future meaningful updates still trigger the modal'
  artifacts:
    - path: 'src/config/whatsNew.js'
      provides: 'Empty items array for silent patch'
      contains: 'items: []'
  key_links:
    - from: 'src/config/whatsNew.js'
      to: 'App.js'
      via: 'WHATS_NEW.items.length === 0 check on line 132'
      pattern: "WHATS_NEW\\.items\\.length === 0"
---

<objective>
Skip the "What's New" modal for the next OTA update by clearing the changelog items.

Purpose: The next OTA update is a small bug fix (keyboard avoiding view regression). Users do not need to see a modal for this. The existing silent patch mechanism already supports this — just set items to an empty array.

Output: Updated whatsNew.js config with empty items array.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/config/whatsNew.js
@App.js (lines 112-145 — What's New check logic)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Clear What's New items for silent patch</name>
  <files>src/config/whatsNew.js</files>
  <action>
Set the `items` array in WHATS_NEW to an empty array `[]`. This triggers the existing silent patch path in App.js (line 132-136) which stores the update ID without showing the modal.

Specifically, replace the current items array contents with an empty array. Keep the title and the file's doc comment intact so future developers know to populate items for meaningful updates.

The file should look like:

```js
/**
 * What's New changelog — update this before each `eas update`.
 *
 * Set items to [] for silent patches (modal won't show).
 */
export const WHATS_NEW = {
  title: "What's New",
  items: [],
};
```

  </action>
  <verify>
    <automated>node -e "const w = require('./src/config/whatsNew.js'); if (w.WHATS_NEW.items.length !== 0) { process.exit(1); } console.log('OK: items is empty array');"</automated>
    <manual>Verify src/config/whatsNew.js has items: []</manual>
  </verify>
  <done>WHATS_NEW.items is an empty array. The next OTA update will silently store the update ID without showing the What's New modal.</done>
</task>

</tasks>

<verification>
- src/config/whatsNew.js exports WHATS_NEW with items: [] (empty array)
- The existing App.js logic at line 132 already handles this case — no other file changes needed
</verification>

<success_criteria>

- WHATS_NEW.items is an empty array
- No other files modified (the silent patch logic already exists in App.js)
- Next `eas update` will not trigger the What's New modal for users
  </success_criteria>

<output>
After completion, create `.planning/quick/2-skip-ota-update-modal-for-small-bug-fix-/2-SUMMARY.md`
</output>
