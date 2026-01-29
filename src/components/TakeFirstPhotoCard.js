import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

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
        <Ionicons name="camera-outline" size={48} color={colors.text.secondary} />
        <Text style={styles.title}>Take your first photo</Text>
        <Text style={styles.subtitle}>Capture a moment to share with friends</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#000000',
    marginBottom: 20,
    marginHorizontal: 16,
  },
  contentContainer: {
    width: SCREEN_WIDTH - 32, // Account for horizontal margins
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.background.tertiary,
    borderStyle: 'dashed',
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default TakeFirstPhotoCard;
