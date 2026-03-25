---
phase: 20-typescript-sweep-firebase-removal
plan: 04
subsystem: hooks
tags: [typescript, hooks, camera, swipeable, photo-detail, messaging, firebase-removal]

requires:
  - phase: 20-01
    provides: TypeScript foundation, type definitions in src/types/

provides:
  - All 17+ hook files in src/hooks/ converted to TypeScript
  - Zero .js files remaining in src/hooks/
  - Zero any types across all hook .ts files
  - Zero Firebase imports in hooks (useMessageActions migrated to Supabase)

affects: [20-05, 20-06, 20-08]

tech-stack:
  added: []
  patterns:
    - "useAuth() as unknown as { user/userProfile } pattern for JS context typing"
    - "useOptimisticMutation updaters with inferred TVariables (no explicit vars typing)"

key-files:
  created:
    - src/hooks/useCameraBase.ts
    - src/hooks/useCamera.ios.ts
    - src/hooks/useCamera.android.ts
    - src/hooks/useSwipeableCard.ts
    - src/hooks/usePhotoDetailModal.ts
    - src/hooks/useViewedStories.ts
    - src/hooks/useScreenshotDetection.ts
    - src/hooks/usePinPreference.ts
    - src/hooks/useMessageActions.ts
  modified:
    - src/hooks/useOptimisticMutation.ts
    - src/hooks/useComments.ts
    - src/hooks/useAlbums.ts
    - src/hooks/useBlocks.ts
    - src/hooks/useConversation.ts
    - src/hooks/useMessages.ts
    - src/hooks/useStreaks.ts

key-decisions:
  - "useAuth() requires as unknown as cast because AuthContext.js lacks exported types"
  - "useOptimisticMutation updaters use inferred vars types to avoid TVariables mismatch"
  - "useMessageActions migrated from Firebase Cloud Functions to Supabase messageService"
  - "ZoomLevel and UseCameraBaseReturn types exported from useCameraBase for platform hooks"

patterns-established:
  - "Platform-specific hooks (useCamera.ios.ts, useCamera.android.ts) import shared types from base hook"
  - "SharedValue<boolean> for keyboard-visible guards in gesture worklets"

requirements-completed: [TS-02]

duration: 21min
completed: 2026-03-25
---

# Phase 20 Plan 04: Hooks TypeScript Conversion Summary

**All 17 hook JS files converted to TypeScript with typed parameters, returns, state, refs, and callbacks -- zero any types, zero Firebase imports**

## Performance

- **Duration:** 21 min
- **Started:** 2026-03-25T18:28:33Z
- **Completed:** 2026-03-25T18:49:52Z
- **Tasks:** 2
- **Files modified:** 26

## Accomplishments
- Converted 8 camera and core interaction hooks from JS to fully typed TS (useCameraBase, useCamera.ios, useCamera.android, useSwipeableCard, usePhotoDetailModal, useViewedStories, useScreenshotDetection, usePinPreference)
- Converted useMessageActions from Firebase Cloud Functions to Supabase messageService import
- Deleted 15 .js hook files (8 new conversions + 7 that had existing .ts Supabase rewrites)
- Eliminated all any types across all hook .ts files including pre-existing ones in useOptimisticMutation, useComments, useAlbums, useBlocks, useConversation, useMessages

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert camera and core interaction hooks to TypeScript** - `f5e589be` (feat)
2. **Task 2: Convert messaging and social hooks to TypeScript** - `d9736800` (feat)

## Files Created/Modified
- `src/hooks/useCameraBase.ts` - Shared camera logic with ZoomLevel type, layout constants, UseCameraBaseReturn
- `src/hooks/useCamera.ios.ts` - iOS camera with ultra-wide lens detection, typed zoom levels
- `src/hooks/useCamera.android.ts` - Android camera with digital zoom only
- `src/hooks/useSwipeableCard.ts` - Gesture handling with SharedValue types, SwipeableCardHandle
- `src/hooks/usePhotoDetailModal.ts` - 1148-line modal hook with full type coverage
- `src/hooks/useViewedStories.ts` - Viewed stories state with typed Set operations
- `src/hooks/useScreenshotDetection.ts` - Screenshot detection with typed listener ref
- `src/hooks/usePinPreference.ts` - Pin preference with typed AsyncStorage operations
- `src/hooks/useMessageActions.ts` - Message actions migrated from Firebase to Supabase
- `src/hooks/useOptimisticMutation.ts` - Replaced any with unknown in MultiKeyUpdater interface
- `src/hooks/useComments.ts` - Added CachedComment type, removed any from updaters
- `src/hooks/useAlbums.ts` - Added CachedAlbumDetail type, removed any from updaters
- `src/hooks/useBlocks.ts` - Typed block cache entries, removed any from updaters
- `src/hooks/useConversation.ts` - Fixed AuthContext cast, typed mark-as-read updater
- `src/hooks/useMessages.ts` - Fixed error catch typing, AuthContext cast
- `src/hooks/useStreaks.ts` - Fixed AuthContext cast for strict TypeScript

## Decisions Made
- useAuth() requires `as unknown as` double-cast because AuthContext.js is untyped -- will resolve when AuthContext.js is converted to .ts
- useOptimisticMutation updaters use inferred variable types instead of explicit annotations to avoid TVariables generic mismatch
- useMessageActions.handleUnsend migrated from Firebase `httpsCallable('unsendMessage')` to Supabase `unsendMessage()` import
- ZoomLevel type exported from useCameraBase to share across platform-specific hooks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Eliminated any types in pre-existing hook .ts files**
- **Found during:** Task 2
- **Issue:** useOptimisticMutation, useComments, useAlbums, useBlocks, useConversation, useMessages had any types from earlier phases
- **Fix:** Replaced with proper types (unknown, CachedComment, CachedAlbumDetail, etc.) and let TypeScript infer updater variable types
- **Files modified:** useOptimisticMutation.ts, useComments.ts, useAlbums.ts, useBlocks.ts, useConversation.ts, useMessages.ts, useStreaks.ts
- **Verification:** `grep -r ": any" src/hooks/ --include="*.ts"` returns 0 results
- **Committed in:** d9736800

---

**Total deviations:** 1 auto-fixed (Rule 2 - correctness)
**Impact on plan:** Necessary to meet plan acceptance criteria of zero any types across all hook files.

## Issues Encountered
- useAnimatedStyle return type in useSwipeableCard required explicit ViewStyle assertion due to conditional transform array shapes creating discriminated union types
- Pre-existing useProfile.ts TS error (Supabase typed client mismatch) remains -- out of scope for this plan

## Known Stubs
None -- all hooks have complete implementations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All hooks are TypeScript with typed parameters and returns
- Ready for screen/component TypeScript conversion in plan 05+
- AuthContext.js conversion will eliminate the `as unknown as` pattern

---
*Phase: 20-typescript-sweep-firebase-removal*
*Completed: 2026-03-25*
