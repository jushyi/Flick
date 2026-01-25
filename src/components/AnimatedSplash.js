/**
 * AnimatedSplash - Camera shutter opening animation
 *
 * Creates a memorable launch experience with 6 aperture blades
 * opening to reveal the app, matching the Rewind icon design.
 *
 * Animation sequence:
 * 1. Shutter opens (blades scale/rotate outward)
 * 2. Blur-to-focus effect (lens finding clarity)
 * 3. Fade out to main app
 */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { colors } from '../constants/colors';
import { animations } from '../constants/animations';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Black blades on transparent background to reveal camera behind
const APERTURE_COLOR = '#000000'; // Pure black for camera shutter blades
const BACKGROUND_COLOR = 'transparent'; // Transparent to show camera view

// Animation timing from design tokens
const ANIMATION_DURATION = animations.STARTUP?.SHUTTER_DURATION || 800;
const BLUR_DELAY = animations.STARTUP?.BLUR_DELAY || 200;
const BLUR_DURATION = animations.STARTUP?.BLUR_DURATION || 600;
const FADE_OUT_DURATION = animations.STARTUP?.FADE_OUT_DURATION || 300;

// Create animated BlurView component
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

// Number of aperture blades (matches icon design)
const NUM_BLADES = 6;

/**
 * Single animated blade - triangular wedge
 */
const ApertureBlade = ({ index, openProgress }) => {
  const screenSize = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT) * 1.5;
  const anglePerBlade = 360 / NUM_BLADES;
  const rotation = index * anglePerBlade - 90; // Start from top

  const animatedStyle = useAnimatedStyle(() => {
    // As openProgress goes 0→1:
    // - Blades translate outward from center
    // - Blades rotate slightly to open the shutter
    const translateDistance = interpolate(openProgress.value, [0, 1], [0, screenSize * 0.6]);
    const bladeRotation = interpolate(
      openProgress.value,
      [0, 1],
      [0, -45] // Rotate blades as they move out
    );
    const scale = interpolate(
      openProgress.value,
      [0, 1],
      [1, 0.5] // Shrink blades as they move out
    );

    return {
      transform: [
        { rotate: `${rotation}deg` },
        { translateY: -translateDistance },
        { rotate: `${bladeRotation}deg` },
        { scale },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.blade,
        animatedStyle,
        {
          width: screenSize,
          height: screenSize,
        },
      ]}
    >
      {/* Blade shape - triangle pointing toward center */}
      <View style={styles.bladeShape}>
        <View style={[styles.bladeTriangle, { borderBottomWidth: screenSize * 0.5 }]} />
      </View>
    </Animated.View>
  );
};

/**
 * Full animated splash screen
 */
const AnimatedSplash = ({ onAnimationComplete }) => {
  const openProgress = useSharedValue(0);
  const opacity = useSharedValue(1);
  const blurIntensity = useSharedValue(80);
  const [showBlur, setShowBlur] = useState(true);

  useEffect(() => {
    // 1. Start the shutter opening animation
    openProgress.value = withTiming(1, {
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
    });

    // 2. After shutter opens, animate blur from 80 → 0 (lens finding focus)
    blurIntensity.value = withDelay(
      ANIMATION_DURATION + BLUR_DELAY,
      withTiming(0, { duration: BLUR_DURATION }, finished => {
        if (finished) {
          runOnJS(setShowBlur)(false);
        }
      })
    );

    // 3. After blur clears, fade out the entire overlay
    const totalDelay = ANIMATION_DURATION + BLUR_DELAY + BLUR_DURATION;
    opacity.value = withDelay(
      totalDelay,
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
      <View style={styles.background}>
        <View style={styles.shutterContainer}>
          {Array.from({ length: NUM_BLADES }).map((_, index) => (
            <ApertureBlade key={index} index={index} openProgress={openProgress} />
          ))}
        </View>
        {/* Blur overlay - animates from blurry to clear after shutter opens */}
        {showBlur && (
          <AnimatedBlurView
            style={StyleSheet.absoluteFill}
            tint="dark"
            experimentalBlurMethod="blur"
            animatedProps={blurAnimatedProps}
          />
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  background: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  shutterContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blade: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  bladeShape: {
    alignItems: 'center',
  },
  bladeTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 80,
    borderRightWidth: 80,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: APERTURE_COLOR,
  },
});

export default AnimatedSplash;
