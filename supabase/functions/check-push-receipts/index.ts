/**
 * Edge Function: check-push-receipts
 *
 * Called every 5 minutes by pg_cron to check Expo push receipt statuses.
 * Processes the push_receipts table:
 *   - 'ok' receipts: delete the row (delivery confirmed)
 *   - 'DeviceNotRegistered' errors: NULL out push_token on users table, delete row
 *   - Other errors: log and delete row
 *
 * This replaces the Firebase Cloud Function checkPushReceipts.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkExpoPushReceipts } from '../_shared/expo-push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ========================================================================
    // 1. Validate Authorization header
    // ========================================================================
    const authHeader = req.headers.get('Authorization');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!authHeader || !authHeader.includes(supabaseServiceKey)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // ========================================================================
    // 2. Create Supabase admin client
    // ========================================================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========================================================================
    // 3. Query push_receipts older than 1 minute (give Expo time to process)
    // ========================================================================
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    const { data: receipts, error: fetchError } = await supabase
      .from('push_receipts')
      .select('id, ticket_id, user_id, push_token')
      .lt('created_at', oneMinuteAgo)
      .limit(1000);

    if (fetchError) {
      console.error('Failed to fetch push_receipts:', fetchError);
      return jsonResponse({ error: 'Failed to fetch receipts' }, 500);
    }

    if (!receipts || receipts.length === 0) {
      return jsonResponse({ checked: 0, invalidated: 0 });
    }

    // ========================================================================
    // 4. Check receipts with Expo API (chunks of 1000)
    // ========================================================================
    const ticketIds = receipts.map((r) => r.ticket_id);
    const receiptResults = await checkExpoPushReceipts(ticketIds);

    // ========================================================================
    // 5. Process each receipt
    // ========================================================================
    let invalidatedCount = 0;
    const idsToDelete: string[] = [];

    for (const receipt of receipts) {
      const result = receiptResults[receipt.ticket_id];

      if (!result) {
        // Receipt not yet available from Expo -- skip, will be picked up next run
        continue;
      }

      if (result.status === 'ok') {
        // Delivery confirmed -- mark for deletion
        idsToDelete.push(receipt.id);
      } else if (result.status === 'error') {
        if (result.details?.error === 'DeviceNotRegistered') {
          // Token is invalid -- NULL out push_token on users table
          const { error: updateError } = await supabase
            .from('users')
            .update({ push_token: null })
            .eq('id', receipt.user_id);

          if (updateError) {
            console.error(
              `Failed to invalidate push_token for user ${receipt.user_id}:`,
              updateError
            );
          } else {
            invalidatedCount++;
          }

          idsToDelete.push(receipt.id);
        } else {
          // Other error -- log and delete
          console.error(
            `Push receipt error for ticket ${receipt.ticket_id}:`,
            result.message,
            result.details
          );
          idsToDelete.push(receipt.id);
        }
      }
    }

    // ========================================================================
    // 6. Delete processed push_receipt rows in batch
    // ========================================================================
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('push_receipts')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error('Failed to delete processed push_receipts:', deleteError);
      }
    }

    // ========================================================================
    // 7. Return summary
    // ========================================================================
    return jsonResponse({
      checked: idsToDelete.length,
      invalidated: invalidatedCount,
    });
  } catch (error) {
    console.error('check-push-receipts error:', error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
