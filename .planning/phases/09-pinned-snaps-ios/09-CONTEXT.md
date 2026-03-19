# Phase 9: Pinned Snaps iOS - Context

**Gathered:** 2026-03-18 (updated — fix-and-verify direction, replacing gap closure plans)
**Status:** Fix and verify — resolve device testing issues, validate all 5 success criteria

<domain>
## Phase Boundary

Allow senders to pin a snap to the recipient's iOS lock screen as a Live Activity. The Live Activity shows the snap photo thumbnail with Polaroid frame and optional caption. Tapping opens the conversation. The Live Activity persists until the snap is viewed — even if swiped away. Android pinned snaps are a separate phase (Phase 10).

**HISTORY:** Original Live Activity infrastructure built (plans 01-07). Briefly pivoted to persistent notifications (plans 08-09) but user testing showed notifications couldn't achieve the custom layout. Reverted back to Live Activities (commit 1dee950). Gap closure plans 11-13 executed. Round 2 device testing found 4 issues (09-ISSUES-R2.md). Now fixing those issues and verifying all success criteria.

**DIRECTION (this update):** Stay on Live Activities. Fix the remaining issues. Verify end-to-end on physical devices. Phase is done when all 5 roadmap success criteria pass.

</domain>

<decisions>
## Implementation Decisions

### Pin toggle placement & design (UNCHANGED — already implemented)
- Toggle on send confirmation screen, pixel-art pin icon with toggle switch
- Default off, sticky per friend (remembers last choice per conversation)
- First-time tooltip, pin toggle only in 1:1 conversations

