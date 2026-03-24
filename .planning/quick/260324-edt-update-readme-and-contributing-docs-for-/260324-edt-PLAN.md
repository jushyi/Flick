---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [README.md, CONTRIBUTING.md]
autonomous: true
requirements: [QUICK-README]

must_haves:
  truths:
    - "README.md provides a clear high-level overview of what Flick is"
    - "README.md lists the current tech stack (including Supabase migration)"
    - "README.md has dev setup and run instructions"
    - "CONTRIBUTING.md is either removed or simplified to personal dev notes"
  artifacts:
    - path: "README.md"
      provides: "High-level app overview for repo landing page"
    - path: "CONTRIBUTING.md"
      provides: "Simplified personal dev reference (or removed)"
  key_links: []
---

<objective>
Rewrite README.md as a clean, high-level app overview and simplify CONTRIBUTING.md for a solo dev project.

Purpose: The current README is outdated (references Firebase-only stack, old repo name "lapse-clone"). CONTRIBUTING.md has external-contributor guidance that is unnecessary for a solo project. Both need to reflect the current state of Flick.
Output: Updated README.md, simplified CONTRIBUTING.md
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@README.md (current — outdated, needs full rewrite)
@CONTRIBUTING.md (current — too detailed for solo project)
@CLAUDE.md (source of truth for technical details)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite README.md as high-level app overview</name>
  <files>README.md</files>
  <action>
Rewrite README.md from scratch. This is the repo landing page — keep it concise and high-level. CLAUDE.md is the deep technical reference; README should NOT duplicate it.

Structure:
1. **Title + one-liner** — "Flick" with a brief tagline about the disposable camera social app
2. **What It Is** — 2-3 sentences: friends-only social app, disposable camera experience, darkroom reveal mechanic, retro pixel art aesthetic. Mention it's a personal/solo project.
3. **Key Features** — Bullet list (5-7 items): photo capture + darkroom developing, friend-only sharing, emoji reactions, direct messaging, albums, push notifications. Keep each bullet to one line.
4. **Tech Stack** — Two sections reflecting the migration:
   - Current production: React Native + Expo (SDK 54), Firebase (Auth, Firestore, Storage, Cloud Functions), React Navigation 7, react-native-reanimated
   - v1.2 migration (in progress): Supabase (PostgreSQL, Auth, Storage, Edge Functions, Realtime), PowerSync (offline-first SQLite), TanStack Query (caching), Sentry (monitoring)
5. **Getting Started** — Keep it simple:
   - Prerequisites: Node.js 18+, Expo CLI, Firebase project (or Supabase for v1.2)
   - `npm install` then `npx expo start`
   - Mention iOS and Android support
   - Link to CLAUDE.md for detailed architecture and development guide
6. **Development Commands** — Quick reference table or list: `npx expo start`, `npm run lint`, `npm test`, `npm run lint:fix`, `npm run format`
7. **Project Structure** — Keep the existing directory tree (src/ breakdown) but update if needed
8. **Footer** — "See CLAUDE.md for detailed architecture, conventions, and development guide."

Do NOT include:
- Firebase setup instructions (that's CLAUDE.md territory)
- Code style rules (CLAUDE.md)
- Detailed architecture explanations (CLAUDE.md)
- The old "lapse-clone" repo name anywhere
- A "Contributing" section linking to CONTRIBUTING.md (solo project)

Tone: Clean, professional, personal project showcase. No emojis.
  </action>
  <verify>
    <automated>cat README.md | head -80</automated>
  </verify>
  <done>README.md exists with high-level app overview, current tech stack (both Firebase and Supabase migration), dev commands, and project structure. Does not duplicate CLAUDE.md content.</done>
</task>

<task type="auto">
  <name>Task 2: Simplify CONTRIBUTING.md to personal dev notes</name>
  <files>CONTRIBUTING.md</files>
  <action>
Replace the current CONTRIBUTING.md with a minimal personal reference file. Since this is a solo project, remove all external-contributor framing ("Before Submitting", "Contributing to Lapse Clone").

New content — short and functional:
1. **Title** — "Development Notes" (not "Contributing")
2. **Commit Messages** — Keep the type(scope): description format and examples (this is useful personal reference)
3. **Code Quality Checklist** — A quick personal checklist:
   - `npm run lint` passes
   - `npm test` passes
   - No console.log (use logger)
   - App runs: `npx expo start`
4. **Footer** — "Full conventions and patterns documented in CLAUDE.md"

Remove entirely:
- Import organization rules (duplicated in CLAUDE.md)
- Service return pattern examples (in CLAUDE.md)
- Error handling pattern (in CLAUDE.md)
- Component structure template (in CLAUDE.md)
- Logging rules (in CLAUDE.md)
- File naming conventions (in CLAUDE.md)

Target length: ~30-40 lines (down from current ~150+). This is a quick-reference cheat sheet, not a guide.
  </action>
  <verify>
    <automated>wc -l CONTRIBUTING.md</automated>
  </verify>
  <done>CONTRIBUTING.md is under 50 lines, contains only commit message format and personal quality checklist, with no external-contributor framing or content duplicated from CLAUDE.md.</done>
</task>

</tasks>

<verification>
- README.md mentions "Flick" (not "Lapse Clone") as the app name
- README.md references both Firebase (current) and Supabase (v1.2 migration)
- README.md does NOT contain code style rules, import ordering, or service patterns
- CONTRIBUTING.md is under 50 lines
- CONTRIBUTING.md references CLAUDE.md for full conventions
</verification>

<success_criteria>
- README.md serves as a clean repo landing page with app overview, stack, and quick start
- CONTRIBUTING.md is a minimal personal dev reference, not an external contributor guide
- Neither file duplicates content already covered in CLAUDE.md
</success_criteria>

<output>
After completion, create `.planning/quick/260324-edt-update-readme-and-contributing-docs-for-/260324-edt-SUMMARY.md`
</output>
