/**
 * PixelExplosion - Retro pixel fragment scatter effect
 *
 * Renders 12 small colored pixel squares that scatter outward
 * when explodeProgress animates from 0 to 1. Used by SwipeablePhotoCard
 * for the "sprite death" exit animation.
 *
 * Fragments scatter in the direction specified by explodeDirectionX:
 * - -1: scatter left (archive swipe)
 * - +1: scatter right (journal swipe)
 * -  0: scatter downward (delete)
 *
 * Each fragment has a pre-computed velocity vector with gravity applied
 * so they arc naturally. Opacity fades out near end of progress.
 */

import React, { useMemo } from 'react';
import { Dimensions } from 'react-native';
import Animated, { useAnimatedStyle, interpolate } from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Neon retro colors for fragments
const FRAGMENT_COLORS = [
  '#00D4FF', // electric cyan
  '#FF2D78', // hot magenta
  '#39FF14', // neon green
  '#FFD700', // coin gold
  '#FF8C00', // retro amber
  '#E0E0F0', // phosphor white
];

const FRAGMENT_SIZE = 8;
const NUM_FRAGMENTS = 12;

/**
 * Pre-compute scatter vectors for each fragment.
 * These are deterministic (no Math.random at render time) so the
 * animation is consistent across re-renders.
 */
const FRAGMENT_SEEDS = Array.from({ length: NUM_FRAGMENTS }, (_, i) => {
  // Spread fragments across a fan pattern
  const angle = (i / NUM_FRAGMENTS) * Math.PI * 0.8 - Math.PI * 0.4; // -72deg to +72deg
  const speed = 0.6 + (i % 3) * 0.25; // vary speed: 0.6, 0.85, 1.1
  return {
    // Normalized velocity components (will be scaled by direction)
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 0.3, // slight upward bias initially
    // Starting offset from center (jitter so they don't all originate from same point)
    originX: ((i % 4) - 1.5) * 20,
    originY: (Math.floor(i / 4) - 1) * 25,
    // Color index
    colorIdx: i % FRAGMENT_COLORS.length,
    // Size variation
    size: FRAGMENT_SIZE + (i % 3) * 2, // 8, 10, 12
  };
});

const PixelExplosion = ({ explodeProgress, explodeDirectionX }) => {
  // Memoize fragment configs (static, never changes)
  const fragments = useMemo(() => FRAGMENT_SEEDS, []);

  return (
    <>
      {fragments.map((seed, i) => (
        <Fragment
          key={i}
          seed={seed}
          explodeProgress={explodeProgress}
          explodeDirectionX={explodeDirectionX}
        />
      ))}
    </>
  );
};

/**
 * Individual pixel fragment with animated position and opacity.
 * Uses useAnimatedStyle driven by the shared explodeProgress value.
 */
const Fragment = React.memo(({ seed, explodeProgress, explodeDirectionX }) => {
  const style = useAnimatedStyle(() => {
    const p = explodeProgress.value;
    if (p === 0) {
      return { opacity: 0 };
    }

    const dir = explodeDirectionX.value;

    // Horizontal: fragments scatter in swipe direction
    // dir=0 (delete): fragments scatter symmetrically outward
    const baseVx = dir === 0 ? seed.vx : Math.abs(seed.vx) * dir + seed.vx * 0.3;
    const tx = seed.originX + baseVx * SCREEN_WIDTH * 0.7 * p;

    // Vertical: initial upward burst, then gravity pulls down
    const upBurst = seed.vy * SCREEN_HEIGHT * 0.3 * p;
    const gravity = SCREEN_HEIGHT * 0.6 * p * p; // quadratic gravity
    const ty = seed.originY + upBurst + gravity;

    // Rotation for tumble effect
    const rotation = p * 360 * (seed.vx > 0 ? 1 : -1);

    // Fade out in last 30% of animation
    const opacity = interpolate(p, [0, 0.15, 0.7, 1], [0, 1, 1, 0], 'clamp');

    return {
      opacity,
      transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${rotation}deg` }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: seed.size,
          height: seed.size,
          backgroundColor: FRAGMENT_COLORS[seed.colorIdx],
          top: '45%',
          left: '45%',
        },
        style,
      ]}
      pointerEvents="none"
    />
  );
});

Fragment.displayName = 'PixelExplosionFragment';

export default React.memo(PixelExplosion);
