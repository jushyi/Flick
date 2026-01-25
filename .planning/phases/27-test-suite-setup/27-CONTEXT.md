# Phase 27: Test Suite Setup - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<vision>
## How This Should Work

A safety net for refactoring — tests that catch regressions when changing code. When I modify a service or fix a bug, I want to run the test suite and know immediately if I broke something that was working.

The tests should work at both levels:

- **Service-level tests** — Test the Firebase services (authService, photoService, friendshipService, etc.) with mocked Firestore, verifying the logic works correctly
- **Integration tests** — Test how services work together for critical flows like photo capture → upload → darkroom

Standard Jest setup with manual mocks for Firebase. No need for Firebase emulator suite — keep it straightforward.

</vision>

<essential>
## What Must Be Nailed

- **Firebase mocking infrastructure** — Get the mock setup right so tests are reliable, fast, and don't hit real Firebase
- **Auth flow coverage** — Tests that verify login, logout, session persistence work correctly
- **Photo lifecycle tests** — Tests for capture → developing → reveal → triage flow
- **Friendship state tests** — Friend requests, acceptance, feed filtering edge cases

All four areas feel fragile when making changes — the test suite needs to cover all of them evenly.

</essential>

<boundaries>
## What's Out of Scope

- **No UI/component tests** — Skip React component testing, focus on service logic only
- **No E2E tests** — Skip end-to-end testing (Detox, etc.) — that's a separate effort
- Focus purely on service-level and integration tests

</boundaries>

<specifics>
## Specific Ideas

- Standard Jest setup with manual mocks
- Tests should run fast — quick feedback loop while coding
- Run tests before pushing and feel confident nothing is broken
- When something breaks, tests tell me exactly what and where — clear failure messages

</specifics>

<notes>
## Additional Context

Multiple areas of the codebase feel fragile:

- Auth flows (login/logout/session handling)
- Darkroom timing logic (reveal timing is complex)
- Friendship state (many edge cases in requests, acceptance, feed filtering)

The test suite is the safety net that makes refactoring in Phase 28 possible.

</notes>

---

_Phase: 27-test-suite-setup_
_Context gathered: 2026-01-25_
