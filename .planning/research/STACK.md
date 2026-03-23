# Technology Stack

**Project:** Flick v1.2 -- Backend Migration, TypeScript, Performance Overhaul
**Researched:** 2026-03-23

## Recommended Stack

### Backend Platform: Supabase

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@supabase/supabase-js` | ^2.99.3 | Database, Auth, Storage, Realtime, Edge Functions client | Full BaaS replacing all 7 Firebase services. PostgreSQL gives SQL joins (eliminates chunked `in` queries), `COUNT(*)`, full-text search. Same managed experience as Firebase but relational. User already has other Supabase projects -- single dashboard. |
| Supabase Auth (Twilio) | Managed | Phone OTP authentication | Direct replacement for Firebase Phone Auth. Uses `signInWithOtp()` + `verifyOtp()`. Eliminates reCAPTCHA/APNs complexity. Requires Twilio account ($0.0079/SMS US). |
| Supabase Storage | Managed | Photo/snap/profile file storage | S3-compatible. Supports resumable uploads via TUS protocol (6MB chunks). RLS on buckets. Signed URLs built-in. |
| Supabase Realtime | Managed | Live subscriptions for feed, comments, messages | Postgres Changes for DB-driven updates + Broadcast for ephemeral events. Replaces 6 Firestore `onSnapshot` listeners. |
| Supabase Edge Functions | Managed (Deno) | Server-side logic replacing Cloud Functions | 100-200ms cold starts vs Firebase's 300-500ms. Written in TypeScript/Deno. Triggered by database webhooks, HTTP, or pg_cron. |
| `pg_cron` + `pg_net` | Managed extensions | Scheduled jobs (darkroom reveals, cleanup, notifications) | Replaces 7 Firebase scheduled functions. Runs inside Postgres -- no cold starts for DB operations. |

### Offline Sync: PowerSync

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@powersync/react-native` | ^1.29.0 | Bidirectional offline sync (SQLite <-> PostgreSQL) | Non-negotiable requirement: offline photo capture. PowerSync gives local SQLite that syncs to Supabase. Photos appear in darkroom instantly even offline. Better than Firestore's cache (full SQL locally, explicit sync rules, no silent data loss). Rust-based sync client now enabled by default. |
| `@powersync/react` | ^1.11.0 | React hooks for PowerSync queries | `useQuery()`, `useStatus()` hooks for reactive UI. |

### TypeScript Migration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `typescript` | ^5.9.3 | Type safety across codebase | Already in devDependencies. Expo SDK 54 has full TS support via `expo/tsconfig.base`. React Native 0.81 ships Strict TypeScript API. |
| `@types/react` | ~19.1.10 | React type definitions | Already installed. |
| tsconfig.json | -- | Extend `expo/tsconfig.base` with `allowJs: true`, `strict: true` | Existing tsconfig extends expo base. Add `allowJs: true` for incremental migration, `strict: true` for new files. |

### Performance Monitoring (replacing Firebase Performance)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@sentry/react-native` | ^6.x | Crash reporting + performance monitoring | Replaces `@react-native-firebase/perf`. Production-grade APM with transaction tracing, slow frame detection, app start metrics. Free tier: 5K transactions/mo. Industry standard for RN apps. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tus-js-client` | ^4.x | Resumable file uploads | For photos >6MB or unstable networks. Supabase Storage uses TUS protocol natively. |
| `expo-secure-store` | ~15.0.8 | Secure token storage | Already installed. Store Supabase session tokens securely. |
| `@react-native-async-storage/async-storage` | 2.2.0 | General persistence | Already installed. Keep for non-sync app state. PowerSync replaces it for synced data. |
| `zod` | ^3.x | Request/response validation | Already used in Cloud Functions. Bring to client side for Supabase RPC type validation and runtime type checking. |

## What to Remove

| Package | Why Remove |
|---------|-----------|
| `@react-native-firebase/app` | Replaced by `@supabase/supabase-js` |
| `@react-native-firebase/auth` | Replaced by Supabase Auth |
| `@react-native-firebase/firestore` | Replaced by Supabase + PowerSync |
| `@react-native-firebase/functions` | Replaced by Supabase Edge Functions |
| `@react-native-firebase/messaging` | App uses `expo-notifications` for push delivery. This package was only for FCM token registration. Push tokens stored in Supabase instead. |
| `@react-native-firebase/perf` | Replaced by Sentry |
| `@react-native-firebase/storage` | Replaced by Supabase Storage |
| `firestore-jest-mock` (devDep) | No Firestore to mock. Replace with Supabase local dev or direct PostgreSQL test utilities. |
| `GoogleService-Info.plist` | No Firebase native config needed |
| `google-services.json` | No Firebase native config needed |
| `firebase.json` | No Firebase CLI config needed |
| `firestore.rules` (389 lines) | Replaced by Supabase RLS policies |
| `storage.rules` (53 lines) | Replaced by Supabase Storage RLS |
| `withFirebaseFix.js` plugin | iOS-only Podfile fix for Firebase + Expo 54 -- no longer needed |

