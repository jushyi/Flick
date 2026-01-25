---
phase: 30-rewind-rebrand
plan: 30-FIX
type: fix
---

<objective>
Fix 1 UAT issue from Phase 30 (Rewind Rebrand).

Source: 30-ISSUES.md
Priority: 1 blocker, 0 major, 0 minor
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

**Issues being fixed:**
@.planning/phases/30-rewind-rebrand/30-ISSUES.md

**Original plan for reference:**
@.planning/phases/30-rewind-rebrand/30-03-PLAN.md

**Current app.json:**
@app.json
</context>

<tasks>
<task type="auto">
  <name>Task 1: Fix UAT-001 - EAS projectId mismatch</name>
  <files>app.json</files>
  <action>
The EAS projectId in app.json was created when the project slug was "Oly", but 30-03 changed the slug to "Rewind" without updating EAS.

**Fix approach:** Remove the stale `extra.eas.projectId` from app.json. This allows local development to continue without EAS binding. When the user is ready for EAS builds, they can run `eas init` to create a fresh project with the correct "Rewind" slug.

**Steps:**

1. Remove the entire `extra.eas` object from app.json (lines containing projectId)
2. Keep the `owner` field if it exists outside the `extra.eas` block
3. Verify app.json remains valid JSON

**Why this approach:**

- Simplest fix to unblock development immediately
- Avoids creating new EAS project until actually needed
- User can reinitialize EAS later with correct slug
- No external service interaction required
  </action>
  <verify>Run `npx expo config` - should output valid config without slug mismatch error</verify>
  <done>App can be started with `npx expo start` without projectId/slug mismatch error</done>
  </task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Removed stale EAS projectId from app.json to fix slug mismatch</what-built>
  <how-to-verify>
    1. Run: npx expo start
    2. Verify no "slug mismatch" error appears
    3. App should launch normally in Expo Go
  </how-to-verify>
  <resume-signal>Type "approved" if app launches, or describe any remaining issues</resume-signal>
</task>
</tasks>

<verification>
Before declaring plan complete:
- [ ] `npx expo config` runs without error
- [ ] `npx expo start` launches without projectId/slug mismatch
- [ ] App loads in Expo Go
</verification>

<success_criteria>

- UAT-001 (blocker) resolved
- App can launch for remaining UAT testing
- Ready for re-verification of Phase 30 visual changes
  </success_criteria>

<output>
After completion, create `.planning/phases/30-rewind-rebrand/30-FIX-SUMMARY.md`

Then update 30-ISSUES.md to move UAT-001 to "Resolved Issues" section.
</output>
