import React from 'react';
import { View, StyleSheet } from 'react-native';

import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { layout } from '../../constants/layout';

import { useShimmer, SkeletonShape } from './SkeletonBase';

const ROW_COUNT = 6;
const AVATAR_SIZE = layout.dimensions.avatarMedium; // 40px

/**
 * Skeleton loading state for the Conversations/Messages list screen.
 * 6 rows, each with a circle avatar and two text lines.
 */
export function ConversationsSkeleton() {
  const shimmerPosition = useShimmer();

  return (
    <View style={styles.container}>
      {Array.from({ length: ROW_COUNT }).map((_, i) => (
        <View key={i} testID={`conv-row-${i}`} style={styles.row}>
          <SkeletonShape
            width={AVATAR_SIZE}
            height={AVATAR_SIZE}
            borderRadius={AVATAR_SIZE / 2}
            shimmerPosition={shimmerPosition}
          />
          <View style={styles.textBlock}>
            <SkeletonShape
              width={120}
              height={14}
              borderRadius={layout.borderRadius.md}
              shimmerPosition={shimmerPosition}
              style={styles.nameMargin}
            />
            <SkeletonShape
              width={200}
              height={12}
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
    paddingVertical: spacing.sm,
  },
  textBlock: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  nameMargin: {
    marginBottom: 6,
  },
});
