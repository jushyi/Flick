/**
 * PixelSpinner — 16-bit pixel-art loading spinner
 *
 * Drop-in replacement for React Native's ActivityIndicator.
 * Renders a square ring on a pixel grid with a bright segment
 * that cycles clockwise at retro frame rates (~6.7 FPS).
 *
 * Usage:
 *   <PixelSpinner size="large" color="#00D4FF" />
 *   <PixelSpinner size="small" color={colors.text.primary} />
 */

import React, { useState, useEffect, memo } from 'react';
import Svg, { Rect } from 'react-native-svg';
import { BASE_PIXELS, HIGHLIGHT_SETS, GRID_SIZE, FRAME_COUNT } from '../constants/spinnerFrames';

const FRAME_MS = 150;
const DIM_OPACITY = 0.25;

const PixelSpinner = memo(({ size = 'small', color = '#E0E0F0', style }) => {
  const [frame, setFrame] = useState(0);

  const resolvedSize = size === 'small' ? 20 : size === 'large' ? 40 : size;
  const pixelSize = resolvedSize / GRID_SIZE;

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % FRAME_COUNT);
    }, FRAME_MS);
    return () => clearInterval(interval);
  }, []);

  const highlightSet = HIGHLIGHT_SETS[frame];

  return (
    <Svg
      width={resolvedSize}
      height={resolvedSize}
      viewBox={`0 0 ${resolvedSize} ${resolvedSize}`}
      style={style}
    >
      {BASE_PIXELS.map(([x, y], i) => (
        <Rect
          key={i}
          x={x * pixelSize}
          y={y * pixelSize}
          width={pixelSize}
          height={pixelSize}
          fill={color}
          opacity={highlightSet.has((x << 4) | y) ? 1 : DIM_OPACITY}
        />
      ))}
    </Svg>
  );
});

PixelSpinner.displayName = 'PixelSpinner';

export default PixelSpinner;
