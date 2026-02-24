# Phase 4: Snap Streaks - Research

**Researched:** 2026-02-24
**Domain:** Firestore state machine, scheduled Cloud Functions, real-time UI indicators
**Confidence:** HIGH

## Summary

Snap Streaks adds a server-authoritative streak tracking system that rewards daily mutual snap exchanges between friends. The implementation spans three layers: a Firestore `streaks` collection with deterministic IDs (matching the conversation ID pattern), Cloud Function logic to track snap exchanges and manage streak lifecycle, and client-side real-time subscriptions that drive visual changes to the existing snap icon across three UI locations.

The core architectural challenge is the state machine. Each streak document tracks mutual snap history using `lastSnapBy` maps and rolling 24-hour windows evaluated entirely server-side. The `onNewMessage` Cloud Function is extended to update streak data when a snap is sent, and a new `processStreakExpiry` scheduled function handles expiration and warning notifications. Client code is strictly read-only for streak data -- it subscribes to streak documents and derives display state (icon color, day count, warning indicator) from server-written fields.

This phase builds entirely on existing infrastructure: the conversation deterministic ID system, the `onNewMessage` trigger, the scheduled Cloud Function pattern (identical to `processDarkroomReveals`), and the notification preference system. No new dependencies are needed. All changes are JS-only (OTA-deployable).

**Primary recommendation:** Build the `streaks` Firestore collection with deterministic IDs matching conversation IDs, extend `onNewMessage` to track mutual snaps and increment streaks, add `processStreakExpiry` as a scheduled function, then layer client-side read-only subscriptions and icon rendering on top.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Streak Icon Design:**

- Streak modifies the existing snap icon -- no new separate icon
- Day count replaces the flash element inside the icon when streak is active
- Icon appears in 3 locations, all fully synced: ConversationRow, ConversationHeader, DMInput snap button
- Display-only (not tappable for details) -- no tooltip or popover
- Identical icon treatment across all 3 locations
- State transitions are instant (no animation between states)

**Icon Color States (5 states):**

1. Default (no streak): Muted gray
2. Building (day 1-2): Subtle warm tint, no number displayed
3. Pending (you snapped, waiting on them): Same warm tint as building state
4. Active (day 3+): Orange/amber fill, day count replaces flash inside icon
5. Warning (within 4h of expiry): Static red, "!" replaces day count -- no animation

**Color Deepening by Tier:**

- Day 3-9: Light amber
- Day 10-49: Orange
- Day 50+: Deep orange

**Expiry Windows (Tiered -- Progressive Leniency):**

- Base: 36 hours
- 10+ days: 48 hours
- 50+ days: 72 hours
- Day counter ticks every 24h after mutual snaps are exchanged
- 1 snap from each side is enough -- quantity beyond 1 does not matter

**Streak Lifecycle:**

- No celebration at activation (day 3) or milestones (10, 50)
- Counter just ticks up silently
- On expiry: silent reset -- icon returns to muted gray default, no system message in chat
- No personal best records or streak history

**Notification Behavior:**

- Single warning at 4 hours before expiry
- Sent to both users (not just the one who has not snapped)
- Casual/playful tone with randomized templates (matches existing Flick notification style)
- Individual notifications per expiring streak (not batched)
- Global mute toggle in notification settings -- users can disable all streak warnings

**Data Visibility & Privacy:**

- Streaks are private to the pair
- No "your turn" / "their turn" indicator -- only the pending warm tint hints
- No aggregate streak count on profiles
- No personal best or streak history tracking

**What Counts Toward Streaks:**

- Only snap photos count -- text messages, reactions, replies, GIFs do not contribute
- Race conditions (simultaneous snaps) handled server-side

**Edge Cases:**

- Block/unfriend: Streak dies naturally (expires since no more snaps can be sent)
- Account deletion: Streaks preserved during recovery window; permanent deletion cleans up
- Multi-streak: No limit on simultaneous active streaks per user
- Conversation list sorting: No special sorting for streak conversations

**Conversation Integration:**

- Last message preview text in ConversationRow is unchanged by streak status
- Day count is always embedded inside the icon -- no additional text labels
- Existing ConversationRow snap shortcut becomes streak-aware (same position, appearance changes)

### Claude's Discretion

