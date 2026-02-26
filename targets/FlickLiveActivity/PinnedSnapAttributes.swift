// PinnedSnapAttributes.swift
// IMPORTANT: This file must stay in sync with modules/live-activity-manager/src/PinnedSnapAttributes.swift
// Both copies must be identical for ActivityKit to match activities correctly.

import ActivityKit
import Foundation

struct PinnedSnapAttributes: ActivityAttributes {
    /// Unique identifier for the pinned snap activity (usually the message ID)
    var activityId: String
    /// Display name of the snap sender
    var senderName: String
    /// Optional caption text (snap message text), truncated for display
    var caption: String?
    /// Deep link URL to open the conversation when tapped
    var deepLinkUrl: String

    /// ContentState is empty — compact-only layout with no dynamic updates needed
    struct ContentState: Codable, Hashable {}
}
