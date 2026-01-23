# Phase 19: Linting and Prettier Setup - Context

**Gathered:** 2026-01-23
**Status:** Ready for planning

<vision>
## How This Should Work

Strict enforcement from day one. When you commit code, pre-commit hooks automatically format files with Prettier and fix ESLint issues that can be auto-fixed. Only truly broken code (actual errors) blocks the commit.

The developer experience should be frictionless — auto-fix handles the tedious stuff (formatting, import ordering, fixable lint issues) so developers can focus on writing code. But the enforcement is real: bad code doesn't get in.

Every file in the codebase should look the same. Consistent formatting, consistent import styles, consistent patterns. When you open any file, you know what to expect.

</vision>

<essential>
## What Must Be Nailed

- **Consistency** — Every file formatted identically, no style debates
- **Error prevention** — Catch unused variables, potential bugs, problematic patterns early
- **Developer experience** — Auto-fix on commit, fast hooks (lint-staged runs only on staged files), no friction

All three matter equally. Strict doesn't mean painful.

</essential>

<boundaries>
## What's Out of Scope

- **TypeScript migration** — Stay with JavaScript for this phase; TS can be a future milestone if needed
- **Custom ESLint rules** — Use established presets (eslint-config-expo, recommended configs), don't write custom rules
- Note: Existing warnings in the codebase should be fixed as part of the initial formatting pass

</boundaries>

<specifics>
## Specific Ideas

- **ESLint with eslint-config-expo** — Expo's official config, built on React Native rules, understands the stack
- **Prettier** — Standard formatter, integrates well with ESLint
- **Husky + lint-staged** — Pre-commit hooks that run only on staged files for fast commits
- **Auto-fix behavior** — Prettier formats, ESLint fixes what it can, commit proceeds unless there are unfixable errors

</specifics>

<notes>
## Additional Context

TypeScript was considered and deliberately excluded. For a solo-developed, already-working JavaScript codebase of this size, the migration effort isn't worth it right now. Good ESLint rules provide most of the "catch mistakes early" benefit without the overhead.

This is part of v1.6 Code Quality, Security & Documentation milestone. The goal is maintainability and contributor onboarding, not changing how the app works.

</notes>

---

*Phase: 19-linting-prettier*
*Context gathered: 2026-01-23*
