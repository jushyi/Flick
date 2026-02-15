import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Platform,
  Easing,
  Dimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import logger from '../utils/logger';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Card with gradient border effect - consistent edge highlight using stroke
const GradientCard = ({ centerColor, width, height, borderRadius = 2, children }) => {
  const strokeWidth = 1.5;
  const inset = strokeWidth / 2;

  return (
    <View style={{ width, height, position: 'relative' }}>
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="cardStrokeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.6" />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={width}
          height={height}
          rx={borderRadius}
          ry={borderRadius}
          fill={centerColor}
        />
        <Rect
          x={inset}
          y={inset}
          width={width - strokeWidth}
          height={height - strokeWidth}
          rx={borderRadius - 1}
          ry={borderRadius - 1}
          fill="none"
          stroke="url(#cardStrokeGrad)"
          strokeWidth={strokeWidth}
        />
      </Svg>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>{children}</View>
    </View>
  );
};

// Hold button with gradient border effect
const GradientButton = ({ centerColor, width, height, borderRadius = 4, children, style }) => {
  const strokeWidth = 2;
  const inset = strokeWidth / 2;

  return (
    <View style={[{ width, height, position: 'relative' }, style]}>
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="buttonStrokeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.5" />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={width}
          height={height}
          rx={borderRadius}
          ry={borderRadius}
          fill={centerColor}
        />
        <Rect
          x={inset}
          y={inset}
          width={width - strokeWidth}
          height={height - strokeWidth}
          rx={borderRadius - 1}
          ry={borderRadius - 1}
          fill="none"
          stroke="url(#buttonStrokeGrad)"
          strokeWidth={strokeWidth}
        />
      </Svg>
      {children}
    </View>
  );
};

const SHEET_HEIGHT = 320; // Increased height for new button design

// Card dimensions for darkroom card stack (matching CameraScreen)
const CARD_WIDTH = 63;
const CARD_HEIGHT = 84;

// Base fanning values (at rest state)
const BASE_ROTATION_PER_CARD = 6;
const BASE_OFFSET_PER_CARD = 5;

// Hold duration - 1.6 seconds (1.25x faster than original 2 seconds)
const HOLD_DURATION = 1600;

// Spinner chase durations (snappy retro timing)
const SPINNER_NORMAL_DURATION = 1200;
const SPINNER_FAST_DURATION = 400; // 3x faster during hold

// XP Power Charge Bar configuration
const NUM_SEGMENTS = 10;
const SEGMENT_GAP = 3;
const CHARGE_COLORS = [
  colors.retro.chargeCyan,
  colors.retro.chargeGold,
  colors.retro.chargeAmber,
  colors.retro.chargeMagenta,
];

// Pixel block chase spinner configuration
const NUM_BLOCKS = 8;
const BLOCK_POSITIONS = [
  { left: 10, top: 0 }, // top-center
  { left: 20, top: 0 }, // top-right
  { left: 20, top: 10 }, // right-center
  { left: 20, top: 20 }, // bottom-right
  { left: 10, top: 20 }, // bottom-center
  { left: 0, top: 20 }, // bottom-left
  { left: 0, top: 10 }, // left-center
  { left: 0, top: 0 }, // top-left
];

