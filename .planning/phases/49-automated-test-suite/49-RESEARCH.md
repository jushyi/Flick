# Phase 49: Automated Test Suite - Research

**Researched:** 2026-02-11
**Domain:** Testing infrastructure for React Native Expo app (Jest unit/integration + E2E)
**Confidence:** HIGH

<research_summary>

## Summary

Researched the complete testing ecosystem for a React Native 0.81 + Expo SDK 54 + React 19 app with Firebase backend (Auth, Firestore, Storage, Cloud Functions) and expo-server-sdk push notifications.

**Key finding: Use Maestro instead of Detox for E2E testing.** Expo officially recommends Maestro, integrates it into EAS Workflows, and Detox has no official Expo support (community-driven only). Detox requires release builds for Expo apps (no debug mode), making iteration extremely slow. Maestro uses YAML-based declarative tests, requires zero native configuration, and works with any .app build.

For unit/integration testing, the existing Jest + jest-expo + manual Firebase mocks foundation is solid. Add `@testing-library/react-native` v13 for component/hook testing (react-test-renderer is deprecated in React 19). For Cloud Functions, use `firebase-functions-test` with `wrap()` for trigger testing and mock `expo-server-sdk` for notification tests.

**Primary recommendation:** Maestro for E2E, RNTL v13 for component tests, firebase-functions-test for Cloud Functions — all layered on the existing Jest infrastructure.
</research_summary>

<standard_stack>

## Standard Stack

### Core (Already Installed)

| Library             | Version  | Purpose                | Why Standard                                      |
| ------------------- | -------- | ---------------------- | ------------------------------------------------- |
| jest                | ~29.7.0  | Test runner            | Industry standard, already configured             |
| jest-expo           | ~54.0.16 | Expo test preset       | Handles Expo transforms/mocks automatically       |
| firestore-jest-mock | ^0.26.0  | Firestore mock utility | Available but manual mocks are better (see below) |

### To Install — Client Tests

| Library                       | Version | Purpose                  | Why Standard                                                            |
| ----------------------------- | ------- | ------------------------ | ----------------------------------------------------------------------- |
| @testing-library/react-native | ^13.3.3 | Component + hook testing | Official recommendation for React 19; react-test-renderer is deprecated |
| maestro (CLI)                 | latest  | E2E testing              | Officially recommended by Expo; YAML-based, zero native config          |

### To Install — Cloud Functions Tests

| Library                 | Version | Purpose                   | Why Standard                                       |
| ----------------------- | ------- | ------------------------- | -------------------------------------------------- |
| firebase-functions-test | ^3.4.1  | Cloud Functions test SDK  | Official Firebase SDK; supports v2 callable wrap() |
| jest (in functions/)    | ^29.7.0 | Test runner for functions | Same runner, separate config for Node environment  |

### Alternatives Considered

| Instead of            | Could Use           | Tradeoff                                                                                                                                                       |
| --------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Maestro               | Detox               | Detox has grey-box sync (better when it works) but NO official Expo support, requires release builds, slow iteration, frequent sync issues with Expo internals |
| Maestro               | Appium              | Most mature but extremely slow, complex setup (Java/Python), no RN-specific optimizations — overkill                                                           |
| RNTL                  | react-test-renderer | react-test-renderer is DEPRECATED in React 19 and will emit warnings; RNTL replaced it internally                                                              |
| Manual Firebase mocks | firestore-jest-mock | firestore-jest-mock targets Google Firebase JS SDK (not @react-native-firebase), where() doesn't actually filter, and your manual mocks give more control      |

### Installation

**Client (root package.json):**

```bash
npx expo install @testing-library/react-native
```

**Maestro (system-level CLI):**

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

**Cloud Functions (functions/package.json):**

```bash
cd functions && npm install --save-dev firebase-functions-test@^3.4.1 jest@^29.7.0
```

</standard_stack>

<architecture_patterns>

## Architecture Patterns

### Recommended Test Structure