- ConversationRow layout integration (icon positioning relative to existing elements)
- Snap button visibility behavior when keyboard is open in DMInput
- Server-side race condition handling for simultaneous snaps
- Slight visual refresh of default snap button for consistency with streak states
- Exact pixel art icon modifications for number embedding
- `processStreakExpiry` Cloud Function scheduling and batch processing logic

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                 | Research Support                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| STRK-01 | Streak tracking begins when both users send at least one snap to each other within 24 hours | Streak document data model with `lastSnapBy` map, `onNewMessage` extension to detect mutual snaps, 24h rolling window using `serverTimestamp()`     |
| STRK-02 | Streak activates (visible) after 3 consecutive days of mutual snaps                         | `dayCount` field incremented server-side, client derives `active` state when dayCount >= 3                                                          |
| STRK-03 | Snap button in DM input changes color and shows day count when streak is active             | `StreakIndicator` component wrapping PixelIcon, `useStreaks` hook providing real-time streak state, color tier mapping                              |
| STRK-04 | Snap button shows warning color with "!" when streak is about to expire (within 4 hours)    | `processStreakExpiry` sets `warning: true` on streak doc, client renders red icon with "!" via StreakIndicator                                      |
| STRK-05 | Push notification sent when a streak is about to expire                                     | `processStreakExpiry` Cloud Function sends push via existing `sendPushNotification`, randomized templates, `streakWarnings` notification preference |
| STRK-06 | Streak resets to 0 if 24 hours pass without mutual snaps                                    | Tiered expiry windows (36h/48h/72h per user decision), `processStreakExpiry` resets expired streaks                                                 |
| STRK-07 | All streak calculations are server-authoritative (Cloud Functions only, never client-side)  | All writes to `streaks` collection via Cloud Functions (admin SDK), security rules deny client writes, client is read-only subscriber               |

</phase_requirements>

## Standard Stack

### Core

| Library                          | Version | Purpose                                         | Why Standard                                              |
| -------------------------------- | ------- | ----------------------------------------------- | --------------------------------------------------------- |
| @react-native-firebase/firestore | ^23.8.6 | Streak document CRUD, real-time subscriptions   | Already in project, modular API                           |
| @react-native-firebase/functions | ^23.8.6 | Cloud Functions for streak logic                | Already in project, admin SDK bypasses security rules     |
| firebase-functions               | ^4.5.0  | Scheduled Cloud Function (processStreakExpiry)  | Already in functions/, pubsub.schedule pattern proven     |
| firebase-admin                   | ^12.0.0 | Server-side Firestore writes for streak updates | Already in functions/, admin SDK for authoritative writes |

### Supporting

| Library                                      | Version | Purpose                                | When to Use                                                          |
| -------------------------------------------- | ------- | -------------------------------------- | -------------------------------------------------------------------- |
| expo-notifications (server: expo-server-sdk) | ^5.0.0  | Push notifications for streak warnings | Streak expiry warning notifications                                  |
| react-native (Animated)                      | Core    | Icon color/opacity transitions         | Morphing snap button between streak states (if any animation needed) |

### Alternatives Considered

| Instead of                      | Could Use                     | Tradeoff                                                                                                                                                |
| ------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Separate `streaks` collection   | Fields on `conversations` doc | Separate collection is cleaner: avoids bloating conversation doc, allows independent security rules, enables targeted queries for `processStreakExpiry` |
| Scheduled function every 30 min | Firestore TTL or Cloud Tasks  | Scheduled function matches existing `processDarkroomReveals` pattern; Cloud Tasks would be more precise timing but adds dependency                      |

**Installation:**

```bash
# No new dependencies needed -- all libraries already in project
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── services/firebase/
│   └── streakService.js      # Read-only: subscribe to streak doc, derive UI state
├── hooks/
│   └── useStreaks.js          # Real-time streak subscription, countdown timer
├── components/
│   └── StreakIndicator.js     # Streak-aware snap icon (5 color states, day count)
functions/
├── index.js                   # Extended: onNewMessage + new processStreakExpiry
```

### Pattern 1: Deterministic Streak Document IDs

**What:** Streak documents use the same ID as conversation documents: `[lowerUserId]_[higherUserId]`
**When to use:** Always -- streak is 1:1 with conversation
**Why:** Eliminates queries to find streak for a pair. Direct document read by ID. Same pattern used by conversations and friendships.
**Example:**

