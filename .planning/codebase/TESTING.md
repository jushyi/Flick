# Testing Patterns

**Analysis Date:** 2026-01-26

## Test Framework

**Runner:**

- Jest ~29.7.0 - Test runner
- jest-expo ~54.0.16 - Expo-specific preset
- Config: `jest.config.js` in project root

**Assertion Library:**

- Jest built-in expect
- Matchers: toBe, toEqual, toHaveBeenCalled, toHaveBeenCalledWith, etc.

**Run Commands:**

```bash
npm test                              # Run all tests
npm run test:watch                    # Watch mode (re-run on changes)
npm test -- path/to/file.test.js     # Run single file
npm run test:coverage                 # Generate coverage report
```

## Test File Organization

**Location:**

- All tests in `__tests__/` directory (separate from source)
- Subdirectories mirror source organization

**Naming:**

- Service tests: `{serviceName}Service.test.js`
- Integration tests: `{flowName}.test.js`
- Setup files: In `__tests__/setup/`

**Structure:**

```
__tests__/
├── setup/
│   └── jest.setup.js           # Global setup, Firebase mocks
├── services/
│   ├── smoke.test.js           # Basic smoke tests
│   ├── darkroomService.test.js
│   ├── photoService.test.js
│   ├── friendshipService.test.js
│   ├── feedService.test.js
│   └── phoneAuthService.test.js
└── integration/
    ├── photoLifecycle.test.js  # Capture → Reveal → Triage flow
    └── friendshipFlow.test.js  # Send → Accept → Remove flow
```

## Test Structure

**Suite Organization:**

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('ServiceName', () => {
  describe('functionName', () => {
    beforeEach(() => {
      // Reset mocks, setup test data
      jest.clearAllMocks();
    });

    it('should handle success case', async () => {
      // Arrange
      const input = { userId: 'test-user' };
      mockFirestore.mockResolvedValue({ exists: true, data: () => ({}) });

      // Act
      const result = await functionName(input);

      // Assert
      expect(result.success).toBe(true);
      expect(mockFirestore).toHaveBeenCalledWith('collection', 'doc-id');
    });

    it('should handle error case', async () => {
      // Arrange
      mockFirestore.mockRejectedValue(new Error('Network error'));

      // Act
      const result = await functionName({});

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});
```

**Patterns:**

- Use `beforeEach` for per-test setup and mock clearing
- Explicit Arrange/Act/Assert sections for complex tests
- One logical assertion per test (multiple expects OK if related)
- Descriptive test names: "should [expected behavior] when [condition]"

## Mocking

**Framework:**

- Jest built-in mocking (`jest.fn()`, `jest.mock()`)
- firestore-jest-mock for Firestore mocking

**Setup (jest.setup.js):**

```javascript
// Mock Firebase modules
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000 })),
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
}));

jest.mock('@react-native-firebase/storage', () => ({
  getStorage: jest.fn(),
}));
```

**In-Test Mocking:**

```javascript
import { getDoc, getDocs } from '@react-native-firebase/firestore';

beforeEach(() => {
  // Setup mock return values
  getDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({ userId: 'test', status: 'developing' }),
    id: 'photo-123',
  });

  getDocs.mockResolvedValue({
    docs: [{ id: 'doc-1', data: () => ({ field: 'value' }) }],
    size: 1,
    empty: false,
  });
});
```

**What to Mock:**

- Firebase SDK modules (firestore, auth, storage)
- AsyncStorage
- Expo modules (camera, notifications, haptics)
- External API calls

**What NOT to Mock:**

- Pure utility functions (timeUtils, validation)
- Service function internals (test through public API)
- Constants

## Fixtures and Factories

**Test Data Factories:**

```javascript
// In test file or shared fixture
const createTestPhoto = (overrides = {}) => ({
  id: 'photo-123',
  userId: 'user-123',
  status: 'developing',
  imageURL: 'https://example.com/photo.jpg',
  capturedAt: { seconds: Date.now() / 1000 },
  revealedAt: null,
  ...overrides,
});

const createTestUser = (overrides = {}) => ({
  uid: 'user-123',
  username: 'testuser',
  displayName: 'Test User',
  profilePhotoURL: null,
  ...overrides,
});
```

**Location:**

- Simple factories: Inline in test file
- Shared fixtures: Could be in `__tests__/fixtures/` (not currently used)

## Coverage

**Requirements:**

- No enforced coverage threshold
- Coverage tracked for awareness
- Focus on service layer and critical paths

**Configuration (jest.config.js):**

```javascript
collectCoverageFrom: [
  'src/**/*.{js,jsx}',
  '!src/**/*.test.{js,jsx}',
  '!**/node_modules/**'
],
coverageDirectory: 'coverage',
```

**View Coverage:**

```bash
npm run test:coverage
# Open coverage/lcov-report/index.html in browser
```

## Test Types

**Unit Tests:**

- Scope: Single service function in isolation
- Mocking: All Firebase dependencies mocked
- Location: `__tests__/services/*.test.js`
- Speed: Fast (<100ms per test)
- Examples: `photoService.test.js`, `friendshipService.test.js`

**Integration Tests:**

- Scope: Multi-step flows across services
- Mocking: Firebase mocked but services interact
- Location: `__tests__/integration/*.test.js`
- Examples: `photoLifecycle.test.js`, `friendshipFlow.test.js`

**E2E Tests:**

- Not currently implemented
- Manual testing via Expo Go on physical device

## Common Patterns

**Async Testing:**

```javascript
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result.success).toBe(true);
});
```

**Error Testing:**

```javascript
it('should handle errors gracefully', async () => {
  getDoc.mockRejectedValue(new Error('Network error'));

  const result = await getPhotoById('invalid');

  expect(result.success).toBe(false);
  expect(result.error).toBe('Network error');
});
```

**Mock Verification:**

```javascript
it('should call Firestore with correct params', async () => {
  await createPhoto('user-123', photoData);

  expect(setDoc).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      userId: 'user-123',
      status: 'developing',
    })
  );
});
```

**Snapshot Testing:**

- Not used in this codebase
- Prefer explicit assertions for clarity

## Test Configuration

**jest.config.js:**

```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup/jest.setup.js'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/__tests__/setup/',
    '<rootDir>/__tests__/__mocks__/',
  ],
  testMatch: ['**/__tests__/**/*.test.js'],
  clearMocks: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|...)',
  ],
  verbose: true,
};
```

## Adding New Tests

**For a new service:**

1. Create `__tests__/services/{serviceName}Service.test.js`
2. Import service functions and mocked Firebase modules
3. Write describe block per function
4. Cover: success case, error case, edge cases
5. Run: `npm test -- {serviceName}`

**For a new integration flow:**

1. Create `__tests__/integration/{flowName}.test.js`
2. Import all involved services
3. Setup mocks to simulate flow
4. Test complete flow end-to-end
5. Verify state at each step

---

_Testing analysis: 2026-01-26_
_Update when test patterns change_
