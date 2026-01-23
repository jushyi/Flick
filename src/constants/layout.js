export const layout = {
  // Border radius scale
  borderRadius: {
    xs: 4, // Skeleton placeholders
    sm: 8, // Buttons, inputs
    md: 12, // Sections
    lg: 16, // Cards
    xl: 24, // Photo corners, large radius
    round: 30, // Circle avatars (half of 60px)
    full: 9999, // Fully round
  },

  // Common dimensions
  dimensions: {
    tabBarHeight: 65,
    footerHeight: 200,
    inputHeight: 52,
    buttonMinHeight: 52,
    avatarSmall: 32,
    avatarMedium: 40,
    avatarLarge: 60,
    avatarXLarge: 80,
    cameraPreviewMargin: 16,
    cameraBorderRadius: 24,
  },

  // Shadow presets
  shadow: {
    light: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3,
      elevation: 3,
    },
    heavy: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
  },

  // Z-index scale
  zIndex: {
    base: 1,
    dropdown: 5,
    overlay: 100,
    modal: 1000,
    splash: 9999,
  },
};
