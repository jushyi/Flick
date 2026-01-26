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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
export const SHEET_HEIGHT = SCREEN_HEIGHT * 0.6;

export const styles = StyleSheet.create({
  // Modal overlay
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Backdrop for tap-to-close
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  // KeyboardAvoidingView wrapper
  keyboardAvoidContainer: {
    maxHeight: SHEET_HEIGHT,
  },
  // Main sheet container
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SHEET_HEIGHT,
    overflow: 'hidden',
  },
  // Handle bar for visual affordance
  handleBarContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.tertiary,
  },
  // Header row
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerCount: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: 6,
  },
  closeButton: {
    padding: 4,
  },
  // Comments list
  commentsList: {
    flex: 1,
  },
  commentsListContent: {
    paddingBottom: 8,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  // Error state
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 14,
    color: colors.status.danger,
    textAlign: 'center',
  },
  // Reply indicator in list (indented replies)
  replyContainer: {
    paddingLeft: 52, // Align with parent comment text (40px photo + 12px margin)
  },
});
