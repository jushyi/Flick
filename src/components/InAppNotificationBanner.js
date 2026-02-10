import React, { useEffect, useRef, useCallback } from 'react';
import { Animated, PanResponder, TouchableOpacity, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PixelIcon from './PixelIcon';
import { colors } from '../constants/colors';
import { styles } from '../styles/InAppNotificationBanner.styles';

const AUTO_DISMISS_MS = 4000;
const SWIPE_THRESHOLD = -30;
const SLIDE_START = -160;
const SLIDE_END = 0;

/**
 * InAppNotificationBanner - Custom dark-themed foreground notification banner
 *
 * Slides down from the top when a notification arrives while the app is in foreground.
 * Auto-dismisses after 4 seconds. Swipe up to dismiss. Tap to navigate.
 *
 * @param {boolean} visible - Whether the banner is shown
 * @param {string} title - Notification title
 * @param {string} body - Notification body text
 * @param {string|null} avatarUrl - Sender avatar URL (shows icon placeholder if null)
 * @param {function} onPress - Called when banner is tapped
 * @param {function} onDismiss - Called when banner is dismissed (auto, swipe, or tap)
 */
const InAppNotificationBanner = ({ visible, title, body, avatarUrl, onPress, onDismiss }) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SLIDE_START)).current;
  const autoDismissTimer = useRef(null);

  const clearAutoDismissTimer = useCallback(() => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }
  }, []);

  const animateDismiss = useCallback(() => {
    clearAutoDismissTimer();
    Animated.spring(translateY, {
      toValue: SLIDE_START,
      useNativeDriver: true,
      bounciness: 0,
      speed: 14,
    }).start(() => {
      if (onDismiss) {
        onDismiss();
      }
    });
  }, [translateY, onDismiss, clearAutoDismissTimer]);

  const animateIn = useCallback(() => {
    translateY.setValue(SLIDE_START);
    Animated.spring(translateY, {
      toValue: SLIDE_END,
      useNativeDriver: true,
      bounciness: 6,
      speed: 12,
    }).start();
  }, [translateY]);

  // Handle visible transitions
  useEffect(() => {
    if (visible) {
      animateIn();

      clearAutoDismissTimer();
      autoDismissTimer.current = setTimeout(() => {
        animateDismiss();
      }, AUTO_DISMISS_MS);
    } else {
      clearAutoDismissTimer();
    }

    return () => {
      clearAutoDismissTimer();
    };
  }, [visible, animateIn, animateDismiss, clearAutoDismissTimer]);

  // PanResponder for swipe-up to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture vertical swipe-up gestures
        return gestureState.dy < -10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < SWIPE_THRESHOLD) {
          animateDismiss();
        }
      },
    })
  ).current;

  const handlePress = useCallback(() => {
    clearAutoDismissTimer();
    if (onPress) {
      onPress();
    }
    animateDismiss();
  }, [onPress, animateDismiss, clearAutoDismissTimer]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.outerContainer, { transform: [{ translateY }], paddingTop: insets.top }]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress} style={styles.container}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl, cacheKey: avatarUrl ? `notif-avatar` : undefined }}
            style={styles.avatar}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="normal"
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <PixelIcon name="notifications" size={18} color={colors.icon.primary} />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {body ? (
            <Text style={styles.body} numberOfLines={1}>
              {body}
            </Text>
          ) : null}
        </View>
        <PixelIcon
          name="chevron-forward"
          size={18}
          color={colors.icon.secondary}
          style={styles.chevron}
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default InAppNotificationBanner;