const getBlockOpacity = (animationPhase, blockIndex) => {
  const inputRange = [];
  const outputRange = [];

  for (let step = 0; step <= NUM_BLOCKS; step++) {
    inputRange.push(step / NUM_BLOCKS);
    const activeBlock = step % NUM_BLOCKS;
    const behind = (activeBlock - blockIndex + NUM_BLOCKS) % NUM_BLOCKS;

    let opacity;
    if (behind === 0) opacity = 1.0;
    else if (behind === 1) opacity = 0.5;
    else if (behind === 2) opacity = 0.25;
    else opacity = 0.1;

    outputRange.push(opacity);
  }

  return animationPhase.interpolate({
    inputRange,
    outputRange,
    extrapolate: 'clamp',
  });
};

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
  sheetBackground: colors.background.secondary, // '#111111'
  textPrimary: colors.text.primary, // '#FFFFFF'
  textSecondary: colors.text.secondary, // '#888888'
  statusReady: colors.status.ready, // '#22C55E'
  statusDeveloping: colors.status.developing, // '#EF4444'
  cardBackground: colors.background.tertiary, // '#2A2A2A'
  cardBorder: colors.overlay.light, // rgba(255, 255, 255, 0.1)
  overlayDark: colors.overlay.dark, // rgba(0, 0, 0, 0.5)
  // Gradient colors from design tokens
  buttonGradientStart: colors.brand.gradient.button[0], // '#4C1D95'
  buttonGradientEnd: colors.brand.gradient.button[1], // '#7C3AED'
  fillGradientStart: colors.brand.gradient.fill[0], // '#6B21A8'
  fillGradientEnd: colors.brand.gradient.fill[1], // '#A855F7'
  // Hold button: purple anticipation → pink payoff
  buttonBase: colors.brand.gradient.revealed[0], // '#A855F7' (lighter purple)
  buttonFill: colors.brand.gradient.revealed[1], // '#F472B6' (pink)
};

