# Project Issues Log

Enhancements discovered during execution. Not critical - address in future phases.

## Open Enhancements

### ISS-002: Update external service dashboard names to "Rewind"

- **Discovered:** Phase 30-03-FIX (2026-01-25)
- **Type:** Branding
- **Description:** Firebase Console, Google Cloud Console, and Expo Dashboard still show "Oly" as the project name. Updating requires OAuth brand verification through Google Cloud Console, which is a heavyweight process.
- **Services affected:**
  - Firebase Console: Public-facing name
  - Google Cloud Console: Project display name, OAuth client names
  - Expo Dashboard: Project slug mismatch (projectId points to "Oly")
- **Impact:** None for users (admin-only visibility)
- **Effort:** Medium (OAuth brand verification process)
- **Suggested phase:** TestFlight preparation (batch with other pre-launch requirements)

### ISS-001: Add true 0.5x ultra-wide zoom via lens switching

- **Discovered:** Phase 15.2-01-FIX4 (2026-01-21)
- **Type:** UX
- **Description:** expo-camera's `zoom` property only controls digital zoom (0-1 range), not physical lens selection. To support true 0.5x ultra-wide (like iOS Camera app on iPhone 11+), need to either:
  1. Use expo-camera's camera device selection to switch to ultra-wide lens
  2. Migrate to react-native-vision-camera which has explicit lens selection
- **Impact:** Low (zoom works correctly with 1x/2x/3x, this would add ultra-wide option)
- **Effort:** Medium (requires API research and lens detection logic)
- **Suggested phase:** Future

## Closed Enhancements

[None yet]

---

_Last updated: 2026-01-25_
