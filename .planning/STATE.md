# Project State: Flick Messaging Upgrade

**Current Phase:** 05
**Current Plan:** Not started
**Last Updated:** 2026-02-24

## Progress

| Phase                                      | Status                  | Started    | Completed  |
| ------------------------------------------ | ----------------------- | ---------- | ---------- |
| 1 — Message Infrastructure & Read Receipts | In Progress (2/4 plans) | 2026-02-23 | —          |
| 2 — Message Interactions                   | Complete (6/6 plans)    | 2026-02-23 | 2026-02-24 |
| 3 — Snap Messages                          | Complete (8/8 plans)    | 2026-02-24 | 2026-02-24 |
| 4 — Snap Streaks                           | Complete (4/4 plans)    | 2026-02-24 | 2026-02-24 |
| 5 — Photo Tag Integration                  | Not Started             | —          | —          |

## Requirements Coverage

- Total v1 requirements: 37
- Completed: 34 (INFRA-01, INFRA-02, INFRA-03, INFRA-04, READ-01, READ-02, READ-03, REACT-01, REACT-02, REACT-03, REACT-04, REACT-05, REPLY-01, REPLY-02, REPLY-03, REPLY-04, DEL-01, DEL-02, DEL-03, SNAP-01, SNAP-02, SNAP-03, SNAP-04, SNAP-05, SNAP-06, SNAP-07, SNAP-08, STRK-01, STRK-02, STRK-03, STRK-04, STRK-05, STRK-06, STRK-07)
- In progress: 0
- Remaining: 4
- Deferred to v2: 5 (screenshot detection)

## Key Decisions Log

