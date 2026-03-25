---
phase: 19-performance-polish
plan: 02
subsystem: ui, utils
tags: [supabase-storage, image-transforms, cdn, signed-urls, empty-state, pixel-art, tdd]

# Dependency graph
requires:
  - phase: 13-auth-storage-migration
    provides: Supabase Storage CDN URLs, signed URLs for snaps
  - phase: 14-data-layer-caching-foundation
    provides: TanStack Query config, query key factory
provides:
  - imageUrl.ts utility with getTransformedPhotoUrl (storagePath) and appendTransformParams (fullUrl) for responsive image sizing
  - Signed URL expiry detection (getSignedUrlExpiry, isUrlNearExpiry) for proactive URL refresh
  - FEED_CARD_WIDTH constant (400px) for feed card image sizing
  - EmptyState shared component with pixel art icon, message, and optional CTA
affects: [19-03-skeleton-screens, 19-04-feed-optimization, 19-05-optimistic-updates]

# Tech tracking
tech-stack:
  added: []
  patterns: [supabase-image-transform-url, base64-jwt-decode-with-fallback, shared-empty-state-component]

key-files:
  created:
    - src/utils/imageUrl.ts
    - src/components/EmptyState.tsx
    - __tests__/utils/imageUrl.test.ts
    - __tests__/components/EmptyState.test.tsx
  modified: []

key-decisions:
  - "Buffer.from with atob fallback for base64 JWT decode -- ensures cross-environment compatibility"
  - "appendTransformParams replaces /object/public/ with /render/image/public/ -- Supabase image transform API pattern"
  - "isUrlNearExpiry returns true when expiry is unparseable -- fail-safe treats unknown as expired"

patterns-established:
  - "Image transform dual-path: getTransformedPhotoUrl(storagePath) for uploads, appendTransformParams(fullUrl) for feed RPC data"
  - "EmptyState as ListEmptyComponent: icon + message + optional CTA with consistent pixel art styling"

requirements-completed: [PERF-05, PERF-06, PERF-07]

# Metrics
duration: 8min
completed: 2026-03-25
---

# Phase 19 Plan 02: Image URL Utilities & EmptyState Summary

**CDN image transform helpers (storagePath and fullUrl variants) with signed URL expiry detection, plus shared pixel-art EmptyState component**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-25T14:49:23Z
- **Completed:** 2026-03-25T14:57:00Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- imageUrl.ts with two transform entry points: getTransformedPhotoUrl for storage paths, appendTransformParams for full CDN URLs
- Signed URL expiry detection with Buffer.from/atob fallback for cross-environment safety
- EmptyState component matching UI-SPEC exactly: PixelIcon + SpaceMono message + Silkscreen CTA
- 21 total tests (15 imageUrl + 6 EmptyState), all passing via TDD

## Task Commits

Each task was committed atomically:

1. **Task 1: Create imageUrl.ts utility** - `496d294f` (feat)
2. **Task 2: Create EmptyState component** - `277ff2f1` (feat)

_Both tasks followed TDD: RED (failing tests) -> GREEN (implementation) -> verify_

## Files Created/Modified
- `src/utils/imageUrl.ts` - CDN transform URL helpers and signed URL expiry detection
- `src/components/EmptyState.tsx` - Shared empty state with pixel art icon, message, optional CTA
- `__tests__/utils/imageUrl.test.ts` - 15 tests including Buffer.from canary
- `__tests__/components/EmptyState.test.tsx` - 6 tests covering rendering and interaction

## Decisions Made
- Buffer.from with atob fallback for JWT decode: ensures compatibility across Node.js, React Native, and environments where Buffer may not be available
- appendTransformParams uses URL string replacement rather than URL parsing: simpler, avoids edge cases with Supabase URL structure
- isUrlNearExpiry defaults to true (expired) when expiry cannot be determined: fail-safe ensures stale URLs are always refreshed

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all exports are fully implemented with real logic.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- imageUrl.ts ready for use by feed optimization (Plan 04) via appendTransformParams(imageUrl, { width: FEED_CARD_WIDTH })
- EmptyState ready for integration into all list views as ListEmptyComponent
- isUrlNearExpiry ready for proactive snap URL refresh logic

---
*Phase: 19-performance-polish*
*Completed: 2026-03-25*
