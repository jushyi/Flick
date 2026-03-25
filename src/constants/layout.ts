import { Platform } from 'react-native';

export const layout = {
  borderRadius: {
    xs: 0,
    sm: 2,
    md: 4,
    lg: 4,
    xl: 6,
    round: 9999,
    full: 9999,
  },

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
    cameraBorderRadius: 6,
  },

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

  zIndex: {
    base: 1,
    dropdown: 5,
    overlay: 100,
    modal: 1000,
    splash: 9999,
  },
} as const;
