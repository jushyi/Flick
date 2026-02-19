# Testing Patterns

**Analysis Date:** 2026-02-19

## Test Framework

**Runner:**

- Jest 29.7.0 with `jest-expo` preset
- Config: `jest.config.js` in project root
- Cloud Functions: Separate `functions/jest.config.js` (Node.js environment)

**Assertion Library:**

- Jest built-in `expect`
- Common matchers: `toBe`, `toEqual`, `toHaveBeenCalled`, `toHaveBeenCalledWith`, `toMatchObject`

**Testing Library:**

- `@testing-library/react-native` 13.3.3 - Component and hook testing
- `renderHook`, `act`, `waitFor` for hook testing

**Run Commands:**

```bash
npm test                                    # Run all tests (app + functions)
npm run test:watch                          # Watch mode
npm test -- __tests__/services/feedService.test.js  # Single file
npm run test:coverage                       # Coverage report
cd functions && npx jest                    # Functions tests only
```

## Test File Organization

**Location:**

- `__tests__/` directory at project root (NOT co-located with source)
- Cloud Functions tests: `functions/__tests__/`

**Naming:**

- All tests: `<source-file-name>.test.js`
- Examples: `feedService.test.js`, `useDarkroom.test.js`, `photoLifecycle.test.js`

**Structure:**

```
__tests__/
├── setup/
│   ├── jest.setup.js           # Global Firebase, Expo, RN mocks (~2500+ lines)
│   └── testFactories.js        # Test data factories
├── __mocks__/                  # Service mocks
├── hooks/
│   ├── useDarkroom.test.js
│   ├── useComments.test.js
│   └── useFeedPhotos.test.js
├── services/
│   ├── feedService.test.js
│   ├── photoService.test.js
│   └── commentService.test.js
├── integration/
│   ├── photoLifecycle.test.js
│   └── friendshipFlow.test.js
└── utils/
    └── [utility tests]
```

## Test Structure

**Suite Organization:**

```javascript
// 1. Mock logger first (prevents real logging)
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// 2. Define mock functions OUTSIDE jest.mock blocks
const mockGetFriendUserIds = jest.fn();

// 3. Reference inside jest.mock (avoids "Cannot access before initialization")
jest.mock('../../src/services/firebase/friendshipService', () => ({
  getFriendUserIds: (...args) => mockGetFriendUserIds(...args),
}));

// 4. Import AFTER all mocks are set up
const { getFeedPhotos } = require('../../src/services/firebase/feedService');

// 5. Export to global for assertions in tests
global.mockGetFriendUserIds = mockGetFriendUserIds;

describe('feedService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFeedPhotos', () => {
    it('should return success with feed photos', async () => {
      // arrange
      mockGetFriendUserIds.mockResolvedValueOnce({ success: true, friendIds: ['f1'] });

      // act
      const result = await getFeedPhotos('user1');

      // assert
      expect(result.success).toBe(true);
    });

    it('should return error when friends fetch fails', async () => {
      mockGetFriendUserIds.mockResolvedValueOnce({ success: false, error: 'fail' });
      const result = await getFeedPhotos('user1');
      expect(result.success).toBe(false);
    });
  });
});
```

**Patterns:**

- `clearAllMocks` in `beforeEach` for test isolation (`jest.config.js` also sets `clearMocks: true`)
- Mock functions defined **outside** `jest.mock()` blocks (critical pattern)
- Mock functions exported to `global` for access in assertions
- `mockResolvedValueOnce` for sequenced responses; `mockResolvedValue` for repeated
- `require()` instead of `import` after mocks (ensures mocks are in place)

## Mocking

**Framework:**

- Jest built-in mocking (`jest.fn()`, `jest.mock()`)
- Global mocks in `__tests__/setup/jest.setup.js` for Firebase, Expo, React Navigation

**Mock Setup Hierarchy (jest.setup.js):**

1. `@react-native-firebase/app` - Core Firebase
2. `@react-native-firebase/auth` - Auth (signInWithPhoneNumber, currentUser, onAuthStateChanged)
3. `@react-native-firebase/firestore` - Full Firestore API (getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot, query, where, orderBy, limit)
4. `@react-native-firebase/storage` - Storage (putFile, getDownloadURL, delete)
5. `@react-native-firebase/functions` - httpsCallable
6. Expo modules (expo-notifications, expo-camera, expo-image-picker, expo-haptics, expo-secure-store)
7. React Navigation (useNavigation, useRoute, useFocusEffect)

