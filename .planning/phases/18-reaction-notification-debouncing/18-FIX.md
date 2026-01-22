---
phase: 18-reaction-notification-debouncing
plan: 18-FIX
type: fix
---

<objective>
Fix 3 UAT issues from phase 18 (plans 18-01 and 18-02).

Source: 18-ISSUES.md
Priority: 1 blocker, 1 minor, 1 cosmetic
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

**Issues being fixed:**
@.planning/phases/18-reaction-notification-debouncing/18-ISSUES.md

**Original plans for reference:**
@.planning/phases/18-reaction-notification-debouncing/18-01-PLAN.md
@.planning/phases/18-reaction-notification-debouncing/18-02-PLAN.md

**Affected files:**
@firestore.rules
@src/screens/NotificationsScreen.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix UAT-001 - Firestore permission denied for notifications collection</name>
  <files>firestore.rules</files>
  <action>
The Firestore security rules for the notifications collection check `resource.data.userId` but the notifications documents use `recipientId` as the field name (as defined in 18-01).

Fix the notifications collection rules (lines 141-156):

1. Change `resource.data.userId` to `resource.data.recipientId` in the read rule
2. Change `isOwner(resource.data.userId)` to check `resource.data.recipientId == request.auth.uid` in update/delete rules

Current rule (broken):
```
allow read: if isAuthenticated() &&
               resource.data.userId == request.auth.uid;
```

Fixed rule:
```
allow read: if isAuthenticated() &&
               resource.data.recipientId == request.auth.uid;
```

Apply same fix to update and delete rules - replace `userId` with `recipientId`.

After updating, deploy rules:
```bash
firebase deploy --only firestore:rules
```
  </action>
  <verify>
1. Run `firebase deploy --only firestore:rules` - should succeed
2. Open app, navigate to Feed, tap heart button
3. NotificationsScreen should load without permission errors
4. Check console for absence of `[firestore/permission-denied]` errors
  </verify>
  <done>
- Firestore rules updated to use `recipientId` instead of `userId`
- Rules deployed to Firebase
- NotificationsScreen loads without permission errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix UAT-002 - Add back button to NotificationsScreen header</name>
  <files>src/screens/NotificationsScreen.js</files>
  <action>
Add a back button (left chevron) to the NotificationsScreen header.

1. Add navigation hook import:
```javascript
import { useNavigation } from '@react-navigation/native';
```

2. Get navigation in component:
```javascript
const navigation = useNavigation();
```

3. Add TouchableOpacity import to react-native imports.

4. Update header to include back button:
```jsx
<View style={styles.header}>
  <TouchableOpacity
    onPress={() => navigation.goBack()}
    style={styles.backButton}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  >
    <Ionicons name="chevron-back" size={28} color="#000000" />
  </TouchableOpacity>
  <Text style={styles.headerTitle}>Notifications</Text>
</View>
```

5. Add style for back button:
```javascript
backButton: {
  marginRight: 8,
},
```

6. Update header style to use flexDirection: 'row' and alignItems: 'center':
```javascript
header: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 16, // Reduced from 24 to accommodate back button
  paddingVertical: 16,
  backgroundColor: '#FFFFFF',
  borderBottomWidth: 1,
  borderBottomColor: '#E0E0E0',
},
```
  </action>
  <verify>
1. Open app, navigate to NotificationsScreen via heart button
2. Back button (chevron-back icon) visible in header left side
3. Tapping back button returns to FeedScreen
  </verify>
  <done>
- Back button added to NotificationsScreen header
- Navigation.goBack() works correctly
  </done>
</task>

<task type="auto">
  <name>Task 3: Fix UAT-003 - Center empty state on screen</name>
  <files>src/screens/NotificationsScreen.js</files>
  <action>
The empty state container has `paddingTop: 100` which pushes content down instead of centering.

Fix emptyContainer style:

Current (broken):
```javascript
emptyContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 40,
  paddingTop: 100,  // This pushes content down
},
```

Fixed:
```javascript
emptyContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 40,
  // Remove paddingTop: 100 - let flex centering work
},
```

Also update listContent to ensure it fills the container:
```javascript
listContent: {
  flexGrow: 1,
  paddingBottom: 20, // Optional: add some bottom padding for better spacing
},
```
  </action>
  <verify>
1. Navigate to NotificationsScreen with no notifications
2. Empty state (heart icon + text) should be vertically centered on screen
3. Content should not appear pushed towards the bottom
  </verify>
  <done>
- Empty state properly centered vertically
- No extra padding pushing content off-center
  </done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] UAT-001: No Firestore permission errors when loading notifications
- [ ] UAT-002: Back button visible and functional in header
- [ ] UAT-003: Empty state vertically centered on screen
- [ ] All original functionality still works (notification list, pull-to-refresh)
- [ ] No console errors or warnings
</verification>

<success_criteria>
- All 3 UAT issues from 18-ISSUES.md addressed
- Firestore rules deployed
- NotificationsScreen fully functional with proper navigation and centering
- Ready for re-verification
</success_criteria>

<output>
After completion, create `.planning/phases/18-reaction-notification-debouncing/18-FIX-SUMMARY.md`:

# Phase 18 Fix Plan Summary

**[Substantive one-liner describing fixes]**

## Accomplishments
- [Fix 1 summary]
- [Fix 2 summary]
- [Fix 3 summary]

## Files Modified
- `firestore.rules` - Fixed recipientId field reference
- `src/screens/NotificationsScreen.js` - Added back button, centered empty state

## Issues Resolved
- UAT-001: Firestore permission denied (Blocker) - FIXED
- UAT-002: Missing back button (Minor) - FIXED
- UAT-003: Empty state not centered (Cosmetic) - FIXED

## Next Step
Re-run /gsd:verify-work 18 to confirm all issues resolved
</output>
