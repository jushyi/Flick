/**
 * PixelIcon - 16-bit pixel-art icon renderer
 *
 * Renders icons as filled rectangles on a pixel grid using react-native-svg.
 * Drop-in replacement for Ionicons with the same API: name, size, color, style.
 *
 * Usage:
 *   <PixelIcon name="chevron-back" size={24} color="#E0E0F0" />
 */

import React, { memo } from 'react';
import Svg, { Rect } from 'react-native-svg';
import { getIconData } from '../constants/pixelIcons';

import type { ViewStyle } from 'react-native';

type Props = {
  name: string;
  size?: number;
  color?: string;
  style?: ViewStyle;
};

const PixelIcon = memo(({ name, size = 24, color = '#E0E0F0', style }: Props) => {
  const iconData = getIconData(name);

  if (!iconData) {
    if (__DEV__) {
      console.warn(`PixelIcon: Unknown icon name "${name}"`);
    }
    return null;
  }

  const { width: gridW, height: gridH, pixels } = iconData;
  const maxDim = Math.max(gridW, gridH);
  const pixelSize = size / maxDim;

  // Center the icon if grid is not square
  const offsetX = (size - gridW * pixelSize) / 2;
  const offsetY = (size - gridH * pixelSize) / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={style}>
      {pixels.map(([x, y], i) => (
        <Rect
          key={i}
          x={offsetX + x * pixelSize}
          y={offsetY + y * pixelSize}
          width={pixelSize}
          height={pixelSize}
          fill={color}
        />
      ))}
    </Svg>
  );
});

PixelIcon.displayName = 'PixelIcon';

export default PixelIcon;
