# Phase 12: Schema & Infrastructure Foundation - Research

**Researched:** 2026-03-23
**Domain:** PostgreSQL schema design, Supabase project setup, PowerSync sync rules, RLS policies, TypeScript tooling
**Confidence:** HIGH

## Summary

Phase 12 is pure infrastructure: design a normalized PostgreSQL schema in Supabase replacing all Firestore collections, configure PowerSync sync rules for offline-capable tables, implement RLS policies mirroring Firestore security rules, and set up TypeScript tooling with generated database types. No service rewrites occur in this phase -- it produces the data foundation that all subsequent phases build on.

The existing v1.2 research already contains a comprehensive 17-table draft schema (in ARCHITECTURE.md) that serves as the baseline. This phase's primary work is auditing that schema for completeness against the actual Firestore data model (which includes fields like `bio`, `selects`, `song`, `caption`, `readReceipts`, `pinnedSnap` data, and `reactionBatches` not fully captured in the draft), implementing RLS policies that mirror the 468-line `firestore.rules` file, configuring PowerSync sync rules for the 4 offline-capable tables, and wiring up the Supabase CLI + TypeScript type generation pipeline.

**Primary recommendation:** Use the Supabase CLI migration workflow (`supabase migration new`) to create timestamped SQL migration files. Build the schema incrementally: tables first, then indexes, then RLS policies, then PowerSync sync rules. Test RLS from the client SDK (not SQL editor) since the SQL editor bypasses RLS.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- snake_case for all PostgreSQL column names (standard Postgres convention)
- Supabase-generated TypeScript types will be snake_case; camelCase mapping happens in the service layer (Phase 13+)
- JSONB columns for flexible/nested data: user selects (array of interests), song (name/artist/previewUrl), pinned snap data
- Fully normalized tables for relational data (photos, friendships, conversations, messages, etc.)
- Draft schema from research (17 tables) is the baseline -- Claude audits for completeness against current Firestore collections during planning
- Sync 4 core tables: photos, conversations, friendships, streaks
- Photos: sync only last 30 days + all developing/revealed status photos. Older photos fetched on-demand from Supabase
- Only user's OWN photos sync -- friends' feed photos use TanStack Query cache for offline display (Phase 14)
- All conversations sync (metadata only, not messages) -- conversation list always available offline
- Messages, comments, notifications, albums stay online-only via Supabase Realtime or REST
- Cloud Supabase dev project (no Docker dependency) -- mirrors existing Firebase dev/prod project split
- Supabase CLI for migrations (`supabase migration new` creates timestamped SQL files in `supabase/migrations/`)
- Seed script (`supabase/seed.sql`) with test users, sample photos, conversations for quick dev database resets
- Standard Supabase CLI layout at repo root: `supabase/config.toml`, `supabase/migrations/`, `supabase/functions/`, `supabase/seed.sql`
- Full RLS enabled on ALL tables with explicit policies
- Friend-visibility for photos/feed: RLS subquery joins friendships table
- Block enforcement at RLS level -- blocked users physically cannot query your data
- Admin/debug access via service_role key (bypasses RLS)

### Claude's Discretion
- Exact index strategy beyond what the draft schema specifies
- PowerSync sync rule syntax and configuration details
- RLS policy implementation patterns (security definer functions vs inline policies)
- TypeScript tsconfig fine-tuning beyond the research recommendations
- Whether to create database views for common query patterns (e.g., feed view)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | PostgreSQL schema designed with normalized relational tables replacing all 15 Firestore collections | Draft 17-table schema from ARCHITECTURE.md as baseline; audit findings identify missing columns (bio, caption, song JSONB, readReceipts, darkroom state, reaction_batches); RLS-compatible CHECK constraints |
| INFRA-02 | Supabase project provisioned with database, auth, storage, and Edge Functions configured | Supabase CLI workflow documented; `supabase/config.toml` layout; dev project setup without Docker; Supabase Pro plan ($25/mo) |
| INFRA-03 | PowerSync configured with sync rules for offline-capable collections (photos, darkroom, conversations, friendships) | PowerSync sync rules YAML syntax documented; bucket_definitions with parameter queries using `request.user_id()`; 4-table sync scope locked; photos filtered to last 30 days + developing/revealed |
| INFRA-04 | Row-level security policies enforce per-user data access on all tables | Full Firestore rules analyzed (468 lines); RLS policy patterns documented per table; block enforcement via subquery; friend-visibility via friendships JOIN; security definer functions recommended for reuse |
| INFRA-05 | TypeScript foundation configured (tsconfig with allowJs, path aliases, Supabase-generated database types) | Current tsconfig is minimal (just extends expo/tsconfig.base); exact compilerOptions documented; `supabase gen types typescript` command verified; path alias `@/*` maps to `src/*`; lint-staged update needed for .ts/.tsx |
</phase_requirements>

