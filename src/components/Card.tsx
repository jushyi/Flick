import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';


import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  elevated?: boolean;
};

const Card = ({ children, onPress, style, elevated = true }: Props) => {
  const containerStyle = [styles.card, elevated && styles.elevated, style];

  if (onPress) {
    return (
      <TouchableOpacity style={containerStyle} onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: layout.borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  elevated: {
    ...layout.shadow.light,
  },
});

export default Card;
