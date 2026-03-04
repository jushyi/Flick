// IMPORTANT: This file must stay in sync with targets/FlickLiveActivity/PinnedSnapAttributes.swift
// Any changes here MUST be mirrored to the widget extension target copy.

import ActivityKit
import Foundation

struct PinnedSnapAttributes: ActivityAttributes {
    /// Unique ID for this pinned snap activity (usually the snap message ID)
    var activityId: String
    /// Display name of the sender
    var senderName: String
    /// Optional caption text (snap message text, truncated)
    var caption: String?
    /// Deep link URL to open when tapped (e.g., lapse://messages/{conversationId})
    var deepLinkUrl: String

    /// ContentState is empty — compact-only layout with no dynamic updates needed
    struct ContentState: Codable, Hashable {}
}
