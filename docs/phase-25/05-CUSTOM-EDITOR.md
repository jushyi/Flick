# Building the Custom Palette Editor

Now we'll create a screen where users can build their own custom theme by picking colors.

## What You'll Build

- Color picker component with modal interface
- CustomThemeEditorScreen with 5 color pickers
- Live preview of the custom theme
- Save/reset functionality with persistence

## Learning Objectives

By the end of this guide, you will:

1. Install and use a third-party React Native library
2. Build a form-like UI with multiple inputs
3. Implement custom data persistence with AsyncStorage
4. Handle complex state (multiple color values)

## Step 1: Install Color Picker Library

First, we need a color picker library. React Native doesn't have built-in color pickers.

**Recommended: react-native-wheel-color-picker**

```bash
npm install react-native-wheel-color-picker
```

This is a wheel-based color picker that works well with Expo.

**Alternative: reanimated-color-picker**

```bash
npm install reanimated-color-picker
```

This requires react-native-reanimated (may already be installed).

### Library Selection Tips

When choosing a library, consider:

- Expo compatibility (check "expo" in README or issues)
- Bundle size (smaller is better)
- Maintenance status (recent updates)
- API simplicity

## Step 2: Create ColorPickerRow Component

Create `src/components/ColorPickerRow.js`:

This component shows a color label and swatch. Tapping opens a modal with a color picker.

**Try it yourself!** Think about:

- What state do you need? (modal visibility, temporary color)
- How do you handle confirm vs cancel?
- What props does this component need?

<details>
<summary>💡 Hints</summary>

- Props: `label`, `color`, `onColorChange`
- State: `modalVisible`, `tempColor`
- Cancel should reset to original color
- Confirm should call `onColorChange` with the new color

</details>

<details>
<summary>✅ Full Solution</summary>

```javascript
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import ColorPicker from 'react-native-wheel-color-picker';
import { colors } from '../constants/colors';

/**
 * A row component showing a color label and swatch
 * Tapping opens a modal with color picker
 */
const ColorPickerRow = ({ label, color, onColorChange }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [tempColor, setTempColor] = useState(color);

  const handleConfirm = () => {
    onColorChange(tempColor);
    setModalVisible(false);
  };

  const handleCancel = () => {
    setTempColor(color); // Reset to original
    setModalVisible(false);
  };

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={[styles.swatch, { backgroundColor: color }]}
        onPress={() => setModalVisible(true)}
      />

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={handleCancel}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose {label}</Text>

            <ColorPicker
              color={tempColor}
              onColorChangeComplete={color => setTempColor(color)}
              thumbSize={30}
              sliderSize={30}
              noSnap={true}
              row={false}
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                <Text style={styles.confirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  label: {
    color: colors.text.primary,
    fontSize: 16,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border.subtle,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.text.secondary,
    fontSize: 16,
  },
  confirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.interactive.primary,
    alignItems: 'center',
  },
  confirmText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ColorPickerRow;
```

</details>

## Step 3: Create CustomThemeEditorScreen

Create `src/screens/CustomThemeEditorScreen.js`:

**Screen layout:**

```
┌─────────────────────────────┐
│  < Custom Theme             │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │     Live Preview      │  │  <- Shows how theme looks
│  │   (mini app mockup)   │  │
│  └───────────────────────┘  │
│                             │
│  Background         [████]  │  <- ColorPickerRow for each
│  Card               [████]  │
│  Text               [████]  │
│  Accent             [████]  │
│  Accent Secondary   [████]  │
│                             │
│  ┌─────────────────────┐    │
│  │   Reset to Default   │    │  <- Reset button
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │    Save Theme        │    │  <- Save button
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘
```

**Try it yourself!** Think about:

- What state do you need? (the 5 color values, has changes flag)
- How do you load saved custom theme on mount?
- When should the Save button appear?
- What does Reset do?

<details>
<summary>💡 Hints</summary>

- State: `customColors` object with all 5 colors, `hasChanges` boolean
- Load from AsyncStorage on mount
- Save button appears when `hasChanges` is true
- Reset sets colors back to dark theme defaults

