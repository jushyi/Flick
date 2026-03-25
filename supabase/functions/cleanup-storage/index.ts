/**
 * Edge Function: cleanup-storage
 *
 * Handles storage file deletion and auth user removal. Called by pg_cron jobs
 * via pg_net for operations that require the Supabase SDK (storage deletion,
 * auth user deletion -- cannot be done in SQL alone).
 *
 * Two operation types:
 * 1. expired_snaps: Delete snap files from storage after viewing + 24h expiry
 * 2. user_deletion: Delete all user storage files + remove Supabase Auth account
 *
 * Environment variables (auto-available in Edge Functions):
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Create a JSON response with CORS headers
 */
function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Parse bucket name from a storage path.
 * Paths are expected to be in the format: "bucket/path/to/file"
 * e.g. "photos/user123/abc.webp" -> bucket "photos", path "user123/abc.webp"
 */
function parseBucketAndPath(fullPath: string): { bucket: string; path: string } | null {
  const firstSlash = fullPath.indexOf('/');
  if (firstSlash === -1) return null;

  const bucket = fullPath.substring(0, firstSlash);
  const path = fullPath.substring(firstSlash + 1);

  if (!bucket || !path) return null;
  return { bucket, path };
}

/**
 * Group an array of storage paths by their bucket name.
 * Returns a map of bucket -> paths[].
 */
function groupPathsByBucket(paths: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const fullPath of paths) {
    const parsed = parseBucketAndPath(fullPath);
    if (!parsed) {
      console.log(`Skipping invalid storage path: ${fullPath}`);
      continue;
    }

    const existing = groups.get(parsed.bucket) || [];
    existing.push(parsed.path);
    groups.set(parsed.bucket, existing);
  }

  return groups;
}

/**
 * Delete files from storage, grouped by bucket.
 * Returns the total count of successfully deleted files.
 */
async function deleteStorageFiles(
  supabase: ReturnType<typeof createClient>,
  paths: string[]
): Promise<number> {
  const grouped = groupPathsByBucket(paths);
  let totalDeleted = 0;

  for (const [bucket, bucketPaths] of grouped) {
    try {
      const { data, error } = await supabase.storage.from(bucket).remove(bucketPaths);

      if (error) {
        console.log(`Error deleting from bucket "${bucket}": ${error.message}`);
        // Continue with other buckets -- files may already be deleted
      } else {
        const count = data?.length ?? 0;
        totalDeleted += count;
        console.log(`Deleted ${count} files from bucket "${bucket}"`);
      }
    } catch (err) {
      console.log(`Exception deleting from bucket "${bucket}": ${(err as Error).message}`);
      // Continue with other buckets
    }
  }

  return totalDeleted;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate Authorization header
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    // Parse request body
    const body = await req.json();
    const { type } = body;

    if (!type) {
      return jsonResponse({ success: false, error: 'Missing "type" field' }, 400);
    }

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ========================================================================
    // Type 1: expired_snaps -- Delete snap files from storage
    // ========================================================================
    if (type === 'expired_snaps') {
      const paths: string[] = body.paths;

      if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return jsonResponse({ success: true, files_deleted: 0, message: 'No paths provided' });
      }

      console.log(`Processing expired_snaps cleanup: ${paths.length} files`);

      const filesDeleted = await deleteStorageFiles(supabase, paths);

      console.log(`Expired snaps cleanup complete: ${filesDeleted} files deleted`);

      return jsonResponse({
        success: true,
        files_deleted: filesDeleted,
      });
    }

    // ========================================================================
    // Type 2: user_deletion -- Delete user storage files + auth account
    // ========================================================================
    if (type === 'user_deletion') {
      const userId: string = body.user_id;
      const paths: string[] = body.paths || [];

      if (!userId) {
        return jsonResponse({ success: false, error: 'Missing "user_id" for user_deletion' }, 400);
      }

      console.log(`Processing user_deletion for user ${userId}: ${paths.length} storage paths`);

      // Delete storage files (if any)
      let filesDeleted = 0;
      if (Array.isArray(paths) && paths.length > 0) {
        filesDeleted = await deleteStorageFiles(supabase, paths);
        console.log(`Deleted ${filesDeleted} storage files for user ${userId}`);
      }

      // Delete the Supabase Auth user
      let authDeleted = false;
      try {
        const { error: authError } = await supabase.auth.admin.deleteUser(userId);
        if (authError) {
          console.log(`Error deleting auth user ${userId}: ${authError.message}`);
          // Non-fatal -- user may not exist in auth (e.g. never migrated)
        } else {
          authDeleted = true;
          console.log(`Auth user ${userId} deleted`);
        }
      } catch (err) {
        console.log(`Exception deleting auth user ${userId}: ${(err as Error).message}`);
      }

      return jsonResponse({
        success: true,
        files_deleted: filesDeleted,
        auth_deleted: authDeleted,
      });
    }

    // Unknown type
    return jsonResponse({ success: false, error: `Unknown type: ${type}` }, 400);
  } catch (error) {
    console.error('cleanup-storage error:', error);
    return jsonResponse({ success: false, error: (error as Error).message }, 500);
  }
});
