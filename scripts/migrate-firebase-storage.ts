/**
 * Firebase Storage -> Supabase Storage Migration Script
 *
 * Transfers all media files from Firebase Storage to Supabase Storage.
 * Handles: photos, videos, profile photos, selects photos, comment images.
 *
 * Usage:
 *   npx tsx scripts/migrate-firebase-storage.ts
 *
 * Environment variables (via .env or shell):
 *   FIREBASE_SERVICE_ACCOUNT_PATH  - Path to Firebase service account JSON
 *   FIREBASE_STORAGE_BUCKET        - Firebase Storage bucket name
 *   SUPABASE_URL                   - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY      - Service role key for admin access
 *
 * Features:
 *   - Resume capability via progress file (survives interruptions)
 *   - Parallel batch processing (configurable batch size)
 *   - Content type detection from file extension
 *   - Upsert mode for safe re-runs
 *   - Detailed progress reporting and error tracking
 */

import * as admin from 'firebase-admin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50; // Files to process in parallel per batch
const PROGRESS_FILE = path.join(__dirname, '.migration-progress.json');

/**
 * Maps Firebase Storage prefixes to Supabase Storage buckets.
 * Firebase path structure -> Supabase bucket + path transformation.
 */
const BUCKETS_MAP: Record<string, { supabaseBucket: string; prefix: string }> = {
  photos: { supabaseBucket: 'photos', prefix: 'photos/' },
  'profile-photos': { supabaseBucket: 'profile-photos', prefix: 'profile-photos/' },
  selects: { supabaseBucket: 'selects', prefix: 'selects/' },
  'comment-images': { supabaseBucket: 'comment-images', prefix: 'comment-images/' },
};

/** Content type lookup by file extension */
const CONTENT_TYPE_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
};

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------

interface MigrationProgress {
  completed: string[];
  failed: Array<{ path: string; error: string }>;
  total: number;
  startedAt: string;
  lastUpdatedAt: string;
}

function loadProgress(): MigrationProgress {
  if (fs.existsSync(PROGRESS_FILE)) {
    const raw = fs.readFileSync(PROGRESS_FILE, 'utf-8');
    const loaded = JSON.parse(raw) as MigrationProgress;
    console.log(
      `Resuming from progress file: ${loaded.completed.length} completed, ${loaded.failed.length} failed`,
    );
    return loaded;
  }
  return {
    completed: [],
    failed: [],
    total: 0,
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };
}

function saveProgress(progress: MigrationProgress): void {
  progress.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

function initFirebase(): void {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  if (!serviceAccountPath) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH environment variable is required');
  }
  if (!storageBucket) {
    throw new Error('FIREBASE_STORAGE_BUCKET environment variable is required');
  }
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account file not found: ${serviceAccountPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket,
  });

  console.log(`Firebase initialized with bucket: ${storageBucket}`);
}

function initSupabase(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is required');
  }
  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  console.log(`Supabase initialized with URL: ${supabaseUrl}`);
  return client;
}

// ---------------------------------------------------------------------------
// Migration logic
// ---------------------------------------------------------------------------

function detectContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPE_MAP[ext] || 'application/octet-stream';
}

async function migrateFile(
  file: { name: string; download: () => Promise<[Buffer]> },
  supabaseBucket: string,
  supabasePath: string,
  supabase: SupabaseClient,
): Promise<void> {
  // Download from Firebase
  const [buffer] = await file.download();

  const contentType = detectContentType(file.name);

  // Upload to Supabase
  const { error } = await supabase.storage.from(supabaseBucket).upload(supabasePath, buffer, {
    contentType,
    cacheControl: 'public, max-age=31536000',
    upsert: true,
  });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }
}

