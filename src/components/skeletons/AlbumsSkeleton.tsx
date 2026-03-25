import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { layout } from '../../constants/layout';

import { useShimmer, SkeletonShape } from './SkeletonBase';

const COLUMN_COUNT = 2;
const CELL_COUNT = 6;
const GAP = spacing.xs; // 8px

/**
 * Skeleton loading state for the Albums screen.
 * 2-column grid of 6 album cells (3 rows x 2 cols).
 */
export function AlbumsSkeleton() {
  const shimmerPosition = useShimmer();
  const { width: screenWidth } = useWindowDimensions();
  const cellSize = (screenWidth - spacing.md * 2 - GAP) / COLUMN_COUNT;

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {Array.from({ length: CELL_COUNT }).map((_, i) => (
          <SkeletonShape
            key={i}
            width={cellSize}
            height={cellSize}
            borderRadius={layout.borderRadius.md}
            shimmerPosition={shimmerPosition}
            style={styles.cell}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    padding: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    aspectRatio: 1,
  },
});
