# Phase 20: TypeScript Sweep & Firebase Removal - Research

**Researched:** 2026-03-24
**Domain:** TypeScript migration, Firebase dependency removal, Sentry integration, dead code cleanup
**Confidence:** HIGH

## Summary

Phase 20 is a cleanup and hardening phase that follows the main Supabase migration (Phases 12-19). The codebase currently has 224 JS files and 32 TS files in `src/`. By the time Phase 20 executes, Phases 15-19 will have converted many services/hooks/screens to TypeScript as part of their Supabase rewrites -- Phase 20 sweeps up whatever JS files remain untouched. The phase also removes all 7 `@react-native-firebase/*` packages (which are native dependencies requiring an EAS build), deletes the Cloud Functions directory, integrates Sentry for crash/performance monitoring, rewrites the test mock infrastructure, and performs a full migration validation against dev Firebase data.

The Firebase removal is the riskiest part: these are native dependencies wired into `app.json` plugins, `app.config.js`, and build configuration. Removing them requires a clean EAS native build. The Sentry integration is straightforward -- `@sentry/react-native` 8.5.0 has first-class Expo support with a dedicated plugin and React Navigation integration. The TypeScript sweep is mechanical but large -- every remaining `.js` file gets proper types with `strict: true` enabled at the end.

**Primary recommendation:** Execute in strict order: (1) full migration validation against dev data, (2) TypeScript sweep of remaining JS files, (3) Sentry integration, (4) Firebase removal + config cleanup, (5) enable `strict: true`, (6) test infrastructure rewrite, (7) CLAUDE.md rewrite. Firebase removal must come after Sentry is working so performance monitoring has zero downtime.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Enable `strict: true` in tsconfig after converting all files. This is the final milestone -- no more `allowJs` coexistence.
- **D-02:** Full typing standard -- proper interfaces/types for props, state, return values, function params. Zero `any` types in converted code.
- **D-03:** Create `src/types/` directory for shared types organized by domain (navigation params, component props, hook returns, API responses). Extends existing `src/types/database.ts`.
- **D-04:** Remove all 7 `@react-native-firebase/*` packages in a single commit. Clean break, single EAS native build.
- **D-05:** Delete `functions/` directory entirely -- all Cloud Functions should be ported to pg_cron + Edge Functions by Phase 18.
- **D-06:** Delete `GoogleService-Info.plist` and `google-services.json`, and strip all Firebase plugin references from `app.config.js`/`app.json`.
- **D-07:** Delete old Firebase service files immediately (not convert-then-delete). They are dead code once Supabase equivalents exist.
- **D-08:** Full Sentry suite -- crash reporting + performance traces + breadcrumbs + user context. Replaces Firebase Performance Monitoring completely.
- **D-09:** Port `useScreenTrace` to Sentry's screen tracking + custom spans for critical flows (darkroom reveal, photo upload).
- **D-10:** Two Sentry environments in one project: Dev (filterable) and Production (alerting).
- **D-11:** Aggressive cleanup -- remove ALL unused Firebase services, unused components, legacy helpers, orphaned test mocks, and anything not imported.
- **D-12:** Comment audit -- strip unnecessary comments across the entire codebase. Keep only comments where logic isn't self-evident.
- **D-13:** Rewrite `jest.setup.js` -- replace all Firebase mocks with Supabase mocks. Tests should reflect the new backend.
- **D-14:** Full CLAUDE.md rewrite -- remove all Firebase references, update service layer docs, reflect Supabase + PowerSync + Sentry stack.
- **D-15:** Run a complete end-to-end migration test against the dev Firebase project data.
- **D-16:** This is the final validation gate before Firebase removal.
- **D-17:** Phase 20's TS sweep only covers remaining untouched files -- components, utilities, screens, and helpers that no prior phase had reason to modify.
- **D-18:** Migration must be repeatable and resettable. Build a reset script that wipes dev Supabase back to clean state.
- **D-19:** Prod migration only happens after dev migration passes all validation.

### Claude's Discretion
- Per-file judgment on which comments to keep vs remove during the comment audit
- Organization of `src/types/` subdirectory structure
- Order of file conversion within the TS sweep (e.g., services first, then hooks, then components)