</details>

<details>
<summary>✅ Full Solution</summary>

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import ColorPickerRow from '../components/ColorPickerRow';
import { colors } from '../constants/colors';
import { THEMES } from '../constants/themes';

const CUSTOM_THEME_KEY = '@rewind_custom_theme';

// Default custom theme starts as copy of dark theme
const DEFAULT_CUSTOM_COLORS = { ...THEMES.dark.colors };

const CustomThemeEditorScreen = () => {
  const navigation = useNavigation();
  const { setCustomTheme } = useTheme();

  const [customColors, setCustomColors] = useState(DEFAULT_CUSTOM_COLORS);
  const [hasChanges, setHasChanges] = useState(false);

  // Load saved custom theme on mount
  useEffect(() => {
    loadCustomTheme();
  }, []);

  const loadCustomTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem(CUSTOM_THEME_KEY);
      if (saved) {
        setCustomColors(JSON.parse(saved));
      }
    } catch (error) {
      console.warn('Failed to load custom theme:', error);
    }
  };

  const updateColor = (key, value) => {
    setCustomColors(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleReset = () => {
    setCustomColors(DEFAULT_CUSTOM_COLORS);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await AsyncStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(customColors));
      // Apply the custom theme
      setCustomTheme(customColors);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save custom theme:', error);
    }
  };

  // Mini preview component showing the theme
  const ThemePreview = () => (
    <View style={[styles.preview, { backgroundColor: customColors.background }]}>
      <View style={[styles.previewCard, { backgroundColor: customColors.card }]}>
        <Text style={[styles.previewText, { color: customColors.text }]}>Preview Text</Text>
        <View style={styles.previewButtonRow}>
          <View style={[styles.previewButton, { backgroundColor: customColors.accent }]} />
          <View style={[styles.previewButton, { backgroundColor: customColors.accentSecondary }]} />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemePreview />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Colors</Text>

          <ColorPickerRow
            label="Background"
            color={customColors.background}
            onColorChange={color => updateColor('background', color)}
          />
          <ColorPickerRow
            label="Card"
            color={customColors.card}
            onColorChange={color => updateColor('card', color)}
          />
          <ColorPickerRow
            label="Text"
            color={customColors.text}
            onColorChange={color => updateColor('text', color)}
          />
          <ColorPickerRow
            label="Accent"
            color={customColors.accent}
            onColorChange={color => updateColor('accent', color)}
          />
          <ColorPickerRow
            label="Accent Secondary"
            color={customColors.accentSecondary}
            onColorChange={color => updateColor('accentSecondary', color)}
          />
        </View>

        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <Text style={styles.resetText}>Reset to Default</Text>
        </TouchableOpacity>
      </ScrollView>

      {hasChanges && (
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveText}>Save Theme</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: 16,
    paddingBottom: 100, // Space for save button
  },
  preview: {
    height: 150,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  previewCard: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
  },
  previewText: {
    fontSize: 16,
    marginBottom: 12,
  },
  previewButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  previewButton: {
    width: 60,
    height: 30,
    borderRadius: 6,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  resetButton: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    marginTop: 12,
  },
  resetText: {
    color: colors.text.secondary,
    fontSize: 16,
  },
  saveButton: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.interactive.primary,
    alignItems: 'center',
  },
  saveText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CustomThemeEditorScreen;
```

</details>

## Step 4: Add Custom Theme to THEMES

Update `src/constants/themes.js` to include a custom theme entry:

```javascript
// At the end of THEMES object:
custom: {
  id: 'custom',
  name: 'Custom',
  description: 'Your personalized theme',
  isCustom: true,
  colors: {
    // These will be overridden by user's saved colors
    background: '#000000',
    card: '#111111',
    text: '#FFFFFF',
    accent: '#8B5CF6',
    accentSecondary: '#EC4899',
  },
},
```

## Step 5: Add setCustomTheme to ThemeContext

Update `src/context/ThemeContext.js` to support custom themes:

**Try it yourself!** You need to add:

- State for custom colors
- Loading custom colors on mount
- A `setCustomTheme` function
- Use custom colors when custom theme is selected

<details>
<summary>💡 Hints</summary>

```javascript
const CUSTOM_THEME_KEY = '@rewind_custom_theme';

