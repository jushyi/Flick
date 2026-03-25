/**
 * Edge Function: send-push-notification
 *
 * Central push notification dispatcher for all Flick notification types.
 * Called by pg_cron jobs, database triggers (via pg_net), and other Edge Functions.
 *
 * Request body:
 *   { type: string, user_id: string, data?: object }
 *
 * Authorization: service_role key in Authorization header (Bearer token).
 *
 * Environment variables (auto-available in Supabase Edge Functions):
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - EXPO_ACCESS_TOKEN (optional, set via `supabase secrets set`)
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  buildNotification,
  type NotificationContent,
} from '../_shared/notification-templates.ts';
import {
  sendExpoPush,
  isValidExpoPushToken,
  type ExpoPushTicket,
} from '../_shared/expo-push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

/** Create a JSON response with CORS headers. */
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
    // 1. Validate Authorization (must be service_role key)
    // ========================================================================
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    // ========================================================================
    // 2. Parse request body
    // ========================================================================
    const {
      type,
      user_id,
      data = {},
    } = (await req.json()) as {
      type: string;
      user_id: string;
      data?: Record<string, unknown>;
    };

    if (!type || !user_id) {
      return jsonResponse(
        { success: false, error: 'Missing required fields: type, user_id' },
        400
      );
    }

    // ========================================================================
    // 3. Initialize Supabase client (service_role for full access)
    // ========================================================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ========================================================================
    // 4. Look up target user
    // ========================================================================
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select(
        'push_token, push_to_start_token, display_name, notification_preferences'
      )
      .eq('id', user_id)
      .single();

    if (userError || !targetUser) {
      return jsonResponse(
        { success: false, error: 'User not found' },
        404
      );
    }

    // ========================================================================
    // 5. Check notification preferences (master toggle)
    // ========================================================================
    const prefs =
      (targetUser.notification_preferences as Record<string, unknown>) ?? {};
    if (prefs.enabled === false) {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: 'Notifications disabled by user',
      });
    }

    // ========================================================================
    // 6. Resolve sender name (if source_user_id provided)
    // ========================================================================
    let senderName: string | undefined = data.senderName as string | undefined;

    if (!senderName && data.source_user_id) {
      const { data: senderUser } = await supabase
        .from('users')
        .select('display_name, username')
        .eq('id', data.source_user_id as string)
        .single();

      if (senderUser) {
        senderName =
          senderUser.display_name || senderUser.username || 'Someone';
      }
    }

    // ========================================================================
    // 7. Build notification content from templates
    // ========================================================================
    const notification: NotificationContent = buildNotification(type, {
      senderName,
      ...data,
    });

    // ========================================================================
    // 8. Send push notification via Expo API
    // ========================================================================
    const pushToken = targetUser.push_token as string | null;
    let ticket: ExpoPushTicket | null = null;

    if (pushToken && isValidExpoPushToken(pushToken)) {
      ticket = await sendExpoPush({
        to: pushToken,
        title: notification.title,
        body: notification.body,
        sound: 'default',
        priority: 'high',
        channelId: (data.channelId as string) || 'default',
        data: {
          type,
          ...data,
        },
      });

      // ====================================================================
      // 9. Store push receipt for later checking
      // ====================================================================
      if (ticket.status === 'ok' && ticket.id) {
        await supabase.from('push_receipts').insert({
          ticket_id: ticket.id,
          user_id,
          push_token: pushToken,
        });
      }

      if (ticket.status === 'error') {
        console.error('Push send failed:', {
          user_id,
          type,
          error: ticket.message,
          details: ticket.details,
        });
      }
    } else {
      console.log('No valid push token for user:', user_id);
    }

    // ========================================================================
    // 10. For pinned_snap: also trigger Live Activity via send-live-activity
    // ========================================================================
    if (type === 'pinned_snap' && targetUser.push_to_start_token) {
      try {
        const liveActivityUrl = `${supabaseUrl}/functions/v1/send-live-activity`;
        await fetch(liveActivityUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            type: 'pinned_snap',
            user_id,
            push_to_start_token: targetUser.push_to_start_token,
            data,
          }),
        });
      } catch (liveActivityError) {
        // Non-fatal: Live Activity is best-effort
        console.error(
          'Failed to trigger send-live-activity:',
          liveActivityError
        );
      }
    }

    // ========================================================================
    // 11. Return result
    // ========================================================================
    return jsonResponse({
      success: true,
      ticket_id: ticket?.id ?? null,
    });
  } catch (error) {
    console.error('send-push-notification error:', error);
    return jsonResponse(
      { success: false, error: (error as Error).message },
      500
    );
  }
});