```
# Client-side tests (existing structure, extended)
__tests__/
├── setup/
│   ├── jest.setup.js          # Firebase + Expo mocks (EXISTS)
│   └── testFactories.js       # Test data factories (EXISTS)
├── __mocks__/
│   └── @react-native-firebase/ # Module mocks (EXISTS)
├── services/                   # Service unit tests (5 EXIST)
│   ├── phoneAuthService.test.js
│   ├── photoService.test.js
│   ├── darkroomService.test.js
│   ├── friendshipService.test.js
│   └── feedService.test.js
├── integration/                # Cross-service tests (2 EXIST)
│   ├── photoLifecycle.test.js
│   └── friendshipFlow.test.js
├── hooks/                      # Hook tests (NEW)
│   └── useComments.test.js
├── utils/                      # Utility tests (NEW)
│   ├── validation.test.js
│   └── timeUtils.test.js
└── components/                 # Component tests (NEW, optional)
    └── AuthCodeInput.test.js

# Cloud Functions tests (NEW)
functions/
├── jest.config.js              # Node test environment config
├── __tests__/
│   ├── setup.js                # firebase-admin + expo-server-sdk mocks
│   ├── notifications/
│   │   └── sender.test.js      # Push notification sending
│   ├── triggers/
│   │   ├── friendRequest.test.js
│   │   ├── reaction.test.js
│   │   └── darkroomReveal.test.js
│   └── callable/
│       ├── mutualFriends.test.js
│       └── deleteAccount.test.js

# E2E tests (NEW)
.maestro/
├── auth/
│   ├── phone-login.yaml        # Phone auth with test numbers
│   └── onboarding.yaml         # Profile setup flow
├── feed/
│   ├── view-feed.yaml          # Feed browsing
│   └── react-to-photo.yaml    # Photo reactions
└── social/
    ├── friend-request.yaml     # Send/accept friend request
    └── comments.yaml           # Comment and @-mention
```

### Pattern 1: Service Unit Tests (Existing — Validated)

**What:** Test Firebase service functions with mocked Firestore/Auth/Storage
**When to use:** All service-layer business logic
**Your existing pattern is correct:**

```javascript
// Mock dependencies BEFORE importing service
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Import service AFTER mocks
const { createPhoto } = require('../../src/services/firebase/photoService');

describe('createPhoto', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create photo with correct fields', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'photo-123' });
    // ...test body
  });
});
```

### Pattern 2: Component Tests with RNTL v13 (New)

**What:** Test React Native components with user-centric queries
**When to use:** Components with meaningful logic (conditional rendering, state changes)
**Critical: RNTL v13 APIs are async for React 19**

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// Additional mocks needed for component tests
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

test('AuthCodeInput accepts 6-digit code', async () => {
  const onComplete = jest.fn();
  await render(<AuthCodeInput onComplete={onComplete} />);

  const input = screen.getByTestId('code-input');
  await fireEvent.changeText(input, '123456');

  expect(onComplete).toHaveBeenCalledWith('123456');
});
```

### Pattern 3: Hook Tests with renderHook (New)

**What:** Test custom hooks in isolation
**When to use:** Hooks with testable logic (state management, data fetching)

```javascript
import { renderHook, act } from '@testing-library/react-native';
import { useComments } from '../../src/hooks/useComments';

test('should load comments for photo', async () => {
  mockOnSnapshot.mockImplementation(callback => {
    callback({ docs: [{ id: 'c1', data: () => ({ text: 'Nice!' }) }] });
    return jest.fn(); // unsubscribe
  });

  const { result } = await renderHook(() => useComments('photo-123'));

  expect(result.current.comments).toHaveLength(1);
});
```

### Pattern 4: Cloud Functions Trigger Tests (New)

**What:** Test Firestore triggers using firebase-functions-test wrap()
**When to use:** All Cloud Function triggers (onCreate, onWrite, onUpdate)

```javascript
const firebaseFunctionsTest = require('firebase-functions-test');
const testEnv = firebaseFunctionsTest();

jest.mock('firebase-admin', () => {
  /* mock */
});
jest.mock('../notifications/sender', () => ({
  sendPushNotification: jest.fn().mockResolvedValue({ success: true, tickets: [] }),
}));

const { sendFriendRequestNotification } = require('../index');
const wrapped = testEnv.wrap(sendFriendRequestNotification);