## Standard Stack

### Core (Phase 12 specific)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `supabase` (CLI) | 2.83.0 | Migrations, type generation, project management | Official Supabase development tool; `supabase migration new` creates timestamped SQL files |
| `@supabase/supabase-js` | 2.100.0 | Client SDK for database, auth, storage | Required for type generation target; installed now but client usage starts Phase 13 |
| `@powersync/react-native` | 1.32.0 | Offline sync (SQLite <-> PostgreSQL) | Native SQLite adapter; requires EAS Build (not OTA); WebSocket connection default since v1.11.0 |
| `@powersync/react` | 1.9.0 | React hooks for PowerSync queries | `useQuery()`, `useStatus()` hooks for reactive UI |
| `@powersync/op-sqlite` | latest | SQLite adapter (recommended over Quick SQLite) | Built-in encryption via SQLCipher; better New Architecture compatibility |
| `@op-engineering/op-sqlite` | latest | Native SQLite engine | Peer dependency of `@powersync/op-sqlite` |
| `typescript` | 5.9.3 | Type checking | Already in devDependencies; no version change needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/react` | ~19.1.10 | React type definitions | Already installed |

**Installation (Phase 12):**
```bash
# Supabase CLI (dev dependency)
npm install -D supabase

# Supabase client (needed for type generation target)
npm install @supabase/supabase-js

# PowerSync (requires EAS native build)
npx expo install @powersync/react-native @powersync/react
npx expo install @powersync/op-sqlite @op-engineering/op-sqlite
```

**Note:** Installing PowerSync adds native SQLite modules. The next build MUST be a full EAS build, not OTA. However, since no service code changes ship in Phase 12, this install can be deferred to Phase 13 if desired. The schema and RLS work is purely server-side.

## Architecture Patterns

### Recommended Project Structure
```
supabase/
  config.toml                              # Supabase project configuration
  migrations/
    20260323000001_create_users.sql         # Users table + indexes
    20260323000002_create_photos.sql        # Photos table + indexes
    20260323000003_create_social.sql        # Friendships, blocks, reports
    20260323000004_create_conversations.sql # Conversations, messages, streaks
    20260323000005_create_content.sql       # Comments, albums, notifications, etc.
    20260323000006_create_rls_policies.sql  # All RLS policies
    20260323000007_create_views.sql         # Optional: feed view, friend list view
  seed.sql                                 # Test data for dev resets
  functions/                               # Edge Functions (empty for Phase 12)
src/
  types/
    database.ts                            # Generated by `supabase gen types typescript`
  lib/
    supabase.ts                            # Supabase client singleton (minimal for Phase 12)
    powersync/
      schema.ts                            # PowerSync client-side schema definition
      connector.ts                         # PowerSync <-> Supabase connector (stub)
```

### Pattern 1: Supabase CLI Migration Workflow
**What:** All schema changes are SQL migration files managed by Supabase CLI.
**When to use:** Every database change in this and future phases.
**Example:**
```bash
# Create a new migration
npx supabase migration new create_users

# This creates: supabase/migrations/<timestamp>_create_users.sql
# Write SQL in that file, then push to remote:
npx supabase db push
```
Source: [Supabase Database Migrations Docs](https://supabase.com/docs/guides/deployment/database-migrations)

### Pattern 2: RLS with Security Definer Helper Functions
**What:** Create reusable PostgreSQL functions for common access checks (is_friend, is_blocked, is_conversation_member) and reference them in RLS policies.
**When to use:** When the same access check appears in multiple table policies (friend-visibility is needed on photos, comments, albums, and viewed_photos).
**Example:**
```sql
-- Security definer function: runs with owner privileges, not caller's
CREATE OR REPLACE FUNCTION is_friend(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
    AND (
      (user1_id = auth.uid() AND user2_id = target_user_id)
      OR (user1_id = target_user_id AND user2_id = auth.uid())
    )
  );
