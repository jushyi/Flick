# Phase 13: Auth & Storage Migration - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can authenticate and upload/view media through Supabase. Phone OTP login works for new users, existing Firebase Auth accounts are migrated silently with preserved identity, and all photo/video/snap storage operations target Supabase Storage. This phase rewrites phoneAuthService, storageService, signedUrlService, uploadQueueService, and the auth screens. No service layer rewrites beyond auth/storage (those are Phase 15+).

</domain>

<decisions>
## Implementation Decisions

### Auth migration strategy
- Phone-linked migration: import existing users into Supabase Auth by phone number
- On first launch after update, app detects Firebase token, calls Edge Function that verifies Firebase token and creates/links a Supabase session
- Silent migration -- user sees normal loading, auth migrates behind the scenes. If migration fails, fall back to re-verification screen
- Phone number is the natural linking key between Firebase and Supabase
- New Supabase UUIDs assigned; store `firebase_uid` column on users table for migration lookups. All FK references use new Supabase UUIDs
- Auth screens (PhoneInputScreen, VerificationScreen) rewritten to use Supabase Auth phone OTP directly (clean break, not adapter layer)
- phoneAuthService.js rewritten for Supabase Auth
- PhoneAuthContext updated for Supabase OTP flow (Supabase phone OTP may not need the non-serializable ConfirmationResult pattern -- research needed)

### Storage URL transition
- Batch migration script transfers ALL files from Firebase Storage to Supabase Storage (photos, videos, profile photos, selects photos, comment images)
- Complete cutover so Firebase Storage can be fully decommissioned after migration
- Supabase Storage bucket structure mirrors Firebase paths: `photos/{userId}/{photoId}.jpg`, `profile-photos/{userId}/profile.jpg`, `selects/{userId}/select_{index}.jpg`
- Regular (non-snap) photos served via public CDN URLs -- no signing, no URL expiry, no expired URL flash. Access control via RLS on photos table, not file-level
- Database migration updates all URL references from Firebase Storage URLs to Supabase Storage CDN URLs

### Snap signed URL approach
- Snaps stored in a private Supabase Storage bucket
- Client calls Supabase Storage `createSignedUrl()` which respects RLS policies (only conversation participants can generate URLs)
- 5-minute expiry preserved for snap URLs
- No Edge Function needed for snap URL generation -- RLS handles access control
- Snap cleanup via database trigger: when snap message is marked as viewed, a PostgreSQL trigger or Supabase webhook fires an Edge Function to delete the file from storage (immediate cleanup, same behavior as current onSnapViewed)
- signedUrlService.js rewritten in this phase -- much simpler since regular photos use public URLs and snaps use Supabase's built-in createSignedUrl()

### Upload queue switchover
- Atomic rewrite of uploadQueueService.js to target Supabase Storage + Supabase DB
- Drain-then-switch: any items stuck in old AsyncStorage queue at update time get drained via Firebase path first, then switch to new backend
- Queue persistence moves from AsyncStorage to PowerSync local SQLite table (aligns with Phase 12 sync infrastructure)
- Image compression updated: switch to WebP format at 0.9 quality (WebP at 0.9 is still smaller than JPEG at 0.8, sharper photos)
- Profile photo compression also updated to WebP
- Video handling unchanged (no compression, format stays .mov/.mp4)

### Claude's Discretion
- Exact Edge Function implementation for Firebase-to-Supabase token bridge
- Supabase Storage bucket RLS policy syntax and configuration
- PowerSync local-only table schema for upload queue
- Migration script architecture (batch size, parallelism, error handling)
- Whether Supabase phone OTP still requires a ConfirmationResult-like pattern or is simpler
- Thumbnail generation approach (keep current 20px base64 or adjust)
- Exact WebP compression parameters and expo-image-manipulator configuration

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack & architecture decisions
- `.planning/research/STACK.md` -- Supabase Auth, Storage, and client SDK selection rationale
- `.planning/research/ARCHITECTURE.md` -- Strangler Fig migration pattern, service layer restructuring, data flow changes
- `.planning/research/PITFALLS.md` -- Auth migration risks, storage migration gotchas

### Phase 12 foundation (prerequisite)
- `.planning/phases/12-schema-infrastructure-foundation/12-CONTEXT.md` -- Schema design decisions (snake_case, RLS approach, PowerSync sync scope, dev environment)

### Requirements
- `.planning/REQUIREMENTS.md` -- AUTH-01, AUTH-02, AUTH-03, STOR-01, STOR-02, STOR-03, STOR-04
- `.planning/ROADMAP.md` -- Phase 13 success criteria (6 items)

### Project context
- `.planning/PROJECT.md` -- Key decisions, constraints (dev-first migration, functionally identical, offline media capture non-negotiable)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/firebase/phoneAuthService.js` -- Current phone auth API (sendVerificationCode, verifyCode). Export signature is the contract to preserve
- `src/services/firebase/storageService.js` -- Upload functions (uploadPhoto, uploadVideo, uploadProfilePhoto, uploadSelectsPhotos, deleteProfilePhoto). All return `{ success, downloadURL/error }`
- `src/services/firebase/signedUrlService.js` -- getSignedPhotoUrl via Cloud Function. Will be greatly simplified
- `src/services/uploadQueueService.js` (466 lines) -- Queue lifecycle: init, add, process, retry, persist. Key patterns: sequential processing, exponential backoff (2s/4s/8s, max 3 attempts), AsyncStorage persistence, thumbnail generation
- `src/services/firebase/accountService.js` -- Account deletion Cloud Function calls. Re-auth flow needs Supabase equivalent
- `src/context/AuthContext.js` -- Firebase user state, profile sync, signOut cleanup. Core integration point
- `src/context/PhoneAuthContext.js` -- Shares ConfirmationResult ref between screens. May be simplified with Supabase OTP

### Established Patterns
- Service layer: all operations return `{ success, error, data }` -- preserve this pattern
- Storage paths: `photos/{userId}/{photoId}.jpg`, `profile-photos/{userId}/profile.jpg`, `selects/{userId}/select_{index}.jpg`
- Image compression: expo-image-manipulator for resize + compress before upload
- Thumbnail: 20px wide JPEG base64 generated before upload (stored in photo document)
- Auth state: onAuthStateChanged listener in AuthContext drives navigation

### Integration Points
- `src/screens/PhoneInputScreen.js` and `src/screens/VerificationScreen.js` -- Auth entry points, need Supabase OTP calls
- `src/screens/DeleteAccountScreen.js` -- Re-auth via phone before deletion scheduling
- `src/screens/ProfileSetupScreen.js` and `src/screens/EditProfileScreen.js` -- Profile photo upload consumers
- `src/hooks/useCamera.js` -- Calls uploadQueueService.addToQueue() after capture
- `App.js` -- Auth state listener, FCM token management, dark room checks on foreground

</code_context>

<specifics>
## Specific Ideas

- Silent migration preferred: user should never know their auth backend changed. Normal loading screen, migration happens behind the scenes
- WebP + higher quality (0.9) for all photo uploads going forward -- leverages CDN bandwidth advantage
- Complete Firebase Storage decommission is the goal -- no lingering Firebase dependency after this phase
- Drain-then-switch for upload queue ensures zero media loss during the transition (non-negotiable constraint from PROJECT.md)

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 13-auth-storage-migration*
*Context gathered: 2026-03-23*
