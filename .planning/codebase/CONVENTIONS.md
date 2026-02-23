# Coding Conventions

**Analysis Date:** 2026-02-23

## Naming Patterns

**Files:**

- Components: PascalCase (`Button.js`, `FeedPhotoCard.js`, `CameraScreen.js`)
- Screens: PascalCase with `Screen` suffix (`CameraScreen.js`, `FeedScreen.js`, `ActivityScreen.js`)
- Services: camelCase (`photoService.js`, `darkroomService.js`, `audioPlayer.js`, `uploadQueueService.js`)
- Hooks: camelCase with `use` prefix (`useCamera.js`, `useDarkroom.js`, `useFeedPhotos.js`)
- Utilities: camelCase (`logger.js`, `haptics.js`, `timeUtils.js`)
- Styles: camelCase with `.styles` suffix (`CameraScreen.styles.js`)
- Constants: camelCase (`colors.js`, `typography.js`, `spacing.js`, `layout.js`)

**Functions:**

- All functions: camelCase (`createPhoto`, `getUserPhotos`, `calculateNextRevealTime`, `playPreview`)
- Event handlers: `handle` prefix (`handleCapturePhoto`, `handlePress`, `handleLogin`)
- Boolean returns: `is`/`has` prefix (`isDarkroomReady`, `hasPermission`, `hasUltraWide`, `containsSensitiveData`)
- Private/module-level helpers: same camelCase (no leading underscore)

**Variables:**

- Local variables: camelCase (`userId`, `photoUri`, `currentPlayer`, `selectedLens`)
- Constants (module-level): UPPER_SNAKE_CASE for static values (`TAB_BAR_HEIGHT = 88`, `CAMERA_HEIGHT`, `CARD_WIDTH`)
- State variables: camelCase (`count`, `selectedLens`, `fadeAnim`, `pendingDeletion`)
- Refs (useRef): camelCase with `Ref` suffix (`currentPlayerRef`, `flatListRef`, `backgroundedAtRef`)
- Animated values: camelCase with `Anim` suffix (`scaleAnim`, `fanSpreadAnim`)

**Types & Objects:**

- Context objects: PascalCase (`AuthContext`, `PhotoDetailContext`, `ThemeContext`)
- Firestore document paths: lowercase with slash notation (`'photos'`, `'users'`, `'conversations/{id}/messages'`)
- Firestore collection names: lowercase plural (`photos`, `users`, `albums`, `notifications`)
- Object keys in Firestore: camelCase (`userId`, `photoURL`, `capturedAt`, `photoState`, `reactionCount`)
- Status enums: lowercase (`'developing'`, `'revealed'`, `'pending'`, `'accepted'`)

## Code Style

**Formatting:**

- Tool: Prettier 3.8.1
- Semicolons: Always included
- Single quotes: Required for strings
- Trailing commas: ES5 style (commas where valid in ES5)
- Tab width: 2 spaces
- Print width: 100 characters
- Bracket spacing: Enabled (objects use `{ key: value }` not `{key: value}`)
- Arrow function parens: Omitted when single parameter (`e => {}` not `(e) => {}`)

**Prettier config (.prettierrc):**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

**Linting:**

- Tool: ESLint 9.39.2 with expo config
- Config: `eslint.config.js` (flat config format, not legacy .eslintrc)
- Base: `eslint-config-expo` provides React Native globals and best practices
- Integration: `eslint-plugin-prettier` enforces Prettier rules
- Ignored paths: `dist/`, `node_modules/`, `android/`, `ios/`, `functions/`, `patches/`, `scripts/`
- Jest globals: Auto-configured for `__tests__/**/*.js` files
- Custom rules:
  - `import/no-unresolved` allows `@expo/vector-icons` and `@env` (resolve at runtime)
  - `import/namespace` disabled for react-native (TypeScript parse issues)

**Git hooks:**

- Tool: husky 9.1.7 + lint-staged 16.2.7
- Pre-commit: Automatically lints and formats staged `*.{js,jsx}` files
- Also formats: `*.{json,md}` files via Prettier
- Run commands manually:
  - `npm run lint` - Check for errors
  - `npm run lint:fix` - Auto-fix errors
  - `npm run format` - Format all files

## Import Organization

