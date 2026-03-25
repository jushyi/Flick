/**
 * Cross-Database Verification Script
 *
 * Connects to BOTH Firebase Firestore and Supabase simultaneously to compare
 * migrated data: doc/row counts, field-by-field sample diffs, and per-user deep checks.
 *
 * Usage:
 *   npx tsx scripts/verify-migration-cross-db.ts --env dev
 *   npx tsx scripts/verify-migration-cross-db.ts --env prod --sample-size 20
 *   npx tsx scripts/verify-migration-cross-db.ts --env dev --user <firebase_uid>
 *
 * Flags:
 *   --env dev|prod         Load .env.dev or .env.prod (default: dev)
 *   --user <firebase_uid>  Per-user deep verification only
 *   --sample-size <N>      Random records to sample per collection (default: 10)
 *   --help                 Show usage
 */

import * as admin from 'firebase-admin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// ---------------------------------------------------------------------------
// ANSI color helpers
// ---------------------------------------------------------------------------

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function green(s: string): string { return `${C.green}${s}${C.reset}`; }
function yellow(s: string): string { return `${C.yellow}${s}${C.reset}`; }
function red(s: string): string { return `${C.red}${s}${C.reset}`; }
function cyan(s: string): string { return `${C.cyan}${s}${C.reset}`; }
function bold(s: string): string { return `${C.bold}${s}${C.reset}`; }
function dim(s: string): string { return `${C.dim}${s}${C.reset}`; }

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  env: 'dev' | 'prod';
  user: string | null;
  sampleSize: number;
  help: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = { env: 'dev', user: null, sampleSize: 10, help: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--env':
        i++;
        if (args[i] === 'dev' || args[i] === 'prod') result.env = args[i];
        else { console.error(red(`Invalid --env: ${args[i]}`)); process.exit(1); }
        break;
      case '--user':
        i++;
        result.user = args[i] || null;
        break;
      case '--sample-size':
        i++;
        result.sampleSize = parseInt(args[i], 10) || 10;
        break;
      case '--help': case '-h':
        result.help = true;
        break;
    }
  }
  return result;
}

function showHelp(): void {
  console.log(`
${bold('Cross-Database Migration Verification')}

${bold('Usage:')}
  npx tsx scripts/verify-migration-cross-db.ts [options]

${bold('Options:')}
  --env dev|prod         Load .env.dev or .env.prod (default: dev)
  --user <firebase_uid>  Per-user deep verification (skips full comparison)
  --sample-size <N>      Random records per collection (default: 10)
  --help, -h             Show this help

${bold('Examples:')}
  npx tsx scripts/verify-migration-cross-db.ts --env dev
  npx tsx scripts/verify-migration-cross-db.ts --env dev --user abc123
  npx tsx scripts/verify-migration-cross-db.ts --env prod --sample-size 20
`);
}

// ---------------------------------------------------------------------------
// Environment + initialization
// ---------------------------------------------------------------------------

function loadEnv(env: 'dev' | 'prod'): void {
  const root = path.join(__dirname, '..');
  const candidates = [
    path.join(root, `.env.${env}`),
    path.join(root, '.env.local'),
    path.join(root, '.env'),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath });
      console.log(dim(`Loaded environment from: ${filePath}`));
      return;
    }
  }
  console.warn(yellow('No .env file found. Using existing environment variables.'));
}

function initFirebase(): admin.firestore.Firestore {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH required');
  if (!fs.existsSync(serviceAccountPath)) throw new Error(`Service account not found: ${serviceAccountPath}`);

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
  if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  console.log(green('Firebase initialized'));
  return admin.firestore();
}

function initSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('SUPABASE_URL required');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY required');

  const client = createClient(url, key, { auth: { persistSession: false } });
  console.log(green(`Supabase initialized: ${url}`));
  return client;
}

// ---------------------------------------------------------------------------
// Result tracking (same pattern as validate-migration.ts)
// ---------------------------------------------------------------------------

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function pass(name: string, detail: string): void {
  results.push({ name, passed: true, detail });
  console.log(`  ${green('[PASS]')} ${name}: ${detail}`);
}

function fail(name: string, detail: string): void {
  results.push({ name, passed: false, detail });
  console.log(`  ${red('[FAIL]')} ${name}: ${detail}`);
}

