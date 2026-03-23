# Phase 14: Data Layer & Caching Foundation - Research

**Researched:** 2026-03-23
**Domain:** TanStack Query + PowerSync + AsyncStorage persistence for React Native
**Confidence:** HIGH

## Summary

Phase 14 is pure infrastructure scaffolding: install and configure TanStack Query v5 with AsyncStorage persistence, install and configure PowerSync React Native SDK with the Supabase connector, establish the query key factory pattern, and build one proof-of-concept hook (useProfile) to validate the stack end-to-end. No existing hooks or services are rewritten -- that happens in Phases 15-17.

The key architectural decision is the boundary between PowerSync and TanStack Query. PowerSync's `useQuery` (from `@powersync/react`) handles reads for the 4 synced tables (photos, conversations, friendships, streaks) -- these render from local SQLite with 0ms network latency. TanStack Query's `useQuery` handles all non-synced data (comments, notifications, albums, user profiles) with network fetches, caching, and optional AsyncStorage persistence for instant cold-start rendering. TanStack `useMutation` handles all writes regardless of data type.

**Primary recommendation:** Install TanStack Query v5 + its AsyncStorage persister, PowerSync React Native + React hooks, configure both providers in App.js, create the query key factory, and validate with a useProfile PoC hook. Do NOT use `@powersync/tanstack-react-query` (alpha 0.2.2) -- use the two systems independently with clear boundaries.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- PowerSync useQuery() for reading synced tables (photos, conversations, friendships, streaks)
- TanStack useMutation() for all writes, TanStack useQuery() for non-synced data (comments, notifications, albums, user profiles)
- PowerSync local writes for all 4 synced tables -- write to local SQLite first, PowerSync syncs to Supabase. Instant UI update, works offline
- No abstraction layer -- hooks explicitly use PowerSync or TanStack depending on the data type. Developers always know where data comes from
- Supabase Realtime changes invalidate TanStack Query cache via queryClient.invalidateQueries() -- no direct cache patching
- Global staleTime: 30 seconds
- Refetch on app foreground: enabled
- Retry policy: 3 retries with exponential backoff (1s, 2s, 4s) -- TanStack Query default
- gcTime: 10 minutes
- AsyncStorage as persistence backend
- Persist critical screens only: feed, conversations list, user profile queries
- 24-hour cache expiry
- Phase 14 builds foundation only + one PoC hook (useProfile)
- New data layer code lives in src/lib/ directory: queryClient.ts, powersync.ts, supabase.ts
- Query key factory pattern in src/lib/queryKeys.ts

### Claude's Discretion
- Exact PowerSync initialization sequence and error handling
- QueryClient provider placement in the component tree
- AsyncStorage persister configuration details (throttle time, serialization)
- useProfile hook implementation details
- Whether to create a shared mutation helper for optimistic updates pattern

