import ExpoModulesCore
import Foundation

#if canImport(ActivityKit)
import ActivityKit
#endif

/// Maximum number of stack entries allowed per Live Activity.
/// Keeps ContentState well under the 4KB limit (~250 bytes per entry).
private let MAX_STACK_ENTRIES = 10

/// Duration in seconds before a Live Activity auto-expires (48 hours).
private let EXPIRY_INTERVAL: TimeInterval = 48 * 60 * 60

public class LiveActivityManagerModule: Module {
    /// Tracks the stacked activity for re-creation if user swipes it away.
    /// Key: activityId ("pinned-stack"), Value: (attributes, last known stack).
    /// Entries are removed ONLY when the stack becomes empty or endAllActivities is called.
    #if canImport(ActivityKit)
    private var persistentActivities: [String: (attributes: PinnedSnapAttributes, lastStack: [PinnedSnapAttributes.ContentState.StackEntry])] = [:]
    #endif

    /// Active observation tasks, keyed by activityId, for cleanup.
    private var observationTasks: [String: Task<Void, Never>] = [:]

    /// Task for observing push-to-start token updates (iOS 17.2+).
    private var pushToStartObservationTask: Task<Void, Never>?

    /// Last received push-to-start token, stored so JS can poll for it.
    private var lastPushToStartToken: String?

    /// Module-level diagnostic log entries, readable via getNSEDiagnostics (shared App Groups file).
    private var moduleDiagEntries: [[String: Any]] = []

    /// Log a diagnostic entry to both NSLog and the App Groups diagnostics file.
    /// This makes logs readable in Settings long-press without needing Xcode.
    private func logDiag(_ step: String, _ details: [String: Any] = [:]) {
        var entry: [String: Any] = [
            "step": "[MODULE] \(step)",
            "time": ISO8601DateFormatter().string(from: Date())
        ]
        for (k, v) in details { entry[k] = v }
        moduleDiagEntries.append(entry)

        // Keep last 50 entries in memory
        if moduleDiagEntries.count > 50 {
            moduleDiagEntries = Array(moduleDiagEntries.suffix(50))
        }

        // Also write to App Groups so it shows up in the same diagnostics as NSE
        writeModuleDiagnostics()

        NSLog("[LAManager] %@ %@", step, String(describing: details))
    }

    private func writeModuleDiagnostics() {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.spoodsjs.flick"
        ) else { return }