$$;

-- RLS policy using the helper
CREATE POLICY "Friends can view photos"
  ON photos FOR SELECT
  USING (
    user_id = auth.uid()
    OR (photo_state = 'journal' AND is_friend(user_id))
  );
```

### Pattern 3: PowerSync Sync Rules (YAML)
**What:** Define which rows sync to which user devices via YAML bucket definitions.
**When to use:** For the 4 offline-capable tables (photos, conversations, friendships, streaks).
**Example:**
```yaml
bucket_definitions:
  user_photos:
    parameters: SELECT request.user_id() AS user_id
    data:
      - SELECT * FROM photos
        WHERE user_id = bucket.user_id
        AND deleted_at IS NULL
        AND (
          status IN ('developing', 'revealed')
          OR created_at > NOW() - INTERVAL '30 days'
        )

  user_conversations:
    parameters: SELECT request.user_id() AS user_id
    data:
      - SELECT c.* FROM conversations c
        WHERE c.participant1_id = bucket.user_id
           OR c.participant2_id = bucket.user_id

  user_friendships:
    parameters: SELECT request.user_id() AS user_id
    data:
      - SELECT * FROM friendships
        WHERE user1_id = bucket.user_id
           OR user2_id = bucket.user_id

  user_streaks:
    parameters: SELECT request.user_id() AS user_id
    data:
      - SELECT * FROM streaks
        WHERE user1_id = bucket.user_id
           OR user2_id = bucket.user_id
```
Source: [PowerSync Sync Rules Docs](https://docs.powersync.com/usage/sync-rules)

### Pattern 4: PowerSync Client-Side Schema
**What:** Define the local SQLite schema in TypeScript that mirrors the synced PostgreSQL tables.
**When to use:** PowerSync requires a client-side schema definition matching the sync rules.
**Example:**
```typescript
// src/lib/powersync/schema.ts
import { column, Schema, Table } from '@powersync/react-native';

const photos = new Table(
  {
    user_id: column.text,
    image_url: column.text,
    local_uri: column.text,
    thumbnail_data_url: column.text,
    status: column.text,
    photo_state: column.text,
    reveal_at: column.text,
    storage_path: column.text,
    caption: column.text,
    deleted_at: column.text,
    created_at: column.text,
  },
  { indexes: { user_status: ['user_id', 'status'] } }
);

const conversations = new Table({
  participant1_id: column.text,
  participant2_id: column.text,
  last_message_text: column.text,
  last_message_at: column.text,
  last_message_type: column.text,
  unread_count_p1: column.integer,
  unread_count_p2: column.integer,
  deleted_at_p1: column.text,
  deleted_at_p2: column.text,
});

const friendships = new Table({
  user1_id: column.text,
  user2_id: column.text,
  status: column.text,
  initiated_by: column.text,
  created_at: column.text,
});

const streaks = new Table({
  user1_id: column.text,
  user2_id: column.text,
  day_count: column.integer,
  last_snap_at_user1: column.text,
  last_snap_at_user2: column.text,
  last_mutual_at: column.text,
  expires_at: column.text,
  warning_sent: column.integer, // SQLite: 0/1 for boolean
});

export const AppSchema = new Schema({
  photos,
  conversations,
  friendships,
  streaks,
});

