/**
 * AnimatedSplash - CRT Boot Sequence Animation
 *
 * 4-phase retro TV power-on experience:
 * 1. CRT power-on: bright horizontal line expands to fill screen
 * 2. Text reveal: "FLICK" flickers in with PressStart2P font
 * 3. Blur-to-focus: lens focus transition
 * 4. Fade out: overlay dissolves to reveal the app
 */
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

// Phase timing (ms)
const CRT_LINE_DURATION = 200; // Phase 1: line expand
const TEXT_REVEAL_DELAY = CRT_LINE_DURATION;
const TEXT_REVEAL_DURATION = 200; // Phase 2: text flicker
const BLUR_DELAY = TEXT_REVEAL_DELAY + TEXT_REVEAL_DURATION;
const BLUR_DURATION = 300; // Phase 3: blur-to-focus
const FADE_DELAY = BLUR_DELAY + BLUR_DURATION;
const FADE_DURATION = 150; // Phase 4: fade out

// Create animated BlurView component
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

/**
 * Animated splash screen with CRT boot sequence
 */
const AnimatedSplash = ({ onAnimationComplete, fontsLoaded }) => {
  const { height: screenHeight } = useWindowDimensions();
  const opacity = useSharedValue(1);
  const blurIntensity = useSharedValue(80);
  const lineHeight = useSharedValue(2);
  const textOpacity = useSharedValue(0);
  const [showBlur, setShowBlur] = useState(true);
  const [showLine, setShowLine] = useState(true);

  useEffect(() => {
    // Phase 1: CRT power-on line — thin horizontal line expands to full screen
    lineHeight.value = withTiming(
      screenHeight,
      {
        duration: CRT_LINE_DURATION,
        easing: Easing.out(Easing.quad),
      },
      finished => {
        if (finished) {
          runOnJS(setShowLine)(false);
        }
      }
    );

    // Phase 2: "FLICK" text flicker (only if fonts are loaded)
    textOpacity.value = withDelay(
      TEXT_REVEAL_DELAY,
      withSequence(
        withTiming(1, { duration: 50 }), // flash on
        withTiming(0.4, { duration: 40 }), // flicker dim
        withTiming(1, { duration: 60 }), // back to full
        withTiming(0.6, { duration: 30 }), // slight flicker
        withTiming(1, { duration: 20 }) // settle
      )
    );

    // Phase 3: Blur-to-focus
    blurIntensity.value = withDelay(
      BLUR_DELAY,
      withTiming(0, { duration: BLUR_DURATION }, finished => {
        if (finished) {
          runOnJS(setShowBlur)(false);
        }
      })
    );

    // Phase 4: Fade out entire overlay
    opacity.value = withDelay(
      FADE_DELAY,
      withTiming(0, { duration: FADE_DURATION }, finished => {
        if (finished && onAnimationComplete) {
          runOnJS(onAnimationComplete)();
        }
      })
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const lineStyle = useAnimatedStyle(() => ({
    height: lineHeight.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const blurAnimatedProps = useAnimatedProps(() => ({
    intensity: blurIntensity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* CRT power-on line */}
      {showLine && <Animated.View style={[styles.crtLine, lineStyle]} />}

      {/* FLICK text (only render when fonts are available) */}
      {fontsLoaded && (
        <Animated.View style={[styles.textContainer, textStyle]}>
          <Text style={styles.flickText}>FLICK</Text>
        </Animated.View>
      )}

      {/* Blur overlay */}
      {showBlur && (
        <AnimatedBlurView
          style={StyleSheet.absoluteFill}
          tint="dark"
          {...(Platform.OS === 'ios' ? { experimentalBlurMethod: 'blur' } : {})}
          animatedProps={blurAnimatedProps}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crtLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.interactive.primary,
    opacity: 0.8,
  },
  textContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flickText: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.xxl,
    color: colors.interactive.primary,
    letterSpacing: 4,
  },
});

export default AnimatedSplash;