### Live Activity appearance (UNCHANGED decisions, VISUAL FIXES needed)
- Large photo thumbnail with Polaroid-style white frame
- Caption to the right if present; centered Polaroid only if no caption
- Flick dark background (#0A0A1A), monospaced font for text

### Thumbnail pipeline debug (NEW — diagnostic-first approach)
- Add granular step-by-step logging at every pipeline point: Cloud Function payload -> Expo Push -> NSE download -> App Groups write -> widget read
- Verify Cloud Function payload format: confirm pinnedThumbnailUrl reaches the push payload correctly (likely root cause)
- Use existing getNSEDiagnostics() from Settings screen — no new debug screen needed
- Ensure NSE diagnostics log covers every step of the thumbnail download pipeline
- Graceful error messages at each stage so next build reveals exactly where it breaks

### Background Live Activity fix (NEW — two-pronged approach)
- **Prong 1: Fix NSE** — NSE must reliably start Live Activities in background/killed states. Verify _mutableContent reaches APNs as mutable-content:1 via Cloud Function logging. Claude decides whether to fix via Expo Push or switch to direct APNs/FCM for pinned snaps.
- **Prong 2: Foreground-resume fallback** — Every time app transitions to foreground (AppState 'active'), scan delivered notifications for unhandled pinned snaps and start Live Activities for any that don't have a running activity. Belt-and-suspenders.
- Goal: Live Activity appears in ALL three app states (foreground, background, killed)

### Polaroid visual fixes (NEW — Issues 3+4 combined)
- **Fit within 160pt max height** — Apple's lock screen Live Activity height limit. Properly proportioned Polaroid within this constraint. Photo ~104-112pt tall. Claude decides exact dimensions.
- **Sharp corners inside, slightly rounded outside** — Remove RoundedRectangle clipShape from inner photo (use plain .clipped()). Outer white Polaroid frame gets subtle 2-3pt corner rounding.
- **Thicker borders** — Increase side/top padding to ~6-8pt. Increase bottom padding to ~20-24pt (classic Polaroid proportions: bottom is 3-4x the side border).
- **Add tilt** — Slight deterministic pseudo-random rotation (-4 to +4 degrees) based on activityId hash. Each snap looks casually placed. Consistent per snap.

### Persistence & dismissal (UNCHANGED — already implemented)
- Live Activity persists until snap viewed, re-creates on swipe-away
- 48-hour auto-expiry via staleDate
- Viewing snap in SnapViewer calls endActivity

### Multiple pinned snaps (UPDATED — stacking replaces per-snap model)
- Multiple pinned snaps now stack into a single Live Activity with overlapping Polaroids (replaces the previous one-activity-per-snap model, cap of 5)
- Single snap renders with existing Polaroid + caption layout; 2+ snaps show stacked Polaroids with count summary
- Viewing a snap removes it from the stack; last snap removal ends the Live Activity
- Stack capped at 10 entries (4KB ContentState limit)

### Verification strategy (NEW)
- **Test setup:** Android device sends pinned snaps, iOS device receives
- **Test matrix:** All three app states — foreground, background, killed
- **Build strategy:** Bundle all fixes into ONE EAS build, then run full test matrix
- **Done criteria:** All 5 roadmap success criteria must pass:
  1. Pin toggle works on send confirmation screen
  2. Live Activity shows with real photo thumbnail (not "F"), sender name, optional caption
  3. Tapping Live Activity opens conversation
  4. Viewing snap dismisses the Live Activity
  5. Swiping away re-creates the Live Activity until viewed

### Claude's Discretion
- Exact Polaroid frame dimensions within 160pt constraint
- Whether to fix mutableContent via Expo Push or switch to direct FCM for pinned snaps
- Exact implementation of foreground-resume fallback (AppState listener vs notification delivered check)
- Thumbnail download retry/error handling details
- NSE diagnostic logging granularity
- How to deterministically derive tilt angle from activityId

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Device testing issues
- `.planning/phases/09-pinned-snaps-ios/09-ISSUES-R2.md` — 4 issues from round 2 device testing (2 critical, 2 medium). This is the primary input for fix planning.

### Existing implementation (plans already executed)
- `.planning/phases/09-pinned-snaps-ios/09-11-SUMMARY.md` — Thumbnail pipeline fix (300px, download to cache)
- `.planning/phases/09-pinned-snaps-ios/09-12-SUMMARY.md` — Polaroid frame and portrait layout (current dimensions that need fixing)
- `.planning/phases/09-pinned-snaps-ios/09-13-SUMMARY.md` — Live Activity persistence via ActivityState observation

### Key source files
- `modules/live-activity-manager/src/LiveActivityManagerModule.swift` — Native Expo module (ActivityKit bridge, persistence tracking, diagnostics)
- `targets/FlickLiveActivity/FlickLiveActivityWidget.swift` — Widget SwiftUI layout (Polaroid frame, thumbnail display)
- `targets/FlickNotificationService/NotificationService.swift` — NSE (thumbnail download, Live Activity start for background/killed states)
- `src/services/liveActivityService.js` — JS bridge service
- `App.js` (lines 340-373) — Foreground notification handler for pinned snaps
- `src/components/SnapViewer.js` (lines 199-239) — Live Activity dismissal on snap view
- `src/services/firebase/snapService.js` (lines 182-211) — Pinned snap thumbnail generation and upload
- `functions/index.js` / `functions/notifications/sender.js` — Cloud Function notification payload

### Config
- `app.json` (lines 79-109) — Plugin order, entitlements, NSSupportsLiveActivities
- `plugins/withNSELiveActivities.js` — NSE plist key config plugin
- `targets/FlickLiveActivity/expo-target.config.js` — Widget target config
- `targets/FlickNotificationService/expo-target.config.js` — NSE target config

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LiveActivityManagerModule.swift` — Full ActivityKit bridge with start/end/diagnose/getNSEDiagnostics. Already has persistence tracking and observation.
- `NotificationService.swift` — NSE with thumbnail download, Activity.request(), deduplication, diagnostic logging (last 10 invocations)
- `liveActivityService.js` — JS bridge with platform guards, lazy module loading, graceful Android fallback
- `FlickLiveActivityWidget.swift` — SwiftUI widget with polaroidFrame ViewBuilder, conditional layout

### Established Patterns
- Service layer returns `{ success, error }` objects — liveActivityService follows this
- NSE writes diagnostics to App Groups JSON (`group.com.spoodsjs.flick/nse-diagnostics.json`)
- Thumbnail storage: `snap-thumbnails/{snapId}.jpg` in Firebase Storage, copied to `group.com.spoodsjs.flick/thumbnails/{activityId}.jpg` in App Groups
- Three PinnedSnapAttributes copies must stay in sync (widget, NSE, native module)
- Plugin order critical: `withNSELiveActivities` before `@bacons/apple-targets` in app.json

### Integration Points
- Cloud Function notification payload (sender.js) — must include pinned fields and _mutableContent
- App.js AppState listener — new foreground-resume fallback hooks into existing foreground detection
- SnapViewer — already calls endPinnedSnapActivity on snap view
- Settings screen — already has getNSEDiagnostics() access

</code_context>

<specifics>
## Specific Ideas

- The Live Activity should feel like a Polaroid instant photo casually placed on the lock screen (slight tilt reinforces this)
- Re-creation after swipe-away is critical — the snap stays pinned until viewed, period
- Diagnostic-first debugging: the next build should tell us exactly what's broken, not require another guess-and-check cycle
- All fixes go in one EAS build to minimize build-test cycle overhead
- Android sender + iOS receiver is the test setup

</specifics>

<deferred>
## Deferred Ideas

- Custom notification sound for pinned snaps — potential future polish
- Dynamic Island expanded view (currently minimal/empty)
- Custom pixel font (Silkscreen) in widget — @bacons/apple-targets doesn't support font embedding yet

</deferred>

---

*Phase: 09-pinned-snaps-ios*
*Context gathered: 2026-03-18*