        let diagURL = containerURL.appendingPathComponent("module-diagnostics.json")
        if let jsonData = try? JSONSerialization.data(withJSONObject: moduleDiagEntries, options: .prettyPrinted) {
            try? jsonData.write(to: diagURL)
        }
    }

    public func definition() -> ModuleDefinition {
        Name("LiveActivityManager")

        Events("onPushToStartToken")

        // MARK: - observePushToStartToken
        // Starts observing push-to-start token updates via ActivityKit (iOS 17.2+).
        // Emits "onPushToStartToken" events with the hex-encoded token string.
        AsyncFunction("observePushToStartToken") { [weak self] in
            guard let self = self else { return }
            #if canImport(ActivityKit)
            guard #available(iOS 17.2, *) else {
                self.logDiag("observePushToStartToken_skipped", ["reason": "iOS < 17.2"])
                return
            }

            // Cancel any existing observation
            self.pushToStartObservationTask?.cancel()

            self.logDiag("observePushToStartToken_starting")

            self.pushToStartObservationTask = Task {
                self.logDiag("observePushToStartToken_awaiting_token")
                for await tokenData in Activity<PinnedSnapAttributes>.pushToStartTokenUpdates {
                    let tokenString = tokenData.map { String(format: "%02x", $0) }.joined()
                    self.lastPushToStartToken = tokenString
                    self.logDiag("observePushToStartToken_received", [
                        "tokenLength": tokenString.count,
                        "token": tokenString
                    ])
                    self.sendEvent("onPushToStartToken", [
                        "token": tokenString
                    ])
                }
                self.logDiag("observePushToStartToken_stream_ended")
            }
            #else
            self.logDiag("observePushToStartToken_skipped", ["reason": "no ActivityKit"])
            #endif
        }

        // MARK: - startActivity
        // Starts or updates the stacked pinned snap Live Activity on the lock screen.
        // If an activity already exists, adds the new snap to the stack.
        // If no activity exists, creates a new one with a single-entry stack.
        // Copies the thumbnail to the App Groups shared container for the widget to read.
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

            // Copy thumbnail to App Groups shared container using snap-specific ID
            self.copyThumbnailToAppGroup(activityId: activityId, thumbnailUri: thumbnailUri)

            // Extract conversationId from deep link URL
            let conversationId = deepLinkUrl.replacingOccurrences(of: "lapse://messages/", with: "")

            let newEntry = PinnedSnapAttributes.ContentState.StackEntry(
                snapActivityId: activityId,
                senderName: senderName,
                caption: caption,
                conversationId: conversationId
            )

            // Check for existing stacked activity (could be from push-to-start or a previous startActivity call)
            let currentActivities = Activity<PinnedSnapAttributes>.activities
            self.logDiag("startActivity", ["activityId": activityId, "existingCount": currentActivities.count])
            if let existing = currentActivities.first {
                // Add to existing stack
                var updatedStack = existing.content.state.stack

                // Dedup: skip if this snap is already in the stack
                if updatedStack.contains(where: { $0.snapActivityId == activityId }) {
                    self.logDiag("startActivity_dedup_skip", ["activityId": activityId])

                    // Still adopt push-to-start activities for tracking/observation
                    let stackId = existing.attributes.activityId
                    if self.persistentActivities[stackId] == nil {
                        self.logDiag("startActivity_adopting_dedup", ["stackId": stackId])
                        self.persistentActivities[stackId] = (attributes: existing.attributes, lastStack: updatedStack)
                        self.observeActivityState(existing, activityId: stackId)
                    }

                    return existing.id
                }

                updatedStack.insert(newEntry, at: 0)  // Newest first

                // Cap at MAX_STACK_ENTRIES to stay under 4KB ContentState limit
                if updatedStack.count > MAX_STACK_ENTRIES {
                    updatedStack = Array(updatedStack.prefix(MAX_STACK_ENTRIES))
                }

                let newState = PinnedSnapAttributes.ContentState(stack: updatedStack)
                let content = ActivityContent(
                    state: newState,
                    staleDate: Date().addingTimeInterval(EXPIRY_INTERVAL)
                )
                await existing.update(content)

                // Ensure tracking and observation for activities created by push-to-start.
                // Push-to-start activities bypass startActivity so they aren't tracked yet.
                let stackId = existing.attributes.activityId
                if var tracking = self.persistentActivities[stackId] {
                    tracking.lastStack = updatedStack
                    self.persistentActivities[stackId] = tracking
                } else {
                    // First time seeing this activity (e.g., push-to-start created it)
                    self.logDiag("startActivity_adopting", ["stackId": stackId])
                    self.persistentActivities[stackId] = (attributes: existing.attributes, lastStack: updatedStack)
                    self.observeActivityState(existing, activityId: stackId)
                }

                return existing.id
            }

            // No existing activity — create new with single-entry stack
            let stackId = "pinned-stack"
            let attributes = PinnedSnapAttributes(
                activityId: stackId,
                senderName: senderName,
                caption: caption,
                deepLinkUrl: "lapse://messages"
            )
            let state = PinnedSnapAttributes.ContentState(stack: [newEntry])
            let content = ActivityContent(
                state: state,
                staleDate: Date().addingTimeInterval(EXPIRY_INTERVAL)
            )

            do {
                let activity = try Activity.request(
                    attributes: attributes,
                    content: content,
                    pushType: .token
                )
                self.persistentActivities[stackId] = (attributes: attributes, lastStack: [newEntry])
                self.observeActivityState(activity, activityId: stackId)

                // After creating the activity, grab the push-to-start token if available.
                // iOS only generates push-to-start tokens after at least one Activity.request()
                // with pushType: .token has been made.
                if #available(iOS 17.2, *) {
                    Task {
                        // Check for the first token emission (with a timeout)
                        for await tokenData in Activity<PinnedSnapAttributes>.pushToStartTokenUpdates {
                            let tokenString = tokenData.map { String(format: "%02x", $0) }.joined()
                            self.logDiag("pushToStartToken_captured_after_request", [
                                "tokenLength": tokenString.count
                            ])
                            self.sendEvent("onPushToStartToken", [
                                "token": tokenString
                            ])
                            break  // Only need the first emission
                        }
                    }
                }

                return activity.id
            } catch {
                throw NSError(domain: "LiveActivityManager", code: 3,
                    userInfo: [NSLocalizedDescriptionKey: "Activity.request() failed: \(error.localizedDescription) | Full: \(String(describing: error))"])
            }
            #else
            throw NSError(domain: "LiveActivityManager", code: 0,
                userInfo: [NSLocalizedDescriptionKey: "ActivityKit not available (canImport failed)"])
            #endif
        }

        // MARK: - removeFromStack
        // Removes a single pinned snap entry from the stacked Live Activity.
        // If this was the last entry, ends the Live Activity entirely.
        AsyncFunction("removeFromStack") { (snapActivityId: String) in
            #if canImport(ActivityKit)
            guard #available(iOS 16.2, *) else { return }

            let currentActivities = Activity<PinnedSnapAttributes>.activities
            self.logDiag("removeFromStack", [
                "snapActivityId": snapActivityId,
                "activityCount": currentActivities.count
            ])

            guard let existing = currentActivities.first else {
                self.logDiag("removeFromStack_no_activity")
                return
            }

            let stackBefore = existing.content.state.stack
            self.logDiag("removeFromStack_stack", [
                "before": stackBefore.count,
                "ids": stackBefore.map { $0.snapActivityId }.joined(separator: ", ")
            ])

            var updatedStack = stackBefore
            updatedStack.removeAll { $0.snapActivityId == snapActivityId }

            self.logDiag("removeFromStack_result", [
                "after": updatedStack.count,
                "removed": stackBefore.count - updatedStack.count
            ])

            // Clean up this snap's thumbnail
            self.removeThumbnailFromAppGroup(activityId: snapActivityId)

            if updatedStack.isEmpty {
                // Last snap viewed — end the activity
                let stackId = existing.attributes.activityId
                self.logDiag("removeFromStack_ending", ["stackId": stackId])

                // Clear tracking BEFORE ending to prevent observer re-creation
                self.persistentActivities.removeValue(forKey: stackId)
                self.observationTasks[stackId]?.cancel()
                self.observationTasks.removeValue(forKey: stackId)

                await existing.end(nil, dismissalPolicy: .immediate)
                self.logDiag("removeFromStack_ended")

                // Also end ALL activities as a safety net — catches orphaned activities
                // from push-to-start or previous sessions that the module doesn't track
                for activity in Activity<PinnedSnapAttributes>.activities {
                    self.logDiag("removeFromStack_orphan_cleanup", ["id": activity.id])
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            } else {
                // Update with reduced stack
                let newState = PinnedSnapAttributes.ContentState(stack: updatedStack)
                let content = ActivityContent(
                    state: newState,
                    staleDate: Date().addingTimeInterval(EXPIRY_INTERVAL)
                )
                await existing.update(content)
                self.logDiag("removeFromStack_updated", ["remaining": updatedStack.count])

                let stackId = existing.attributes.activityId
                if var tracking = self.persistentActivities[stackId] {
                    tracking.lastStack = updatedStack
                    self.persistentActivities[stackId] = tracking
                }
            }
            #endif
        }

        // MARK: - endActivity
        // Ends a specific snap's Live Activity entry by removing it from the stack.
        // If this was the last entry, ends the entire Live Activity.
        // Falls back to removing the whole activity if the activityId matches the stack ID.
        AsyncFunction("endActivity") { (activityId: String) in
            #if canImport(ActivityKit)
            guard #available(iOS 16.2, *) else { return }

            let currentActivities = Activity<PinnedSnapAttributes>.activities

            // If the activityId matches the stack activity ID, end the whole thing
            for activity in currentActivities {
                if activity.attributes.activityId == activityId {
                    self.persistentActivities.removeValue(forKey: activityId)
                    self.observationTasks[activityId]?.cancel()
                    self.observationTasks.removeValue(forKey: activityId)
                    await activity.end(nil, dismissalPolicy: .immediate)

                    // Clean up all thumbnails for entries in the stack
                    for entry in activity.content.state.stack {
                        self.removeThumbnailFromAppGroup(activityId: entry.snapActivityId)
                    }
                    return
                }
            }

            // Otherwise, treat as a snap-level removal (delegate to removeFromStack logic)
            guard let existing = currentActivities.first else { return }

            var updatedStack = existing.content.state.stack
            updatedStack.removeAll { $0.snapActivityId == activityId }

            self.removeThumbnailFromAppGroup(activityId: activityId)

            if updatedStack.isEmpty {
                let stackId = existing.attributes.activityId
                self.persistentActivities.removeValue(forKey: stackId)
                self.observationTasks[stackId]?.cancel()
                self.observationTasks.removeValue(forKey: stackId)
                await existing.end(nil, dismissalPolicy: .immediate)
            } else {
                let newState = PinnedSnapAttributes.ContentState(stack: updatedStack)
                let content = ActivityContent(
                    state: newState,
                    staleDate: Date().addingTimeInterval(EXPIRY_INTERVAL)
                )
                await existing.update(content)

                let stackId = existing.attributes.activityId
                if var tracking = self.persistentActivities[stackId] {
                    tracking.lastStack = updatedStack
                    self.persistentActivities[stackId] = tracking
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
                // Clean up all thumbnails for entries in the stack
                for entry in activity.content.state.stack {
                    self.removeThumbnailFromAppGroup(activityId: entry.snapActivityId)
                }
                await activity.end(nil, dismissalPolicy: .immediate)
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

                // Show current stack info
                if let existing = Activity<PinnedSnapAttributes>.activities.first {
                    lines.append("stackSize: \(existing.content.state.stack.count)")
                    for (i, entry) in existing.content.state.stack.enumerated() {
                        lines.append("  stack[\(i)]: \(entry.snapActivityId) from \(entry.senderName)")
                    }
                }

                // Try to actually request an activity with a test ID and see what error we get
                let testAttributes = PinnedSnapAttributes(
                    activityId: "__diag_test__",
                    senderName: "Diagnostic",
                    caption: nil,
                    deepLinkUrl: "lapse://test"
                )
                let testState = PinnedSnapAttributes.ContentState(stack: [])
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

        // MARK: - getActiveActivityIds
        // Returns array of snapActivityId values from the stack of all running Live Activities.
        // Used by JS foreground-resume fallback to check which pinned snaps already have activities.
        AsyncFunction("getActiveActivityIds") { () -> [String] in
            #if canImport(ActivityKit)
            guard #available(iOS 16.2, *) else { return [] }
            return Activity<PinnedSnapAttributes>.activities.flatMap { activity in
                activity.content.state.stack.map { $0.snapActivityId }
            }
            #else
            return []
            #endif
        }

        // MARK: - getNSEDiagnostics
        // Reads both NSE and module diagnostic logs from App Groups.
        // Returns combined JSON string, or null if no diagnostics exist.
        AsyncFunction("getNSEDiagnostics") { () -> String? in
            guard let containerURL = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: self.appGroupId
            ) else { return nil }

            // Read NSE diagnostics
            let nseURL = containerURL.appendingPathComponent("nse-diagnostics.json")
            let nseData = try? Data(contentsOf: nseURL)
            let nseEntries = nseData.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [[String: Any]] } ?? []

            // Read module diagnostics
            let modURL = containerURL.appendingPathComponent("module-diagnostics.json")
            let modData = try? Data(contentsOf: modURL)
            let modEntries = modData.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [[String: Any]] } ?? []

            // Combine: NSE entries as invocations, module entries as a separate invocation
            var combined = nseEntries
            if !modEntries.isEmpty {
                combined.append([
                    "timestamp": "module-logs",
                    "entries": modEntries
                ])
            }

            guard !combined.isEmpty else { return nil }
            guard let jsonData = try? JSONSerialization.data(withJSONObject: combined) else { return nil }
            return String(data: jsonData, encoding: .utf8)
        }

        // MARK: - clearNSEDiagnostics
        // Clears both NSE and module diagnostic log files.
        AsyncFunction("clearNSEDiagnostics") {
            guard let containerURL = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: self.appGroupId
            ) else { return }

            try? FileManager.default.removeItem(at: containerURL.appendingPathComponent("nse-diagnostics.json"))
            try? FileManager.default.removeItem(at: containerURL.appendingPathComponent("module-diagnostics.json"))
            self.moduleDiagEntries.removeAll()
        }

        // MARK: - getPushToStartToken
        // Returns the last received push-to-start token, or null if none received yet.
        // Bypasses the event system — JS can poll this directly.
        AsyncFunction("getPushToStartToken") { () -> String? in
            return self.lastPushToStartToken
        }
    }

    // MARK: - Private Helpers

    /// App Group identifier for sharing data between main app and widget extension.
    private let appGroupId = "group.com.spoodsjs.flick"

    /// Observes an activity's state updates and automatically re-creates it if dismissed by the user.
    /// Only re-creates if the activityId is still in `persistentActivities` (not explicitly ended).
    /// Re-creation preserves the full stack state from the last known update.
    #if canImport(ActivityKit)
    @available(iOS 16.2, *)
    private func observeActivityState(_ activity: Activity<PinnedSnapAttributes>, activityId: String) {
        // Cancel any existing observation for this activityId
        observationTasks[activityId]?.cancel()

        let task = Task { [weak self] in
            for await state in activity.activityStateUpdates {
                guard let self = self else { return }

                self.logDiag("observer_state", ["state": String(describing: state), "activityId": activityId])

                if state == .dismissed {
                    // Check if this activity should persist (not explicitly ended)
                    guard let tracking = self.persistentActivities[activityId] else {
                        // endActivity/removeFromStack was called -- do not re-create
                        self.logDiag("observer_dismissed_not_tracked", ["activityId": activityId])
                        return
                    }

                    self.logDiag("observer_dismissed_recreating", ["activityId": activityId, "stackSize": tracking.lastStack.count])

                    // Re-create the activity with the last known stack state
                    let newState = PinnedSnapAttributes.ContentState(stack: tracking.lastStack)
                    let content = ActivityContent(
                        state: newState,
                        staleDate: Date().addingTimeInterval(EXPIRY_INTERVAL)
                    )

                    do {
                        let newActivity = try Activity.request(
                            attributes: tracking.attributes,
                            content: content,
                            pushType: nil
                        )
                        self.logDiag("observer_recreated", ["newId": newActivity.id])
                        // Observe the new activity for future dismissals
                        self.observeActivityState(newActivity, activityId: activityId)
                    } catch {
                        self.logDiag("observer_recreate_failed", ["error": error.localizedDescription])
                        // Failed to re-create -- remove from tracking to avoid infinite retries
                        self.persistentActivities.removeValue(forKey: activityId)
                        self.observationTasks.removeValue(forKey: activityId)
                    }
                    return  // Exit this observation loop (new one started for new activity)
                }

                if state == .ended {
                    // System ended it (e.g., staleDate expired) -- clean up tracking
                    self.logDiag("observer_ended", ["activityId": activityId])
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
