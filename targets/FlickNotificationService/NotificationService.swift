import UserNotifications
import Foundation

#if canImport(ActivityKit)
import ActivityKit
#endif

/// Notification Service Extension that intercepts pinned snap push notifications
/// in all app states (foreground, background, killed) to start a Live Activity.
///
/// The NSE runs in a separate process with a ~30 second time limit.
/// It downloads the snap thumbnail to the App Groups shared container
/// so the widget extension can display it, then starts the Live Activity.
class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    /// App Group identifier for sharing data between main app, widget, and NSE.
    private let appGroupId = "group.com.spoodsjs.flick"

    /// Maximum number of concurrent Live Activities allowed.
    private let maxActiveActivities = 5

    /// Duration in seconds before a Live Activity auto-expires (48 hours).
    private let expiryInterval: TimeInterval = 48 * 60 * 60

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let bestAttemptContent = bestAttemptContent else {
            contentHandler(request.content)
            return
        }

        let userInfo = bestAttemptContent.userInfo

        // Only intercept pinned snap notifications
        guard let pinned = userInfo["pinned"] as? String, pinned == "true" else {
            contentHandler(bestAttemptContent)
            return
        }

        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else {
            contentHandler(bestAttemptContent)
            return
        }

        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            contentHandler(bestAttemptContent)
            return
        }

        // Extract pinned snap data from notification payload
        let activityId = userInfo["pinnedActivityId"] as? String ?? ""
        let thumbnailUrlString = userInfo["pinnedThumbnailUrl"] as? String ?? ""
        let caption = userInfo["caption"] as? String
        let conversationId = userInfo["conversationId"] as? String ?? ""
        let senderName = userInfo["senderName"] as? String ?? "Someone"

        guard !activityId.isEmpty else {
            contentHandler(bestAttemptContent)
            return
        }

        // Deduplication: skip if activity with same activityId already exists
        let currentActivities = Activity<PinnedSnapAttributes>.activities
        for activity in currentActivities {
            if activity.attributes.activityId == activityId {
                // Already running — deliver notification without starting another
                contentHandler(bestAttemptContent)
                return
            }
        }

        // Download thumbnail and start Live Activity
        Task {
            // Download thumbnail to App Groups container
            if !thumbnailUrlString.isEmpty, let thumbnailUrl = URL(string: thumbnailUrlString) {
                do {
                    let (data, _) = try await URLSession.shared.data(from: thumbnailUrl)
                    self.saveThumbnailToAppGroup(activityId: activityId, imageData: data)
                } catch {
                    // Continue without thumbnail — Live Activity can still show text
                }
            }

            // Create Live Activity
            let deepLinkUrl = "lapse://messages/\(conversationId)"
            let attributes = PinnedSnapAttributes(
                activityId: activityId,
                senderName: senderName,
                caption: caption,
                deepLinkUrl: deepLinkUrl
            )

            let state = PinnedSnapAttributes.ContentState()
            let content = ActivityContent(
                state: state,
                staleDate: Date().addingTimeInterval(self.expiryInterval)
            )

            do {
                _ = try Activity.request(
                    attributes: attributes,
                    content: content,
                    pushType: nil
                )
            } catch {
                // Live Activity start failed — deliver notification anyway
            }

            // Cap enforcement: if over max, end the oldest
            let allActivities = Activity<PinnedSnapAttributes>.activities
            if allActivities.count > self.maxActiveActivities {
                if let oldest = allActivities.sorted(by: { $0.id < $1.id }).first {
                    await oldest.end(nil, dismissalPolicy: .immediate)
                }
            }

            // Deliver the notification to the user
            contentHandler(bestAttemptContent)
        }
        #else
        contentHandler(bestAttemptContent)
        #endif
    }

    override func serviceExtensionTimeWillExpire() {
        // Called just before the extension will be terminated by the system.
        // Deliver the notification as-is, even if Live Activity setup didn't complete.
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }

    // MARK: - Private Helpers

    /// Saves thumbnail image data to the App Groups shared container.
    /// Path matches what the widget extension reads: thumbnails/{activityId}.jpg
    private func saveThumbnailToAppGroup(activityId: String, imageData: Data) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        ) else { return }

        let thumbsDir = containerURL.appendingPathComponent("thumbnails")
        try? FileManager.default.createDirectory(at: thumbsDir, withIntermediateDirectories: true)

        let destURL = thumbsDir.appendingPathComponent("\(activityId).jpg")

        // Overwrite if already exists
        try? FileManager.default.removeItem(at: destURL)
        try? imageData.write(to: destURL)
    }
}