export type Database = (typeof AppSchema)['types'];
```
Source: [PowerSync React Native SDK](https://docs.powersync.com/client-sdks/reference/react-native-and-expo)

### Anti-Patterns to Avoid
- **JSONB for relational data:** Do NOT store friend lists, photo IDs, or participant arrays as JSONB. Use proper junction tables (friendships, album_photos). JSONB is only for truly flexible data: user selects array, song metadata object, pinned snap data.
- **Missing RLS on any table:** Every table MUST have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` even if the initial policy is restrictive. Supabase exposes tables via REST API by default -- a table without RLS is publicly readable.
- **Testing RLS from SQL editor:** The Supabase SQL editor runs as postgres role and bypasses RLS. Always test policies from the client SDK or using `SET ROLE authenticated; SET request.jwt.claims = '...'`.
- **Storing full Storage URLs in database:** Store storage paths (`photos/userId/photoId.jpg`), not full URLs. Generate URLs at read time via the Supabase client.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database type generation | Manual TypeScript interfaces matching SQL tables | `supabase gen types typescript` | Auto-generates from schema; stays in sync; includes all tables, views, functions |
| Migration management | Raw SQL files with manual ordering | Supabase CLI migrations (`supabase migration new`) | Timestamped ordering, rollback support, `supabase db push` for deployment |
| Offline sync protocol | Custom SQLite + HTTP sync | PowerSync | Conflict resolution, delta sync, automatic reconnection, bidirectional sync |
| Access control testing | Manual HTTP requests to test RLS | Supabase client SDK + test users | Matches real auth flow; catches policy gaps that manual testing misses |
| UUID generation | Custom ID schemes | `gen_random_uuid()` PostgreSQL builtin | Standard, indexed, no collision risk |
| Deterministic conversation/friendship IDs | Custom concatenation logic | CHECK constraint (`user1_id < user2_id`) + UNIQUE constraint | Database enforces ordering; prevents duplicate pairs |

## Common Pitfalls

### Pitfall 1: Missing Columns in Schema Draft
**What goes wrong:** The 17-table draft schema in ARCHITECTURE.md was created during high-level research and misses fields that exist in the actual Firestore data model.
**Why it happens:** The research analyzed service file structure but not every field in every document.
**How to avoid:** Audit every Firestore service file for ALL fields written to documents. Known gaps found during this research:
- `users` table: missing `bio`, `song` (JSONB: name, artist, previewUrl, artworkUrl), `selects` (JSONB array), `pinned_snap_data` (JSONB), `read_receipts_enabled` (boolean), `deletion_scheduled_at`, `deletion_reason`
- `photos` table: missing `caption` (TEXT, max 100 chars), `comment_count` (INTEGER), `reaction_count` (INTEGER), `tagged_users` (separate photo_tags table exists but needs verification)
- `conversations` table: missing `read_receipts` (JSONB map of userId -> timestamp), `deleted_messages` (JSONB), `last_message_sender_id`
- `darkrooms` collection: not represented as a table -- darkroom state (`next_reveal_at`) could be a column on users table or a separate `darkroom_state` table
- `reaction_batches` table: missing entirely from draft -- needed for notification batching (photoId, reactorId, reactions JSONB, status, sent_at)
**Warning signs:** A service file writes a field that has no corresponding column in the schema.

### Pitfall 2: RLS Policies Missing Block Enforcement
**What goes wrong:** RLS policies check friendship status but forget to also check the blocks table. A blocked user can still query photos/comments if they were previously friends.
**Why it happens:** Block checks are an additional layer on top of friend checks. Easy to forget.
**How to avoid:** Every RLS policy that grants access based on friendship MUST also include a NOT EXISTS check on the blocks table:
```sql
AND NOT EXISTS (
  SELECT 1 FROM blocks
  WHERE (blocker_id = auth.uid() AND blocked_id = photos.user_id)
     OR (blocker_id = photos.user_id AND blocked_id = auth.uid())
)
```
Create a `is_blocked(target_user_id)` security definer function and use it consistently.
**Warning signs:** Blocked user's content visible in any query result.

### Pitfall 3: PowerSync Publication Missing
**What goes wrong:** PowerSync cannot replicate data because the required PostgreSQL publication does not exist.
**Why it happens:** The `CREATE PUBLICATION powersync FOR ALL TABLES` statement must run in Supabase SQL editor. It is not part of the standard Supabase setup.
**How to avoid:** Include publication creation in the first migration file. Also create a dedicated `powersync_role` with REPLICATION and BYPASSRLS privileges.
**Warning signs:** PowerSync dashboard shows "connection failed" or "no replication slot."

