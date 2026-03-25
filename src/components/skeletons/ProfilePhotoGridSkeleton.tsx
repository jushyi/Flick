import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

import { colors } from '../../constants/colors';

import { useShimmer, SkeletonShape } from './SkeletonBase';

const COLUMN_COUNT = 3;
const CELL_COUNT = 9;
const GAP = 2;

/**
 * Skeleton loading state for profile photo grids.
 * 3-column grid of 9 square cells (3 rows x 3 cols), edge-to-edge.
 */
export function ProfilePhotoGridSkeleton() {
  const shimmerPosition = useShimmer();
  const { width: screenWidth } = useWindowDimensions();
  const cellSize = (screenWidth - GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {Array.from({ length: CELL_COUNT }).map((_, i) => (
          <SkeletonShape
            key={i}
            width={cellSize}
            height={cellSize}
            shimmerPosition={shimmerPosition}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
});
