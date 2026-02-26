import ExpoModulesCore
import ActivityKit
import Foundation

public class LiveActivityManagerModule: Module {
    public func definition() -> ModuleDefinition {
        Name("LiveActivityManager")

        /// Start a Live Activity for a pinned snap.
        /// Copies the thumbnail to App Groups shared container so the widget extension can read it.
        /// Enforces a cap of 5 active activities — ends the oldest if at cap.
        /// Returns the native activity ID string, or nil if not supported.
        AsyncFunction("startActivity") { (activityId: String, senderName: String, caption: String?, deepLinkUrl: String, thumbnailUri: String) -> String? in
            if #available(iOS 16.2, *) {
                guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                    return nil
                }

                // Cap enforcement: max 5 active activities
                let currentActivities = Activity<PinnedSnapAttributes>.activities
                if currentActivities.count >= 5 {
                    // End the oldest activity (first in the list) to make room
                    if let oldest = currentActivities.first {
                        // Clean up the thumbnail file for the oldest activity
                        self.removeThumbnail(for: oldest.attributes.activityId)
                        await oldest.end(nil, dismissalPolicy: .immediate)
                    }
                }

                // Copy thumbnail to App Groups shared container
                self.copyThumbnailToAppGroup(activityId: activityId, fromUri: thumbnailUri)

                let attributes = PinnedSnapAttributes(
                    activityId: activityId,
                    senderName: senderName,
                    caption: caption,
                    deepLinkUrl: deepLinkUrl
                )
                let state = PinnedSnapAttributes.ContentState()
                let content = ActivityContent(
                    state: state,
                    staleDate: Date().addingTimeInterval(48 * 60 * 60)
                )

                do {
                    let activity = try Activity.request(
                        attributes: attributes,
                        content: content,
                        pushType: nil
                    )
                    return activity.id
                } catch {
                    return nil
                }
            } else {
                return nil
            }
        }

        /// End a specific Live Activity by its activity ID.
        AsyncFunction("endActivity") { (activityId: String) in
            if #available(iOS 16.2, *) {
                for activity in Activity<PinnedSnapAttributes>.activities {
                    if activity.attributes.activityId == activityId {
                        await activity.end(nil, dismissalPolicy: .immediate)
                        self.removeThumbnail(for: activityId)
                        break
                    }
                }
            }
        }

        /// End all active pinned snap Live Activities.
        AsyncFunction("endAllActivities") { () in
            if #available(iOS 16.2, *) {
                for activity in Activity<PinnedSnapAttributes>.activities {
                    self.removeThumbnail(for: activity.attributes.activityId)
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
        }

        /// Get the count of currently active pinned snap Live Activities.
        AsyncFunction("getActiveCount") { () -> Int in
            if #available(iOS 16.2, *) {
                return Activity<PinnedSnapAttributes>.activities.count
            } else {
                return 0
            }
        }
    }

    // MARK: - App Groups File I/O

    private static let appGroupId = "group.com.spoodsjs.flick"

    /// Copy a thumbnail from a local file URI to the App Groups shared container.
    private func copyThumbnailToAppGroup(activityId: String, fromUri: String) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: Self.appGroupId
        ) else {
            return
        }

        // Create thumbnails subdirectory if needed
        let thumbnailDir = containerURL.appendingPathComponent("pinned_thumbnails")
        try? FileManager.default.createDirectory(at: thumbnailDir, withIntermediateDirectories: true)

        let destinationURL = thumbnailDir.appendingPathComponent("\(activityId).jpg")

        // Parse the source URI — handle both file:// URLs and plain paths
        let sourceURL: URL
        if fromUri.hasPrefix("file://") {
            guard let url = URL(string: fromUri) else { return }
            sourceURL = url
        } else {
            sourceURL = URL(fileURLWithPath: fromUri)
        }

        // Remove existing file if present, then copy
        try? FileManager.default.removeItem(at: destinationURL)
        try? FileManager.default.copyItem(at: sourceURL, to: destinationURL)
    }

    /// Remove a thumbnail from the App Groups shared container.
    private func removeThumbnail(for activityId: String) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: Self.appGroupId
        ) else {
            return
        }

        let thumbnailURL = containerURL
            .appendingPathComponent("pinned_thumbnails")
            .appendingPathComponent("\(activityId).jpg")

        try? FileManager.default.removeItem(at: thumbnailURL)
    }
}
