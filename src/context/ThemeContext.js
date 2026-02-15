import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../constants/colors';
import logger from '../utils/logger';

const THEME_STORAGE_KEY = '@flick_theme_palette';

/**
 * Preset color palettes for user personalization
 * Each palette provides accent and accentSecondary colors
 * that override the brand colors in the theme
 */
export const PALETTES = {
  cyan: {
    accent: '#00D4FF', // Electric cyan (default retro accent)
    accentSecondary: '#FF2D78', // Hot magenta
  },
  magenta: {
    accent: '#FF2D78', // Hot magenta
    accentSecondary: '#B24BF3', // Electric purple
  },
  neonGreen: {
    accent: '#39FF14', // Neon green (terminal/Matrix)
    accentSecondary: '#00D4FF', // Electric cyan
  },
  gold: {
    accent: '#FFD700', // Coin gold
    accentSecondary: '#FF8C00', // Retro amber
  },
};

const ThemeContext = createContext({});

/**
 * Hook to access theme context
 * Must be used within a ThemeProvider
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context || Object.keys(context).length === 0) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * ThemeProvider component
 * Provides theme colors to the entire app via context
 * Supports switching between preset palettes
 */
export const ThemeProvider = ({ children }) => {
  const [currentPalette, setCurrentPalette] = useState('cyan');
  const [initializing, setInitializing] = useState(true);

  // Load saved palette from AsyncStorage on mount
  useEffect(() => {
    const loadSavedPalette = async () => {
      try {
        logger.debug('ThemeContext: Loading saved palette from storage');
        const savedPalette = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedPalette && PALETTES[savedPalette]) {
          logger.info('ThemeContext: Loaded saved palette', { palette: savedPalette });
          setCurrentPalette(savedPalette);
        } else {
          logger.debug('ThemeContext: No saved palette, using default cyan');
        }
      } catch (error) {
        logger.warn('ThemeContext: Failed to load saved palette, using default', {
          error: error.message,
        });
      } finally {
        setInitializing(false);
      }
    };

    loadSavedPalette();
  }, []);

  /**
   * Update the current palette and persist to storage
   * @param {string} paletteName - Name of palette from PALETTES
   */
  const setPalette = async paletteName => {
    if (!PALETTES[paletteName]) {
      logger.warn('ThemeContext: Invalid palette name', { paletteName });
      return;
    }
    logger.info('ThemeContext: Palette changed', {
      from: currentPalette,
      to: paletteName,
    });
    setCurrentPalette(paletteName);

    // Persist to AsyncStorage
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, paletteName);
      logger.debug('ThemeContext: Palette persisted to storage', { palette: paletteName });
    } catch (error) {
      logger.warn('ThemeContext: Failed to persist palette', { error: error.message });
    }
  };

  // Derive theme object from current palette merged with static colors
  const palette = PALETTES[currentPalette];
  const theme = {
    // Accent colors from selected palette
    accent: palette.accent,
    accentSecondary: palette.accentSecondary,
    // Spread all static colors from constants
    ...colors,
    // Override brand colors with palette (for components using brand.purple directly)
    brand: {
      ...colors.brand,
      purple: palette.accent,
      pink: palette.accentSecondary,
      gradient: {
        ...colors.brand.gradient,
        // Update gradients to use palette colors
        developing: [palette.accent, palette.accentSecondary],
        revealed: [palette.accent, palette.accentSecondary],
      },
    },
  };

  const value = {
    theme,
    currentPalette,
    setPalette,
    palettes: Object.keys(PALETTES),
    initializing,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
