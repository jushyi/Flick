---
phase: quick-15
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/ReadReceiptsSettingsScreen.js
  - src/screens/SettingsScreen.js
  - src/navigation/AppNavigator.js
autonomous: true
requirements: [QUICK-15]
must_haves:
  truths:
    - 'Read Receipts row in Settings navigates to a dedicated screen instead of toggling inline'
    - 'Dedicated Read Receipts screen shows toggle with explanation text, matching SoundSettings/NotificationSettings patterns'
    - 'Toggling read receipts on/off still works correctly with Firestore persistence'
  artifacts:
    - path: 'src/screens/ReadReceiptsSettingsScreen.js'
      provides: 'Dedicated read receipts settings page'
      min_lines: 80
    - path: 'src/screens/SettingsScreen.js'
      provides: 'Updated settings with navigation row instead of inline toggle'
    - path: 'src/navigation/AppNavigator.js'
      provides: 'ReadReceiptsSettings route in ProfileStackNavigator'
  key_links:
    - from: 'src/screens/SettingsScreen.js'
      to: 'ReadReceiptsSettings'
      via: 'navigation.navigate'
      pattern: 'navigate.*ReadReceiptsSettings'
    - from: 'src/navigation/AppNavigator.js'
      to: 'src/screens/ReadReceiptsSettingsScreen.js'
      via: 'Stack.Screen registration'
      pattern: 'ReadReceiptsSettings.*ReadReceiptsSettingsScreen'
---

<objective>
Move the read receipts toggle from an inline PixelToggle on SettingsScreen to its own dedicated page (ReadReceiptsSettingsScreen), consistent with how Notifications and Sounds each have dedicated screens.

Purpose: Consistency with the app's settings pattern where each privacy/notification setting has its own page with header, toggle, and explanatory text.
Output: New ReadReceiptsSettingsScreen.js, updated SettingsScreen.js (navigation row), updated AppNavigator.js (route registration).
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/screens/SettingsScreen.js
@src/screens/SoundSettingsScreen.js
@src/screens/NotificationSettingsScreen.js
@src/navigation/AppNavigator.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create ReadReceiptsSettingsScreen and update SettingsScreen + navigation</name>
  <files>src/screens/ReadReceiptsSettingsScreen.js, src/screens/SettingsScreen.js, src/navigation/AppNavigator.js</files>
  <action>
1. Create `src/screens/ReadReceiptsSettingsScreen.js` following the exact pattern of SoundSettingsScreen.js:
   - Same header layout: back chevron, centered title "Read Receipts", spacer
   - Same SafeAreaView + ScrollView structure
   - Same StyleSheet pattern (inline, not extracted to styles/ directory — matching SoundSettingsScreen)
   - Single master toggle row with PixelToggle:
     - Icon: `eye-outline` (same as current SettingsScreen row)
     - Label: "Read Receipts"
     - Subtitle: "Send and receive read receipts in conversations"
   - Toggle logic: Move the `handleReadReceiptsToggle` function from SettingsScreen into this new screen. It uses Alert.alert for confirmation when toggling OFF, and direct Firestore write when toggling ON. Value reads from `userProfile?.readReceiptsEnabled !== false` (defaults to true).
   - Info section below the toggle (matching SoundSettingsScreen's infoSection pattern):
     - Text: "When read receipts are off, you won't send or receive read receipts. Both you and the other person must have read receipts enabled for them to appear."
   - Imports: Use `useAuth` for `user`, `userProfile`, `updateUserProfile`. Use `getFirestore`, `doc`, `updateDoc` from `@react-native-firebase/firestore`. Use `logger` from utils. Use `PixelIcon`, `PixelToggle` components. Use `colors`, `spacing`, `typography` constants.
   - Follow project import ordering: React/RN core, third-party, services, components, context/hooks, utilities.

2. Update `src/screens/SettingsScreen.js`:
   - In the Privacy section, change the `readReceipts` item from an inline toggle to a navigation row:
     - Remove `isToggle: true`, `value`, `onToggle`, and `subtitle` properties
     - Add `onPress: () => handleNavigate('ReadReceiptsSettings')` (same pattern as other navigation rows)
     - Keep `id: 'readReceipts'`, `label: 'Read Receipts'`, `icon: 'eye-outline'`
   - Remove the `handleReadReceiptsToggle` function entirely (it moves to the new screen)
   - Remove the `getFirestore`, `doc`, `updateDoc` imports from `@react-native-firebase/firestore` since they are no longer used (the SettingsScreen no longer writes to Firestore directly — check if any other code in the file uses these imports before removing)

3. Update `src/navigation/AppNavigator.js`:
   - Import ReadReceiptsSettingsScreen: `import ReadReceiptsSettingsScreen from '../screens/ReadReceiptsSettingsScreen';`
   - Add a Stack.Screen in ProfileStackNavigator, right after the SoundSettings entry:
     ```
     <Stack.Screen
       name="ReadReceiptsSettings"
       component={ReadReceiptsSettingsScreen}
       options={{ headerShown: false }}
     />
     ```
     </action>
     <verify>
       <automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/screens/ReadReceiptsSettingsScreen.js src/screens/SettingsScreen.js src/navigation/AppNavigator.js --no-error-on-unmatched-pattern</automated>
       <manual>Open Settings screen, tap "Read Receipts" row, verify dedicated page opens with toggle and info text. Toggle on/off and confirm Firestore write works.</manual>
     </verify>
     <done>
   - ReadReceiptsSettingsScreen.js exists with header, toggle, info text, and Firestore persistence
   - SettingsScreen "Read Receipts" row navigates to new screen (no inline toggle)
   - AppNavigator registers ReadReceiptsSettings route in ProfileStackNavigator
   - All three files pass lint
     </done>
     </task>

</tasks>

<verification>
- `npx eslint src/screens/ReadReceiptsSettingsScreen.js src/screens/SettingsScreen.js src/navigation/AppNavigator.js` passes with no errors
- ReadReceiptsSettingsScreen follows same visual pattern as SoundSettingsScreen (header, toggle, info section)
- SettingsScreen Privacy section shows "Read Receipts" as a navigation row with chevron-forward (not an inline toggle)
</verification>

<success_criteria>

- Read Receipts has its own dedicated settings page matching the Notifications/Sounds pattern
- Toggle still correctly reads/writes readReceiptsEnabled to Firestore
- Confirmation alert still appears when toggling OFF
- No inline toggle remains on SettingsScreen
  </success_criteria>

<output>
After completion, create `.planning/quick/15-move-read-receipts-toggle-from-settings-/15-SUMMARY.md`
</output>