| Date       | Decision                                                 | Context                                                                       |
| ---------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 2026-02-23 | Camera-only snaps (no gallery)                           | Keeps authentic, in-the-moment feel                                           |
| 2026-02-23 | View once then gone                                      | Ephemeral by design                                                           |
| 2026-02-23 | 3-day streak threshold                                   | Low enough to achieve, high enough to mean something                          |
| 2026-02-23 | Streak visual on snap button                             | Button changes color + day count                                              |
| 2026-02-23 | Warning color + "!" + push                               | Multi-signal before streak expires                                            |
| 2026-02-23 | Caption text only on snaps                               | No drawing/doodle for v1                                                      |
| 2026-02-23 | Photo attribution on reshare                             | "Photo by @user" respects photographer                                        |
| 2026-02-23 | Screenshot notification (not protection)                 | Deterrent, not security guarantee                                             |
| 2026-02-23 | Reactions as separate message docs                       | Preserves message immutability                                                |
| 2026-02-23 | Conversation-level read receipts                         | 1 write per open vs N per-message writes                                      |
| 2026-02-23 | Server-authoritative streaks                             | Cloud Functions only, never client-side                                       |
| 2026-02-23 | Defer screenshot detection to v2                         | Avoids native rebuild; iterate on messaging first                             |
| 2026-02-23 | readReceipts at conversation level                       | Map field on conversation doc, 1 write per open                               |
| 2026-02-23 | First-read-only guard in hook layer                      | Service always writes; hook checks unreadCount > 0                            |
| 2026-02-23 | Foreground-only read receipt writes                      | AppState check prevents backgrounded writes                                   |
| 2026-02-23 | RN core Animated for read receipt fades                  | Simple fades don't need reanimated complexity                                 |
| 2026-02-23 | Mutual privacy model for read receipts                   | Both users must have receipts enabled for Read to show                        |
| 2026-02-23 | UnreadBadge with 99+ cap                                 | Numeric count replaces plain dot, capped for display                          |
| 2026-02-23 | Null-emoji sentinel for reaction removal                 | Avoids Cloud Function; works within existing rules                            |
| 2026-02-23 | Reply text truncated to 100 chars                        | Keeps denormalized preview compact in Firestore docs                          |
| 2026-02-23 | No image URLs in replyTo                                 | Avoids signed URL expiry issues; stores type label only                       |
| 2026-02-23 | arrayUnion for deleteMessageForMe                        | Atomic per-user array updates on conversation doc                             |
| 2026-02-23 | Batch writes for unsend cascade                          | Atomic soft-delete across message, reactions, replies                         |
| 2026-02-23 | Reaction messages skip conversation meta                 | No lastMessage/unreadCount update for type:reaction                           |
| 2026-02-23 | Early return for reaction removal sentinel               | emoji:null triggers skip all processing in onNewMessage                       |
| 2026-02-23 | Compound key for reaction-per-user                       | targetMessageId_senderId key enforces one reaction per user                   |
| 2026-02-23 | Placeholder flags for unsent/deleted                     | \_isUnsent/\_isDeletedForMe flags keep messages in list                       |
| 2026-02-23 | reactionMap as parameter to handleReaction               | Avoids data duplication; useConversation owns the data                        |
| 2026-02-23 | PixelIcon for ReplyPreview cancel button                 | Consistent with project-wide icon system, not Ionicons                        |
| 2026-02-23 | runOnJS for gesture worklet callbacks                    | Thread-safe JS callbacks from reanimated gesture handlers                     |
| 2026-02-23 | Gesture.Race with Gesture.Exclusive                      | Prevents double-tap from triggering single-tap timestamp                      |
| 2026-02-23 | Simplified gesture for deleted messages                  | Single-tap only on unsent/deleted prevents invalid actions                    |
| 2026-02-23 | RN core Animated for ReactionBadges fade                 | Simple fades don't need reanimated per user decision                          |
| 2026-02-24 | 5-min signed URL expiry for snap photos                  | Shorter than 24h for regular photos; matches ephemeral snap nature            |
| 2026-02-24 | Auto-retry 3x with exponential backoff                   | 1s/2s/4s delays; returns retriesExhausted flag for tap-to-retry UI            |
| 2026-02-24 | Snap lastMessage preview: text null, type snap           | Client renders camera icon + "Snap" label for conversation list               |
| 2026-02-24 | Randomized snap push templates (no emojis)               | Three templates per user decision: "sent you a snap", etc.                    |
| 2026-02-24 | Best-effort cleanup in onSnapViewed                      | Logs errors but does not throw; scheduled cleanup as safety net               |
| 2026-02-24 | Amber #F5A623 accent for snap UI elements                | Consistent with colors.status.developing for developing metaphor              |
| 2026-02-24 | Polaroid frame: 4:3 photo, 8px border, 64px strip        | Standard Polaroid aesthetic for snap viewing experience                       |
| 2026-02-24 | BackHandler for SnapViewer on Android                    | Hardware back button dismisses snap viewer modal properly                     |
| 2026-02-24 | CameraScreen reused with mode param for snaps            | No separate SnapCameraModal; mode='snap' hides darkroom UI                    |
| 2026-02-24 | Zoom hidden in snap mode                                 | Keeps snap camera simple per user decision                                    |
| 2026-02-24 | navigation.pop(2) for snap send return                   | Returns past SnapPreview and SnapCamera to conversation                       |
| 2026-02-24 | Snap delegation after hooks in MessageBubble             | Early return before hooks violates Rules of Hooks                             |
| 2026-02-24 | 300ms delay for autoOpenSnapId SnapViewer                | Allows conversation FlatList to render before snap viewer opens               |
| 2026-02-24 | Snap notification shares Conversation nav handler        | snap type returns screen:'Conversation' with autoOpenSnapId param             |
| 2026-02-24 | Infrastructure configs (TTL, lifecycle) deferred         | Safety nets only; app works without them, user will configure later           |
| 2026-02-24 | Snap camera matches main Camera tab layout               | Supersedes "zoom hidden in snap mode"; full parity minus darkroom             |
| 2026-02-24 | Dynamic safe area insets for snap footer                 | Math.max(insets.bottom, 16) instead of hardcoded 20px                         |
| 2026-02-24 | Polaroid border doubled to 16px                          | 8px too thin on mobile; 16px matches realistic Polaroid proportions           |
| 2026-02-24 | Footer inside KAV for keyboard lift                      | Root cause was footer outside KAV causing under-compensation                  |
| 2026-02-24 | Absolute positioning for unread badge                    | Prevents flow-based displacement of snap camera shortcut button               |
| 2026-02-24 | EXIF normalization with empty-action manipulateAsync     | Bakes orientation into pixels before resize; same pattern as ProfilePhotoCrop |
| 2026-02-24 | Snap reactions reuse existing sendReaction system        | No separate system needed; reactions appear in conversation thread            |
| 2026-02-24 | Semi-transparent overlay at 0.85 opacity                 | Keeps snap as clear focus while showing conversation behind                   |
| 2026-02-24 | Reaction bar hidden for senders                          | No reason to react to your own snap; recipients only                          |
| 2026-02-24 | Footer outside KAV for fixed positioning                 | Reverses prior decision; footer stays at bottom when keyboard opens           |
| 2026-02-24 | Reanimated keyboard offset replaces KAV for snap caption | useAnimatedKeyboard + JS fallback accounts for suggestions/autocomplete bar   |
| 2026-02-24 | Duplicated generateStreakId to avoid circular deps       | 3-line function copied from messageService pattern                            |
| 2026-02-24 | Instant streak state transitions (no animation)          | Per user decision from planning phase                                         |
| 2026-02-24 | StreakIndicator as drop-in PixelIcon replacement         | Same component across ConversationRow, Header, DMInput                        |
| 2026-02-24 | warningAt pre-computed field for efficient queries       | Firestore cannot do arithmetic in queries; store expiresAt - 4h as field      |
| 2026-02-24 | Best-effort streak updates in onNewMessage               | Streak errors logged but do not fail message delivery                         |
| 2026-02-24 | warning-outline icon for streak toggle                   | flame-outline does not exist in PixelIcon set; warning-outline fits label     |
| 2026-02-24 | Messaging section for streak notification toggle         | Groups streak toggle separately from photo notification types                 |