**Order (strict - enforced by eslint-config-expo):**

1. React and React Native core imports
2. Third-party packages (Firebase, navigation, Expo, etc.)
3. Internal services (`src/services/`)
4. Components (`src/components/`)
5. Context and hooks (`src/context/`, `src/hooks/`)
6. Utilities and constants (`src/utils/`, `src/constants/`)

**Blank lines:** One blank line between each group.

**Example from FeedScreen.js:**

```javascript
// Group 1: React and React Native
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  RefreshControl,
  AppState,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Group 2: Third-party packages
import { useNavigation } from '@react-navigation/native';
import {
  getFirestore,
  collection,
  query,
  where,
  limit,
  onSnapshot,
} from '@react-native-firebase/firestore';
import { Image } from 'expo-image';

// Group 3: Services
import useFeedPhotos from '../hooks/useFeedPhotos';
import { toggleReaction, getFriendStoriesData } from '../services/firebase/feedService';
import { getFriendUserIds } from '../services/firebase/friendshipService';

// Group 4: Components
import FeedPhotoCard from '../components/FeedPhotoCard';
import FeedLoadingSkeleton from '../components/FeedLoadingSkeleton';
import { FriendStoryCard } from '../components';

// Group 5: Context and hooks
import { useAuth } from '../context/AuthContext';
import { usePhotoDetailActions } from '../context/PhotoDetailContext';
import { useScreenTrace } from '../hooks/useScreenTrace';

// Group 6: Constants and utilities
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import logger from '../utils/logger';
```

**Path aliases:**

- Not used in this codebase - all imports use relative paths (`../services/`, `../components/`)
- Jest uses `@/` → `src/` for test imports (optional, relative paths also work)

## Error Handling

**Pattern:** Service layer returns standardized result objects

- All Firebase services in `src/services/firebase/` return `{ success, error }` or `{ success, data }` objects
- Services never throw errors - always catch exceptions and return structured response
- Components check `success` flag before using data

**Example from photoService.js:**

```javascript
export const createPhoto = async (userId, photoUri) => {
  try {
    const photosCollection = collection(db, 'photos');
    const photoRef = await addDoc(photosCollection, {
      userId,
      imageURL: '',
      capturedAt: serverTimestamp(),
      status: 'developing',
    });
    const photoId = photoRef.id;

    logger.debug('PhotoService.createPhoto: Document created', { photoId });
    const uploadResult = await uploadPhoto(userId, photoId, photoUri);

    if (!uploadResult.success) {
      logger.warn('PhotoService.createPhoto: Upload failed', { error: uploadResult.error });
      await deleteDoc(photoRef);
      return { success: false, error: uploadResult.error };
    }

    return { success: true, photoId };
  } catch (error) {
    logger.error('PhotoService.createPhoto: Failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
};
```

**Usage in components:**

```javascript
const result = await createPhoto(userId, photoUri);
if (!result.success) {
  logger.error('Photo upload failed', { error: result.error });
  // Show user-facing error message
  return;
}
// Proceed with result.photoId
```

**Try-catch:** Only used in service functions and async setup (e.g. AuthContext). Not used for control flow in components.

**Error logging:** Always include context and error message:

```javascript
logger.error('PhotoService.createPhoto: Failed', { userId, error: error.message });
```

## Logging

**Framework:** Custom logger utility at `src/utils/logger.js`

**Never use `console.log()` directly.** Always use the logger:

```javascript
import logger from '../utils/logger';

logger.debug('Detailed info', { userId, count }); // Dev only
logger.info('Important events', { photoId }); // Production
logger.warn('Recoverable issues', { error }); // Production
logger.error('Failures', { error: error.message }); // Production
```

**Logger behavior:**

- Development (**DEV**): Shows all levels (DEBUG, INFO, WARN, ERROR)
- Production: Shows only WARN and ERROR
- Automatically sanitizes sensitive data (tokens, passwords, keys, fcmToken, etc.) — redacts as `[REDACTED]`
- Strips `console.log` from production via babel `transform-remove-console` plugin

**Log levels:**

- `debug` - Dev-only verbose info (stripped in production)
- `info` - Important app events that should be tracked
- `warn` - Recoverable issues that need attention
- `error` - Failures that affect functionality

