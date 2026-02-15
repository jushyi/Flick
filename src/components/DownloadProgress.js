/**
 * DownloadProgress
 *
 * Shows download progress with animated bar and count.
 * Used during "Download All Photos" before account deletion.
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';

const STATUS_MESSAGES = {
  preparing: 'Preparing download...',
  downloading: (current, total) => `Downloading ${current} of ${total} photos...`,
  complete: total => `Download complete! ${total} photos saved.`,
  error: 'Download failed. Some photos may not have been saved.',
};

/**
 * DownloadProgress component
 * @param {number} current - Number of photos downloaded
 * @param {number} total - Total photos to download
 * @param {string} status - 'preparing' | 'downloading' | 'complete' | 'error'
 */
const DownloadProgress = ({ current = 0, total = 0, status = 'preparing' }) => {
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Calculate progress percentage
  const progress = total > 0 ? current / total : 0;

  // Animate progress bar width
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  // Get status message
  const getMessage = () => {
    switch (status) {
      case 'preparing':
        return STATUS_MESSAGES.preparing;
      case 'downloading':
        return STATUS_MESSAGES.downloading(current, total);
      case 'complete':
        return STATUS_MESSAGES.complete(total);
      case 'error':
        return STATUS_MESSAGES.error;
      default:
        return '';
    }
  };

  // Interpolate width from 0% to 100%
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressWidth,
            },
          ]}
        />
      </View>
      <Text style={styles.statusText}>{getMessage()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  progressTrack: {
    height: spacing.xs,
    backgroundColor: colors.background.secondary,
    borderRadius: layout.borderRadius.md,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.brand.purple,
    borderRadius: layout.borderRadius.md,
  },
  statusText: {
    marginTop: spacing.sm,
    textAlign: 'center',
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
  },
});

export default DownloadProgress;
