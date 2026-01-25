# UAT Issues: Phase 30 Rewind Rebrand

**Tested:** 2026-01-25
**Source:** .planning/phases/30-rewind-rebrand/ (all plans)
**Tester:** User via /gsd:verify-work

## Open Issues

None.

## Resolved Issues

### UAT-003: Dark theme not applied to Feed, Profile, Friends, Auth screens

**Discovered:** 2026-01-25
**Resolved:** 2026-01-25
**Phase/Plan:** 30-01, 30-03 → Fixed in 30-FIX-2
**Severity:** Major
**Feature:** Dark Mode Default
**Description:** Only Camera and Darkroom screens have dark backgrounds. Feed, Profile, Friends list, and Auth screens still use light/white backgrounds.

**Resolution:**
Applied dark theme using design tokens from colors.js to 8 screens:

- FeedScreen: background, header, stories, buttons
- ProfileScreen: background, header, stats, placeholder
- FriendsListScreen: background, search input, list items
- FriendRequestsScreen: background, tabs, badges
- UserSearchScreen: background, search input, results
- PhoneInputScreen: background, form inputs, country picker modal
- VerificationScreen: background, code input, timer text
- ProfileSetupScreen: background, photo placeholder, form

### UAT-002: Animated splash should have black blades on transparent camera background

**Discovered:** 2026-01-25
**Resolved:** 2026-01-25
**Phase/Plan:** 30-04 → Fixed in 30-FIX-2
**Severity:** Minor
**Feature:** Animated Splash Screen
**Description:** User wants splash screen to show black aperture blades with transparent background revealing the camera screen underneath, not purple blades on solid dark background.

**Resolution:**
Simplified AnimatedSplash to blur-focus effect only:

- Removed aperture blade animation entirely
- Kept blur-to-focus lens effect
- Made animation 2x faster (300ms blur, 150ms fade)
- Total animation time ~450ms (was ~1700ms)

### UAT-001: EAS projectId mismatch prevents app launch

**Discovered:** 2026-01-25
**Resolved:** 2026-01-25
**Phase/Plan:** 30-03 → Fixed in 30-FIX
**Severity:** Blocker
**Feature:** App configuration / build system
**Description:** App fails to start with error: "Slug for project identified by extra.eas.projectId (Oly) does not match the slug field (Rewind)"

**Resolution:**

1. Removed stale `extra.eas.projectId` from app.json (commit `8e77368`)
2. Reinitialized EAS with `eas init --force` to create new @spoodsjs/Rewind project (commit `fe4cf60`)
3. Uploaded GoogleService-Info.plist as EAS file environment variable
4. Development build completed successfully

---

_Phase: 30-rewind-rebrand_
_Tested: 2026-01-25_
