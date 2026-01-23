export const typography = {
  // Font sizes (most common values from codebase)
  size: {
    xs: 12, // Captions, small labels
    sm: 14, // Body text, labels (most common)
    md: 16, // Button text, input text
    lg: 18, // Subheadings
    xl: 20, // Titles
    xxl: 24, // Large headers
    xxxl: 28, // Display text
    display: 32, // Hero text
    giant: 64, // Large display (timer)
  },

  // Font weights
  weight: {
    regular: '400',
    semibold: '600', // Most common weight
    bold: '700',
  },

  // Pre-composed text styles (optional, for convenience)
  styles: {
    title: { fontSize: 20, fontWeight: '600' },
    body: { fontSize: 14, fontWeight: '400' },
    caption: { fontSize: 12, fontWeight: '400' },
    button: { fontSize: 16, fontWeight: '600' },
  },
};
