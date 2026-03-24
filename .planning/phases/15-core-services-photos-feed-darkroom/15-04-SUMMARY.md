---
phase: 15-core-services-photos-feed-darkroom
plan: 04
subsystem: ui
tags: [react-native, powersync, supabase, strangler-fig]

requires:
  - phase: 15-03
    provides: useDarkroom.ts and useFeedPhotos.ts hooks
provides:
  - DarkroomScreen wired to PowerSync-backed useDarkroom hook
  - FeedScreen wired to TanStack-backed useFeedPhotos hook
  - useCameraBase creates photo records via PowerSync on capture
  - App.js foreground reveal uses Supabase darkroomService
affects: [phase-13-auth, phase-16-messaging]

tech-stack:
  added: [react-native-url-polyfill]
  patterns: [lazy-powersync-init, proxy-pattern-for-deferred-init]

key-files:
  created: []
  modified:
    - src/screens/DarkroomScreen.js
    - src/screens/FeedScreen.js
    - src/hooks/useCameraBase.js
    - App.js
    - src/lib/supabase.ts
    - src/lib/powersync/database.ts

key-decisions:
  - "DarkroomScreen keeps explicit .js import for useDarkroom — .ts version has incompatible return shape (data-only vs full UI logic)"
  - "Firebase feedService imports retained for stories/reactions — out of Phase 15 scope"
  - "PowerSync database uses lazy Proxy init to avoid SQLite crash at module load time"
  - "Polyfill import changed from dist/polyfill to /auto for react-native-url-polyfill v3"

patterns-established:
  - "Lazy PowerSync init: use Proxy wrapper so database is created on first access, not at import time"
---

## What was built

Wired all four target files (DarkroomScreen, FeedScreen, useCameraBase, App.js) to consume the new Supabase/PowerSync services and hooks from Plans 01-03. This completes the strangler fig switch for Phase 15's scope.

## Changes

1. **useDarkroom.js** — Replaced Firebase reveal chain with single `checkAndRevealPhotos` call from darkroomService.ts
2. **useCameraBase.js** — Replaced Firebase `getDarkroomCounts` with PowerSync queries; added `createPhotoRecord` + `calculateBatchRevealAt` before upload
3. **FeedScreen.js** — Now uses useFeedPhotos.ts hook (TanStack Query + Supabase RPC) with local photoOverrides for optimistic reactions
4. **App.js** — Foreground reveal uses Supabase auth + `checkAndRevealPhotos`

## Infrastructure fixes

- Fixed `react-native-url-polyfill` import path for v3 compatibility
- Made PowerSync database initialization lazy via Proxy to prevent SQLite crash at import time
- Added `existingPhotoId` param to uploadQueueService for PowerSync/upload ID sharing

## Deviations

- DarkroomScreen uses explicit `.js` import to prevent Metro resolving incompatible `.ts` hook
- Firebase feedService imports retained for stories/reactions (out of scope)
- `handleRecordingComplete` made async for PowerSync calls

## Self-Check: PASSED
