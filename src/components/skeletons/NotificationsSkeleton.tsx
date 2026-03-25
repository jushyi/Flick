import React from 'react';
import { View, StyleSheet } from 'react-native';

import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { layout } from '../../constants/layout';

import { useShimmer, SkeletonShape } from './SkeletonBase';

const ROW_COUNT = 6;
const AVATAR_SIZE = layout.dimensions.avatarMedium; // 40px
const THUMBNAIL_SIZE = 40;

/**
 * Skeleton loading state for the Notifications screen.
 * 6 rows with avatar, two text lines, and a small thumbnail on the right.
 */
export function NotificationsSkeleton() {
  const shimmerPosition = useShimmer();

  return (
    <View style={styles.container}>
      {Array.from({ length: ROW_COUNT }).map((_, i) => (
        <View key={i} testID={`notif-row-${i}`} style={styles.row}>
          <SkeletonShape
            width={AVATAR_SIZE}
            height={AVATAR_SIZE}
            borderRadius={AVATAR_SIZE / 2}
            shimmerPosition={shimmerPosition}
          />
          <View style={styles.textBlock}>
            <SkeletonShape
              width={180}
              height={14}
              borderRadius={layout.borderRadius.md}
              shimmerPosition={shimmerPosition}
              style={styles.lineMargin}
            />
            <SkeletonShape
              width={100}
              height={12}
              borderRadius={layout.borderRadius.md}
              shimmerPosition={shimmerPosition}
            />
          </View>
          <SkeletonShape
            width={THUMBNAIL_SIZE}
            height={THUMBNAIL_SIZE}
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
    paddingVertical: spacing.sm,
  },
  textBlock: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  lineMargin: {
    marginBottom: 4,
  },
});
