/**
 * CommentsBottomSheet styles
 *
 * Styles for the comments bottom sheet modal with:
 * - Semi-transparent backdrop
 * - Animated slide-up sheet (60% screen height)
 * - Dark theme matching PhotoDetailModal
 * - Header with handle bar and close button
 * - FlatList for comments
 * - CommentInput at bottom
 */
import { StyleSheet, Dimensions, Platform, StatusBar } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';

export const SCREEN_HEIGHT = Dimensions.get('window').height;
export const SHEET_HEIGHT = SCREEN_HEIGHT * 0.6;
export const EXPANDED_HEIGHT = SCREEN_HEIGHT; // Computed in component with safe area: SCREEN_HEIGHT - insets.top
// Minimum height for empty state - ~50% screen
export const MIN_SHEET_HEIGHT = SCREEN_HEIGHT * 0.5;

export const styles = StyleSheet.create({
  // Overlay container (for both Modal and Animated.View approaches)
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Animated.View overlay positioned absolutely to cover screen
  animatedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000, // Ensure it appears above PhotoDetailScreen content
  },
  // Backdrop for tap-to-close
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.dark,
  },
  // KeyboardAvoidingView wrapper
  // No maxHeight - allows expand/collapse gesture
  keyboardAvoidContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Main sheet container
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: layout.borderRadius.xl,
    borderTopRightRadius: layout.borderRadius.xl,
    minHeight: MIN_SHEET_HEIGHT, // Consistent height even when empty
    maxHeight: SHEET_HEIGHT,
    overflow: 'hidden',
  },
  // Handle bar for visual affordance - larger touch target
  handleBarContainer: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: layout.borderRadius.sm,
    backgroundColor: colors.text.tertiary,
  },
  // Header row
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  headerCount: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  closeButton: {
    padding: spacing.xxs,
  },
  // Comments list
  commentsList: {
    flex: 1,
  },
  commentsListContent: {
    paddingBottom: spacing.xs,
  },
  // Empty state - centered with minimum height
  emptyContainer: {
    flex: 1,
    minHeight: MIN_SHEET_HEIGHT * 0.5, // Half of sheet min height for content area
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  emptySubtext: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    marginTop: spacing.xxs,
  },
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.huge,
  },
  // Error state
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.huge,
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.status.danger,
    textAlign: 'center',
  },
  // Reply indicator in list (indented replies)
  replyContainer: {
    paddingLeft: 52, // Align with parent comment text (40px photo + 12px margin)
  },
  // Replies section container with visual nesting
  repliesSection: {
    marginLeft: 52, // Align with parent comment text (40px photo + 12px margin)
    borderLeftWidth: 1,
    borderLeftColor: colors.overlay.light,
    paddingLeft: spacing.sm,
    marginTop: -4, // Pull up slightly to connect visually with parent
  },
  // View/Hide replies toggle button
  viewRepliesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  // Small horizontal line before toggle text
  viewRepliesLine: {
    width: 24,
    height: 1,
    backgroundColor: colors.overlay.lightBorder,
    marginRight: spacing.xs,
  },
  // Toggle text styling
  viewRepliesText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
  },
  // Individual reply item container
  replyItem: {
    marginTop: spacing.xxs,
  },
});
