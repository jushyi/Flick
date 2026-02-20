import React from 'react';
import { Text, StyleSheet } from 'react-native';

import { isToday, isYesterday, format } from 'date-fns';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

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
    fontSize: 10,
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.body,
    textAlign: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
});

export default TimeDivider;