// In ThemeProvider:
const [customColors, setCustomColors] = useState(null);

// Load custom colors in the existing useEffect or a new one
// When building theme, check if currentThemeId === 'custom'
```

</details>

<details>
<summary>✅ Key Additions</summary>

```javascript
const CUSTOM_THEME_KEY = '@rewind_custom_theme';

// In ThemeProvider, add state:
const [customColors, setCustomColors] = useState(null);

// Load custom colors on mount (add to existing effect or create new one):
useEffect(() => {
  const loadCustomColors = async () => {
    try {
      const saved = await AsyncStorage.getItem(CUSTOM_THEME_KEY);
      if (saved) {
        setCustomColors(JSON.parse(saved));
      }
    } catch (error) {
      logger.warn('Failed to load custom colors:', error);
    }
  };
  loadCustomColors();
}, []);

// Add setCustomTheme function:
const setCustomTheme = async colors => {
  setCustomColors(colors);
  setCurrentThemeId('custom');
  try {
    await AsyncStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(colors));
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'custom');
  } catch (error) {
    logger.warn('Failed to save custom theme:', error);
  }
};

// Update theme building to use custom colors when custom theme selected:
const currentTheme = getTheme(currentThemeId);
const themeColors =
  currentThemeId === 'custom' && customColors ? customColors : currentTheme.colors;

const theme = {
  id: currentTheme.id,
  name: currentTheme.name,
  colors: themeColors,
  // ... rest of theme building
};

// Add to context value:
const value = {
  // ... existing values
  setCustomTheme,
  customColors,
};
```

</details>

## Step 6: Register the Screen

Add to `src/navigation/AppNavigator.js`:

```javascript
import CustomThemeEditorScreen from '../screens/CustomThemeEditorScreen';

// Inside your Stack.Navigator, add:
<Stack.Screen
  name="CustomThemeEditor"
  component={CustomThemeEditorScreen}
  options={{
    title: 'Custom Theme',
    headerStyle: { backgroundColor: colors.background.primary },
    headerTintColor: colors.text.primary,
  }}
/>;
```

## Step 7: Add Navigation from Appearance Screen

In `src/screens/AppearanceSettingsScreen.js`, add a "Create Custom Theme" button or make the Custom theme card navigate to the editor:

```javascript
// Option 1: Dedicated button
<TouchableOpacity
  style={styles.customButton}
  onPress={() => navigation.navigate('CustomThemeEditor')}
>
  <Text style={styles.customButtonText}>Create Custom Theme</Text>
</TouchableOpacity>;

// Option 2: Make Custom ThemeCard navigate to editor on press
const handleThemeSelect = themeId => {
  if (themeId === 'custom') {
    navigation.navigate('CustomThemeEditor');
  } else {
    setPreviewThemeId(themeId);
    setTheme(themeId);
  }
};
```

## Verification Checklist

Test the custom theme editor:

- [ ] Color picker library installed without errors
- [ ] App builds and runs
- [ ] Navigate to Settings → Appearance → Custom Theme
- [ ] All 5 color picker rows display
- [ ] Tapping a color swatch opens the picker modal
- [ ] Picking a color and confirming updates the swatch
- [ ] Live preview updates when colors change
- [ ] "Reset to Default" restores dark theme colors
- [ ] "Save Theme" button appears after making changes
- [ ] Saving navigates back and applies custom theme
- [ ] Custom theme persists after app restart
- [ ] Can switch away from custom and back to it

## Key Learnings

1. **Third-party libraries:** Installing and using npm packages in React Native
2. **Modal pattern:** Temporary UI that overlays the main content
3. **Complex state:** Managing multiple related values together
4. **JSON persistence:** Storing structured data in AsyncStorage

---

**Next:** [06-ONBOARDING.md](./06-ONBOARDING.md) - Adding theme selection to profile setup
