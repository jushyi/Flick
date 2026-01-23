export const animations = {
  // Duration scale (ms)
  duration: {
    instant: 50, // Snap/shake animations
    fast: 100, // Quick feedback
    normal: 300, // Standard transitions
    slow: 350, // Card animations
    slower: 1000, // Skeleton pulse
    hold: 1600, // Hold-to-reveal duration
  },

  // Easing (reference for Reanimated)
  easing: {
    // Note: Import from react-native-reanimated when using
    // These are descriptive names for common easings
    standard: 'ease-in-out',
    accelerate: 'ease-in',
    decelerate: 'ease-out',
  },
};
