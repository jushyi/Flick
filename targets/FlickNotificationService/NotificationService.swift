import UserNotifications
import Foundation
import os.log

#if canImport(ActivityKit)
import ActivityKit
#endif

private let log = OSLog(subsystem: "com.spoodsjs.flick.nse", category: "PinnedSnap")

/// Notification Service Extension that intercepts pinned snap push notifications
/// in all app states (foreground, background, killed) to start a Live Activity.
///
/// The NSE runs in a separate process with a ~30 second time limit.
/// It downloads the snap thumbnail to the App Groups shared container
/// so the widget extension can display it, then starts the Live Activity.
///
/// Diagnostics are written to App Groups at nse-diagnostics.json for debugging
/// on machines without Console.app access.
class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    /// App Group identifier for sharing data between main app, widget, and NSE.
    private let appGroupId = "group.com.spoodsjs.flick"

    /// Maximum number of concurrent Live Activities allowed.
    private let maxActiveActivities = 5

    /// Duration in seconds before a Live Activity auto-expires (48 hours).
    private let expiryInterval: TimeInterval = 48 * 60 * 60

    /// Diagnostic log entries for this NSE invocation
    private var diagnosticEntries: [[String: Any]] = []

    private func diag(_ step: String, _ details: [String: Any] = [:]) {
        var entry: [String: Any] = [
            "step": step,
            "time": ISO8601DateFormatter().string(from: Date())
        ]
        for (k, v) in details { entry[k] = v }
        diagnosticEntries.append(entry)
        os_log("NSE: %{public}@ %{public}@", log: log, type: .info, step, String(describing: details))
    }

    private func writeDiagnostics() {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        ) else { return }

        let diagURL = containerURL.appendingPathComponent("nse-diagnostics.json")

        // Read existing entries (keep last 20)
        var allEntries: [[String: Any]] = []
        if let existingData = try? Data(contentsOf: diagURL),
           let existing = try? JSONSerialization.jsonObject(with: existingData) as? [[String: Any]] {
            allEntries = existing
        }

        // Add this invocation as a group
        let invocation: [String: Any] = [
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "entries": diagnosticEntries
        ]
        allEntries.append(invocation)

        // Keep last 10 invocations
        if allEntries.count > 10 {
            allEntries = Array(allEntries.suffix(10))
        }

        if let jsonData = try? JSONSerialization.data(withJSONObject: allEntries, options: .prettyPrinted) {
            try? jsonData.write(to: diagURL)
        }
    }

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        diagnosticEntries = []
        diag("didReceive_called")

        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let bestAttemptContent = bestAttemptContent else {
            diag("error_no_content")
            writeDiagnostics()
            contentHandler(request.content)
            return
        }

        let userInfo = bestAttemptContent.userInfo
        let keys = userInfo.keys.map { String(describing: $0) }
        diag("userInfo_keys", ["keys": keys])

        // Expo Push Service nests custom data under the "body" key in APNS userInfo
        // as a JSON-encoded string, not a native dictionary.
        let bodyData: [String: Any]
        if let bodyDict = userInfo["body"] as? [String: Any] {
            diag("bodyData_source", ["source": "dict"])
            bodyData = bodyDict
        } else if let bodyString = userInfo["body"] as? String,
                  let jsonData = bodyString.data(using: .utf8),
                  let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
            diag("bodyData_source", ["source": "json_string", "raw": bodyString])
            bodyData = parsed
        } else if userInfo["pinned"] != nil {
            diag("bodyData_source", ["source": "direct_userInfo"])
            bodyData = userInfo as? [String: Any] ?? [:]
        } else {
            diag("bodyData_source", ["source": "none_found"])
            // Dump raw userInfo for diagnosis
            let rawDump = userInfo.map { "\($0.key): \(type(of: $0.value)) = \($0.value)" }
            diag("userInfo_dump", ["raw": rawDump])
            bodyData = [:]
        }

        let bodyKeys = bodyData.keys.sorted()
        diag("bodyData_keys", ["keys": bodyKeys])

        // Only intercept pinned snap notifications
        let isPinned: Bool
        if let pinnedStr = bodyData["pinned"] as? String {
            isPinned = pinnedStr == "true"
            diag("pinned_check", ["type": "string", "value": pinnedStr, "isPinned": isPinned])
        } else if let pinnedBool = bodyData["pinned"] as? Bool {
            isPinned = pinnedBool
            diag("pinned_check", ["type": "bool", "value": pinnedBool])
        } else {
            isPinned = false
            diag("pinned_check", ["type": "missing", "isPinned": false])
        }

        guard isPinned else {
            diag("exit_not_pinned")
            writeDiagnostics()
            contentHandler(bestAttemptContent)
            return
        }

        diag("pinned_snap_detected")

        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else {
            diag("exit_ios_too_old")
            writeDiagnostics()
            contentHandler(bestAttemptContent)
            return
        }

        let authInfo = ActivityAuthorizationInfo()
        diag("activity_auth", [
            "areActivitiesEnabled": authInfo.areActivitiesEnabled,
            "frequentPushesEnabled": authInfo.frequentPushesEnabled
        ])

        guard authInfo.areActivitiesEnabled else {
            diag("exit_activities_disabled")
            writeDiagnostics()
            contentHandler(bestAttemptContent)
            return
        }

        // Extract pinned snap data from notification body
        let activityId = bodyData["pinnedActivityId"] as? String ?? ""
        let thumbnailUrlString = bodyData["pinnedThumbnailUrl"] as? String ?? ""
        let caption = bodyData["caption"] as? String
        let conversationId = bodyData["conversationId"] as? String ?? ""
        let senderName = bodyData["senderName"] as? String ?? "Someone"

        diag("extracted_data", [
            "activityId": activityId,
            "thumbnailUrl_full": thumbnailUrlString,
            "thumbnailUrl_length": thumbnailUrlString.count,
            "thumbnailUrl_isEmpty": thumbnailUrlString.isEmpty,
            "caption": caption ?? "(none)",
            "conversationId": conversationId,
            "senderName": senderName
        ])

        guard !activityId.isEmpty else {
            diag("exit_empty_activityId")
            writeDiagnostics()
            contentHandler(bestAttemptContent)
            return
        }

        // Deduplication: skip if activity with same activityId already exists
        let currentActivities = Activity<PinnedSnapAttributes>.activities
        diag("current_activities", ["count": currentActivities.count])
        for activity in currentActivities {
            if activity.attributes.activityId == activityId {
                diag("exit_duplicate", ["activityId": activityId])
                writeDiagnostics()
                contentHandler(bestAttemptContent)
                return
            }
        }

        // Download thumbnail and start Live Activity
        Task {
            if !thumbnailUrlString.isEmpty, let thumbnailUrl = URL(string: thumbnailUrlString) {
                diag("thumbnail_downloading")
                do {
                    let (data, _) = try await URLSession.shared.data(from: thumbnailUrl)
                    diag("thumbnail_downloaded", ["bytes": data.count])
                    self.saveThumbnailToAppGroup(activityId: activityId, imageData: data)

                    // Verify thumbnail was saved
                    if let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: self.appGroupId) {
                        let verifyURL = containerURL.appendingPathComponent("thumbnails/\(activityId).jpg")
                        let exists = FileManager.default.fileExists(atPath: verifyURL.path)
                        let size = (try? FileManager.default.attributesOfItem(atPath: verifyURL.path)[.size] as? Int) ?? 0
                        self.diag("thumbnail_verify", ["exists": exists, "bytes": size, "path": verifyURL.path])
                    }
                } catch {
                    diag("thumbnail_download_failed", ["error": error.localizedDescription])
                }
            } else {
                diag("thumbnail_skipped")
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

            diag("calling_activity_request")

            do {
                let activity = try Activity.request(
                    attributes: attributes,
                    content: content,
                    pushType: nil
                )
                diag("activity_request_SUCCESS", ["nativeId": activity.id])
            } catch {
                diag("activity_request_FAILED", [
                    "error": error.localizedDescription,
                    "errorType": String(describing: type(of: error)),
                    "errorFull": String(describing: error)
                ])
            }

            // Cap enforcement: if over max, end the oldest
            let allActivities = Activity<PinnedSnapAttributes>.activities
            diag("post_request_activities", ["count": allActivities.count])
            if allActivities.count > self.maxActiveActivities {
                if let oldest = allActivities.sorted(by: { $0.id < $1.id }).first {
                    diag("capping_oldest")
                    await oldest.end(nil, dismissalPolicy: .immediate)
                }
            }

            diag("nse_complete")
            self.writeDiagnostics()
            contentHandler(bestAttemptContent)
        }
        #else
        diag("exit_no_activitykit")
        writeDiagnostics()
        contentHandler(bestAttemptContent)
        #endif
    }

    override func serviceExtensionTimeWillExpire() {
        diag("serviceExtensionTimeWillExpire")
        writeDiagnostics()
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }

    // MARK: - Private Helpers

    private func saveThumbnailToAppGroup(activityId: String, imageData: Data) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        ) else {
            diag("thumbnail_save_failed", ["reason": "no_app_group_container"])
            return
        }

        let thumbsDir = containerURL.appendingPathComponent("thumbnails")
        try? FileManager.default.createDirectory(at: thumbsDir, withIntermediateDirectories: true)

        let destURL = thumbsDir.appendingPathComponent("\(activityId).jpg")
        try? FileManager.default.removeItem(at: destURL)
        do {
            try imageData.write(to: destURL)
            diag("thumbnail_saved", ["file": destURL.lastPathComponent])
        } catch {
            diag("thumbnail_save_failed", ["error": error.localizedDescription])
        }
    }
}