### Pitfall 4: RLS Performance on Friend-Visibility Queries
**What goes wrong:** RLS policies with subqueries on the friendships table run for every row, making feed queries slow.
**Why it happens:** Without proper indexes, `SELECT EXISTS (SELECT 1 FROM friendships WHERE ...)` performs a sequential scan on every row evaluation.
**How to avoid:** Ensure composite indexes exist on `friendships(user1_id, status)` and `friendships(user2_id, status)`. Consider a security definer function that caches the friend list for the session. The draft schema already includes these indexes -- verify they are created.
**Warning signs:** Feed query taking >500ms; `EXPLAIN ANALYZE` shows sequential scans on friendships table.

### Pitfall 5: Forgetting `ENABLE ROW LEVEL SECURITY`
**What goes wrong:** Table is created but RLS is not enabled. Supabase exposes it via REST API with no access control.
**Why it happens:** `CREATE TABLE` does not enable RLS by default. It requires a separate `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statement.
**How to avoid:** Add `ALTER TABLE {name} ENABLE ROW LEVEL SECURITY` immediately after every CREATE TABLE in migration files. Consider adding `FORCE ROW LEVEL SECURITY` to also apply RLS to the table owner.
**Warning signs:** Any authenticated user can read/write any row.

### Pitfall 6: TypeScript `strict: true` Causing Immediate Errors
**What goes wrong:** Enabling strict mode in tsconfig causes hundreds of errors in existing JS files processed by TypeScript.
**Why it happens:** With `allowJs: true`, TypeScript checks JS files too. Strict null checks flag every nullable value in existing code.
**How to avoid:** Set `strict: false` initially. Only enable strict checks for NEW `.ts` files via per-file `// @ts-strict` or by enabling strict flags incrementally (`noImplicitAny` first, then `strictNullChecks` later).
**Warning signs:** 500+ type errors after enabling strict mode.

## Code Examples

### Supabase CLI Setup
```bash
# Initialize Supabase in project root
npx supabase init

# Link to remote dev project
npx supabase link --project-ref <project-id>

# Create first migration
npx supabase migration new create_users

# Push migrations to remote
npx supabase db push

# Generate TypeScript types
npx supabase gen types typescript --linked > src/types/database.ts

# Reset dev database (applies all migrations + seed)
npx supabase db reset --linked
```
Source: [Supabase CLI Docs](https://supabase.com/docs/guides/local-development/cli/getting-started)

### Complete Users Table Migration
```sql
-- supabase/migrations/<timestamp>_create_users.sql

CREATE TABLE users (
  id UUID PRIMARY KEY,                          -- Firebase Auth UID preserved
  phone TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  profile_photo_path TEXT,                      -- Storage path, not URL
  name_color TEXT,
  selects JSONB DEFAULT '[]'::jsonb,            -- Array of interest strings
  song JSONB,                                   -- {name, artist, previewUrl, artworkUrl}
  friend_count INTEGER DEFAULT 0,
  daily_photo_count INTEGER DEFAULT 0,
  last_photo_date DATE,
  fcm_token TEXT,
  push_token TEXT,                              -- Expo push token
  profile_setup_completed BOOLEAN DEFAULT FALSE,
  read_receipts_enabled BOOLEAN DEFAULT TRUE,
  deletion_scheduled_at TIMESTAMPTZ,
  deletion_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
CREATE INDEX idx_users_phone ON users(phone);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

### RLS Helper Functions
```sql
-- supabase/migrations/<timestamp>_create_rls_helpers.sql

-- Check if current user is friends with target user
CREATE OR REPLACE FUNCTION is_friend(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
    AND (
      (user1_id = auth.uid() AND user2_id = target_user_id)
      OR (user1_id = target_user_id AND user2_id = auth.uid())
    )
  );
$$;

-- Check if either user has blocked the other
CREATE OR REPLACE FUNCTION is_blocked(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = target_user_id)
       OR (blocker_id = target_user_id AND blocked_id = auth.uid())
  );
$$;

-- Check if current user is a participant in a conversation
CREATE OR REPLACE FUNCTION is_conversation_participant(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = conv_id
    AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
  );
