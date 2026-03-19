// IMPORTANT: This file must stay in sync across all 3 locations:
// - targets/FlickLiveActivity/PinnedSnapAttributes.swift
// - modules/live-activity-manager/src/PinnedSnapAttributes.swift
// - targets/FlickNotificationService/PinnedSnapAttributes.swift

import ActivityKit
import Foundation

struct PinnedSnapAttributes: ActivityAttributes {
    /// Stack ID — uses "pinned-stack" for the single stacked activity
    var activityId: String
    /// Display name of the first/top sender (used for single-snap mode)
    var senderName: String
    /// Optional caption text (used for single-snap mode)
    var caption: String?
    /// Deep link URL — points to messages list for stacked mode
    var deepLinkUrl: String

    struct ContentState: Codable, Hashable {
        /// Stack of pinned snap entries. Empty array = no entries (should end activity).
        /// Single entry = render single Polaroid with caption. Multiple = stacked layout.
        var stack: [StackEntry]

        struct StackEntry: Codable, Hashable {
            /// Individual snap identifier (the snap message ID)
            let snapActivityId: String
            /// Display name of the sender
            let senderName: String
            /// Optional caption text
            let caption: String?
            /// Conversation ID for deep link when tapped
            let conversationId: String
        }
    }
}