### Deferred Ideas (OUT OF SCOPE)
None

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERF-01 | TanStack Query integrated -- all data fetching uses useQuery/useMutation with automatic caching | QueryClient setup, provider configuration, query key factory pattern, useProfile PoC hook |
| PERF-08 | Offline query persistence via TanStack Query + AsyncStorage (app opens instantly with cached data) | createAsyncStoragePersister + PersistQueryClientProvider with dehydrateOptions for selective persistence |
| PERF-09 | PowerSync local SQLite provides instant reads for photos, darkroom, conversations, friendships (0ms network latency) | PowerSync React Native SDK setup, schema definition, SupabaseConnector, provider wrapping |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | 5.95.2 | Server state management with caching | Industry standard for React data fetching. Provides useQuery/useMutation, automatic refetching, cache invalidation, deduplication. Replaces manual useState+useEffect patterns |
| `@tanstack/react-query-persist-client` | 5.95.2 | PersistQueryClientProvider component | Required wrapper to restore persisted cache on app start. Provides onSuccess callback for resuming paused mutations |
| `@tanstack/query-async-storage-persister` | 5.95.2 | AsyncStorage adapter for cache persistence | Creates a persister that serializes the query cache to AsyncStorage. Supports throttling, custom serialization |
| `@powersync/react-native` | 1.32.0 | Offline SQLite sync with Supabase | Local SQLite database that syncs bidirectionally with Supabase Postgres. Provides instant reads, offline writes, automatic conflict resolution |
| `@powersync/react` | 1.9.0 | React hooks for PowerSync queries | useQuery, useStatus, usePowerSync hooks. Reactive queries that auto-update when underlying tables change |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-native-async-storage/async-storage` | 2.2.0 (installed) | Persistence backend | Already installed. Used by TanStack persister and Supabase auth session storage |
| `@supabase/supabase-js` | 2.100.0 (installed) | Supabase client | Already installed at src/lib/supabase.ts. Used by PowerSync connector for auth tokens and by TanStack query functions |
| `@journeyapps/react-native-quick-sqlite` | latest | SQLite adapter for PowerSync | Required native dependency for PowerSync. More battle-tested than OP-SQLite in production |

### NOT Using

| Package | Version | Why Not |
|---------|---------|---------|
| `@powersync/tanstack-react-query` | 0.2.2 (alpha) | Alpha status, unclear stability. The CONTEXT.md decision is to use PowerSync and TanStack independently with clear boundaries. This package blurs that boundary and adds risk for minimal benefit |
| `@powersync/op-sqlite` | latest | OP-SQLite is newer. Quick SQLite is more battle-tested. Either works, but Quick SQLite has more production usage in the ecosystem |

### Installation

```bash
# TanStack Query (3 packages)
npm install @tanstack/react-query @tanstack/react-query-persist-client @tanstack/query-async-storage-persister

# PowerSync (2 packages + SQLite adapter)
npx expo install @powersync/react-native @powersync/react @journeyapps/react-native-quick-sqlite
```

**CRITICAL:** `@powersync/react-native` and `@journeyapps/react-native-quick-sqlite` include native modules. After installation, a full EAS native build is required -- OTA updates will NOT work until the native build is deployed.

## Architecture Patterns

### Recommended Project Structure

```
src/
  lib/                          # NEW: Data layer foundation
    queryClient.ts              # QueryClient instance + defaults
    queryKeys.ts                # Query key factory
    powersync.ts                # PowerSync database + schema
    supabaseConnector.ts        # PowerSync <-> Supabase connector
    supabase.ts                 # EXISTING: Supabase client (move from current location or keep)
  hooks/                        # EXISTING: Custom hooks (untouched this phase)
    useProfile.ts               # NEW: PoC hook using TanStack Query
  services/                     # EXISTING: Firebase services (untouched)
  context/                      # EXISTING: React contexts (untouched)
```

### Pattern 1: QueryClient Configuration

**What:** Central QueryClient with locked-in defaults from CONTEXT.md decisions.
**When to use:** Single instance shared across the entire app.

```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,          // 30 seconds - data fresh for 30s
      gcTime: 10 * 60 * 1000,        // 10 minutes - inactive data GC'd
      retry: 3,                       // 3 retries with exponential backoff
      refetchOnWindowFocus: true,     // Refetch on app foreground (mapped to AppState)
      refetchOnReconnect: true,       // Refetch when network reconnects
    },
  },
});
```

### Pattern 2: AsyncStorage Persister with Selective Persistence

**What:** Only persist critical screen data (feed, conversations, profile) to AsyncStorage.
**When to use:** Wrapping the app root to enable instant cold-start rendering.

```typescript
// src/lib/queryClient.ts (continued)
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'FLICK_QUERY_CACHE',
  throttleTime: 1000,       // Write at most once per second
});

