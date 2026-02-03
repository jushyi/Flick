/**
 * Rewind App Color System
 * ========================
 * Single source of truth for all colors in the app.
 *
 * COLOR HIERARCHY:
 * - background.primary (#000000): Pure black - all screen backgrounds
 * - background.secondary/card (#111111): Very subtle lift for content blocks
 * - background.tertiary (#2A2A2A): Nested elements needing more contrast
 *
 * ACCENT USAGE:
 * - brand.purple: Interactive elements (buttons, toggles) AND highlights (selected tabs, focused inputs)
 * - Icons: Use icon.* colors (white/gray), NOT purple
 *
 * TEXT HIERARCHY:
 * - text.primary: Important/main text (white)
 * - text.secondary: Labels/descriptions (gray)
 * - text.tertiary: Very muted helper text
 */

export const colors = {
  // Backgrounds - Pure black base with subtle lift for content
  background: {
    primary: '#000000', // Main app background (pure black - all screens)
    secondary: '#111111', // Content blocks/cards (barely visible lift from black)
    tertiary: '#2A2A2A', // Nested elements needing more contrast
    card: '#111111', // Alias for secondary - explicit card usage
    white: '#FFFFFF', // Light backgrounds (rare)
    offWhite: '#000000', // Deprecated - use primary
  },

  // Text - White hierarchy for dark theme
  text: {
    primary: '#FFFFFF', // Main text on dark
    secondary: '#888888', // Muted text, labels
    tertiary: '#666666', // Very muted helper text
    inverse: '#000000', // Text on light backgrounds
  },

  // Icons - Explicit icon colors (NOT purple - icons stay white/gray)
  icon: {
    primary: '#FFFFFF', // Default icon color
    secondary: '#888888', // Muted icons
    tertiary: '#666666', // Very muted icons
    inactive: '#555555', // Inactive/disabled icons
  },

  // Borders - Subtle on pure black
  border: {
    default: '#E0E0E0', // Standard border (light theme)
    subtle: '#222222', // Dark theme borders (subtler on pure black)
  },

  // Interactive - Button/control states (uses brand purple)
  interactive: {
    primary: '#8B5CF6', // Primary buttons, active tabs, focused inputs
    primaryPressed: '#7C3AED', // Pressed state (darker purple)
    secondary: '#333333', // Secondary buttons
    secondaryPressed: '#444444', // Secondary pressed state
  },

  // Status - Feedback colors
  status: {
    ready: '#22C55E', // Green - ready/success state
    developing: '#EF4444', // Red - developing state (status dot color)
    danger: '#FF3B30', // iOS red - danger/delete actions
    dangerHover: '#FF6666', // Lighter red for hover/active danger states
  },

  // Brand - Rewind palette
  brand: {
    coral: '#FF6B6B', // Legacy - keep for backwards compatibility
    purple: '#8B5CF6', // Primary accent (Tailwind violet-500)
    pink: '#EC4899', // Secondary accent (Tailwind pink-500)
    teal: '#14B8A6', // Tertiary - minimal use (Tailwind teal-500)
    lime: '#84CC16', // Accent - minimal use (Tailwind lime-500)
    gradient: {
      developing: ['#EC4899', '#7C3AED', '#EC4899'], // Pink edges → Purple center → Pink edges
      revealed: ['#8B5CF6', '#DB2777', '#8B5CF6'], // Purple edges → Pink center → Purple edges
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
    darker: 'rgba(0, 0, 0, 0.9)', // Heavy overlay for modals
    light: 'rgba(255, 255, 255, 0.1)',
    lightMedium: 'rgba(255, 255, 255, 0.3)', // Progress bars, inactive states
    lightBorder: 'rgba(255, 255, 255, 0.34)', // Semi-transparent white borders
    purpleTint: 'rgba(147, 112, 219, 0.15)', // Purple highlight tint for reactions
  },

  // Interactive element backgrounds (pills, chips, input backgrounds)
  pill: {
    background: '#3A3A3A', // Emoji pills, interactive elements
    border: '#4A4A4A', // Borders on pills and chips
  },

  // System colors (iOS HIG)
  systemColors: {
    gray: '#8E8E93', // iOS system gray (archive)
    green: '#34C759', // iOS system green (journal/confirm)
  },

  // Polaroid frame styling
  polaroid: {
    // Dark gray - blends with dark theme
    dark: '#2A2A2A',
    darkShadow: 'rgba(0, 0, 0, 0.3)',

    // Text on dark Polaroid
    textLight: '#FFFFFF',
    textLightSecondary: '#A0A0A0',

    // Legacy light options (kept for reference)
    cream: '#FAF8F5',
    warmGray: '#E8E4E0',
    muted: '#D4D0CC',
    text: '#2A2A2A',
    textSecondary: '#5A5A5A',
  },

  // Story card styling (Polaroid mini-cards)
  storyCard: {
    frame: '#2A2A2A', // Dark gray frame (matches dark theme)
    glowViewed: '#3A3A3A', // Subtle gray border when viewed
    textName: '#FFFFFF', // Name text below card
  },
};
