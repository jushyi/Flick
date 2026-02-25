/**
 * TaggedPhotoBubble Styles
 *
 * Transparent card styling for tagged photo message cards in DM conversations.
 * Matches the reply/media bubble transparent style pattern (no colored border
 * or background). The photo displays at natural portrait aspect ratio with an
 * "Add to feed" button overlaid inside at the bottom center.
 */

import { StyleSheet } from 'react-native';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

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
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    overflow: 'hidden',
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
    position: 'relative',
  },
  photo: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 6,
  },
  photoPlaceholder: {
    width: '100%',
    aspectRatio: 3 / 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
  },
  buttonOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.interactive.primary,
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 32,
    gap: 4,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.body,
    color: '#0A0A1A',
  },
  addButtonTextDisabled: {
    color: 'rgba(10, 10, 26, 0.5)',
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
