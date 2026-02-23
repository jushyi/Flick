# Project State: Flick Messaging Upgrade

**Current Phase:** 02
**Current Plan:** 02-04 (3/6 complete)
**Last Updated:** 2026-02-23

## Progress

| Phase                                      | Status                  | Started    | Completed |
| ------------------------------------------ | ----------------------- | ---------- | --------- |
| 1 — Message Infrastructure & Read Receipts | In Progress (2/4 plans) | 2026-02-23 | —         |
| 2 — Message Interactions                   | In Progress (3/6 plans) | 2026-02-23 | —         |
| 3 — Snap Messages                          | Not Started             | —          | —         |
| 4 — Snap Streaks                           | Not Started             | —          | —         |
| 5 — Photo Tag Integration                  | Not Started             | —          | —         |

## Requirements Coverage

- Total v1 requirements: 37
- Completed: 16 (INFRA-01, INFRA-02, READ-01, READ-02, READ-03, REACT-01, REACT-02, REACT-03, REACT-04, REACT-05, REPLY-02, REPLY-03, DEL-01, DEL-02, DEL-03)
- In progress: 0
- Remaining: 21
- Deferred to v2: 5 (screenshot detection)

## Key Decisions Log

| Date       | Decision                                   | Context                                                     |
| ---------- | ------------------------------------------ | ----------------------------------------------------------- |
| 2026-02-23 | Camera-only snaps (no gallery)             | Keeps authentic, in-the-moment feel                         |
| 2026-02-23 | View once then gone                        | Ephemeral by design                                         |
| 2026-02-23 | 3-day streak threshold                     | Low enough to achieve, high enough to mean something        |
| 2026-02-23 | Streak visual on snap button               | Button changes color + day count                            |
| 2026-02-23 | Warning color + "!" + push                 | Multi-signal before streak expires                          |
| 2026-02-23 | Caption text only on snaps                 | No drawing/doodle for v1                                    |
| 2026-02-23 | Photo attribution on reshare               | "Photo by @user" respects photographer                      |
| 2026-02-23 | Screenshot notification (not protection)   | Deterrent, not security guarantee                           |
| 2026-02-23 | Reactions as separate message docs         | Preserves message immutability                              |
| 2026-02-23 | Conversation-level read receipts           | 1 write per open vs N per-message writes                    |
| 2026-02-23 | Server-authoritative streaks               | Cloud Functions only, never client-side                     |
| 2026-02-23 | Defer screenshot detection to v2           | Avoids native rebuild; iterate on messaging first           |
| 2026-02-23 | readReceipts at conversation level         | Map field on conversation doc, 1 write per open             |
| 2026-02-23 | First-read-only guard in hook layer        | Service always writes; hook checks unreadCount > 0          |
| 2026-02-23 | Foreground-only read receipt writes        | AppState check prevents backgrounded writes                 |
| 2026-02-23 | RN core Animated for read receipt fades    | Simple fades don't need reanimated complexity               |
| 2026-02-23 | Mutual privacy model for read receipts     | Both users must have receipts enabled for Read to show      |
| 2026-02-23 | UnreadBadge with 99+ cap                   | Numeric count replaces plain dot, capped for display        |
| 2026-02-23 | Null-emoji sentinel for reaction removal   | Avoids Cloud Function; works within existing rules          |
| 2026-02-23 | Reply text truncated to 100 chars          | Keeps denormalized preview compact in Firestore docs        |
| 2026-02-23 | No image URLs in replyTo                   | Avoids signed URL expiry issues; stores type label only     |
| 2026-02-23 | arrayUnion for deleteMessageForMe          | Atomic per-user array updates on conversation doc           |
| 2026-02-23 | Batch writes for unsend cascade            | Atomic soft-delete across message, reactions, replies       |
| 2026-02-23 | Reaction messages skip conversation meta   | No lastMessage/unreadCount update for type:reaction         |
| 2026-02-23 | Early return for reaction removal sentinel | emoji:null triggers skip all processing in onNewMessage     |
| 2026-02-23 | Compound key for reaction-per-user         | targetMessageId_senderId key enforces one reaction per user |
| 2026-02-23 | Placeholder flags for unsent/deleted       | \_isUnsent/\_isDeletedForMe flags keep messages in list     |
| 2026-02-23 | reactionMap as parameter to handleReaction | Avoids data duplication; useConversation owns the data      |

## Blockers

None currently.

### Quick Tasks Completed

