export const colors = {
  // Backgrounds
  background: {
    primary: '#000000', // Main app background (black)
    secondary: '#1A1A1A', // Sheet/card background (dark gray)
    tertiary: '#2A2A2A', // Nested card background
    white: '#FFFFFF', // Light backgrounds
    offWhite: '#FAFAFA', // Subtle off-white
  },

  // Text
  text: {
    primary: '#FFFFFF', // Main text on dark
    secondary: '#888888', // Muted text
    tertiary: '#666666', // Even more muted
    inverse: '#000000', // Text on light backgrounds
  },

  // Borders
  border: {
    default: '#E0E0E0', // Standard border
    subtle: '#333333', // Dark theme borders
  },

  // Status
  status: {
    ready: '#22C55E', // Green - ready state
    developing: '#EF4444', // Red - developing state
    danger: '#FF4444', // Danger/delete actions
  },

  // Brand
  brand: {
    coral: '#FF6B6B', // Aperture/brand color
    purple: {
      gradient: ['#4C1D95', '#7C3AED'], // Purple gradient
      fill: ['#6B21A8', '#A855F7'], // Purple fill gradient
    },
  },

  // System
  system: {
    iosRed: '#FF3B30', // iOS notification badge red
    blue: '#2196F3', // Links, reactions
  },

  // Overlays
  overlay: {
    dark: 'rgba(0, 0, 0, 0.5)',
    light: 'rgba(255, 255, 255, 0.1)',
  },
};
