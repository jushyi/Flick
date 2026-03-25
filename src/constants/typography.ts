import type { TextStyle } from 'react-native';

export const typography = {
  fontFamily: {
    display: 'PressStart2P_400Regular',
    body: 'Silkscreen_400Regular',
    bodyBold: 'Silkscreen_700Bold',
    readable: 'SpaceMono_400Regular',
    readableBold: 'SpaceMono_700Bold',
  },

  size: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 22,
    xxxl: 26,
    display: 30,
    giant: 48,
  },

  weight: {
    regular: '400' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  styles: {
    title: { fontSize: 18, fontFamily: 'PressStart2P_400Regular' } satisfies TextStyle,
    subtitle: { fontSize: 14, fontFamily: 'SpaceMono_700Bold', lineHeight: 20 } satisfies TextStyle,
    body: { fontSize: 14, fontFamily: 'SpaceMono_400Regular', lineHeight: 20 } satisfies TextStyle,
    caption: { fontSize: 12, fontFamily: 'SpaceMono_400Regular', lineHeight: 18 } satisfies TextStyle,
    button: { fontSize: 12, fontFamily: 'Silkscreen_700Bold' } satisfies TextStyle,
  },
} as const;