```javascript
// Source: Existing messageService.generateConversationId pattern
const generateStreakId = (userId1, userId2) => {
  const [lower, higher] = [userId1, userId2].sort();
  return `${lower}_${higher}`;
};

// Direct document subscription -- no query needed
const streakRef = doc(db, 'streaks', generateStreakId(currentUserId, friendId));
const unsubscribe = onSnapshot(streakRef, snapshot => {
  if (snapshot.exists()) {
    const streakData = snapshot.data();
    // Derive UI state from server fields
  }
});
```

### Pattern 2: Server-Authoritative State Machine

**What:** All streak state transitions happen in Cloud Functions. Client is read-only.
**When to use:** Always -- STRK-07 requires server-authoritative design.
**Why:** Prevents manipulation. Client cannot increment dayCount, change lastSnapBy, or modify warning state.

**Streak Document Schema:**

```javascript
// Firestore: streaks/{lowerUserId}_{higherUserId}
{
  participants: [userId1, userId2],        // Sorted, same as conversation
  dayCount: 0,                             // Current streak day count (0 = no streak)
  lastSnapBy: {
    [userId1]: Timestamp | null,           // Last snap timestamp from user1
    [userId2]: Timestamp | null,           // Last snap timestamp from user2
  },
  lastMutualAt: Timestamp | null,          // When last mutual exchange was completed
  streakStartedAt: Timestamp | null,       // When current streak period began
  expiresAt: Timestamp | null,             // Current expiry deadline
  warning: false,                          // Set true by processStreakExpiry at 4h before expiry
  warningSentAt: Timestamp | null,         // Prevents duplicate warning notifications
  updatedAt: Timestamp,                    // Last modification timestamp
}
```

**State Derivation (Client-Side, Read-Only):**

```javascript
// Source: Derived from streak document fields
const deriveStreakState = (streak, currentUserId) => {
  if (!streak || streak.dayCount === 0) {
    // Check if building (either user has snapped but not mutual yet)
    const mySnap = streak?.lastSnapBy?.[currentUserId];
    const theirSnap = streak?.lastSnapBy?.[friendId];
    if (mySnap && !theirSnap) return 'pending'; // I snapped, waiting on them
    if (mySnap || theirSnap) return 'building'; // Some activity, building toward streak
    return 'default';
  }
  if (streak.warning) return 'warning';
  if (streak.dayCount >= 3) return 'active';
  return 'building'; // dayCount 1-2
};
```

### Pattern 3: Extending onNewMessage (Piggyback Trigger)

**What:** When a snap message is created, `onNewMessage` also updates the streak document.
**When to use:** Every snap message creation.
**Why:** No new trigger needed. The `onNewMessage` Cloud Function already fires on every message. Adding streak logic for `type === 'snap'` messages is a natural extension.

```javascript
// Inside onNewMessage, after conversation metadata update:
if (messageType === 'snap') {
  await updateStreakOnSnap(conversationId, senderId, recipientId);
}
```

### Pattern 4: Scheduled Expiry Processing (processDarkroomReveals Pattern)

**What:** A scheduled Cloud Function runs every 30 minutes to check for expiring/expired streaks.
**When to use:** Background streak lifecycle management.
**Why:** Mirrors the proven `processDarkroomReveals` pattern. Query streaks where `expiresAt <= now` or where warning threshold is reached.

```javascript
// Same pattern as processDarkroomReveals
exports.processStreakExpiry = functions
  .runWith({ memory: '256MB', timeoutSeconds: 120 })
  .pubsub.schedule('every 30 minutes')
  .onRun(async context => {
    const now = admin.firestore.Timestamp.now();

    // 1. Find streaks that need warning (expiresAt - 4h <= now AND !warning)
    // 2. Find streaks that have expired (expiresAt <= now)
    // 3. Set warning=true and send notifications for (1)
    // 4. Reset expired streaks for (2)
  });
```

### Pattern 5: StreakIndicator Component (Composable Icon Wrapper)

**What:** A reusable component that wraps the snap icon with streak-aware rendering.
**When to use:** In ConversationRow, ConversationHeader, and DMInput.
**Why:** Single source of truth for streak icon rendering. All 3 locations get identical treatment.

