import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

import { colors } from '../../constants/colors';
import { layout } from '../../constants/layout';

import { useShimmer, SkeletonShape } from './SkeletonBase';

const CARD_COUNT = 3;
const CARD_OFFSET = 8;

/**
 * Skeleton loading state for the Darkroom screen.
 * 3 stacked card placeholders simulating developing photo cards.
 */
export function DarkroomSkeleton() {
  const shimmerPosition = useShimmer();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth * 0.8;
  const cardHeight = cardWidth * (4 / 3);

  return (
    <View style={styles.container}>
      <View style={[styles.stack, { width: cardWidth, height: cardHeight + CARD_OFFSET * (CARD_COUNT - 1) }]}>
        {Array.from({ length: CARD_COUNT }).map((_, i) => (
          <SkeletonShape
            key={i}
            width={cardWidth}
            height={cardHeight}
            borderRadius={layout.borderRadius.lg}
            shimmerPosition={shimmerPosition}
            style={[
              styles.card,
              {
                top: i * CARD_OFFSET,
                zIndex: CARD_COUNT - i,
              },
            ] as any}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    position: 'relative',
  },
  card: {
    position: 'absolute',
    left: 0,
  },
});
