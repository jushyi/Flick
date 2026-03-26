/**
 * Firestore -> Supabase Data Migration Script
 *
 * Migrates all persistent Firestore collections to Supabase PostgreSQL tables.
 * Plan 01 covers 9 collections: users, photos, photo_reactions, photo_tags,
 * viewed_photos, friendships, blocks, reports, support_requests.
 * Plan 02 extends with complex collections (conversations, messages, comments, etc.).
 *
 * Usage:
 *   npx tsx scripts/migrate-firestore-data.ts --env dev --dry-run
 *   npx tsx scripts/migrate-firestore-data.ts --env prod
 *   npx tsx scripts/migrate-firestore-data.ts --env dev --collection photos
 *
 * Flags:
 *   --env dev|prod     Load .env.dev or .env.prod (default: dev)
 *   --dry-run          Read Firestore, log counts, write nothing to Supabase
 *   --collection <name> Migrate only one specific collection
 *   --help             Show usage
 *
 * Environment variables (via .env.dev / .env.prod / .env.local / .env):
 *   FIREBASE_SERVICE_ACCOUNT_PATH  - Path to Firebase service account JSON
 *   SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY      - Service role key for admin access
 *
 * Features:
 *   - Resume capability via progress file (survives interruptions)
 *   - FK-strict dependency ordering (users first, then photos, etc.)
 *   - Firebase UID -> Supabase UUID mapping via firebase_uid column
 *   - Firebase Storage URL rewriting to Supabase Storage paths
 *   - Per-row error handling (skip and log, never stop)
 *   - Batch inserts with fallback to row-by-row on error
 *   - Dry-run mode for safe pre-migration validation
 */

import * as admin from 'firebase-admin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
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
  collection: string | null;
  help: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    env: 'dev',
    dryRun: false,
    collection: null,
    help: false,
  };

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
      case '--collection':
        i++;
        result.collection = args[i] || null;
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
${bold('Firestore -> Supabase Data Migration')}

${bold('Usage:')}
  npx tsx scripts/migrate-firestore-data.ts [options]

${bold('Options:')}
  --env dev|prod       Load .env.dev or .env.prod (default: dev)
  --dry-run            Read Firestore data, log counts, write nothing
  --collection <name>  Migrate only one collection (e.g., photos)
  --help, -h           Show this help message

${bold('Collections (17 total, in FK dependency order):')}
  users, photos, photo_reactions, photo_tags, viewed_photos,
  friendships, blocks, reports, support_requests, conversations,
  messages, message_deletions, streaks, comments, comment_likes,
  albums, album_photos

${bold('Environment variables:')}
  FIREBASE_SERVICE_ACCOUNT_PATH  Path to Firebase service account JSON
  SUPABASE_URL                   Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY      Service role key for admin access

${bold('Examples:')}
  npx tsx scripts/migrate-firestore-data.ts --env dev --dry-run
  npx tsx scripts/migrate-firestore-data.ts --env prod
  npx tsx scripts/migrate-firestore-data.ts --collection photos --env dev
`);
}

// ---------------------------------------------------------------------------
// Environment loading
// ---------------------------------------------------------------------------

function loadEnv(env: 'dev' | 'prod'): void {
  const root = path.join(__dirname, '..');

  // Try env-specific file first, then fallbacks
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

const PROGRESS_FILE = path.join(__dirname, '.data-migration-progress.json');

interface CollectionProgress {
  status: 'pending' | 'in_progress' | 'complete' | 'error';
  migratedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ docId: string; error: string }>;
}

interface MigrationProgress {
  collections: Record<string, CollectionProgress>;
  startedAt: string;
  lastUpdatedAt: string;
}

function loadProgress(): MigrationProgress {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const raw = fs.readFileSync(PROGRESS_FILE, 'utf-8');
      const loaded = JSON.parse(raw) as MigrationProgress;
      const completedCount = Object.values(loaded.collections).filter(
        (c) => c.status === 'complete'
      ).length;
      console.log(dim(`Resuming from progress file: ${completedCount} collections complete`));
      return loaded;
    } catch {
      console.warn(yellow('Corrupt progress file, starting fresh.'));
    }
  }
  return {
    collections: {},
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };
}

function saveProgress(progress: MigrationProgress): void {
  progress.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function getCollectionProgress(progress: MigrationProgress, name: string): CollectionProgress {
  if (!progress.collections[name]) {
    progress.collections[name] = {
      status: 'pending',
      migratedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
    };
  }
  return progress.collections[name];
}

// ---------------------------------------------------------------------------
// Firebase + Supabase initialization
// ---------------------------------------------------------------------------

function initFirebase(): admin.firestore.Firestore {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountPath) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH environment variable is required');
  }
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account file not found: ${serviceAccountPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

  // Avoid re-initializing if already done (e.g., during testing)
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  console.log(green('Firebase initialized'));
  return admin.firestore();
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
// ID mapping
// ---------------------------------------------------------------------------

/** Firebase UID -> Supabase UUID */
const userIdMap = new Map<string, string>();

/** Firestore photo doc ID -> generated Supabase UUID */
const photoIdMap = new Map<string, string>();

/** Firestore conversation doc ID -> generated Supabase UUID */
const conversationIdMap = new Map<string, string>();

/** Firestore message doc ID -> generated Supabase UUID */
const messageIdMap = new Map<string, string>();

/** Firestore comment doc ID -> generated Supabase UUID */
const commentIdMap = new Map<string, string>();

/** Firestore album doc ID -> generated Supabase UUID */
const albumIdMap = new Map<string, string>();

async function buildUserIdMap(supabase: SupabaseClient): Promise<void> {
  console.log(dim('Building user ID map (firebase_uid -> supabase UUID)...'));

  // Fetch all users with firebase_uid set
  const { data, error } = await supabase
    .from('users')
    .select('id, firebase_uid')
    .not('firebase_uid', 'is', null);

  if (error) {
    throw new Error(`Failed to build user ID map: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.warn(yellow('No users with firebase_uid found. Has the auth migration run?'));
    return;
  }

  for (const row of data) {
    if (row.firebase_uid) {
      userIdMap.set(row.firebase_uid, row.id);
    }
  }

  console.log(green(`User ID map built: ${userIdMap.size} users`));
}

function mapUserId(firebaseUid: string): string {
  const supabaseId = userIdMap.get(firebaseUid);
  if (!supabaseId) {
    throw new Error(`Firebase UID not found in user ID map: ${firebaseUid}`);
  }
  return supabaseId;
}

function generateUUID(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Storage URL rewriting
// ---------------------------------------------------------------------------

/**
 * Rewrites a Firebase Storage path by replacing the Firebase UID with the Supabase UUID.
 * E.g., "profile-photos/{firebaseUid}/pic.jpg" -> "{supabaseUuid}/pic.jpg"
 *       "photos/{firebaseUid}/abc.jpg" -> "{supabaseUuid}/abc.jpg"
 *
 * Strips known prefixes (photos/, profile-photos/, snaps/) so the result
 * is just "{supabaseUuid}/{filename}" — matching Supabase bucket structure.
 */
function rewriteStoragePath(
  firebasePath: string,
  firebaseUid: string,
  supabaseUuid: string
): string {
  if (!firebasePath) return firebasePath;

  // Strip known bucket prefixes
  const prefixes = ['photos/', 'profile-photos/', 'snaps/', 'selects/', 'comment-images/'];
  let cleaned = firebasePath;
  for (const prefix of prefixes) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.substring(prefix.length);
      break;
    }
  }

  // Replace Firebase UID with Supabase UUID in the path
  if (cleaned.includes(firebaseUid)) {
    cleaned = cleaned.replace(firebaseUid, supabaseUuid);
  }

  return cleaned;
}

/**
 * Rewrites a full Firebase download URL to a Supabase storage path.
 * If the URL is not a Firebase Storage URL, returns it as-is.
 *
 * Firebase URLs look like:
 *   https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encoded_path}?alt=media&token=...
 *
 * Extracts the path component and rewrites it.
 */
