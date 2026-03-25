/**
 * Edge Function: send-live-activity
 *
 * Sends APNS HTTP/2 push notifications for Live Activity (push-to-start).
 * Ported from functions/notifications/liveActivitySender.js.
 *
 * Uses ES256 JWT signing with Apple's .p8 auth key, and HTTP/2 via node:http2.
 * Implements dual-environment fallback: tries production APNS first, retries
 * with sandbox on BadDeviceToken (matches dev/prod build token differences).
 *
 * Request body:
 *   { user_id: string, action: 'start' | 'update' | 'end', content_state: object, stale_date?: number }
 *
 * Authorization: service_role key in Authorization header (Bearer token).
 *
 * Environment variables (set via `supabase secrets set`):
 * - APNS_KEY_ID: Apple APNs key ID
 * - APNS_TEAM_ID: Apple Developer Team ID
 * - APNS_AUTH_KEY_P8: Contents of the .p8 private key file
 * - SUPABASE_URL: Auto-available in Edge Functions
 * - SUPABASE_SERVICE_ROLE_KEY: Auto-available in Edge Functions
 */

import { connect } from 'node:http2';
import { createSign } from 'node:crypto';
import { createClient } from 'npm:@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// APNS JWT (cached for ~50 minutes)
// ---------------------------------------------------------------------------

let cachedJwt: string | null = null;
let cachedJwtExpiry = 0;

/**
 * Generate (or return cached) ES256 JWT for APNS authentication.
 * JWTs are valid for 1 hour; we regenerate 10 minutes before expiry.
 */
