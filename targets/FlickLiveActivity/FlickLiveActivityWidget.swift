import ActivityKit
import SwiftUI
import WidgetKit

/// Live Activity widget for pinned snaps.
/// Displays a compact lock-screen presentation with photo thumbnail, sender name, and optional caption.
/// Styled with Flick's dark theme (#0A0A1A background) and retro pixel-art aesthetic.
struct FlickLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PinnedSnapAttributes.self) { context in
            // Lock screen / banner presentation
            lockScreenView(context: context)
                .activityBackgroundTint(Color(red: 10/255, green: 10/255, blue: 26/255)) // #0A0A1A
                .widgetURL(URL(string: context.attributes.deepLinkUrl))
        } dynamicIsland: { context in
            // Dynamic Island — minimal presentation (compact only, no expanded state per user decision)
            DynamicIsland {
                // Expanded region — not used, but required by API
                DynamicIslandExpandedRegion(.leading) {
                    EmptyView()
                }
                DynamicIslandExpandedRegion(.trailing) {
                    EmptyView()
                }
                DynamicIslandExpandedRegion(.center) {
                    EmptyView()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    EmptyView()
                }
            } compactLeading: {
                // Compact leading: small thumbnail
                thumbnailImage(activityId: context.attributes.activityId, size: 24)
            } compactTrailing: {
                // Compact trailing: sender name
                Text(context.attributes.senderName)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.white)
                    .lineLimit(1)
            } minimal: {
                // Minimal: just thumbnail
                thumbnailImage(activityId: context.attributes.activityId, size: 20)
            }
        }
    }

    // MARK: - Lock Screen View

    /// The main lock screen / notification banner layout.
    /// Left: 48x48 photo thumbnail. Right: sender name (bold) + caption (if present).
    @ViewBuilder
    private func lockScreenView(context: ActivityViewContext<PinnedSnapAttributes>) -> some View {
        HStack(spacing: 12) {
            // Photo thumbnail from App Groups shared container
            thumbnailImage(activityId: context.attributes.activityId, size: 48)

            // Text content
            VStack(alignment: .leading, spacing: 2) {
                // Sender name — bold, pixel-art style
                // NOTE: Custom pixel fonts (PressStart2P, Silkscreen) cannot be reliably embedded
                // in iOS widget extensions via @bacons/apple-targets. The font must be added to both
                // the host app AND the extension target's resource bundle, and apple-targets does not
                // currently support font resource bundling for widget targets. Using .monospaced
                // system design as the closest approximation to pixel-art styling.
                // This constraint can be revisited when @bacons/apple-targets adds font bundling
                // support or when the project upgrades to expo-widgets (SDK 55+).
                Text(context.attributes.senderName)
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                    .lineLimit(1)

                // Caption text — only shown if present
                if let caption = context.attributes.caption, !caption.isEmpty {
                    Text(caption)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(Color(white: 0.7))
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
            }

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    // MARK: - Thumbnail Image

    /// Load the thumbnail image from the App Groups shared container.
    /// Falls back to a camera icon placeholder if the image is not found.
    @ViewBuilder
    private func thumbnailImage(activityId: String, size: CGFloat) -> some View {
        if let image = loadThumbnail(activityId: activityId) {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: 4))
        } else {
            // Fallback placeholder — camera icon on dark background
            ZStack {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(white: 0.15))
                    .frame(width: size, height: size)

                Image(systemName: "camera.fill")
                    .font(.system(size: size * 0.4))
                    .foregroundColor(Color(white: 0.5))
            }
        }
    }

    /// Read the thumbnail JPEG from the App Groups shared container.
    private func loadThumbnail(activityId: String) -> UIImage? {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.spoodsjs.flick"
        ) else {
            return nil
        }

        let imageURL = containerURL
            .appendingPathComponent("pinned_thumbnails")
            .appendingPathComponent("\(activityId).jpg")

        guard let data = try? Data(contentsOf: imageURL),
              let uiImage = UIImage(data: data) else {
            return nil
        }

        return uiImage
    }
}