test('sends notification on friend request', async () => {
  const snap = testEnv.firestore.makeDocumentSnapshot(
    { user1Id: 'sender', user2Id: 'receiver', status: 'pending', requestedBy: 'sender' },
    'friendships/f-123'
  );
  await wrapped(snap, { params: { friendshipId: 'f-123' } });

  const { sendPushNotification } = require('../notifications/sender');
  expect(sendPushNotification).toHaveBeenCalled();
});

afterAll(() => testEnv.cleanup());
```

### Pattern 5: Maestro E2E Flows (New)

**What:** YAML-based E2E tests for critical user journeys
**When to use:** Auth, onboarding, feed, social flows

```yaml
# .maestro/auth/phone-login.yaml
appId: com.spoodsjs.rewind
---
- launchApp
- tapOn: 'Phone Number'
- inputText: '6505553434' # Firebase test phone number
- tapOn: 'Continue'
- assertVisible: 'Enter Code'
- inputText: '123456' # Pre-configured test code
- tapOn: 'Verify'
- assertVisible: 'Welcome' # or whatever your success screen shows
```

### Anti-Patterns to Avoid

- **Using react-test-renderer:** Deprecated in React 19, will emit warnings, removed in future React version
- **Installing @testing-library/react-hooks:** Deprecated — renderHook is built into @testing-library/react-native v13
- **Using Detox with Expo:** No official support, requires release builds, expo-dev-client launcher blocks Detox, detox-expo-helpers abandoned 3+ years ago
- **Testing implementation details:** Test behavior (what the user sees/what the function returns), not internal state or method calls
- **Mocking too deeply:** Your service-level mocks are the right abstraction — don't mock internal helper functions within services
  </architecture_patterns>

<dont_hand_roll>

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                      | Don't Build                                        | Use Instead                                  | Why                                                                        |
| ---------------------------- | -------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| E2E test framework           | Custom Appium/Selenium wrapper                     | Maestro                                      | YAML-based, zero native config, Expo-recommended, EAS Workflow integration |
| Component test renderer      | Custom render utilities                            | @testing-library/react-native                | Handles React 19 async rendering, provides user-centric queries            |
| Hook test harness            | Custom hook wrapper component                      | RNTL renderHook                              | Built-in to RNTL v13, handles React 19 Suspense                            |
| Cloud Functions test harness | Manual function invocation                         | firebase-functions-test wrap()               | Handles auth context, document snapshots, Change objects                   |
| Firestore document snapshots | Manual `{ exists: () => true, data: () => {...} }` | testEnv.firestore.makeDocumentSnapshot()     | Matches real Firestore snapshot shape, handles edge cases                  |
| Firebase phone auth in E2E   | SMS interception, OTP parsing                      | Firebase test phone numbers                  | Configure in Firebase Console, works with any E2E framework                |
| Push notification mocking    | Custom Expo class replacement                      | jest.mock('expo-server-sdk') with class mock | Mock the class constructor + static methods, simple pattern                |

**Key insight:** The testing ecosystem for React Native + Firebase is mature. Every layer has a purpose-built tool — Maestro for E2E, RNTL for components, Jest for logic, firebase-functions-test for Cloud Functions. Hand-rolling any of these leads to brittle, hard-to-maintain test infrastructure that breaks on upgrades.
</dont_hand_roll>

<common_pitfalls>

## Common Pitfalls

### Pitfall 1: Detox + Expo Incompatibility

**What goes wrong:** Detox cannot detect app when using expo-dev-client (launcher screen blocks detection). Debug mode completely unsupported.
**Why it happens:** Detox requires direct app binary access; Expo's dev client adds an intermediary launcher screen.
**How to avoid:** Use Maestro instead. If you must use Detox, build release-mode binaries via EAS with a special "detox" profile.
**Warning signs:** Tests hang waiting for app to load, synchronization timeout errors.

### Pitfall 2: react-test-renderer Deprecated in React 19

**What goes wrong:** Console warnings flood test output: "react-test-renderer is deprecated". Future React version removes it entirely.
**Why it happens:** React 19 has a new rendering model; react-test-renderer was not updated.
**How to avoid:** Use @testing-library/react-native v13, which has its own internal Test Renderer compatible with React 19.
**Warning signs:** Deprecation warnings in test output, mysterious rendering failures.

### Pitfall 3: RNTL v13 Async API Breaking Change

**What goes wrong:** `render()`, `renderHook()`, `fireEvent()` silently fail or produce stale results.
**Why it happens:** RNTL v13 made all main APIs async to support React 19's concurrent features. Missing `await` means tests run against incomplete render output.
**How to avoid:** Always `await render(...)`, `await renderHook(...)`, `await fireEvent.press(...)`. Use `waitFor()` for async state updates.
**Warning signs:** Tests that pass when run individually but fail in suite, assertions on stale/empty state.

### Pitfall 4: React Compiler Memoization in Tests

**What goes wrong:** Tests asserting re-render counts see fewer renders than expected. Reference equality checks behave differently.
**Why it happens:** babel-plugin-react-compiler runs during Jest transforms, applying automatic memoization to all components and hooks.
**How to avoid:** Don't test re-render counts. Test behavior, not implementation. For service-layer tests (your current suite), this has zero impact.
**Warning signs:** Re-render count assertions fail, `useEffect` appears to not fire when expected.

### Pitfall 5: Cloud Functions index.js Non-Exported Helpers

**What goes wrong:** Cannot directly unit-test functions like `formatReactionSummary`, `getRandomTemplate`, `shouldSendNotification`, `revealUserPhotos`.
**Why it happens:** These are local functions in the ~2500-line `index.js` file, not exported.
**How to avoid:** Either export them (add to `module.exports`) or test them indirectly via `firebase-functions-test wrap()` on the exported Cloud Functions. Extracting to separate modules is ideal but optional.
**Warning signs:** Unable to test edge cases in helper logic without full trigger simulation.

### Pitfall 6: Maestro Camera/Push Notification Limitations

**What goes wrong:** Cannot test camera capture or real push notifications in E2E tests on iOS simulator.
**Why it happens:** APNs doesn't work on simulators. Camera hardware isn't available in simulator (Simulator has a limited simulated camera feature).
**How to avoid:** For camera: add a test-mode bypass or use iOS simulator's drag-and-drop image injection. For push: trigger Firestore changes that your app reacts to, or test local notification behavior. Test the _response_ to notifications, not the delivery.
**Warning signs:** E2E tests skip camera and notification flows entirely, leaving gaps in coverage.

### Pitfall 7: Firebase Emulator Requiring Java 11+

**What goes wrong:** Cloud Functions integration tests fail in CI because Firestore emulator requires Java JDK 11+.
**Why it happens:** The Firestore emulator runs on JVM.
**How to avoid:** For unit tests, use mocks (no Java needed). For emulator-based integration tests, ensure CI has Java 11+ installed. Consider keeping emulator tests as a separate CI job.
**Warning signs:** `firebase emulators:start` fails with "Java not found" or "Unsupported Java version".
</common_pitfalls>

<code_examples>

## Code Examples

Verified patterns from official sources:

### Maestro E2E: Auth Flow with Firebase Test Phone Numbers

```yaml
# .maestro/auth/phone-login.yaml
# Source: Expo docs + Maestro docs
# Requires: Firebase Console → Authentication → Phone → Test phone numbers
# Configure: +16505553434 with code 123456
appId: com.spoodsjs.rewind
---
- launchApp
- tapOn:
    id: 'phone-input'