**Per-Test Mocking Pattern:**

```javascript
// Define mock functions at module scope
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();

// Wire into jest.mock
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
}));

// Export globally
global.mockGetDoc = mockGetDoc;
global.mockGetDocs = mockGetDocs;
```

**What to Mock:**

- Firebase operations (Auth, Firestore, Storage, Functions)
- Expo modules (notifications, camera, haptics, secure store)
- React Navigation (useNavigation, useRoute)
- External API calls (iTunes, Giphy)
- AsyncStorage operations

**What NOT to Mock:**

- Internal pure functions (string manipulation, date formatting)
- Constants and configuration
- Test data factories

## Fixtures and Factories

**Test Data (`__tests__/setup/testFactories.js`):**

```javascript
function createTestUser(overrides = {}) {
  return {
    uid: 'test-user-1',
    displayName: 'Test User',
    username: 'testuser',
    photoURL: 'https://example.com/photo.jpg',
    friends: [],
    fcmToken: 'mock-token',
    ...overrides,
  };
}

function createTestPhoto(overrides = {}) {
  return {
    id: 'photo-1',
    userId: 'test-user-1',
    imageURL: 'https://example.com/img.jpg',
    status: 'developing',
    photoState: null,
    createdAt: { toDate: () => new Date() },
    ...overrides,
  };
}

function createRevealedPhoto(overrides = {}) {
  return createTestPhoto({ status: 'revealed', ...overrides });
}

function createJournaledPhoto(overrides = {}) {
  return createTestPhoto({ status: 'revealed', photoState: 'journal', ...overrides });
}
```

**Location:**

- Factory functions: `__tests__/setup/testFactories.js`
- Mock data: Inline in test files when simple, factory when complex
- Firebase mock data structures: Follow Firestore document shape

## Coverage

**Requirements:**

- No enforced coverage threshold
- Coverage tracked for awareness, focused on critical paths

**Configuration:**

- Collected from: `src/**/*.{js,jsx}` only
- Excludes: test files, node_modules, functions/
- Tool: Jest built-in coverage via `--coverage` flag

**View Coverage:**

```bash
npm run test:coverage
# Open coverage/index.html for detailed report
```

## Test Types

**Unit Tests (majority):**

- Location: `__tests__/services/`, `__tests__/hooks/`
- Scope: Single service or hook in isolation
- Mocking: All external dependencies mocked
- Examples: `feedService.test.js`, `useDarkroom.test.js`, `commentService.test.js`

**Integration Tests:**

- Location: `__tests__/integration/`
- Scope: Multiple services working together
- Mocking: External boundaries only (Firebase, network)
- Examples: `photoLifecycle.test.js` (capture → develop → reveal → triage), `friendshipFlow.test.js`

**E2E Tests:**

- Framework: Maestro (`.maestro/` directory)
- Status: Configuration exists but limited coverage
- Not part of `npm test` suite

**Cloud Function Tests:**

- Location: `functions/__tests__/`
- Environment: Node.js (not React Native)
- Setup: `functions/__tests__/setup.js`
- Config: `functions/jest.config.js` (forceExit, detectOpenHandles)

## Common Patterns

**Hook Testing:**

```javascript
import { renderHook, act, waitFor } from '@testing-library/react-native';

it('should load developing photos', async () => {
  const { result } = renderHook(() => useDarkroom());

  await waitFor(() => {
    expect(result.current.developingPhotos).toHaveLength(3);
  });
});

it('should reveal photos on action', async () => {
  const { result } = renderHook(() => useDarkroom());

  await act(async () => {
    await result.current.revealPhotos();
  });

  expect(result.current.revealedPhotos).toHaveLength(3);
});
```

**Service Error Testing:**

```javascript
it('should return error when Firestore fails', async () => {
  mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

  const result = await getFeedPhotos('user1');

  expect(result.success).toBe(false);
  expect(result.error).toBe('Firestore error');
});
```

**Callback Interception:**

```javascript
it('should handle real-time subscription', async () => {
  let snapshotCallback;
  mockOnSnapshot.mockImplementation((query, callback) => {
    snapshotCallback = callback;
    return jest.fn(); // unsubscribe
  });

  // Trigger subscription setup...

  // Simulate Firestore update
  snapshotCallback({
    docs: [{ id: 'photo1', data: () => createRevealedPhoto() }],
  });

  // Assert on state change
});
```

---

_Testing analysis: 2026-02-19_
_Update when test patterns change_