**CRITICAL:** Removing all `@react-native-firebase/*` packages removes native modules. The next build MUST be a full EAS native build -- OTA update will NOT work. Same applies when adding PowerSync (native SQLite module). Plan for a single native rebuild that removes Firebase and adds PowerSync + Supabase simultaneously.

## Backend Comparison Matrix

### Candidates Evaluated

| Criterion | Supabase + PowerSync | Custom API (Node/Fastify + PostgreSQL + Redis) | Neon + Pocketbase / Cobbled Services |
|-----------|---------------------|-----------------------------------------------|--------------------------------------|
| **Real-time subscriptions** | Built-in Postgres Changes + Broadcast. Single-threaded ordering (can bottleneck at scale). Reconnection gap mitigated by PowerSync local cache. | WebSocket server (Socket.io/ws). Full control, proven at scale. Must build, deploy, and maintain. | No built-in. Must add Socket.io layer. |
| **File storage** | Built-in S3-compatible. Resumable uploads (TUS). RLS on buckets. Signed URLs. Dashboard management. | Self-managed S3/R2/Backblaze B2. Full control, more config. | No storage. Add S3/R2 separately. |
| **Phone auth** | Built-in via Twilio/MessageBird/Vonage. Dashboard config. `signInWithOtp()` API. | Build auth service with Twilio API directly + JWT management. More control, more code, more security surface. | No auth. Add Auth0/Clerk ($25+/mo). |
| **Cloud functions equivalent** | Edge Functions (Deno, 100-200ms cold start). Database webhooks + pg_cron for triggers/schedules. | Express/Fastify routes. Zero cold start if always-on. Full Node.js ecosystem. | No functions. Need separate compute (Railway/Fly.io). |
| **Offline support** | PowerSync ($49/mo). Local SQLite, bidirectional sync, conflict resolution. Battle-tested with Supabase. | Build custom sync with WatermelonDB or similar. 2-4 months of work alone. | Same as custom -- no built-in offline. |
| **Push notifications** | Edge Function + Expo push service (same architecture as current). Database webhook triggers on insert. | Express route + Expo push service. Same effort either way. | N/A -- need separate compute. |
| **Cost (<1K users)** | ~$74/mo (Supabase Pro $25 + PowerSync Pro $49) | ~$40-100/mo (VPS + managed Postgres + Redis + S3) | ~$75-150/mo (Neon + compute + storage + auth service) |
| **Cost (10K users)** | ~$150-250/mo (Pro + usage overages) | ~$150-400/mo (scaling compute, DB, cache, monitoring) | ~$200-400/mo (scaling all separate services) |
| **Migration effort** | 35-47 days (per existing analysis). Service-by-service rewrite. | 70-100+ days. Build entire API layer, auth, storage, realtime, offline sync from scratch. | 55-80+ days. Database only managed -- everything else DIY. |
| **Ongoing maintenance** | Low -- managed platform. Auto-backups, scaling, dashboard, monitoring built-in. | High -- deployments, security patches, scaling decisions, monitoring setup, on-call. | Medium-High -- database managed, 4+ other services self-maintained. |
| **Risk level** | Medium -- Supabase Realtime younger than Firestore. PowerSync adds dependency. Both well-mitigated. | Low technical risk, high execution risk -- massive scope, many architectural decisions, long timeline for solo dev. | High -- integrating 5+ services creates many failure points. |
| **TypeScript support** | Excellent -- `supabase gen types typescript` generates DB types automatically. Edge Functions are TypeScript-native. | Excellent -- full control over types. | Varies by service. |

### Recommendation: Supabase + PowerSync

**Why Supabase wins for this project:**

1. **Migration effort is 2-3x less** than custom backend. The 20 existing service files (~7,800 lines) map cleanly to Supabase equivalents. A custom API requires building auth, storage, realtime, and offline sync from zero.

