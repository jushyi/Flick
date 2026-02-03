/**
 * PhotoDetailModal styles
 *
 * Styles for the full-screen photo detail modal with
 * swipe-to-dismiss gesture and inline emoji reactions.
 */
import { StyleSheet, Dimensions, StatusBar } from 'react-native';
import { colors } from '../constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  contentWrapper: {
    flex: 1,
  },
  // Progress bar for stories mode - positioned above footer
  // Container clips at 8px margin (matches photo window padding)
  // Segments extend edge-to-edge within container for edge-to-edge visual effect
  progressBarScrollView: {
    flexGrow: 0, // Prevent ScrollView from expanding and pushing photo
    marginHorizontal: 8, // Match photo marginHorizontal - clips the segments
    overflow: 'hidden', // Clip segments at container edges
  },
  progressBarContainer: {
    flexDirection: 'row',
    paddingBottom: 8,
    // No horizontal padding - segments extend to edges (clipped by container)
    gap: 2,
  },
  progressSegment: {
    // Width is now calculated dynamically in component based on total photos
    height: 3,
    borderRadius: 1.5,
  },
  progressSegmentActive: {
    backgroundColor: colors.text.primary,
  },
  progressSegmentInactive: {
    backgroundColor: colors.overlay.lightMedium,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: (StatusBar.currentHeight || 44) + 10,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  headerSpacer: {
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: colors.text.primary,
    fontWeight: '600',
  },
  photoScrollView: {
    flex: 1,
    borderRadius: 12, // UAT-035 fix: sharper corners (was 24)
    overflow: 'hidden',
    marginHorizontal: 8,
    marginBottom: 8,
  },
  photoContentContainer: {
    flex: 1,
  },
  photo: {
    width: SCREEN_WIDTH - 16,
    height: '100%',
    minHeight: SCREEN_HEIGHT * 0.7,
  },
  profilePicContainer: {
    position: 'absolute',
    top: (StatusBar.currentHeight || 44) + 14,
    left: 22, // UAT-027 fix: shifted 6px right (was 16)
    zIndex: 5,
  },
  profilePic: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 0.5,
    borderColor: colors.overlay.lightBorder,
  },
  profilePicPlaceholder: {
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicText: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  userInfoOverlay: {
    position: 'absolute',
    // bottom: dynamic via inline style (UAT-019 fix: 140 with comments, 100 without)
    left: 22, // UAT-027 fix: shifted 6px right (was 16)
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  timestamp: {
    fontSize: 14,
    color: colors.text.primary,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // Comment preview container - below user info (UAT-004 fix: absolute positioning)
  // UAT-011 fix: removed paddingBottom for better alignment with username
  // UAT-034 followup: moved up 15px to match userInfoOverlay (was 85)
  commentPreviewContainer: {
    position: 'absolute',
    bottom: 100, // Below userInfoOverlay, above footer
    left: 22, // UAT-027 fix: shifted 6px right (was 16)
    right: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 32,
    backgroundColor: colors.overlay.darker,
    gap: 8,
  },
  // Comment input trigger - left side of footer (UAT-001 fix: 50/50 split)
  commentInputTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.pill.background,
  },
  commentInputTriggerText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
  },
  // Emoji pills scroll view - right side of footer (UAT-001 fix: 50/50 split)
  emojiPickerScrollView: {
    flex: 1,
  },
  // Disabled emoji row for own stories - reactions visible but grayed out
  disabledEmojiRow: {
    opacity: 0.4,
  },
  emojiPickerContainer: {
    gap: 8,
    paddingVertical: 4,
  },
  emojiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.pill.background,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.pill.border,
  },
  emojiPillSelected: {
    // No visual change for selected state
  },
  emojiPillEmoji: {
    fontSize: 16,
  },
  emojiPillCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },
  // Purple highlight overlay for newly added emoji (fades out over 1 second)
  emojiHighlightOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.brand.purple,
    backgroundColor: colors.overlay.purpleTint,
  },
  // Add emoji button - same size and styling as emojiPill for equal visual presence
  addEmojiButton: {
    justifyContent: 'center',
  },
  addEmojiText: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '600',
  },
});
