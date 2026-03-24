/**
 * Edge Function: snap-cleanup
 *
 * Deletes a snap photo file from Supabase Storage after it has been viewed.
 * Called by the handle_snap_viewed PostgreSQL trigger via pg_net.
 *
 * Request body: { storage_path: string }
 * - storage_path: the path within the 'snaps' bucket to delete
 *
 * Environment variables (auto-available in Edge Functions):
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req: Request) => {
  // Validate Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { storage_path } = await req.json();

    // Validate storage_path
    if (!storage_path || typeof storage_path !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or empty storage_path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Delete the snap file from storage
    const { error } = await supabase.storage.from('snaps').remove([storage_path]);

    if (error) {
      console.error('Snap cleanup failed:', error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ deleted: storage_path }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Snap cleanup failed:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
