/**
 * FeedPhotoCard styles - Polaroid Design
 *
 * Polaroid-style photo cards with iconic white frame
 * and thick bottom edge for user info (like handwriting).
 */
import { StyleSheet, Dimensions } from 'react-native';
import { colors } from '../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 16;
const FRAME_PADDING_HORIZONTAL = 10;
const FRAME_PADDING_TOP = 10;
const FRAME_PADDING_BOTTOM = 50; // Thick bottom for user info (Polaroid signature)

export const styles = StyleSheet.create({
  // Polaroid frame container
  card: {
    backgroundColor: colors.polaroid.muted,
    marginHorizontal: CARD_MARGIN,
    marginBottom: 20,
    borderRadius: 4, // Polaroids have slight rounded corners
    overflow: 'hidden',
    // "Laying on table" shadow effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },

  // Inner frame with Polaroid proportions
  frameInner: {
    paddingTop: FRAME_PADDING_TOP,
    paddingHorizontal: FRAME_PADDING_HORIZONTAL,
    paddingBottom: FRAME_PADDING_BOTTOM,
  },

  // Photo container - square with crisp edges
  photoContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#1A1A1A', // Dark placeholder while loading
    // No border radius - Polaroid photos have crisp edges
  },

  photo: {
    width: '100%',
    height: '100%',
  },

  // Bottom info section (inside thick bottom padding)
  polaroidBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FRAME_PADDING_BOTTOM,
    paddingHorizontal: FRAME_PADDING_HORIZONTAL + 2,
    paddingTop: 8,
    paddingBottom: 8,
    justifyContent: 'center',
  },

  // User info row
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Display name - handwriting feel
  displayName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.polaroid.text,
    flex: 1,
  },

  // Timestamp
  timestamp: {
    fontSize: 12,
    color: colors.polaroid.textSecondary,
    marginLeft: 8,
  },

  // Reactions row (if present)
  reactions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },

  reactionEmoji: {
    fontSize: 14,
    marginRight: 2,
  },

  reactionCount: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.polaroid.textSecondary,
  },

  moreReactions: {
    fontSize: 11,
    color: colors.polaroid.textSecondary,
    marginLeft: 2,
  },

  noReactions: {
    fontSize: 11,
    color: colors.polaroid.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
