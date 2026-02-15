/**
 * 16-Bit Retro Typography System
 * ===============================
 * Pixel fonts loaded via expo-font:
 * - PressStart2P: Display/header font (authentic retro pixel, great for titles)
 * - Silkscreen: UI font (pixel font for names, buttons, labels)
 * - Space Mono: Readable body font (smooth monospace for comments, descriptions, small text)
 */

export const typography = {
  // Font families (loaded in App.js via useFonts)
  fontFamily: {
    display: 'PressStart2P_400Regular', // Headers, titles, hero text
    body: 'Silkscreen_400Regular', // UI text, names, labels
    bodyBold: 'Silkscreen_700Bold', // Bold UI text, buttons
    readable: 'SpaceMono_400Regular', // Body text, comments, descriptions
    readableBold: 'SpaceMono_700Bold', // Bold body text, emphasis
  },

  // Font sizes (slightly reduced - pixel fonts render visually larger)
  size: {
    xs: 10, // Pixel captions, small labels
    sm: 12, // Body text, labels
    md: 14, // Button text, input text
    lg: 16, // Subheadings
    xl: 18, // Titles
    xxl: 22, // Large headers
    xxxl: 26, // Display text
    display: 30, // Hero text
    giant: 48, // Large display (timer)
  },

  // Font weights (for system font fallback only)
  weight: {
    regular: '400',
    semibold: '600',
    bold: '700',
  },

  // Pre-composed text styles
  styles: {
    title: { fontSize: 18, fontFamily: 'PressStart2P_400Regular' },
    subtitle: { fontSize: 14, fontFamily: 'SpaceMono_700Bold', lineHeight: 20 },
    body: { fontSize: 14, fontFamily: 'SpaceMono_400Regular', lineHeight: 20 },
    caption: { fontSize: 12, fontFamily: 'SpaceMono_400Regular', lineHeight: 18 },
    button: { fontSize: 12, fontFamily: 'Silkscreen_700Bold' },
  },
};
