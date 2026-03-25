import React, { createContext, useState, useContext, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, type Colors } from '../constants/colors';
import logger from '../utils/logger';

const THEME_STORAGE_KEY = '@flick_theme_palette';

interface Palette {
  accent: string;
  accentSecondary: string;
}

export const PALETTES: Record<string, Palette> = {
  cyan: {
    accent: '#00D4FF',
    accentSecondary: '#FF2D78',
  },
  magenta: {
    accent: '#FF2D78',
    accentSecondary: '#B24BF3',
  },
  neonGreen: {
    accent: '#39FF14',
    accentSecondary: '#00D4FF',
  },
  gold: {
    accent: '#FFD700',
    accentSecondary: '#FF8C00',
  },
};

type Theme = Colors & {
  accent: string;
  accentSecondary: string;
};

interface ThemeContextValue {
  theme: Theme;
  currentPalette: string;
  setPalette: (paletteName: string) => Promise<void>;
  palettes: string[];
  initializing: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps): React.JSX.Element => {
  const [currentPalette, setCurrentPalette] = useState('cyan');
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const loadSavedPalette = async (): Promise<void> => {
      try {
        logger.debug('ThemeContext: Loading saved palette from storage');
        const savedPalette = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedPalette && PALETTES[savedPalette]) {
          logger.info('ThemeContext: Loaded saved palette', { palette: savedPalette });
          setCurrentPalette(savedPalette);
        } else {
          logger.debug('ThemeContext: No saved palette, using default cyan');
        }
      } catch (err) {
        const error = err as Error;
        logger.warn('ThemeContext: Failed to load saved palette, using default', {
          error: error.message,
        });
      } finally {
        setInitializing(false);
      }
    };

    loadSavedPalette();
  }, []);

  const setPalette = async (paletteName: string): Promise<void> => {
    if (!PALETTES[paletteName]) {
      logger.warn('ThemeContext: Invalid palette name', { paletteName });
      return;
    }
    logger.info('ThemeContext: Palette changed', { from: currentPalette, to: paletteName });
    setCurrentPalette(paletteName);

    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, paletteName);
      logger.debug('ThemeContext: Palette persisted to storage', { palette: paletteName });
    } catch (err) {
      const error = err as Error;
      logger.warn('ThemeContext: Failed to persist palette', { error: error.message });
    }
  };

  const palette = PALETTES[currentPalette];
  const theme: Theme = {
    accent: palette.accent,
    accentSecondary: palette.accentSecondary,
    ...colors,
    brand: {
      ...colors.brand,
      purple: palette.accent as typeof colors.brand.purple,
      pink: palette.accentSecondary as typeof colors.brand.pink,
      gradient: {
        ...colors.brand.gradient,
        developing: [palette.accent, palette.accentSecondary] as unknown as typeof colors.brand.gradient.developing,
        revealed: [palette.accent, palette.accentSecondary] as unknown as typeof colors.brand.gradient.revealed,
      },
    },
  };

  const value: ThemeContextValue = {
    theme,
    currentPalette,
    setPalette,
    palettes: Object.keys(PALETTES),
    initializing,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