2. **SQL solves the actual performance problems.** The feed uses chunked `in` queries (30-ID max per chunk) because Firestore has no joins. A single SQL `SELECT ... JOIN friendships ... WHERE status = 'accepted'` replaces this entirely. Darkroom reveals, comment threading, friend suggestions, unread counts -- all become single queries.

3. **PowerSync solves offline better than Firestore ever did.** Photos taken offline appear in darkroom immediately (current system does not do this). Triage decisions (journal/archive/delete) work offline. No silent photo loss after 3 retries. Full SQL locally means complex queries work offline too.

4. **User already has Supabase experience** with other projects. Familiar with dashboard, RLS patterns, Edge Functions. Zero learning curve on the platform itself.

5. **Cost is predictable and lower.** Firebase charges per document read/write -- social apps with feeds generate heavy read amplification. Supabase's compute-based pricing doesn't penalize read-heavy patterns.

6. **TypeScript generation from schema** is a massive DX win. `supabase gen types typescript` produces exact types for every table, view, and function. No manual type maintenance.

**Why NOT custom backend (Node + PostgreSQL + Redis):**
- Solo developer maintaining a social app. Infrastructure management (deployments, scaling, monitoring, security patches, SSL, CORS) is a full-time distraction that adds zero user value.
- Building offline sync from scratch is a multi-month sub-project alone.
- No team to distribute operational burden. On-call for self-hosted infra is brutal solo.

**Why NOT Neon + cobbled services:**
- Neon is a database, not a BaaS. Requires adding auth (Clerk/Auth0: $25+/mo), storage (S3: $5+/mo), realtime (custom Socket.io on Railway: $10+/mo), compute (Railway: $10+/mo), and offline sync (custom build) separately. More services = more integration points = more failure modes = higher total cost.
- Neon was acquired by Databricks in May 2025 -- strategic direction uncertain for indie developer use cases.

## Supabase Plan Requirements

| Service | Plan | Cost | Key Limits |
|---------|------|------|------------|
| Supabase | Pro | $25/mo | 8GB DB, 100GB file storage, 100K MAUs, 500 concurrent Realtime connections |
| PowerSync | Pro | $49/mo | 30GB synced/mo, 1K peak connections, 10GB hosted data |
| Twilio | Pay-as-you-go | ~$5-20/mo | $0.0079/SMS (US), $0.05/SMS (intl). Only charged on actual OTP sends. |
| Sentry | Free or Team | $0-26/mo | Free: 5K transactions. Team: 50K transactions. |
| **Total** | | **~$79-120/mo** | Scales predictably with usage |

**Comparison:** Firebase current cost is variable per-read/write. A social app feed where 100 users each view 20 photos = 2,000 document reads per feed load. With Supabase this is 100 SQL queries (one per user). The read amplification penalty disappears.

## TypeScript Migration Strategy

**Approach:** Incremental with `allowJs: true`. Convert files organically as they are touched for the Supabase migration.

```json
// tsconfig.json (updated)
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "allowJs": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "app.config.js"],
  "exclude": ["node_modules", "functions"]
}
```

**Migration order (tied to Supabase migration):**
1. **Types first** -- Create `src/types/` with Supabase-generated types (`supabase gen types typescript --project-id <id> --schema public > src/types/database.ts`). This single file gives typed access to every table.
2. **Services** -- Convert each service file `.js` -> `.ts` as it is rewritten for Supabase. This is the natural entry point since every service file must be rewritten anyway.
3. **Hooks** -- Convert custom hooks (high value: type-safe return values prevent misuse).
4. **Context** -- Convert providers (type-safe context values eliminate null-check bugs).
5. **Components** -- Convert as touched during performance work.
6. **Sweep** -- Final pass for remaining `.js` files after major work completes.

**Lint-staged update needed:**
```json
"lint-staged": {
  "*.{js,jsx,ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md}": [
    "prettier --write"
  ]
}
```

**Do NOT:**
- Convert all files at once (blocks development, creates merge conflicts)
- Use `any` to silence type errors (defeats the purpose -- use `unknown` and narrow)
- Convert test files before their source files
- Create a separate `tsconfig.strict.json` -- one config is simpler

## Edge Functions Structure (replacing Cloud Functions)