// Spinner: retro pixel block chase around static play triangle
const SpinnerIcon = ({ animationPhase, color = COLORS.textPrimary, blockColor }) => {
  // Memoize interpolation objects so they are not recreated each render
  const blockOpacities = useRef(
    BLOCK_POSITIONS.map((_, index) => getBlockOpacity(animationPhase, index))
  ).current;

  return (
    <View style={styles.spinnerOuter}>
      {BLOCK_POSITIONS.map((pos, index) => (
        <Animated.View
          key={index}
          style={[
            styles.pixelBlock,
            {
              left: pos.left,
              top: pos.top,
              opacity: blockOpacities[index],
            },
            blockColor && { backgroundColor: blockColor },
            Platform.OS === 'ios' && [
              styles.pixelBlockGlow,
              blockColor && { shadowColor: blockColor },
            ],
          ]}
        />
      ))}
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

  // Charge bar segment tracking
  const segmentScales = useRef(
    Array.from({ length: NUM_SEGMENTS }, () => new Animated.Value(0))
  ).current;
  const lastActiveCount = useRef(0);
  const currentPhaseRef = useRef(0);
  const [phaseColor, setPhaseColor] = useState(CHARGE_COLORS[0]);
  const progressPollRef = useRef(null);

  // Completion flash + ready text
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const readyScale = useRef(new Animated.Value(0)).current;

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
      if (progressPollRef.current) {
        clearInterval(progressPollRef.current);
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
      if (progressPollRef.current) {
        clearInterval(progressPollRef.current);
        progressPollRef.current = null;
      }
      // Reset charge bar
      segmentScales.forEach(s => s.setValue(0));
      lastActiveCount.current = 0;
      currentPhaseRef.current = 0;
      setPhaseColor(CHARGE_COLORS[0]);
      flashOpacity.setValue(0);
      readyScale.setValue(0);
    }
  }, [visible, progressValue]);

  // Unified progress tracking — drives segment pops, phase colors, and crescendo haptics
  const startProgressTracking = () => {
    lastActiveCount.current = 0;
    currentPhaseRef.current = 0;
    lastHapticTimeRef.current = Date.now();
    setPhaseColor(CHARGE_COLORS[0]);

    if (progressPollRef.current) {
      clearInterval(progressPollRef.current);
    }

    progressPollRef.current = setInterval(() => {
      progressValue.addListener(({ value }) => {
        progressValue.removeAllListeners();

        // 1. Segment pop tracking
        const activeCount = Math.min(
          value >= 1 ? NUM_SEGMENTS : Math.floor(value * NUM_SEGMENTS),
          NUM_SEGMENTS
        );

        if (activeCount > lastActiveCount.current) {
          for (let i = lastActiveCount.current; i < activeCount; i++) {
            Animated.spring(segmentScales[i], {
              toValue: 1,
              tension: 300,
              friction: 10,
              useNativeDriver: true,
            }).start();
          }
          lastActiveCount.current = activeCount;
        }

        // 2. Phase color (only update on change to limit re-renders)
        let newPhaseIndex = 0;
        if (value >= 0.75) newPhaseIndex = 3;
        else if (value >= 0.5) newPhaseIndex = 2;
        else if (value >= 0.25) newPhaseIndex = 1;

        if (newPhaseIndex !== currentPhaseRef.current) {
          currentPhaseRef.current = newPhaseIndex;
          setPhaseColor(CHARGE_COLORS[newPhaseIndex]);
        }

        // 3. Crescendo haptics
        const now = Date.now();
        let config;
        if (value < 0.25) config = HAPTIC_CONFIG.phase1;
        else if (value < 0.5) config = HAPTIC_CONFIG.phase2;
        else if (value < 0.75) config = HAPTIC_CONFIG.phase3;
        else config = HAPTIC_CONFIG.phase4;

        if (now - lastHapticTimeRef.current >= config.interval) {
          try {
            Haptics.impactAsync(config.style);
            lastHapticTimeRef.current = now;
          } catch (error) {
            logger.debug('DarkroomBottomSheet: Haptic failed', error);
          }
        }
      });
    }, 50);
  };

  const stopProgressTracking = () => {
    if (progressPollRef.current) {
      clearInterval(progressPollRef.current);
      progressPollRef.current = null;
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

    // Start unified progress tracking (segments + haptics)
    startProgressTracking();

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

        // Stop progress tracking
        stopProgressTracking();

        // Force-fill all segments (polling may miss the final one at value=1.0)
        segmentScales.forEach(s => {
          s.stopAnimation();
          s.setValue(1);
        });
        lastActiveCount.current = NUM_SEGMENTS;

        // Final success haptic
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          logger.debug('DarkroomBottomSheet: Completion haptic failed', error);
        }

        // Completion flash animation
        Animated.sequence([
          Animated.timing(flashOpacity, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(flashOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();

        // READY! text bounce
        readyScale.setValue(0);
        Animated.spring(readyScale, {
          toValue: 1,
          tension: 300,
          friction: 10,
          useNativeDriver: true,
        }).start();

        // Delay to show completion, then reset
        setTimeout(() => {
          setIsPressing(false);
          progressValue.setValue(0);
          flashOpacity.setValue(0);
          readyScale.setValue(0);
          segmentScales.forEach(s => s.setValue(0));
          lastActiveCount.current = 0;
          currentPhaseRef.current = 0;
          setPhaseColor(CHARGE_COLORS[0]);
          startSpinnerAnimation(false);
          if (onComplete) {
            onComplete();
          }
        }, 500);
      }
    });
  };

  const handlePressOut = () => {
    if (!isPressing) return;

    logger.debug('DarkroomBottomSheet: Press released before completion');

    // Stop progress tracking
    stopProgressTracking();

    // Stop current animation
    if (progressAnimation.current) {
      progressAnimation.current.stop();
    }

    // Spring back progress to 0
    Animated.spring(progressValue, {
      toValue: 0,
      tension: 50,
      friction: 7,
      useNativeDriver: false,
    }).start();

    // Spring back segments
    segmentScales.forEach((scale, index) => {
      if (index < lastActiveCount.current) {
        Animated.spring(scale, {
          toValue: 0,
          tension: 200,
          friction: 15,
          useNativeDriver: true,
        }).start();
      }
    });
    lastActiveCount.current = 0;
    currentPhaseRef.current = 0;
    setPhaseColor(CHARGE_COLORS[0]);

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
            styles.cardStackCardWrapper,
            {
              position: 'absolute',
              transform: [{ rotate: `${baseRotation}deg` }, { translateX: baseOffset }],
              zIndex: i + 1,
            },
          ]}
        >
          <GradientCard
            centerColor={
              hasRevealedPhotos ? colors.interactive.primaryPressed : colors.status.developing
            }
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            borderRadius={2}
          >
            {isTopCard && (
              <Text style={styles.cardStackText}>{totalCount > 99 ? '99+' : totalCount}</Text>
            )}
          </GradientCard>
        </View>
      );
    }

    return cards;
  };

  // Get status dot color and text
  const getStatusInfo = () => {
    if (hasRevealedPhotos) {
      const photoWord = totalCount === 1 ? 'photo' : 'photos';
      return {
        color: COLORS.statusReady,
        text: `${totalCount} ${photoWord} ready to reveal`,
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
              {/* Purple button with gradient border */}
              <GradientButton
                centerColor={COLORS.buttonGradientEnd}
                width={SCREEN_WIDTH - 48}
                height={64}
                borderRadius={4}
                style={styles.holdButtonBase}
              >
                {/* XP Power Charge Bar — segmented RPG meter */}
                <View style={styles.fillContainer}>
                  <View style={styles.segmentRow}>
                    {segmentScales.map((scale, index) => (
                      <View key={index} style={styles.segmentSlot}>
                        <View style={styles.segmentEmpty} />
                        <Animated.View
                          style={[
                            styles.segmentFill,
                            {
                              backgroundColor: phaseColor,
                              transform: [{ scale }],
                            },
                            Platform.OS === 'ios' && {
                              shadowColor: phaseColor,
                              shadowOffset: { width: 0, height: 0 },
                              shadowOpacity: 0.8,
                              shadowRadius: 3,
                            },
                          ]}
                        />
                      </View>
                    ))}
                  </View>
                </View>

                {/* Completion flash */}
                <Animated.View
                  style={[styles.completionFlash, { opacity: flashOpacity }]}
                  pointerEvents="none"
                />

                {/* READY! text */}
                <Animated.View
                  style={[styles.readyContainer, { transform: [{ scale: readyScale }] }]}
                  pointerEvents="none"
                >
                  <Text style={styles.readyText}>READY!</Text>
                </Animated.View>

                {/* Button content */}
                <View style={styles.holdButtonContent}>
                  <SpinnerIcon
                    animationPhase={spinnerRotation}
                    blockColor={isPressing ? phaseColor : undefined}
                  />
                  <Text style={styles.holdButtonText}>
                    {isPressing ? 'Revealing...' : 'Hold to reveal photos'}
                  </Text>
                </View>
              </GradientButton>
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
    backgroundColor: COLORS.overlayDark,
  },
  sheet: {
    backgroundColor: COLORS.sheetBackground,
    borderTopLeftRadius: layout.borderRadius.xl,
    borderTopRightRadius: layout.borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxxl : spacing.xl,
  },
  // Header row - flex row with title/status left, cards right
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  titleText: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.display,
    color: COLORS.textPrimary,
    marginRight: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: COLORS.textSecondary,
  },
  // Card stack container
  cardStackContainer: {
    width: CARD_WIDTH + 40,
    height: CARD_HEIGHT + 32,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  cardStackCardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: layout.borderRadius.sm,
    // White glow effect emanating from card edges
    shadowColor: colors.text.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  cardStackText: {
    color: COLORS.textPrimary,
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
  },
  // Hold button
  holdButtonContainer: {
    width: '100%',
    marginTop: spacing.md,
    borderRadius: layout.borderRadius.md,
    overflow: 'hidden',
  },
  holdButtonBase: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fillContainer: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 2,
    overflow: 'hidden',
  },
  // Charge bar segments
  segmentRow: {
    flexDirection: 'row',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    gap: SEGMENT_GAP,
  },
  segmentSlot: {
    flex: 1,
  },
  segmentEmpty: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: colors.retro.segmentBorder,
    borderRadius: 1,
  },
  segmentFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 1,
  },
  // Completion flash overlay
  completionFlash: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    backgroundColor: colors.retro.completionFlash,
    borderRadius: 2,
    zIndex: 10,
  },
  // READY! text overlay
  readyContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 11,
    backgroundColor: colors.retro.readyBackground,
    borderRadius: layout.borderRadius.md,
  },
  readyText: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.display,
    color: colors.retro.readyText,
    textShadowColor: colors.retro.readyText,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  holdButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  holdButtonText: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.bodyBold,
    color: COLORS.textPrimary,
    marginLeft: spacing.sm,
  },
  // Spinner - retro pixel block chase
  spinnerOuter: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pixelBlock: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 0,
    backgroundColor: colors.interactive.primary, // '#00D4FF' electric cyan
  },
  pixelBlockGlow: {
    shadowColor: colors.interactive.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
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
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: spacing.md,
  },
});

export default DarkroomBottomSheet;
