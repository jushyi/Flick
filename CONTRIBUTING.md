# Contributing

Guidelines for contributing to Lapse Clone.

## Development Setup

See [README.md](README.md) for installation and running instructions.

## Code Style

### File Naming

- **Components:** PascalCase - `FeedPhotoCard.js`, `PhotoDetailModal.js`
- **Services/Utilities:** camelCase - `feedService.js`, `timeUtils.js`, `logger.js`
- **Docs:** UPPERCASE - `README.md`, `CONTRIBUTING.md`

### Function Naming

- All functions use camelCase: `uploadPhoto()`, `sendFriendRequest()`
- Event handlers use `handle` prefix: `handleCapturePhoto`, `handleLogin`
- Async functions use `async` keyword, no special prefix

### Import Organization

Group imports in this order with blank lines between groups:

1. React and React Native core
2. Third-party packages (Firebase, navigation, etc.)
3. Internal services
4. Components
5. Context and hooks
6. Utilities

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

import { collection, query } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

import { feedService } from '../services/firebase/feedService';

import { FeedPhotoCard } from '../components';

import { useAuth } from '../context/AuthContext';

import { logger } from '../utils/logger';
```

## Patterns

### Service Return Pattern

All service functions return `{ success, error }` objects:

```javascript
export const uploadPhoto = async (userId, photoUri) => {
  try {
    // ... upload logic
    return { success: true, photoId: result.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

### Error Handling

Use try/catch with the logger utility:

```javascript
try {
  const result = await someOperation();
  logger.info('Operation successful', { resultId: result.id });
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', { error: error.message });
  return { success: false, error: error.message };
}
```

### Logging

Use the logger utility from `src/utils/logger.js`. Never use `console.log` directly.

- `logger.debug()` - Development-only detailed info
- `logger.info()` - Important events and user actions
- `logger.warn()` - Recoverable issues
- `logger.error()` - Failures affecting functionality

Always include context:

```javascript
logger.debug('FeedService.subscribeFeedPhotos: Starting', { userId, friendIds });
logger.error('PhotoService.uploadPhoto: Failed', { error: error.message, photoId });
```

### Component Structure

Functional components only, with hooks for state:

```javascript
import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

const ComponentName = ({ prop1, prop2 }) => {
  const [state, setState] = useState(initialValue);

  useEffect(() => {
    // effect logic
  }, [dependencies]);

  const handleAction = () => {
    // handler logic
  };

  return <View style={styles.container}>{/* JSX */}</View>;
};

const styles = StyleSheet.create({
  container: {
    // styles
  },
});

export default ComponentName;
```

## Commit Messages

Format: `type(scope): description`

Types:

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `test` - Adding or updating tests
- `chore` - Build process, dependencies, or tooling

Examples:

```
feat(darkroom): add batch reveal with haptic feedback
fix(camera): correct flash toggle state persistence
docs(readme): add Firebase setup instructions
refactor(feed): extract useFeedPhotos hook
```

## Before Submitting

1. Run linting: `npm run lint`
2. Run tests: `npm test`
3. Ensure no `console.log` statements (use logger instead)
4. Verify the app runs without errors: `npx expo start`
