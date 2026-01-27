# Testing Patterns

**Analysis Date:** 2026-01-26

## Test Framework

**Runner:**

- Jest ~29.7.0
- Config: `jest.config.js` in project root

**Preset:**

- jest-expo ~54.0.16 - Handles Expo/React Native transforms

**Assertion Library:**

- Jest built-in expect
- Matchers: toBe, toEqual, toHaveBeenCalledWith, toMatchObject

**Run Commands:**

```bash
npm test                              # Run all tests
npm run test:watch                    # Watch mode
npm test -- path/to/file.test.js     # Single file
npm run test:coverage                 # Coverage report
```

## Test File Organization

**Location:**

- `__tests__/` directory at project root (separate from source)
- Not co-located with source files

**Naming:**

- `*.test.js` for all test files
- Mirrors source structure: `services/photoService.test.js`

**Structure:**

```
__tests__/
├── __mocks__/                  # Mock modules
│   └── @react-native-firebase/ # Firebase SDK mocks
│       ├── app.js
│       ├── auth.js
│       ├── firestore.js
│       └── storage.js
├── integration/                # Integration tests
│   ├── friendshipFlow.test.js
│   └── photoLifecycle.test.js
├── services/                   # Service unit tests
│   ├── darkroomService.test.js
│   ├── feedService.test.js
│   ├── friendshipService.test.js
│   ├── phoneAuthService.test.js
│   ├── photoService.test.js
│   └── smoke.test.js
└── setup/
    ├── jest.setup.js           # Global setup
    └── testFactories.js        # Test data factories
```

## Test Structure

**Suite Organization:**

```javascript
describe('ServiceName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks
  });

  describe('functionName', () => {
    it('should handle success case', async () => {
      // Arrange
      const mockData = createTestData();

      // Act
      const result = await functionName(mockData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedData);
    });

    it('should handle error case', async () => {
      // Test error handling
    });
  });
});
```

**Patterns:**

- Use beforeEach for mock resets and shared setup
- jest.clearAllMocks() to reset between tests
- Arrange/Act/Assert structure
- One assertion focus per test (multiple expects OK)

## Mocking

**Framework:**

- Jest built-in mocking
- Module mocking via `__mocks__/` directory

**Firebase Mocks:**
Located in `__tests__/__mocks__/@react-native-firebase/`:

```javascript
// __tests__/__mocks__/@react-native-firebase/firestore.js
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockWhere = jest.fn();
const mockOnSnapshot = jest.fn();

// Mock Firestore instance
const mockFirestore = {
  collection: mockCollection,
  doc: mockDoc,
  // ... etc
};

module.exports = () => mockFirestore;
module.exports.getFirestore = () => mockFirestore;
// Export individual mocks for test assertions
module.exports.__mocks__ = { mockCollection, mockDoc, ... };
```

**What to Mock:**

- Firebase SDK (@react-native-firebase/\*)
- External APIs (Expo notifications)
- AsyncStorage
- Time/dates if needed

**What NOT to Mock:**

- Internal pure functions
- Simple utilities
- Test factories

## Fixtures and Factories

**Test Data:**
Located in `__tests__/setup/testFactories.js`:

```javascript
// Factory functions for test data
export const createTestUser = (overrides = {}) => ({
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  ...overrides,
});

export const createTestPhoto = (overrides = {}) => ({
  id: 'test-photo-id',
  userId: 'test-user-id',
  status: 'developing',
  imageURL: 'https://example.com/photo.jpg',
  capturedAt: new Date(),
  ...overrides,
});

export const createTestFriendship = (overrides = {}) => ({
  id: 'user1_user2',
  user1Id: 'user1',
  user2Id: 'user2',
  status: 'accepted',
  ...overrides,
});
```

**Location:**

- Factory functions: `__tests__/setup/testFactories.js`
- Mock data: Inline in tests or factories

## Coverage

**Requirements:**

- No enforced coverage threshold
- Coverage tracked for awareness

**Configuration:**

- Vitest/Jest coverage via built-in
- Excludes: test files, node_modules

**View Coverage:**

```bash
npm run test:coverage
open coverage/index.html
```

**Collect From:**

- `src/**/*.{js,jsx}`
- Excludes test files

## Test Types

**Unit Tests:**

- Scope: Test single service function in isolation
- Mocking: Mock all Firebase SDK calls
- Location: `__tests__/services/*.test.js`
- Examples: `photoService.test.js`, `darkroomService.test.js`

**Integration Tests:**

- Scope: Test multiple services together
- Mocking: Mock Firebase, test service interactions
- Location: `__tests__/integration/*.test.js`
- Examples: `photoLifecycle.test.js`, `friendshipFlow.test.js`

**E2E Tests:**

- Not currently implemented
- Manual testing via Expo Go / TestFlight

## Common Patterns

**Async Testing:**

```javascript
it('should handle async operation', async () => {
  mockGet.mockResolvedValue({ data: () => testData });

  const result = await asyncFunction();

  expect(result).toBe('expected');
});
```

**Error Testing:**

```javascript
it('should handle error', async () => {
  mockGet.mockRejectedValue(new Error('Network error'));

  const result = await functionCall();

  expect(result.success).toBe(false);
  expect(result.error).toContain('Network error');
});
```

**Firestore Mocking:**

```javascript
it('should query Firestore', async () => {
  const mockDocs = [{ id: '1', data: () => ({ name: 'Test' }) }];
  mockGet.mockResolvedValue({ docs: mockDocs, empty: false });

  const result = await getItems();

  expect(mockCollection).toHaveBeenCalledWith('items');
  expect(mockWhere).toHaveBeenCalledWith('status', '==', 'active');
  expect(result).toHaveLength(1);
});
```

**Snapshot Testing:**

- Not used in this codebase
- Prefer explicit assertions

## Jest Configuration

Key settings from `jest.config.js`:

```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup/jest.setup.js'],
  testPathIgnorePatterns: ['node_modules/', '__tests__/setup/', '__tests__/__mocks__/'],
  testMatch: ['**/__tests__/**/*.test.js'],
  clearMocks: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: ['node_modules/(?!(...react-native packages...))'],
  collectCoverageFrom: ['src/**/*.{js,jsx}', '!src/**/*.test.{js,jsx}'],
  verbose: true,
};
```

---

_Testing analysis: 2026-01-26_
_Update when test patterns change_
