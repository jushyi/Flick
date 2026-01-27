/**
 * AnimatedSplash - Blur-to-focus lens animation
 *
 * Creates a launch experience with a camera lens finding focus,
 * transitioning from blurry to sharp to reveal the app.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { animations } from '../constants/animations';

// Animation timing - twice as fast as original
const BLUR_DURATION = (animations.STARTUP?.BLUR_DURATION || 600) / 2; // 300ms
const FADE_OUT_DURATION = (animations.STARTUP?.FADE_OUT_DURATION || 300) / 2; // 150ms

// Create animated BlurView component
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

/**
 * Animated splash screen with blur-to-focus effect
 */
const AnimatedSplash = ({ onAnimationComplete }) => {
  const opacity = useSharedValue(1);
  const blurIntensity = useSharedValue(80);
  const [showBlur, setShowBlur] = useState(true);

  useEffect(() => {
    // 1. Animate blur from 80 → 0 (lens finding focus)
    blurIntensity.value = withTiming(0, { duration: BLUR_DURATION }, finished => {
      if (finished) {
        runOnJS(setShowBlur)(false);
      }
    });

    // 2. After blur clears, fade out the entire overlay
    opacity.value = withDelay(
      BLUR_DURATION,
      withTiming(0, { duration: FADE_OUT_DURATION }, finished => {
        if (finished && onAnimationComplete) {
          runOnJS(onAnimationComplete)();
        }
      })
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const blurAnimatedProps = useAnimatedProps(() => ({
    intensity: blurIntensity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {showBlur && (
        <AnimatedBlurView
          style={StyleSheet.absoluteFill}
          tint="dark"
          experimentalBlurMethod="blur"
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
  },
});

export default AnimatedSplash;
