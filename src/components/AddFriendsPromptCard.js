import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

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
            <Ionicons name="add" size={32} color={colors.text.secondary} />
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
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.background.tertiary,
    borderStyle: 'dashed',
    padding: BORDER_WIDTH,
  },
  contentContainer: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: PHOTO_WIDTH + BORDER_WIDTH * 2,
    fontWeight: '500',
  },
});

export default AddFriendsPromptCard;
