/**
 * AnimatedSplash - Camera shutter opening animation
 *
 * Creates a memorable launch experience with 6 aperture blades
 * opening to reveal the app, matching the Oly icon design.
 *
 * Animation: Blades start covering the screen (closed aperture)
 * and scale/rotate outward to reveal the app behind.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Match the brand colors from the icon
const APERTURE_COLOR = '#FF6B6B'; // Coral
const BACKGROUND_COLOR = '#FAFAFA'; // Off-white (matches splash background)

// Animation timing
const ANIMATION_DURATION = 800; // ms
const FADE_OUT_DURATION = 300; // ms after shutter opens

// Number of aperture blades (matches icon design)
const NUM_BLADES = 6;

/**
 * Single animated blade - triangular wedge
 */
const ApertureBlade = ({ index, openProgress }) => {
  const screenSize = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT) * 1.5;
  const anglePerBlade = 360 / NUM_BLADES;
  const rotation = (index * anglePerBlade) - 90; // Start from top

  const animatedStyle = useAnimatedStyle(() => {
    // As openProgress goes 0→1:
    // - Blades translate outward from center
    // - Blades rotate slightly to open the shutter
    const translateDistance = interpolate(
      openProgress.value,
      [0, 1],
      [0, screenSize * 0.6]
    );
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
        }
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

  useEffect(() => {
    // Start the shutter opening animation
    openProgress.value = withTiming(1, {
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
    });

    // After opening, fade out the entire overlay
    opacity.value = withDelay(
      ANIMATION_DURATION,
      withTiming(0, { duration: FADE_OUT_DURATION }, (finished) => {
        if (finished && onAnimationComplete) {
          runOnJS(onAnimationComplete)();
        }
      })
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={styles.background}>
        <View style={styles.shutterContainer}>
          {Array.from({ length: NUM_BLADES }).map((_, index) => (
            <ApertureBlade
              key={index}
              index={index}
              openProgress={openProgress}
            />
          ))}
        </View>
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
