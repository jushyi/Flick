import ExpoModulesCore
import Foundation

#if canImport(ActivityKit)
import ActivityKit
#endif

/// Maximum number of concurrent Live Activities allowed per recipient.
/// When cap is reached, the oldest activity is dismissed to make room.
private let MAX_ACTIVE_ACTIVITIES = 5

/// Duration in seconds before a Live Activity auto-expires (48 hours).
private let EXPIRY_INTERVAL: TimeInterval = 48 * 60 * 60

public class LiveActivityManagerModule: Module {
    public func definition() -> ModuleDefinition {
        Name("LiveActivityManager")

        // MARK: - startActivity
        // Starts a new pinned snap Live Activity on the lock screen.
        // Copies the thumbnail to the App Groups shared container for the widget to read.
        // Enforces the 5-activity cap by ending the oldest activity if needed.
        AsyncFunction("startActivity") { (activityId: String, senderName: String, caption: String?, deepLinkUrl: String, thumbnailUri: String) -> String? in
            #if canImport(ActivityKit)
            guard #available(iOS 16.2, *) else { return nil }
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }

            // Copy thumbnail to App Groups shared container for widget access
            self.copyThumbnailToAppGroup(activityId: activityId, thumbnailUri: thumbnailUri)

            // Deduplication: skip if activity with same ID already exists (NSE may have started it)
            let currentActivities = Activity<PinnedSnapAttributes>.activities
            for activity in currentActivities {
                if activity.attributes.activityId == activityId {
                    return activity.id  // Already running, return existing ID
                }
            }

            // Cap enforcement: if at max, end the oldest activity
            if currentActivities.count >= MAX_ACTIVE_ACTIVITIES {
                // End the oldest activity (first in the array — typically oldest)
                if let oldest = currentActivities.sorted(by: { $0.id < $1.id }).first {
                    await oldest.end(nil, dismissalPolicy: .immediate)
                }
            }

            let attributes = PinnedSnapAttributes(
                activityId: activityId,
                senderName: senderName,
                caption: caption,
                deepLinkUrl: deepLinkUrl
            )

            let state = PinnedSnapAttributes.ContentState()
            let content = ActivityContent(
                state: state,
                staleDate: Date().addingTimeInterval(EXPIRY_INTERVAL)
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
            #else
            return nil
            #endif
        }

        // MARK: - endActivity
        // Ends a specific Live Activity matching the given activityId.
        AsyncFunction("endActivity") { (activityId: String) in
            #if canImport(ActivityKit)
            guard #available(iOS 16.2, *) else { return }

            for activity in Activity<PinnedSnapAttributes>.activities {
                if activity.attributes.activityId == activityId {
                    await activity.end(nil, dismissalPolicy: .immediate)
                    // Clean up thumbnail from App Groups container
                    self.removeThumbnailFromAppGroup(activityId: activityId)
                    break
                }
            }
            #endif
        }

        // MARK: - endAllActivities
        // Ends all active pinned snap Live Activities immediately.
        AsyncFunction("endAllActivities") {
            #if canImport(ActivityKit)
            guard #available(iOS 16.2, *) else { return }

            for activity in Activity<PinnedSnapAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
                // Clean up thumbnail
                self.removeThumbnailFromAppGroup(activityId: activity.attributes.activityId)
            }
            #endif
        }

        // MARK: - getActiveCount
        // Returns the number of currently active pinned snap Live Activities.
        AsyncFunction("getActiveCount") { () -> Int in
            #if canImport(ActivityKit)
            guard #available(iOS 16.2, *) else { return 0 }
            return Activity<PinnedSnapAttributes>.activities.count
            #else
            return 0
            #endif
        }

        // MARK: - getNSEDiagnostics
        // Reads the NSE diagnostic log written to App Groups by the NotificationService extension.
        // Returns JSON string of diagnostic entries, or null if no diagnostics exist.
        AsyncFunction("getNSEDiagnostics") { () -> String? in
            guard let containerURL = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: self.appGroupId
            ) else { return nil }

            let diagURL = containerURL.appendingPathComponent("nse-diagnostics.json")
            guard let data = try? Data(contentsOf: diagURL) else { return nil }
            return String(data: data, encoding: .utf8)
        }

        // MARK: - clearNSEDiagnostics
        // Clears the NSE diagnostic log file.
        AsyncFunction("clearNSEDiagnostics") {
            guard let containerURL = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: self.appGroupId
            ) else { return }

            let diagURL = containerURL.appendingPathComponent("nse-diagnostics.json")
            try? FileManager.default.removeItem(at: diagURL)
        }
    }

    // MARK: - Private Helpers

    /// App Group identifier for sharing data between main app and widget extension.
    private let appGroupId = "group.com.spoodsjs.flick"

    /// Copies a thumbnail image from a local file URI to the App Groups shared container.
    /// The widget extension reads from this location to display the photo.
    private func copyThumbnailToAppGroup(activityId: String, thumbnailUri: String) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        ) else { return }

        // Create thumbnails subdirectory if needed
        let thumbsDir = containerURL.appendingPathComponent("thumbnails")
        try? FileManager.default.createDirectory(at: thumbsDir, withIntermediateDirectories: true)

        let destURL = thumbsDir.appendingPathComponent("\(activityId).jpg")

        // Parse the source URI — handle both file:// URLs and plain paths
        let sourceURL: URL
        if thumbnailUri.hasPrefix("file://") {
            guard let url = URL(string: thumbnailUri) else { return }
            sourceURL = url
        } else {
            sourceURL = URL(fileURLWithPath: thumbnailUri)
        }

        // Copy file, overwriting if it already exists
        try? FileManager.default.removeItem(at: destURL)
        try? FileManager.default.copyItem(at: sourceURL, to: destURL)
    }

    /// Removes a thumbnail image from the App Groups shared container.
    private func removeThumbnailFromAppGroup(activityId: String) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        ) else { return }

        let thumbURL = containerURL.appendingPathComponent("thumbnails/\(activityId).jpg")
        try? FileManager.default.removeItem(at: thumbURL)
    }
}
