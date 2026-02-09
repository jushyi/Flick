/**
 * 16-Bit Retro Typography System
 * ===============================
 * Pixel fonts loaded via expo-font:
 * - PressStart2P: Display/header font (authentic retro pixel, great for titles)
 * - Silkscreen: Body/UI font (cleaner pixel font, readable at smaller sizes)
 */

export const typography = {
  // Font families (loaded in App.js via useFonts)
  fontFamily: {
    display: 'PressStart2P_400Regular', // Headers, titles, hero text
    body: 'Silkscreen_400Regular', // UI text, labels, body
    bodyBold: 'Silkscreen_700Bold', // Bold UI text, buttons
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

  // Pre-composed text styles with pixel fonts
  styles: {
    title: { fontSize: 18, fontFamily: 'PressStart2P_400Regular' },
    subtitle: { fontSize: 14, fontFamily: 'Silkscreen_700Bold' },
    body: { fontSize: 12, fontFamily: 'Silkscreen_400Regular' },
    caption: { fontSize: 10, fontFamily: 'Silkscreen_400Regular' },
    button: { fontSize: 12, fontFamily: 'Silkscreen_700Bold' },
  },
};
