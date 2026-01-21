import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  Easing,
} from 'react-native';
// Note: LinearGradient removed due to "unimplemented component" error in Expo Go
// Using solid color Views as a fallback
import * as Haptics from 'expo-haptics';
import logger from '../utils/logger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = 320; // Increased height for new button design

// Card dimensions for darkroom card stack (matching CameraScreen)
const CARD_WIDTH = 63;
const CARD_HEIGHT = 84;

// Base fanning values (at rest state)
const BASE_ROTATION_PER_CARD = 6;
const BASE_OFFSET_PER_CARD = 5;

// Hold duration - 1.6 seconds (1.25x faster than original 2 seconds)
const HOLD_DURATION = 1600;

// Spinner rotation durations
const SPINNER_NORMAL_DURATION = 2000;
const SPINNER_FAST_DURATION = 1000; // 2x faster during hold

// Crescendo haptic configuration
const HAPTIC_CONFIG = {
  // 0-25%: Light every 400ms
  phase1: { style: Haptics.ImpactFeedbackStyle.Light, interval: 400 },
  // 25-50%: Light every 300ms
  phase2: { style: Haptics.ImpactFeedbackStyle.Light, interval: 300 },
  // 50-75%: Medium every 200ms
  phase3: { style: Haptics.ImpactFeedbackStyle.Medium, interval: 200 },
  // 75-100%: Heavy every 150ms
  phase4: { style: Haptics.ImpactFeedbackStyle.Heavy, interval: 150 },
};

// Colors
const COLORS = {
  sheetBackground: '#1A1A1A',
  textPrimary: '#FFFFFF',
  textSecondary: '#888888',
  statusReady: '#22C55E',
  statusDeveloping: '#EF4444',
  cardBackground: '#2A2A2A',
  cardBorder: 'rgba(255, 255, 255, 0.3)',
  // Neon purple gradient colors
  buttonGradientStart: '#4C1D95', // Dark purple
  buttonGradientEnd: '#7C3AED',   // Lighter purple
  fillGradientStart: '#6B21A8',   // Darker fill left
  fillGradientEnd: '#A855F7',     // Lighter fill right
};

// Spinner SVG-like icon component using View (no svg dependency)
const SpinnerIcon = ({ rotation, color = COLORS.textPrimary }) => {
  return (
    <Animated.View
      style={[
        styles.spinnerContainer,
        {
          transform: [{ rotate: rotation }],
        },
      ]}
    >
      {/* Create spinner using 3 dots in a circular pattern */}
      <View style={[styles.spinnerDot, { top: 0, left: '50%', marginLeft: -3, backgroundColor: color }]} />
      <View style={[styles.spinnerDot, { bottom: 2, left: 2, backgroundColor: color, opacity: 0.7 }]} />
      <View style={[styles.spinnerDot, { bottom: 2, right: 2, backgroundColor: color, opacity: 0.4 }]} />
    </Animated.View>
  );
};

