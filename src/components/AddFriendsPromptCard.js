import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import PixelIcon from './PixelIcon';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';

/**
 * AddFriendsPromptCard - Prompt card styled like FriendStoryCard
 *
 * Displays in the stories row when user has no friends.
 * Matches FriendStoryCard dimensions (88x130) with dashed border styling.
 *
 * @param {function} onPress - Callback when card is tapped (navigates to FriendsList)
 * @param {boolean} isFirst - Whether this is the first card (for left margin)
 */
const AddFriendsPromptCard = ({ onPress, isFirst = false }) => {
  return (
    <TouchableOpacity
      style={[styles.container, isFirst && styles.firstContainer]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardWrapper}>
        <View style={styles.dashedBorder}>
          <View style={styles.contentContainer}>
            <PixelIcon name="add" size={32} color={colors.text.secondary} />
          </View>
        </View>
      </View>
      <Text style={styles.label}>Add friends</Text>
    </TouchableOpacity>
  );
};

// Match FriendStoryCard dimensions
const PHOTO_WIDTH = 88;
const PHOTO_HEIGHT = 130;
const BORDER_WIDTH = 3;

const styles = StyleSheet.create({
  container: {
    width: PHOTO_WIDTH + BORDER_WIDTH * 2 + 8,
    alignItems: 'center',
    marginRight: 10,
  },
  firstContainer: {
    marginLeft: 0,
  },
  cardWrapper: {
    position: 'relative',
    marginBottom: 20, // Match FriendStoryCard spacing
  },
  dashedBorder: {
    width: PHOTO_WIDTH + BORDER_WIDTH * 2,
    height: PHOTO_HEIGHT + BORDER_WIDTH * 2,
    borderRadius: layout.borderRadius.md,
    borderWidth: 2,
    borderColor: colors.background.tertiary,
    borderStyle: 'dashed',
    padding: BORDER_WIDTH,
  },
  contentContainer: {
    flex: 1,
    borderRadius: layout.borderRadius.sm,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: PHOTO_WIDTH + BORDER_WIDTH * 2,
    fontFamily: typography.fontFamily.bodyBold,
  },
});

export default AddFriendsPromptCard;
