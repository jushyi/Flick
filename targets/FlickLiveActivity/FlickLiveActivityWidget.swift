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
                thumbnailView(activityId: context.attributes.activityId, size: 24)
            } compactTrailing: {
                Text(context.attributes.senderName)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(flickTextPrimary)
                    .lineLimit(1)
            } minimal: {
                thumbnailView(activityId: context.attributes.activityId, size: 24)
            }
        }
    }

    // MARK: - Lock Screen Layout

    /// The main lock screen presentation of the Live Activity.
    /// Shows a large photo thumbnail on the left with caption on the right.
    /// Designed to be tall and visually prominent on the lock screen.
    @ViewBuilder
    private func lockScreenView(context: ActivityViewContext<PinnedSnapAttributes>) -> some View {
        HStack(spacing: 14) {
            // Left: Large photo thumbnail from App Groups shared container
            thumbnailView(activityId: context.attributes.activityId, size: 96)

            // Right: Sender name + caption
            VStack(alignment: .leading, spacing: 6) {
                Text(context.attributes.senderName)
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundColor(flickTextSecondary)
                    .lineLimit(1)

                if let caption = context.attributes.caption, !caption.isEmpty {
                    Text(caption)
                        .font(.system(size: 15, weight: .bold, design: .monospaced))
                        .foregroundColor(flickTextPrimary)
                        .lineLimit(2)
                        .truncationMode(.tail)
                } else {
                    Text("Tap to view")
                        .font(.system(size: 15, weight: .bold, design: .monospaced))
                        .foregroundColor(flickTextSecondary)
                        .lineLimit(1)
                }
            }

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(flickBackground)
        .widgetURL(URL(string: context.attributes.deepLinkUrl))
    }

    // MARK: - Thumbnail View

    /// Loads and displays a thumbnail image from the App Groups shared container.
    /// Falls back to a branded placeholder if the image is not found.
    @ViewBuilder
    private func thumbnailView(activityId: String, size: CGFloat) -> some View {
        if let image = loadThumbnail(activityId: activityId) {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: size > 48 ? 8 : 4))
        } else {
            // Fallback: branded placeholder with "F" initial
            RoundedRectangle(cornerRadius: size > 48 ? 8 : 4)
                .fill(Color(red: 30 / 255, green: 30 / 255, blue: 60 / 255))
                .frame(width: size, height: size)
                .overlay(
                    Text("F")
                        .font(.system(size: size * 0.4, weight: .bold, design: .monospaced))
                        .foregroundColor(flickTextPrimary)
                )
        }
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