```
supabase/
  functions/
    send-push-notification/    # Replaces onNewMessage, sendReactionNotification
    process-darkroom-reveals/  # Replaces processDarkroomReveals (called by pg_cron)
    get-signed-url/            # Replaces getSignedPhotoUrl
    delete-user-account/       # Replaces deleteUserAccount
    process-scheduled-deletions/ # Replaces processScheduledDeletions
    cleanup-old-notifications/ # Replaces cleanupOldNotifications
    cleanup-expired-snaps/     # Replaces cleanupExpiredSnaps
    get-mutual-suggestions/    # Replaces getMutualFriendSuggestions
    send-batched-notification/ # Replaces sendBatchedNotification (Cloud Tasks -> pg_cron)
  migrations/                  # SQL migration files
  seed.sql                     # Dev data seeding
  config.toml                  # Supabase project config
```

**Key change:** Firestore triggers (11 functions) become PostgreSQL triggers + database webhooks. Simple operations (increment friend count, update lastMessage) run as PL/pgSQL functions directly in the database -- zero cold start, zero network hop.

## Installation

```bash
# Core -- Supabase client
npm install @supabase/supabase-js

# Offline sync -- PowerSync (requires native rebuild)
npm install @powersync/react-native @powersync/react

# Performance monitoring (replacing Firebase Perf)
npm install @sentry/react-native

# Resumable uploads for large photos
npm install tus-js-client

# Validation (bring to client from functions/)
npm install zod

# Supabase CLI (for Edge Functions, migrations, type generation)
npm install -D supabase

# After migration is COMPLETE -- remove Firebase (NOT before)
npm uninstall @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore @react-native-firebase/functions @react-native-firebase/messaging @react-native-firebase/perf @react-native-firebase/storage
npm uninstall -D firestore-jest-mock
```

**IMPORTANT: Build order matters.**
1. Install Supabase + PowerSync + Sentry
2. Run dual-stack during migration (both Firebase and Supabase active)
3. Remove Firebase packages only after ALL services are migrated and tested
4. Single EAS native rebuild after Firebase removal + PowerSync addition
5. PowerSync's `@powersync/react-native` includes native SQLite -- requires EAS Build, not OTA

## Sources

- [Supabase JS SDK (npm)](https://www.npmjs.com/package/@supabase/supabase-js) -- v2.99.3, published 3 days ago
- [PowerSync React Native (npm)](https://www.npmjs.com/package/@powersync/react-native) -- v1.29.0, published 17 days ago
- [Supabase Pricing](https://supabase.com/pricing) -- Pro $25/mo, verified 2026-03-23
- [PowerSync Pricing](https://www.powersync.com/pricing) -- Pro from $49/mo, verified 2026-03-23
- [Supabase Phone Auth Docs](https://supabase.com/docs/guides/auth/phone-login) -- OTP via Twilio
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits) -- Single-threaded Postgres Changes
- [Supabase Realtime Troubleshooting](https://supabase.com/docs/guides/realtime/troubleshooting) -- Reconnection data loss documented
- [Supabase Edge Functions Architecture](https://supabase.com/docs/guides/functions/architecture) -- Deno runtime, global deployment
- [Supabase Resumable Uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads) -- TUS protocol, 6MB chunks
- [Supabase Cron (pg_cron)](https://supabase.com/docs/guides/cron) -- Schedule Edge Functions + DB functions
- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks) -- Trigger Edge Functions from DB events
- [PowerSync + Supabase Integration](https://docs.powersync.com/integration-guides/supabase-+-powersync) -- Official guide
- [PowerSync React Native Group Chat Demo](https://github.com/powersync-ja/powersync-js/blob/main/demos/react-native-supabase-group-chat/README.md) -- Reference architecture
- [Expo TypeScript Guide](https://docs.expo.dev/guides/typescript/) -- tsconfig.base extension
- [Supabase + Expo Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
- [Supabase Push Notifications Guide](https://supabase.com/docs/guides/functions/examples/push-notifications) -- Edge Function + Expo pattern
- [Neon vs Supabase](https://www.bytebase.com/blog/neon-vs-supabase/) -- Comparison reference
- [Existing Migration Analysis](../SUPABASE-MIGRATION-ANALYSIS.md) -- 2026-03-18, codebase audit
- [Supabase vs Firebase 2026 Tests](https://tech-insider.org/supabase-vs-firebase-2026/) -- Cold start benchmarks
- [React Native JS to TS Migration Guide](https://www.creolestudios.com/react-native-javascript-to-typescript-migration/) -- Incremental patterns

---

_Stack research for: Flick v1.2 Speed & Scale_
_Researched: 2026-03-23_
