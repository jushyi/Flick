/**
 * TaggedPhotoBubble Styles
 *
 * Distinct visual styling for tagged photo message cards in DM conversations.
 * Uses a soft teal/cyan accent border to differentiate from:
 * - Snap messages (amber accent)
 * - Regular text messages (default bubble styling)
 *
 * The card renders as a large photo with header text and an inline
 * "Add to feed" action button for recipients.
 */

import { Platform, StyleSheet } from 'react-native';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const TAG_ACCENT = '#00B8D4'; // Soft teal — distinct from snap amber and interactive cyan
const TAG_BG = 'rgba(0, 184, 212, 0.08)';
const TAG_BORDER = 'rgba(0, 184, 212, 0.3)';

export const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
  },
  containerRight: {
    alignItems: 'flex-end',
  },
  containerLeft: {
    alignItems: 'flex-start',
  },
  card: {
    width: 240,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: TAG_BORDER,
    backgroundColor: TAG_BG,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: TAG_ACCENT,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerContainer: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  photoContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TAG_ACCENT,
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 32,
    gap: 4,
  },
  addButtonDisabled: {
    backgroundColor: colors.background.tertiary,
  },
  addButtonText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.body,
    color: colors.text.inverse,
  },
  addButtonTextDisabled: {
    color: colors.text.secondary,
  },
  timestamp: {
    fontSize: 10,
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.body,
    marginTop: 4,
  },
  timestampRight: {
    textAlign: 'right',
  },
  timestampLeft: {
    textAlign: 'left',
  },
});

export { TAG_ACCENT };