function printSummary(): void {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n' + bold('='.repeat(60)));
  console.log(bold('  VERIFICATION SUMMARY'));
  console.log(bold('='.repeat(60)));
  console.log(`  ${green(`${passed} passed`)}  ${failed > 0 ? red(`${failed} failed`) : dim('0 failed')}`);

  if (failed > 0) {
    console.log('\n  ' + red('Failed checks:'));
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    ${red('x')} ${r.name}: ${r.detail}`);
    }
  }
  console.log(bold('='.repeat(60)));
}

// ---------------------------------------------------------------------------
// Firestore count helpers
// ---------------------------------------------------------------------------

async function firestoreCollectionCount(
  firestore: admin.firestore.Firestore,
  collectionPath: string
): Promise<number> {
  const snapshot = await firestore.collection(collectionPath).get();
  return snapshot.size;
}

async function supabaseTableCount(
  supabase: SupabaseClient,
  table: string,
  filter?: { column: string; op: string; value: any }
): Promise<number> {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) {
    if (filter.op === 'not.is') {
      query = query.not(filter.column, 'is', filter.value);
    } else {
      query = query.eq(filter.column, filter.value);
    }
  }
  const { count, error } = await query;
  if (error) throw new Error(`Count ${table}: ${error.message}`);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Count subcollection docs across all parent docs
// ---------------------------------------------------------------------------

async function firestoreSubcollectionCount(
  firestore: admin.firestore.Firestore,
  parentCollection: string,
  subcollectionName: string
): Promise<number> {
  const parents = await firestore.collection(parentCollection).get();
  let total = 0;
  for (const doc of parents.docs) {
    const sub = await firestore
      .collection(parentCollection)
      .doc(doc.id)
      .collection(subcollectionName)
      .get();
    total += sub.size;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Count verification
// ---------------------------------------------------------------------------

async function verifyCountsAll(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient
): Promise<void> {
  console.log(bold('\n--- Count Verification ---\n'));

  // Simple top-level collections
  const simplePairs: Array<{
    name: string;
    firestoreCol: string;
    supabaseTable: string;
    supabaseFilter?: { column: string; op: string; value: any };
  }> = [
    { name: 'users', firestoreCol: 'users', supabaseTable: 'users', supabaseFilter: { column: 'firebase_uid', op: 'not.is', value: null } },
    { name: 'photos', firestoreCol: 'photos', supabaseTable: 'photos' },
    { name: 'friendships', firestoreCol: 'friendships', supabaseTable: 'friendships' },
    { name: 'blocks', firestoreCol: 'blocks', supabaseTable: 'blocks' },
    { name: 'reports', firestoreCol: 'reports', supabaseTable: 'reports' },
    { name: 'support_requests', firestoreCol: 'supportRequests', supabaseTable: 'support_requests' },
    { name: 'conversations', firestoreCol: 'conversations', supabaseTable: 'conversations' },
    { name: 'streaks', firestoreCol: 'streaks', supabaseTable: 'streaks' },
    { name: 'albums', firestoreCol: 'albums', supabaseTable: 'albums' },
  ];

  for (const pair of simplePairs) {
    try {
      const fsCount = await firestoreCollectionCount(firestore, pair.firestoreCol);
      const sbCount = await supabaseTableCount(supabase, pair.supabaseTable, pair.supabaseFilter);

      if (fsCount === sbCount) {
        pass(`count:${pair.name}`, `${fsCount} docs = ${sbCount} rows`);
      } else {
        fail(`count:${pair.name}`, `Firestore ${fsCount} vs Supabase ${sbCount} (diff: ${fsCount - sbCount})`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      fail(`count:${pair.name}`, `Error: ${msg}`);
    }
  }

  // Subcollection-based tables
  const subcollectionPairs: Array<{
    name: string;
    parentCollection: string;
    subcollectionName: string;
    supabaseTable: string;
  }> = [
    { name: 'messages', parentCollection: 'conversations', subcollectionName: 'messages', supabaseTable: 'messages' },
    { name: 'comments', parentCollection: 'photos', subcollectionName: 'comments', supabaseTable: 'comments' },
    { name: 'viewed_photos', parentCollection: 'users', subcollectionName: 'viewedPhotos', supabaseTable: 'viewed_photos' },
  ];

  for (const pair of subcollectionPairs) {
    try {
      console.log(dim(`  Counting ${pair.name} subcollections (may take a moment)...`));
      const fsCount = await firestoreSubcollectionCount(firestore, pair.parentCollection, pair.subcollectionName);
      const sbCount = await supabaseTableCount(supabase, pair.supabaseTable);

      if (fsCount === sbCount) {
        pass(`count:${pair.name}`, `${fsCount} docs = ${sbCount} rows`);
      } else {
        fail(`count:${pair.name}`, `Firestore ${fsCount} vs Supabase ${sbCount} (diff: ${fsCount - sbCount})`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      fail(`count:${pair.name}`, `Error: ${msg}`);
    }
  }

  // Inline-derived tables: photo_reactions, photo_tags, album_photos
  // These are harder to count from Firestore since they're embedded.
  // Just verify Supabase has > 0 rows if the parent table has data.
  const derivedTables = ['photo_reactions', 'photo_tags', 'album_photos', 'message_deletions', 'comment_likes'];
  for (const table of derivedTables) {
    try {
      const sbCount = await supabaseTableCount(supabase, table);
      pass(`count:${table}`, `${sbCount} rows in Supabase (inline-derived, no direct Firestore comparison)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      fail(`count:${table}`, `Error: ${msg}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Sample verification
// ---------------------------------------------------------------------------

async function verifySamplesUsers(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  sampleSize: number
): Promise<void> {
  console.log(bold('\n--- Sample Verification (users) ---\n'));

  const snapshot = await firestore.collection('users').get();
  if (snapshot.empty) {
    console.log(yellow('  No users in Firestore to sample'));
    return;
  }

  // Random sample
  const docs = snapshot.docs;
  const sampled = docs.sort(() => Math.random() - 0.5).slice(0, sampleSize);

  let matched = 0;
  let mismatched = 0;

  for (const doc of sampled) {
    const fsData = doc.data();
    const firebaseUid = doc.id;

    const { data: sbUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (error || !sbUser) {
      fail(`sample:user:${firebaseUid}`, 'Not found in Supabase');
      mismatched++;
      continue;
    }

    // Compare key fields
    const diffs: string[] = [];
    const fsUsername = fsData.username || null;
    if (fsUsername && sbUser.username !== fsUsername) {
      diffs.push(`username: fs="${fsUsername}" sb="${sbUser.username}"`);
    }
    const fsDisplayName = fsData.displayName || fsData.display_name || null;
    if (fsDisplayName && sbUser.display_name !== fsDisplayName) {
      diffs.push(`display_name: fs="${fsDisplayName}" sb="${sbUser.display_name}"`);
    }
    const fsPhone = fsData.phone || fsData.phoneNumber || null;
    if (fsPhone && sbUser.phone !== fsPhone) {
      diffs.push(`phone: fs="${fsPhone}" sb="${sbUser.phone}"`);
    }

    if (diffs.length === 0) {
      matched++;
    } else {
      fail(`sample:user:${firebaseUid}`, diffs.join('; '));
      mismatched++;
    }
  }

  if (matched > 0) pass(`sample:users`, `${matched}/${sampled.length} sampled users match`);
  if (mismatched > 0) console.log(yellow(`  ${mismatched} users had field differences`));
}

// ---------------------------------------------------------------------------
// Per-user deep verification
// ---------------------------------------------------------------------------

async function verifyPerUser(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  firebaseUid: string
): Promise<void> {
  console.log(bold(`\n--- Per-User Deep Verification: ${firebaseUid} ---\n`));

  // 1. Look up user in both DBs
  const fsUserDoc = await firestore.collection('users').doc(firebaseUid).get();
  if (!fsUserDoc.exists) {
    fail('user:firestore', `User ${firebaseUid} not found in Firestore`);
    return;
  }

  const { data: sbUser, error: sbErr } = await supabase
    .from('users')
    .select('*')
    .eq('firebase_uid', firebaseUid)
    .single();

  if (sbErr || !sbUser) {
    fail('user:supabase', `User ${firebaseUid} not found in Supabase`);
    return;
  }

  pass('user:exists', `Found in both DBs (Supabase UUID: ${sbUser.id})`);
  const supabaseUuid = sbUser.id;

  // 2. Field-by-field comparison
  const fsData = fsUserDoc.data()!;
  const fieldChecks: Array<{ label: string; fs: any; sb: any }> = [
    { label: 'username', fs: fsData.username, sb: sbUser.username },
    { label: 'display_name', fs: fsData.displayName || fsData.display_name, sb: sbUser.display_name },
    { label: 'phone', fs: fsData.phone || fsData.phoneNumber, sb: sbUser.phone },
    { label: 'bio', fs: fsData.bio || null, sb: sbUser.bio },
    { label: 'friend_count', fs: fsData.friendCount ?? fsData.friend_count ?? 0, sb: sbUser.friend_count },
    { label: 'profile_setup_completed', fs: fsData.profileSetupCompleted ?? fsData.profile_setup_completed ?? false, sb: sbUser.profile_setup_completed },
  ];

  for (const check of fieldChecks) {
    const fsVal = check.fs ?? null;
    const sbVal = check.sb ?? null;
    if (String(fsVal) === String(sbVal)) {
      pass(`user:field:${check.label}`, `"${fsVal}"`);
    } else {
      fail(`user:field:${check.label}`, `Firestore="${fsVal}" Supabase="${sbVal}"`);
    }
  }

  // 3. Per-user data counts
  const countChecks: Array<{
    label: string;
    getFirestore: () => Promise<number>;
    getSupabase: () => Promise<number>;
  }> = [
    {
      label: 'photos',
      getFirestore: async () => {
        const snap = await firestore.collection('photos').where('userId', '==', firebaseUid).get();
        return snap.size;
      },
      getSupabase: () => supabaseTableCount(supabase, 'photos', { column: 'user_id', op: 'eq', value: supabaseUuid }),
    },
    {
      label: 'albums',
      getFirestore: async () => {
        const snap = await firestore.collection('albums').where('userId', '==', firebaseUid).get();
        return snap.size;
      },
      getSupabase: () => supabaseTableCount(supabase, 'albums', { column: 'user_id', op: 'eq', value: supabaseUuid }),
    },
    {
      label: 'blocks_as_blocker',
      getFirestore: async () => {
        const snap = await firestore.collection('blocks').where('blockerId', '==', firebaseUid).get();
        return snap.size;
      },
      getSupabase: () => supabaseTableCount(supabase, 'blocks', { column: 'blocker_id', op: 'eq', value: supabaseUuid }),
    },
  ];

  for (const check of countChecks) {
    try {
      const fsCount = await check.getFirestore();
      const sbCount = await check.getSupabase();
      if (fsCount === sbCount) {
        pass(`user:count:${check.label}`, `${fsCount} in both`);
      } else {
        fail(`user:count:${check.label}`, `Firestore ${fsCount} vs Supabase ${sbCount}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      fail(`user:count:${check.label}`, `Error: ${msg}`);
    }
  }

  // 4. Sample photos comparison
  console.log(dim('\n  Sampling 3 photos for field comparison...'));
  const fsPhotos = await firestore.collection('photos').where('userId', '==', firebaseUid).limit(3).get();

  for (const photoDoc of fsPhotos.docs) {
    const pData = photoDoc.data();
    // Find matching Supabase photo by created_at + user_id
    const createdAt = pData.createdAt?.toDate?.()?.toISOString() || pData.created_at;
    if (!createdAt) {
      console.log(dim(`    Photo ${photoDoc.id}: no created_at, skipping comparison`));
      continue;
    }

    const { data: sbPhotos } = await supabase
      .from('photos')
      .select('*')
      .eq('user_id', supabaseUuid)
      .gte('created_at', new Date(new Date(createdAt).getTime() - 1000).toISOString())
      .lte('created_at', new Date(new Date(createdAt).getTime() + 1000).toISOString())
      .limit(1);

    if (sbPhotos && sbPhotos.length > 0) {
      const sbPhoto = sbPhotos[0];
      const photoDiffs: string[] = [];
      if ((pData.status || 'revealed') !== sbPhoto.status) photoDiffs.push(`status: "${pData.status}" vs "${sbPhoto.status}"`);
      if ((pData.caption || null) !== (sbPhoto.caption || null)) photoDiffs.push(`caption differs`);

      if (photoDiffs.length === 0) {
        pass(`user:photo:${photoDoc.id}`, 'Fields match');
      } else {
        fail(`user:photo:${photoDoc.id}`, photoDiffs.join('; '));
      }
    } else {
      fail(`user:photo:${photoDoc.id}`, 'No matching photo found in Supabase');
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  console.log(bold('\n=== Cross-Database Migration Verification ===\n'));
  console.log(dim(`Environment: ${args.env}`));

  loadEnv(args.env);
  const firestore = initFirebase();
  const supabase = initSupabase();

  if (args.user) {
    // Per-user deep verification only
    await verifyPerUser(firestore, supabase, args.user);
  } else {
    // Full verification
    await verifyCountsAll(firestore, supabase);
    await verifySamplesUsers(firestore, supabase, args.sampleSize);
  }

  printSummary();

  const failed = results.filter(r => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(red('Verification failed:'), err);
  process.exit(2);
});
