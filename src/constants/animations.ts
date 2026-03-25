export const animations = {
  duration: {
    instant: 50,
    fast: 80,
    normal: 150,
    slow: 250,
    slower: 800,
    hold: 1600,
  },

  easing: {
    standard: 'ease-in-out',
    accelerate: 'ease-in',
    decelerate: 'ease-out',
  },

  STARTUP: {
    SHUTTER_DURATION: 800,
    BLUR_DELAY: 200,
    BLUR_DURATION: 600,
    FADE_OUT_DURATION: 300,
  },
} as const;