$$;
```

### RLS Policies for Photos (Mirrors Firestore Rules)
```sql
-- SELECT: Owner always, friends if journal state, not blocked
CREATE POLICY "photos_select" ON photos FOR SELECT USING (
  user_id = auth.uid()
  OR (
    photo_state = 'journal'
    AND is_friend(user_id)
    AND NOT is_blocked(user_id)
  )
);

-- INSERT: Authenticated user can create own photos
CREATE POLICY "photos_insert" ON photos FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

-- UPDATE: Owner can update (except immutable fields enforced by trigger)
-- Non-owner handled by separate reaction/comment count policies
CREATE POLICY "photos_update_owner" ON photos FOR UPDATE USING (
  user_id = auth.uid()
);

-- DELETE: Only owner (soft delete via deleted_at)
CREATE POLICY "photos_delete" ON photos FOR DELETE USING (
  user_id = auth.uid()
);
```

### TypeScript Configuration
```json
// tsconfig.json (updated for Phase 12)
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": false,
    "allowJs": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*", "supabase/**/*.ts", "app.config.js"],
  "exclude": ["node_modules", "functions", "__tests__"]
}
```

### Supabase Client Singleton (Minimal for Phase 12)
```typescript
// src/lib/supabase.ts
import 'react-native-url-polyfill/dist/polyfill';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Database } from '../types/database';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### PowerSync Supabase Connector (Stub for Phase 12)
```typescript
// src/lib/powersync/connector.ts
import {
  PowerSyncBackendConnector,
  AbstractPowerSyncDatabase,
  UpdateType,
} from '@powersync/react-native';
import { supabase } from '../supabase';

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('No Supabase session found');
    }

    return {
      endpoint: process.env.POWERSYNC_URL || '',
      token: session.access_token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase) {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    for (const op of transaction.crud) {
      const record = { ...op.opData, id: op.id };
      const table = op.table;

      switch (op.op) {
        case UpdateType.PUT:
          await supabase.from(table).upsert(record);
          break;
        case UpdateType.PATCH:
          await supabase.from(table).update(op.opData).eq('id', op.id);
          break;
        case UpdateType.DELETE:
          await supabase.from(table).delete().eq('id', op.id);
          break;
      }
    }

    await transaction.complete();
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PowerSync HTTP streaming | WebSocket connection (default since v1.11.0) | @powersync/react-native 1.11.0 | Lower latency, better reconnection |
| PowerSync `bucket_definitions` in YAML | Sync Streams `config: edition: 3` format | Recent (edition 3) | Simplified syntax; `auto_subscribe: true` replaces parameter queries for simple cases |
| Quick SQLite adapter | OP-SQLite adapter (recommended) | 2025 | SQLCipher encryption, New Architecture support |
| Supabase JS v1 | Supabase JS v2 (current: 2.100.0) | 2023 | Modular imports, better TypeScript support, `createClient<Database>` generics |
| Manual TypeScript types | `supabase gen types typescript` | Supabase CLI v1+ | Auto-generated, always in sync with schema |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 + jest-expo 54.0.17 |
| Config file | `package.json` (jest config) + `__tests__/setup/jest.setup.js` |
| Quick run command | `npm test -- --testPathPattern=supabase` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Schema creates all tables with correct columns, constraints, FKs | integration | `npx supabase db reset --linked` (validates migrations apply cleanly) | No -- Wave 0 |
| INFRA-02 | Supabase project accessible, CLI linked, migrations pushable | smoke | `npx supabase db push --dry-run` | No -- manual verification |
| INFRA-03 | PowerSync sync rules deploy, client schema compiles | unit | `npx tsc --noEmit src/lib/powersync/schema.ts` | No -- Wave 0 |
| INFRA-04 | RLS policies allow/deny correct operations per user role | integration | SQL test script with `SET ROLE` + assertions | No -- Wave 0 |
| INFRA-05 | TypeScript compiles, types generate, path aliases resolve | unit | `npx tsc --noEmit` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (type checking)
- **Per wave merge:** `npm test` + `npx supabase db reset --linked`
- **Phase gate:** All migrations apply cleanly + TypeScript compiles + RLS test script passes

### Wave 0 Gaps
- [ ] `supabase/seed.sql` -- test data for dev database resets
- [ ] `__tests__/supabase/rls-policies.test.sql` -- RLS policy assertions (can be a SQL script run via Supabase CLI)
- [ ] `src/lib/powersync/schema.ts` -- PowerSync client-side schema (must compile)
- [ ] `src/types/database.ts` -- generated types file (created by `supabase gen types typescript`)
- [ ] Verify Supabase CLI is installed: `npx supabase --version`

## Schema Audit: Draft vs Actual Firestore Data Model

The draft schema in ARCHITECTURE.md has 17 tables. Based on auditing the Firestore rules (468 lines) and service files (26 files), the following gaps and adjustments are needed:

### Missing or Incomplete Tables/Columns

| Table | Issue | Resolution |
|-------|-------|------------|
| `users` | Missing: `bio`, `song` (JSONB), `selects` (JSONB array), `push_token`, `read_receipts_enabled`, `deletion_scheduled_at`, `deletion_reason` | Add columns |
| `photos` | Missing: `caption` (TEXT, max 100), `comment_count` (INT), `reaction_count` (INT) | Add columns; counts are denormalized for performance |
| `conversations` | Missing: `read_receipts` (JSONB), `deleted_messages` (JSONB), `last_message_sender_id` | Add columns |
| `darkrooms` | Not in draft as table; Firestore has `darkrooms/{userId}` collection | Add `next_reveal_at` column to `users` table (1:1 relationship, simpler) |
| `reaction_batches` | Missing entirely | Add table: `id`, `photo_id`, `reactor_id`, `reactions` (JSONB), `status`, `sent_at`, `created_at` |
| `messages` | Missing: `reaction` (TEXT or JSONB for emoji reaction messages), `pinned_snap_photo_id`, `screenshotted` (BOOLEAN), `screenshotted_at` | Add columns |
| `viewed_photos` | Exists in draft but Firestore has it as subcollection `users/{uid}/viewedPhotos/{photoId}` | Keep as flat table (already in draft) |
| `support_requests` | In draft but verify field names match Firestore: `category`, `description` vs `message` | Verify -- Firestore rules say `category` + `description` |

### Tables Confirmed Complete
- `friendships` -- matches Firestore rules (user1_id, user2_id, status, initiated_by/requestedBy, created_at)
- `blocks` -- matches (blocker_id, blocked_id, created_at)
- `reports` -- matches (reporter_id, reported_id, reason, details, created_at)
- `albums` -- matches (user_id, title/name, cover_photo_id, created_at)
- `album_photos` -- junction table replacing photoIds array
- `notifications` -- matches (user_id/recipientId, type, title, body, data JSONB, read, created_at)
- `photo_reactions` -- normalized from Firestore map (photo_id, user_id, emoji)
- `photo_tags` -- normalized from Firestore array (photo_id, user_id)
- `comment_likes` -- normalized from Firestore subcollection (comment_id, user_id)
- `streaks` -- matches Firestore structure

## RLS Policy Map (Firestore Rules -> PostgreSQL)

Complete mapping from the 468-line `firestore.rules` to RLS policies:

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `users` | Any authenticated user | Own user only (with required fields) | Own user only | Own user only |
| `photos` | Owner OR (journal + friend + not blocked) | Own user only | Owner (immutable fields protected) OR non-owner (reactions/comments only) | Owner only |
| `comments` | Same access as parent photo (requires photo check) | Authenticated, own userId, likeCount=0 | Author (text only) OR any auth user (likeCount only) | Author OR photo owner |
| `comment_likes` | Same access as parent photo | Authenticated, own userId | N/A (create/delete only) | Own likes only |
| `friendships` | Participants only (both users in the pair) | Authenticated, self is requester, status=pending | Recipient only (not requester), status+acceptedAt only | Participants only |
| `notifications` | Own notifications only (recipientId) | Service role only (Cloud Functions) | Own only, read/readAt fields only | Own only |
| `albums` | Owner OR friends | Owner only | Owner only (userId+createdAt immutable) | Owner only |
| `blocks` | Blocker or blocked user | Blocker only | Never (create/delete only) | Blocker only |
| `reports` | Service role only | Own reporter_id | Never (immutable) | Never (immutable) |
| `support_requests` | Service role only | Own userId | Never (immutable) | Never (immutable) |
| `conversations` | Participants only | Participant only, 2 participants | Participant only, restricted fields (deletedAt, unreadCount, readReceipts) | Never (permanent) |
| `messages` | Conversation participants | Participant, must be sender | Non-sender only (viewedAt, screenshotted) | Never (permanent, retained for moderation) |
| `streaks` | Participants only | Service role only (server-authoritative) | Service role only | Service role only |
| `viewed_photos` | Own only | Own only | Own only | Own only |
| `reaction_batches` | Service role only | Service role only | Service role only | Service role only |

## Open Questions

1. **Darkroom state: column on users vs separate table?**
   - What we know: Firestore has `darkrooms/{userId}` as a separate collection with `userId`, `nextRevealAt`, `createdAt`. It is a 1:1 relationship with users.
   - What's unclear: Whether to keep as separate table (cleaner separation, easier PowerSync sync rules) or add `next_reveal_at` column to users (fewer JOINs, simpler).
   - Recommendation: Add `next_reveal_at` to users table. It is a single column, queried frequently alongside user data, and a separate table adds unnecessary complexity for a 1:1 relationship.

2. **PowerSync Sync Streams vs Legacy Sync Rules?**
   - What we know: PowerSync has introduced "Sync Streams" (edition 3) as a newer format alongside legacy "bucket_definitions".
   - What's unclear: Whether edition 3 is production-ready and fully documented for all use cases.
   - Recommendation: Use Sync Streams (edition 3) with `auto_subscribe: true` if the PowerSync dashboard supports it for the project. Fall back to legacy bucket_definitions if issues arise. Both achieve the same result.

3. **Database views for feed query?**
   - What we know: The feed query requires joining photos + friendships + blocks (WHERE friend AND NOT blocked AND journal state). This is complex for RLS alone.
   - What's unclear: Whether a view improves performance or just readability.
   - Recommendation: Create a `feed_photos` view in Phase 12 as a convenience. The view inherits the underlying tables' RLS policies. This simplifies Phase 15's feed service rewrite.

## Sources

### Primary (HIGH confidence)
- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) -- RLS syntax, policy structure, auth.uid() usage
- [Supabase Database Migrations Docs](https://supabase.com/docs/guides/deployment/database-migrations) -- CLI migration workflow
- [Supabase TypeScript Type Generation](https://supabase.com/docs/guides/api/rest/generating-types) -- `supabase gen types typescript` command
- [PowerSync + Supabase Integration Guide](https://docs.powersync.com/integration-guides/supabase-+-powersync) -- Full setup guide, publication creation, connector pattern
- [PowerSync React Native SDK](https://docs.powersync.com/client-sdks/reference/react-native-and-expo) -- Installation, schema definition, connector implementation
- [PowerSync Sync Rules](https://docs.powersync.com/usage/sync-rules) -- YAML syntax, bucket_definitions, parameter queries

### Secondary (MEDIUM confidence)
- [Supabase RLS Best Practices (MakerKit)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) -- Security definer pattern, index optimization
- [Supabase RLS Complete Guide 2026](https://vibeappscanner.com/supabase-row-level-security) -- Common mistakes, testing strategies
- [PowerSync Sync Rules Blog](https://www.powersync.com/blog/sync-rules-from-first-principles-partial-replication-to-sqlite) -- Conceptual explanation of partial replication

### Tertiary (LOW confidence)
- PowerSync Sync Streams edition 3 format -- observed in integration guide but not fully documented separately; may evolve

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all package versions verified via npm registry on 2026-03-23
- Architecture: HIGH -- Supabase CLI migration workflow and PowerSync setup are well-documented with official guides
- Schema design: HIGH -- based on direct audit of 468-line Firestore rules + 26 service files + draft schema
- RLS policies: HIGH -- direct 1:1 mapping from existing Firestore rules with verified PostgreSQL syntax
- PowerSync sync rules: MEDIUM -- sync rules YAML syntax verified, but Sync Streams edition 3 format is newer and less documented
- TypeScript tooling: HIGH -- tsconfig patterns verified against Expo docs and existing project setup

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain -- Supabase and PowerSync APIs are mature)