// Selective persistence via dehydrateOptions
export const persistOptions = {
  persister: asyncStoragePersister,
  maxAge: 24 * 60 * 60 * 1000,  // 24-hour cache expiry
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { queryKey: unknown[]; state: { status: string }; meta?: Record<string, unknown> }) => {
      // Only persist successful queries marked with meta.persist
      return query.state.status === 'success' && query.meta?.persist === true;
    },
  },
};
```

Queries opt into persistence via `meta: { persist: true }`:
```typescript
useQuery({
  queryKey: queryKeys.profile.detail(userId),
  queryFn: () => fetchProfile(userId),
  meta: { persist: true },  // This query's data survives app restart
});
```

### Pattern 3: Query Key Factory

**What:** Centralized, type-safe query key definitions for all data types.
**When to use:** Every TanStack Query hook references keys from this factory.

```typescript
// src/lib/queryKeys.ts
export const queryKeys = {
  profile: {
    all: ['profile'] as const,
    detail: (userId: string) => ['profile', userId] as const,
    me: () => ['profile', 'me'] as const,
  },
  photos: {
    all: ['photos'] as const,
    list: (userId: string) => ['photos', 'list', userId] as const,
    detail: (photoId: string) => ['photos', 'detail', photoId] as const,
    feed: () => ['photos', 'feed'] as const,
  },
  conversations: {
    all: ['conversations'] as const,
    list: () => ['conversations', 'list'] as const,
    detail: (conversationId: string) => ['conversations', 'detail', conversationId] as const,
    messages: (conversationId: string) => ['conversations', 'messages', conversationId] as const,
  },
  friends: {
    all: ['friends'] as const,
    list: (userId: string) => ['friends', 'list', userId] as const,
    requests: () => ['friends', 'requests'] as const,
  },
  comments: {
    all: ['comments'] as const,
    list: (photoId: string) => ['comments', 'list', photoId] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
  },
  albums: {
    all: ['albums'] as const,
    list: (userId: string) => ['albums', 'list', userId] as const,
    detail: (albumId: string) => ['albums', 'detail', albumId] as const,
  },
} as const;
```

### Pattern 4: PowerSync Schema Definition

**What:** TypeScript schema defining the 4 synced tables matching the PostgreSQL schema.
**When to use:** Single schema definition used by PowerSync database initialization.

```typescript
// src/lib/powersync.ts
import { column, Schema, TableV2 } from '@powersync/react-native';
import { PowerSyncDatabase } from '@powersync/react-native';

const photos = new TableV2(
  {
    user_id: column.text,
    image_url: column.text,
    local_uri: column.text,
    thumbnail_data_url: column.text,
    status: column.text,        // 'developing' | 'revealed'
    photo_state: column.text,   // null | 'journal' | 'archive'
    reveal_at: column.text,
    storage_path: column.text,
    deleted_at: column.text,
    created_at: column.text,
  },
  { indexes: { user_status: ['user_id', 'status'] } }
);

const conversations = new TableV2(
  {
    participant1_id: column.text,
    participant2_id: column.text,
    last_message_text: column.text,
    last_message_at: column.text,
    last_message_type: column.text,
    unread_count_p1: column.integer,
    unread_count_p2: column.integer,
    deleted_at_p1: column.text,
    deleted_at_p2: column.text,
  },
  { indexes: { participant1: ['participant1_id'], participant2: ['participant2_id'] } }
);

const friendships = new TableV2(
  {
    user1_id: column.text,
    user2_id: column.text,
    status: column.text,
    initiated_by: column.text,
    created_at: column.text,
  },
  { indexes: { user1: ['user1_id', 'status'], user2: ['user2_id', 'status'] } }
);

const streaks = new TableV2({
  user1_id: column.text,
  user2_id: column.text,
  day_count: column.integer,
  last_snap_at_user1: column.text,
  last_snap_at_user2: column.text,
  last_mutual_at: column.text,
  expires_at: column.text,
  warning_sent: column.integer, // SQLite has no boolean, use 0/1
});

export const AppSchema = new Schema({
  photos,
  conversations,
  friendships,
  streaks,
});

export type Database = (typeof AppSchema)['types'];

export const powerSyncDb = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'flick-powersync.db' },
});
```

### Pattern 5: Supabase Connector for PowerSync

**What:** Implements `PowerSyncBackendConnector` to link PowerSync with Supabase auth and data.
**When to use:** Required for PowerSync to authenticate and sync with Supabase.

```typescript
// src/lib/supabaseConnector.ts
import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType,
  PowerSyncCredentials,
} from '@powersync/react-native';
import { supabase } from './supabase';

const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL ?? '';

