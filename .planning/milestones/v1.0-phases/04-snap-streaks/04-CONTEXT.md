# Phase 4: Snap Streaks - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Daily mutual snap tracking with visual indicators. Streak mechanics reward consistent snap exchanges between friends: activation at 3 days, tiered expiry windows, visual state changes on the snap icon, and push notification warnings. Server-authoritative design prevents manipulation.

</domain>

<decisions>
## Implementation Decisions

### Streak Icon Design

- Streak modifies the **existing snap icon** — no new separate icon
- Day count **replaces the flash element inside the icon** when streak is active
- Icon appears in **3 locations, all fully synced**: ConversationRow, ConversationHeader, DMInput snap button
- Display-only (not tappable for details) — no tooltip or popover
- Identical icon treatment across all 3 locations
- State transitions are **instant** (no animation between states)

### Icon Color States (5 states)

1. **Default (no streak):** Muted gray
2. **Building (day 1-2):** Subtle warm tint, no number displayed
3. **Pending (you snapped, waiting on them):** Same warm tint as building state — signals "your part is done"
4. **Active (day 3+):** Orange/amber fill, day count replaces flash inside icon
5. **Warning (within 4h of expiry):** Static red, "!" replaces day count — no animation

### Color Deepening by Tier

- Icon color gradually intensifies with streak length, matching the expiry tiers:
  - Day 3-9: Light amber
  - Day 10-49: Orange
  - Day 50+: Deep orange

### Expiry Windows (Tiered — Progressive Leniency)

- **Base:** 36 hours
- **10+ days:** 48 hours
- **50+ days:** 72 hours
- Day counter ticks every 24h after mutual snaps are exchanged
- 1 snap from each side is enough — quantity beyond 1 doesn't matter

### Streak Lifecycle

- No celebration at activation (day 3) or milestones (10, 50)
- Counter just ticks up silently
- On expiry: silent reset — icon returns to muted gray default, no system message in chat
- No personal best records or streak history — when it's gone, it's gone

### Notification Behavior

- **Single warning** at 4 hours before expiry
- Sent to **both users** (not just the one who hasn't snapped)
- **Casual/playful tone** with randomized templates (matches existing Flick notification style)
- **Individual notifications** per expiring streak (not batched)
- **Global mute toggle** in notification settings — users can disable all streak warnings

### Data Visibility & Privacy

- Streaks are **private to the pair** — no way to see if Friend A has a streak with Friend B
- No "your turn" / "their turn" indicator — only the pending warm tint hints that you've done your part
- No aggregate streak count on profiles or elsewhere
- No personal best or streak history tracking

### What Counts Toward Streaks

- **Only snap photos count** — text messages, reactions, replies, GIFs do not contribute
- Race conditions (simultaneous snaps) handled server-side — Claude has discretion on implementation

### Edge Cases

- **Block/unfriend:** Streak dies naturally (expires on its own since no more snaps can be sent)
- **Account deletion:** Streaks preserved during account recovery window; if account is permanently deleted, streaks are cleaned up
- **Multi-streak:** No limit on simultaneous active streaks per user
- **Conversation list sorting:** No special sorting for streak conversations — existing order (most recent activity) maintained

### Conversation Integration

- Last message preview text in ConversationRow is **unchanged** by streak status
- Day count is always embedded inside the icon — no additional text labels anywhere
- Existing ConversationRow snap shortcut becomes streak-aware (same position, appearance changes)

### Claude's Discretion

- ConversationRow layout integration (icon positioning relative to existing elements)
- Snap button visibility behavior when keyboard is open in DMInput
- Server-side race condition handling for simultaneous snaps
- Slight visual refresh of default snap button for consistency with streak states
- Exact pixel art icon modifications for number embedding
- `processStreakExpiry` Cloud Function scheduling and batch processing logic

</decisions>

<specifics>
## Specific Ideas

- The day count should be embedded _inside_ the snap icon, replacing the flash element — not a badge or text beside it
- The "pending" state (you snapped, waiting on them) reuses the same warm tint as the building state — intentionally subtle, not a separate visual treatment
- Color deepening tiers match the expiry window tiers (3+, 10+, 50+) for visual consistency
- Warning state is deliberately static (no pulse/glow animation) — the red color and "!" are enough

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 04-snap-streaks_
_Context gathered: 2026-02-24_
