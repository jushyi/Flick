export const colors = {
  // Backgrounds
  background: {
    primary: '#0F0F0F', // Main app background (near-black)
    secondary: '#1A1A1A', // Sheet/card background (dark gray)
    tertiary: '#2A2A2A', // Nested card background
    white: '#FFFFFF', // Light backgrounds
    offWhite: '#0F0F0F', // Deprecated - use primary
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
    developing: '#EF4444', // Red - developing state (status dot color)
    danger: '#FF4444', // Danger/delete actions
  },

  // Brand - Rewind palette
  brand: {
    coral: '#FF6B6B', // Legacy - keep for backwards compatibility
    purple: '#8B5CF6', // Primary accent (Tailwind violet-500)
    pink: '#EC4899', // Secondary accent (Tailwind pink-500)
    teal: '#14B8A6', // Tertiary - minimal use (Tailwind teal-500)
    lime: '#84CC16', // Accent - minimal use (Tailwind lime-500)
    gradient: {
      developing: ['#8B5CF6', '#EC4899'], // Purple-heavy (start purple)
      revealed: ['#A855F7', '#F472B6'], // Pink-heavy (lighter tones)
      button: ['#4C1D95', '#7C3AED'], // Dark purple gradient
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

  // Polaroid frame styling
  polaroid: {
    // Full contrast - bright cream on dark background
    cream: '#FAF8F5',
    creamShadow: 'rgba(250, 248, 245, 0.15)',

    // Softened - warm gray that blends more
    warmGray: '#E8E4E0',
    warmGrayShadow: 'rgba(232, 228, 224, 0.12)',

    // Muted - darker off-white for subtle effect
    muted: '#D4D0CC',
    mutedShadow: 'rgba(212, 208, 204, 0.10)',

    // Text on Polaroid (handwriting feel)
    text: '#2A2A2A',
    textSecondary: '#5A5A5A',
  },
};
