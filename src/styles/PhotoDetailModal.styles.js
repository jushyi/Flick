/**
 * PhotoDetailModal styles
 *
 * Styles for the full-screen photo detail modal with
 * swipe-to-dismiss gesture and inline emoji reactions.
 */
import { StyleSheet, Dimensions, StatusBar } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  contentWrapper: {
    flex: 1,
  },
  // Progress bar for stories mode - positioned above footer
  progressBarScrollView: {
    flexGrow: 0, // Prevent ScrollView from expanding
  },
  progressBarContainer: {
    flexDirection: 'row',
    paddingBottom: 8,
    paddingHorizontal: 24,
    gap: 4,
  },
  progressSegment: {
    flex: 1,
    minWidth: 4, // Ensures segments remain visible even with many photos
    height: 3,
    borderRadius: 1.5,
  },
  progressSegmentActive: {
    backgroundColor: '#FFFFFF',
  },
  progressSegmentInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
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
    color: '#FFFFFF',
    fontWeight: '600',
  },
  photoScrollView: {
    flex: 1,
    borderRadius: 24,
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
    left: 24,
    zIndex: 5,
  },
  profilePic: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 0.5,
    borderColor: '#ffffff57',
  },
  profilePicPlaceholder: {
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#CCCCCC',
  },
  userInfoOverlay: {
    position: 'absolute',
    bottom: 108,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  timestamp: {
    fontSize: 14,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  emojiPickerContainer: {
    gap: 12,
    paddingVertical: 4,
  },
  emojiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A3A3A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#555555',
  },
  emojiPillSelected: {
    // No visual change for selected state
  },
  emojiPillEmoji: {
    fontSize: 20,
  },
  emojiPillCount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
