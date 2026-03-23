# Research Summary: Flick v1.2 -- Speed & Scale

**Domain:** Backend migration (Firebase -> Supabase), TypeScript conversion, performance overhaul
**Researched:** 2026-03-23
**Overall confidence:** MEDIUM-HIGH

## Executive Summary

The v1.2 milestone is a full backend migration from Firebase to Supabase + PowerSync, an incremental TypeScript conversion, and a performance overhaul across the entire app. The goal is "same app, same features -- rebuilt on a faster, more scalable backend with TypeScript." No new user-facing features are being added.

Three backend candidates were evaluated: Supabase (managed BaaS with PostgreSQL), a custom API (Node/Fastify + PostgreSQL + Redis), and Neon/cobbled services (serverless PostgreSQL + separate auth/storage/compute). **Supabase + PowerSync is the clear recommendation** for a solo developer maintaining a production social app. It provides 2-3x less migration effort than a custom backend (~35-47 days vs 70-100+), solves the actual performance bottlenecks (SQL joins replace Firestore's chunked `in` queries), and delivers better offline support than Firestore (PowerSync's local SQLite gives instant darkroom rendering even offline).

The stack change is significant: all 7 `@react-native-firebase/*` packages are removed and replaced by `@supabase/supabase-js` (v2.99.3) + `@powersync/react-native` (v1.29.0). This is a native module change requiring a full EAS Build -- not an OTA update. The 20 service files (~7,800 lines) in `src/services/firebase/` must be rewritten, and the 30+ Cloud Functions in `functions/index.js` must be ported to Supabase Edge Functions (Deno/TypeScript) + PostgreSQL triggers + pg_cron scheduled jobs.

TypeScript migration is handled incrementally: `allowJs: true` in tsconfig.json, converting files as they are touched during the Supabase migration. Supabase's `gen types typescript` command auto-generates database types from the schema, giving type-safe access to every table from day one. The existing `typescript` (^5.9.3) and `@types/react` (~19.1.10) packages are already installed.

The highest-risk areas are: (1) auth migration -- Firebase phone auth has no exportable credential, requiring either keeping Firebase Auth during transition or forcing user re-verification; (2) Supabase Realtime reliability -- younger than Firestore's `onSnapshot`, with documented reconnection data loss that PowerSync mitigates; (3) Cloud Functions business logic -- 30 functions containing streak calculations, notification batching, darkroom reveals, and cascade deletions must be explicitly ported, not just replaced at the API level.

## Key Findings

**Stack:** Replace all 7 Firebase packages with `@supabase/supabase-js` (^2.99.3), add `@powersync/react-native` (^1.29.0) for offline sync, add `@sentry/react-native` (^6.x) replacing Firebase Performance Monitoring. Total new cost: ~$79-120/mo (Supabase Pro $25 + PowerSync Pro $49 + Twilio pay-as-you-go + optional Sentry).

**Architecture:** Service layer pattern preserved. Each Firebase service file is rewritten as a Supabase/PowerSync equivalent. Cloud Functions become Edge Functions (Deno) + PostgreSQL triggers + pg_cron. Firestore's denormalized document model is normalized into proper relational tables with foreign keys.

**Critical pitfall:** Firebase phone auth users have no exportable credentials. Auth migration must either (a) keep Firebase Auth as identity provider during transition and migrate last, or (b) implement a "drip migration" with one-time re-verification screen. Getting this wrong breaks all user sessions simultaneously.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Schema Design + Infrastructure Setup** -- Design normalized PostgreSQL schema, Supabase project setup, PowerSync configuration, TypeScript foundation
   - Addresses: Database normalization (PITFALLS #3), TypeScript setup, RLS policies (PITFALLS #11)
   - Avoids: Starting code before the data model is proven

2. **Auth + Storage Migration** -- Phone auth via Supabase/Twilio, photo storage migration, signed URL service
   - Addresses: Auth parity (FEATURES table stakes), storage with dual-backend overlap (PITFALLS #4)
   - Avoids: Breaking existing user sessions (PITFALLS #1)

3. **Core Services Migration** -- Photo, feed, darkroom, friendship services rewritten for Supabase + PowerSync
   - Addresses: The primary performance wins (SQL joins replacing chunked queries), offline photo capture
   - Avoids: Migrating real-time listeners piecemeal (PITFALLS #2)

4. **Messaging + Social Migration** -- Conversations, messages, snaps, streaks, comments, notifications
   - Addresses: Real-time messaging, snap lifecycle, streak logic
   - Avoids: Orphaning Cloud Functions business logic (PITFALLS #5)

5. **Background Jobs + Cleanup** -- Edge Functions for scheduled jobs, notification batching, dead code removal, Firebase package removal
   - Addresses: Darkroom reveals, streak expiry, snap cleanup, account deletion cascade
   - Avoids: Upload queue breakage during storage switch (PITFALLS #8)

6. **Performance Polish** -- Skeleton screens, BlurHash, optimistic updates, loading states
   - Addresses: "Instagram/TikTok-level instant" UX target
   - Avoids: Premature optimization before backend fixes the real bottleneck (PITFALLS #7)

**Phase ordering rationale:**
- Schema first because every other phase depends on correct table design
- Auth + Storage early because every service operation requires an authenticated user and a storage target
- Core services before messaging because feed/photos are higher traffic than DMs
- Background jobs after client services because they are not user-facing
- Performance polish last because the backend migration itself eliminates the primary bottleneck (Firestore query limitations)

**Research flags for phases:**
- Phase 2: Auth migration strategy needs deeper design (keep Firebase Auth during transition vs. re-verification)
- Phase 3: PowerSync sync rules and conflict handling need phase-specific research
- Phase 4: Supabase Realtime reconnection reliability needs testing under real conditions
- Phase 5: Notification batching replacement (Cloud Tasks -> pg_cron) needs design spike

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified on npm. Supabase JS v2.99.3 and PowerSync v1.29.0 confirmed current. Pricing verified on official pages. |
| Features | MEDIUM-HIGH | Feature parity checklist comprehensive (30 Cloud Functions, 23 service files catalogued). Performance UX patterns (skeletons, optimistic updates) are well-established. |
| Architecture | MEDIUM | Supabase + PowerSync architecture is proven (official demos exist including group chat) but specific sync rules for Flick's data model need phase-specific design. |
| Pitfalls | HIGH | 16 pitfalls documented with prevention strategies. Critical auth and storage migration risks verified against official Firebase export docs and Supabase migration guides. |

## Gaps to Address

- **Auth migration strategy detail:** Keep Firebase Auth during transition (simpler, zero downtime) vs. replace early (cleaner, but forces re-verification). Needs architectural decision before Phase 2.
- **PowerSync sync rules for Flick's data model:** The existing analysis has example YAML but needs validation against all 13 collections' access patterns.
- **Supabase Realtime under real load:** Documented single-threaded bottleneck for Postgres Changes. Need to test with expected concurrent connection count (~50-200 for initial user base).
- **Edge Functions Deno compatibility:** Cloud Functions use Node.js packages (Expo Server SDK, Nodemailer). Verify these work in Deno runtime or find Deno equivalents.
- **Data migration script:** Firestore export -> PostgreSQL import with normalization. Estimated 200-500 lines. Needs dedicated implementation.
- **Upload queue drain strategy:** Must ensure all queued uploads complete before switching storage backends. Needs implementation design.

---

_Research summary: Flick v1.2 -- Speed & Scale_
_Researched: 2026-03-23_
