import ActivityKit
import SwiftUI
import WidgetKit

// NOTE: Custom pixel font (Silkscreen) embedding in widget extensions requires the font file
// to be included in both the main app bundle AND the widget extension target. The @bacons/apple-targets
// plugin does not currently support font resource bundling for widget targets. As a workaround,
// we use .system(size:design:.monospaced) which provides a similar retro/pixel aesthetic.
// This can be revisited in a future native build iteration when font sharing between targets
// is better supported by the Expo ecosystem.

/// App Group identifier for reading shared thumbnails
private let appGroupId = "group.com.spoodsjs.flick"

/// Flick brand colors
private let flickBackground = Color(red: 10 / 255, green: 10 / 255, blue: 26 / 255) // #0A0A1A
private let flickTextPrimary = Color.white
private let flickTextSecondary = Color(white: 0.7) // Light gray for caption

struct FlickLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PinnedSnapAttributes.self) { context in
            // Lock screen Live Activity layout (compact)
            lockScreenView(context: context)
        } dynamicIsland: { context in
            // Dynamic Island is not used — compact only per user decision.
            // Provide minimal fallback views to satisfy the API requirement.
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    EmptyView()
                }
                DynamicIslandExpandedRegion(.trailing) {
                    EmptyView()
                }
            } compactLeading: {
                brandBadge(size: 24)
            } compactTrailing: {
                if context.state.stack.count > 1 {
                    Text("\(context.state.stack.count) snaps")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(flickTextPrimary)
                        .lineLimit(1)
                } else {
                    Text(context.state.stack.first?.senderName ?? context.attributes.senderName)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(flickTextPrimary)
                        .lineLimit(1)
                }
            } minimal: {
                brandBadge(size: 24)
            }
        }
    }

    // MARK: - Lock Screen Layout

    /// The main lock screen presentation of the Live Activity.
    /// Routes to single or stacked layout based on stack count.
    @ViewBuilder
    private func lockScreenView(context: ActivityViewContext<PinnedSnapAttributes>) -> some View {
        let stackCount = context.state.stack.count

        if stackCount <= 1 {
            // Single snap: existing layout (Polaroid + optional caption)
            singleSnapLayout(context: context)
        } else {
            // Multiple snaps: stacked Polaroids + count summary
            stackedLayout(context: context)
        }
    }

    // MARK: - Single Snap Layout

    /// Renders a single pinned snap with the existing Polaroid + caption layout.
    /// When caption is present: Polaroid on left, caption on right.
    /// When no caption: centered Polaroid only, no text.
    @ViewBuilder
    private func singleSnapLayout(context: ActivityViewContext<PinnedSnapAttributes>) -> some View {
        let entry = context.state.stack.first
        let activityId = entry?.snapActivityId ?? context.attributes.activityId
        let hasCaption = (entry?.caption ?? context.attributes.caption) != nil &&
                         !(entry?.caption ?? context.attributes.caption ?? "").isEmpty
        let captionText = entry?.caption ?? context.attributes.caption ?? ""
        let tiltAngle = Self.tiltDegrees(for: activityId)

        if hasCaption {
            HStack(spacing: 12) {
                Spacer()
                polaroidFrame(activityId: activityId)
                    .rotationEffect(.degrees(tiltAngle))
                Text(captionText)
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundColor(flickTextPrimary)
                    .lineLimit(3)
                    .truncationMode(.tail)
                Spacer()
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .background(flickBackground)
            .widgetURL(URL(string: "lapse://messages/\(entry?.conversationId ?? "")"))
        } else {
            HStack {
                Spacer()
                polaroidFrame(activityId: activityId)
                    .rotationEffect(.degrees(tiltAngle))
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .background(flickBackground)
            .widgetURL(URL(string: context.attributes.deepLinkUrl))
        }
    }

    // MARK: - Stacked Layout

    /// Renders multiple pinned snaps as overlapping Polaroid frames with a count summary.
    /// Shows up to 3 visible Polaroids with offset stacking. Displays sender names and
    /// a "+N more" badge when more than 3 entries exist.
    @ViewBuilder
    private func stackedLayout(context: ActivityViewContext<PinnedSnapAttributes>) -> some View {
        let visibleEntries = Array(context.state.stack.prefix(3))
        let totalCount = context.state.stack.count

        HStack(spacing: 12) {
            Spacer()

            // Stacked Polaroids — ZStack with offset
            ZStack(alignment: .topLeading) {
                ForEach(Array(visibleEntries.enumerated().reversed()), id: \.offset) { index, entry in
                    polaroidFrame(activityId: entry.snapActivityId)
                        .rotationEffect(.degrees(Self.tiltDegrees(for: entry.snapActivityId)))
                        .offset(x: CGFloat(index) * 4, y: CGFloat(index) * 3)
                }
            }

            // Summary text
            VStack(alignment: .leading, spacing: 4) {
                Text("\(totalCount) pinned snaps")
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundColor(flickTextPrimary)

                let senderNames = Array(Set(context.state.stack.map { $0.senderName }))
                if senderNames.count <= 2 {
                    Text(senderNames.joined(separator: " & "))
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(flickTextSecondary)
                        .lineLimit(1)
                } else {
                    Text("\(senderNames[0]), \(senderNames[1]) +\(senderNames.count - 2)")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(flickTextSecondary)
                        .lineLimit(1)
                }

                // Count badge if more than 3 visible
                if totalCount > 3 {
                    Text("+\(totalCount - 3) more")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.red.opacity(0.8))
                        .clipShape(Capsule())
                }
            }

            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 6)
        .background(flickBackground)
        .widgetURL(URL(string: "lapse://messages"))
    }

    // MARK: - Polaroid Frame

    /// Wraps the thumbnail in a white Polaroid-style border with thick borders matching
    /// classic instant photo proportions: 7pt top/sides, 22pt bottom.
    /// Polaroid total: 7 + 104 + 22 = 133pt tall, 7 + 83 + 7 = 97pt wide.
    @ViewBuilder
    private func polaroidFrame(activityId: String) -> some View {
        VStack(spacing: 0) {
            thumbnailView(activityId: activityId, width: 83, height: 104)
                .clipped()  // Sharp square corners on the photo
        }
        .padding(.top, 7)
        .padding(.horizontal, 7)
        .padding(.bottom, 22)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 3))  // Subtle outer rounding only
        .shadow(color: Color.black.opacity(0.4), radius: 4, x: 1, y: 2)
    }

    // MARK: - Thumbnail View

    /// Loads and displays a thumbnail image from the App Groups shared container.
    /// Falls back to a branded placeholder if the image is not found.
    /// Photo uses sharp square corners (.clipped) — real Polaroid photos have no rounding.
    @ViewBuilder
    private func thumbnailView(activityId: String, width: CGFloat, height: CGFloat) -> some View {
        if let image = loadThumbnail(activityId: activityId) {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: width, height: height)
                .clipped()  // Sharp square corners — real Polaroid photos have no rounding
        } else {
            // Fallback: branded placeholder with "F" initial
            Rectangle()
                .fill(Color(red: 30 / 255, green: 30 / 255, blue: 60 / 255))
                .frame(width: width, height: height)
                .overlay(
                    Text("F")
                        .font(.system(size: min(width, height) * 0.4, weight: .bold, design: .monospaced))
                        .foregroundColor(flickTextPrimary)
                )
        }
    }

    // MARK: - Tilt Angle

    /// Derives a deterministic pseudo-random tilt angle from the activityId string.
    /// Range: -4.0 to +4.0 degrees. Same activityId always produces the same angle.
    /// This makes each Polaroid look casually placed on the lock screen.
    private static func tiltDegrees(for activityId: String) -> Double {
        // Use a simple hash: sum of character Unicode scalars
        let hashValue = activityId.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        // Map to -4.0 ... +4.0 range
        let normalized = Double(hashValue % 81) / 80.0  // 0.0 to 1.0
        return (normalized * 8.0) - 4.0  // -4.0 to +4.0
    }

    // MARK: - Brand Badge (Dynamic Island)

    /// App logo for Dynamic Island compact/minimal views.
    @ViewBuilder
    private func brandBadge(size: CGFloat) -> some View {
        Image("AppLogo")
            .resizable()
            .aspectRatio(contentMode: .fill)
            .frame(width: size, height: size)
            .clipShape(Circle())
    }

    // MARK: - Thumbnail Loading

    /// Reads the thumbnail image from the App Groups shared container.
    /// The main app writes thumbnails here via the LiveActivityManager native module.
    private func loadThumbnail(activityId: String) -> UIImage? {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        ) else { return nil }

        let imageURL = containerURL
            .appendingPathComponent("thumbnails")
            .appendingPathComponent("\(activityId).jpg")

        guard let data = try? Data(contentsOf: imageURL) else { return nil }
        return UIImage(data: data)
    }
}
