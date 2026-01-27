/**
 * CommentInput styles
 *
 * Styles for the comment input component with text input,
 * image picker button, send button, and reply banner.
 */
import { StyleSheet, Platform } from 'react-native';
import { colors } from '../constants/colors';

export const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.background.secondary,
  },
  // Reply banner shown when replying to a comment
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.background.tertiary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  replyBannerText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  replyBannerUsername: {
    fontWeight: '600',
    color: colors.text.primary,
  },
  replyBannerCancel: {
    padding: 4,
  },
  // Input row container
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 12 : 8,
  },
  // Text input wrapper (UAT-018 fix: alignItems center for placeholder centering)
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    minHeight: 40,
    maxHeight: 100,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    paddingTop: 0,
    paddingBottom: 0,
    maxHeight: 80,
    textAlignVertical: 'center', // UAT-018 fix: center placeholder vertically (Android)
  },
  // Image picker button
  imageButton: {
    paddingLeft: 8,
    paddingVertical: 2,
  },
  // GIF picker button
  gifButton: {
    paddingLeft: 8,
    paddingVertical: 2,
  },
  gifButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text.secondary,
  },
  gifButtonTextDisabled: {
    color: colors.text.tertiary,
  },
  // Send button (UAT-032 fix: 44x44 to match inputWrapper visual height with padding)
  sendButton: {
    marginLeft: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.background.tertiary,
  },
  // Media preview (above input row)
  mediaPreviewContainer: {
    position: 'relative',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  mediaPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeMediaButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    zIndex: 1,
  },
  removeMediaButtonBg: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gifBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gifBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Uploading indicator text
  uploadingText: {
    color: colors.text.tertiary,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
