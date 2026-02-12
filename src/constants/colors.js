/**
 * Rewind App Color System — 16-Bit Retro Edition
 * ================================================
 * CRT-inspired dark theme with neon pixel accents.
 * Deep indigo backgrounds evoke vintage monitors,
 * electric cyan/magenta/green accents channel SNES-era palettes.
 *
 * COLOR HIERARCHY:
 * - background.primary (#0A0A1A): CRT navy-black - all screen backgrounds
 * - background.secondary/card (#161628): Dark indigo panel for content blocks
 * - background.tertiary (#252540): Elevated surface for nested elements
 *
 * ACCENT USAGE:
 * - brand.purple (cyan): Interactive elements (buttons, toggles) AND highlights
 * - Icons: Use icon.* colors (phosphor white/gray), NOT accent
 *
 * TEXT HIERARCHY:
 * - text.primary: CRT phosphor white
 * - text.secondary: Muted pixel gray-blue
 * - text.tertiary: Dim helper text
 */

export const colors = {
  // Backgrounds - CRT navy-black base with indigo lift for content
  background: {
    primary: '#0A0A1A', // CRT navy-black (all screens)
    secondary: '#161628', // Dark indigo panel (cards, content blocks)
    tertiary: '#252540', // Elevated surface (nested elements)
    card: '#161628', // Alias for secondary - explicit card usage
    white: '#E0E0F0', // Light backgrounds (rare - phosphor white)
    offWhite: '#0A0A1A', // Deprecated - use primary
  },

  // Text - CRT phosphor hierarchy for dark theme
  text: {
    primary: '#E0E0F0', // CRT phosphor white
    secondary: '#7B7B9E', // Muted pixel gray-blue
    tertiary: '#4D4D6A', // Dim helper text
    inverse: '#0A0A1A', // Text on light backgrounds
  },

  // Icons - Phosphor white hierarchy
  icon: {
    primary: '#E0E0F0', // Default icon color (phosphor white)
    secondary: '#7B7B9E', // Muted icons
    tertiary: '#4D4D6A', // Very muted icons
    inactive: '#3D3D5C', // Inactive/disabled icons
  },

  // Borders - Indigo tones on CRT black
  border: {
    default: '#353555', // Standard border (retro indigo)
    subtle: '#1E1E35', // Subtle dark border
  },

  // Interactive - Button/control states (uses electric cyan)
  interactive: {
    primary: '#00D4FF', // Electric cyan - primary actions
    primaryPressed: '#00A3CC', // Pressed cyan (darker)
    secondary: '#252540', // Secondary buttons (elevated surface)
    secondaryPressed: '#353555', // Secondary pressed state
  },

  // Status - Retro feedback colors
  status: {
    ready: '#39FF14', // Neon green - ready/success
    developing: '#FF8C00', // Retro amber - developing state
    danger: '#FF3333', // Pixel red - danger/delete actions
    dangerHover: '#FF6666', // Lighter red for hover/active danger states
  },

  // Brand - 16-Bit Neon palette
  brand: {
    coral: '#FF6B6B', // Legacy - keep for backwards compatibility
    purple: '#00D4FF', // Electric cyan (primary accent)
    pink: '#FF2D78', // Hot magenta (secondary accent)
    teal: '#39FF14', // Neon green (tertiary)
    lime: '#FFD700', // Coin gold (accent)
    gradient: {
      developing: ['#FF2D78', '#B24BF3', '#FF2D78'], // Magenta → Purple → Magenta
      revealed: ['#00D4FF', '#B24BF3', '#00D4FF'], // Cyan → Purple → Cyan
      button: ['#0A2463', '#1E3A8A'], // Deep navy gradient
      fill: ['#00D4FF', '#00A3CC'], // Cyan fill gradient
    },
  },

  // System
  system: {
    iosRed: '#FF3333', // Retro red notification badge
    blue: '#00D4FF', // Cyan for links, reactions
  },

  // Overlays - CRT-tinted transparencies
  overlay: {
    dark: 'rgba(10, 10, 26, 0.7)',
    darker: 'rgba(10, 10, 26, 0.95)', // Heavy overlay for modals
    light: 'rgba(224, 224, 240, 0.1)',
    lightMedium: 'rgba(224, 224, 240, 0.3)', // Progress bars, inactive states
    lightBorder: 'rgba(224, 224, 240, 0.2)', // Semi-transparent borders
    purpleTint: 'rgba(0, 212, 255, 0.15)', // Cyan highlight tint for reactions
  },

  // Interactive element backgrounds (pills, chips, input backgrounds)
  pill: {
    background: '#252540', // Retro pill background
    border: '#353555', // Retro pill border
  },

  // System colors (retro-mapped)
  systemColors: {
    gray: '#7B7B9E', // Muted pixel gray (archive)
    green: '#39FF14', // Neon green (journal/confirm)
  },

  // Polaroid frame styling (retro card frames)
  polaroid: {
    // Dark indigo - blends with retro theme
    dark: '#1E1E35',
    darkShadow: 'rgba(0, 212, 255, 0.1)', // Cyan glow shadow

    // Text on dark Polaroid
    textLight: '#E0E0F0',
    textLightSecondary: '#7B7B9E',

    // Legacy light options (kept for reference)
    cream: '#1E1E35',
    warmGray: '#252540',
    muted: '#353555',
    text: '#E0E0F0',
    textSecondary: '#7B7B9E',
  },

  // Retro animation palette — charge bars, dissolves, wipes
  retro: {
    chargeCyan: '#00D4FF', // Phase 1 (0-25%) — electric cyan
    chargeGold: '#FFD700', // Phase 2 (25-50%) — coin gold
    chargeAmber: '#FF8C00', // Phase 3 (50-75%) — retro amber
    chargeMagenta: '#FF2D78', // Phase 4 (75-100%) — hot magenta
    completionFlash: '#FFFFFF', // Full-bar white flash
    readyText: '#FF2D78', // "READY!" text (matches final phase)
    readyBackground: '#FFFFFF', // "READY!" backdrop
    segmentBorder: 'rgba(255, 255, 255, 0.15)', // Empty segment outline
  },

  // Story card styling (retro mini-cards)
  storyCard: {
    frame: '#1E1E35', // Dark indigo frame
    glowViewed: '#252540', // Subtle glow when viewed
    textName: '#E0E0F0', // Phosphor white name text
    gradientUnviewed: ['#00D4FF', '#FF8C00', '#00D4FF'], // Cyan → Amber → Cyan
  },
};