```javascript
// StreakIndicator receives streak state and renders appropriate icon
const StreakIndicator = ({ streakState, dayCount, size = 18 }) => {
  // streakState: 'default' | 'building' | 'pending' | 'active' | 'warning'
  // Renders snap-polaroid icon with appropriate color
  // For 'active': renders day count number inside icon area
  // For 'warning': renders "!" inside icon area in red
};
```

### Anti-Patterns to Avoid

- **Client-side streak calculation:** Never compute streak state on client. All transitions must go through Cloud Functions.
- **Polling for streak updates:** Use Firestore `onSnapshot` real-time listener, not periodic fetches.
- **Storing streak state in conversation document:** Separate `streaks` collection keeps concerns clean.
- **Using client timestamps for 24h windows:** Always use `serverTimestamp()` and `admin.firestore.Timestamp.now()` to prevent clock manipulation.
- **Sending warnings from client:** Only `processStreakExpiry` Cloud Function sends warning notifications.

## Don't Hand-Roll

| Problem                  | Don't Build                      | Use Instead                                                  | Why                                                                        |
| ------------------------ | -------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Deterministic IDs        | Custom ID generation             | Copy `generateConversationId` pattern                        | Already proven in messageService/friendshipService                         |
| Scheduled processing     | setTimeout/setInterval on client | `pubsub.schedule()` Cloud Function                           | Runs even when no users are active; mirrors processDarkroomReveals         |
| Push notifications       | Custom notification sending      | Existing `sendPushNotification` from notifications/sender.js | Already handles FCM tokens, Expo push, receipt tracking                    |
| Notification preferences | New preference system            | Extend existing `notificationPreferences` on user document   | Already has master toggle + per-type toggles in NotificationSettingsScreen |
| Real-time subscriptions  | Custom WebSocket                 | Firestore `onSnapshot`                                       | Already used everywhere in the app (conversations, messages, etc.)         |
| Icon rendering           | SVG/image-based icons            | Existing `PixelIcon` component                               | Project uses pixel art; new icon variants fit the system                   |

**Key insight:** This phase introduces no new technology. Every building block exists in the codebase. The challenge is composing existing patterns correctly into a new feature domain.

## Common Pitfalls

### Pitfall 1: Clock Skew / Client Timestamp Manipulation

**What goes wrong:** If streak timing uses client-provided timestamps, users can manipulate their device clock to prevent streak expiry or fake snap times.
**Why it happens:** Developers use `new Date()` instead of `serverTimestamp()` for convenience.
**How to avoid:** Every timestamp in the streak system MUST use `serverTimestamp()` (client writes) or `admin.firestore.Timestamp.now()` (Cloud Function writes). The `onNewMessage` trigger already receives server-timestamped `createdAt` from the message document.
**Warning signs:** Any `Date.now()` or `new Date()` in streak-related Cloud Function code.

### Pitfall 2: Race Condition on Simultaneous Snaps

**What goes wrong:** Two users send snaps at nearly the same time. Two `onNewMessage` invocations run concurrently and both try to update the streak document. One write overwrites the other, losing a snap record.
**Why it happens:** Firestore writes are not automatically serialized between different function invocations.
**How to avoid:** Use Firestore transactions in `updateStreakOnSnap` to atomically read-then-write the streak document. The transaction ensures both snap records are preserved even under concurrent writes.
**Warning signs:** `updateDoc` without a transaction wrapper in streak update code.

### Pitfall 3: Warning Notification Duplication

**What goes wrong:** `processStreakExpiry` runs every 30 minutes. If the warning window is 4 hours, the function might send the same warning notification 8 times.
**Why it happens:** No guard against re-sending warnings for the same streak.
**How to avoid:** Use `warningSentAt` field on the streak document. Only send notification if `warning === false` or `warningSentAt === null`. Set `warningSentAt` atomically when sending the warning.
**Warning signs:** Warning push notification code without a duplicate-send guard.

### Pitfall 4: Expiry Window Boundary Errors

