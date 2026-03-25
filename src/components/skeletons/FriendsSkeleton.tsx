import React from 'react';
import { View, StyleSheet } from 'react-native';

import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { layout } from '../../constants/layout';

import { useShimmer, SkeletonShape } from './SkeletonBase';

const ROW_COUNT = 8;
const AVATAR_SIZE = layout.dimensions.avatarMedium; // 40px

/**
 * Skeleton loading state for the Friends screen.
 * 8 rows with avatar, name placeholder, and action button placeholder.
 */
export function FriendsSkeleton() {
  const shimmerPosition = useShimmer();

  return (
    <View style={styles.container}>
      {Array.from({ length: ROW_COUNT }).map((_, i) => (
        <View key={i} testID={`friend-row-${i}`} style={styles.row}>
          <SkeletonShape
            width={AVATAR_SIZE}
            height={AVATAR_SIZE}
            borderRadius={AVATAR_SIZE / 2}
            shimmerPosition={shimmerPosition}
          />
          <View style={styles.nameBlock}>
            <SkeletonShape
              width={140}
              height={14}
              borderRadius={layout.borderRadius.md}
              shimmerPosition={shimmerPosition}
            />
          </View>
          <SkeletonShape
            width={70}
            height={30}
            borderRadius={layout.borderRadius.md}
            shimmerPosition={shimmerPosition}
          />
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
  nameBlock: {
    flex: 1,
    marginLeft: spacing.sm,
  },
});