**Naming pattern:** Log messages start with module/function path for traceability:

```javascript
logger.debug('PhotoService.createPhoto: Starting', { userId });
logger.error('PhotoService.createPhoto: Failed', { userId, error: error.message });
logger.info('useCamera.ios: selectedLens changed', { selectedLens });
logger.warn('darkroomService: Reveal timing calculation skipped', { userId });
```

## Comments

**When to Comment:**

- File header: JSDoc block explaining module purpose, key functions, and usage
- Complex logic: Explain the "why", not the "what" (code should be self-explanatory)
- TODOs/FIXMEs: Use when there's a known limitation or future work needed
- Retro/artistic decisions: Explain pixel art styling or CRT aesthetic choices
- Workarounds: Document why a non-obvious approach was chosen

**JSDoc/TSDoc:**

- File headers: Always include. Describe module purpose and key exports.
- Public functions: Always document parameters and return values with types.
- Complex utility functions: Document edge cases and special behaviors.
- Private/internal functions: Comments optional if logic is self-evident.

**Example from audioPlayer.js:**

```javascript
/**
 * Audio Player Service
 *
 * Provides audio preview playback for profile songs with:
 * - Clip range support (start/end positions)
 * - Progress callbacks
 *
 * Uses expo-audio for cross-platform audio support.
 */

/**
 * Play a preview clip with optional start/end positions and fade out.
 *
 * @param {string} previewUrl - URL of the audio preview
 * @param {Object} options - Playback options
 * @param {number} options.clipStart - Start position in seconds (default 0)
 * @param {number} options.clipEnd - End position in seconds (default 30)
 * @param {function} options.onProgress - Progress callback (receives 0-1)
 * @param {function} options.onComplete - Called when playback ends
 * @returns {Promise<AudioPlayer|null>} Player object for external control
 */
export const playPreview = async (previewUrl, options = {}) => {
  const { clipStart = 0, clipEnd = 30, onProgress, onComplete } = options;
  // ...
};
```

**Example from colors.js (artistic decision):**

```javascript
/**
 * Flick App Color System — 16-Bit Retro Edition
 * ================================================
 * CRT-inspired dark theme with neon pixel accents.
 * Deep indigo backgrounds evoke vintage monitors,
 * electric cyan/magenta/green accents channel SNES-era palettes.
 *
 * COLOR HIERARCHY:
 * - background.primary (#0A0A1A): CRT navy-black - all screen backgrounds
 * - background.secondary/card (#161628): Dark indigo panel for content blocks
 * - background.tertiary (#252540): Elevated surface for nested elements
 */
```

## Function Design

**Size:**

- Target: 30-50 lines max for readability
- Rationale: React Native/gesture code can be longer (50-100 for complex animations)
- Break into sub-functions if exceeding 100 lines
- Helper functions can live in same file (above main export)

**Parameters:**

- Limit to 3-4 positional params
- Use object destructuring for options: `const { clipStart = 0, clipEnd = 30 } = options`
- Always provide defaults for optional params
- Destructure in function signature for better readability

**Return Values:**

- Services: Return `{ success, data/error }` objects
- Hooks: Return state + handlers in object or array (depends on usage pattern)
- Components: Return JSX (implicit React.Fragment rules apply)
- Utilities: Return single value or destructurable object

**Example from Button.js:**

```javascript
const Button = ({
  title,
  onPress,
  variant = 'primary', // Destructured with default
  disabled = false,
  loading = false,
  style,
  testID,
}) => {
  const getButtonStyle = () => {
    switch (variant) {
      case 'primary':
        return [styles.button, styles.primaryButton];
      case 'secondary':
        return [styles.button, styles.secondaryButton];
      default:
        return [styles.button, styles.primaryButton];
    }
  };

  return (
    <TouchableOpacity style={[...getButtonStyle(), style]} onPress={onPress}>
      {loading ? <PixelSpinner /> : <Text>{title?.toUpperCase()}</Text>}
    </TouchableOpacity>
  );
};
```

## Module Design

**Exports:**

- Named exports: Preferred for utilities and services
- Default export: Components only (one default export per file)
- Barrel files: Used in `src/components/index.js` and `src/context/index.js`

**Barrel file example (src/components/index.js):**