const FATAL_RESPONSE_CODES = [
  /^22...$/, // Data Exception
  /^23...$/, // Integrity Constraint Violation
  /^42501$/, // INSUFFICIENT PRIVILEGE
];

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw new Error(`Could not fetch credentials: ${error.message}`);
    if (!session) return null;

    return {
      endpoint: POWERSYNC_URL,
      token: session.access_token,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000)
        : undefined,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    let lastOp: CrudEntry | null = null;
    try {
      for (const op of transaction.crud) {
        lastOp = op;
        const table = supabase.from(op.table);
        let result;

        switch (op.op) {
          case UpdateType.PUT:
            result = await table.upsert({ ...op.opData, id: op.id });
            break;
          case UpdateType.PATCH:
            result = await table.update(op.opData).eq('id', op.id);
            break;
          case UpdateType.DELETE:
            result = await table.delete().eq('id', op.id);
            break;
        }

        if (result?.error) {
          throw new Error(`Could not ${op.op} data: ${JSON.stringify(result.error)}`);
        }
      }
      await transaction.complete();
    } catch (ex: unknown) {
      const error = ex as { code?: string };
      if (typeof error.code === 'string' &&
          FATAL_RESPONSE_CODES.some((regex) => regex.test(error.code!))) {
        // Fatal error - discard transaction to avoid infinite retry
        await transaction.complete();
      } else {
        throw ex; // Retryable error
      }
    }
  }
}
```

### Pattern 6: Provider Placement in App.js

**What:** Both QueryClientProvider (with persistence) and PowerSync provider wrap the app.
**When to use:** App root, wrapping navigation and all existing providers.

```typescript
// In App.js - add these providers around existing content
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { PowerSyncContext } from '@powersync/react';
import { queryClient, asyncStoragePersister, persistOptions } from './src/lib/queryClient';
import { powerSyncDb } from './src/lib/powersync';
import { SupabaseConnector } from './src/lib/supabaseConnector';

// Provider order (outermost to innermost):
// PersistQueryClientProvider (TanStack)
//   PowerSyncContext.Provider (PowerSync)
//     SafeAreaProvider (existing)
//       GestureHandlerRootView (existing)
//         AuthProvider (existing)
//           ... rest of app
```

### Anti-Patterns to Avoid

- **Using `@powersync/tanstack-react-query`:** Alpha package that merges two systems the user explicitly wants separate. Use `@powersync/react` useQuery for synced tables and `@tanstack/react-query` useQuery for non-synced data.
- **Persisting all queries:** Only critical screens (feed, conversations, profile) should persist. Use `meta: { persist: true }` and `shouldDehydrateQuery` filter. Persisting everything wastes storage and slows cold start.
- **Direct cache patching from Supabase Realtime:** CONTEXT.md says use `queryClient.invalidateQueries()` only. No `setQueryData()` from Realtime callbacks.
- **Creating an abstraction layer:** CONTEXT.md explicitly says no abstraction. Hooks should directly use either PowerSync or TanStack depending on data type.
- **Setting gcTime lower than maxAge:** The persisted cache maxAge is 24h. The gcTime is 10 minutes (for in-memory). These are independent -- gcTime controls when inactive data is removed from memory, maxAge controls when persisted data expires on disk. This is correct as configured.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Query caching + deduplication | Custom in-memory cache (like friendProfileCacheRef in useMessages) | TanStack Query useQuery | Handles stale-while-revalidate, dedup, background refresh, error retry automatically |
| Offline data persistence | Custom AsyncStorage read/write per screen | TanStack Query AsyncStorage persister | Handles serialization, throttled writes, cache expiry, selective persistence |
| Local-first SQLite sync | Custom SQLite + sync logic | PowerSync | Bidirectional sync, conflict resolution, offline writes, reactive queries |
| Query key management | Ad-hoc string arrays scattered across hooks | queryKeys factory object | Type-safe, centralized, enables targeted invalidation |
| Network status tracking | Custom NetInfo listener for each hook | TanStack Query onlineManager + PowerSync useStatus | Both libraries have built-in network awareness |

## Common Pitfalls

### Pitfall 1: PowerSync inlineRequires Crash
**What goes wrong:** App crashes on launch with "Super expression must either be null or a function"
**Why it happens:** Metro's inline requires optimization breaks PowerSync's native module loading
**How to avoid:** Create `metro.config.js` at project root with PowerSync blocklisted from inline requires
**Warning signs:** Crash immediately on app start, before any user interaction

```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

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