- inputText: '6505553434'
- tapOn:
    id: 'continue-button'
- assertVisible: 'Enter.*[Cc]ode'
- tapOn:
    id: 'code-input'
- inputText: '123456'
- tapOn:
    id: 'verify-button'
- assertVisible:
    id: 'success-screen'
```

### RNTL v13: Async Component Test

```javascript
// Source: @testing-library/react-native docs (React 19 guide)
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

test('StepIndicator shows correct step', async () => {
  await render(<StepIndicator currentStep={2} totalSteps={5} />);
  expect(screen.getByText('Step 2 of 5')).toBeTruthy();
});

test('button triggers action on press', async () => {
  const onPress = jest.fn();
  await render(<MyButton onPress={onPress} label="Submit" />);

  await fireEvent.press(screen.getByText('Submit'));
  expect(onPress).toHaveBeenCalledTimes(1);
});
```

### RNTL v13: Hook Test with renderHook

```javascript
// Source: RNTL docs renderHook API
import { renderHook, act } from '@testing-library/react-native';

test('useMentionSuggestions filters by query', async () => {
  // Setup mock friends list
  const friends = [
    { uid: 'u1', displayName: 'Alice' },
    { uid: 'u2', displayName: 'Bob' },
  ];

  const { result } = await renderHook(() => useMentionSuggestions(friends, 'ali'));

  expect(result.current.suggestions).toHaveLength(1);
  expect(result.current.suggestions[0].displayName).toBe('Alice');
});
```

### Cloud Functions: expo-server-sdk Mock

```javascript
// Source: expo-server-sdk-node tests + community patterns
jest.mock('expo-server-sdk', () => {
  const mockSend = jest.fn().mockResolvedValue([{ status: 'ok', id: 'receipt-123' }]);

  class MockExpo {
    constructor() {
      this.sendPushNotificationsAsync = mockSend;
      this.chunkPushNotifications = jest.fn(msgs => [msgs]);
      this.chunkPushNotificationReceiptIds = jest.fn(ids => [ids]);
      this.getPushNotificationReceiptsAsync = jest.fn().mockResolvedValue({});
    }
  }
  MockExpo.isExpoPushToken = jest.fn(
    token => typeof token === 'string' && token.startsWith('ExponentPushToken[')
  );
  return { Expo: MockExpo };
});
```

### Cloud Functions: Firestore Trigger Test with wrap()

```javascript
// Source: firebase-functions-test official docs
const firebaseFunctionsTest = require('firebase-functions-test');
const testEnv = firebaseFunctionsTest();

