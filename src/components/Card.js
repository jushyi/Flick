import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

/**
 * Reusable Card Component
 * @param {ReactNode} children - Card content
 * @param {function} onPress - Function to call on press (makes card touchable)
 * @param {object} style - Additional styles
 * @param {boolean} elevated - Whether to show shadow elevation
 */
const Card = ({ children, onPress, style, elevated = true }) => {
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Android
  },
});

export default Card;
