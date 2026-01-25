---
type: summary
plan: 27-02
phase: 27
status: completed
started: 2026-01-25
completed: 2026-01-25
---

# Plan 27-02 Summary: Unit Tests for Core Services

## Overview

This plan implemented comprehensive unit tests for three core Firebase services:

- `phoneAuthService.js` - Phone authentication with SMS verification
- `photoService.js` - Photo CRUD, lifecycle, and reactions
- `darkroomService.js` - Reveal timing and scheduling

## Test Summary

| Service          | Test Cases | Categories Covered                                                                                                                                                                                             |
| ---------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| phoneAuthService | 46         | validatePhoneNumber (9), getPhoneAuthErrorMessage (15), sendVerificationCode (7), verifyCode (12), getCurrentUser (1), signOut (2), onAuthStateChanged (1)                                                     |
| photoService     | 29         | createPhoto (4), getUserPhotos (3), getDevelopingPhotoCount (3), getDarkroomCounts (2), getDevelopingPhotos (2), revealPhotos (3), triagePhoto (4), addReaction (3), removeReaction (2), batchTriagePhotos (3) |
| darkroomService  | 16         | getDarkroom (3), isDarkroomReadyToReveal (5), scheduleNextReveal (2), ensureDarkroomInitialized (6)                                                                                                            |

**Total: 91 new tests, 113 tests in total test suite**

## Implementation Details

### phoneAuthService Tests

**Approach**: Uses real `libphonenumber-js` library for validation tests to avoid complex Jest mock hoisting issues. Firebase auth functions are mocked.

**Key Test Categories**:

- Phone number validation with various inputs (valid US/UK, empty, null, invalid)
- Firebase error code to user-friendly message mapping (all 10+ error codes)
- SMS verification code sending with Firebase error handling
- Code verification with input validation and Firebase error handling
- Auth state management (getCurrentUser, signOut, onAuthStateChanged)

### photoService Tests

**Approach**: Mocks all Firestore functions, storage service, and darkroom service. Tests verify correct Firestore calls and error handling.

**Key Test Categories**:

- Photo creation with upload rollback on failure
- Query operations (getUserPhotos, getDevelopingPhotoCount, getDarkroomCounts)
- Photo lifecycle (revealPhotos, triagePhoto with journal/archive/delete)
- Reaction management (add, remove, preserve existing)
- Batch operations (batchTriagePhotos)

### darkroomService Tests

**Approach**: Mocks Firestore functions and uses controlled mock timestamps for timing tests.

**Key Test Categories**:

- Darkroom get/create operations
- Reveal timing checks (past, future, equal, null nextRevealAt)
- Scheduling next reveal time
- Initialization with stale timing handling and photo reveal

## Deviations

### Auto-Fixed: libphonenumber-js Mocking

**Issue**: Jest's mock hoisting made it impossible to properly mock `libphonenumber-js` - the mock factory executed before the mock function variables were defined.

**Solution**: Changed approach to use the real `libphonenumber-js` library for validation tests. This is actually a better testing approach as it tests the real integration behavior. Firebase auth was mocked successfully using the standard pattern.

**Impact**: Tests are more realistic and test actual phone validation behavior.

## Files Created

- `__tests__/services/phoneAuthService.test.js` (464 lines)
- `__tests__/services/photoService.test.js` (~500 lines)
- `__tests__/services/darkroomService.test.js` (~350 lines)

## Commits

1. `test(27-02): write phoneAuthService unit tests` - 46 tests for phone auth
2. `test(27-02): write photoService and darkroomService unit tests` - 45 tests for photo and darkroom services

## Verification

All 113 tests pass:

```
Test Suites: 4 passed, 4 total
Tests:       113 passed, 113 total
```

## Notes for Future Development

1. **Test Data Factories**: The `testFactories.js` file provides reusable factories for creating test data. Future tests should leverage these.

2. **Mock Pattern**: The tests demonstrate a working pattern for mocking Firestore's modular API - create mock functions at module level, then use `jest.mock()` with factory functions that call those mocks.

3. **Error Handling**: All services follow a consistent `{ success, error }` return pattern which makes testing straightforward.
