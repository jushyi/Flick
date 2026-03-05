import UserNotifications
import Foundation

class NotificationService: UNNotificationServiceExtension {
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

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

        // Parse notification data (handle Expo push nesting)
        let bodyData = extractBodyData(from: bestAttemptContent.userInfo)

        // Only enhance pinned snap notifications with thumbnail
        guard isPinned(bodyData),
              let thumbnailUrlString = bodyData["pinnedThumbnailUrl"] as? String,
              !thumbnailUrlString.isEmpty,
              let thumbnailUrl = URL(string: thumbnailUrlString) else {
            contentHandler(bestAttemptContent)
            return
        }

        // Set thread identifier for notification grouping
        if let conversationId = bodyData["conversationId"] as? String {
            bestAttemptContent.threadIdentifier = "pinned-\(conversationId)"
        }

        // Download thumbnail and attach
        Task {
            do {
                let (data, _) = try await URLSession.shared.data(from: thumbnailUrl)
                let tmpFile = FileManager.default.temporaryDirectory
                    .appendingPathComponent(UUID().uuidString + ".jpg")
                try data.write(to: tmpFile)

                let attachment = try UNNotificationAttachment(
                    identifier: "snap-thumbnail",
                    url: tmpFile,
                    options: [UNNotificationAttachmentOptionsTypeHintKey: "public.jpeg"]
                )
                bestAttemptContent.attachments = [attachment]
            } catch {
                // Graceful fallback -- notification displays without image
            }
            contentHandler(bestAttemptContent)
        }
    }

    override func serviceExtensionTimeWillExpire() {
        // Deliver whatever we have so far
        if let contentHandler = contentHandler,
           let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }

    // MARK: - Private Helpers

    private func extractBodyData(from userInfo: [AnyHashable: Any]) -> [String: Any] {
        // Expo nests data under "body" as dict or JSON string
        if let bodyDict = userInfo["body"] as? [String: Any] {
            return bodyDict
        } else if let bodyString = userInfo["body"] as? String,
                  let jsonData = bodyString.data(using: .utf8),
                  let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
            return parsed
        } else if userInfo["pinned"] != nil {
            return userInfo as? [String: Any] ?? [:]
        }
        return [:]
    }

    private func isPinned(_ bodyData: [String: Any]) -> Bool {
        if let pinnedStr = bodyData["pinned"] as? String { return pinnedStr == "true" }
        if let pinnedBool = bodyData["pinned"] as? Bool { return pinnedBool }
        return false
    }
}