async function migrateBucket(
  firebasePrefix: string,
  config: { supabaseBucket: string; prefix: string },
  supabase: SupabaseClient,
  progress: MigrationProgress,
): Promise<void> {
  console.log(`\n--- Migrating "${firebasePrefix}" -> "${config.supabaseBucket}" ---`);

  // List all files in Firebase Storage under this prefix
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix: config.prefix });

  // Filter out directory placeholders (zero-byte entries ending with /)
  const realFiles = files.filter((f) => !f.name.endsWith('/'));
  console.log(`Found ${realFiles.length} files in ${firebasePrefix}`);

  // Build a Set for O(1) lookup of already-completed files
  const completedSet = new Set(progress.completed);

  // Filter out already-migrated files
  const remaining = realFiles.filter((f) => !completedSet.has(f.name));
  console.log(`${remaining.length} files remaining (${realFiles.length - remaining.length} already done)`);

  if (remaining.length === 0) {
    console.log(`Skipping ${firebasePrefix} -- all files already migrated`);
    return;
  }

  // Process in batches
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(remaining.length / BATCH_SIZE);

    console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} files)`);

    await Promise.all(
      batch.map(async (file) => {
        try {
          // Compute Supabase path: strip the Firebase prefix
          const supabasePath = file.name.startsWith(config.prefix)
            ? file.name.substring(config.prefix.length)
            : file.name;

          await migrateFile(
            file as unknown as { name: string; download: () => Promise<[Buffer]> },
            config.supabaseBucket,
            supabasePath,
            supabase,
          );

          progress.completed.push(file.name);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          progress.failed.push({ path: file.name, error: message });
          console.error(`  FAILED: ${file.name} -- ${message}`);
        }
      }),
    );

    // Save progress after each batch (resume capability)
    saveProgress(progress);

    const totalCompleted = progress.completed.length;
    const totalFailed = progress.failed.length;
    console.log(
      `  Progress: ${totalCompleted} completed, ${totalFailed} failed`,
    );
  }
}

// ---------------------------------------------------------------------------
// Retry failed files
// ---------------------------------------------------------------------------

async function retryFailed(
  supabase: SupabaseClient,
  progress: MigrationProgress,
): Promise<void> {
  if (progress.failed.length === 0) return;

  console.log(`\n--- Retrying ${progress.failed.length} failed files ---`);

  const bucket = admin.storage().bucket();
  const failedItems = [...progress.failed];
  progress.failed = [];

  for (let i = 0; i < failedItems.length; i += BATCH_SIZE) {
    const batch = failedItems.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (item) => {
        try {
          // Determine which bucket config this file belongs to
          const entry = Object.entries(BUCKETS_MAP).find(([, cfg]) =>
            item.path.startsWith(cfg.prefix),
          );
          if (!entry) {
            progress.failed.push({ path: item.path, error: 'Unknown bucket prefix' });
            return;
          }

          const [, config] = entry;
          const file = bucket.file(item.path);
          const supabasePath = item.path.startsWith(config.prefix)
            ? item.path.substring(config.prefix.length)
            : item.path;

          await migrateFile(
            file as unknown as { name: string; download: () => Promise<[Buffer]> },
            config.supabaseBucket,
            supabasePath,
            supabase,
          );

          progress.completed.push(item.path);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          progress.failed.push({ path: item.path, error: message });
          console.error(`  RETRY FAILED: ${item.path} -- ${message}`);
        }
      }),
    );

    saveProgress(progress);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function migrate(): Promise<void> {
  console.log('=== Firebase -> Supabase Storage Migration ===\n');

  // Initialize clients
  initFirebase();
  const supabase = initSupabase();

  // Load or create progress
  const progress = loadProgress();

  // Migrate each bucket
  for (const [firebasePrefix, config] of Object.entries(BUCKETS_MAP)) {
    await migrateBucket(firebasePrefix, config, supabase, progress);
  }

  // Retry any failed files once
  if (progress.failed.length > 0) {
    await retryFailed(supabase, progress);
  }

  // Final report
  saveProgress(progress);

  console.log('\n=== Migration Complete ===');
  console.log(`Total completed: ${progress.completed.length}`);
  console.log(`Total failed: ${progress.failed.length}`);

  if (progress.failed.length > 0) {
    console.log('\nFailed files:');
    for (const item of progress.failed) {
      console.log(`  ${item.path}: ${item.error}`);
    }
    console.log(
      `\nRe-run the script to retry failed files (progress is saved to ${PROGRESS_FILE})`,
    );
    process.exit(1);
  } else {
    console.log('\nAll files migrated successfully!');
    console.log(`Progress file: ${PROGRESS_FILE} (can be deleted)`);
    process.exit(0);
  }
}

migrate().catch((err) => {
  console.error('Migration failed with error:', err);
  process.exit(2);
});
