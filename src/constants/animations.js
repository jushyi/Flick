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

  // Startup sequence timing (Plan 30-04: Animated Splash Rebrand)
  STARTUP: {
    SHUTTER_DURATION: 800, // ms - aperture opening animation
    BLUR_DELAY: 200, // ms - pause after shutter opens
    BLUR_DURATION: 600, // ms - blur-to-focus transition
    FADE_OUT_DURATION: 300, // ms - final fade to main app
  },
};