## Blockers

None currently.

### Quick Tasks Completed

| #   | Description                                                                      | Date       | Commit  | Status   | Directory                                                                                           |
| --- | -------------------------------------------------------------------------------- | ---------- | ------- | -------- | --------------------------------------------------------------------------------------------------- |
| 1   | Fix notification badge persisting on Activity tab when all notifications viewed  | 2026-02-23 | d72ed7d |          | [1-fix-notification-badge-persisting-on-act](./quick/1-fix-notification-badge-persisting-on-act/)   |
| 2   | Fix DM conversation empty state, missing input bar, and profile photos           | 2026-02-23 | b7cb2bc |          | [2-fix-new-conversation-missing-input-bar-u](./quick/2-fix-new-conversation-missing-input-bar-u/)   |
| 3   | Fix profile photos not showing properly in Messages tab and conversation header  | 2026-02-23 | 23d3042 |          | [3-fix-profile-photos-not-showing-properly-](./quick/3-fix-profile-photos-not-showing-properly-/)   |
| 4   | Fix conversation screen three-dot menu to use DropdownMenu instead of Alert      | 2026-02-23 | d57bd11 |          | [4-fix-convo-screen-three-dot-menu-not-open](./quick/4-fix-convo-screen-three-dot-menu-not-open/)   |
| 5   | Fix missing input bar when opening or starting a new conversation                | 2026-02-23 | 23d3042 |          | [5-fix-missing-input-bar-when-opening-or-st](./quick/5-fix-missing-input-bar-when-opening-or-st/)   |
| 6   | Fix empty conversation text upside-down on Android (platform-conditional scaleY) | 2026-02-23 | 629c3eb |          | [6-only-on-android-the-empty-text-for-new-c](./quick/6-only-on-android-the-empty-text-for-new-c/)   |
| 7   | Fix missing input bar in conversation view (hide tab bar on nested screens)      | 2026-02-23 | 8843e96 |          | [7-there-is-no-input-bar-in-the-convo-view-](./quick/7-there-is-no-input-bar-in-the-convo-view-/)   |
| 8   | Fix incoming message spacing near input bar (paddingTop on inverted FlatList)    | 2026-02-23 | 8ad69fd |          | [8-fix-incoming-message-spacing-near-input-](./quick/8-fix-incoming-message-spacing-near-input-/)   |
| 9   | Fix iOS DM input bar padding when keyboard open and background color mismatch    | 2026-02-23 | e9b700b |          | [9-fix-ios-dm-input-bar-padding-and-backgro](./quick/9-fix-ios-dm-input-bar-padding-and-backgro/)   |
| 10  | Fix iOS conversation scroll on send/receive (auto-scroll inverted FlatList)      | 2026-02-23 | 57c6090 |          | [10-fix-ios-conversation-scroll-on-send-rece](./quick/10-fix-ios-conversation-scroll-on-send-rece/) |
| 11  | Restyle DM message bubbles and input to retro 16-bit pixel art aesthetic         | 2026-02-23 | c854c0e |          | [11-the-message-bubbles-don-t-match-the-16-b](./quick/11-the-message-bubbles-don-t-match-the-16-b/) |
| 12  | Fix Android DM input bar not returning to bottom on keyboard dismiss             | 2026-02-23 | 4f1cee0 |          | [12-fix-android-dm-input-bar-not-going-to-bo](./quick/12-fix-android-dm-input-bar-not-going-to-bo/) |
| 13  | Restyle DM input bar to full retro 16-bit pixel aesthetic                        | 2026-02-23 | 4b2453e |          | [13-the-input-pill-on-messages-doesn-t-match](./quick/13-the-input-pill-on-messages-doesn-t-match/) |
| 14  | Fix DM GIF button height and add photo picker for image messages                 | 2026-02-23 | f75ad69 |          | [14-fix-dm-gif-button-height-and-add-photo-i](./quick/14-fix-dm-gif-button-height-and-add-photo-i/) |
| 15  | Move read receipts toggle from Settings to dedicated screen                      | 2026-02-23 | 555f513 |          | [15-move-read-receipts-toggle-from-settings-](./quick/15-move-read-receipts-toggle-from-settings-/) |
| 16  | Fix send button height on iOS to match input wrapper                             | 2026-02-23 | 52150d9 |          | [16-fix-send-button-height-on-ios-to-match-i](./quick/16-fix-send-button-height-on-ios-to-match-i/) |
| 17  | Fix photo sending in DM conversations (preview, notification, crop, aspect)      | 2026-02-23 | 90d41e0 |          | [17-fix-photo-sending-in-dm-conversations-se](./quick/17-fix-photo-sending-in-dm-conversations-se/) |
| 18  | Change read receipt font from SpaceMono to Silkscreen pixel font                 | 2026-02-23 | 8bf776f |          | [18-the-read-receipts-and-delivered-text-sho](./quick/18-the-read-receipts-and-delivered-text-sho/) |
| 19  | Fix iOS darkroom card text clipping with explicit lineHeight for PressStart2P    | 2026-02-24 | dc02635 |          | [19-the-2-in-the-ios-darkroom-button-looks-c](./quick/19-the-2-in-the-ios-darkroom-button-looks-c/) |
| 20  | Fix reply scroll-to-message index and highlight timing in DM conversations       | 2026-02-24 | b9744b6 | Verified | [20-fix-reply-scroll-to-message-and-highligh](./quick/20-fix-reply-scroll-to-message-and-highligh/) |
| 21  | Fix convo preview reactions and replace emoji icons with PixelIcon               | 2026-02-24 | f9675d9 |          | [21-fix-convo-preview-reactions-and-replace-](./quick/21-fix-convo-preview-reactions-and-replace-/) |
| 22  | Add cachePolicy to MessageBubble Image components for instant repeat loads       | 2026-02-24 | 01dddf5 |          | [22-when-opening-a-convo-the-reply-photos-do](./quick/22-when-opening-a-convo-the-reply-photos-do/) |
| 23  | Fix reaction badges overlapping on photo/GIF messages in DM conversations        | 2026-02-24 | f601c02 |          | [23-reaction-badges-dont-overlap-on-photos-l](./quick/23-reaction-badges-dont-overlap-on-photos-l/) |
| 24  | Fix push notification logging and stale token detection for dev app              | 2026-02-24 | 381f4e6 |          | [24-push-notifs-for-dev-app-doesn-t-seem-to-](./quick/24-push-notifs-for-dev-app-doesn-t-seem-to-/) |
| 25  | Fix selfie camera auto-mirror (remove skipProcessing from takePictureAsync)      | 2026-02-24 | b791dab |          | [25-fix-selfie-cam-auto-mirror](./quick/25-fix-selfie-cam-auto-mirror/)                             |
| 26  | Fix snap camera to match main Camera tab layout                                  | 2026-02-24 | 42a89ba |          | [26-fix-snap-camera-to-match-main-camera-tab](./quick/26-fix-snap-camera-to-match-main-camera-tab/) |
| 27  | Fix snap send navigation to return to Conversation instead of MessagesList       | 2026-02-24 | 7368ce4 |          | [27-after-sending-a-snap-from-messages-tab-n](./quick/27-after-sending-a-snap-from-messages-tab-n/) |
| 28  | Fix SnapPreviewScreen header X button and recipient label vertical alignment     | 2026-02-24 | 6b2d3e1 |          | [28-on-android-and-ios-the-x-button-and-the-](./quick/28-on-android-and-ios-the-x-button-and-the-/) |
| 29  | Fix snap caption KAV so footer stays fixed when keyboard opens                   | 2026-02-24 | 3688dd8 |          | [29-fix-snap-caption-keyboardavoidingview-fo](./quick/29-fix-snap-caption-keyboardavoidingview-fo/) |
| 30  | Reposition unread badge inline between snap icon and timestamp                   | 2026-02-24 | 7c415f8 |          | [30-the-icon-badge-for-unread-messages-in-a-](./quick/30-the-icon-badge-for-unread-messages-in-a-/) |
| 31  | Fix snap viewer reaction bar and header (unified bar, remove sender name)        | 2026-02-24 | 8ae7770 |          | [31-fix-snap-viewer-reaction-bar-and-header-](./quick/31-fix-snap-viewer-reaction-bar-and-header-/) |
| 32  | Fix send/snap button height to match input bar on both platforms                 | 2026-02-24 | bbfcec2 |          | [32-on-both-android-and-ios-the-send-or-snap](./quick/32-on-both-android-and-ios-the-send-or-snap/) |
| 33  | Fix snap photo black bars on iOS (contentFit contain to cover)                   | 2026-02-24 | 79b1e39 |          | [33-on-ios-only-the-photo-you-take-for-a-sna](./quick/33-on-ios-only-the-photo-you-take-for-a-sna/) |

## Notes

- No new dependencies needed — `expo-screen-capture` deferred to v2 (avoids native rebuild)
- Existing stack covers 100% of v1 requirements
- All v1 changes are JS-only (deployable via OTA update)
- Phase 2 and 3 are independent; Phase 4 depends on Phase 3; Phase 5 depends only on Phase 1

---

Last activity: 2026-02-24 - Completed 04-04-PLAN.md: StreakIndicator wired into ConversationRow, ConversationHeader, and DMInput; Phase 04 Snap Streaks fully complete
