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
///
/// KNOWN ISSUE: Activity.request() fails with "Target does not include
/// NSSupportsLiveActivities plist key" despite the key being in Info.plist.
/// @bacons/apple-targets sets GENERATE_INFOPLIST_FILE=YES which may strip
/// custom keys during Xcode's plist generation. Needs further investigation.
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

        // Expo Push Service nests custom data under the "body" key in APNS userInfo
        // as a JSON-encoded string, not a native dictionary.
        let bodyData: [String: Any]
        if let bodyDict = userInfo["body"] as? [String: Any] {
            bodyData = bodyDict
        } else if let bodyString = userInfo["body"] as? String,
                  let jsonData = bodyString.data(using: .utf8),
                  let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
            bodyData = parsed
        } else if userInfo["pinned"] != nil {
            bodyData = userInfo as? [String: Any] ?? [:]
        } else {
            bodyData = [:]
        }

        // Only intercept pinned snap notifications
        let isPinned: Bool
        if let pinnedStr = bodyData["pinned"] as? String {
            isPinned = pinnedStr == "true"
        } else if let pinnedBool = bodyData["pinned"] as? Bool {
            isPinned = pinnedBool
        } else {
            isPinned = false
        }

        guard isPinned else {
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

        // Extract pinned snap data from notification body
        let activityId = bodyData["pinnedActivityId"] as? String ?? ""
        let thumbnailUrlString = bodyData["pinnedThumbnailUrl"] as? String ?? ""
        let caption = bodyData["caption"] as? String
        let conversationId = bodyData["conversationId"] as? String ?? ""
        let senderName = bodyData["senderName"] as? String ?? "Someone"

        guard !activityId.isEmpty else {
            contentHandler(bestAttemptContent)
            return
        }

        // Deduplication: skip if activity with same activityId already exists
        let currentActivities = Activity<PinnedSnapAttributes>.activities
        for activity in currentActivities {
            if activity.attributes.activityId == activityId {
                contentHandler(bestAttemptContent)
                return
            }
        }

        // Download thumbnail and start Live Activity
        Task {
            if !thumbnailUrlString.isEmpty, let thumbnailUrl = URL(string: thumbnailUrlString) {
                do {
                    let (data, _) = try await URLSession.shared.data(from: thumbnailUrl)
                    self.saveThumbnailToAppGroup(activityId: activityId, imageData: data)
                } catch {
                    // Continue without thumbnail
                }
            }

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
                // Known issue: NSSupportsLiveActivities plist key not found at runtime
            }

            // Cap enforcement: if over max, end the oldest
            let allActivities = Activity<PinnedSnapAttributes>.activities
            if allActivities.count > self.maxActiveActivities {
                if let oldest = allActivities.sorted(by: { $0.id < $1.id }).first {
                    await oldest.end(nil, dismissalPolicy: .immediate)
                }
            }

            contentHandler(bestAttemptContent)
        }
        #else
        contentHandler(bestAttemptContent)
        #endif
    }

    override func serviceExtensionTimeWillExpire() {
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }

    // MARK: - Private Helpers

    private func saveThumbnailToAppGroup(activityId: String, imageData: Data) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        ) else { return }

        let thumbsDir = containerURL.appendingPathComponent("thumbnails")
        try? FileManager.default.createDirectory(at: thumbsDir, withIntermediateDirectories: true)

        let destURL = thumbsDir.appendingPathComponent("\(activityId).jpg")
        try? FileManager.default.removeItem(at: destURL)
        try? imageData.write(to: destURL)
    }
}
