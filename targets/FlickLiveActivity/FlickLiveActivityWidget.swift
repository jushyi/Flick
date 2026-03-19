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
                Text(context.attributes.senderName)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(flickTextPrimary)
                    .lineLimit(1)
            } minimal: {
                brandBadge(size: 24)
            }
        }
    }

    // MARK: - Lock Screen Layout

    /// The main lock screen presentation of the Live Activity.
    /// When caption is present: Polaroid on left, sender name + caption on right.
    /// When no caption: centered Polaroid only, no text.
    /// Total height budget: 6pt outer top + 133pt polaroid + 6pt outer bottom = 145pt (under 160pt max).
    @ViewBuilder
    private func lockScreenView(context: ActivityViewContext<PinnedSnapAttributes>) -> some View {
        let hasCaption = context.attributes.caption != nil && !context.attributes.caption!.isEmpty
        let tiltAngle = Self.tiltDegrees(for: context.attributes.activityId)

        if hasCaption {
            // Caption present: Polaroid at ~1/3 left, caption to the right
            HStack(spacing: 12) {
                Spacer()

                polaroidFrame(activityId: context.attributes.activityId)
                    .rotationEffect(.degrees(tiltAngle))

                Text(context.attributes.caption!)
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
            .widgetURL(URL(string: context.attributes.deepLinkUrl))
        } else {
            // No caption: centered Polaroid only
            HStack {
                Spacer()
                polaroidFrame(activityId: context.attributes.activityId)
                    .rotationEffect(.degrees(tiltAngle))
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .background(flickBackground)
            .widgetURL(URL(string: context.attributes.deepLinkUrl))
        }
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
