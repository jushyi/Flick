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
                thumbnailView(activityId: context.attributes.activityId, width: 24, height: 24)
            } compactTrailing: {
                Text(context.attributes.senderName)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(flickTextPrimary)
                    .lineLimit(1)
            } minimal: {
                thumbnailView(activityId: context.attributes.activityId, width: 24, height: 24)
            }
        }
    }

    // MARK: - Lock Screen Layout

    /// The main lock screen presentation of the Live Activity.
    /// When caption is present: Polaroid on left, sender name + caption on right.
    /// When no caption: centered Polaroid only, no text.
    @ViewBuilder
    private func lockScreenView(context: ActivityViewContext<PinnedSnapAttributes>) -> some View {
        let hasCaption = context.attributes.caption != nil && !context.attributes.caption!.isEmpty

        if hasCaption {
            // Caption present: Polaroid on left, text on right
            HStack(spacing: 14) {
                polaroidFrame(activityId: context.attributes.activityId)

                VStack(alignment: .leading, spacing: 6) {
                    Text(context.attributes.senderName)
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundColor(flickTextSecondary)
                        .lineLimit(1)

                    Text(context.attributes.caption!)
                        .font(.system(size: 15, weight: .bold, design: .monospaced))
                        .foregroundColor(flickTextPrimary)
                        .lineLimit(2)
                        .truncationMode(.tail)
                }

                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(flickBackground)
            .widgetURL(URL(string: context.attributes.deepLinkUrl))
        } else {
            // No caption: centered Polaroid only, no text
            HStack {
                Spacer()
                polaroidFrame(activityId: context.attributes.activityId)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(flickBackground)
            .widgetURL(URL(string: context.attributes.deepLinkUrl))
        }
    }

    // MARK: - Polaroid Frame

    /// Wraps the thumbnail in a white Polaroid-style border with a thick bottom strip.
    @ViewBuilder
    private func polaroidFrame(activityId: String) -> some View {
        VStack(spacing: 0) {
            thumbnailView(activityId: activityId, width: 128, height: 160)
        }
        .padding(.top, 4)
        .padding(.horizontal, 4)
        .padding(.bottom, 14)
        .background(Color.white)
        .cornerRadius(4)
        .shadow(color: Color.black.opacity(0.3), radius: 3, x: 0, y: 2)
    }

    // MARK: - Thumbnail View

    /// Loads and displays a thumbnail image from the App Groups shared container.
    /// Falls back to a branded placeholder if the image is not found.
    @ViewBuilder
    private func thumbnailView(activityId: String, width: CGFloat, height: CGFloat) -> some View {
        if let image = loadThumbnail(activityId: activityId) {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: width, height: height)
                .clipShape(RoundedRectangle(cornerRadius: width > 48 ? 8 : 4))
        } else {
            // Fallback: branded placeholder with "F" initial
            RoundedRectangle(cornerRadius: width > 48 ? 8 : 4)
                .fill(Color(red: 30 / 255, green: 30 / 255, blue: 60 / 255))
                .frame(width: width, height: height)
                .overlay(
                    Text("F")
                        .font(.system(size: min(width, height) * 0.4, weight: .bold, design: .monospaced))
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
