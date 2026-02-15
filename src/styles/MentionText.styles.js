/**
 * MentionText styles
 *
 * Styles for @mention text parsing and rendering.
 * @mentions render with purple highlight color and slightly bolder weight.
 */
import { StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

export const styles = StyleSheet.create({
  // Base text style (inherits from parent)
  baseText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.primary,
    lineHeight: 20,
  },
  // @mention text style - highlighted and tappable
  mentionText: {
    color: colors.brand.purple,
    fontFamily: typography.fontFamily.readableBold,
  },
});