**What goes wrong:** Streak should expire after 36h (base tier) but expires at 24h, or the day counter increments too early/late.
**Why it happens:** Confusing "24h mutual snap window" with "36h expiry window". The 24h period is for counting consecutive days. The expiry window (36/48/72h) is the grace period after the last mutual exchange.
**How to avoid:** Clear separation: `lastMutualAt` + tier-based offset = `expiresAt`. The `dayCount` increments when a new mutual exchange happens and it has been >= 24h since the previous `lastMutualAt`.
**Warning signs:** Mixing up the two different time windows in the same calculation.

### Pitfall 5: Firestore Security Rules Blocking Client Reads

**What goes wrong:** Client subscribes to `streaks/{id}` but Firestore rules deny the read.
**Why it happens:** No security rules added for the new `streaks` collection.
**How to avoid:** Add security rules for `streaks` collection: participants can read, all writes denied (Cloud Functions use admin SDK which bypasses rules).
**Warning signs:** "Permission denied" errors in client console when opening a conversation.

### Pitfall 6: N+1 Subscription Problem on Messages List

**What goes wrong:** MessagesList screen subscribes to one streak document per conversation row, creating N individual Firestore listeners for N conversations.
**Why it happens:** Each ConversationRow independently subscribes to its streak document.
**How to avoid:** Subscribe to streaks at the `useMessages` hook level (single query: `where('participants', 'array-contains', userId)`) and pass streak data down to ConversationRow as a prop. This is one listener for all streaks instead of N.
**Warning signs:** Individual `onSnapshot` calls inside ConversationRow or StreakIndicator components.

### Pitfall 7: Stale Streak State After Background/Foreground

**What goes wrong:** User backgrounds the app, streak expires, user comes back and sees stale "active" state until the Firestore listener reconnects.
**Why it happens:** Firestore listeners may take a moment to reconnect after app foregrounding.
**How to avoid:** The `useStreaks` hook should also derive a local countdown timer using `expiresAt`. If the local timer hits zero, immediately show expired state even before the Firestore update arrives. This provides instant UI feedback.
**Warning signs:** User sees active streak for several seconds after it should have expired.

## Code Examples

Verified patterns from the existing codebase:

### Deterministic ID Generation (from messageService.js)

```javascript
// Source: src/services/firebase/messageService.js:72-75
export const generateConversationId = (userId1, userId2) => {
  const [lowerUserId, higherUserId] = [userId1, userId2].sort();
  return `${lowerUserId}_${higherUserId}`;
};
// Reuse this exact same function for streak IDs
```

### Scheduled Cloud Function (from processDarkroomReveals)

```javascript
// Source: functions/index.js:201-252
exports.processDarkroomReveals = functions
  .runWith({ memory: '512MB', timeoutSeconds: 120 })
  .pubsub.schedule('every 2 minutes')
  .onRun(async context => {
    const now = admin.firestore.Timestamp.now();
    // Query documents needing processing
    const snapshot = await db.collection('darkrooms').where('nextRevealAt', '<=', now).get();
    // Process each in parallel
    const results = await Promise.all(
      snapshot.docs.map(async doc => {
        /* ... */
      })
    );
    return null;
  });
```

### Notification Preference Check (from onNewMessage)

```javascript
// Source: functions/index.js:2887-2898
const prefs = recipient.notificationPreferences || {};
const masterEnabled = prefs.enabled !== false;
const dmEnabled = prefs.directMessages !== false;

if (!masterEnabled || !dmEnabled) {
  logger.debug('onNewMessage: Notifications disabled by user preferences');
  return null;
}
// For streaks, add: const streakWarningsEnabled = prefs.streakWarnings !== false;
```

### Firestore Real-Time Subscription (from useConversation.js)

```javascript
// Source: src/hooks/useConversation.js:19
import { getFirestore, doc, onSnapshot } from '@react-native-firebase/firestore';

// Single document subscription pattern for streak
const streakRef = doc(db, 'streaks', streakId);
const unsubscribe = onSnapshot(streakRef, snapshot => {
  if (snapshot.exists()) {
    setStreakData({ id: snapshot.id, ...snapshot.data() });
  } else {
    setStreakData(null);
  }
});
```

### Existing Snap Icon in ConversationRow

```javascript
// Source: src/components/ConversationRow.js:185-194
{
  onSnapCamera && (
    <TouchableOpacity
      style={styles.snapCameraButton}
      onPress={() => onSnapCamera(conversation.id, friendId, displayName)}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <PixelIcon name="snap-polaroid" size={18} color={SNAP_AMBER} />
    </TouchableOpacity>
  );
}
// This PixelIcon call gets replaced with <StreakIndicator> component
```

