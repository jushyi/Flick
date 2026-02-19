import { Platform } from 'react-native';

export const layout = {
  // Border radius scale - blocky retro (minimal rounding)
  borderRadius: {
    xs: 0, // Pure pixel sharp
    sm: 2, // Barely rounded
    md: 4, // Slight softening
    lg: 4, // Cards stay blocky
    xl: 6, // Max rounding for containers
    round: 9999, // Circle avatars (photos stay round)
    full: 9999, // Fully round
  },

  // Common dimensions
  dimensions: {
    tabBarHeight: Platform.OS === 'ios' ? 65 : 54,
    footerHeight: 200,
    inputHeight: 52,
    buttonMinHeight: 52,
    avatarSmall: 32,
    avatarMedium: 40,
    avatarLarge: 60,
    avatarXLarge: 80,
    cameraPreviewMargin: 16,
    cameraBorderRadius: 6, // Reduced from 24 for retro blocky feel
  },

  // Shadow presets - CRT glow effect (cyan-tinted)
  shadow: {
    light: {
      shadowColor: '#00D4FF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 3,
    },
    medium: {
      shadowColor: '#00D4FF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 4,
    },
    heavy: {
      shadowColor: '#00D4FF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 6,
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
