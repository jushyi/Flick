# Coding Conventions

**Analysis Date:** 2026-01-26

## Naming Patterns

**Files:**

- PascalCase for React components: `FeedScreen.js`, `PhotoDetailModal.js`
- camelCase for utilities and services: `logger.js`, `photoService.js`
- `.test.js` suffix for test files
- `.styles.js` suffix for style modules

**Functions:**

- camelCase for all functions: `uploadPhoto`, `getDevelopingPhotoCount`
- No special prefix for async functions
- handle\* for event handlers: `handleCapturePhoto`, `handleReaction`

**Variables:**

- camelCase for variables: `userProfile`, `darkroomCount`
- UPPER_SNAKE_CASE for constants: `REACTION_DEBOUNCE_MS`, `GIPHY_API_KEY`
- No underscore prefix for private members

**Types:**

- Not applicable (JavaScript, not TypeScript)

## Code Style

**Formatting:**

- Prettier with configuration in `eslint.config.js`
- Single quotes for strings
- Trailing commas in multiline
- 2 space indentation
- ~100 character line length (Prettier default)

**Linting:**

- ESLint 9.x with flat config: `eslint.config.js`
- Extends eslint-config-expo (React Native rules)
- Prettier integration via eslint-plugin-prettier
- Run: `npm run lint` or `npm run lint:fix`

**Pre-commit:**

- Husky + lint-staged
- Auto-runs ESLint and Prettier on staged files

## Import Organization

**Order:**

1. React and React Native imports
2. External packages (expo-_, @react-navigation/_, etc.)
3. Internal modules (context, services, components)
4. Relative imports (./_, ../_)
5. Constants and utils last

**Grouping:**

- Logical grouping with blank lines between categories
- No strict alphabetical sorting enforced

**Path Aliases:**

- `@/` maps to `src/` (configured in jest.config.js for tests)
- `@env` for environment variables via react-native-dotenv

## Error Handling

**Patterns:**

- Services return `{ success: true, data }` or `{ success: false, error }` objects
- Callers check `result.success` before using data
- Try/catch in async functions, log errors via logger

**Error Types:**

- Throw on unexpected errors (caught by ErrorBoundary)
- Return error objects for expected failures
- Log all errors with context: `logger.error('Context: Error message', { details })`

**Example:**

```javascript
try {
  const result = await someService();
  if (!result.success) {
    logger.warn('Operation failed', { error: result.error });
    return { success: false, error: result.error };
  }
  return { success: true, data: result.data };
} catch (error) {
  logger.error('Unexpected error', { error: error.message });
  return { success: false, error: error.message };
}
```

## Logging

**Framework:**

- Custom logger utility: `src/utils/logger.js`
- Levels: debug, info, warn, error

**Patterns:**

- Structured logging with context objects
- Log at service boundaries and user actions
- Automatic sensitive data sanitization
- `logger.debug()` for development, `logger.info()` for important events
- `logger.error()` always includes error details

**Example:**

```javascript
logger.info('PhotoService.uploadPhoto: Starting upload', { userId });
logger.debug('PhotoService.uploadPhoto: Processing', { step: 'compress' });
logger.error('PhotoService.uploadPhoto: Failed', { error: error.message });
```

## Comments

**When to Comment:**

- Explain why, not what
- Document business rules (e.g., reveal timing, triage flow)
- Complex algorithms or workarounds
- TODOs with issue context

**JSDoc:**

- Used in Cloud Functions for function documentation
- Optional in app code (function names should be self-documenting)

**TODO Comments:**

- Format: `// TODO: description`
- Include phase reference if applicable
- Example: `// TODO: In Phase 10, send to Sentry`

## Function Design

**Size:**

- Keep functions focused on single responsibility
- Extract helpers for complex logic
- No strict line limit enforced

**Parameters:**

- Destructure objects in parameters where appropriate
- Use options object for functions with many parameters

**Return Values:**

- Consistent `{ success, data/error }` pattern for services
- Return early for guard clauses
- Explicit returns (no implicit undefined)

## Module Design

**Exports:**

- Named exports preferred
- Default exports for React components
- Barrel files (`index.js`) for directory exports

**Services:**

- Export individual functions, not classes
- Functions are stateless (state in Firestore)

**Components:**

- One component per file (main component)
- Helper components can be in same file if small
- Export default for main component

## React/React Native Patterns

**State Management:**

- useState for local UI state
- useContext for global state (auth, theme)
- No external state library (Redux, MobX)

**Effects:**

- useEffect for side effects and subscriptions
- Cleanup functions for listeners/intervals
- Dependency arrays always specified

**Navigation:**

- React Navigation hooks: useNavigation, useRoute
- navigationRef for programmatic navigation

---

_Convention analysis: 2026-01-26_
_Update when patterns change_
