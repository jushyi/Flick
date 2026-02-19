# Coding Conventions

**Analysis Date:** 2026-02-19

## Naming Patterns

**Files:**

- PascalCase + `Screen` suffix for screens (`FeedScreen.js`, `DarkroomScreen.js`)
- PascalCase for components (`Button.js`, `FeedPhotoCard.js`, `AlbumCard.js`)
- camelCase + `Service` suffix for services (`feedService.js`, `photoService.js`)
- camelCase + `use` prefix for hooks (`useDarkroom.js`, `useFeedPhotos.js`, `useCamera.js`)
- camelCase for utilities (`logger.js`, `soundUtils.js`, `haptics.js`)
- camelCase for constants files (`colors.js`, `typography.js`, `spacing.js`)
- `*.test.js` suffix for tests (`feedService.test.js`, `useDarkroom.test.js`)
- `*.styles.js` suffix for style files (`FeedScreen.styles.js`)

**Functions:**

- camelCase for all functions (`uploadPhoto`, `getDevelopingPhotos`, `batchTriagePhotos`)
- `handle` prefix for event handlers (`handleCapturePhoto`, `handleLogin`, `handleDone`)
- `is`/`has` prefix for boolean returns (`isDarkroomReadyToReveal`, `hasPermission`)
- `use` prefix for custom hooks (`useDarkroom`, `useAuth`, `useFeedPhotos`)

**Variables:**

- camelCase for state and local variables (`const [photos, setPhotos]`)
- UPPER_SNAKE_CASE for module-level constants (`FIRESTORE_IN_LIMIT = 30`, `TAG_DEBOUNCE_MS`)
- camelCase ending with `Ref` for refs (`cardRef`, `navigationRef`, `confirmationRef`)

**Types:**

- No TypeScript; JSDoc comments for type hints where provided
- Service return type: `{ success: boolean, error?: string, data?: any }`

## Code Style

**Formatting (`.prettierrc`):**

- Semicolons: Required (`"semi": true`)
- Quotes: Single quotes (`"singleQuote": true`)
- Trailing commas: ES5 style (`"trailingComma": "es5"`)
- Tab width: 2 spaces (`"tabWidth": 2`)
- Line width: 100 characters (`"printWidth": 100`)
- Arrow parens: Avoid (`"arrowParens": "avoid"`)
- Bracket spacing: Enabled (`"bracketSpacing": true`)

**Linting (`eslint.config.js`):**

- Extends: `eslint-config-expo` (Expo recommended rules)
- Prettier integration via `eslint-plugin-prettier` and `eslint-config-prettier`
- Run: `npm run lint` (check), `npm run lint:fix` (auto-fix)

**Pre-commit (`.husky/pre-commit` + lint-staged):**

- `*.{js,jsx}`: `eslint --fix` then `prettier --write`
- `*.{json,md}`: `prettier --write` only
- Secret detection: Blocks `GoogleService-Info.plist`, `.env`, certificates

## Import Organization

**Order:**

1. React and React Native core (`import React, { useState } from 'react'`)
2. Third-party packages (`@react-native-firebase/*`, `@react-navigation/*`, `expo-*`)
3. Internal services (`../services/firebase/feedService`)
4. Components (`../components`)
5. Context and hooks (`../context/AuthContext`, `../hooks/useDarkroom`)
6. Utilities and constants (`../utils/logger`, `../constants/colors`)

**Grouping:**

- Blank line between each group
- Firebase imports grouped from single package (`import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore'`)

**Path Aliases:**

- `@env` maps to `react-native-dotenv` (environment variables)
- No other path aliases; relative imports throughout (`../`, `../../`)

## Error Handling

**Patterns:**

- Services always return `{ success, error }` objects (never throw)
- Hooks check service return values and set state for UI display
- Screens show Alerts or inline error messages based on hook error state
- `ErrorBoundary` component at app root for unhandled crashes

**Service Pattern:**

```javascript
export const doOperation = async params => {
  try {
    // ... operation
    return { success: true, data: result };
  } catch (error) {
    logger.error('doOperation failed', { error: error.message });
    return { success: false, error: error.message };
  }
};
```

**Error Types:**

- Log errors at appropriate level before returning (`logger.error()`, `logger.warn()`)
- User-safe error messages in return object (not raw error stacks)

## Logging

**Framework:**

- Custom logger: `src/utils/logger.js`
- Levels: DEBUG (dev only), INFO, WARN, ERROR
- **Never use `console.log()` directly** - always use logger

**Patterns:**

- Structured logging with context: `logger.info('Photo uploaded', { userId, photoId })`
- Automatic redaction of sensitive fields (tokens, passwords, Firebase keys)
- Production: `console.log` stripped by Babel `transform-remove-console`
- Cloud Functions: Use `functions.logger.*` API (`functions/logger.js`)

## Comments

**When to Comment:**

- Explain _why_, not _what_ (code is self-documenting)
- Document business rules and edge cases
- Section dividers: `// ============================================================================`
- Critical notes: `// CRITICAL:` prefix
- Important caveats: `// NOTE:` prefix

**JSDoc:**

- Used for public API functions in services and utilities
- Format: `@param`, `@returns`, `@throws` tags
- Optional for internal functions with self-explanatory signatures

**TODO Comments:**

- Format: `// TODO: description`
- No username prefix (use git blame)

## Function Design

**Size:**

- Keep functions focused on single responsibility
- Extract helpers for complex operations
- Large screen files (1200+ lines) are known tech debt

**Parameters:**

- Use destructuring for options objects
- Service functions take primitive params (`userId`, `photoId`)

**Return Values:**

- Services: Always `{ success, error, ...data }`
- Hooks: Return object with state + action functions
- Utilities: Direct return values (no wrapper object)

## Module Design

**Exports:**

- Named exports for services and utilities
- Default exports for screens (React Navigation expects default)
- Barrel files (`index.js`) for components, context, services, constants

**Barrel Files:**

- `src/components/index.js` - Re-exports all public components
- `src/context/index.js` - Re-exports providers and hooks
- `src/services/firebase/index.js` - Re-exports all Firebase services
- `src/constants/index.js` - Re-exports all constant modules

**Platform Variants:**

- `.ios.js` / `.android.js` file extensions for platform-specific code
- Shared logic in `Base.js` file (e.g., `useCameraBase.js`)
- Metro auto-resolves; import normally without extension

---

_Convention analysis: 2026-02-19_
_Update when patterns change_
