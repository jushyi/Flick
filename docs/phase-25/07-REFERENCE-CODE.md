# Phase 25 Complete Code Reference

This document contains the full source code for all files created and modified in Phase 25. Use this to compare your implementation or as a copy-paste reference.

## Table of Contents

### New Files

1. [src/constants/themes.js](#srcconstantsthemesjs)
2. [src/components/ThemeCard.js](#srccomponentsthemecardjs)
3. [src/components/ColorPickerRow.js](#srccomponentscolorpickerrowjs)
4. [src/components/ThemePickerStep.js](#srccomponentsthemepickerstepjs)
5. [src/screens/AppearanceSettingsScreen.js](#srcscreensappearancesettingsscreenjs)
6. [src/screens/CustomThemeEditorScreen.js](#srcscreenscustomthemeeditorscreenjs)

### Modified Files

7. [src/context/ThemeContext.js](#srccontextthemecontextjs)
8. [src/screens/SettingsScreen.js](#srcscreenssettingsscreenjs)
9. [src/navigation/AppNavigator.js](#srcnavigationappnavigatorjs)
10. [src/screens/ProfileSetupScreen.js](#srcscreensprofilesetupscreenjs)

---

## New Files

### src/constants/themes.js

```javascript
// Theme definitions for the app
// Each theme has an id, name, and color mappings

export const themes = [
  {
    id: 'dark',
    name: 'Dark',
    colors: {
      background: {
        primary: '#000000',
        secondary: '#111111',
        tertiary: '#1a1a1a',
      },
      text: {
        primary: '#FFFFFF',
        secondary: '#888888',
        tertiary: '#666666',
      },
      interactive: {
        primary: '#8B5CF6', // Purple accent
        primaryHover: '#7C3AED',
        secondary: '#333333',
      },
      border: {
        primary: '#333333',
        subtle: '#222222',
      },
      status: {
        success: '#22C55E',
        error: '#EF4444',
        warning: '#F59E0B',
      },
    },
  },
  {
    id: 'light',
    name: 'Light',
    colors: {
      background: {
        primary: '#FFFFFF',
        secondary: '#F5F5F5',
        tertiary: '#EBEBEB',
      },
      text: {
        primary: '#000000',
        secondary: '#666666',
        tertiary: '#999999',
      },
      interactive: {
        primary: '#8B5CF6',
        primaryHover: '#7C3AED',
        secondary: '#E5E5E5',
      },
      border: {
        primary: '#E5E5E5',
        subtle: '#F0F0F0',
      },
      status: {
        success: '#22C55E',
        error: '#EF4444',
        warning: '#F59E0B',
      },
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: {
      background: {
        primary: '#0A1628',
        secondary: '#132337',
        tertiary: '#1C3246',
      },
      text: {
        primary: '#E0F2FE',
        secondary: '#7DD3FC',
        tertiary: '#38BDF8',
      },
      interactive: {
        primary: '#0EA5E9',
        primaryHover: '#0284C7',
        secondary: '#1E3A5F',
      },
      border: {
        primary: '#1E3A5F',
        subtle: '#152D4A',
      },
      status: {
        success: '#22C55E',
        error: '#EF4444',
        warning: '#F59E0B',
      },
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      background: {
        primary: '#0D1F0D',
        secondary: '#1A2F1A',
        tertiary: '#264026',
      },
      text: {
        primary: '#E8F5E8',
        secondary: '#A8D5A8',
        tertiary: '#7CBF7C',
      },
      interactive: {
        primary: '#22C55E',
        primaryHover: '#16A34A',
        secondary: '#1F3D1F',
      },
      border: {
        primary: '#2D4F2D',
        subtle: '#1F3D1F',
      },
      status: {
        success: '#22C55E',
        error: '#EF4444',
        warning: '#F59E0B',
      },
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: {
      background: {
        primary: '#1F0A0A',
        secondary: '#2D1515',
        tertiary: '#3D1F1F',
      },
      text: {
        primary: '#FEE2E2',
        secondary: '#FCA5A5',
        tertiary: '#F87171',
      },
      interactive: {
        primary: '#F97316',
        primaryHover: '#EA580C',
        secondary: '#4D2020',
      },
      border: {
        primary: '#4D2020',
        subtle: '#3D1515',
      },
      status: {
        success: '#22C55E',
        error: '#EF4444',
        warning: '#F59E0B',
      },
    },
  },
];

// Default custom theme structure (user can modify colors)
export const defaultCustomTheme = {
  id: 'custom',
  name: 'Custom',
  isCustom: true,
  colors: {
    background: {
      primary: '#000000',
      secondary: '#111111',
      tertiary: '#1a1a1a',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#888888',
      tertiary: '#666666',
    },
    interactive: {
      primary: '#8B5CF6',
      primaryHover: '#7C3AED',
      secondary: '#333333',
    },
    border: {
      primary: '#333333',
      subtle: '#222222',
    },
    status: {
      success: '#22C55E',
      error: '#EF4444',
      warning: '#F59E0B',
    },
  },
};

// Helper to get theme by ID
export const getThemeById = (id, customTheme = null) => {
  if (id === 'custom' && customTheme) {
    return customTheme;
  }
  return themes.find(t => t.id === id) || themes[0];
};
```

---

### src/components/ThemeCard.js

```javascript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const ThemeCard = ({ theme, isSelected, onPress }) => {
  const { colors } = useTheme();
  const themeColors = theme.colors;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: themeColors.background.primary,
          borderColor: isSelected ? colors.interactive.primary : themeColors.border.primary,
          borderWidth: isSelected ? 2 : 1,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Preview area */}
      <View style={styles.preview}>
        {/* Mock header */}
        <View style={[styles.mockHeader, { backgroundColor: themeColors.background.secondary }]}>
          <View style={[styles.mockDot, { backgroundColor: themeColors.text.tertiary }]} />
          <View style={[styles.mockTitle, { backgroundColor: themeColors.text.secondary }]} />
        </View>

        {/* Mock content */}
        <View style={styles.mockContent}>
          <View style={[styles.mockCard, { backgroundColor: themeColors.background.secondary }]}>
            <View style={[styles.mockLine, { backgroundColor: themeColors.text.primary }]} />
            <View
              style={[
                styles.mockLine,
                styles.mockLineShort,
                { backgroundColor: themeColors.text.secondary },
              ]}
            />
          </View>
          <View style={[styles.mockButton, { backgroundColor: themeColors.interactive.primary }]} />
        </View>
      </View>

      {/* Theme name and selection indicator */}
      <View style={styles.footer}>
        <Text style={[styles.themeName, { color: colors.text.primary }]}>{theme.name}</Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={20} color={colors.interactive.primary} />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '48%',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  preview: {
    padding: 8,
    height: 100,
  },
  mockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 4,
    marginBottom: 8,
  },
  mockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  mockTitle: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  mockContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  mockCard: {
    padding: 8,
    borderRadius: 4,
  },
  mockLine: {
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
    width: '80%',
  },
  mockLineShort: {
    width: '50%',
    marginBottom: 0,
  },
  mockButton: {
    height: 16,
    borderRadius: 4,
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  themeName: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ThemeCard;
```

---

### src/components/ColorPickerRow.js

```javascript
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import ColorPicker from 'react-native-wheel-color-picker';
import { useTheme } from '../context/ThemeContext';

const ColorPickerRow = ({ label, color, onColorChange }) => {
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [tempColor, setTempColor] = useState(color);

  const handleConfirm = () => {
    onColorChange(tempColor);
    setModalVisible(false);
  };

  const handleCancel = () => {
    setTempColor(color);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: colors.border.subtle }]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.label, { color: colors.text.primary }]}>{label}</Text>
        <View style={styles.colorPreviewContainer}>
          <View style={[styles.colorPreview, { backgroundColor: color }]} />
          <Text style={[styles.colorValue, { color: colors.text.secondary }]}>
            {color.toUpperCase()}
          </Text>
        </View>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={handleCancel}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background.secondary }]}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>{label}</Text>

            <View style={styles.pickerContainer}>
              <ColorPicker
                color={tempColor}
                onColorChange={setTempColor}
                thumbSize={30}
                sliderSize={30}
                noSnap={true}
                row={false}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.background.tertiary }]}
                onPress={handleCancel}
              >
                <Text style={[styles.buttonText, { color: colors.text.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.interactive.primary }]}
                onPress={handleConfirm}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: 16,
  },
  colorPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  colorValue: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  pickerContainer: {
    height: 300,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    marginHorizontal: 6,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ColorPickerRow;
```

---

### src/components/ThemePickerStep.js

```javascript
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import ThemeCard from './ThemeCard';
import { colors } from '../constants/colors';

const ThemePickerStep = ({ onComplete, initialThemeId = 'dark' }) => {
  const { themes, setTheme } = useTheme();
  const [selectedThemeId, setSelectedThemeId] = useState(initialThemeId);

  const handleThemeSelect = themeId => {
    setSelectedThemeId(themeId);
    setTheme(themeId); // Apply immediately for preview during onboarding
  };

  const handleContinue = () => {
    onComplete(selectedThemeId);
  };

  const handleSkip = () => {
    // Reset to default if they previewed other themes
    setTheme('dark');
    onComplete(null); // Signal skip
  };

  // Filter out 'custom' from onboarding - too complex for new users
  const availableThemes = themes.filter(t => !t.isCustom);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose your style</Text>
        <Text style={styles.subtitle}>You can always change this later in Settings</Text>
      </View>

      <FlatList
        data={availableThemes}
        numColumns={2}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ThemeCard
            theme={item}
            isSelected={item.id === selectedThemeId}
            onPress={() => handleThemeSelect(item.id)}
          />
        )}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
      />

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: 16,
  },
  grid: {
    paddingBottom: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
  buttons: {
    marginTop: 'auto',
    paddingBottom: 20,
  },
  continueButton: {
    backgroundColor: colors.interactive.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  continueText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    padding: 14,
    alignItems: 'center',
  },
  skipText: {
    color: colors.text.secondary,
    fontSize: 14,
  },
});

export default ThemePickerStep;
```

---

### src/screens/AppearanceSettingsScreen.js

```javascript
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import ThemeCard from '../components/ThemeCard';

const AppearanceSettingsScreen = ({ navigation }) => {
  const { colors, currentThemeId, themes, setTheme } = useTheme();
  const [selectedThemeId, setSelectedThemeId] = useState(currentThemeId);

  const handleThemeSelect = themeId => {
    setSelectedThemeId(themeId);
  };

  const handleApply = () => {
    setTheme(selectedThemeId);
    navigation.goBack();
  };

  const hasChanges = selectedThemeId !== currentThemeId;

  // Add custom theme to the list
  const allThemes = [...themes.filter(t => !t.isCustom), themes.find(t => t.isCustom)].filter(
    Boolean
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Appearance</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Theme Grid */}
      <FlatList
        data={allThemes}
        numColumns={2}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <ThemeCard
            theme={item}
            isSelected={item.id === selectedThemeId}
            onPress={() => {
              if (item.isCustom) {
                navigation.navigate('CustomThemeEditor');
              } else {
                handleThemeSelect(item.id);
              }
            }}
          />
        )}
        ListHeaderComponent={
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            Choose a theme
          </Text>
        }
      />

      {/* Apply Button */}
      {hasChanges && (
        <View style={styles.applyContainer}>
          <TouchableOpacity
            style={[styles.applyButton, { backgroundColor: colors.interactive.primary }]}
            onPress={handleApply}
          >
            <Text style={styles.applyText}>Apply Theme</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 32,
  },
  grid: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  applyContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  applyButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AppearanceSettingsScreen;
```

---

### src/screens/CustomThemeEditorScreen.js

```javascript
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import ColorPickerRow from '../components/ColorPickerRow';

const CustomThemeEditorScreen = ({ navigation }) => {
  const { colors, customTheme, setCustomTheme, setTheme } = useTheme();
  const [editedColors, setEditedColors] = useState(customTheme?.colors || colors);

  const updateColor = (category, key, value) => {
    setEditedColors(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
  };

  const handleSave = () => {
    const newCustomTheme = {
      id: 'custom',
      name: 'Custom',
      isCustom: true,
      colors: editedColors,
    };
    setCustomTheme(newCustomTheme);
    setTheme('custom');
    navigation.goBack();
  };

  const handleReset = () => {
    Alert.alert(
      'Reset to Default',
      'This will reset all custom colors to the dark theme defaults.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setEditedColors(colors); // Reset to current theme colors
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Custom Theme</Text>
        <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
          <Text style={[styles.resetText, { color: colors.interactive.primary }]}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Background Colors */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Background</Text>
        <View style={[styles.section, { backgroundColor: colors.background.secondary }]}>
          <ColorPickerRow
            label="Primary"
            color={editedColors.background.primary}
            onColorChange={color => updateColor('background', 'primary', color)}
          />
          <ColorPickerRow
            label="Secondary"
            color={editedColors.background.secondary}
            onColorChange={color => updateColor('background', 'secondary', color)}
          />
        </View>

        {/* Text Colors */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Text</Text>
        <View style={[styles.section, { backgroundColor: colors.background.secondary }]}>
          <ColorPickerRow
            label="Primary"
            color={editedColors.text.primary}
            onColorChange={color => updateColor('text', 'primary', color)}
          />
          <ColorPickerRow
            label="Secondary"
            color={editedColors.text.secondary}
            onColorChange={color => updateColor('text', 'secondary', color)}
          />
        </View>

        {/* Accent Color */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Accent</Text>
        <View style={[styles.section, { backgroundColor: colors.background.secondary }]}>
          <ColorPickerRow
            label="Primary"
            color={editedColors.interactive.primary}
            onColorChange={color => updateColor('interactive', 'primary', color)}
          />
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.saveContainer}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.interactive.primary }]}
          onPress={handleSave}
        >
          <Text style={styles.saveText}>Save & Apply</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  resetButton: {
    padding: 4,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
  },
  section: {
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  saveContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CustomThemeEditorScreen;
```

---

## Modified Files

### src/context/ThemeContext.js

```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, defaultCustomTheme, getThemeById } from '../constants/themes';

const ThemeContext = createContext();

const THEME_STORAGE_KEY = '@app_theme';
const CUSTOM_THEME_STORAGE_KEY = '@custom_theme';

export const ThemeProvider = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState('dark');
  const [customTheme, setCustomThemeState] = useState(defaultCustomTheme);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme on mount
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const [savedThemeId, savedCustomTheme] = await Promise.all([
        AsyncStorage.getItem(THEME_STORAGE_KEY),
        AsyncStorage.getItem(CUSTOM_THEME_STORAGE_KEY),
      ]);

      if (savedCustomTheme) {
        setCustomThemeState(JSON.parse(savedCustomTheme));
      }

      if (savedThemeId) {
        setCurrentThemeId(savedThemeId);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setTheme = async themeId => {
    try {
      setCurrentThemeId(themeId);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const setCustomTheme = async theme => {
    try {
      setCustomThemeState(theme);
      await AsyncStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(theme));
    } catch (error) {
      console.error('Error saving custom theme:', error);
    }
  };

  // Get current theme object with colors
  const currentTheme = getThemeById(currentThemeId, customTheme);

  // Build full theme list including custom
  const allThemes = [...themes, customTheme];

  const value = {
    // Current theme data
    currentThemeId,
    colors: currentTheme.colors,
    theme: currentTheme,

    // Theme management
    setTheme,
    themes: allThemes,

    // Custom theme
    customTheme,
    setCustomTheme,

    // Loading state
    isLoading,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
```

---

### src/screens/SettingsScreen.js

Add the Appearance row to your existing SettingsScreen. Add this row in the appropriate section:

```javascript
// Import at top
import { Ionicons } from '@expo/vector-icons';

// Add this row in your settings list (adjust styling to match your existing rows)
<TouchableOpacity style={styles.row} onPress={() => navigation.navigate('AppearanceSettings')}>
  <View style={styles.rowLeft}>
    <Ionicons name="color-palette-outline" size={22} color={colors.text.primary} />
    <Text style={[styles.rowText, { color: colors.text.primary }]}>Appearance</Text>
  </View>
  <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
</TouchableOpacity>;
```

---

### src/navigation/AppNavigator.js

Add the new screens to your navigator:

```javascript
// Imports at top
import AppearanceSettingsScreen from '../screens/AppearanceSettingsScreen';
import CustomThemeEditorScreen from '../screens/CustomThemeEditorScreen';

// Add inside your Stack.Navigator (adjust to match your existing navigator structure)
<Stack.Screen
  name="AppearanceSettings"
  component={AppearanceSettingsScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="CustomThemeEditor"
  component={CustomThemeEditorScreen}
  options={{ headerShown: false }}
/>
```

---

### src/screens/ProfileSetupScreen.js

Add theme picker step to your onboarding flow. The exact integration depends on your existing pattern:

```javascript
// Import at top
import ThemePickerStep from '../components/ThemePickerStep';

// If using step counter pattern, add between profile info and selects:
// Assuming step 1 = profile info, add theme as step 2

// Update TOTAL_STEPS
const TOTAL_STEPS = 4; // Was 3

// Add rendering for theme step
{
  step === 2 && (
    <ThemePickerStep
      onComplete={themeId => {
        if (themeId) {
          console.log('Theme selected:', themeId);
        } else {
          console.log('Theme selection skipped');
        }
        setStep(3); // Move to selects
      }}
    />
  );
}

// Shift subsequent steps
{
  step === 3 && <SelectsStep onComplete={() => setStep(4)} />;
}
{
  step === 4 && <SongStep onComplete={handleComplete} />;
}
```

---

## Installation Note

Don't forget to install the color picker library:

```bash
npm install react-native-wheel-color-picker
# or
yarn add react-native-wheel-color-picker
```

---

## Quick Verification

After implementing, verify:

1. **AppearanceSettingsScreen:** Settings > Appearance shows theme grid
2. **Theme switching:** Selecting a theme and tapping "Apply" changes app colors
3. **CustomThemeEditorScreen:** Tapping "Custom" opens the editor
4. **Color picker:** Each color row opens modal picker
5. **Persistence:** Theme persists after app restart
6. **Onboarding:** New users see theme picker step during profile setup

---

_Phase 25 Reference Code - Complete_
