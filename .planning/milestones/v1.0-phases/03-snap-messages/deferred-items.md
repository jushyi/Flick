# Deferred Items - Phase 03: Snap Messages

## Pre-existing Test Failures (Out of Scope)

### 1. photoLifecycle.test.js - 3 failures

- `should create photo with developing status and call ensureDarkroomInitialized`
- `should roll back photo document if storage upload fails`
- `should create photo with correct initial fields`
- **Origin:** Pre-existing since commit b85473d (Phase 50.1 partial fix)
- **Impact:** None on snap functionality

### 2. SettingsScreen.test.js - 5 failures

- Toggle-related tests failing due to missing `OFF` text element
- **Origin:** Pre-existing since commit b757444 (Phase 01-02)
- **Impact:** None on snap functionality

### 3. Cloud Functions: notifications.test.js - 1 failure

- `should not update lastMessage or unreadCount for reaction messages`
- **Origin:** Pre-existing from Phase 2 reaction work
- **Impact:** None on snap functionality

### 4. CRLF line ending errors in photoService.test.js

- All errors are `Delete ␍` (prettier/prettier) - Windows line ending issue
- **Origin:** Pre-existing
- **Impact:** None on snap functionality