// Mock admin BEFORE requiring functions
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => ({
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    batch: jest.fn(() => ({ update: jest.fn(), commit: jest.fn().mockResolvedValue() })),
  })),
}));

const { sendReactionNotification } = require('../index');
const wrapped = testEnv.wrap(sendReactionNotification);

test('detects new reaction and sends notification', async () => {
  const before = testEnv.firestore.makeDocumentSnapshot(
    { userId: 'owner', reactions: {}, reactionCount: 0 },
    'photos/p1'
  );
  const after = testEnv.firestore.makeDocumentSnapshot(
    { userId: 'owner', reactions: { reactor: { '❤️': 1 } }, reactionCount: 1 },
    'photos/p1'
  );
  const change = testEnv.makeChange(before, after);

  await wrapped(change, { params: { photoId: 'p1' } });
  // Assert notification was sent
});

afterAll(() => testEnv.cleanup());
```

### Jest Config: Cloud Functions (Node environment)

```javascript
// functions/jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  clearMocks: true,
  forceExit: true, // firebase-admin keeps connections open
  detectOpenHandles: true,
  verbose: true,
};
```

</code_examples>

<sota_updates>

## State of the Art (2025-2026)

| Old Approach                        | Current Approach                      | When Changed    | Impact                                                         |
| ----------------------------------- | ------------------------------------- | --------------- | -------------------------------------------------------------- |
| Detox for Expo E2E                  | **Maestro** (Expo-recommended)        | 2024-2025       | Zero native config, YAML tests, EAS Workflow integration       |
| react-test-renderer                 | **@testing-library/react-native v13** | React 19 (2024) | react-test-renderer deprecated; RNTL has its own renderer      |
| @testing-library/react-hooks        | **RNTL renderHook** (built-in)        | RNTL v12+       | Separate package deprecated and merged into main libraries     |
| Synchronous render/fireEvent        | **Async render/fireEvent** (RNTL v13) | RNTL v13 (2024) | All main APIs return Promises for React 19 concurrent mode     |
| firebase-functions-test v1 callable | **v3.4.1 with v2 callable wrap()**    | 2024-2025       | Official support for wrapping v2 onCall functions              |
| Mocha for Cloud Functions           | **Jest** (community standard)         | 2023+           | Firebase docs still show Mocha, but Jest dominates in practice |

**New tools/patterns to consider:**

- **Maestro + EAS Workflows:** Pre-packaged CI job type for running Maestro tests on EAS-built binaries — first-class Expo integration
- **Firebase test phone numbers:** Configure in Firebase Console for deterministic E2E auth testing without real SMS
- **RNTL v13 `waitFor` improvements:** Better async utilities for testing React 19 Suspense boundaries and concurrent features

**Deprecated/outdated:**

- **react-test-renderer:** Officially deprecated in React 19, will be removed in future React version
- **@testing-library/react-hooks:** Merged into @testing-library/react and @testing-library/react-native; do not install separately
- **detox-expo-helpers:** Abandoned 3+ years, not maintained
- **Detox for Expo managed workflow:** No official support from Detox team ("community-driven effort")
  </sota_updates>

<open_questions>

## Open Questions

1. **Maestro + Firebase phone auth in CI**
   - What we know: Firebase test phone numbers (e.g., +16505553434 with code 123456) work in any E2E framework. Maestro can interact with the UI to enter these.
   - What's unclear: Whether the Expo dev-client build profile or a release simulator build is better for Maestro CI runs. EAS Workflows docs suggest a specific build profile.
   - Recommendation: Start with local Maestro testing, then configure EAS Workflow build profile for CI.

2. **Cloud Functions index.js helper extraction**
   - What we know: ~2500-line index.js has many non-exported helper functions (formatReactionSummary, getRandomTemplate, shouldSendNotification, revealUserPhotos) that can't be directly unit-tested.
   - What's unclear: Whether extracting these to separate modules is worth the effort vs testing them indirectly through wrap().
   - Recommendation: Test indirectly via wrap() for now. Extract only if test coverage gaps are discovered during implementation.

3. **Component test scope**
   - What we know: The CONTEXT.md says "don't chase 100% coverage" and values "fewer, broader tests that rarely need updating."
   - What's unclear: Which components, if any, merit dedicated component tests vs being covered by E2E flows.
   - Recommendation: Start with no component tests. Add them only for components with complex conditional logic (e.g., AuthCodeInput). E2E covers most component behavior.
     </open_questions>

<sources>
## Sources

### Primary (HIGH confidence)

- Expo docs: E2E tests with Maestro on EAS Workflows
- @testing-library/react-native v13 docs (React 19 guide, renderHook API)
- react-test-renderer deprecation notice (React 19 official)
- firebase-functions-test GitHub releases (v3.4.1, v2 callable support)
- Firebase official docs: Cloud Functions unit testing
- Maestro React Native support docs
- Detox official environment setup + Expo guide
- jest-expo changelog on GitHub (v54.x)
- expo-server-sdk-node GitHub tests

### Secondary (MEDIUM confidence)

- Detox GitHub issues #4842, #4849 (RN 0.81 compatibility, cross-verified with release notes)
- Expo SDK 54 changelog (cross-verified with npm packages)
- Multiple Detox vs Maestro comparison articles (cross-verified against official docs)
- React Compiler v1.0 documentation (effect on test transforms)
- firestore-jest-mock GitHub (limitations confirmed via source code review)

### Tertiary (LOW confidence - needs validation during implementation)

- @firebase-bridge/auth-context v0.0.2 (very new package, unproven)
- Maestro `runScript` for backend setup (limited JS engine, needs testing)
  </sources>

<metadata>
## Metadata

**Research scope:**

- Core technology: Jest + jest-expo for unit/integration, Maestro for E2E
- Ecosystem: RNTL v13, firebase-functions-test, expo-server-sdk mocking
- Patterns: Service tests, component tests, hook tests, trigger tests, YAML E2E flows
- Pitfalls: Detox/Expo incompatibility, React 19 async APIs, non-exported helpers, camera/push E2E limits

**Confidence breakdown:**

- Standard stack: HIGH — all recommendations from official docs
- Architecture: HIGH — test patterns from official RNTL/firebase-functions-test docs
- Pitfalls: HIGH — verified via GitHub issues, official deprecation notices, community reports
- Code examples: HIGH — from official docs and verified library tests

**Research date:** 2026-02-11
**Valid until:** 2026-03-13 (30 days — testing ecosystem is stable)
</metadata>

---

_Phase: 49-automated-test-suite_
_Research completed: 2026-02-11_
_Ready for planning: yes_