### Existing Snap Icon in DMInput

```javascript
// Source: src/components/DMInput.js:310-319
<Animated.View style={{ opacity: Animated.subtract(1, morphAnim) }}>
  <TouchableOpacity style={styles.sendButton} onPress={onOpenSnapCamera} testID="camera-button">
    <PixelIcon name="snap-polaroid" size={22} color={colors.status.developing} />
  </TouchableOpacity>
</Animated.View>
// The PixelIcon here gets replaced with <StreakIndicator> component
```

### Push Notification Template Pattern

```javascript
// Source: functions/index.js:46-50
const SNAP_BODY_TEMPLATES = ['sent you a snap', 'just snapped you', 'New snap'];

function getRandomTemplate(templates) {
  const index = Math.floor(Math.random() * templates.length);
  return templates[index];
}
// Same pattern for streak warning templates
```

### Color Constants for Streak Tiers

```javascript
// Source: src/constants/colors.js
// Existing colors to reference:
// colors.icon.secondary = '#7B7B9E'     -- muted gray (default state)
// colors.status.developing = '#FF8C00'  -- retro amber (used for snap already)
// colors.status.danger = '#FF3333'      -- pixel red (warning state)

// New streak color constants to add:
const STREAK_COLORS = {
  default: '#7B7B9E', // Muted gray (matches colors.icon.secondary)
  building: '#D4A574', // Subtle warm tint
  pending: '#D4A574', // Same as building (per user decision)
  activeTier1: '#F5A623', // Light amber (day 3-9, matches SNAP_AMBER)
  activeTier2: '#FF8C00', // Orange (day 10-49, matches colors.status.developing)
  activeTier3: '#E65100', // Deep orange (day 50+)
  warning: '#FF3333', // Red (matches colors.status.danger)
};
```

## State of the Art

| Old Approach                    | Current Approach                           | When Changed     | Impact                                                                                         |
| ------------------------------- | ------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------- |
| Cloud Functions v1 only         | Cloud Functions v2 (onCall) supported      | 2024+            | `processStreakExpiry` uses v1 `pubsub.schedule` pattern (same as existing scheduled functions) |
| `firebase.firestore.FieldValue` | Modular `increment()`, `serverTimestamp()` | RN Firebase v18+ | Use modular imports in client code, `admin.firestore.FieldValue` in Cloud Functions            |

**Deprecated/outdated:**

- None relevant. All patterns used in this phase are current.

## Validation Architecture

### Test Framework

| Property           | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| Framework          | Jest 29.7 with jest-expo preset (client) + Jest 29.7 node (functions) |
| Config file        | `jest.config.js` (client), `functions/jest.config.js` (server)        |
| Quick run command  | `npx jest --testPathPattern=streak -x`                                |
| Full suite command | `npm test`                                                            |
| Estimated runtime  | ~15-20 seconds (client), ~5 seconds (functions)                       |

### Phase Requirements -> Test Map

| Req ID  | Behavior                                   | Test Type             | Automated Command                                      | File Exists?     |
| ------- | ------------------------------------------ | --------------------- | ------------------------------------------------------ | ---------------- |
| STRK-01 | Mutual snap tracking in 24h window         | unit                  | `cd functions && npx jest --testPathPattern=streak -x` | No -- Wave 0 gap |
| STRK-02 | Streak activation at 3 days                | unit                  | `cd functions && npx jest --testPathPattern=streak -x` | No -- Wave 0 gap |
| STRK-03 | Snap button color/count changes            | unit                  | `npx jest --testPathPattern=StreakIndicator -x`        | No -- Wave 0 gap |
| STRK-04 | Warning state within 4h of expiry          | unit                  | `cd functions && npx jest --testPathPattern=streak -x` | No -- Wave 0 gap |
| STRK-05 | Push notification on streak expiry warning | unit                  | `cd functions && npx jest --testPathPattern=streak -x` | No -- Wave 0 gap |
| STRK-06 | Streak reset after expiry                  | unit                  | `cd functions && npx jest --testPathPattern=streak -x` | No -- Wave 0 gap |
| STRK-07 | Server-authoritative (no client writes)    | unit + security-rules | `npx jest --testPathPattern=streakService -x`          | No -- Wave 0 gap |

