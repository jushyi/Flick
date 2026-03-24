# Phase 20: TypeScript Sweep & Firebase Removal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 20-typescript-sweep-firebase-removal
**Areas discussed:** TS conversion strategy, Firebase removal order, Sentry integration scope, Dead code cleanup criteria

---

## TS Conversion Strategy

### tsconfig Strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Enable strict: true | Full strict mode — noImplicitAny, strictNullChecks, etc. | ✓ |
| Keep strict: false | Just rename to .ts/.tsx and add minimal types | |
| Incremental strictness | Enable individual flags one at a time | |

**User's choice:** Enable strict: true
**Notes:** Since we're touching every file anyway, this is the time to do it.

### Typing Standard

| Option | Description | Selected |
|--------|-------------|----------|
| Full typing | Proper interfaces/types for props, state, return values, function params — zero `any` | ✓ |
| Rename + minimal | Rename .js to .ts/.tsx, fix compile errors, minimal types | |
| You decide per file | Claude uses judgment per file type | |

**User's choice:** Full typing
**Notes:** None

### Firebase Service File Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Delete immediately | Dead code once Supabase equivalents exist — remove during TS sweep | ✓ |
| Convert then delete | Convert to TS first as verification, then delete | |
| You decide | Claude determines per file | |

**User's choice:** Delete immediately
**Notes:** None

### Shared Types Directory

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, src/types/ directory | Shared types organized by domain | ✓ |
| Co-located types only | Types live next to where they're used | |
| You decide | Claude decides based on conversion | |

**User's choice:** Yes, src/types/ directory
**Notes:** Extends existing src/types/database.ts

---

## Firebase Removal Order

### Removal Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| All at once | Remove all 7 packages in single commit + single EAS build | ✓ |
| Incremental by package | Remove packages one at a time | |
| You decide | Claude determines safest order | |

**User's choice:** All at once
**Notes:** Clean break

### Cloud Functions Directory

| Option | Description | Selected |
|--------|-------------|----------|
| Delete entirely | All jobs should be ported by Phase 18 | ✓ |
| Archive to a branch | Move to archive branch for reference | |
| Keep as reference | Rename to functions.legacy/ | |

**User's choice:** Delete entirely
**Notes:** None

### Firebase Config Files

| Option | Description | Selected |
|--------|-------------|----------|
| Delete + clean app.config.js | Remove config files and strip all Firebase plugin references | ✓ |
| Delete files only | Remove configs but leave app.config.js for separate step | |

**User's choice:** Delete + clean app.config.js
**Notes:** None

---

## Sentry Integration Scope

### Sentry Feature Set

| Option | Description | Selected |
|--------|-------------|----------|
| Full suite | Crash reporting + performance traces + breadcrumbs + user context | ✓ |
| Crashes only | Just crash/error reporting | |
| You decide | Claude determines based on Firebase Perf usage | |

**User's choice:** Full suite
**Notes:** Replaces Firebase Perf completely

### Screen Trace Porting

| Option | Description | Selected |
|--------|-------------|----------|
| Port screen traces | Replace useScreenTrace with Sentry screen tracking + custom spans | ✓ |
| Auto-instrumentation only | Let Sentry auto-detect navigation | |
| Skip performance | Only error/crash reporting | |

**User's choice:** Port screen traces
**Notes:** Custom spans for darkroom reveal and photo upload

### Sentry Environments

| Option | Description | Selected |
|--------|-------------|----------|
| Dev + Production | Two environments in one Sentry project | ✓ |
| Production only | Only instrument production builds | |
| You decide | Claude picks based on logging setup | |

**User's choice:** Dev + Production
**Notes:** None

---

## Dead Code Cleanup Criteria

### Cleanup Aggressiveness

| Option | Description | Selected |
|--------|-------------|----------|
| Aggressive | Remove ALL unused files — Firebase services, components, helpers, test mocks | ✓ |
| Conservative | Only remove clearly Firebase-only files | |
| You decide per file | Claude makes the call per file | |

**User's choice:** Aggressive
**Notes:** None

### Test Mock Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite for Supabase | Replace all Firebase mocks with Supabase mocks in jest.setup | ✓ |
| Remove mocks only | Delete Firebase mocks, let test files self-mock | |
| You decide | Claude determines based on test coverage | |

**User's choice:** Rewrite for Supabase
**Notes:** None

### CLAUDE.md Update

| Option | Description | Selected |
|--------|-------------|----------|
| Full rewrite | Remove all Firebase references, reflect Supabase + PowerSync + Sentry stack | ✓ |
| Minimal update | Just remove Firebase-specific sections | |
| You decide | Claude determines what needs updating | |

**User's choice:** Full rewrite
**Notes:** None

### Additional: Comment Audit (user-initiated)

**User's input:** "Make comments clean and simple. Codebase is riddled with unnecessary comments."
**Decision:** During TS conversion, audit every file's comments. Strip comments that restate code. Keep only comments explaining non-obvious logic.

---

## Claude's Discretion

- Per-file judgment on comment keep/remove during audit
- Organization of src/types/ subdirectory structure
- Order of file conversion within the TS sweep

## Deferred Ideas

- **Live Activities fix** — user confirmed this belongs in Phase 18, not Phase 20
