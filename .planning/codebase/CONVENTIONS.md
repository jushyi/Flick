# Coding Conventions

**Analysis Date:** 2026-01-26

## Naming Patterns

**Files:**

- PascalCase for React components: `FeedPhotoCard.js`, `AuthContext.js`
- camelCase for services: `feedService.js`, `photoService.js`
- camelCase for hooks: `useCamera.js`, `useFeedPhotos.js`
- camelCase for utilities: `logger.js`, `timeUtils.js`
- PascalCase.styles.js for style modules: `FeedPhotoCard.styles.js`
- Test files: `{name}.test.js` in `__tests__/`

**Functions:**

- camelCase for all functions: `getFeedPhotos`, `handleCapture`
- Async functions: No special prefix, just use async/await
- Handlers: `handle{Action}` pattern: `handleReaction`, `handlePress`
- Service functions: Descriptive verbs: `createPhoto`, `updatePhoto`, `deletePhoto`

**Variables:**

- camelCase for variables: `photoData`, `currentUser`
- UPPER_SNAKE_CASE for constants: `REACTION_DEBOUNCE_MS`
- No underscore prefix for private members

**Types (JSDoc):**

- PascalCase for JSDoc @typedef: `@typedef {Object} PhotoData`
- Inline JSDoc for function parameters and returns

## Code Style

**Formatting (Prettier):**

- Config: `.prettierrc`
- Semicolons: required (`"semi": true`)
- Quotes: single (`"singleQuote": true`)
- Trailing commas: ES5 (`"trailingComma": "es5"`)
- Tab width: 2 spaces (`"tabWidth": 2`)
- Print width: 100 characters (`"printWidth": 100`)
- Arrow parens: avoid when possible (`"arrowParens": "avoid"`)
- Bracket spacing: true (`"bracketSpacing": true`)

**Linting (ESLint):**

- Config: `eslint.config.js` (flat config format)
- Base: `eslint-config-expo`
- Prettier integration: `eslint-plugin-prettier/recommended`
- Run: `npm run lint` or `npm run lint:fix`

**Git Hooks (Husky):**

- Pre-commit: lint-staged runs eslint + prettier on staged files
- Config: `.husky/` directory

## Import Organization

**Order:**

1. React/React Native core imports
2. External packages (expo-_, @react-native-firebase/_, etc.)
3. Internal modules (components, services, hooks, context)
4. Relative imports (./utils, ../constants)
5. Styles (if separate file)

**Grouping:**

- Blank line between groups
- No strict alphabetical sorting enforced

**Path Aliases:**

- `@/` maps to `src/` (configured in `jest.config.js`, not used in source)
- `@env` for environment variables via `react-native-dotenv`

**Example:**

```javascript
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { getFirestore, collection } from '@react-native-firebase/firestore';
import { FeedPhotoCard, Button } from '../components';
import { feedService } from '../services/firebase';
import { useAuth } from '../context';
import logger from '../utils/logger';
import styles from '../styles/FeedScreen.styles';
```

## Error Handling

**Patterns:**

- Services return `{ success: boolean, data?: T, error?: string }`
- Try/catch with structured logging in all async functions
- Graceful degradation (return empty arrays, null values)

**Error Types:**

- Throw errors in Cloud Functions for HTTP errors (`HttpsError`)
- Return error objects in client services (don't throw)
- Log all errors with context via `logger.error()`

**Example:**

```javascript
export const getFeedPhotos = async (limitCount = 20) => {
  try {
    const snapshot = await getDocs(query);
    return { success: true, photos: snapshot.docs };
  } catch (error) {
    logger.error('Error fetching feed photos', error);
    return { success: false, error: error.message, photos: [] };
  }
};
```

## Logging

**Framework:**

- Custom logger: `src/utils/logger.js`
- Levels: debug, info, warn, error
- Environment-aware (debug filtered in production)

**Patterns:**

- Service entry/exit: `logger.debug('ServiceName.functionName: Starting', { params })`
- User actions: `logger.info('ScreenName: User action', { context })`
- Errors: `logger.error('Description', { error: error.message, context })`
- Warnings: `logger.warn('Condition', { context })`

**What to Log:**

- Service function calls (entry/exit)
- Firebase operations (queries, updates)
- User actions (captures, reactions, navigation)
- State changes
- All errors with context

**Example:**

```javascript
export const uploadPhoto = async (userId, photoUri) => {
  logger.debug('PhotoService.uploadPhoto: Starting', { userId });
  try {
    const result = await storageUpload(photoUri);
    logger.info('PhotoService.uploadPhoto: Success', { userId, photoId: result.id });
    return { success: true, photoId: result.id };
  } catch (error) {
    logger.error('PhotoService.uploadPhoto: Failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
};
```

## Comments

**When to Comment:**

- Explain "why", not "what"
- Document business logic and non-obvious decisions
- JSDoc for service function parameters and returns
- Top-of-file docblock for services explaining purpose

**JSDoc:**

- Required for service functions (public API)
- Include @param, @returns, @throws tags
- Example types inline

**TODO Comments:**

- Format: `// TODO: description`
- Reference phase if applicable: `// TODO: In Phase 10, send to Sentry`

**Example:**

```javascript
/**
 * Feed Service
 *
 * Handles feed queries and reaction management. Fetches journaled photos
 * from friends, provides real-time subscriptions, and manages emoji reactions.
 */

/**
 * Get feed photos (journaled photos from friends + current user)
 *
 * @param {number} limitCount - Number of photos to fetch (default: 20)
 * @param {object} lastDoc - Last document for pagination (optional)
 * @returns {Promise<{success: boolean, photos: Array, lastDoc: object, hasMore: boolean}>}
 */
export const getFeedPhotos = async (limitCount = 20, lastDoc = null) => {
  // ...
};
```

## Function Design

**Size:**

- Keep under ~50 lines when reasonable
- Extract helpers for complex logic
- One responsibility per function

**Parameters:**

- Max 3-4 positional parameters
- Use options object for many parameters
- Default values for optional parameters

**Return Values:**

- Consistent return shape: `{ success, data, error }`
- Return early for guard clauses
- No implicit returns (always explicit)

**Example:**

```javascript
// Good: clear return shape, early returns
export const getPhotoById = async photoId => {
  if (!photoId) {
    return { success: false, error: 'Photo ID required' };
  }

  try {
    const doc = await getDoc(photoRef);
    if (!doc.exists()) {
      return { success: false, error: 'Photo not found' };
    }
    return { success: true, photo: { id: doc.id, ...doc.data() } };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

## Module Design

**Exports:**

- Named exports for services: `export const getFeedPhotos = ...`
- Default export for React components: `export default function FeedScreen() {}`
- Barrel exports via `index.js` in each directory

**Barrel Files:**

- Every directory has `index.js` for clean imports
- Re-export all public modules
- Example: `export { FeedPhotoCard, Button, Card } from './components';`

**Service Pattern:**

- One service per domain (photos, feed, friendships, etc.)
- All functions exported individually
- Consistent return shape across all services

## React Patterns

**Components:**

- Functional components only (no class components)
- Destructure props in function signature
- Default export for screen/component files

**Hooks:**

- Custom hooks start with `use` prefix
- Return object with named properties: `{ data, loading, error, refresh }`
- Use `useCallback` for stable function references
- Use `useMemo` for expensive computations

**Context:**

- Provider wraps relevant subtree (usually at App.js level)
- Custom hook for consuming: `useAuth()`, `useTheme()`
- Keep context focused (auth, theme, etc.)

---

_Convention analysis: 2026-01-26_
_Update when patterns change_