### Pitfall 2: gcTime vs maxAge Confusion
**What goes wrong:** Persisted data disappears from cache before 24h, or stale data lingers in memory
**Why it happens:** gcTime (10 min) controls in-memory GC for inactive queries. maxAge (24h) controls disk persistence expiry. They are independent systems.
**How to avoid:** gcTime must be >= staleTime for stale-while-revalidate to work. maxAge on persister controls disk. Document this in code comments.
**Warning signs:** Queries re-fetching unexpectedly, or cold start showing no cached data

### Pitfall 3: PowerSync Init Before Auth
**What goes wrong:** PowerSync fails to connect because no Supabase session exists yet
**Why it happens:** PowerSync connector calls `supabase.auth.getSession()` which returns null before user logs in
**How to avoid:** Only call `powerSyncDb.connect(connector)` after successful authentication. Disconnect on sign-out. Use AuthContext state to gate the connection.
**Warning signs:** PowerSync error logs about null credentials, sync not working

### Pitfall 4: PersistQueryClientProvider Blocking Render
**What goes wrong:** App shows blank screen while restoring cache from AsyncStorage
**Why it happens:** `PersistQueryClientProvider` restores cache before rendering children by default
**How to avoid:** The provider handles this gracefully -- it renders children immediately and restores in the background. But if cache is very large, deserialization can block the JS thread. Keep persisted data minimal (only `meta: { persist: true }` queries).
**Warning signs:** Slow cold start, AsyncStorage reads taking >500ms

### Pitfall 5: Expo Go Incompatibility with PowerSync
**What goes wrong:** PowerSync crashes in Expo Go
**Why it happens:** Native SQLite adapters are not compatible with Expo Go's sandbox
**How to avoid:** Use development builds (`npx expo start --dev-client`) with EAS Build. PowerSync requires native modules.
**Warning signs:** Module not found errors, native module crash

### Pitfall 6: Duplicate Provider Naming
**What goes wrong:** Importing `useQuery` resolves to wrong package
**Why it happens:** Both `@powersync/react` and `@tanstack/react-query` export a hook named `useQuery`
**How to avoid:** Use explicit imports with aliasing:
```typescript
import { useQuery as usePowerSyncQuery } from '@powersync/react';
import { useQuery as useTanStackQuery } from '@tanstack/react-query';
```
Or establish a project convention: always import PowerSync hooks from `@powersync/react` and TanStack hooks from `@tanstack/react-query` with explicit package names in the import path.
**Warning signs:** TypeScript errors about incompatible hook signatures, wrong data shape returned

### Pitfall 7: PowerSync Schema Column Types
**What goes wrong:** Data type mismatches between PostgreSQL and PowerSync SQLite
**Why it happens:** PowerSync SQLite only has 3 column types: `text`, `integer`, `real`. PostgreSQL has TIMESTAMPTZ, BOOLEAN, UUID, etc.
**How to avoid:** Map all UUIDs to `column.text`, all timestamps to `column.text` (ISO strings), all booleans to `column.integer` (0/1). Document the mapping.
**Warning signs:** Null values where data is expected, type errors in hook consumers

## Code Examples

### QueryClient Provider Setup (App.js integration)

```typescript
// In App.js, wrap the existing provider tree
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { PowerSyncContext } from '@powersync/react';
import { queryClient, persistOptions } from '@/lib/queryClient';
import { powerSyncDb } from '@/lib/powersync';
import { SupabaseConnector } from '@/lib/supabaseConnector';
import { onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

// Set up online status tracking for TanStack Query
if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });
  });
}

// In the render:
<PersistQueryClientProvider
  client={queryClient}
  persistOptions={persistOptions}
  onSuccess={() => {
    // Resume any paused mutations after cache restoration
    queryClient.resumePausedMutations();
  }}
>
  <PowerSyncContext.Provider value={powerSyncDb}>
    {/* existing SafeAreaProvider, GestureHandlerRootView, AuthProvider, etc. */}
  </PowerSyncContext.Provider>
</PersistQueryClientProvider>
```

