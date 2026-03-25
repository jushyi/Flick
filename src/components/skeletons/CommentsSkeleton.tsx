import React from 'react';
import { View, StyleSheet } from 'react-native';

import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { layout } from '../../constants/layout';

import { useShimmer, SkeletonShape } from './SkeletonBase';

const ROW_COUNT = 5;
const AVATAR_SIZE = layout.dimensions.avatarSmall; // 32px

/**
 * Skeleton loading state for the Comments section.
 * 5 rows with small avatar and two text lines (username + comment text).
 */
export function CommentsSkeleton() {
  const shimmerPosition = useShimmer();

  return (
    <View style={styles.container}>
      {Array.from({ length: ROW_COUNT }).map((_, i) => (
        <View key={i} testID={`comment-row-${i}`} style={styles.row}>
          <SkeletonShape
            width={AVATAR_SIZE}
            height={AVATAR_SIZE}
            borderRadius={AVATAR_SIZE / 2}
            shimmerPosition={shimmerPosition}
          />
          <View style={styles.textBlock}>
            <SkeletonShape
              width={100}
              height={12}
              borderRadius={layout.borderRadius.md}
              shimmerPosition={shimmerPosition}
              style={styles.usernameMargin}
            />
            <SkeletonShape
              width="70%"
              height={14}
              borderRadius={layout.borderRadius.md}
              shimmerPosition={shimmerPosition}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  textBlock: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  usernameMargin: {
    marginBottom: 4,
  },
});
