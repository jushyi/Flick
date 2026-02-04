# Expanding the Theme System

Now we'll upgrade the theme system to support full theming with 5 customizable colors per theme.

## Current State vs. Goal

**Current:** ThemeContext only swaps accent colors (purple/pink variants)

**Goal:** Full theming with background, card, text, and accent colors

## Step 1: Create Theme Definitions

Create a new file `src/constants/themes.js`:

```javascript
/**
 * Theme Definitions
 * =================
 * Each theme defines 5 key colors:
 * - background: Main screen background
 * - card: Cards, modals, elevated surfaces
 * - text: Primary text color
 * - accent: Primary interactive color (buttons, highlights)
 * - accentSecondary: Secondary accent (gradients, highlights)
 */

export const THEMES = {
  dark: {
    id: 'dark',
    name: 'Dark',
    description: 'Default dark theme',
    colors: {
      background: '#000000',
      card: '#111111',
      text: '#FFFFFF',
      accent: '#8B5CF6',
      accentSecondary: '#EC4899',
    },
  },
  light: {
    id: 'light',
    name: 'Light',
    description: 'Clean light theme',
    colors: {
      background: '#FFFFFF',
      card: '#F5F5F5',
      text: '#000000',
      accent: '#8B5CF6',
      accentSecondary: '#EC4899',
    },
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    description: 'Deep blue tones',
    colors: {
      background: '#0A1628',
      card: '#1A2940',
      text: '#E0F2FE',
      accent: '#38BDF8',
      accentSecondary: '#22D3EE',
    },
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    description: 'Natural green palette',
    colors: {
      background: '#0A1F0A',
      card: '#1A3A1A',
      text: '#E8F5E9',
      accent: '#4ADE80',
      accentSecondary: '#A3E635',
    },
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm orange tones',
    colors: {
      background: '#1A0A0A',
      card: '#2D1515',
      text: '#FFF5F5',
      accent: '#F97316',
      accentSecondary: '#FBBF24',
    },
  },
};

export const DEFAULT_THEME_ID = 'dark';

export const getThemeList = () => Object.values(THEMES);

export const getTheme = themeId => THEMES[themeId] || THEMES[DEFAULT_THEME_ID];
```

### Why separate data from logic?

Keeping theme definitions separate from ThemeContext makes it easier to:

- Add new themes without touching context code
- Test theme data independently
- Import themes in components that only need the data

## Step 2: Update ThemeContext

Now update `src/context/ThemeContext.js` to use the new theme structure.

**Try it yourself!** You need to:

1. Import the new theme helpers
2. Change state from palette name to theme ID
3. Update the setTheme function
4. Build the theme object with all colors
5. Maintain backwards compatibility

<details>
<summary>Key Changes</summary>

1. Import: `import { THEMES, DEFAULT_THEME_ID, getTheme, getThemeList } from '../constants/themes';`
2. State: `const [currentThemeId, setCurrentThemeId] = useState(DEFAULT_THEME_ID);`
3. setTheme should validate the theme ID exists
4. The theme object needs to merge with existing colors for backwards compatibility

</details>

<details>
<summary>Full Solution</summary>

```javascript
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../constants/colors';
import { THEMES, DEFAULT_THEME_ID, getTheme, getThemeList } from '../constants/themes';
import logger from '../utils/logger';

const THEME_STORAGE_KEY = '@rewind_theme_id';

const ThemeContext = createContext({});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context || Object.keys(context).length === 0) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState(DEFAULT_THEME_ID);
  const [initializing, setInitializing] = useState(true);

  // Load saved theme on mount
  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const savedThemeId = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedThemeId && THEMES[savedThemeId]) {
          setCurrentThemeId(savedThemeId);
        }
      } catch (error) {
        logger.warn('ThemeContext: Failed to load saved theme');
      } finally {
        setInitializing(false);
      }
    };
    loadSavedTheme();
  }, []);

  const setTheme = async themeId => {
    if (!THEMES[themeId]) {
      logger.warn('ThemeContext: Invalid theme ID', { themeId });
      return;
    }
    setCurrentThemeId(themeId);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch (error) {
      logger.warn('ThemeContext: Failed to persist theme');
    }
  };

  // Build theme object
  const currentTheme = getTheme(currentThemeId);
  const theme = {
    id: currentTheme.id,
    name: currentTheme.name,
    colors: currentTheme.colors,

    // Backwards compatibility - spread existing colors and override
    ...colors,
    background: {
      ...colors.background,
      primary: currentTheme.colors.background,
      secondary: currentTheme.colors.card,
      card: currentTheme.colors.card,
    },
    text: {
      ...colors.text,
      primary: currentTheme.colors.text,
    },
    brand: {
      ...colors.brand,
      purple: currentTheme.colors.accent,
      pink: currentTheme.colors.accentSecondary,
    },
    interactive: {
      ...colors.interactive,
      primary: currentTheme.colors.accent,
    },
  };

  const value = {
    theme,
    currentThemeId,
    setTheme,
    themes: getThemeList(),
    initializing,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
```

</details>

## Step 3: Update ThemeCard for Real Data

Update your ThemeCard to work with the actual theme objects from THEMES.

The props are already correct! The themes from `getThemeList()` have the exact structure your ThemeCard expects:

- `theme.id`
- `theme.name`
- `theme.colors.background`, etc.

## Verification Checklist

Test that the system works:

- [ ] App runs without errors
- [ ] Add `console.log(useTheme())` in any component - check the output includes `themes` array
- [ ] Navigate through the app - everything should still work (backwards compatible)
- [ ] No visual changes yet (we're still on dark theme)

## Key Learnings

1. **Separation of concerns:** Data in themes.js, logic in ThemeContext
2. **Backwards compatibility:** Spread existing values, then override specific ones
3. **Fallback patterns:** `THEMES[themeId] || THEMES[DEFAULT_THEME_ID]`
4. **Context value:** Provide everything consumers might need

---

**Next:** [04-SETTINGS-UI.md](./04-SETTINGS-UI.md) - Building the appearance settings screen