### Nyquist Sampling Rate

- **Minimum sample interval:** After every committed task, run: `npx jest --testPathPattern=streak -x`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green (`npm test`) before `/gsd:verify-work`
- **Estimated feedback latency per task:** ~10 seconds

### Wave 0 Gaps (must be created before implementation)

- [ ] `functions/__tests__/triggers/streakFunctions.test.js` -- covers STRK-01, STRK-02, STRK-04, STRK-05, STRK-06 (onNewMessage streak extension + processStreakExpiry)
- [ ] `__tests__/services/streakService.test.js` -- covers STRK-07 (read-only client service, state derivation)
- [ ] `__tests__/components/StreakIndicator.test.js` -- covers STRK-03, STRK-04 (icon rendering for all 5 states)
- [ ] `__tests__/hooks/useStreaks.test.js` -- covers real-time subscription, countdown timer

## Open Questions

1. **Pixel Art Number Rendering Inside Icon**
   - What we know: The snap-polaroid icon is 12x12 pixels. The flash element occupies roughly pixels at rows 2-6, columns 4-7. Day count numbers (single and double digit) need to fit in this space.
   - What is unclear: Exact pixel coordinates for rendering "3", "10", "50" etc. inside the 12x12 grid. This may require a mini pixel font or pre-defined number sprites.
   - Recommendation: Claude has discretion here. Define small 3x5 pixel digit sprites (0-9) and render them centered in the icon body area. For 2-digit numbers (10-99), use a slightly smaller 2x4 font or shift digits closer together.

2. **processStreakExpiry Query Efficiency**
   - What we know: The function queries `streaks` where `expiresAt <= now` for expiry processing and where `expiresAt - 4h <= now AND warning == false` for warning processing.
   - What is unclear: Whether Firestore supports the computed query `expiresAt - 4h <= now` directly. It does not -- Firestore cannot do arithmetic in queries.
   - Recommendation: Store a separate `warningAt` field (computed as `expiresAt - 4h` when expiresAt is set). Query `where('warningAt', '<=', now)` and `where('warning', '==', false)`. This is the standard Firestore pattern for "time offset" queries.

3. **Day Count Increment Timing**
   - What we know: Day counter ticks every 24h after mutual snaps are exchanged. 1 snap from each side is enough.
   - What is unclear: Exact moment the counter increments. Is it when the second user's snap arrives (completing the mutual exchange for that day)? Or at a fixed daily time?
   - Recommendation: Increment when the mutual exchange completes (second user sends snap and >= 24h since `lastMutualAt`). This is the most intuitive behavior and simplest to implement in the `onNewMessage` handler.

## Sources

### Primary (HIGH confidence)

- Existing codebase analysis: `functions/index.js` (onNewMessage at line 2785, processDarkroomReveals at line 201)
- Existing codebase analysis: `src/services/firebase/messageService.js` (deterministic ID pattern)
- Existing codebase analysis: `src/components/ConversationRow.js` (snap icon rendering)
- Existing codebase analysis: `src/components/DMInput.js` (snap button morphing)
- Existing codebase analysis: `src/components/ConversationHeader.js` (header layout)
- Existing codebase analysis: `firestore.rules` (conversation security rules pattern)
- Existing codebase analysis: `src/screens/NotificationSettingsScreen.js` (notification preferences)
- Existing codebase analysis: `src/constants/colors.js` (color system)
- Existing codebase analysis: `src/constants/pixelIcons.js` (snap-polaroid icon definition)

### Secondary (MEDIUM confidence)

- Firebase Firestore transactions documentation (for race condition handling)
- Firebase Cloud Functions scheduled functions documentation (pubsub.schedule pattern)

### Tertiary (LOW confidence)

- None -- all research is based on direct codebase analysis of proven patterns.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All libraries already in the project, no new dependencies
- Architecture: HIGH - Every pattern directly mirrors existing codebase patterns (deterministic IDs, onNewMessage trigger, scheduled functions, real-time subscriptions)
- Pitfalls: HIGH - Race conditions and clock manipulation are well-documented concerns for streak systems; Firestore query limitations are known

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (30 days -- stable patterns, no dependency changes expected)
