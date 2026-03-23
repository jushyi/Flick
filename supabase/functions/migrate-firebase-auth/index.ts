/**
 * Edge Function: migrate-firebase-auth
 *
 * Validates a Firebase ID token via the Google Identity Toolkit REST API,
 * creates or links a Supabase Auth user, and returns real GoTrue session
 * tokens (access_token + refresh_token) so the client can call setSession().
 *
 * This enables silent migration: existing Firebase Auth users get a Supabase
 * session without re-verifying their phone number.
 *
 * Environment variables (set via `supabase secrets set`):
 * - FIREBASE_API_KEY: Firebase project Web API key (from Firebase Console > Project Settings)
 * - SUPABASE_URL: Auto-available in Edge Functions
 * - SUPABASE_SERVICE_ROLE_KEY: Auto-available in Edge Functions
 *
 * Client usage:
 *   const { data } = await supabase.functions.invoke('migrate-firebase-auth', {
 *     body: { firebaseToken },
 *   });
 *   if (data?.access_token && data?.refresh_token) {
 *     await supabase.auth.setSession({
 *       access_token: data.access_token,
 *       refresh_token: data.refresh_token,
 *     });
 *   }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ========================================================================
    // 1. Parse and validate request
    // ========================================================================
    const { firebaseToken } = await req.json();

    if (!firebaseToken) {
      return jsonResponse({ error: 'Missing firebaseToken' }, 400);
    }

    // ========================================================================
    // 2. Verify Firebase ID token via Google Identity Toolkit REST API
    //    Firebase Admin SDK does NOT work in Deno -- use REST API instead
    // ========================================================================
    const FIREBASE_API_KEY = Deno.env.get('FIREBASE_API_KEY');
    if (!FIREBASE_API_KEY) {
      return jsonResponse({ error: 'Server configuration error: missing FIREBASE_API_KEY' }, 500);
    }

    const verifyResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: firebaseToken }),
      }
    );

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json().catch(() => ({}));
      console.error('Firebase token verification failed:', errorData);
      return jsonResponse({ error: 'Invalid Firebase token' }, 401);
    }

    const verifyData = await verifyResponse.json();
    const firebaseUser = verifyData.users?.[0];

    if (!firebaseUser) {
      return jsonResponse({ error: 'Firebase user not found' }, 404);
    }

    const firebaseUid: string = firebaseUser.localId;
    const phone: string | undefined = firebaseUser.phoneNumber;

    if (!phone) {
      return jsonResponse({ error: 'No phone number on Firebase account' }, 400);
    }

    // ========================================================================
    // 3. Create Supabase admin client with service_role key
    // ========================================================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ========================================================================
    // 4. Check if user already migrated (lookup by firebase_uid in users table)
    // ========================================================================
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();

    let supabaseUserId: string;
    let isNewMigration = false;

    if (existingUser) {
      // User already migrated -- just generate a new session
      supabaseUserId = existingUser.id;
    } else {
      // First migration -- check if phone already exists in app users table
      // Direct table query instead of auth.admin.listUsers() for scalability
      const { data: userByPhone } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('phone_number', phone)
        .single();

      if (userByPhone) {
        // Phone exists in app users table -- link firebase_uid
        supabaseUserId = userByPhone.id;
      } else {
        // Create new Supabase auth user with phone
        const tempPassword = crypto.randomUUID();
        const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser(
          {
            phone,
            phone_confirm: true,
            password: tempPassword,
            user_metadata: { firebase_uid: firebaseUid },
          }
        );

        if (createError) {
          console.error('Failed to create Supabase user:', createError);
          return jsonResponse(
            { error: 'Failed to create Supabase user: ' + createError.message },
            500
          );
        }

        supabaseUserId = newAuthUser.user.id;
        isNewMigration = true;
      }

      // Update users table with firebase_uid mapping
      await supabaseAdmin
        .from('users')
        .update({ firebase_uid: firebaseUid })
        .eq('id', supabaseUserId);
    }

    // ========================================================================
    // 5. Generate real GoTrue session tokens
    //    Strategy: set temp password -> sign in via GoTrue -> clear password
    // ========================================================================
    const tempPassword = crypto.randomUUID();

    // Set temporary password on the user
    const { error: updatePwError } = await supabaseAdmin.auth.admin.updateUserById(
      supabaseUserId,
      { password: tempPassword }
    );

    if (updatePwError) {
      console.error('Failed to set temp password:', updatePwError);
      return jsonResponse({ error: 'Failed to generate session' }, 500);
    }

    // Sign in with the temporary password to get real GoTrue tokens
    const tokenResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseServiceKey,
      },
      body: JSON.stringify({ phone, password: tempPassword }),
    });

    if (!tokenResponse.ok) {
      // Clear temp password even on failure (security)
      await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, { password: '' });
      console.error('Token generation failed:', await tokenResponse.text());
      return jsonResponse({ error: 'Failed to generate session tokens' }, 500);
    }

    const tokenData = await tokenResponse.json();

    // Immediately clear the temporary password (security)
    await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, { password: '' });

    // ========================================================================
    // 6. Return session tokens to client
    // ========================================================================
    return jsonResponse({
      success: true,
      migrated: isNewMigration || !existingUser,
      supabaseUserId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
    });
  } catch (error) {
    console.error('migrate-firebase-auth error:', error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
