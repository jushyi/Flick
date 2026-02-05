import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, ScrollView } from 'react-native';
import { colors } from '../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Shimmer highlight width (the moving bar)
const SHIMMER_WIDTH = 100;

// Story card dimensions (match FriendStoryCard)
const STORY_PHOTO_WIDTH = 88;
const STORY_PHOTO_HEIGHT = 130;
const STORY_BORDER_WIDTH = 3;
const STORY_PROFILE_SIZE = 32;

// Feed card dimensions (match FeedPhotoCard.styles)
const FEED_PROFILE_SIZE = 36;

/**
 * Shimmer highlight component
 * A semi-transparent bar that sweeps across skeleton elements
 */
const ShimmerHighlight = ({ shimmerPosition, width = '100%', height = '100%' }) => {
  return (
    <Animated.View
      style={[
        styles.shimmerHighlight,
        {
          width: SHIMMER_WIDTH,
          height,
          transform: [{ translateX: shimmerPosition }],
        },
      ]}
    />
  );
};

/**
 * Loading skeleton for feed
 * Displays animated placeholder matching current feed structure:
 * - Stories row at top (horizontal scroll)
 * - Full-width feed cards below
 * Uses Instagram-style shimmer animation (left-to-right sweep)
 */
const FeedLoadingSkeleton = () => {
  const shimmerPosition = useRef(new Animated.Value(-SHIMMER_WIDTH)).current;

  // Shimmer animation - sweeps left to right
  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerPosition, {
        toValue: SCREEN_WIDTH,
        duration: 1200,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmerPosition]);

  /**
   * Render a single story card skeleton
   */
  const renderStoryCardSkeleton = index => (
    <View key={index} style={styles.storyCardSkeleton}>
      {/* Photo placeholder (rectangular) */}
      <View style={styles.storyPhoto}>
        <ShimmerHighlight shimmerPosition={shimmerPosition} />
      </View>
      {/* Profile photo placeholder (circle at bottom) */}
      <View style={styles.storyProfile}>
        <ShimmerHighlight shimmerPosition={shimmerPosition} />
      </View>
    </View>
  );

  /**
   * Render a single feed card skeleton
   */
  const renderFeedCardSkeleton = index => (
    <View key={index} style={styles.feedCard}>
      {/* Photo placeholder (full-width square) */}
      <View style={styles.feedPhoto}>
        <ShimmerHighlight shimmerPosition={shimmerPosition} />
      </View>

      {/* Info row: profile + name/timestamp */}
      <View style={styles.feedInfoRow}>
        <View style={styles.feedProfile}>
          <ShimmerHighlight shimmerPosition={shimmerPosition} />
        </View>
        <View style={styles.feedTextContainer}>
          <View style={styles.feedName}>
            <ShimmerHighlight shimmerPosition={shimmerPosition} />
          </View>
          <View style={styles.feedTimestamp}>
            <ShimmerHighlight shimmerPosition={shimmerPosition} />
          </View>
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
    backgroundColor: colors.background.primary, // Pure black to match feed
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
    overflow: 'hidden',
  },

  storyProfile: {
    width: STORY_PROFILE_SIZE,
    height: STORY_PROFILE_SIZE,
    borderRadius: STORY_PROFILE_SIZE / 2,
    backgroundColor: colors.background.tertiary,
    position: 'absolute',
    bottom: 0,
    overflow: 'hidden',
  },

  // Feed card skeleton
  feedCard: {
    backgroundColor: colors.background.primary,
    marginBottom: 20,
  },

  feedPhoto: {
    width: SCREEN_WIDTH,
    aspectRatio: 1,
    backgroundColor: colors.background.tertiary,
    overflow: 'hidden',
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
    overflow: 'hidden',
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
    overflow: 'hidden',
  },

  feedTimestamp: {
    width: 60,
    height: 12,
    backgroundColor: colors.background.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
  },

  // Shimmer highlight - the moving semi-transparent bar
  shimmerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Semi-transparent white highlight
  },
});

export default FeedLoadingSkeleton;
