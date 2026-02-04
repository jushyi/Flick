# Building the Appearance Settings Screen

Now we'll create the UI for users to select themes. This screen will be accessible from Settings.

## What You'll Build

- A new screen showing all available themes in a grid
- Preview functionality (see theme before applying)
- Apply button to confirm the change
- Navigation from Settings to Appearance

## Preview → Apply Pattern

This is a common UX pattern:

1. User taps a theme → **Preview** (theme applied visually but not saved)
2. User taps "Apply" → **Save** (theme persisted)
3. User taps back → **Revert** (return to original theme)

This lets users "try before they buy" without losing their current theme.

## Step 1: Create the Screen File

Create `src/screens/AppearanceSettingsScreen.js`:

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import ThemeCard from '../components/ThemeCard';
import { colors } from '../constants/colors';

const AppearanceSettingsScreen = () => {
  const navigation = useNavigation();
  const { theme, themes, currentThemeId, setTheme } = useTheme();

  // TODO: Add preview state management
  // TODO: Add navigation back handler

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select a theme</Text>
      {/* TODO: Add theme grid */}
      {/* TODO: Add apply button */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    padding: 16,
  },
  title: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
});

export default AppearanceSettingsScreen;
```

## Step 2: Add Preview State Management

**Try it yourself!** You need to track:

- `previewThemeId` - the theme currently being previewed (or null)
- `originalThemeId` - the theme to revert to if user cancels

Think about:

- When should these be set?
- What happens when user taps a theme?
- What happens when user taps Apply?
- What happens when user goes back without applying?

<details>
<summary>Hints</summary>

```javascript
const [previewThemeId, setPreviewThemeId] = useState(null);
const [originalThemeId, setOriginalThemeId] = useState(currentThemeId);

// On mount, store original theme
useEffect(() => {
  setOriginalThemeId(currentThemeId);
}, []);

// When user selects a theme:
const handleThemeSelect = themeId => {
  setPreviewThemeId(themeId);
  setTheme(themeId); // Shows preview immediately
};

// When user applies:
const handleApply = () => {
  setOriginalThemeId(previewThemeId);
  setPreviewThemeId(null);
  navigation.goBack();
};
```

</details>

## Step 3: Add Back Navigation Handler

When the user goes back without applying, we need to revert to the original theme.

<details>
<summary>Hint</summary>

Use the navigation's `beforeRemove` listener:

```javascript
useEffect(() => {
  const unsubscribe = navigation.addListener('beforeRemove', e => {
    if (previewThemeId && previewThemeId !== originalThemeId) {
      // Revert to original theme
      setTheme(originalThemeId);
    }
  });
  return unsubscribe;
}, [navigation, previewThemeId, originalThemeId, setTheme]);
```

</details>

## Step 4: Add the Theme Grid

Use FlatList with numColumns for a grid layout:

```javascript
<FlatList
  data={themes}
  numColumns={2}
  keyExtractor={item => item.id}
  renderItem={({ item }) => (
    <ThemeCard
      theme={item}
      isSelected={item.id === (previewThemeId || currentThemeId)}
      onPress={() => handleThemeSelect(item.id)}
    />
  )}
  contentContainerStyle={styles.grid}
  columnWrapperStyle={styles.row}
/>
```

Add styles:

```javascript
grid: {
  paddingBottom: 100, // Space for apply button
},
row: {
  justifyContent: 'space-between',
},
```

## Step 5: Add the Apply Button

Only show the Apply button when a preview is active:

```javascript
{
  previewThemeId && previewThemeId !== originalThemeId && (
    <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
      <Text style={styles.applyButtonText}>Apply Theme</Text>
    </TouchableOpacity>
  );
}
```

Add styles:

```javascript
applyButton: {
  position: 'absolute',
  bottom: 40,
  left: 16,
  right: 16,
  backgroundColor: colors.interactive.primary,
  padding: 16,
  borderRadius: 12,
  alignItems: 'center',
},
applyButtonText: {
  color: colors.text.primary,
  fontSize: 16,
  fontWeight: '600',
},
```

<details>
<summary>Complete Screen Code</summary>

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import ThemeCard from '../components/ThemeCard';
import { colors } from '../constants/colors';

const AppearanceSettingsScreen = () => {
  const navigation = useNavigation();
  const { themes, currentThemeId, setTheme } = useTheme();

  const [previewThemeId, setPreviewThemeId] = useState(null);
  const [originalThemeId, setOriginalThemeId] = useState(currentThemeId);

  useEffect(() => {
    setOriginalThemeId(currentThemeId);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (previewThemeId && previewThemeId !== originalThemeId) {
        setTheme(originalThemeId);
      }
    });
    return unsubscribe;
  }, [navigation, previewThemeId, originalThemeId, setTheme]);

  const handleThemeSelect = themeId => {
    setPreviewThemeId(themeId);
    setTheme(themeId);
  };

  const handleApply = () => {
    setOriginalThemeId(previewThemeId);
    setPreviewThemeId(null);
    navigation.goBack();
  };

  const selectedThemeId = previewThemeId || currentThemeId;

  return (
    <View style={styles.container}>
      <FlatList
        data={themes}
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
        ListHeaderComponent={<Text style={styles.title}>Select a theme</Text>}
      />

      {previewThemeId && previewThemeId !== originalThemeId && (
        <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
          <Text style={styles.applyButtonText}>Apply Theme</Text>
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
  title: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    marginLeft: 4,
  },
  grid: {
    padding: 16,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
  },
  applyButton: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    backgroundColor: colors.interactive.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AppearanceSettingsScreen;
```

</details>

## Step 6: Register the Screen

Add to `src/navigation/AppNavigator.js`:

```javascript
import AppearanceSettingsScreen from '../screens/AppearanceSettingsScreen';

// Inside your Stack.Navigator, add:
<Stack.Screen
  name="AppearanceSettings"
  component={AppearanceSettingsScreen}
  options={{
    title: 'Appearance',
    headerStyle: { backgroundColor: colors.background.primary },
    headerTintColor: colors.text.primary,
  }}
/>;
```

## Step 7: Add Navigation from Settings

In `src/screens/SettingsScreen.js`, add a row that navigates to Appearance:

```javascript
// Find the settings items array or list, and add:
{
  title: 'Appearance',
  icon: 'color-palette-outline', // Ionicons
  onPress: () => navigation.navigate('AppearanceSettings'),
}
```

## Verification Checklist

Test thoroughly:

- [ ] Settings screen shows "Appearance" option
- [ ] Tapping Appearance opens AppearanceSettingsScreen
- [ ] All 5 themes displayed in 2-column grid
- [ ] Current theme (Dark) shows selected state
- [ ] Tapping Light theme:
  - [ ] Selection moves to Light
  - [ ] App background changes (preview)
  - [ ] Apply button appears
- [ ] Tapping Apply:
  - [ ] Returns to Settings
  - [ ] Light theme persisted
- [ ] Going back without Apply:
  - [ ] Theme reverts to original
- [ ] After applying, reopening Appearance shows new selection

## Key Learnings

1. **Preview state pattern:** Track both preview and original values
2. **Navigation listeners:** `beforeRemove` for cleanup/revert logic
3. **FlatList grid:** `numColumns` + `columnWrapperStyle` for layouts
4. **Conditional rendering:** `{condition && <Component />}`

---

**Next:** [05-CUSTOM-EDITOR.md](./05-CUSTOM-EDITOR.md) - Building the custom palette editor
