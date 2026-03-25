import React from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';

import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { layout } from '../../constants/layout';

import { useShimmer, SkeletonShape } from './SkeletonBase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Match FeedLoadingSkeleton / FriendStoryCard dimensions
const STORY_PHOTO_WIDTH = 88;
const STORY_PHOTO_HEIGHT = 130;
const STORY_BORDER_WIDTH = 3;
const STORY_PROFILE_SIZE = 32;
const FEED_PROFILE_SIZE = 36;

/**
 * Skeleton loading state for the Feed screen.
 * Matches the layout of FeedLoadingSkeleton: horizontal stories row + feed cards.
 */
export function FeedSkeleton() {
  const shimmerPosition = useShimmer();

  const renderStoryCard = (index: number) => (
    <View key={index} style={styles.storyCard}>
      <SkeletonShape
        width={STORY_PHOTO_WIDTH + STORY_BORDER_WIDTH * 2}
        height={STORY_PHOTO_HEIGHT + STORY_BORDER_WIDTH * 2}
        borderRadius={layout.borderRadius.md}
        shimmerPosition={shimmerPosition}
        style={styles.storyPhoto}
      />
      <SkeletonShape
        width={STORY_PROFILE_SIZE}
        height={STORY_PROFILE_SIZE}
        borderRadius={STORY_PROFILE_SIZE / 2}
        shimmerPosition={shimmerPosition}
        style={styles.storyProfile}
      />
    </View>
  );

  const renderFeedCard = (index: number) => (
    <View key={index} style={styles.feedCard}>
      <SkeletonShape
        width={SCREEN_WIDTH}
        height={SCREEN_WIDTH}
        shimmerPosition={shimmerPosition}
      />
      <View style={styles.feedInfoRow}>
        <SkeletonShape
          width={FEED_PROFILE_SIZE}
          height={FEED_PROFILE_SIZE}
          borderRadius={FEED_PROFILE_SIZE / 2}
          shimmerPosition={shimmerPosition}
          style={styles.feedProfileMargin}
        />
        <View style={styles.feedTextContainer}>
          <SkeletonShape
            width={120}
            height={14}
            borderRadius={layout.borderRadius.md}
            shimmerPosition={shimmerPosition}
            style={styles.feedNameMargin}
          />
          <SkeletonShape
            width={60}
            height={12}
            borderRadius={layout.borderRadius.md}
            shimmerPosition={shimmerPosition}
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesRow}
        scrollEnabled={false}
      >
        {Array.from({ length: 4 }).map((_, i) => renderStoryCard(i))}
      </ScrollView>
      {Array.from({ length: 2 }).map((_, i) => renderFeedCard(i))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  storiesRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  storyCard: {
    width: STORY_PHOTO_WIDTH + STORY_BORDER_WIDTH * 2 + 8,
    alignItems: 'center',
    marginRight: 10,
  },
  storyPhoto: {
    marginBottom: STORY_PROFILE_SIZE / 2 + spacing.xxs,
  },
  storyProfile: {
    position: 'absolute',
    bottom: 0,
  },
  feedCard: {
    backgroundColor: colors.background.primary,
    marginBottom: 20,
  },
  feedInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  feedProfileMargin: {
    marginRight: 10,
  },
  feedTextContainer: {
    flex: 1,
  },
  feedNameMargin: {
    marginBottom: 6,
  },
});