### Deferred Ideas (OUT OF SCOPE)
- Fix push-to-start Live Activities for background and killed state -- belongs in Phase 18
- Set up Twilio SMS provider for Supabase Phone Auth -- pre-prod task, not Phase 20
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TS-01 | All rewritten service files are TypeScript (.ts) with Supabase-generated database types | Supabase services already in TS (Phase 13-16). Phase 20 verifies completeness and adds missing types from `database.ts`. |
| TS-02 | All rewritten hooks are TypeScript (.ts/.tsx) with proper type annotations | 10 hooks already converted to TS. Remaining hooks (useCamera, useConversation, useMessages, etc.) need conversion. |
| TS-03 | Remaining untouched JS files converted to TypeScript after main migration | 224 JS files currently; Phase 20 targets whatever remains after Phases 15-19. Covers components, screens, contexts, constants, utils, styles, navigation. |
| TS-04 | Zero `any` types in rewritten code (strict typing for new code, allowJs for legacy) | Enable `strict: true` after full conversion. Use `src/types/` for shared type definitions. |
| CLEAN-01 | All 7 @react-native-firebase/* packages removed (single EAS native build) | 7 packages identified: app, auth, firestore, functions, messaging, perf, storage. 4 are in app.json plugins. |
| CLEAN-02 | Firebase Cloud Functions directory (functions/) removed after all jobs ported | `functions/` directory contains index.js (~2700 lines), validation.js, notifications/, tasks/. |
| CLEAN-03 | Dead code identified and removed during per-screen audit | 42 files currently import Firebase. 24 Firebase service files in `src/services/firebase/`. All are dead code once Supabase equivalents confirmed. |
| CLEAN-04 | Firebase-specific config files removed | `GoogleService-Info.plist`, `google-services.json`, `plugins/withFirebaseFix.js`, Firebase refs in `app.config.js`. |
| CLEAN-05 | Sentry replaces Firebase Performance Monitoring for error tracking and traces | `@sentry/react-native` 8.5.0 with Expo plugin. Replace `useScreenTrace` and `withTrace` with Sentry spans. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sentry/react-native` | 8.5.0 | Crash reporting, performance traces, breadcrumbs | Official Sentry SDK with first-class Expo support, React Navigation integration |
| `typescript` | 5.9.3 | Already installed | Already in project, just needs `strict: true` enabled |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@sentry/react-native/expo` | (bundled) | Expo plugin for native config and source maps | Added to app.json plugins for automatic native setup |
| `@sentry/react-native/metro` | (bundled) | Metro config for source maps | Used in metro.config.js for source map upload |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sentry | Bugsnag | Sentry has better Expo integration, official Expo docs recommend it |
| Sentry | Datadog RUM | Overkill for mobile app, Sentry is purpose-built for crash/perf monitoring |

**Installation:**
```bash
npx expo install @sentry/react-native
```

**Version verification:** `@sentry/react-native` 8.5.0 confirmed via npm registry (2026-03-24). Requires Expo >= 49.0.0, React >= 17.0.0, React Native >= 0.65.0. Project has Expo 54, fully compatible.

## Architecture Patterns

### Firebase Removal Sequence

The Firebase packages in `app.json` plugins are:
1. `@react-native-firebase/app`
2. `@react-native-firebase/auth`
3. `@react-native-firebase/perf`
4. `./plugins/withFirebaseFix` (iOS-only, depends on Firebase)

All 4 must be removed from plugins. The other 3 packages (`firestore`, `functions`, `messaging`, `storage`) are JS-only imports with no plugin entries.

**app.config.js changes:**
- Remove `googleServicesFile` from both `ios` and `android` sections
- Remove all Firebase environment variable references (`GOOGLE_SERVICES_PLIST`, `GOOGLE_SERVICES_JSON_DEV`, `GOOGLE_SERVICES_JSON_PROD`)

**expo-build-properties note:** The `useFrameworks: "static"` setting in `expo-build-properties` was required for Firebase iOS compatibility. After Firebase removal, verify if this is still needed (it may be required by other native dependencies).

### Sentry Integration Pattern

```typescript
// src/services/sentryService.ts
import * as Sentry from '@sentry/react-native';
import { reactNavigationIntegration } from '@sentry/react-native';

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

export function initSentry() {
  Sentry.init({
    dsn: '__DSN__', // from environment or hardcoded (DSNs are public)
    environment: __DEV__ ? 'development' : 'production',
    enabled: !__DEV__, // Disable in dev to avoid noise
    tracesSampleRate: __DEV__ ? 1.0 : 0.2, // 20% sampling in prod
    integrations: [navigationIntegration],
    sendDefaultPii: true,
    beforeBreadcrumb(breadcrumb) {
      // Redact sensitive data
      return breadcrumb;
    },
  });
}

// Replace withTrace from Firebase performanceService
export async function withTrace<T>(
  name: string,
  operation: (span: Sentry.Span) => Promise<T>,
  attributes?: Record<string, string>
): Promise<T> {
  return Sentry.startSpan(
    { name, attributes },
    async (span) => {
      try {
        const result = await operation(span);
        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.setStatus({ code: 2, message: String(error) }); // ERROR
        throw error;
      }
    }
  );
}
```

### useScreenTrace Replacement

```typescript
// src/hooks/useScreenTrace.ts
import { useEffect, useRef, useCallback } from 'react';
import * as Sentry from '@sentry/react-native';

export function useScreenTrace(screenName: string) {
  const spanRef = useRef<Sentry.Span | null>(null);

  useEffect(() => {
    if (__DEV__) return;

    const span = Sentry.startInactiveSpan({
      name: `screen/${screenName}`,
      op: 'ui.load',
    });
    spanRef.current = span;

    return () => {
      if (spanRef.current) {
        spanRef.current.end();
        spanRef.current = null;
      }
    };
  }, [screenName]);

  const markLoaded = useCallback((metrics?: Record<string, number>) => {
    if (__DEV__) return;
    if (spanRef.current) {
      if (metrics) {
        for (const [key, value] of Object.entries(metrics)) {
          spanRef.current.setAttribute(key, value);
        }
      }
      spanRef.current.end();
      spanRef.current = null;
    }
  }, []);

  return { markLoaded };
}
```

### Metro Config Update

```javascript
// metro.config.js - after Sentry integration
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const config = getSentryExpoConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
  transform: {
    inlineRequires: {
      blockList: {
        [require.resolve('@powersync/react-native')]: true,
      },
    },
  },
});

module.exports = config;
```

### TypeScript Type Organization

```
src/types/
  database.ts          # Supabase-generated types (existing)
  navigation.ts        # React Navigation param lists for all navigators
  components.ts        # Shared component prop types
  hooks.ts             # Hook return type interfaces
  services.ts          # Service response types, API types
  common.ts            # Utility types (e.g., WithChildren, AsyncResult)
```

### Recommended TS Conversion Order

1. **Constants/Config** (`src/constants/`, `src/config/`) -- pure data, easiest to type
2. **Utilities** (`src/utils/`) -- pure functions, well-bounded types
3. **Styles** (`src/styles/`) -- StyleSheet types from React Native
4. **Context providers** (`src/context/`) -- defines types consumed everywhere
5. **Hooks** (`src/hooks/`) -- depends on context types
6. **Components** (`src/components/`) -- depends on hooks/context types
7. **Screens** (`src/screens/`) -- depends on everything above
8. **Navigation** (`src/navigation/`) -- depends on screen types
9. **App.js -> App.tsx** -- last, wraps everything

### Anti-Patterns to Avoid
- **Converting and typing in one pass for complex files:** For files with deep Firebase coupling (like `AuthContext.js`), first confirm all Firebase imports are already replaced by Supabase equivalents before converting to TS.
- **Using `as any` to suppress type errors:** Use proper type narrowing or `unknown` + type guards instead. The only exception is the known `(supabase as any)` pattern for tables not yet in Database types.
- **Adding types to dead code:** Delete Firebase service files first, then convert remaining files. Never waste effort typing code that will be deleted.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Crash reporting | Custom error boundary logging | `@sentry/react-native` | Source maps, breadcrumbs, user context, release tracking |
| Screen performance traces | Manual timing with Date.now() | Sentry `reactNavigationIntegration` | Automatic screen load tracking with TTID |
| Custom span timing | Manual performance.now() wrappers | `Sentry.startSpan()` / `Sentry.startInactiveSpan()` | Proper parent-child span relationships, automatic attributes |
| Source map uploads | Manual upload scripts | `@sentry/react-native/expo` plugin | Automatic during EAS build, works with EAS Update |
| Navigation type safety | Ad-hoc param typing | React Navigation 7 typed params with `ParamListBase` | Compile-time route/param validation |
| Style types | Manual `ViewStyle`/`TextStyle` annotations | `StyleSheet.create()` return type inference | TypeScript infers style types from `StyleSheet.create()` automatically |

**Key insight:** The Sentry Expo plugin handles all native configuration, source map uploads, and build integration automatically. Do not try to configure Sentry's native SDKs manually.

## Common Pitfalls

### Pitfall 1: expo-build-properties useFrameworks After Firebase Removal
**What goes wrong:** The `useFrameworks: "static"` setting in `expo-build-properties` was added specifically for Firebase iOS compatibility. Removing it after Firebase removal might break other native dependencies that rely on it (or leaving it might cause unnecessary build issues).
**Why it happens:** Firebase requires static frameworks on iOS with Expo. Other packages may or may not need it.
**How to avoid:** After removing Firebase, do a test EAS build with `useFrameworks: "static"` still present. If it passes, leave it. Only remove if a build error specifically points to it.
**Warning signs:** iOS EAS build failures mentioning framework linking.

### Pitfall 2: Orphaned Firebase Imports in Non-Service Files
**What goes wrong:** Files like `App.js` directly import from Firebase services (`notificationService`, `performanceService`) and from `@react-native-firebase/auth`. After Firebase removal, these imports crash the app.
**Why it happens:** Not all Firebase usage is in `src/services/firebase/`. App.js and some screens import Firebase directly.
**How to avoid:** Run `grep -r "@react-native-firebase" .` across the entire project (not just `src/`) before removal. Check `App.js` especially -- it imports `getAuth`, `onAuthStateChanged` from `@react-native-firebase/auth` and `initPerformanceMonitoring` from Firebase's performance service.
**Warning signs:** App crashes on startup after Firebase package removal.

### Pitfall 3: EAS Secrets Still Referencing Firebase
**What goes wrong:** EAS secrets `GOOGLE_SERVICES_JSON_DEV` and `GOOGLE_SERVICES_JSON_PROD` are still configured in EAS. `app.config.js` references them. After removing the Firebase config from `app.config.js`, these secrets become orphaned but harmless.
**Why it happens:** EAS secrets are managed outside the codebase.
**How to avoid:** After successful build without Firebase, clean up EAS secrets via `eas secret:list` and `eas secret:delete`. Not blocking but good hygiene.
**Warning signs:** None -- orphaned secrets don't cause issues.

### Pitfall 4: strict: true Cascade of Errors
**What goes wrong:** Enabling `strict: true` in tsconfig surfaces hundreds of errors in files that compiled fine under `strict: false`. Common issues: implicit `any` in callbacks, `null` vs `undefined` handling, missing return types.
**Why it happens:** `strict: true` enables `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, and several other flags simultaneously.
**How to avoid:** Convert ALL files to TS first, THEN enable `strict: true` and fix errors. Do not enable strict mode while JS files still exist. Consider enabling strict sub-flags incrementally if the error count is overwhelming: `strictNullChecks` first, then `noImplicitAny`.
**Warning signs:** `tsc --noEmit` returning 500+ errors after enabling strict.

### Pitfall 5: Test Files Importing Deleted Firebase Services
**What goes wrong:** 73 test files in `__tests__/` import from Firebase services. After deleting `src/services/firebase/`, all those tests break.
**Why it happens:** Tests mirror the old service layer. Many test files have both a `.js` and `.ts` version (e.g., `useComments.test.js` and `useComments.test.ts`).
**How to avoid:** Audit test files systematically. Delete `.js` test files that have `.ts` replacements. Update remaining test files to import from Supabase services. Rewrite `jest.setup.js` to remove all Firebase mocks.
**Warning signs:** `npm test` failing with "Cannot find module" errors.

### Pitfall 6: Sentry Source Maps with EAS Update
**What goes wrong:** Sentry automatically uploads source maps during EAS native builds, but OTA updates via `eas update` require a separate source map upload step.
**Why it happens:** EAS Update bypasses the native build pipeline where Sentry's plugin runs.
**How to avoid:** Chain source map upload with EAS Update: `eas update --branch production && npx sentry-expo-upload-sourcemaps dist`. Document this in CLAUDE.md's deployment section.
**Warning signs:** Sentry showing obfuscated stack traces for OTA-updated code.

### Pitfall 7: Duplicate Test Files (.js and .ts)
**What goes wrong:** Some hooks have both `useComments.test.js` and `useComments.test.ts`. Jest may run both, causing duplicate test execution or conflicts.
**Why it happens:** Phases 15-16 created new `.ts` test files alongside existing `.js` ones.
**How to avoid:** Delete the `.js` version when a `.ts` version exists for the same test subject. Scan for duplicates: `find __tests__ -name "*.test.js" -exec basename {} .test.js \;` and cross-check against `.test.ts` files.
**Warning signs:** Jest reporting duplicate test names or double test counts.

## Code Examples

### Navigation Types (src/types/navigation.ts)

```typescript
// Source: React Navigation 7 typed params pattern
import type { NavigatorScreenParams } from '@react-navigation/native';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Settings: undefined;
  EditProfile: undefined;
  CreateAlbum: undefined;
  AlbumPhotoPicker: { albumId: string };
  AlbumGrid: { albumId: string; title: string };
  MonthlyAlbumGrid: { year: number; month: number };
  NotificationSettings: undefined;
  SoundSettings: undefined;
  BlockedUsers: undefined;
  RecentlyDeleted: undefined;
  DeleteAccount: undefined;
  ProfilePhotoCrop: { imageUri: string };
  SongSearch: undefined;
  // ... etc
};

export type MessagesStackParamList = {
  MessagesList: undefined;
  Conversation: { conversationId: string; friendId: string };
  NewMessage: undefined;
};

export type MainTabsParamList = {
  Feed: undefined;
  Messages: NavigatorScreenParams<MessagesStackParamList>;
  Camera: { openDarkroom?: boolean };
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  PhoneInput: undefined;
  Verification: { phoneNumber: string };
  MainTabs: NavigatorScreenParams<MainTabsParamList>;
  PhotoDetail: { photoId: string; mode: 'feed' | 'stories' };
  Darkroom: undefined;
  Activity: undefined;
  // ... etc
};
```

### Component Props Pattern

```typescript
// Source: Standard React Native + TypeScript pattern
import type { ViewStyle } from 'react-native';

interface FeedPhotoCardProps {
  photo: {
    id: string;
    photoURL: string;
    userId: string;
    createdAt: string;
    reactionCount: number;
  };
  onPress: (photoId: string) => void;
  style?: ViewStyle;
}

export function FeedPhotoCard({ photo, onPress, style }: FeedPhotoCardProps) {
  // ...
}
```

### Sentry User Context Integration

```typescript
// In AuthContext or App initialization
import * as Sentry from '@sentry/react-native';

// After successful auth
Sentry.setUser({
  id: user.uid,
  username: userProfile.username,
});

// On sign out
Sentry.setUser(null);
```

### Migration Reset Script Pattern

```typescript
// scripts/reset-dev-supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(DEV_SUPABASE_URL, DEV_SERVICE_ROLE_KEY);

async function resetDevDatabase() {
  // Order matters: delete dependent tables first
  const tables = [
    'comments', 'photo_reactions', 'photos',
    'messages', 'conversations', 'streaks',
    'friendships', 'notifications', 'albums',
    'monthly_albums', 'blocks', 'reports',
    'reaction_batches', 'users'
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '');
    if (error) console.error(`Failed to clear ${table}:`, error);
  }

  // Clear storage buckets
  for (const bucket of ['photos', 'profile-photos', 'snaps']) {
    const { data: files } = await supabase.storage.from(bucket).list();
    if (files?.length) {
      await supabase.storage.from(bucket).remove(files.map(f => f.name));
    }
  }

  // Delete auth users (requires service_role)
  // Use admin API to list and delete all auth users
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sentry-expo` package | `@sentry/react-native` directly | 2024 | `sentry-expo` is deprecated; use `@sentry/react-native` with Expo plugin |
| Firebase Performance SDK | Sentry Performance (spans) | Ongoing | Sentry provides unified crash + perf in one SDK |
| `allowJs: true` + gradual TS | `strict: true` full TypeScript | Phase 20 | Compile-time safety for entire codebase |
| Firebase mocks in jest.setup.js | Supabase mocks in jest.setup.ts | Phase 20 | Test infrastructure matches production backend |

**Deprecated/outdated:**
- `sentry-expo`: Deprecated in favor of `@sentry/react-native` with built-in Expo support. Do NOT install `sentry-expo`.
- `@react-native-firebase/perf` `startScreenTrace()`: Was already broken on iOS (project uses custom code traces instead). Sentry's `reactNavigationIntegration` replaces this cleanly.

## Open Questions

1. **What JS files will remain after Phases 15-19?**
   - What we know: Currently 224 JS files. Phases 15-19 convert services, hooks, and screens they touch.
   - What's unclear: Exact count of remaining JS files at Phase 20 execution time.
   - Recommendation: Planner must include a "scan remaining JS files" step at the start of Phase 20 to determine actual scope. The file categories that likely remain untouched are: components (75 files), constants (10 files), styles (20 files), utils (8 files), navigation (1 file), and some screens/contexts.

2. **Does `useFrameworks: "static"` in expo-build-properties need to stay?**
   - What we know: It was added for Firebase iOS compatibility. Other native modules may also need it.
   - What's unclear: Whether removing it breaks other pods.
   - Recommendation: Keep it during initial Firebase removal build. Test removal in a separate commit only if needed.

3. **Sentry DSN management**
   - What we know: DSNs are public (safe to hardcode). Two environments needed (dev/production).
   - What's unclear: Whether to use one Sentry project with environment filtering or two separate projects.
   - Recommendation: One Sentry project, two environments. Use `environment` field in `Sentry.init()` to differentiate. Simpler to manage.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| TypeScript | TS conversion | Yes | 5.9.3 | -- |
| EAS CLI | Firebase removal build | Yes (user runs) | -- | -- |
| Sentry account | CLEAN-05 | Unknown | -- | User must create account + project |
| Node 20 | Cloud Functions (being deleted) | N/A | -- | -- |

**Missing dependencies with no fallback:**
- Sentry DSN -- user must create a Sentry account and project before Sentry integration task

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest with jest-expo preset |
| Config file | `jest.config.js` |
| Quick run command | `npm test -- --bail` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TS-01 | Service files use database types, no `any` | static analysis | `npx tsc --noEmit` | N/A (compiler) |
| TS-02 | Hook files typed with annotations | static analysis | `npx tsc --noEmit` | N/A (compiler) |
| TS-03 | All JS files converted to TS | static analysis | `find src -name "*.js" \| wc -l` (should be 0) | N/A (file check) |
| TS-04 | Zero `any` types | static analysis | `grep -r ": any" src/ --include="*.ts" --include="*.tsx" \| wc -l` | N/A (grep check) |
| CLEAN-01 | Firebase packages removed | build | `npm ls @react-native-firebase/app 2>&1 \| grep -c "empty"` | N/A (package check) |
| CLEAN-02 | functions/ directory removed | file check | `test ! -d functions && echo "PASS"` | N/A |
| CLEAN-03 | Dead code removed | unit | `npm test -- --bail` (all tests pass) | Existing 73 test files |
| CLEAN-04 | Firebase config files removed | file check | Manual verification | N/A |
| CLEAN-05 | Sentry integrated | smoke | Manual -- trigger test error, verify in Sentry dashboard | Wave 0: create test |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit && npm test -- --bail`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + `tsc --noEmit` clean + zero JS files in src/ + successful EAS build

### Wave 0 Gaps
- [ ] `__tests__/services/sentryService.test.ts` -- covers CLEAN-05 Sentry initialization
- [ ] Jest setup rewrite needed: `__tests__/setup/jest.setup.js` -> `jest.setup.ts` with Firebase mocks removed
- [ ] Duplicate test file cleanup (`.js` + `.ts` pairs for same test subject)

## Sources

### Primary (HIGH confidence)
- npm registry -- `@sentry/react-native` version 8.5.0 confirmed, peer deps verified
- Sentry official docs (docs.sentry.io/platforms/react-native/manual-setup/expo/) -- Expo plugin setup, metro config, initialization
- Sentry official docs (docs.sentry.io/platforms/react-native/tracing/instrumentation/react-navigation/) -- React Navigation integration
- Sentry official docs (docs.sentry.io/platforms/react-native/tracing/instrumentation/custom-instrumentation/) -- Custom spans API
- Expo official docs (docs.expo.dev/guides/using-sentry/) -- EAS Update source maps, build integration
- Project codebase -- direct inspection of all files, imports, and configurations

### Secondary (MEDIUM confidence)
- Firebase removal impact on `useFrameworks: "static"` -- inferred from iOS build requirements, not officially documented for non-Firebase scenarios

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- `@sentry/react-native` version and compatibility verified against npm registry and official docs
- Architecture: HIGH -- patterns derived from official Sentry docs + existing codebase analysis
- Pitfalls: HIGH -- based on direct codebase inspection (App.js Firebase imports, duplicate test files, etc.)
- TypeScript conversion scope: MEDIUM -- exact file count depends on Phases 15-19 completion (unknown at research time)

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable domain, Sentry SDK updates are backward compatible)
