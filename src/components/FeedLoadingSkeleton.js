import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, ScrollView } from 'react-native';
import { colors } from '../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Story card dimensions (match FriendStoryCard)
const STORY_PHOTO_WIDTH = 88;
const STORY_PHOTO_HEIGHT = 130;
const STORY_BORDER_WIDTH = 3;
const STORY_PROFILE_SIZE = 32;

// Feed card dimensions (match FeedPhotoCard.styles)
const FEED_PROFILE_SIZE = 36;

/**
 * Loading skeleton for feed
 * Displays animated placeholder matching current feed structure:
 * - Stories row at top (horizontal scroll)
 * - Full-width feed cards below
 */
const FeedLoadingSkeleton = () => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  // Pulse animation for skeleton
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  /**
   * Render a single story card skeleton
   */
  const renderStoryCardSkeleton = index => (
    <View key={index} style={styles.storyCardSkeleton}>
      {/* Photo placeholder (rectangular) */}
      <Animated.View style={[styles.storyPhoto, { opacity }]} />
      {/* Profile photo placeholder (circle at bottom) */}
      <Animated.View style={[styles.storyProfile, { opacity }]} />
    </View>
  );

  /**
   * Render a single feed card skeleton
   */
  const renderFeedCardSkeleton = index => (
    <View key={index} style={styles.feedCard}>
      {/* Photo placeholder (full-width square) */}
      <Animated.View style={[styles.feedPhoto, { opacity }]} />

      {/* Info row: profile + name/timestamp */}
      <View style={styles.feedInfoRow}>
        <Animated.View style={[styles.feedProfile, { opacity }]} />
        <View style={styles.feedTextContainer}>
          <Animated.View style={[styles.feedName, { opacity }]} />
          <Animated.View style={[styles.feedTimestamp, { opacity }]} />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Stories Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesRow}
        scrollEnabled={false}
      >
        {Array.from({ length: 4 }).map((_, i) => renderStoryCardSkeleton(i))}
      </ScrollView>

      {/* Feed Cards */}
      {Array.from({ length: 2 }).map((_, i) => renderFeedCardSkeleton(i))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure black to match feed
  },

  // Stories row
  storiesRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  // Individual story card skeleton
  storyCardSkeleton: {
    width: STORY_PHOTO_WIDTH + STORY_BORDER_WIDTH * 2 + 8,
    alignItems: 'center',
    marginRight: 10,
  },

  storyPhoto: {
    width: STORY_PHOTO_WIDTH + STORY_BORDER_WIDTH * 2,
    height: STORY_PHOTO_HEIGHT + STORY_BORDER_WIDTH * 2,
    borderRadius: 14,
    backgroundColor: colors.background.tertiary,
    marginBottom: STORY_PROFILE_SIZE / 2 + 4,
  },

  storyProfile: {
    width: STORY_PROFILE_SIZE,
    height: STORY_PROFILE_SIZE,
    borderRadius: STORY_PROFILE_SIZE / 2,
    backgroundColor: colors.background.tertiary,
    position: 'absolute',
    bottom: 0,
  },

  // Feed card skeleton
  feedCard: {
    backgroundColor: '#000000',
    marginBottom: 20,
  },

  feedPhoto: {
    width: SCREEN_WIDTH,
    aspectRatio: 1,
    backgroundColor: colors.background.tertiary,
  },

  feedInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  feedProfile: {
    width: FEED_PROFILE_SIZE,
    height: FEED_PROFILE_SIZE,
    borderRadius: FEED_PROFILE_SIZE / 2,
    backgroundColor: colors.background.tertiary,
    marginRight: 10,
  },

  feedTextContainer: {
    flex: 1,
  },

  feedName: {
    width: 120,
    height: 14,
    backgroundColor: colors.background.tertiary,
    borderRadius: 4,
    marginBottom: 6,
  },

  feedTimestamp: {
    width: 60,
    height: 12,
    backgroundColor: colors.background.tertiary,
    borderRadius: 4,
  },
});

export default FeedLoadingSkeleton;
