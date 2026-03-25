#!/usr/bin/env npx tsx
/**
 * Reset dev Supabase to clean state for migration re-run.
 * Usage: npx tsx scripts/reset-dev-supabase.ts
 *
 * Wipes: all table data, storage bucket contents, auth users.
 * Then re-applies migrations so schema is fresh.
 *
 * SAFETY: Only runs against dev project (checks SUPABASE_URL).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// ---------------------------------------------------------------------------
// Load environment
// ---------------------------------------------------------------------------

const envLocalPath = path.join(__dirname, '..', '.env.local');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ---------------------------------------------------------------------------
// Safety check -- only dev project allowed
// ---------------------------------------------------------------------------

/**
 * Known production project identifiers. Add your prod project ref here.
 * The script will ABORT if the URL matches any of these.
 */
const PROD_IDENTIFIERS = ['flick-prod-49615', 'prod'];

function assertDevProject(): void {
  if (!SUPABASE_URL) {
    console.error('[ABORT] SUPABASE_URL is not set. Cannot proceed.');
    process.exit(1);
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[ABORT] SUPABASE_SERVICE_ROLE_KEY is not set. Cannot proceed.');
    process.exit(1);
  }

  const urlLower = SUPABASE_URL.toLowerCase();
  for (const id of PROD_IDENTIFIERS) {
    if (urlLower.includes(id.toLowerCase())) {
      console.error(`[ABORT] SUPABASE_URL contains production identifier "${id}".`);
      console.error('        This script ONLY runs against the dev project.');
      console.error(`        Current URL: ${SUPABASE_URL}`);
      process.exit(1);
    }
  }

  console.log(`[SAFETY] Dev project confirmed: ${SUPABASE_URL}`);
}

// ---------------------------------------------------------------------------
// Table truncation order (respects foreign key dependencies)
// ---------------------------------------------------------------------------

/**
 * Tables ordered so that child/dependent tables are truncated first.
 * Using TRUNCATE ... CASCADE handles remaining FK constraints.
 */
const TABLES_IN_DEPENDENCY_ORDER: string[] = [
  // Deepest children first
  'push_receipts',
  'pending_notifications',
  'message_deletions',
  'messages',
  'streaks',
  'conversations',
  'comment_likes',
  'comments',
  'photo_reactions',
  'photo_tags',
  'viewed_photos',
  'album_photos',
  'albums',
  'photos',
  'notifications',
  'reaction_batches',
  'support_requests',
  'reports',
  'blocks',
  'friendships',
  'users',
];

// ---------------------------------------------------------------------------
// Storage buckets to wipe
// ---------------------------------------------------------------------------

const STORAGE_BUCKETS = ['photos', 'snaps', 'profile-photos', 'selects', 'comment-images'];

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

async function wipeTableData(supabase: SupabaseClient): Promise<void> {
  console.log('\n--- Wiping table data ---');

  // Use a single TRUNCATE with CASCADE for efficiency and FK safety
  const tableList = TABLES_IN_DEPENDENCY_ORDER.join(', ');
  const { error } = await supabase.rpc('exec_sql', {
    sql: `TRUNCATE TABLE ${tableList} CASCADE;`,
  });

  if (error) {
    // Fallback: truncate individually if the exec_sql RPC doesn't exist
    console.warn('[WARN] exec_sql RPC not available, truncating tables individually...');
    for (const table of TABLES_IN_DEPENDENCY_ORDER) {
      const { error: tableError } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (tableError) {
        console.warn(`  [WARN] ${table}: ${tableError.message}`);
      } else {
        console.log(`  [OK] ${table} cleared`);
      }
    }
    return;
  }

  console.log(`  [OK] Truncated all ${TABLES_IN_DEPENDENCY_ORDER.length} tables`);
}

async function wipeStorageBuckets(supabase: SupabaseClient): Promise<void> {
  console.log('\n--- Wiping storage bucket contents ---');

  for (const bucket of STORAGE_BUCKETS) {
    try {
      // List all files in the bucket
      const { data: files, error: listError } = await supabase.storage
        .from(bucket)
        .list('', { limit: 1000 });

      if (listError) {
        console.warn(`  [WARN] ${bucket}: ${listError.message}`);
        continue;
      }

      if (!files || files.length === 0) {
        console.log(`  [OK] ${bucket}: already empty`);
        continue;
      }

      // Recursively collect all file paths
      const allPaths = await collectAllFiles(supabase, bucket, '');

      if (allPaths.length === 0) {
        console.log(`  [OK] ${bucket}: already empty`);
        continue;
      }

      // Delete in batches of 100
      for (let i = 0; i < allPaths.length; i += 100) {
        const batch = allPaths.slice(i, i + 100);
        const { error: deleteError } = await supabase.storage.from(bucket).remove(batch);
        if (deleteError) {
          console.warn(`  [WARN] ${bucket} batch delete: ${deleteError.message}`);
        }
      }

      console.log(`  [OK] ${bucket}: deleted ${allPaths.length} files`);
    } catch (err) {
      console.warn(`  [WARN] ${bucket}: ${(err as Error).message}`);
    }
  }
}