function getApnsJwt(keyId: string, teamId: string, authKeyP8: string): string {
  const now = Math.floor(Date.now() / 1000);

  // Reuse cached token if still valid (refresh 10 min before expiry = ~50 min cache)
  if (cachedJwt && now < cachedJwtExpiry - 600) {
    return cachedJwt;
  }

  // Build JWT header + claims (base64url encoded)
  const header = btoa(JSON.stringify({ alg: 'ES256', kid: keyId }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const claims = btoa(JSON.stringify({ iss: teamId, iat: now }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const signingInput = `${header}.${claims}`;

  // Normalize the .p8 key -- secrets may store it as one line with escaped newlines
  let keyPem = authKeyP8.replace(/\\n/g, '\n');

  // Extract just the base64 content, then re-wrap with proper PEM format
  const rawKey = keyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/[\s\n\r]/g, '');
  keyPem = `-----BEGIN PRIVATE KEY-----\n${rawKey}\n-----END PRIVATE KEY-----\n`;

  const sign = createSign('SHA256');
  sign.update(signingInput);

  // Sign and convert to base64url
  const signatureBuffer = sign.sign(keyPem);
  const signature = signatureBuffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  cachedJwt = `${signingInput}.${signature}`;
  cachedJwtExpiry = now + 3600; // 1 hour

  return cachedJwt;
}

// ---------------------------------------------------------------------------
// APNS HTTP/2 sender
// ---------------------------------------------------------------------------

const IOS_BUNDLE_ID = 'com.spoodsjs.flick';
const APNS_TOPIC = `${IOS_BUNDLE_ID}.push-type.liveactivity`;

interface ApnsResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string | null;
}

/**
 * Send a payload to APNS via HTTP/2.
 */
function sendToApns(
  host: string,
  deviceToken: string,
  jwt: string,
  payload: string
): Promise<ApnsResult> {
  return new Promise((resolve, reject) => {
    const client = connect(`https://${host}`);

    client.on('error', (err: Error) => {
      client.close();
      reject(err);
    });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'authorization': `bearer ${jwt}`,
      'apns-topic': APNS_TOPIC,
      'apns-push-type': 'liveactivity',
      'apns-priority': '10',
      'content-type': 'application/json',
    });

    let body = '';
    let statusCode = 0;
    let responseHeaders: Record<string, string> = {};

    req.on('response', (headers: Record<string, string>) => {
      statusCode = Number(headers[':status']);
      responseHeaders = headers;
    });

    req.on('data', (chunk: Buffer) => {
      body += chunk;
    });

    req.on('end', () => {
      client.close();
      resolve({ statusCode, headers: responseHeaders, body: body || null });
    });

    req.on('error', (err: Error) => {
      client.close();
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ------------------------------------------------------------------
    // 1. Validate Authorization header (service_role key)
    // ------------------------------------------------------------------
    const authHeader = req.headers.get('authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    // ------------------------------------------------------------------
    // 2. Parse and validate request body
    // ------------------------------------------------------------------
    const {
      user_id,
      action,
      content_state,
      stale_date,
    } = await req.json();

    if (!user_id || typeof user_id !== 'string') {
      return jsonResponse({ success: false, error: 'Missing or invalid user_id' }, 400);
    }

    if (!action || !['start', 'update', 'end'].includes(action)) {
      return jsonResponse(
        { success: false, error: 'Invalid action. Must be start, update, or end' },
        400
      );
    }

    if (!content_state || typeof content_state !== 'object') {
      return jsonResponse({ success: false, error: 'Missing or invalid content_state' }, 400);
    }

    // ------------------------------------------------------------------
    // 3. Look up user's push_to_start_token from users table
    // ------------------------------------------------------------------
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey!);

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('push_to_start_token')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return jsonResponse(
        { success: false, error: `User not found: ${userError?.message || 'unknown'}` },
        404
      );
    }

    const pushToken = user.push_to_start_token;
    if (!pushToken) {
      return jsonResponse({ success: false, error: 'No push_to_start_token' }, 200);
    }

    // ------------------------------------------------------------------
    // 4. Validate APNS credentials
    // ------------------------------------------------------------------
    const apnsKeyId = Deno.env.get('APNS_KEY_ID') || '';
    const apnsTeamId = Deno.env.get('APNS_TEAM_ID') || '';
    const apnsAuthKeyP8 = Deno.env.get('APNS_AUTH_KEY_P8') || '';

    if (!apnsKeyId || !apnsTeamId || !apnsAuthKeyP8) {
      console.error('send-live-activity: Missing APNS credentials', {
        hasKeyId: !!apnsKeyId,
        hasTeamId: !!apnsTeamId,
        hasAuthKey: !!apnsAuthKeyP8,
      });
      return jsonResponse(
        { success: false, error: 'APNS credentials not configured' },
        500
      );
    }

    // ------------------------------------------------------------------
    // 5. Build APNS payload
    // ------------------------------------------------------------------
    const nowSeconds = Math.floor(Date.now() / 1000);

    const payload = JSON.stringify({
      aps: {
        timestamp: nowSeconds,
        event: action,
        'content-state': content_state,
        ...(stale_date ? { 'stale-date': stale_date } : {}),
        'relevance-score': 100,
        alert: {
          title: content_state.senderName || 'Flick',
          body: 'pinned a snap to your screen',
        },
      },
    });

    // ------------------------------------------------------------------
    // 6. Send via HTTP/2 with dual-environment fallback
    //    Primary: production. On BadDeviceToken, retry with sandbox.
    // ------------------------------------------------------------------
    const hosts = [
      'api.push.apple.com',
      'api.sandbox.push.apple.com',
    ];

    for (const host of hosts) {
      try {
        const jwt = getApnsJwt(apnsKeyId, apnsTeamId, apnsAuthKeyP8);

        console.log('send-live-activity: Trying APNS', {
          user_id,
          host,
          action,
          tokenLength: pushToken.length,
        });

        const result = await sendToApns(host, pushToken, jwt, payload);

        if (result.statusCode === 200) {
          const apnsId = result.headers['apns-id'] || null;
          const environment = host === 'api.push.apple.com' ? 'production' : 'sandbox';

          console.log('send-live-activity: Success', {
            user_id,
            apnsId,
            environment,
          });

          return jsonResponse({ success: true, environment, apnsId });
        }

        // Parse error response
        const errorBody = result.body ? JSON.parse(result.body) : {};
        const reason = errorBody.reason || 'unknown';

        // BadDeviceToken or BadEnvironmentKeyInToken -> try other environment
        if (reason === 'BadDeviceToken' || reason === 'BadEnvironmentKeyInToken') {
          console.warn('send-live-activity: Rejected, trying other environment', {
            user_id,
            host,
            reason,
          });
          continue;
        }

        // Other APNS error -> don't retry
        console.error('send-live-activity: APNS rejected', {
          user_id,
          statusCode: result.statusCode,
          reason,
          host,
        });

        return jsonResponse(
          { success: false, error: reason, statusCode: result.statusCode },
          200
        );
      } catch (error) {
        console.error('send-live-activity: Failed on host', {
          user_id,
          host,
          error: (error as Error).message,
        });
        continue;
      }
    }

    // All hosts failed
    console.error('send-live-activity: All APNS hosts failed', { user_id });
    return jsonResponse(
      { success: false, error: 'All APNS hosts rejected the token' },
      200
    );
  } catch (error) {
    console.error('send-live-activity: Unhandled error', {
      error: (error as Error).message,
    });
    return jsonResponse({ success: false, error: (error as Error).message }, 500);
  }
});