function rewriteFirebaseUrl(
  firebaseUrl: string,
  firebaseUid: string,
  supabaseUuid: string
): string {
  if (!firebaseUrl) return firebaseUrl;

  // Check if it's a Firebase Storage URL
  if (!firebaseUrl.includes('firebasestorage.googleapis.com') &&
      !firebaseUrl.includes('firebasestorage.app')) {
    return firebaseUrl;
  }

  try {
    // Extract the encoded path from the URL
    // Format: .../o/{encoded_path}?...
    const oIndex = firebaseUrl.indexOf('/o/');
    if (oIndex === -1) return firebaseUrl;

    const afterO = firebaseUrl.substring(oIndex + 3);
    const queryIndex = afterO.indexOf('?');
    const encodedPath = queryIndex === -1 ? afterO : afterO.substring(0, queryIndex);
    const decodedPath = decodeURIComponent(encodedPath);

    return rewriteStoragePath(decodedPath, firebaseUid, supabaseUuid);
  } catch {
    // If parsing fails, return original
    return firebaseUrl;
  }
}

/**
 * Constructs a full Supabase public URL from bucket and storage path.
 */
function buildSupabasePublicUrl(bucket: string, storagePath: string): string {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
}

// ---------------------------------------------------------------------------
// Timestamp conversion
// ---------------------------------------------------------------------------

/**
 * Converts Firestore Timestamp, Date, or ISO string to ISO 8601 string.
 * Returns null for missing/undefined values.
 */
function toISOString(firestoreTimestamp: any): string | null {
  if (!firestoreTimestamp) return null;

  // Firestore Timestamp object
  if (typeof firestoreTimestamp.toDate === 'function') {
    return firestoreTimestamp.toDate().toISOString();
  }

  // JavaScript Date object
  if (firestoreTimestamp instanceof Date) {
    return firestoreTimestamp.toISOString();
  }

  // Already an ISO string
  if (typeof firestoreTimestamp === 'string') {
    return firestoreTimestamp;
  }

  // Firestore Timestamp-like object with _seconds
  if (typeof firestoreTimestamp._seconds === 'number') {
    return new Date(firestoreTimestamp._seconds * 1000).toISOString();
  }

  return null;
}

// ---------------------------------------------------------------------------
// Batch insert helper
// ---------------------------------------------------------------------------

interface BatchResult {
  inserted: number;
  errors: Array<{ index: number; error: string }>;
}

/**
 * Inserts rows into a Supabase table in batches.
 * On batch error, falls back to row-by-row insert to identify specific failures.
 */
