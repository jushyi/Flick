import React from 'react';
import { Text, StyleSheet } from 'react-native';

import { isToday, isYesterday, format } from 'date-fns';

import { colors } from '../constants/colors';

const formatDividerDate = timestamp => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();

  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (date.getFullYear() === now.getFullYear()) return format(date, 'EEE, MMM d');
  return format(date, 'MMM d, yyyy');
};

const TimeDivider = ({ timestamp, label }) => {
  const displayText = label || formatDividerDate(timestamp);

  if (!displayText) return null;

  return <Text style={styles.text}>{displayText}</Text>;
};

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
});

export default TimeDivider;