### PowerSync Initialization (gated on auth)

```typescript
// Called from AuthContext or a useEffect that watches auth state
import { powerSyncDb } from '@/lib/powersync';
import { SupabaseConnector } from '@/lib/supabaseConnector';

const initPowerSync = async () => {
  try {
    await powerSyncDb.init();
    const connector = new SupabaseConnector();
    await powerSyncDb.connect(connector);
  } catch (error) {
    logger.error('PowerSync initialization failed', { error: error.message });
  }
};

const disconnectPowerSync = async () => {
  await powerSyncDb.disconnectAndClear();
};
```

### useProfile PoC Hook

```typescript
// src/hooks/useProfile.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  profile_photo_path: string | null;
  friend_count: number;
  // ... other fields from users table
}

export function useProfile(userId: string) {
  return useQuery({
    queryKey: queryKeys.profile.detail(userId),
    queryFn: async (): Promise<UserProfile> => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    },
    meta: { persist: true }, // Survives app restart
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<UserProfile> & { id: string }) => {
      const { id, ...fields } = updates;
      const { data, error } = await supabase
        .from('users')
        .update(fields)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate to trigger refetch, not direct cache patch
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.detail(data.id) });
    },
  });
}
```

### PowerSync Read Example (for Phase 15+ reference)

