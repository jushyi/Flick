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
    /// Tracks activities that should be re-created if user swipes them away.
    /// Key: activityId, Value: attributes used to create the activity.
    /// Entries are removed ONLY when endActivity is called (snap viewed).
    #if canImport(ActivityKit)
    @available(iOS 16.2, *)
    private lazy var persistentActivities: [String: PinnedSnapAttributes] = [:]
    #endif

    /// Active observation tasks, keyed by activityId, for cleanup.
    private var observationTasks: [String: Task<Void, Never>] = [:]

    public func definition() -> ModuleDefinition {
        Name("LiveActivityManager")

        // MARK: - startActivity
        // Starts a new pinned snap Live Activity on the lock screen.
        // Copies the thumbnail to the App Groups shared container for the widget to read.
        // Enforces the 5-activity cap by ending the oldest activity if needed.
        // Throws descriptive errors to JS instead of silently returning nil.
        AsyncFunction("startActivity") { (activityId: String, senderName: String, caption: String?, deepLinkUrl: String, thumbnailUri: String) -> String? in
            #if canImport(ActivityKit)
            guard #available(iOS 16.2, *) else {
                throw NSError(domain: "LiveActivityManager", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "iOS 16.2+ required for Live Activities"])
            }

            let authInfo = ActivityAuthorizationInfo()
            guard authInfo.areActivitiesEnabled else {
                throw NSError(domain: "LiveActivityManager", code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "Live Activities disabled in Settings (areActivitiesEnabled=false)"])
            }

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
                // Track for persistence and start observing for dismissal
                self.persistentActivities[activityId] = attributes
                self.observeActivityState(activity, activityId: activityId)
                return activity.id
            } catch {
                // Re-throw with the actual error message so JS can log it
                throw NSError(domain: "LiveActivityManager", code: 3,
                    userInfo: [NSLocalizedDescriptionKey: "Activity.request() failed: \(error.localizedDescription) | Full: \(String(describing: error))"])
            }
            #else
            throw NSError(domain: "LiveActivityManager", code: 0,
                userInfo: [NSLocalizedDescriptionKey: "ActivityKit not available (canImport failed)"])
            #endif
        }

        // MARK: - endActivity
        // Ends a specific Live Activity matching the given activityId.
        // Removes from persistent tracking FIRST to prevent re-creation on dismissal.
        AsyncFunction("endActivity") { (activityId: String) in
            #if canImport(ActivityKit)
            guard #available(iOS 16.2, *) else { return }

            // Remove from persistent tracking FIRST -- prevents re-creation
            self.persistentActivities.removeValue(forKey: activityId)
            self.observationTasks[activityId]?.cancel()
            self.observationTasks.removeValue(forKey: activityId)

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
        // Clears all persistent tracking before ending to prevent re-creation.
        AsyncFunction("endAllActivities") {
            #if canImport(ActivityKit)
            guard #available(iOS 16.2, *) else { return }

            // Clear all persistent tracking FIRST -- prevents re-creation
            self.persistentActivities.removeAll()
            for (_, task) in self.observationTasks {
                task.cancel()
            }
            self.observationTasks.removeAll()

            for activity in Activity<PinnedSnapAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
                // Clean up thumbnail
                self.removeThumbnailFromAppGroup(activityId: activity.attributes.activityId)
            }
            #endif
        }

        // MARK: - diagnose
        // Returns a diagnostic string checking each prerequisite for Live Activities.
        // Call from JS to see why startActivity returns null.
        AsyncFunction("diagnose") { () -> String in
            var lines: [String] = []

            #if canImport(ActivityKit)
            lines.append("canImport(ActivityKit): YES")

            if #available(iOS 16.2, *) {
                lines.append("iOS 16.2+: YES")

                let authInfo = ActivityAuthorizationInfo()
                lines.append("areActivitiesEnabled: \(authInfo.areActivitiesEnabled)")
                lines.append("frequentPushesEnabled: \(authInfo.frequentPushesEnabled)")

                let count = Activity<PinnedSnapAttributes>.activities.count
                lines.append("currentActivityCount: \(count)")

                // Try to actually request an activity with a test ID and see what error we get
                let testAttributes = PinnedSnapAttributes(
                    activityId: "__diag_test__",
                    senderName: "Diagnostic",
                    caption: nil,
                    deepLinkUrl: "lapse://test"
                )
                let testState = PinnedSnapAttributes.ContentState()
                let testContent = ActivityContent(
                    state: testState,
                    staleDate: Date().addingTimeInterval(60)
                )

                do {
                    let activity = try Activity.request(
                        attributes: testAttributes,
                        content: testContent,
                        pushType: nil
                    )
                    lines.append("Activity.request(): SUCCESS (id=\(activity.id))")
                    // Clean up test activity immediately
                    await activity.end(nil, dismissalPolicy: .immediate)
                    lines.append("Test activity cleaned up")
                } catch {
                    lines.append("Activity.request(): FAILED")
                    lines.append("error.localizedDescription: \(error.localizedDescription)")
                    lines.append("error.full: \(String(describing: error))")
                }
            } else {
                lines.append("iOS 16.2+: NO (current: \(ProcessInfo.processInfo.operatingSystemVersionString))")
            }
            #else
            lines.append("canImport(ActivityKit): NO")
            #endif

            return lines.joined(separator: "\n")
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

    /// Observes an activity's state updates and automatically re-creates it if dismissed by the user.
    /// Only re-creates if the activityId is still in `persistentActivities` (not explicitly ended).
    #if canImport(ActivityKit)
    @available(iOS 16.2, *)
    private func observeActivityState(_ activity: Activity<PinnedSnapAttributes>, activityId: String) {
        // Cancel any existing observation for this activityId
        observationTasks[activityId]?.cancel()

        let task = Task { [weak self] in
            for await state in activity.activityStateUpdates {
                guard let self = self else { return }

                if state == .dismissed {
                    // Check if this activity should persist (not explicitly ended)
                    guard let attributes = self.persistentActivities[activityId] else {
                        // endActivity was called -- do not re-create
                        return
                    }

                    // Re-create the activity with fresh staleDate
                    let newState = PinnedSnapAttributes.ContentState()
                    let content = ActivityContent(
                        state: newState,
                        staleDate: Date().addingTimeInterval(EXPIRY_INTERVAL)
                    )

                    do {
                        let newActivity = try Activity.request(
                            attributes: attributes,
                            content: content,
                            pushType: nil
                        )
                        // Observe the new activity for future dismissals
                        self.observeActivityState(newActivity, activityId: activityId)
                    } catch {
                        // Failed to re-create -- remove from tracking to avoid infinite retries
                        self.persistentActivities.removeValue(forKey: activityId)
                        self.observationTasks.removeValue(forKey: activityId)
                    }
                    return  // Exit this observation loop (new one started for new activity)
                }

                if state == .ended {
                    // System ended it (e.g., staleDate expired) -- clean up tracking
                    self.persistentActivities.removeValue(forKey: activityId)
                    self.observationTasks.removeValue(forKey: activityId)
                    return
                }
            }
        }

        observationTasks[activityId] = task
    }
    #endif

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
