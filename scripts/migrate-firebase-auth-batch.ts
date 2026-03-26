/**
 * Batch Firebase Auth -> Supabase Auth Migration
 *
 * Iterates all Firebase Auth users (paginated), creates corresponding Supabase
 * Auth users, and populates the `users` table with firebase_uid mapping.
 * This must run BEFORE the data migration script (migrate-firestore-data.ts).
 *
 * Usage:
 *   npx tsx scripts/migrate-firebase-auth-batch.ts --env dev --dry-run
 *   npx tsx scripts/migrate-firebase-auth-batch.ts --env prod
 *
 * Flags:
 *   --env dev|prod     Load .env.dev or .env.prod (default: dev)
 *   --dry-run          Read Firebase Auth users, log counts, write nothing
 *   --help, -h         Show usage
 *
 * Environment variables (via .env.dev / .env.prod / .env.local / .env):
 *   FIREBASE_SERVICE_ACCOUNT_PATH  - Path to Firebase service account JSON
 *   SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY      - Service role key for admin access
 *
 * What it does:
 *   1. Lists all Firebase Auth users (paginated, 1000 at a time)
 *   2. For each user with a phone number:
 *      a. Checks if already migrated (firebase_uid exists in users table)
 *      b. Creates a Supabase Auth user with the phone number
 *      c. Inserts a minimal row into the users table with firebase_uid set
 *   3. Skips users without phone numbers (logs warning)
 *   4. Tracks progress in .auth-migration-progress.json for resume capability
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
  dryRun: boolean;
  help: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = { env: 'dev', dryRun: false, help: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--env':
        i++;
        if (args[i] === 'dev' || args[i] === 'prod') {
          result.env = args[i];
        } else {
          console.error(red(`Invalid --env value: ${args[i]}. Use 'dev' or 'prod'.`));
          process.exit(1);
        }
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--help':
      case '-h':
        result.help = true;
        break;
    }
  }

  return result;
}

function showHelp(): void {
  console.log(`
${bold('Batch Firebase Auth -> Supabase Auth Migration')}

${bold('Usage:')}
  npx tsx scripts/migrate-firebase-auth-batch.ts [options]

${bold('Options:')}
  --env dev|prod       Load .env.dev or .env.prod (default: dev)
  --dry-run            Read Firebase Auth users, log counts, write nothing
  --help, -h           Show this help message

${bold('Environment variables:')}
  FIREBASE_SERVICE_ACCOUNT_PATH  Path to Firebase service account JSON
  SUPABASE_URL                   Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY      Service role key for admin access

${bold('Run order:')}
  1. This script (migrate-firebase-auth-batch.ts)
  2. Data migration (migrate-firestore-data.ts)
  3. Storage migration (migrate-firebase-storage.ts)
  4. Verification (verify-migration-cross-db.ts)

${bold('Examples:')}
  npx tsx scripts/migrate-firebase-auth-batch.ts --env dev --dry-run
  npx tsx scripts/migrate-firebase-auth-batch.ts --env prod
`);
}

// ---------------------------------------------------------------------------
// Environment loading (same pattern as data migration)
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

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------

const PROGRESS_FILE = path.join(__dirname, '.auth-migration-progress.json');

interface AuthMigrationProgress {
  migratedUids: string[];
  skippedUids: string[];
  errorUids: Array<{ uid: string; error: string }>;
  startedAt: string;
  lastUpdatedAt: string;
}

function loadProgress(): AuthMigrationProgress {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const raw = fs.readFileSync(PROGRESS_FILE, 'utf-8');
      const loaded = JSON.parse(raw) as AuthMigrationProgress;
      console.log(dim(`Resuming from progress file: ${loaded.migratedUids.length} users already migrated`));
      return loaded;
    } catch {
      console.warn(yellow('Corrupt progress file, starting fresh.'));
    }
  }
  return {
    migratedUids: [],
    skippedUids: [],
    errorUids: [],
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };
}

function saveProgress(progress: AuthMigrationProgress): void {
  progress.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ---------------------------------------------------------------------------
// Firebase + Supabase initialization
// ---------------------------------------------------------------------------

function initFirebase(): void {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH environment variable is required');
  }
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account file not found: ${serviceAccountPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  console.log(green('Firebase initialized'));
}

function initSupabase(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) environment variable is required');
  }
  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  console.log(green(`Supabase initialized: ${supabaseUrl}`));
  return client;
}

// ---------------------------------------------------------------------------
// Core migration
// ---------------------------------------------------------------------------

async function migrateAllUsers(
  supabase: SupabaseClient,
  progress: AuthMigrationProgress,
  dryRun: boolean
): Promise<void> {
  const alreadyDone = new Set(progress.migratedUids);
  const alreadySkipped = new Set(progress.skippedUids);

  let totalFirebaseUsers = 0;
  let created = 0;
  let skippedNoPhone = 0;
  let skippedAlreadyMigrated = 0;
  let errors = 0;
  let nextPageToken: string | undefined;

  console.log(bold('\n=== Batch Firebase Auth -> Supabase Auth Migration ===\n'));

  if (dryRun) {
    console.log(yellow('DRY RUN MODE: No data will be written to Supabase\n'));
  }

  // Paginate through all Firebase Auth users
  do {
    const listResult = await admin.auth().listUsers(1000, nextPageToken);
    nextPageToken = listResult.pageToken;
    totalFirebaseUsers += listResult.users.length;

    for (const firebaseUser of listResult.users) {
      const uid = firebaseUser.uid;

      // Skip if already processed
      if (alreadyDone.has(uid) || alreadySkipped.has(uid)) {
        skippedAlreadyMigrated++;
        continue;
      }

      // Skip users without phone numbers
      if (!firebaseUser.phoneNumber) {
        skippedNoPhone++;
        progress.skippedUids.push(uid);
        console.log(dim(`  skip: ${uid} (no phone number)`));
        continue;
      }

      if (dryRun) {
        created++;
        console.log(dim(`  [dry-run] would create: ${uid} -> ${firebaseUser.phoneNumber}`));
        continue;
      }

      try {
        // Check if already migrated in Supabase (firebase_uid exists)
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('firebase_uid', uid)
          .single();

        if (existing) {
          skippedAlreadyMigrated++;
          progress.migratedUids.push(uid);
          console.log(dim(`  exists: ${uid} -> ${existing.id}`));
          continue;
        }

        // Create Supabase Auth user with phone number
        const { data: newAuthUser, error: createError } = await supabase.auth.admin.createUser({
          phone: firebaseUser.phoneNumber,
          phone_confirm: true,
          user_metadata: { firebase_uid: uid },
        });

        if (createError) {
          // If phone already taken, find existing user and link firebase_uid
          if (createError.message?.includes('already been registered') ||
              createError.message?.includes('duplicate') ||
              createError.message?.includes('already exists')) {
            const { data: existingByPhone } = await supabase
              .from('users')
              .select('id')
              .eq('phone', firebaseUser.phoneNumber)
              .single();

            if (existingByPhone) {
              // Link firebase_uid to existing user
              const { error: updateError } = await supabase
                .from('users')
                .update({ firebase_uid: uid })
                .eq('id', existingByPhone.id);

              if (updateError) {
                throw new Error(`Failed to link firebase_uid: ${updateError.message}`);
              }

              created++;
              progress.migratedUids.push(uid);
              console.log(green(`  linked: ${uid} -> ${existingByPhone.id} (phone match)`));
              continue;
            }
          }

          throw new Error(`Failed to create auth user: ${createError.message}`);
        }

        const supabaseUserId = newAuthUser.user.id;

        // Insert minimal row in users table with firebase_uid
        // The data migration script will UPDATE this row with full profile data
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: supabaseUserId,
            phone: firebaseUser.phoneNumber,
            firebase_uid: uid,
            created_at: firebaseUser.metadata.creationTime || new Date().toISOString(),
          });

        if (insertError) {
          // Row might already exist from a trigger — try updating instead
          if (insertError.message?.includes('duplicate') || insertError.code === '23505') {
            await supabase
              .from('users')
              .update({ firebase_uid: uid })
              .eq('id', supabaseUserId);
          } else {
            throw new Error(`Failed to insert user row: ${insertError.message}`);
          }
        }

        created++;
        progress.migratedUids.push(uid);
        console.log(green(`  created: ${uid} -> ${supabaseUserId} (${firebaseUser.phoneNumber})`));

      } catch (err) {
        errors++;
        const errorMsg = (err as Error).message;
        progress.errorUids.push({ uid, error: errorMsg });
        console.error(red(`  error: ${uid} -> ${errorMsg}`));
      }
    }

    // Save progress after each page
    if (!dryRun) {
      saveProgress(progress);
    }

    console.log(dim(`  ... processed ${totalFirebaseUsers} Firebase users so far`));

  } while (nextPageToken);

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log(bold('\n=== Migration Summary ===\n'));
  console.log(`  Total Firebase Auth users: ${cyan(String(totalFirebaseUsers))}`);
  console.log(`  Created in Supabase:       ${green(String(created))}`);
  console.log(`  Already migrated:          ${dim(String(skippedAlreadyMigrated))}`);
  console.log(`  Skipped (no phone):        ${yellow(String(skippedNoPhone))}`);
  console.log(`  Errors:                    ${errors > 0 ? red(String(errors)) : dim('0')}`);

  if (errors > 0) {
    console.log(yellow(`\n  ${errors} errors saved to ${PROGRESS_FILE}`));
    console.log(yellow('  Fix issues and re-run — completed users will be skipped.'));
  }

  if (dryRun) {
    console.log(yellow('\n  DRY RUN — no changes were made.'));
    console.log(dim('  Remove --dry-run to execute for real.'));
  } else {
    console.log(green('\n  Auth migration complete.'));
    console.log(dim('  Next step: npx tsx scripts/migrate-firestore-data.ts --env ' + cliArgs.env));
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let cliArgs: CliArgs;

async function main(): Promise<void> {
  cliArgs = parseArgs();

  if (cliArgs.help) {
    showHelp();
    process.exit(0);
  }

  // Load environment
  loadEnv(cliArgs.env);

  // Safety check for prod
  if (cliArgs.env === 'prod' && !cliArgs.dryRun) {
    console.log(red(bold('\n⚠  PRODUCTION MODE ⚠')));
    console.log(red('This will create Supabase Auth users from all Firebase Auth accounts.'));
    console.log(red('Type "yes-prod" to continue, or Ctrl+C to abort.\n'));

    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) => {
      rl.question('Confirm: ', resolve);
    });
    rl.close();

    if (answer !== 'yes-prod') {
      console.log(yellow('Aborted.'));
      process.exit(0);
    }
  }

  // Initialize
  initFirebase();
  const supabase = initSupabase();
  const progress = cliArgs.dryRun ? loadProgress() : loadProgress();

  // Run migration
  await migrateAllUsers(supabase, progress, cliArgs.dryRun);

  // Clean exit
  process.exit(0);
}

main().catch((err) => {
  console.error(red(`\nFatal error: ${(err as Error).message}`));
  process.exit(1);
});
