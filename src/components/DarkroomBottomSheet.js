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
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import logger from '../utils/logger';
import { colors } from '../constants/colors';

// Radial gradient background component for hold button
const RadialGradientButton = ({ centerColor, edgeColor, width, height, children, style }) => (
  <View style={[{ width, height, position: 'relative' }, style]}>
    <Svg width={width} height={height} style={{ position: 'absolute' }}>
      <Defs>
        <RadialGradient id="holdButtonGrad" cx="50%" cy="50%" rx="95%" ry="95%">
          <Stop offset="0%" stopColor={centerColor} />
          <Stop offset="40%" stopColor={centerColor} />
          <Stop offset="100%" stopColor={edgeColor} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} rx="16" fill="url(#holdButtonGrad)" />
    </Svg>
    {children}
  </View>
);

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
const SPINNER_FAST_DURATION = 667; // 3x faster during hold

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

// Colors - using design tokens from constants/colors.js
const COLORS = {
  sheetBackground: colors.background.secondary, // '#1A1A1A'
  textPrimary: colors.text.primary, // '#FFFFFF'
  textSecondary: colors.text.secondary, // '#888888'
  statusReady: colors.status.ready, // '#22C55E'
  statusDeveloping: colors.status.developing, // '#EF4444'
  cardBackground: colors.background.tertiary, // '#2A2A2A'
  cardBorder: 'rgba(255, 255, 255, 0.3)', // Keep as-is
  // Gradient colors from design tokens
  buttonGradientStart: colors.brand.gradient.button[0], // '#4C1D95'
  buttonGradientEnd: colors.brand.gradient.button[1], // '#7C3AED'
  fillGradientStart: colors.brand.gradient.fill[0], // '#6B21A8'
  fillGradientEnd: colors.brand.gradient.fill[1], // '#A855F7'
  // Hold button: purple anticipation → pink payoff
  buttonBase: colors.brand.gradient.revealed[0], // '#A855F7' (lighter purple)
  buttonFill: colors.brand.gradient.revealed[1], // '#F472B6' (pink)
};

// Spinner: 3/4 solid arc with gap, spins around static play triangle
const SpinnerIcon = ({ rotation, color = COLORS.textPrimary }) => {
  return (
    <View style={styles.spinnerOuter}>
      {/* Rotating 3/4 arc ring */}
      <Animated.View style={[styles.spinnerRingContainer, { transform: [{ rotate: rotation }] }]}>
        <View
          style={[
            styles.spinnerRing,
            {
              borderTopColor: color,
              borderRightColor: color,
              borderBottomColor: color,
              borderLeftColor: 'transparent',
            },
          ]}
        />
      </Animated.View>
      {/* Static play triangle in center */}
      <View style={[styles.playTriangle, { borderLeftColor: color }]} />
    </View>
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

    // Reset rotation value to 0 before starting
    spinnerRotation.setValue(0);

    const duration = fast ? SPINNER_FAST_DURATION : SPINNER_NORMAL_DURATION;

    spinnerAnimation.current = Animated.loop(
      Animated.timing(spinnerRotation, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
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
        } else if (value < 0.5) {
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
        logger.info('DarkroomBottomSheet: Press-and-hold completed', {
          revealedCount,
          developingCount,
        });

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
      const baseRotation = positionFromTop * BASE_ROTATION_PER_CARD - rotationCompensation;
      const baseOffset = positionFromTop * BASE_OFFSET_PER_CARD - centerCompensation;

      cards.push(
        <View
          key={i}
          style={[
            styles.cardStackCard,
            {
              position: 'absolute',
              transform: [{ rotate: `${baseRotation}deg` }, { translateX: baseOffset }],
              zIndex: i + 1,
            },
          ]}
        >
          {isTopCard && (
            <Text style={styles.cardStackText}>{totalCount > 99 ? '99+' : totalCount}</Text>
          )}
        </View>
      );
    }

    return cards;
  };

  // Get status dot color and text
  const getStatusInfo = () => {
    if (hasRevealedPhotos) {
      const photoWord = revealedCount === 1 ? 'photo' : 'photos';
      return {
        color: COLORS.statusReady,
        text: `${revealedCount} ${photoWord} ready to reveal`,
      };
    }
    return {
      color: COLORS.statusDeveloping,
      text: 'Photos still developing',
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleBackdropPress}>
      <View style={styles.container}>
        {/* Backdrop - fades in with modal */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleBackdropPress} />

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
            <View style={styles.cardStackContainer}>{renderCardStack()}</View>
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
              {/* Base radial gradient button - pink center, white edges */}
              <RadialGradientButton
                centerColor="#DB2777"
                edgeColor="#FFFFFF"
                width={SCREEN_WIDTH - 48}
                height={64}
                style={styles.holdButtonBase}
              >
                {/* Fill overlay that darkens the gradient left-to-right */}
                <Animated.View
                  style={[
                    styles.fillOverlay,
                    { width: progressWidth, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
                  ]}
                />

                {/* Button content */}
                <View style={styles.holdButtonContent}>
                  <SpinnerIcon rotation={spinnerRotationDeg} />
                  <Text style={styles.holdButtonText}>
                    {isPressing ? 'Revealing...' : 'Hold to reveal photos'}
                  </Text>
                </View>
              </RadialGradientButton>
            </View>
          )}

          {/* Message for developing photos */}
          {!hasRevealedPhotos && <Text style={styles.developingText}>Check back soon!</Text>}
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
    // backgroundColor provided by LinearGradient
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
  // Spinner - 3/4 solid arc with 1/4 gap
  spinnerOuter: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerRingContainer: {
    position: 'absolute',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 3, // Offset to center visually
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
