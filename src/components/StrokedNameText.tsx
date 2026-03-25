import React from 'react';
import { Text } from 'react-native';

const GLOW_RADIUS = 2;

import type { TextStyle, TextProps } from 'react-native';

type Props = TextProps & {
  children: string;
  style?: TextStyle;
  nameColor?: string;
};

const StrokedNameText = ({
  children,
  style,
  nameColor,
  numberOfLines,
  ellipsizeMode,
  ...props
}: Props) => {
  return (
    <Text
      style={[
        style,
        nameColor && {
          color: nameColor,
          textShadowColor: nameColor,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: GLOW_RADIUS,
        },
      ]}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      {...props}
    >
      {children}
    </Text>
  );
};

export default React.memo(StrokedNameText);
