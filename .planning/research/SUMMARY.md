# Research Summary: Flick Messaging Upgrade

**Domain:** Social messaging features (ephemeral snaps, streaks, reactions, read receipts, replies, screenshot detection, photo tag integration)
**Researched:** 2026-02-23
**Overall confidence:** HIGH

## Executive Summary

The Flick messaging upgrade is primarily a feature engineering effort, not a technology acquisition effort. The existing stack -- React Native Firebase SDK on Firestore, expo-camera, react-native-reanimated, react-native-gesture-handler, rn-emoji-keyboard, expo-notifications -- covers approximately 90% of what the new messaging features require. Only one new npm dependency is needed: `expo-screen-capture` for screenshot detection and prevention during snap viewing. This is an official Expo package with confirmed SDK 54 compatibility and requires a new native build.

The most complex new features are snap messages (ephemeral photos) and streak tracking. Snaps involve a full lifecycle: camera capture in conversation context, Firebase Storage upload with short-lived signed URLs, full-screen viewer with screen capture prevention, server-side cleanup on view, and TTL-based safety net deletion. Streaks are pure business logic: date math on mutual snap exchanges, Cloud Function scheduled checks, and visual indicators. Neither requires new libraries.

Message reactions, read receipts, quote replies, and message deletion are extensions to the existing Firestore message schema and MessageBubble component. The reaction picker should be built custom with reanimated (the only compatible third-party library, react-native-reactions, pins incompatible peer dependencies). Read receipts are a low-complexity schema extension. Quote replies need a swipe-to-reply gesture (trivial with existing gesture handler) and denormalized reply content. Message deletion is a soft-delete field update.

The critical architectural risk is ephemeral snap photo persistence. Multiple caching layers (expo-image disk cache, OS image cache, Firebase Storage signed URLs) can keep "deleted" snap photos accessible. This must be addressed from day one with `cachePolicy: 'none'`, short-lived signed URLs, and explicit cleanup paths. Firestore TTL deletion takes up to 24 hours and cannot be the primary deletion mechanism -- it serves as a safety net only.

## Key Findings

**Stack:** Only 1 new dependency needed (`expo-screen-capture`). Everything else builds on existing libraries. Custom reaction picker required because the only third-party option (`react-native-reactions`) has incompatible peer dependencies.

**Architecture:** Extends existing service/hook/component layers. Three new services (snapService, streakService, extended messageService), three new Cloud Functions (onSnapViewed, processStreakExpirations, cleanupExpiredSnaps), and component extensions to MessageBubble.

**Critical pitfall:** Snap photo persistence across caching layers. expo-image's default disk caching, 7-day signed URLs, and OS-level caches mean "deleted" snaps can survive indefinitely unless every layer is explicitly handled.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Message Infrastructure** - Extend message schema, add new message types, update Firestore security rules
   - Addresses: Read receipts, message deletion, reply-to data model, reaction storage
   - Avoids: Building features on an incompatible schema that needs migration later
   - Rationale: Every other feature depends on the extended message schema. Do this first.

2. **Snap Messages + Screenshot Detection** - Ephemeral photo DMs with view-once mechanic
   - Addresses: Snap messages, snap viewer, screenshot detection/prevention, snap cleanup
   - Avoids: Snap photo persistence pitfall (must be designed from scratch, not retrofitted)
   - Rationale: Highest complexity feature, requires native build (expo-screen-capture), and streaks depend on it.

3. **Message Interactions** - Reactions, replies, deletion UI
   - Addresses: Emoji tapback reactions, swipe-to-reply, message unsend, reaction picker
   - Avoids: Feature creep by keeping interactions separate from snap infrastructure
   - Rationale: These are independent UI features that build on Phase 1's schema.

4. **Streak Mechanics** - Daily mutual snap tracking, visual indicators, warnings
   - Addresses: Streak tracking, expiry warnings, push notifications, visual indicators
   - Avoids: Building streaks before snaps exist (streaks depend on snap message type)
   - Rationale: Depends on Phase 2 (snap messages must exist before you can track streaks).

5. **Photo Tag Integration** - Bridge darkroom tagging to DM conversations
   - Addresses: Tagged photo auto-send to DM, reshare to feed with attribution
   - Avoids: Modifying the photo lifecycle before messaging is stable
   - Rationale: Least critical for MVP, highest integration surface with existing photo system.

**Phase ordering rationale:**

- Phase 1 must come first: every subsequent phase depends on the extended message schema
- Phase 2 before Phase 4: streaks require snap messages to exist
- Phase 3 is independent of Phase 2 but benefits from the schema established in Phase 1
- Phase 5 is the most independent feature and can be deferred or parallelized with Phase 4
- `expo-screen-capture` (the only new native dependency) ships in Phase 2, which means one native build early in the project

**Research flags for phases:**

- Phase 2: Needs careful implementation research for snap photo caching behavior on both platforms. Verify expo-screen-capture's Android 14+ fix is included in SDK 54 version.
- Phase 4: Streak timezone/UTC handling needs validation. Snapchat uses 24-hour rolling windows, not midnight resets. The 3-day threshold decision should be tested with users.
- Phase 1, 3, 5: Standard Firestore patterns, unlikely to need additional research.

## Confidence Assessment

| Area         | Confidence  | Notes                                                                                                                           |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH        | Only 1 new dependency, official Expo package, all others already installed and working                                          |
| Features     | MEDIUM-HIGH | Feature patterns well-established by Snapchat/Instagram/iMessage; technical feasibility verified against existing codebase      |
| Architecture | HIGH        | Extends existing service/hook/component layers; no new architectural patterns needed                                            |
| Pitfalls     | HIGH        | Verified against official Firebase docs (TTL timing), Expo docs (screenshot detection), and community reports (Android 14+ bug) |

## Gaps to Address

- **expo-screen-capture exact version for SDK 54:** `npx expo install` will auto-resolve, but the exact version number (~16.0.x vs ~8.0.x) could not be confirmed via web research. The `npx expo install` command is authoritative.
- **rn-emoji-keyboard reanimated 4 compatibility:** The library is already working in the project (used in PhotoDetailModal), but its peer dependency requirements for reanimated ~4.1.1 could not be verified via documentation. Working in practice is sufficient evidence.
- **Firestore TTL on subcollections:** TTL applies to collection groups, which includes subcollections. Confirmed this works for `conversations/*/messages` collection group. However, TTL deleting a parent document does NOT cascade-delete subcollections. This is only relevant if snap metadata is stored as subcollection documents.
- **Android 14+ screenshot fix inclusion in SDK 54:** PR #31702 was merged but its inclusion in the specific expo-screen-capture version bundled with SDK 54 needs runtime verification. Workaround is documented if the fix is not included.

---

_Research summary: 2026-02-23_
