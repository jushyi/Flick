/**
 * PixelDissolveOverlay - Retro pixel shatter effect for delete animation
 *
 * Renders a grid of colored pixel blocks that scatter and fall when triggered,
 * creating a retro game "enemy death" dissolve effect.
 *
 * The overlay reads a shared `dissolveProgress` value (0→1) and each block
 * computes its own stagger, drift, fall, and fade from that single driver.
 *
 * @param {SharedValue} dissolveProgress - Reanimated shared value driving the animation (0→1)
 */

import React, { memo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { useAnimatedStyle, interpolateColor } from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLS = 6; // Optimized column count for performance
const ROWS = 8; // Optimized row count for performance

// Deterministic pseudo-random from seed
const pseudoRandom = seed => {
  const x = Math.sin(seed * 9.1 + 7.3) * 43758.5453;
  return x - Math.floor(x);
};

// Pre-compute block configs at module level (stable across renders)
const BLOCK_CONFIGS = [];

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const seed = row * COLS + col;
    const rand2 = pseudoRandom(seed + 100);
    const rand3 = pseudoRandom(seed + 200);

    // Create subtle gaps by reducing size slightly
    const cellWidth = 100 / COLS;
    const cellHeight = 100 / ROWS;
    const gapFactor = 0.98; // 2% total gap (1% on each side) - very subtle
    const offsetFactor = (1 - gapFactor) / 2; // Center the pixel in its cell

    // Center-to-edges bias: middle columns fall first
    const centerCol = (COLS - 1) / 2; // 5.5 for 12 columns
    const distanceFromCenter = Math.abs(col - centerCol); // 0 at center (falls first), 5.5 at edges (falls last)

    BLOCK_CONFIGS.push({
      row,
      col,
      // Position as percentage of card (with gap offset)
      leftPct: col * cellWidth + cellWidth * offsetFactor,
      topPct: row * cellHeight + cellHeight * offsetFactor,
      widthPct: cellWidth * gapFactor,
      heightPct: cellHeight * gapFactor,
      // No horizontal drift - pixels fall straight down
      driftX: 0,
      // All pixels fall same distance (same speed) with slight random variation
      fallDistance: SCREEN_HEIGHT * 0.5 + rand2 * SCREEN_HEIGHT * 0.3,
      rotation: 0, // No rotation - pixels fall straight
      // Stagger: cohesive bottom-to-top + center-to-edges pattern
      // Row (0-150) + distance from center (0-27.5) + minimal random (0-3) = structured cascade
      staggerNorm:
        ((ROWS - 1 - row) * 10 + distanceFromCenter * 5 + rand3 * 3) /
        (ROWS * 10 + centerCol * 5 + 3),
    });
  }
}

/**
 * Individual pixel block that reads dissolveProgress and computes its animation.
 * Memoized to avoid re-renders — animation is driven entirely by shared value on UI thread.
 */
const PixelBlock = memo(({ config, dissolveProgress }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const p = dissolveProgress.value;

    // Before animation starts: invisible (don't cover photo during triage)
    if (p <= 0) return { opacity: 0 };

    // Tighter cascade timing - rows closer together
    const blockStart = config.staggerNorm * 0.45; // Spread starts over 45% of animation (tighter)
    const blockDuration = 0.4; // Each pixel takes 40% of time - heavy overlap
    const blockProgress = Math.max(0, Math.min(1, (p - blockStart) / blockDuration));

    // After animation starts but before this block's turn: visible and stationary
    if (blockProgress <= 0) {
      return { opacity: 1, backgroundColor: '#1034A6' }; // Start as blue
    }

    // Once this block's turn begins: fall with delayed fade
    // Pixels stay fully visible for first 70%, then fade quickly in last 30%
    const fade = blockProgress < 0.7 ? 0 : (blockProgress - 0.7) / 0.3;
    const fall = Math.pow(blockProgress, 5); // Quintic fall - very slow start, dramatic exponential acceleration

    // Abrupt color transition from blue to white at 25% of fall
    const backgroundColor = interpolateColor(
      fall,
      [0, 0.25, 0.26],
      ['#1034A6', '#1034A6', '#FFFFFF']
    );

    return {
      opacity: 1 - fade,
      backgroundColor: backgroundColor, // Blue → White transition
      transform: [
        { translateX: config.driftX * blockProgress },
        { translateY: config.fallDistance * fall },
        { rotate: `${config.rotation * blockProgress}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${config.leftPct}%`,
          top: `${config.topPct}%`,
          width: `${config.widthPct}%`,
          height: `${config.heightPct}%`,
        },
        animatedStyle, // backgroundColor animated from blue to white
      ]}
    />
  );
});

PixelBlock.displayName = 'PixelBlock';

const PixelDissolveOverlay = ({ dissolveProgress }) => {
  return (
    <View style={styles.container} pointerEvents="none">
      {BLOCK_CONFIGS.map((config, index) => (
        <PixelBlock key={index} config={config} dissolveProgress={dissolveProgress} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
  },
});

export default memo(PixelDissolveOverlay);