const DarkroomBottomSheet = ({ visible, revealedCount, developingCount, onClose, onComplete }) => {
  const [isPressing, setIsPressing] = useState(false);
  const progressValue = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(null);
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  // Spinner animation
  const spinnerRotation = useRef(new Animated.Value(0)).current;
  const spinnerAnimation = useRef(null);

  // Haptic interval tracking
  const hapticIntervalRef = useRef(null);
  const lastHapticTimeRef = useRef(0);

  const totalCount = (revealedCount || 0) + (developingCount || 0);
  const hasRevealedPhotos = revealedCount > 0;

  // Start spinner animation
  const startSpinnerAnimation = (fast = false) => {
    // Stop any existing animation
    if (spinnerAnimation.current) {
      spinnerAnimation.current.stop();
    }

    const duration = fast ? SPINNER_FAST_DURATION : SPINNER_NORMAL_DURATION;

    spinnerAnimation.current = Animated.loop(
      Animated.timing(spinnerRotation, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    spinnerAnimation.current.start();
  };

  // Interpolate spinner rotation to degrees
  const spinnerRotationDeg = spinnerRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Animate sheet slide when visibility changes
  useEffect(() => {
    if (visible) {
      // Slide up when opening
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();

      // Start normal spinner animation
      startSpinnerAnimation(false);

      logger.debug('DarkroomBottomSheet: Component mounted', {
        revealedCount,
        developingCount,
        totalCount,
        hasRevealedPhotos,
      });
    } else {
      // Reset to off-screen position when closed
      slideAnim.setValue(SHEET_HEIGHT);

      // Stop spinner
      if (spinnerAnimation.current) {
        spinnerAnimation.current.stop();
      }
    }

    return () => {
      // Clean up animations on unmount
      if (progressAnimation.current) {
        progressAnimation.current.stop();
        logger.debug('DarkroomBottomSheet: Component unmounted, animation stopped');
      }
      if (spinnerAnimation.current) {
        spinnerAnimation.current.stop();
      }
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
      }
    };
  }, [visible, revealedCount, developingCount, totalCount, hasRevealedPhotos, slideAnim]);

  useEffect(() => {
    // Reset progress when modal visibility changes
    if (!visible) {
      progressValue.setValue(0);
      setIsPressing(false);
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }
    }
  }, [visible, progressValue]);

  // Crescendo haptic feedback - runs during press
  const startCrescendoHaptics = () => {
    lastHapticTimeRef.current = Date.now();

    // Clear any existing interval
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
    }

    // Use a fast interval to check progress and trigger haptics at dynamic rates
    hapticIntervalRef.current = setInterval(() => {
      progressValue.addListener(({ value }) => {
        progressValue.removeAllListeners();

        const now = Date.now();
        let config;

        // Determine which phase we're in
        if (value < 0.25) {
          config = HAPTIC_CONFIG.phase1;
        } else if (value < 0.50) {
          config = HAPTIC_CONFIG.phase2;
        } else if (value < 0.75) {
          config = HAPTIC_CONFIG.phase3;
        } else {
          config = HAPTIC_CONFIG.phase4;
        }

        // Check if enough time has passed for this phase's interval
        if (now - lastHapticTimeRef.current >= config.interval) {
          try {
            Haptics.impactAsync(config.style);
            lastHapticTimeRef.current = now;
            logger.debug('DarkroomBottomSheet: Crescendo haptic', {
              progress: (value * 100).toFixed(0) + '%',
              style: config.style,
            });
          } catch (error) {
            logger.debug('DarkroomBottomSheet: Haptic failed', error);
          }
        }
      });
    }, 50); // Check every 50ms for responsive haptics
  };

  const stopCrescendoHaptics = () => {
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
    progressValue.removeAllListeners();
  };

  const handlePressIn = () => {
    if (!visible || !hasRevealedPhotos) {
      logger.debug('DarkroomBottomSheet: Press-and-hold blocked (no revealed photos)', {
        hasRevealedPhotos,
        revealedCount,
        developingCount,
      });
      return;
    }

    setIsPressing(true);
    logger.info('DarkroomBottomSheet: Press-and-hold started', { revealedCount, developingCount });

    // Speed up spinner during hold
    startSpinnerAnimation(true);

    // Start crescendo haptics
    startCrescendoHaptics();

    // Animate from 0 to 1 over 1.6 seconds
    progressAnimation.current = Animated.timing(progressValue, {
      toValue: 1,
      duration: HOLD_DURATION,
      useNativeDriver: false,
    });

    progressAnimation.current.start(({ finished }) => {
      if (finished) {
        logger.debug('DarkroomBottomSheet: Progress reached 100%');
        logger.info('DarkroomBottomSheet: Press-and-hold completed', { revealedCount, developingCount });

        // Stop crescendo haptics
        stopCrescendoHaptics();

        // Final success haptic
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          logger.info('DarkroomBottomSheet: Completion haptic triggered');
        } catch (error) {
          logger.debug('DarkroomBottomSheet: Completion haptic failed', error);
        }

        // Small delay to let user see full fill
        setTimeout(() => {
          // Reset state
          setIsPressing(false);
          progressValue.setValue(0);

          // Reset spinner to normal speed
          startSpinnerAnimation(false);

          // Trigger completion callback
          if (onComplete) {
            onComplete();
          }
        }, 200);
      }
    });
  };

  const handlePressOut = () => {
    if (!isPressing) return;

    logger.debug('DarkroomBottomSheet: Press released before completion');

    // Stop crescendo haptics
    stopCrescendoHaptics();

    // Stop current animation
    if (progressAnimation.current) {
      progressAnimation.current.stop();
    }

    // Spring back to 0
    Animated.spring(progressValue, {
      toValue: 0,
      tension: 50,
      friction: 7,
      useNativeDriver: false,
    }).start();

    setIsPressing(false);

    // Reset spinner to normal speed
    startSpinnerAnimation(false);
  };

  const handleBackdropPress = () => {
    logger.debug('DarkroomBottomSheet: Backdrop pressed, closing');
    if (onClose) {
      onClose();
    }
  };

  // Interpolate progress value to width percentage for fill animation
  const progressWidth = progressValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Render card stack (duplicated from CameraScreen's DarkroomCardButton)
  const renderCardStack = () => {
    const cardCount = Math.min(Math.max(totalCount, 1), 4);
    const cards = [];

    // Calculate center compensation
    const centerCompensation = ((cardCount - 1) * BASE_OFFSET_PER_CARD) / 2;
    const rotationCompensation = ((cardCount - 1) * BASE_ROTATION_PER_CARD) / 2;

    for (let i = 0; i < cardCount; i++) {
      const isTopCard = i === cardCount - 1;
      const positionFromTop = cardCount - 1 - i;

      // Base rotation and offset
      const baseRotation = (positionFromTop * BASE_ROTATION_PER_CARD) - rotationCompensation;
      const baseOffset = (positionFromTop * BASE_OFFSET_PER_CARD) - centerCompensation;

      cards.push(
        <View
          key={i}
          style={[
            styles.cardStackCard,
            {
              position: 'absolute',
              transform: [
                { rotate: `${baseRotation}deg` },
                { translateX: baseOffset },
              ],
              zIndex: i + 1,
            },
          ]}
        >
          {isTopCard && (
            <Text style={styles.cardStackText}>
              {totalCount > 99 ? '99+' : totalCount}
            </Text>
          )}
        </View>
      );
    }

    return cards;
  };

  // Get status dot color and text
  const getStatusInfo = () => {
    if (hasRevealedPhotos) {
      return {
        color: COLORS.statusReady,
        text: `${revealedCount} photos ready to reveal`,
      };
    }
    return {
      color: COLORS.statusDeveloping,
      text: 'Photos still developing',
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleBackdropPress}
    >
      <View style={styles.container}>
        {/* Backdrop - fades in with modal */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleBackdropPress}
        />

        {/* Bottom Sheet - slides up separately */}
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header Row - Title/Status on left, Card Stack on right */}
          <View style={styles.headerRow}>
            {/* Left side: Title and Status */}
            <View style={styles.headerLeft}>
              <View style={styles.titleRow}>
                <Text style={styles.titleText}>Darkroom</Text>
                <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
              </View>
              <Text style={styles.statusText}>{statusInfo.text}</Text>
            </View>

            {/* Right side: Card Stack */}
            <View style={styles.cardStackContainer}>
              {renderCardStack()}
            </View>
          </View>

          {/* Hold Button - only show if photos are ready */}
          {hasRevealedPhotos && (
            <View
              style={styles.holdButtonContainer}
              onStartShouldSetResponder={() => true}
              onResponderGrant={handlePressIn}
              onResponderRelease={handlePressOut}
              onResponderTerminate={handlePressOut}
            >
              {/* Base purple background (solid color fallback) */}
              <View style={styles.holdButtonBase}>
                {/* Fill overlay that animates left-to-right */}
                <Animated.View style={[styles.fillOverlay, { width: progressWidth, backgroundColor: COLORS.fillGradientEnd }]} />

                {/* Button content */}
                <View style={styles.holdButtonContent}>
                  <SpinnerIcon rotation={spinnerRotationDeg} />
                  <Text style={styles.holdButtonText}>
                    {isPressing ? 'Opening...' : 'Hold to open photos'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Message for developing photos */}
          {!hasRevealedPhotos && (
            <Text style={styles.developingText}>
              Check back soon!
            </Text>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  sheet: {
    backgroundColor: COLORS.sheetBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
  },
  // Header row - flex row with title/status left, cards right
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginRight: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  // Card stack container
  cardStackContainer: {
    width: CARD_WIDTH + 20,
    height: CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardStackCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  cardStackText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Hold button
  holdButtonContainer: {
    width: '100%',
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  holdButtonBase: {
    width: '100%',
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: COLORS.buttonGradientEnd, // Solid purple (#7C3AED)
  },
  fillOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  holdButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  holdButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: 12,
  },
  // Spinner
  spinnerContainer: {
    width: 24,
    height: 24,
    position: 'relative',
  },
  spinnerDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  developingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 16,
  },
});

export default DarkroomBottomSheet;