| #   | Description                                                                      | Date       | Commit  | Directory                                                                                           |
| --- | -------------------------------------------------------------------------------- | ---------- | ------- | --------------------------------------------------------------------------------------------------- |
| 1   | Fix notification badge persisting on Activity tab when all notifications viewed  | 2026-02-23 | d72ed7d | [1-fix-notification-badge-persisting-on-act](./quick/1-fix-notification-badge-persisting-on-act/)   |
| 2   | Fix DM conversation empty state, missing input bar, and profile photos           | 2026-02-23 | b7cb2bc | [2-fix-new-conversation-missing-input-bar-u](./quick/2-fix-new-conversation-missing-input-bar-u/)   |
| 3   | Fix profile photos not showing properly in Messages tab and conversation header  | 2026-02-23 | 23d3042 | [3-fix-profile-photos-not-showing-properly-](./quick/3-fix-profile-photos-not-showing-properly-/)   |
| 4   | Fix conversation screen three-dot menu to use DropdownMenu instead of Alert      | 2026-02-23 | d57bd11 | [4-fix-convo-screen-three-dot-menu-not-open](./quick/4-fix-convo-screen-three-dot-menu-not-open/)   |
| 5   | Fix missing input bar when opening or starting a new conversation                | 2026-02-23 | 23d3042 | [5-fix-missing-input-bar-when-opening-or-st](./quick/5-fix-missing-input-bar-when-opening-or-st/)   |
| 6   | Fix empty conversation text upside-down on Android (platform-conditional scaleY) | 2026-02-23 | 629c3eb | [6-only-on-android-the-empty-text-for-new-c](./quick/6-only-on-android-the-empty-text-for-new-c/)   |
| 7   | Fix missing input bar in conversation view (hide tab bar on nested screens)      | 2026-02-23 | 8843e96 | [7-there-is-no-input-bar-in-the-convo-view-](./quick/7-there-is-no-input-bar-in-the-convo-view-/)   |
| 8   | Fix incoming message spacing near input bar (paddingTop on inverted FlatList)    | 2026-02-23 | 8ad69fd | [8-fix-incoming-message-spacing-near-input-](./quick/8-fix-incoming-message-spacing-near-input-/)   |
| 9   | Fix iOS DM input bar padding when keyboard open and background color mismatch    | 2026-02-23 | e9b700b | [9-fix-ios-dm-input-bar-padding-and-backgro](./quick/9-fix-ios-dm-input-bar-padding-and-backgro/)   |
| 10  | Fix iOS conversation scroll on send/receive (auto-scroll inverted FlatList)      | 2026-02-23 | 57c6090 | [10-fix-ios-conversation-scroll-on-send-rece](./quick/10-fix-ios-conversation-scroll-on-send-rece/) |
| 11  | Restyle DM message bubbles and input to retro 16-bit pixel art aesthetic         | 2026-02-23 | c854c0e | [11-the-message-bubbles-don-t-match-the-16-b](./quick/11-the-message-bubbles-don-t-match-the-16-b/) |
| 12  | Fix Android DM input bar not returning to bottom on keyboard dismiss             | 2026-02-23 | 4f1cee0 | [12-fix-android-dm-input-bar-not-going-to-bo](./quick/12-fix-android-dm-input-bar-not-going-to-bo/) |
| 13  | Restyle DM input bar to full retro 16-bit pixel aesthetic                        | 2026-02-23 | 4b2453e | [13-the-input-pill-on-messages-doesn-t-match](./quick/13-the-input-pill-on-messages-doesn-t-match/) |
| 14  | Fix DM GIF button height and add photo picker for image messages                 | 2026-02-23 | f75ad69 | [14-fix-dm-gif-button-height-and-add-photo-i](./quick/14-fix-dm-gif-button-height-and-add-photo-i/) |
| 15  | Move read receipts toggle from Settings to dedicated screen                      | 2026-02-23 | 555f513 | [15-move-read-receipts-toggle-from-settings-](./quick/15-move-read-receipts-toggle-from-settings-/) |
| 16  | Fix send button height on iOS to match input wrapper                             | 2026-02-23 | 52150d9 | [16-fix-send-button-height-on-ios-to-match-i](./quick/16-fix-send-button-height-on-ios-to-match-i/) |
| 17  | Fix photo sending in DM conversations (preview, notification, crop, aspect)      | 2026-02-23 | 90d41e0 | [17-fix-photo-sending-in-dm-conversations-se](./quick/17-fix-photo-sending-in-dm-conversations-se/) |
| 18  | Change read receipt font from SpaceMono to Silkscreen pixel font                 | 2026-02-23 | 8bf776f | [18-the-read-receipts-and-delivered-text-sho](./quick/18-the-read-receipts-and-delivered-text-sho/) |

## Notes

- No new dependencies needed — `expo-screen-capture` deferred to v2 (avoids native rebuild)
- Existing stack covers 100% of v1 requirements
- All v1 changes are JS-only (deployable via OTA update)
- Phase 2 and 3 are independent; Phase 4 depends on Phase 3; Phase 5 depends only on Phase 1

---

Last activity: 2026-02-23 - Completed 02-03-PLAN.md: useConversation reaction aggregation, message filtering, useMessageActions hook, 11 new tests
