# Phase 20: TypeScript Sweep & Firebase Removal - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Convert all **remaining** JS files to TypeScript with full strict typing (Phases 15-19 will have already converted many files as they rewrite services/hooks/screens for Supabase — Phase 20 sweeps up what's left), remove all Firebase dependencies (7 packages, Cloud Functions, config files) in a single clean break, integrate Sentry for crash/performance monitoring, perform aggressive dead code + comment cleanup, and run a full end-to-end migration test against dev Firebase data to validate the complete Firebase-to-Supabase migration.

</domain>

<decisions>
## Implementation Decisions

### TypeScript Conversion Strategy
- **D-01:** Enable `strict: true` in tsconfig after converting all files. This is the final milestone — no more `allowJs` coexistence.
- **D-02:** Full typing standard — proper interfaces/types for props, state, return values, function params. Zero `any` types in converted code.
- **D-03:** Create `src/types/` directory for shared types organized by domain (navigation params, component props, hook returns, API responses). Extends existing `src/types/database.ts`.
- **D-17:** Phases 15-19 already convert files to TypeScript as they rewrite services, hooks, and screens for Supabase. Phase 20's TS sweep only covers **remaining untouched files** — components, utilities, screens, and helpers that no prior phase had reason to modify. The planner must audit what's already `.ts/.tsx` at execution time and only target what's still `.js`.

### Firebase Removal
- **D-04:** Remove all 7 `@react-native-firebase/*` packages in a single commit. Clean break, single EAS native build.
- **D-05:** Delete `functions/` directory entirely — all Cloud Functions should be ported to pg_cron + Edge Functions by Phase 18.
- **D-06:** Delete `GoogleService-Info.plist` and `google-services.json`, and strip all Firebase plugin references from `app.config.js`/`app.json`.
- **D-07:** Delete old Firebase service files immediately (not convert-then-delete). They are dead code once Supabase equivalents exist.

### Sentry Integration
- **D-08:** Full Sentry suite — crash reporting + performance traces + breadcrumbs + user context. Replaces Firebase Performance Monitoring completely.
- **D-09:** Port `useScreenTrace` to Sentry's screen tracking + custom spans for critical flows (darkroom reveal, photo upload).
- **D-10:** Two Sentry environments in one project: Dev (filterable) and Production (alerting).

### Dead Code & Comment Cleanup
- **D-11:** Aggressive cleanup — remove ALL unused Firebase services, unused components, legacy helpers, orphaned test mocks, and anything not imported.
- **D-12:** Comment audit — strip unnecessary comments across the entire codebase. Keep only comments where logic isn't self-evident. The codebase has excessive commenting that needs cleaning.
- **D-13:** Rewrite `jest.setup.js` — replace all Firebase mocks with Supabase mocks. Tests should reflect the new backend.
- **D-14:** Full CLAUDE.md rewrite — remove all Firebase references, update service layer docs, reflect Supabase + PowerSync + Sentry stack.

### Full Migration Testing
- **D-15:** Run a complete end-to-end migration test against the dev Firebase project data. Validate that all dev data (users, photos, friendships, conversations, etc.) migrates correctly to Supabase and the app functions fully on the new backend with zero Firebase fallbacks.
- **D-16:** This is the final validation gate before Firebase removal — confirm every service, hook, and screen works against Supabase before deleting Firebase packages.

### Claude's Discretion
- Per-file judgment on which comments to keep vs remove during the comment audit
- Organization of `src/types/` subdirectory structure
- Order of file conversion within the TS sweep (e.g., services first, then hooks, then components)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### TypeScript Config
- `tsconfig.json` — Current TS config with `strict: false`, `allowJs: true` (will be changed to `strict: true`)
- `src/types/database.ts` — Supabase-generated database types (foundation for all service typing)

### Firebase Dependencies (to be removed)
- `package.json` — Lists all 7 `@react-native-firebase/*` packages
- `app.config.js` — Contains Firebase plugin references to strip
- `GoogleService-Info.plist` — iOS Firebase config (delete)
- `google-services.json` — Android Firebase config (delete)
- `functions/` — Cloud Functions directory (delete entirely)
- `plugins/withFirebaseFix.js` — iOS-only Podfile fix plugin (delete)

### Existing Supabase Services (replacement layer)
- `src/services/supabase/phoneAuthService.ts` — Auth replacement
- `src/services/supabase/storageService.ts` — Storage replacement
- `src/services/supabase/signedUrlService.ts` — Signed URL replacement
- `src/services/uploadQueueService.ts` — Already converted to TS

### Test Infrastructure
- `__tests__/setup/jest.setup.js` — Firebase mocks to replace with Supabase mocks

### Project Docs
- `CLAUDE.md` — Full rewrite needed to reflect post-Firebase state

</canonical_refs>

<code_context>
## Existing Code Insights

### Current State (as of Phase 14 — will change significantly by Phase 20)
- 224 JS files in `src/` as of now, but Phases 15-19 will convert many of these to TS as they rewrite services, hooks, and screens for Supabase. Phase 20 handles whatever JS files remain untouched.
- 13 TS files already exist (from Phases 12-14)
- 42 files still import `@react-native-firebase/*` — most will be rewritten by Phases 15-18, Phase 20 catches any stragglers
- 7 Firebase packages in package.json
- Sentry not yet installed

### Reusable Assets
- `src/types/database.ts` — Supabase-generated types, foundation for all service typing
- `src/lib/queryKeys.ts` — Already typed TanStack Query key factory
- `src/lib/supabase.ts` — Typed Supabase client
- `src/lib/powersync/` — Full PowerSync setup already in TypeScript

### Established Patterns
- `{success, error}` return pattern on all services (Phase 13 decision)
- `useQuery` / `useMutation` with `queryKeys` factory (Phase 14 pattern)
- `@/*` path alias for imports (Phase 12 decision)
- Module-level `_resetForTesting` export for testable singletons

### Integration Points
- `app.config.js` — Firebase plugins to strip, Sentry plugin to add
- `App.js` — Firebase Performance initialization to replace with Sentry.init()
- `src/utils/performanceService.js` — `useScreenTrace` and `withTrace` to port to Sentry
- `babel.config.js` — May need Sentry babel plugin for source maps

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants a **comment audit** — the codebase has excessive unnecessary comments. During TS conversion, strip comments that just restate the code. Keep only comments explaining non-obvious logic.
- Clean break philosophy — everything Firebase goes in one sweep, no incremental removal.
- **Full migration validation** against dev Firebase data before removing packages — this is the final proof that the Supabase migration is complete and correct.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- **Fix push-to-start Live Activities for background and killed state** — belongs in Phase 18 (Background Jobs & Notifications), not Phase 20. User confirmed this.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 20-typescript-sweep-firebase-removal*
*Context gathered: 2026-03-24*