```javascript
export { default as Button } from './Button';
export { default as Card } from './Card';
export { FriendStoryCard } from './FriendStoryCard';
export { GifPicker } from './comments/GifPicker';
```

**File structure:**

- One component/hook/service per file (single responsibility)
- Exception: Tightly-coupled utilities may live in same file (e.g., helper functions above main export)
- Large modules (500+ lines) should be split: `PhotoDetail.js` + `PhotoDetail.styles.js`

**Platform-specific files:**

- Used for significant platform differences (not just style tweaks)
- Extensions: `.ios.js`, `.android.js`, `.web.js` (in that precedence order)
- Fallback: Base `.js` file auto-selected if platform-specific unavailable
- Metro resolver automatically picks correct file — **no import changes needed**

**Example from useCamera:**

```
useCamera.ios.js       ← iOS-specific (lens detection, AVFoundation)
useCamera.android.js   ← Android-specific (different zoom levels)
useCameraBase.js       ← Shared base logic
useCamera.js           ← Not present; Metro resolves platform-specific
```

**Usage:**

```javascript
// Same import works for both platforms — Metro picks the right file
import useCamera from '../hooks/useCamera';
```

**Re-exports from platform files:**

- Export constants from base file to avoid duplication:

```javascript
// useCamera.ios.js
import useCameraBase, {
  TAB_BAR_HEIGHT,
  FOOTER_HEIGHT,
  CAMERA_HEIGHT,
  FLOATING_BUTTON_SIZE,
} from './useCameraBase';

// Re-export so CameraScreen can import from single path
export { TAB_BAR_HEIGHT, FOOTER_HEIGHT, CAMERA_HEIGHT, FLOATING_BUTTON_SIZE };

const useCamera = () => {
  /* iOS implementation */
};
export default useCamera;
```

## StyleSheet & Styles

**Organization:**

- Separate `.styles.js` files for screens and large/complex components
- Define StyleSheet at bottom of component file for simple components
- Reference design system constants: `colors.js`, `spacing.js`, `typography.js`, `layout.js`
- Never hardcode values — always use constants

**Naming:**

- StyleSheet object: `styles`
- Style properties: camelCase matching React Native props
- Classes/variants: Descriptive names (`primaryButton`, `disabledButton`, `zoomButtonActive`)

**Example from CameraScreen.styles.js:**

```javascript
import { Platform, StyleSheet, Dimensions } from 'react-native';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TAB_BAR_HEIGHT = layout.dimensions.tabBarHeight;
const FOOTER_HEIGHT = layout.dimensions.footerHeight;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  cameraContainer: {
    position: 'absolute',
    height: CAMERA_HEIGHT,
    borderBottomLeftRadius: CAMERA_BORDER_RADIUS,
  },
  floatingButton: {
    backgroundColor: colors.overlay.dark,
    width: FLOATING_BUTTON_SIZE,
    borderRadius: FLOATING_BUTTON_SIZE / 2,
  },
  zoomButtonActive: {
    backgroundColor: colors.overlay.lightBorder,
  },
});
```

**Platform-specific styles:**

- Use `Platform.select()` for small inline differences
- Separate `.styles.js` files if major divergence (rarely needed)
- Always use design system colors/spacing — never hardcoded values
- Always use `Platform.OS === 'android'` guards for Android-specific code

```javascript
import { Platform } from 'react-native';

const behavior = Platform.select({ ios: 'padding', android: 'height' });
const paddingTop = Platform.OS === 'android' ? 24 : 0;

const styles = StyleSheet.create({
  container: {
    paddingTop,
  },
});
```

## Design System Constants

**Location:** `src/constants/`

**Files & Purpose:**

- `colors.js`: Color palette (backgrounds, text, icons, status, brand, overlays)
- `spacing.js`: Margin/padding scale (xs, sm, md, lg, xl, xxl)
- `typography.js`: Font families, sizes, weights
- `layout.js`: Border radius, dimensions (screen heights, button sizes, borders)

**Usage pattern:**

```javascript
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.interactive.primary,
    borderRadius: layout.borderRadius.sm,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.md,
  },
});
```

**Key rule:** NEVER hardcode colors, spacing, or dimensions. Always reference constants.

---

_Convention analysis: 2026-02-23_
