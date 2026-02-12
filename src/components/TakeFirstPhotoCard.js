import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import PixelIcon from './PixelIcon';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * TakeFirstPhotoCard - Full-width prompt card styled like FeedPhotoCard
 *
 * Displays in the feed area when user has no friends (new user state).
 * Matches FeedPhotoCard layout (full-width square) with dashed border styling.
 *
 * @param {function} onPress - Callback when card is tapped (navigates to Camera)
 */
const TakeFirstPhotoCard = ({ onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.contentContainer}>
        <PixelIcon name="camera-outline" size={48} color={colors.text.secondary} />
        <Text style={styles.title}>Take your first photo</Text>
        <Text style={styles.subtitle}>Capture a moment to share with friends</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.primary,
    marginBottom: 20,
    marginHorizontal: spacing.md,
  },
  contentContainer: {
    width: SCREEN_WIDTH - spacing.md * 2, // Account for horizontal margins
    aspectRatio: 1,
    borderRadius: layout.borderRadius.md,
    borderWidth: 2,
    borderColor: colors.background.tertiary,
    borderStyle: 'dashed',
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },
});

export default TakeFirstPhotoCard;