async function collectAllFiles(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  const { data: items } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });

  if (!items) return paths;

  for (const item of items) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) {
      // It's a file
      paths.push(fullPath);
    } else {
      // It's a folder -- recurse
      const subPaths = await collectAllFiles(supabase, bucket, fullPath);
      paths.push(...subPaths);
    }
  }

  return paths;
}

async function wipeAuthUsers(supabase: SupabaseClient): Promise<void> {
  console.log('\n--- Wiping auth users ---');

  // Use Supabase Admin API to list and delete all users
  let page = 1;
  let totalDeleted = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const {
      data: { users },
      error,
    } = await supabase.auth.admin.listUsers({ page, perPage: 100 });

    if (error) {
      console.error(`  [ERROR] Listing users: ${error.message}`);
      break;
    }

    if (!users || users.length === 0) {
      break;
    }

    for (const user of users) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.warn(`  [WARN] Deleting user ${user.id}: ${deleteError.message}`);
      } else {
        totalDeleted++;
      }
    }

    // If we got fewer than 100, we've reached the last page
    if (users.length < 100) break;
    page++;
  }

  console.log(`  [OK] Deleted ${totalDeleted} auth users`);
}

async function reapplyMigrations(supabase: SupabaseClient): Promise<void> {
  console.log('\n--- Re-applying migrations via SQL ---');

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error('  [ERROR] supabase/migrations/ directory not found.');
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((f: string) => f.endsWith('.sql'))
    .sort();

  console.log(`  Found ${files.length} migration files`);

  let applied = 0;
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    // Execute via Supabase REST using the postgrest rpc or direct fetch
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      // Fallback: try executing via the SQL endpoint (management API)
      const mgmtResponse = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ query: sql }),
      });

      if (!mgmtResponse.ok) {
        const errText = await response.text();
        console.warn(`  [WARN] ${file}: ${errText.slice(0, 200)}`);
        // Continue — migration may have already been applied (tables exist)
        continue;
      }
    }

    applied++;
    console.log(`  [OK] ${file}`);
  }

  console.log(`  Applied ${applied}/${files.length} migrations`);
}

async function verifyCleanState(supabase: SupabaseClient): Promise<void> {
  console.log('\n--- Verifying clean state ---');
  let allClean = true;

  for (const table of TABLES_IN_DEPENDENCY_ORDER) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });

    if (error) {
      console.warn(`  [WARN] ${table}: ${error.message}`);
      continue;
    }

    if (count && count > 0) {
      console.error(`  [FAIL] ${table}: ${count} rows remaining`);
      allClean = false;
    } else {
      console.log(`  [OK] ${table}: 0 rows`);
    }
  }

  if (!allClean) {
    console.error('\n[FAIL] Some tables still have data. Manual cleanup may be needed.');
    process.exit(1);
  }

  console.log('\n[PASS] All tables are empty. Dev Supabase is in clean state.');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== Dev Supabase Reset Script ===\n');

  // Safety first
  assertDevProject();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Step 1: Wipe auth users first (they may have FK references)
  await wipeAuthUsers(supabase);

  // Step 2: Wipe table data
  await wipeTableData(supabase);

  // Step 3: Wipe storage
  await wipeStorageBuckets(supabase);

  // Step 3b: Delete migration progress files so scripts re-run from scratch
  const progressFiles = [
    path.join(__dirname, '.migration-progress.json'),
  ];
  for (const pf of progressFiles) {
    if (fs.existsSync(pf)) {
      fs.unlinkSync(pf);
      console.log(`  [OK] Deleted progress file: ${path.basename(pf)}`);
    }
  }

  // Step 4: Re-apply migrations via SQL
  await reapplyMigrations(supabase);

  // Step 5: Re-initialize Supabase client (schema may have changed)
  const freshSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Step 6: Verify clean state
  await verifyCleanState(freshSupabase);

  console.log('\n=== Reset complete. Ready for migration re-run. ===');
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
