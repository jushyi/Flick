/**
 * SystemMessage — Renders system messages in the conversation
 *
 * Styled identically to TimeDivider: small centered gray text,
 * standard UI font (Silkscreen). Used for screenshot notifications
 * and other system events.
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const SystemMessage = ({ text }) => {
  if (!text) return null;
  return <Text style={styles.text}>{text}</Text>;
};

const styles = StyleSheet.create({
  text: {
    fontSize: 10,
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.body,
    textAlign: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
});

export default SystemMessage;