async function batchInsert(
  supabase: SupabaseClient,
  table: string,
  rows: any[],
  batchSize = 500
): Promise<BatchResult> {
  const result: BatchResult = { inserted: 0, errors: [] };

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    const { error } = await supabase.from(table).insert(batch);

    if (!error) {
      result.inserted += batch.length;
    } else {
      // Batch failed -- fall back to row-by-row to identify which rows fail
      for (let j = 0; j < batch.length; j++) {
        const { error: rowError } = await supabase.from(table).insert(batch[j]);
        if (rowError) {
          result.errors.push({
            index: i + j,
            error: rowError.message,
          });
        } else {
          result.inserted++;
        }
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Inline data queues (populated during photos migration)
// ---------------------------------------------------------------------------

/** Queued photo reactions from inline reactions maps on photo docs */
interface QueuedReaction {
  firestorePhotoId: string;
  firebaseUid: string;
  emoji: string;
}
const queuedReactions: QueuedReaction[] = [];

/** Queued photo tags from inline taggedUserIds arrays on photo docs */
interface QueuedTag {
  firestorePhotoId: string;
  firebaseUid: string;
}
const queuedTags: QueuedTag[] = [];

/** Queued album_photos junction rows from albums migration */
interface QueuedAlbumPhoto {
  firestoreAlbumId: string;
  firestorePhotoId: string;
}
const queuedAlbumPhotos: QueuedAlbumPhoto[] = [];

// ---------------------------------------------------------------------------
// Collection migrators
// ---------------------------------------------------------------------------

type Migrator = (
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
) => Promise<void>;

// ---- 1. Users ----

async function migrateUsers(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'users');
  if (colProgress.status === 'complete') {
    console.log(yellow('users: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';
  const snapshot = await firestore.collection('users').get();

  if (snapshot.empty) {
    console.log(yellow('users: 0 docs found, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  console.log(cyan(`users: ${snapshot.size} docs found`));

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const firebaseUid = doc.id;
      const supabaseUuid = userIdMap.get(firebaseUid);

      if (!supabaseUuid) {
        skipped++;
        console.log(yellow(`  users: skipping ${firebaseUid} (not in user ID map)`));
        continue;
      }

      const data = doc.data();

      // Rewrite profile photo path
      let profilePhotoPath = data.profilePhotoPath || data.profile_photo_path || null;
      if (profilePhotoPath) {
        profilePhotoPath = rewriteStoragePath(profilePhotoPath, firebaseUid, supabaseUuid);
      }

      const updateData: Record<string, any> = {
        phone: data.phone || data.phoneNumber || null,
        username: data.username || null,
        display_name: data.displayName || data.display_name || null,
        bio: data.bio || null,
        profile_photo_path: profilePhotoPath,
        name_color: data.nameColor || data.name_color || null,
        selects: data.selects || [],
        song: data.song || null,
        pinned_snap_data: data.pinnedSnapData || data.pinned_snap_data || null,
        friend_count: data.friendCount ?? data.friend_count ?? 0,
        daily_photo_count: data.dailyPhotoCount ?? data.daily_photo_count ?? 0,
        last_photo_date: data.lastPhotoDate || data.last_photo_date || null,
        fcm_token: data.fcmToken || data.fcm_token || null,
        push_token: data.pushToken || data.push_token || null,
        profile_setup_completed: data.profileSetupCompleted ?? data.profile_setup_completed ?? false,
        read_receipts_enabled: data.readReceiptsEnabled ?? data.read_receipts_enabled ?? true,
        deletion_scheduled_at: toISOString(data.deletionScheduledAt || data.deletion_scheduled_at),
        deletion_reason: data.deletionReason || data.deletion_reason || null,
        created_at: toISOString(data.createdAt || data.created_at) || new Date().toISOString(),
        updated_at: toISOString(data.updatedAt || data.updated_at) || new Date().toISOString(),
      };

      if (dryRun) {
        migrated++;
        continue;
      }

      // UPDATE existing user row (auth migration already created the row)
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', supabaseUuid);

      if (error) {
        throw new Error(error.message);
      }

      migrated++;
    } catch (err: unknown) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: doc.id, error: message });
      console.error(red(`  users: error on ${doc.id}: ${message}`));
    }

    // Progress logging every 50 docs
    if ((migrated + skipped + errors) % 50 === 0) {
      console.log(dim(`  users: ${migrated} migrated, ${skipped} skipped, ${errors} errors`));
    }
  }

  colProgress.migratedCount = migrated;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = errors;
  colProgress.status = errors > 0 && migrated === 0 ? 'error' : 'complete';
  saveProgress(progress);

  console.log(
    `users: ${green(`${migrated} migrated`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors} errors`)}`
  );
}

// ---- 2. Photos ----

async function migratePhotos(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'photos');
  if (colProgress.status === 'complete') {
    console.log(yellow('photos: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';
  const snapshot = await firestore.collection('photos').get();

  if (snapshot.empty) {
    console.log(yellow('photos: 0 docs found, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  console.log(cyan(`photos: ${snapshot.size} docs found`));

  const rows: any[] = [];
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const firebaseUid = data.userId || data.user_id;

      if (!firebaseUid) {
        skipped++;
        console.log(yellow(`  photos: skipping ${doc.id} (no userId)`));
        continue;
      }

      const supabaseUserId = mapUserId(firebaseUid);
      const newId = generateUUID();
      photoIdMap.set(doc.id, newId);

      // Rewrite storage path
      let storagePath = data.storagePath || data.storage_path || null;
      if (storagePath) {
        storagePath = rewriteStoragePath(storagePath, firebaseUid, supabaseUserId);
      }

      // Rewrite image URL
      let imageUrl = data.imageURL || data.photoURL || data.imageUrl || data.image_url || null;
      if (imageUrl) {
        if (imageUrl.includes('firebasestorage.googleapis.com') ||
            imageUrl.includes('firebasestorage.app')) {
          // Full Firebase URL -> rewrite to Supabase public URL
          const rewrittenPath = rewriteFirebaseUrl(imageUrl, firebaseUid, supabaseUserId);
          imageUrl = buildSupabasePublicUrl('photos', rewrittenPath);
        } else if (storagePath) {
          // Use rewritten storage path to build public URL
          imageUrl = buildSupabasePublicUrl('photos', storagePath);
        }
      }

      // Extract inline reactions for later migration
      const reactions = data.reactions;
      if (reactions && typeof reactions === 'object') {
        for (const [uid, emoji] of Object.entries(reactions)) {
          queuedReactions.push({
            firestorePhotoId: doc.id,
            firebaseUid: uid,
            emoji: emoji as string,
          });
        }
      }

      // Extract inline tagged users for later migration
      const taggedUserIds = data.taggedUserIds || data.tagged_user_ids;
      if (Array.isArray(taggedUserIds)) {
        for (const uid of taggedUserIds) {
          queuedTags.push({
            firestorePhotoId: doc.id,
            firebaseUid: uid,
          });
        }
      }

      rows.push({
        id: newId,
        user_id: supabaseUserId,
        image_url: imageUrl,
        thumbnail_data_url: data.thumbnailDataURL || data.thumbnail_data_url || null,
        status: data.status || 'revealed',
        photo_state: data.photoState || data.photo_state || null,
        media_type: data.mediaType || data.media_type || 'photo',
        caption: data.caption || null,
        reveal_at: toISOString(data.revealAt || data.reveal_at),
        storage_path: storagePath,
        comment_count: data.commentCount ?? data.comment_count ?? 0,
        reaction_count: data.reactionCount ?? data.reaction_count ?? 0,
        deleted_at: toISOString(data.deletedAt || data.deleted_at),
        created_at: toISOString(data.createdAt || data.created_at) || new Date().toISOString(),
      });
    } catch (err: unknown) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: doc.id, error: message });
      console.error(red(`  photos: error on ${doc.id}: ${message}`));
    }
  }

  if (dryRun) {
    console.log(
      `photos: ${green(`${rows.length} would be inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors} errors`)}`
    );
    console.log(dim(`  Queued ${queuedReactions.length} reactions, ${queuedTags.length} tags`));
    colProgress.migratedCount = rows.length;
    colProgress.skippedCount = skipped;
    colProgress.errorCount = errors;
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  // Batch insert
  const result = await batchInsert(supabase, 'photos', rows);

  for (const err of result.errors) {
    colProgress.errors.push({ docId: `row_${err.index}`, error: err.error });
  }

  colProgress.migratedCount = result.inserted;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = errors + result.errors.length;
  colProgress.status = 'complete';
  saveProgress(progress);

  console.log(
    `photos: ${green(`${result.inserted} inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors + result.errors.length} errors`)}`
  );
  console.log(dim(`  Queued ${queuedReactions.length} reactions, ${queuedTags.length} tags`));
}

// ---- 3. Photo Reactions (from inline data) ----

async function migratePhotoReactions(
  _firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'photo_reactions');
  if (colProgress.status === 'complete') {
    console.log(yellow('photo_reactions: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';

  if (queuedReactions.length === 0) {
    console.log(yellow('photo_reactions: 0 queued reactions, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  console.log(cyan(`photo_reactions: ${queuedReactions.length} queued from photos migration`));

  const rows: any[] = [];
  let skipped = 0;
  let errors = 0;

  for (const reaction of queuedReactions) {
    try {
      const photoId = photoIdMap.get(reaction.firestorePhotoId);
      if (!photoId) {
        skipped++;
        continue;
      }

      const userId = mapUserId(reaction.firebaseUid);

      rows.push({
        id: generateUUID(),
        photo_id: photoId,
        user_id: userId,
        emoji: reaction.emoji,
      });
    } catch (err: unknown) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: reaction.firestorePhotoId, error: message });
    }
  }

  if (dryRun) {
    console.log(
      `photo_reactions: ${green(`${rows.length} would be inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors} errors`)}`
    );
    colProgress.migratedCount = rows.length;
    colProgress.skippedCount = skipped;
    colProgress.errorCount = errors;
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  const result = await batchInsert(supabase, 'photo_reactions', rows);

  for (const err of result.errors) {
    colProgress.errors.push({ docId: `row_${err.index}`, error: err.error });
  }

  colProgress.migratedCount = result.inserted;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = errors + result.errors.length;
  colProgress.status = 'complete';
  saveProgress(progress);

  console.log(
    `photo_reactions: ${green(`${result.inserted} inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors + result.errors.length} errors`)}`
  );
}

// ---- 4. Photo Tags (from inline data) ----

async function migratePhotoTags(
  _firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'photo_tags');
  if (colProgress.status === 'complete') {
    console.log(yellow('photo_tags: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';

  if (queuedTags.length === 0) {
    console.log(yellow('photo_tags: 0 queued tags, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  console.log(cyan(`photo_tags: ${queuedTags.length} queued from photos migration`));

  const rows: any[] = [];
  let skipped = 0;
  let errors = 0;

  for (const tag of queuedTags) {
    try {
      const photoId = photoIdMap.get(tag.firestorePhotoId);
      if (!photoId) {
        skipped++;
        continue;
      }

      const userId = mapUserId(tag.firebaseUid);

      rows.push({
        photo_id: photoId,
        user_id: userId,
      });
    } catch (err: unknown) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: tag.firestorePhotoId, error: message });
    }
  }

  if (dryRun) {
    console.log(
      `photo_tags: ${green(`${rows.length} would be inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors} errors`)}`
    );
    colProgress.migratedCount = rows.length;
    colProgress.skippedCount = skipped;
    colProgress.errorCount = errors;
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  const result = await batchInsert(supabase, 'photo_tags', rows);

  for (const err of result.errors) {
    colProgress.errors.push({ docId: `row_${err.index}`, error: err.error });
  }

  colProgress.migratedCount = result.inserted;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = errors + result.errors.length;
  colProgress.status = 'complete';
  saveProgress(progress);

  console.log(
    `photo_tags: ${green(`${result.inserted} inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors + result.errors.length} errors`)}`
  );
}

// ---- 5. Viewed Photos (subcollection) ----

async function migrateViewedPhotos(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'viewed_photos');
  if (colProgress.status === 'complete') {
    console.log(yellow('viewed_photos: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';

  console.log(cyan('viewed_photos: reading subcollections users/{userId}/viewedPhotos...'));

  const rows: any[] = [];
  let skipped = 0;
  let errors = 0;
  let totalDocs = 0;

  // Iterate through each user that has a mapping
  for (const [firebaseUid, supabaseUuid] of userIdMap.entries()) {
    try {
      const subcollection = await firestore
        .collection('users')
        .doc(firebaseUid)
        .collection('viewedPhotos')
        .get();

      if (subcollection.empty) continue;

      totalDocs += subcollection.size;

      for (const doc of subcollection.docs) {
        try {
          const data = doc.data();
          const photoFirestoreId = data.photoId || doc.id;
          const photoId = photoIdMap.get(photoFirestoreId);

          if (!photoId) {
            skipped++;
            continue;
          }

          rows.push({
            user_id: supabaseUuid,
            photo_id: photoId,
            viewed_at: toISOString(data.viewedAt || data.viewed_at) || new Date().toISOString(),
          });
        } catch (err: unknown) {
          errors++;
          const message = err instanceof Error ? err.message : String(err);
          colProgress.errors.push({ docId: doc.id, error: message });
        }
      }
    } catch (err: unknown) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: `user_${firebaseUid}`, error: message });
      console.error(red(`  viewed_photos: error reading subcollection for ${firebaseUid}: ${message}`));
    }
  }

  console.log(dim(`  viewed_photos: found ${totalDocs} docs across all users`));

  if (rows.length === 0 && totalDocs === 0) {
    console.log(yellow('viewed_photos: 0 docs found, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  if (dryRun) {
    console.log(
      `viewed_photos: ${green(`${rows.length} would be inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors} errors`)}`
    );
    colProgress.migratedCount = rows.length;
    colProgress.skippedCount = skipped;
    colProgress.errorCount = errors;
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  const result = await batchInsert(supabase, 'viewed_photos', rows);

  for (const err of result.errors) {
    colProgress.errors.push({ docId: `row_${err.index}`, error: err.error });
  }

  colProgress.migratedCount = result.inserted;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = errors + result.errors.length;
  colProgress.status = 'complete';
  saveProgress(progress);

  console.log(
    `viewed_photos: ${green(`${result.inserted} inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors + result.errors.length} errors`)}`
  );
}

// ---- 6. Friendships ----

async function migrateFriendships(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'friendships');
  if (colProgress.status === 'complete') {
    console.log(yellow('friendships: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';
  const snapshot = await firestore.collection('friendships').get();

  if (snapshot.empty) {
    console.log(yellow('friendships: 0 docs found, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  console.log(cyan(`friendships: ${snapshot.size} docs found`));

  const rows: any[] = [];
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      const fbUid1 = data.user1Id || data.userId1 || data.user1_id;
      const fbUid2 = data.user2Id || data.userId2 || data.user2_id;
      const fbInitiator = data.initiatedBy || data.initiated_by;

      if (!fbUid1 || !fbUid2) {
        skipped++;
        console.log(yellow(`  friendships: skipping ${doc.id} (missing user IDs)`));
        continue;
      }

      let uuid1 = mapUserId(fbUid1);
      let uuid2 = mapUserId(fbUid2);
      const initiatedBy = fbInitiator ? mapUserId(fbInitiator) : uuid1;

      // Enforce CHECK constraint: user1_id < user2_id
      if (uuid1 > uuid2) {
        const tmp = uuid1;
        uuid1 = uuid2;
        uuid2 = tmp;
      }

      rows.push({
        id: generateUUID(),
        user1_id: uuid1,
        user2_id: uuid2,
        status: data.status || 'accepted',
        initiated_by: initiatedBy,
        created_at: toISOString(data.createdAt || data.created_at) || new Date().toISOString(),
      });
    } catch (err: unknown) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: doc.id, error: message });
      console.error(red(`  friendships: error on ${doc.id}: ${message}`));
    }
  }

  if (dryRun) {
    console.log(
      `friendships: ${green(`${rows.length} would be inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors} errors`)}`
    );
    colProgress.migratedCount = rows.length;
    colProgress.skippedCount = skipped;
    colProgress.errorCount = errors;
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  const result = await batchInsert(supabase, 'friendships', rows);

  for (const err of result.errors) {
    colProgress.errors.push({ docId: `row_${err.index}`, error: err.error });
  }

  colProgress.migratedCount = result.inserted;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = errors + result.errors.length;
  colProgress.status = 'complete';
  saveProgress(progress);

  console.log(
    `friendships: ${green(`${result.inserted} inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors + result.errors.length} errors`)}`
  );
}

// ---- 7. Blocks ----

async function migrateBlocks(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'blocks');
  if (colProgress.status === 'complete') {
    console.log(yellow('blocks: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';
  const snapshot = await firestore.collection('blocks').get();

  if (snapshot.empty) {
    console.log(yellow('blocks: 0 docs found, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  console.log(cyan(`blocks: ${snapshot.size} docs found`));

  const rows: any[] = [];
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      const blockerId = data.blockerId || data.blocker_id;
      const blockedId = data.blockedId || data.blocked_id;

      if (!blockerId || !blockedId) {
        skipped++;
        console.log(yellow(`  blocks: skipping ${doc.id} (missing IDs)`));
        continue;
      }

      rows.push({
        blocker_id: mapUserId(blockerId),
        blocked_id: mapUserId(blockedId),
        created_at: toISOString(data.createdAt || data.created_at) || new Date().toISOString(),
      });
    } catch (err: unknown) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: doc.id, error: message });
      console.error(red(`  blocks: error on ${doc.id}: ${message}`));
    }
  }

  if (dryRun) {
    console.log(
      `blocks: ${green(`${rows.length} would be inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors} errors`)}`
    );
    colProgress.migratedCount = rows.length;
    colProgress.skippedCount = skipped;
    colProgress.errorCount = errors;
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  const result = await batchInsert(supabase, 'blocks', rows);

  for (const err of result.errors) {
    colProgress.errors.push({ docId: `row_${err.index}`, error: err.error });
  }

  colProgress.migratedCount = result.inserted;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = errors + result.errors.length;
  colProgress.status = 'complete';
  saveProgress(progress);

  console.log(
    `blocks: ${green(`${result.inserted} inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors + result.errors.length} errors`)}`
  );
}

// ---- 8. Reports ----

async function migrateReports(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'reports');
  if (colProgress.status === 'complete') {
    console.log(yellow('reports: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';
  const snapshot = await firestore.collection('reports').get();

  if (snapshot.empty) {
    console.log(yellow('reports: 0 docs found, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  console.log(cyan(`reports: ${snapshot.size} docs found`));

  const rows: any[] = [];
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      const reporterId = data.reporterId || data.reporter_id;
      const reportedId = data.reportedId || data.reportedUserId || data.reported_id || data.reported_user_id;

      if (!reporterId || !reportedId) {
        skipped++;
        console.log(yellow(`  reports: skipping ${doc.id} (missing IDs)`));
        continue;
      }

      rows.push({
        id: generateUUID(),
        reporter_id: mapUserId(reporterId),
        reported_id: mapUserId(reportedId),
        reason: data.reason || 'unknown',
        details: data.details || null,
        created_at: toISOString(data.createdAt || data.created_at) || new Date().toISOString(),
      });
    } catch (err: unknown) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: doc.id, error: message });
      console.error(red(`  reports: error on ${doc.id}: ${message}`));
    }
  }

  if (dryRun) {
    console.log(
      `reports: ${green(`${rows.length} would be inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors} errors`)}`
    );
    colProgress.migratedCount = rows.length;
    colProgress.skippedCount = skipped;
    colProgress.errorCount = errors;
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  const result = await batchInsert(supabase, 'reports', rows);

  for (const err of result.errors) {
    colProgress.errors.push({ docId: `row_${err.index}`, error: err.error });
  }

  colProgress.migratedCount = result.inserted;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = errors + result.errors.length;
  colProgress.status = 'complete';
  saveProgress(progress);

  console.log(
    `reports: ${green(`${result.inserted} inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors + result.errors.length} errors`)}`
  );
}

// ---- 9. Support Requests ----

async function migrateSupportRequests(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'support_requests');
  if (colProgress.status === 'complete') {
    console.log(yellow('support_requests: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';

  // Firestore uses camelCase collection name
  const snapshot = await firestore.collection('supportRequests').get();

  if (snapshot.empty) {
    console.log(yellow('support_requests: 0 docs found, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  console.log(cyan(`support_requests: ${snapshot.size} docs found`));

  const rows: any[] = [];
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      const userId = data.userId || data.user_id;

      if (!userId) {
        skipped++;
        console.log(yellow(`  support_requests: skipping ${doc.id} (no userId)`));
        continue;
      }

      rows.push({
        id: generateUUID(),
        user_id: mapUserId(userId),
        category: data.category || 'general',
        message: data.message || '',
        created_at: toISOString(data.createdAt || data.created_at) || new Date().toISOString(),
      });
    } catch (err: unknown) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: doc.id, error: message });
      console.error(red(`  support_requests: error on ${doc.id}: ${message}`));
    }
  }

  if (dryRun) {
    console.log(
      `support_requests: ${green(`${rows.length} would be inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors} errors`)}`
    );
    colProgress.migratedCount = rows.length;
    colProgress.skippedCount = skipped;
    colProgress.errorCount = errors;
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  const result = await batchInsert(supabase, 'support_requests', rows);

  for (const err of result.errors) {
    colProgress.errors.push({ docId: `row_${err.index}`, error: err.error });
  }

  colProgress.migratedCount = result.inserted;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = errors + result.errors.length;
  colProgress.status = 'complete';
  saveProgress(progress);

  console.log(
    `support_requests: ${green(`${result.inserted} inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors + result.errors.length} errors`)}`
  );
}

// ---- 10. Conversations ----

async function migrateConversations(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'conversations');
  if (colProgress.status === 'complete') {
    console.log(yellow('conversations: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';
  const snapshot = await firestore.collection('conversations').get();

  if (snapshot.empty) {
    console.log(yellow('conversations: 0 docs found, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  console.log(cyan(`conversations: ${snapshot.size} docs found`));

  const rows: any[] = [];
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const newId = generateUUID();
      conversationIdMap.set(doc.id, newId);

      // Determine participants from array or individual fields
      let fbUid1: string | undefined;
      let fbUid2: string | undefined;

      if (Array.isArray(data.participants) && data.participants.length >= 2) {
        fbUid1 = data.participants[0];
        fbUid2 = data.participants[1];
      } else {
        fbUid1 = data.user1Id || data.userId1 || data.user1_id;
        fbUid2 = data.user2Id || data.userId2 || data.user2_id;
      }

      if (!fbUid1 || !fbUid2) {
        skipped++;
        console.log(yellow(`  conversations: skipping ${doc.id} (missing participant IDs)`));
        continue;
      }

      let uuid1 = mapUserId(fbUid1);
      let uuid2 = mapUserId(fbUid2);

      // Track original mapping before sort to assign per-participant fields correctly
      const origFirst = uuid1;

      // Enforce CHECK constraint: participant1_id < participant2_id
      if (uuid1 > uuid2) {
        const tmp = uuid1;
        uuid1 = uuid2;
        uuid2 = tmp;
      }

      const swapped = origFirst !== uuid1;

      // Per-participant fields: unread counts and deletion timestamps
      const unreadP1Raw = data.unreadCount?.[fbUid1] ?? data.unreadCountP1 ?? data.unread_count_p1 ?? 0;
      const unreadP2Raw = data.unreadCount?.[fbUid2] ?? data.unreadCountP2 ?? data.unread_count_p2 ?? 0;
      const deletedP1Raw = toISOString(data.deletedAt?.[fbUid1] ?? data.deletedAtP1 ?? data.deleted_at_p1);
      const deletedP2Raw = toISOString(data.deletedAt?.[fbUid2] ?? data.deletedAtP2 ?? data.deleted_at_p2);
      const lastReadP1Raw = toISOString(data.lastReadAt?.[fbUid1] ?? data.lastReadAtP1 ?? data.last_read_at_p1);
      const lastReadP2Raw = toISOString(data.lastReadAt?.[fbUid2] ?? data.lastReadAtP2 ?? data.last_read_at_p2);

      // Map last_message_sender_id
      const lastMsgSender = data.lastMessageSenderId || data.last_message_sender_id;
      const lastMsgSenderId = lastMsgSender ? userIdMap.get(lastMsgSender) || null : null;

      rows.push({
        id: newId,
        participant1_id: uuid1,
        participant2_id: uuid2,
        last_message_text: data.lastMessage || data.lastMessageText || data.last_message_text || null,
        last_message_at: toISOString(data.lastMessageAt || data.last_message_at),
        last_message_type: data.lastMessageType || data.last_message_type || null,
        last_message_sender_id: lastMsgSenderId,
        unread_count_p1: swapped ? unreadP2Raw : unreadP1Raw,
        unread_count_p2: swapped ? unreadP1Raw : unreadP2Raw,
        deleted_at_p1: swapped ? deletedP2Raw : deletedP1Raw,
        deleted_at_p2: swapped ? deletedP1Raw : deletedP2Raw,
        last_read_at_p1: swapped ? lastReadP2Raw : lastReadP1Raw,
        last_read_at_p2: swapped ? lastReadP1Raw : lastReadP2Raw,
        created_at: toISOString(data.createdAt || data.created_at) || new Date().toISOString(),
      });
    } catch (err: unknown) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: doc.id, error: message });
      console.error(red(`  conversations: error on ${doc.id}: ${message}`));
    }
  }

  if (dryRun) {
    console.log(
      `conversations: ${green(`${rows.length} would be inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors} errors`)}`
    );
    colProgress.migratedCount = rows.length;
    colProgress.skippedCount = skipped;
    colProgress.errorCount = errors;
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  const result = await batchInsert(supabase, 'conversations', rows);

  for (const err of result.errors) {
    colProgress.errors.push({ docId: `row_${err.index}`, error: err.error });
  }

  colProgress.migratedCount = result.inserted;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = errors + result.errors.length;
  colProgress.status = 'complete';
  saveProgress(progress);

  console.log(
    `conversations: ${green(`${result.inserted} inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors + result.errors.length} errors`)}`
  );
}

// ---- 11. Messages (subcollection, sorted for reply_to_id self-refs) ----

async function migrateMessages(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'messages');
  if (colProgress.status === 'complete') {
    console.log(yellow('messages: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';

  console.log(cyan('messages: reading subcollections conversations/{convId}/messages...'));

  // Collect all messages from all conversations
  interface RawMessage {
    firestoreConvId: string;
    firestoreDocId: string;
    data: admin.firestore.DocumentData;
    createdAt: Date;
  }

  const allMessages: RawMessage[] = [];
  let readErrors = 0;

  for (const [firestoreConvId] of conversationIdMap.entries()) {
    try {
      const subcollection = await firestore
        .collection('conversations')
        .doc(firestoreConvId)
        .collection('messages')
        .get();

      if (subcollection.empty) continue;

      for (const doc of subcollection.docs) {
        const data = doc.data();
        const ts = data.createdAt || data.created_at;
        let createdAt: Date;
        if (ts && typeof ts.toDate === 'function') {
          createdAt = ts.toDate();
        } else if (ts instanceof Date) {
          createdAt = ts;
        } else if (typeof ts === 'string') {
          createdAt = new Date(ts);
        } else if (ts && typeof ts._seconds === 'number') {
          createdAt = new Date(ts._seconds * 1000);
        } else {
          createdAt = new Date();
        }

        allMessages.push({
          firestoreConvId,
          firestoreDocId: doc.id,
          data,
          createdAt,
        });
      }
    } catch (err: unknown) {
      readErrors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: `conv_${firestoreConvId}`, error: message });
      console.error(red(`  messages: error reading subcollection for conv ${firestoreConvId}: ${message}`));
    }
  }

  console.log(dim(`  messages: found ${allMessages.length} messages across ${conversationIdMap.size} conversations`));

  if (allMessages.length === 0) {
    console.log(yellow('messages: 0 docs found, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  // Sort ALL messages by created_at ascending so reply_to_id self-references resolve
  allMessages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const rows: any[] = [];
  let skipped = 0;
  let errors = readErrors;

  for (const msg of allMessages) {
    try {
      const { firestoreConvId, firestoreDocId, data } = msg;

      const convId = conversationIdMap.get(firestoreConvId);
      if (!convId) {
        skipped++;
        continue;
      }

      const senderId = data.senderId || data.sender_id;
      if (!senderId) {
        skipped++;
        continue;
      }

      const newId = generateUUID();
      messageIdMap.set(firestoreDocId, newId);

      const supabaseSenderId = mapUserId(senderId);

      // Map reply_to_id via messageIdMap (may be null if referenced message not yet inserted)
      let replyToId: string | null = null;
      const rawReplyTo = data.replyToId || data.reply_to_id;
      if (rawReplyTo) {
        replyToId = messageIdMap.get(rawReplyTo) || null;
        if (!replyToId) {
          console.log(dim(`  messages: reply_to_id ${rawReplyTo} not yet seen, setting null`));
        }
      }

      // Map tagged_photo_id via photoIdMap
      const rawTaggedPhoto = data.taggedPhotoId || data.tagged_photo_id;
      const taggedPhotoId = rawTaggedPhoto ? (photoIdMap.get(rawTaggedPhoto) || null) : null;

      // Rewrite snap storage path
      let snapStoragePath = data.snapStoragePath || data.snap_storage_path || null;
      if (snapStoragePath && senderId) {
        const senderUuid = userIdMap.get(senderId);
        if (senderUuid) {
          snapStoragePath = rewriteStoragePath(snapStoragePath, senderId, senderUuid);
        }
      }

      // Handle reply_preview JSONB — remap user IDs inside if present
      let replyPreview = data.replyPreview || data.reply_preview || null;
      if (replyPreview && typeof replyPreview === 'object') {
        if (replyPreview.senderId) {
          const mappedSender = userIdMap.get(replyPreview.senderId);
          if (mappedSender) {
            replyPreview = { ...replyPreview, senderId: mappedSender };
          }
        }
      }

      rows.push({
        id: newId,
        conversation_id: convId,
        sender_id: supabaseSenderId,
        type: data.type || 'text',
        text: data.text || null,
        gif_url: data.gifUrl || data.gif_url || null,
        reply_to_id: replyToId,
        snap_storage_path: snapStoragePath,
        snap_viewed_at: toISOString(data.snapViewedAt || data.snap_viewed_at),
        tagged_photo_id: taggedPhotoId,
        emoji: data.emoji || null,
        reply_preview: replyPreview,
        unsent_at: toISOString(data.unsentAt || data.unsent_at),
        created_at: msg.createdAt.toISOString(),
      });
    } catch (err: unknown) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: msg.firestoreDocId, error: message });
      console.error(red(`  messages: error on ${msg.firestoreDocId}: ${message}`));
    }
  }

  if (dryRun) {
    console.log(
      `messages: ${green(`${rows.length} would be inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors} errors`)}`
    );
    colProgress.migratedCount = rows.length;
    colProgress.skippedCount = skipped;
    colProgress.errorCount = errors;
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  const result = await batchInsert(supabase, 'messages', rows);

  for (const err of result.errors) {
    colProgress.errors.push({ docId: `row_${err.index}`, error: err.error });
  }

  colProgress.migratedCount = result.inserted;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = errors + result.errors.length;
  colProgress.status = 'complete';
  saveProgress(progress);

  console.log(
    `messages: ${green(`${result.inserted} inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors + result.errors.length} errors`)}`
  );
}

// ---- 12. Message Deletions ----

async function migrateMessageDeletions(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'message_deletions');
  if (colProgress.status === 'complete') {
    console.log(yellow('message_deletions: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';

  // Try top-level collection first
  let snapshot: admin.firestore.QuerySnapshot;
  try {
    snapshot = await firestore.collection('message_deletions').get();
  } catch {
    // Collection may not exist
    snapshot = { empty: true, size: 0, docs: [] } as any;
  }

  if (snapshot.empty) {
    // Also try camelCase variant
    try {
      snapshot = await firestore.collection('messageDeletions').get();
    } catch {
      snapshot = { empty: true, size: 0, docs: [] } as any;
    }
  }

  if (snapshot.empty) {
    console.log(yellow('message_deletions: 0 docs found, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  console.log(cyan(`message_deletions: ${snapshot.size} docs found`));

  const rows: any[] = [];
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      const rawMsgId = data.messageId || data.message_id;
      const rawUserId = data.userId || data.user_id;

      if (!rawMsgId || !rawUserId) {
        skipped++;
        continue;
      }

      const messageId = messageIdMap.get(rawMsgId);
      if (!messageId) {
        skipped++;
        continue;
      }

      rows.push({
        id: generateUUID(),
        message_id: messageId,
        user_id: mapUserId(rawUserId),
        created_at: toISOString(data.createdAt || data.created_at) || new Date().toISOString(),
      });
    } catch (err: unknown) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: doc.id, error: message });
    }
  }

  if (dryRun) {
    console.log(
      `message_deletions: ${green(`${rows.length} would be inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors} errors`)}`
    );
    colProgress.migratedCount = rows.length;
    colProgress.skippedCount = skipped;
    colProgress.errorCount = errors;
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  const result = await batchInsert(supabase, 'message_deletions', rows);

  for (const err of result.errors) {
    colProgress.errors.push({ docId: `row_${err.index}`, error: err.error });
  }

  colProgress.migratedCount = result.inserted;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = errors + result.errors.length;
  colProgress.status = 'complete';
  saveProgress(progress);

  console.log(
    `message_deletions: ${green(`${result.inserted} inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors + result.errors.length} errors`)}`
  );
}

// ---- 13. Streaks ----

async function migrateStreaks(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'streaks');
  if (colProgress.status === 'complete') {
    console.log(yellow('streaks: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';
  const snapshot = await firestore.collection('streaks').get();

  if (snapshot.empty) {
    console.log(yellow('streaks: 0 docs found, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  console.log(cyan(`streaks: ${snapshot.size} docs found`));

  const rows: any[] = [];
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      let fbUid1 = data.user1Id || data.userId1 || data.user1_id;
      let fbUid2 = data.user2Id || data.userId2 || data.user2_id;

      // Fallback: extract from participants array (Firestore format)
      if ((!fbUid1 || !fbUid2) && Array.isArray(data.participants) && data.participants.length >= 2) {
        fbUid1 = data.participants[0];
        fbUid2 = data.participants[1];
      }

      if (!fbUid1 || !fbUid2) {
        skipped++;
        console.log(yellow(`  streaks: skipping ${doc.id} (missing user IDs)`));
        continue;
      }

      let uuid1 = mapUserId(fbUid1);
      let uuid2 = mapUserId(fbUid2);

      // Track original order to assign per-user fields correctly
      const origFirst = uuid1;

      // Enforce CHECK constraint: user1_id < user2_id
      if (uuid1 > uuid2) {
        const tmp = uuid1;
        uuid1 = uuid2;
        uuid2 = tmp;
      }

      const swapped = origFirst !== uuid1;

      // Per-user snap timestamps
      const snapAt1Raw = toISOString(data.lastSnapAtUser1 || data.last_snap_at_user1 || data.lastSnapAt?.[fbUid1] || data.lastSnapBy?.[fbUid1]);
      const snapAt2Raw = toISOString(data.lastSnapAtUser2 || data.last_snap_at_user2 || data.lastSnapAt?.[fbUid2] || data.lastSnapBy?.[fbUid2]);

      rows.push({
        id: generateUUID(),
        user1_id: uuid1,
        user2_id: uuid2,
        day_count: data.dayCount ?? data.day_count ?? 0,
        last_snap_at_user1: swapped ? snapAt2Raw : snapAt1Raw,
        last_snap_at_user2: swapped ? snapAt1Raw : snapAt2Raw,
        last_mutual_at: toISOString(data.lastMutualAt || data.last_mutual_at),
        expires_at: toISOString(data.expiresAt || data.expires_at),
        warning_sent: data.warningSent ?? data.warning ?? data.warning_sent ?? false,
        created_at: toISOString(data.createdAt || data.created_at) || new Date().toISOString(),
      });
    } catch (err: unknown) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: doc.id, error: message });
      console.error(red(`  streaks: error on ${doc.id}: ${message}`));
    }
  }

  if (dryRun) {
    console.log(
      `streaks: ${green(`${rows.length} would be inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors} errors`)}`
    );
    colProgress.migratedCount = rows.length;
    colProgress.skippedCount = skipped;
    colProgress.errorCount = errors;
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  const result = await batchInsert(supabase, 'streaks', rows);

  for (const err of result.errors) {
    colProgress.errors.push({ docId: `row_${err.index}`, error: err.error });
  }

  colProgress.migratedCount = result.inserted;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = errors + result.errors.length;
  colProgress.status = 'complete';
  saveProgress(progress);

  console.log(
    `streaks: ${green(`${result.inserted} inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors + result.errors.length} errors`)}`
  );
}

// ---- 14. Comments (subcollection, sorted for parent_id self-refs) ----

async function migrateComments(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'comments');
  if (colProgress.status === 'complete') {
    console.log(yellow('comments: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';

  console.log(cyan('comments: reading subcollections photos/{photoId}/comments...'));

  interface RawComment {
    firestorePhotoId: string;
    firestoreDocId: string;
    data: admin.firestore.DocumentData;
    createdAt: Date;
  }

  const allComments: RawComment[] = [];
  let readErrors = 0;

  for (const [firestorePhotoId] of photoIdMap.entries()) {
    try {
      const subcollection = await firestore
        .collection('photos')
        .doc(firestorePhotoId)
        .collection('comments')
        .get();

      if (subcollection.empty) continue;

      for (const doc of subcollection.docs) {
        const data = doc.data();
        const ts = data.createdAt || data.created_at;
        let createdAt: Date;
        if (ts && typeof ts.toDate === 'function') {
          createdAt = ts.toDate();
        } else if (ts instanceof Date) {
          createdAt = ts;
        } else if (typeof ts === 'string') {
          createdAt = new Date(ts);
        } else if (ts && typeof ts._seconds === 'number') {
          createdAt = new Date(ts._seconds * 1000);
        } else {
          createdAt = new Date();
        }

        allComments.push({
          firestorePhotoId,
          firestoreDocId: doc.id,
          data,
          createdAt,
        });
      }
    } catch (err: unknown) {
      readErrors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: `photo_${firestorePhotoId}`, error: message });
      console.error(red(`  comments: error reading subcollection for photo ${firestorePhotoId}: ${message}`));
    }
  }

  console.log(dim(`  comments: found ${allComments.length} comments across ${photoIdMap.size} photos`));

  if (allComments.length === 0) {
    console.log(yellow('comments: 0 docs found, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  // Sort by created_at ascending so parent_id self-references resolve
  allComments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Also collect comment likes for later migration
  interface QueuedCommentLike {
    firestoreCommentId: string;
    firestorePhotoId: string;
  }
  const commentLikeQueue: QueuedCommentLike[] = [];

  const rows: any[] = [];
  let skipped = 0;
  let errors = readErrors;

  for (const comment of allComments) {
    try {
      const { firestorePhotoId, firestoreDocId, data } = comment;

      const photoId = photoIdMap.get(firestorePhotoId);
      if (!photoId) {
        skipped++;
        continue;
      }

      const rawUserId = data.userId || data.user_id;
      if (!rawUserId) {
        skipped++;
        continue;
      }

      const newId = generateUUID();
      commentIdMap.set(firestoreDocId, newId);

      // Queue for comment_likes subcollection reading
      commentLikeQueue.push({ firestoreCommentId: firestoreDocId, firestorePhotoId });

      // Map parent_id via commentIdMap (null if parent not yet seen)
      let parentId: string | null = null;
      const rawParent = data.parentId || data.parent_id;
      if (rawParent) {
        parentId = commentIdMap.get(rawParent) || null;
      }

      // Map mentions: convert Firebase UIDs array to Supabase UUIDs
      let mentions: string[] = [];
      const rawMentions = data.mentions;
      if (Array.isArray(rawMentions)) {
        for (const uid of rawMentions) {
          const mapped = userIdMap.get(uid);
          if (mapped) mentions.push(mapped);
        }
      }

      rows.push({
        id: newId,
        photo_id: photoId,
        user_id: mapUserId(rawUserId),
        parent_id: parentId,
        text: data.text || '',
        mentions,
        created_at: comment.createdAt.toISOString(),
      });
    } catch (err: unknown) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: comment.firestoreDocId, error: message });
      console.error(red(`  comments: error on ${comment.firestoreDocId}: ${message}`));
    }
  }

  // Store comment like queue on module scope for the comment_likes migrator
  (global as any).__commentLikeQueue = commentLikeQueue;

  if (dryRun) {
    console.log(
      `comments: ${green(`${rows.length} would be inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors} errors`)}`
    );
    colProgress.migratedCount = rows.length;
    colProgress.skippedCount = skipped;
    colProgress.errorCount = errors;
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  const result = await batchInsert(supabase, 'comments', rows);

  for (const err of result.errors) {
    colProgress.errors.push({ docId: `row_${err.index}`, error: err.error });
  }

  colProgress.migratedCount = result.inserted;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = errors + result.errors.length;
  colProgress.status = 'complete';
  saveProgress(progress);

  console.log(
    `comments: ${green(`${result.inserted} inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors + result.errors.length} errors`)}`
  );
}

// ---- 15. Comment Likes (nested subcollection) ----

async function migrateCommentLikes(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'comment_likes');
  if (colProgress.status === 'complete') {
    console.log(yellow('comment_likes: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';

  // Get comment like queue from comments migration
  const commentLikeQueue: Array<{ firestoreCommentId: string; firestorePhotoId: string }> =
    (global as any).__commentLikeQueue || [];

  if (commentLikeQueue.length === 0) {
    console.log(yellow('comment_likes: no comments to check for likes, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  console.log(cyan(`comment_likes: checking ${commentLikeQueue.length} comments for likes subcollections...`));

  const rows: any[] = [];
  let skipped = 0;
  let errors = 0;
  let totalLikes = 0;

  for (const { firestoreCommentId, firestorePhotoId } of commentLikeQueue) {
    try {
      const subcollection = await firestore
        .collection('photos')
        .doc(firestorePhotoId)
        .collection('comments')
        .doc(firestoreCommentId)
        .collection('likes')
        .get();

      if (subcollection.empty) continue;

      totalLikes += subcollection.size;

      for (const doc of subcollection.docs) {
        try {
          const commentId = commentIdMap.get(firestoreCommentId);
          if (!commentId) {
            skipped++;
            continue;
          }

          // Like doc ID is typically the userId, or userId is in the data
          const data = doc.data();
          const rawUserId = data.userId || data.user_id || doc.id;

          const userId = userIdMap.get(rawUserId);
          if (!userId) {
            skipped++;
            continue;
          }

          rows.push({
            comment_id: commentId,
            user_id: userId,
            created_at: toISOString(data.createdAt || data.created_at) || new Date().toISOString(),
          });
        } catch (err: unknown) {
          errors++;
          const message = err instanceof Error ? err.message : String(err);
          colProgress.errors.push({ docId: doc.id, error: message });
        }
      }
    } catch (err: unknown) {
      // Subcollection may not exist for this comment
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: `comment_${firestoreCommentId}`, error: message });
    }
  }

  console.log(dim(`  comment_likes: found ${totalLikes} likes across ${commentLikeQueue.length} comments`));

  if (rows.length === 0 && totalLikes === 0) {
    console.log(yellow('comment_likes: 0 likes found, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  if (dryRun) {
    console.log(
      `comment_likes: ${green(`${rows.length} would be inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors} errors`)}`
    );
    colProgress.migratedCount = rows.length;
    colProgress.skippedCount = skipped;
    colProgress.errorCount = errors;
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  const result = await batchInsert(supabase, 'comment_likes', rows);

  for (const err of result.errors) {
    colProgress.errors.push({ docId: `row_${err.index}`, error: err.error });
  }

  colProgress.migratedCount = result.inserted;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = errors + result.errors.length;
  colProgress.status = 'complete';
  saveProgress(progress);

  console.log(
    `comment_likes: ${green(`${result.inserted} inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors + result.errors.length} errors`)}`
  );
}

// ---- 16. Albums ----

async function migrateAlbums(
  firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'albums');
  if (colProgress.status === 'complete') {
    console.log(yellow('albums: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';
  const snapshot = await firestore.collection('albums').get();

  if (snapshot.empty) {
    console.log(yellow('albums: 0 docs found, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  console.log(cyan(`albums: ${snapshot.size} docs found`));

  const rows: any[] = [];
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const newId = generateUUID();
      albumIdMap.set(doc.id, newId);

      const rawUserId = data.userId || data.user_id;
      if (!rawUserId) {
        skipped++;
        console.log(yellow(`  albums: skipping ${doc.id} (no userId)`));
        continue;
      }

      // Map cover photo ID
      const rawCoverPhotoId = data.coverPhotoId || data.cover_photo_id;
      const coverPhotoId = rawCoverPhotoId ? (photoIdMap.get(rawCoverPhotoId) || null) : null;

      // Queue album_photos for junction table
      const photoIds = data.photoIds || data.photo_ids || [];
      if (Array.isArray(photoIds)) {
        for (const firestorePhotoId of photoIds) {
          queuedAlbumPhotos.push({
            firestoreAlbumId: doc.id,
            firestorePhotoId,
          });
        }
      }

      rows.push({
        id: newId,
        user_id: mapUserId(rawUserId),
        title: data.title || 'Untitled',
        type: data.type || 'custom',
        month_key: data.monthKey || data.month_key || null,
        cover_photo_id: coverPhotoId,
        created_at: toISOString(data.createdAt || data.created_at) || new Date().toISOString(),
      });
    } catch (err: unknown) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      colProgress.errors.push({ docId: doc.id, error: message });
      console.error(red(`  albums: error on ${doc.id}: ${message}`));
    }
  }

  if (dryRun) {
    console.log(
      `albums: ${green(`${rows.length} would be inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors} errors`)}`
    );
    console.log(dim(`  Queued ${queuedAlbumPhotos.length} album_photos entries`));
    colProgress.migratedCount = rows.length;
    colProgress.skippedCount = skipped;
    colProgress.errorCount = errors;
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  const result = await batchInsert(supabase, 'albums', rows);

  for (const err of result.errors) {
    colProgress.errors.push({ docId: `row_${err.index}`, error: err.error });
  }

  colProgress.migratedCount = result.inserted;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = errors + result.errors.length;
  colProgress.status = 'complete';
  saveProgress(progress);

  console.log(
    `albums: ${green(`${result.inserted} inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${errors + result.errors.length} errors`)}`
  );
  console.log(dim(`  Queued ${queuedAlbumPhotos.length} album_photos entries`));
}

// ---- 17. Album Photos (junction table from inline data) ----

async function migrateAlbumPhotos(
  _firestore: admin.firestore.Firestore,
  supabase: SupabaseClient,
  progress: MigrationProgress,
  dryRun: boolean
): Promise<void> {
  const colProgress = getCollectionProgress(progress, 'album_photos');
  if (colProgress.status === 'complete') {
    console.log(yellow('album_photos: already complete, skipping'));
    return;
  }

  colProgress.status = 'in_progress';

  if (queuedAlbumPhotos.length === 0) {
    console.log(yellow('album_photos: 0 queued entries, skipping'));
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  console.log(cyan(`album_photos: ${queuedAlbumPhotos.length} queued from albums migration`));

  const rows: any[] = [];
  let skipped = 0;

  for (const entry of queuedAlbumPhotos) {
    const albumId = albumIdMap.get(entry.firestoreAlbumId);
    const photoId = photoIdMap.get(entry.firestorePhotoId);

    if (!albumId || !photoId) {
      skipped++;
      continue;
    }

    rows.push({
      album_id: albumId,
      photo_id: photoId,
    });
  }

  if (dryRun) {
    console.log(
      `album_photos: ${green(`${rows.length} would be inserted`)}, ${yellow(`${skipped} skipped`)}`
    );
    colProgress.migratedCount = rows.length;
    colProgress.skippedCount = skipped;
    colProgress.errorCount = 0;
    colProgress.status = 'complete';
    saveProgress(progress);
    return;
  }

  const result = await batchInsert(supabase, 'album_photos', rows);

  for (const err of result.errors) {
    colProgress.errors.push({ docId: `row_${err.index}`, error: err.error });
  }

  colProgress.migratedCount = result.inserted;
  colProgress.skippedCount = skipped;
  colProgress.errorCount = result.errors.length;
  colProgress.status = 'complete';
  saveProgress(progress);

  console.log(
    `album_photos: ${green(`${result.inserted} inserted`)}, ${yellow(`${skipped} skipped`)}, ${red(`${result.errors.length} errors`)}`
  );
}

// ---------------------------------------------------------------------------
// Collection registry (FK dependency order)
// ---------------------------------------------------------------------------

const COLLECTIONS: Array<{ name: string; migrator: Migrator }> = [
  { name: 'users', migrator: migrateUsers },
  { name: 'photos', migrator: migratePhotos },
  { name: 'photo_reactions', migrator: migratePhotoReactions },
  { name: 'photo_tags', migrator: migratePhotoTags },
  { name: 'viewed_photos', migrator: migrateViewedPhotos },
  { name: 'friendships', migrator: migrateFriendships },
  { name: 'blocks', migrator: migrateBlocks },
  { name: 'reports', migrator: migrateReports },
  { name: 'support_requests', migrator: migrateSupportRequests },
  { name: 'conversations', migrator: migrateConversations },
  { name: 'messages', migrator: migrateMessages },
  { name: 'message_deletions', migrator: migrateMessageDeletions },
  { name: 'streaks', migrator: migrateStreaks },
  { name: 'comments', migrator: migrateComments },
  { name: 'comment_likes', migrator: migrateCommentLikes },
  { name: 'albums', migrator: migrateAlbums },
  { name: 'album_photos', migrator: migrateAlbumPhotos },
];

// ---------------------------------------------------------------------------
// Summary table
// ---------------------------------------------------------------------------

function printSummary(progress: MigrationProgress, dryRun: boolean): void {
  console.log('\n' + bold('='.repeat(70)));
  console.log(bold(dryRun ? '  DRY RUN SUMMARY' : '  MIGRATION SUMMARY'));
  console.log(bold('='.repeat(70)));

  // Table header
  console.log(
    '  ' +
    'Collection'.padEnd(22) +
    'Status'.padEnd(14) +
    'Migrated'.padEnd(12) +
    'Skipped'.padEnd(12) +
    'Errors'.padEnd(10)
  );
  console.log('  ' + '-'.repeat(66));

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const { name } of COLLECTIONS) {
    const col = progress.collections[name];
    if (!col) {
      console.log(`  ${name.padEnd(22)}${dim('not run'.padEnd(14))}${'0'.padEnd(12)}${'0'.padEnd(12)}${'0'.padEnd(10)}`);
      continue;
    }

    const statusStr =
      col.status === 'complete' ? green(col.status.padEnd(14)) :
      col.status === 'error' ? red(col.status.padEnd(14)) :
      yellow(col.status.padEnd(14));

    const migratedStr = col.migratedCount > 0
      ? green(String(col.migratedCount).padEnd(12))
      : String(col.migratedCount).padEnd(12);

    const skippedStr = col.skippedCount > 0
      ? yellow(String(col.skippedCount).padEnd(12))
      : String(col.skippedCount).padEnd(12);

    const errorStr = col.errorCount > 0
      ? red(String(col.errorCount).padEnd(10))
      : String(col.errorCount).padEnd(10);

    console.log(`  ${name.padEnd(22)}${statusStr}${migratedStr}${skippedStr}${errorStr}`);

    totalMigrated += col.migratedCount;
    totalSkipped += col.skippedCount;
    totalErrors += col.errorCount;
  }

  console.log('  ' + '-'.repeat(66));
  console.log(
    `  ${'TOTAL'.padEnd(22)}${''.padEnd(14)}${green(String(totalMigrated).padEnd(12))}${yellow(String(totalSkipped).padEnd(12))}${red(String(totalErrors).padEnd(10))}`
  );
  console.log(bold('='.repeat(70)));

  // Print errors summary
  if (totalErrors > 0) {
    console.log(red('\nErrors encountered:'));
    for (const { name } of COLLECTIONS) {
      const col = progress.collections[name];
      if (!col || col.errors.length === 0) continue;
      console.log(`  ${bold(name)}:`);
      for (const err of col.errors.slice(0, 10)) {
        console.log(red(`    ${err.docId}: ${err.error}`));
      }
      if (col.errors.length > 10) {
        console.log(dim(`    ... and ${col.errors.length - 10} more`));
      }
    }
  }

  console.log(`\nProgress file: ${PROGRESS_FILE}`);
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

  console.log(bold('\n=== Firestore -> Supabase Data Migration ===\n'));

  if (args.dryRun) {
    console.log(yellow('DRY RUN MODE: No data will be written to Supabase\n'));
  }

  console.log(dim(`Environment: ${args.env}`));
  if (args.collection) {
    console.log(dim(`Single collection: ${args.collection}`));
  }

  // Load environment
  loadEnv(args.env);

  // Initialize clients
  const firestore = initFirebase();
  const supabase = initSupabase();

  // Build user ID map
  await buildUserIdMap(supabase);

  if (userIdMap.size === 0) {
    console.error(red('\nNo users found with firebase_uid mapping.'));
    console.error(red('Has the auth migration (migrate-firebase-auth Edge Function) been run?'));
    console.error(red('Aborting migration.'));
    process.exit(1);
  }

  // Load progress
  const progress = loadProgress();

  console.log('');

  // Determine which collections to run
  const collectionsToRun = args.collection
    ? COLLECTIONS.filter((c) => c.name === args.collection)
    : COLLECTIONS;

  if (args.collection && collectionsToRun.length === 0) {
    console.error(red(`Unknown collection: ${args.collection}`));
    console.error(`Available: ${COLLECTIONS.map((c) => c.name).join(', ')}`);
    process.exit(1);
  }

  // Execute in FK dependency order
  for (const { name, migrator } of collectionsToRun) {
    const startTime = Date.now();
    console.log(bold(`\n--- ${name} ---`));

    await migrator(firestore, supabase, progress, args.dryRun);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(dim(`  Completed in ${elapsed}s`));
  }

  // Print summary
  printSummary(progress, args.dryRun);

  // Exit code based on errors
  const totalErrors = Object.values(progress.collections).reduce(
    (sum, col) => sum + col.errorCount,
    0
  );

  if (totalErrors > 0) {
    console.log(yellow(`\nCompleted with ${totalErrors} errors. Re-run to retry.`));
    process.exit(1);
  } else {
    console.log(green('\nAll collections migrated successfully!'));
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(red('Migration failed with error:'), err);
  process.exit(2);
});
