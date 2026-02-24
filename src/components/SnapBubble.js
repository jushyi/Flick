/**
 * SnapBubble - Snap message bubble for conversation thread
 *
 * Renders a snap message in the conversation list with four visual states:
 * 1. Sending   - amber bubble, progress ring, "Sending..." text
 * 2. Error     - red-tinted bubble, warning icon, "Failed" + "Tap to retry"
 * 3. Unopened  - warm amber bubble, camera icon, "Snap" label, tappable
 * 4. Opened    - dimmed/faded bubble, camera icon, "Opened" label, non-interactive
 *
 * Aligns left (friend) or right (current user) like MessageBubble.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { format } from 'date-fns';

import PixelIcon from './PixelIcon';
import SnapProgressRing from './SnapProgressRing';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const SNAP_AMBER = '#F5A623';
const SNAP_AMBER_BG = 'rgba(245, 166, 35, 0.15)';
const SNAP_AMBER_BORDER = 'rgba(245, 166, 35, 0.3)';
const SNAP_ERROR_BG = 'rgba(255, 51, 51, 0.15)';
const SNAP_ERROR_BORDER = 'rgba(255, 51, 51, 0.3)';

const SnapBubble = ({
  message,
  isCurrentUser,
  showTimestamp,
  onPress,
  isPending = false,
  hasError = false,
  onRetry,
}) => {
  const isOpened = message.viewedAt !== null && message.viewedAt !== undefined;
  const isSending = isPending && !hasError;
  const isError = hasError;
  const isUnopened = !isOpened && !isPending && !hasError;

  const formatTimestamp = () => {
    if (!message.createdAt) return '';
    const date = message.createdAt.toDate
      ? message.createdAt.toDate()
      : new Date(message.createdAt);
    return format(date, 'h:mm a');
  };

  const formatViewedTimestamp = () => {
    if (!message.viewedAt) return '';
    const date = message.viewedAt.toDate ? message.viewedAt.toDate() : new Date(message.viewedAt);
    return format(date, 'h:mm a');
  };

  const handlePress = () => {
    if (isError && onRetry) {
      onRetry();
      return;
    }
    if (isUnopened && onPress) {
      onPress();
    }
  };

  const isInteractive = isUnopened || isError;

  const renderContent = () => {
    if (isSending) {
      return (
        <View style={styles.snapContent}>
          <SnapProgressRing size={40} color={SNAP_AMBER}>
            <PixelIcon name="camera" size={18} color={SNAP_AMBER} />
          </SnapProgressRing>
          <Text style={styles.sendingText}>Sending...</Text>
        </View>
      );
    }

    if (isError) {
      return (
        <View style={styles.snapContent}>
          <PixelIcon name="warning" size={24} color={colors.status.danger} />
          <View style={styles.errorTextContainer}>
            <Text style={styles.errorLabel}>Failed</Text>
            <Text style={styles.retryHint}>Tap to retry</Text>
          </View>
        </View>
      );
    }

    if (isOpened) {
      return (
        <View style={[styles.snapContent, styles.openedContent]}>
          <PixelIcon name="camera" size={24} color={colors.text.secondary} />
          <Text style={styles.openedLabel}>Opened</Text>
        </View>
      );
    }

    // Unopened
    return (
      <View style={styles.snapContent}>
        <PixelIcon name="camera" size={24} color={SNAP_AMBER} />
        <Text style={styles.unopenedLabel}>{isCurrentUser ? 'Delivered' : 'Snap'}</Text>
      </View>
    );
  };

  const getBubbleStyle = () => {
    if (isError) {
      return [styles.bubble, styles.errorBubble];
    }
    if (isOpened) {
      return [styles.bubble, styles.openedBubble];
    }
    // Sending or Unopened use amber
    return [styles.bubble, styles.amberBubble];
  };

  const bubble = (
    <View style={[styles.container, isCurrentUser ? styles.containerRight : styles.containerLeft]}>
      {isInteractive ? (
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.7}
          style={getBubbleStyle()}
          accessibilityRole="button"
          accessibilityLabel={isError ? 'Failed snap. Tap to retry' : 'View snap'}
        >
          {renderContent()}
        </TouchableOpacity>
      ) : (
        <View style={getBubbleStyle()}>{renderContent()}</View>
      )}

      {showTimestamp && (
        <Text
          style={[styles.timestamp, isCurrentUser ? styles.timestampRight : styles.timestampLeft]}
        >
          {isOpened ? `Opened ${formatViewedTimestamp()}` : formatTimestamp()}
        </Text>
      )}
    </View>
  );

  return bubble;
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
  },
  containerRight: {
    alignItems: 'flex-end',
  },
  containerLeft: {
    alignItems: 'flex-start',
  },
  bubble: {
    minWidth: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
  },
  amberBubble: {
    backgroundColor: SNAP_AMBER_BG,
    borderColor: SNAP_AMBER_BORDER,
  },
  errorBubble: {
    backgroundColor: SNAP_ERROR_BG,
    borderColor: SNAP_ERROR_BORDER,
  },
  openedBubble: {
    backgroundColor: 'rgba(123, 123, 158, 0.1)',
    borderColor: 'rgba(123, 123, 158, 0.2)',
    opacity: 0.5,
  },
  snapContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  openedContent: {
    opacity: 1,
  },
  unopenedLabel: {
    fontSize: 13,
    fontFamily: typography.fontFamily.body,
    color: SNAP_AMBER,
  },
  openedLabel: {
    fontSize: 13,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  sendingText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.body,
    color: SNAP_AMBER,
  },
  errorTextContainer: {
    flexDirection: 'column',
  },
  errorLabel: {
    fontSize: 13,
    fontFamily: typography.fontFamily.body,
    color: colors.status.danger,
  },
  retryHint: {
    fontSize: 10,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: 1,
  },
  timestamp: {
    fontSize: 10,
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.body,
    marginTop: 4,
  },
  timestampRight: {
    textAlign: 'right',
  },
  timestampLeft: {
    textAlign: 'left',
  },
});

export default SnapBubble;
