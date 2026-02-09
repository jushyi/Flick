/**
 * PhotoDetailScreen styles
 *
 * Styles for the full-screen photo detail screen (navigation version).
 * Based on PhotoDetailModal.styles.js with adjustments for navigation screen.
 */
import { StyleSheet, Dimensions, StatusBar } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Semi-transparent background for transparentModal presentation
    // Previous screen (Feed) remains visible with darkened overlay
    backgroundColor: 'rgba(0, 0, 0, 0.98)',
  },
  contentWrapper: {
    flex: 1,
  },
  // Progress bar for stories mode - positioned above footer
  progressBarScrollView: {
    flexGrow: 0,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  progressBarContainer: {
    flexDirection: 'row',
    paddingBottom: 8,
    gap: 2,
  },
  progressSegment: {
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
    fontSize: typography.size.xxl,
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bodyBold,
  },
  photoScrollView: {
    flex: 1,
    borderRadius: 4,
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
    left: 22,
    zIndex: 5,
  },
  profilePic: {
    width: 80,
    height: 80,
    borderRadius: 9999,
    borderWidth: 0.5,
    borderColor: colors.overlay.lightBorder,
  },
  profilePicPlaceholder: {
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicText: {
    fontSize: typography.size.display,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
  },
  userInfoOverlay: {
    position: 'absolute',
    left: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  timestamp: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  commentPreviewContainer: {
    position: 'absolute',
    bottom: 100,
    left: 22,
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
  commentInputTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.pill.background,
  },
  commentInputTriggerText: {
    flex: 1,
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  emojiPickerScrollView: {
    flex: 1,
  },
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
    borderRadius: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.pill.border,
  },
  emojiPillSelected: {
    // No visual change for selected state
  },
  emojiPillEmoji: {
    fontSize: typography.size.lg,
  },
  emojiPillCount: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  emojiHighlightOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.brand.purple,
    backgroundColor: colors.overlay.purpleTint,
  },
  addEmojiButton: {
    justifyContent: 'center',
  },
  addEmojiText: {
    fontSize: typography.size.lg,
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bodyBold,
  },
  // Tag button for tagging friends on feed photos
  tagButton: {
    position: 'absolute',
    bottom: 150,
    right: 14,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 9999,
  },
  // Photo menu button for owner actions (delete, archive, restore)
  photoMenuButton: {
    position: 'absolute',
    bottom: 102, // Above the footer
    right: 8,
    width: 44,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});
