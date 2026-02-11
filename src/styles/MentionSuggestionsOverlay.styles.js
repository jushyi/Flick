/**
 * MentionSuggestionsOverlay styles
 *
 * Styles for the @-mention autocomplete suggestion overlay.
 * Dark card style matching CommentsBottomSheet aesthetic.
 */
import { StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

export const styles = StyleSheet.create({
  // Overlay container - positioned absolutely above CommentInput
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    maxHeight: 200,
    zIndex: 10,
    backgroundColor: colors.background.tertiary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  // Scrollable list of suggestions
  listContent: {
    paddingVertical: 4,
  },
  // Individual suggestion row
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  // Profile photo (24px circle)
  profilePhoto: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  // Profile photo placeholder (initials)
  profilePhotoPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePhotoInitial: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  // Text container (display name + @username)
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  displayName: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  username: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginLeft: 6,
  },
  // Loading state
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
