# Milestones

## v1.0 Flick Messaging Upgrade (Shipped: 2026-02-25)

**Phases completed:** 5 phases, 24 plans
**Requirements:** 38/38 v1 requirements satisfied
**Timeline:** 3 days (2026-02-23 → 2026-02-25)
**Git range:** feat(01-01) → feat(05-04)
**Files modified:** 779 (+45,616 / -83,994)
**Current LOC:** ~75,700 (src + functions)

**Delivered:** Comprehensive messaging upgrade transforming Flick's DMs from basic text/GIF chat into a full social messaging experience with ephemeral snaps, streaks, reactions, replies, read receipts, and photo tag integration.

**Key accomplishments:**

1. Extended message schema with type polymorphism (text, reaction, reply, snap, tagged_photo) + real-time read receipts with privacy controls
2. Full message interaction suite: emoji reactions (double-tap + 6-emoji picker), swipe-to-reply, message unsend/delete-for-me
3. Ephemeral snap photos: camera capture, Polaroid-framed viewer, view-once with auto-cleanup and EXIF normalization
4. Server-authoritative streak engine: 3-day activation, tiered expiry windows (36h/48h/72h), 5-state visual indicators, push warning notifications
5. Photo tag → DM pipeline: auto-send tagged photos as DM messages, add-to-feed resharing with photographer attribution

**Tech debt:**

- useConversation hook Phase 2 additions lack dedicated unit tests (tested indirectly)
- Stale test assertion in snapFunctions.test.js line 522 (expects 'direct_message' instead of 'snap')
- INFRA-03: Firestore TTL policy not yet configured in Firebase console (user deferred)
- INFRA-04: Firebase Storage lifecycle rule not yet configured in GCS console (user deferred)
- hoursSinceLastMutual variable name is misleading (divides by DAY_MS — info only)

---
