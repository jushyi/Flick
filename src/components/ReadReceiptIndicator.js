import React, { useRef, useEffect } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';

import { format } from 'date-fns';

import { typography } from '../constants/typography';

/**
 * ReadReceiptIndicator — "Delivered" / "Read [time]"
 *
 * Renders below the sender's most recent sent message.
 * Fades in when visible becomes true; crossfades when isRead changes.
 *
 * @param {boolean} isRead - Whether the friend has read the message
 * @param {object|null} readAt - Firestore Timestamp with .toDate() method, or null
 * @param {boolean} visible - Controls entrance animation (true = show)
 */
const ReadReceiptIndicator = ({ isRead, readAt, visible }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const prevIsReadRef = useRef(isRead);

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      return;
    }

    // Crossfade when transitioning from Delivered to Read
    if (prevIsReadRef.current === false && isRead === true) {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Initial fade in for "Delivered"
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }

    prevIsReadRef.current = isRead;
  }, [visible, isRead, opacity]);

  if (!visible) {
    return null;
  }

  const getDisplayText = () => {
    if (isRead && readAt) {
      const date = readAt.toDate ? readAt.toDate() : new Date(readAt);
      return `Read ${format(date, 'h:mm a')}`;
    }
    return 'Delivered';
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Text style={styles.text}>{getDisplayText()}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginTop: 2,
    marginBottom: 4,
  },
  text: {
    fontSize: 10,
    color: '#7B7B9E',
    fontFamily: typography.fontFamily.readable,
  },
});

export default ReadReceiptIndicator;