```typescript
// Example of how synced table reads will work in future phases
import { useQuery } from '@powersync/react';

export function useDarkroomPhotos(userId: string) {
  const { data: photos, isLoading, error } = useQuery(
    `SELECT * FROM photos
     WHERE user_id = ? AND status IN ('developing', 'revealed')
     ORDER BY created_at DESC`,
    [userId]
  );

  return { photos: photos ?? [], isLoading, error };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual useState + useEffect + Firebase onSnapshot | TanStack Query useQuery/useMutation | TanStack Query v5 (2023) | Eliminates manual loading/error/data state tracking. Automatic caching, dedup, retry |
| Custom in-memory caches (friendProfileCacheRef) | TanStack Query gcTime + staleTime | N/A | Query cache handles TTL, GC, invalidation automatically |
| Firebase offline persistence (opaque, undocumented behavior) | PowerSync explicit SQLite with defined sync rules | PowerSync v1.x (2024) | Full control over what syncs, when, to whom. SQL queries locally |
| No cold-start cache (loading spinners on every app open) | AsyncStorage persistence with 24h expiry | TanStack Query persist plugins | Feed, conversations, profile render instantly from disk cache |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest with jest-expo preset |
| Config file | `jest.config.js` (exists) |
| Quick run command | `npm test -- --testPathPattern="lib"` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | QueryClient configured with correct defaults (staleTime, gcTime, retry) | unit | `npx jest __tests__/lib/queryClient.test.ts -x` | Wave 0 |
| PERF-01 | Query key factory returns correct key arrays | unit | `npx jest __tests__/lib/queryKeys.test.ts -x` | Wave 0 |
| PERF-01 | useProfile hook fetches and caches profile data | unit | `npx jest __tests__/hooks/useProfile.test.ts -x` | Wave 0 |
| PERF-08 | AsyncStorage persister created with correct config (throttle, key, maxAge) | unit | `npx jest __tests__/lib/queryClient.test.ts -x` | Wave 0 |
| PERF-08 | shouldDehydrateQuery only persists queries with meta.persist=true | unit | `npx jest __tests__/lib/queryClient.test.ts -x` | Wave 0 |
| PERF-09 | PowerSync schema defines 4 tables with correct columns | unit | `npx jest __tests__/lib/powersync.test.ts -x` | Wave 0 |
| PERF-09 | SupabaseConnector.fetchCredentials returns correct shape | unit | `npx jest __tests__/lib/supabaseConnector.test.ts -x` | Wave 0 |
| PERF-09 | SupabaseConnector.uploadData handles PUT/PATCH/DELETE operations | unit | `npx jest __tests__/lib/supabaseConnector.test.ts -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --testPathPattern="lib|hooks/useProfile"` (< 30s)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `__tests__/lib/queryClient.test.ts` -- covers PERF-01, PERF-08 (QueryClient defaults, persister config, dehydrate filter)
- [ ] `__tests__/lib/queryKeys.test.ts` -- covers PERF-01 (key factory returns correct arrays)
- [ ] `__tests__/lib/powersync.test.ts` -- covers PERF-09 (schema definition, column types, indexes)
- [ ] `__tests__/lib/supabaseConnector.test.ts` -- covers PERF-09 (connector methods)
- [ ] `__tests__/hooks/useProfile.test.ts` -- covers PERF-01 (PoC hook)
- [ ] Jest config update: add `.ts` and `.tsx` to `testMatch` pattern
- [ ] Jest config update: add `@tanstack/react-query`, `@powersync/react-native`, `@powersync/react` to `transformIgnorePatterns`
- [ ] Mock setup: `@powersync/react-native` and `@powersync/react` mocks in `__tests__/setup/` or `__tests__/__mocks__/`

## Open Questions

1. **NetInfo dependency**
   - What we know: TanStack Query's `onlineManager` needs a network status listener. The pattern uses `@react-native-community/netinfo`.
   - What's unclear: Whether this package is already installed in the project.
   - Recommendation: Check `package.json`. If not installed, add `npx expo install @react-native-community/netinfo`. If already using Expo's network API, adapt accordingly.

2. **PowerSync Dashboard setup**
   - What we know: PowerSync requires a cloud dashboard account with sync streams configured.
   - What's unclear: Whether the PowerSync project/instance has been provisioned as part of Phase 12-13.
   - Recommendation: If not set up, include PowerSync dashboard setup (database connection, sync streams, client auth) as a prerequisite task in the plan.

3. **Expo plugin for Quick SQLite**
   - What we know: `@journeyapps/react-native-quick-sqlite` may need an Expo plugin entry in `app.json` for `use_frameworks!` on iOS.
   - What's unclear: Whether the current Expo/iOS build configuration uses `use_frameworks!`.
   - Recommendation: Check during implementation. Add plugin config to `app.json` if needed.

## Sources

### Primary (HIGH confidence)
- [TanStack Query v5 docs](https://tanstack.com/query/v5/docs) - QueryClient, useQuery, useMutation, persistence plugins
- [TanStack createAsyncStoragePersister](https://tanstack.com/query/v4/docs/framework/react/plugins/createAsyncStoragePersister) - AsyncStorage persister API (v4 docs, API is same in v5)
- [PowerSync React Native SDK](https://docs.powersync.com/client-sdks/reference/react-native-and-expo) - Installation, schema, database init
- [PowerSync + Supabase Integration](https://docs.powersync.com/integrations/supabase/guide) - Connector pattern, sync streams, auth
- [Ignite Cookbook - PowerSync + Supabase](https://ignitecookbook.com/docs/recipes/LocalFirstDataWithPowerSync/) - Complete React Native code examples
- npm registry - verified versions: @tanstack/react-query 5.95.2, @powersync/react-native 1.32.0, @powersync/react 1.9.0

### Secondary (MEDIUM confidence)
- [Selective query persistence discussion](https://github.com/TanStack/query/discussions/3568) - dehydrateOptions.shouldDehydrateQuery pattern with meta flags
- [React Native offline-first with TanStack Query](https://dev.to/fedorish/react-native-offline-first-with-tanstack-query-1pe5) - onlineManager + mutation persistence pattern
- [@powersync/tanstack-react-query npm](https://www.npmjs.com/package/@powersync/tanstack-react-query) - Alpha status confirmed (v0.2.2)

### Tertiary (LOW confidence)
- [TanStack Query key factory (lukemorales)](https://github.com/lukemorales/query-key-factory) - Pattern reference, but we are hand-rolling a simpler version per CONTEXT.md

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages verified on npm with current versions, well-documented
- Architecture: HIGH - patterns from official docs + CONTEXT.md locked decisions
- Pitfalls: HIGH - metro.config.js issue is well-documented, auth gating is standard, useQuery naming conflict is obvious from the API surface

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (30 days - stable ecosystem, no major breaking changes expected)
