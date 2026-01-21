# Project Issues Log

Enhancements discovered during execution. Not critical - address in future phases.

## Open Enhancements

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
*Last updated: 2026-01-21*
