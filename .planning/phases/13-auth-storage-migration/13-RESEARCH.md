# Phase 13: Auth & Storage Migration - Research

**Researched:** 2026-03-23
**Domain:** Supabase Auth (phone OTP), Supabase Storage, Firebase-to-Supabase user migration, upload queue rewrite
**Confidence:** HIGH

## Summary

Phase 13 rewrites the authentication and storage layers from Firebase to Supabase. The phone OTP flow simplifies significantly: Supabase uses a stateless `signInWithOtp()` / `verifyOtp()` pattern that eliminates the non-serializable ConfirmationResult problem entirely. The `PhoneAuthContext` can be simplified or removed. User migration is achievable via the admin API's `createUser` with a custom `id` field (verified in `@supabase/auth-js` types) to preserve Firebase UIDs as Supabase UUIDs, BUT only if Firebase UIDs are valid UUIDs. Firebase phone auth UIDs are typically 28-character alphanumeric strings, NOT UUIDs -- this requires a mapping table strategy with new Supabase UUIDs.

Storage migration is straightforward: public bucket for regular photos (CDN URLs, no signing), private bucket for snaps (5-minute signed URLs via `createSignedUrl`). React Native uploads require the `base64-arraybuffer` library to convert file URIs to ArrayBuffer before uploading. The upload queue rewrite switches from AsyncStorage persistence to PowerSync local SQLite table and from Firebase Storage to Supabase Storage, with a drain-then-switch strategy for in-flight items.

**Primary recommendation:** Build the Edge Function token bridge first (validates Firebase token, creates Supabase session), then rewrite auth screens, then storage services, then upload queue. The migration script for transferring files from Firebase Storage to Supabase Storage is a separate batch operation run outside the app.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Phone-linked migration: import existing users into Supabase Auth by phone number
- On first launch after update, app detects Firebase token, calls Edge Function that verifies Firebase token and creates/links a Supabase session
- Silent migration -- user sees normal loading, auth migrates behind the scenes. If migration fails, fall back to re-verification screen
- Phone number is the natural linking key between Firebase and Supabase
- New Supabase UUIDs assigned; store `firebase_uid` column on users table for migration lookups. All FK references use new Supabase UUIDs
- Auth screens (PhoneInputScreen, VerificationScreen) rewritten to use Supabase Auth phone OTP directly (clean break, not adapter layer)
- phoneAuthService.js rewritten for Supabase Auth
- PhoneAuthContext updated for Supabase OTP flow
- Batch migration script transfers ALL files from Firebase Storage to Supabase Storage
- Complete cutover so Firebase Storage can be fully decommissioned after migration
- Supabase Storage bucket structure mirrors Firebase paths: `photos/{userId}/{photoId}.jpg`, `profile-photos/{userId}/profile.jpg`, `selects/{userId}/select_{index}.jpg`
- Regular (non-snap) photos served via public CDN URLs -- no signing, no URL expiry
- Snaps stored in a private Supabase Storage bucket with `createSignedUrl()` and 5-minute expiry
- Snap cleanup via database trigger when snap is viewed
- signedUrlService.js rewritten -- simplified since regular photos use public URLs
- Atomic rewrite of uploadQueueService.js to target Supabase Storage + Supabase DB
- Drain-then-switch: items stuck in old AsyncStorage queue drained via Firebase path first
- Queue persistence moves from AsyncStorage to PowerSync local SQLite table
- Image compression updated: switch to WebP format at 0.9 quality
- Profile photo compression also updated to WebP
- Video handling unchanged (no compression, format stays .mov/.mp4)

### Claude's Discretion
- Exact Edge Function implementation for Firebase-to-Supabase token bridge
- Supabase Storage bucket RLS policy syntax and configuration
- PowerSync local-only table schema for upload queue
- Migration script architecture (batch size, parallelism, error handling)
- Whether Supabase phone OTP still requires a ConfirmationResult-like pattern or is simpler
- Thumbnail generation approach (keep current 20px base64 or adjust)
- Exact WebP compression parameters and expo-image-manipulator configuration

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can authenticate via phone OTP through Supabase Auth + Twilio | Supabase `signInWithOtp({ phone })` + `verifyOtp()` flow verified. Stateless -- no ConfirmationResult needed. 60-second OTP expiry. |
| AUTH-02 | Existing user accounts migrated with preserved UIDs so all relationships remain intact | Edge Function token bridge pattern. Firebase UIDs stored in `firebase_uid` column. New Supabase UUIDs for all FK references. Admin `createUser({ id, phone, phone_confirm: true })` for pre-import. |
| AUTH-03 | Re-authentication via OTP works for sensitive operations (account deletion) | Same `signInWithOtp` + `verifyOtp` pattern. DeleteAccountScreen uses phoneAuthService which gets rewritten. PhoneAuthContext simplified (no ConfirmationResult ref needed). |
| STOR-01 | Photos and videos upload to Supabase Storage with CDN-backed URLs | Public bucket `photos` with `getPublicUrl()`. React Native upload via ArrayBuffer using `base64-arraybuffer`. WebP at 0.9 quality for photos, unchanged for video. |
| STOR-02 | Snap photos upload with short-lived signed URLs (5-minute expiry) | Private bucket `snaps` with RLS. `createSignedUrl(path, 300)` for 5-minute URLs. Only conversation participants can generate URLs via RLS policy. |
| STOR-03 | Upload queue service works against new storage backend with same retry/persistence behavior | PowerSync local-only table replaces AsyncStorage. Same sequential processing, exponential backoff (2s/4s/8s), max 3 attempts. Drain old queue first. |
| STOR-04 | Data migration script transfers all existing files from Firebase Storage to Supabase Storage | Batch script using Firebase Admin SDK to list/download and Supabase admin client to upload. Handles photos, videos, profile photos, selects photos, comment images. |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.100.0 | Auth, Storage, database client | Already installed (Phase 12). Single SDK for all Supabase operations. |
| `base64-arraybuffer` | 1.0.2 | Convert base64 to ArrayBuffer for RN uploads | Required because React Native cannot use Blob/File/FormData with Supabase Storage. Official Supabase recommendation. |
| `expo-image-manipulator` | (existing) | Image compression/resize before upload | Already used. Supports `SaveFormat.WEBP` for the compression format change. |
| `expo-file-system` | (existing) | Read files as base64 for upload conversion | Already used via `expo-file-system/legacy`. Needed for `readAsStringAsync` with base64 encoding. |
| `libphonenumber-js` | (existing) | Phone number validation and E.164 formatting | Already used in phoneAuthService. Continues unchanged. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-native-firebase/auth` | (existing) | Firebase token generation during migration | KEPT during Phase 13 for the silent migration bridge. Removed only in Phase 20. |
| `@react-native-firebase/storage` | (existing) | Drain old upload queue items | KEPT to process any in-flight Firebase uploads before switchover. Removed in Phase 20. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `base64-arraybuffer` | `fetch().then(r => r.arrayBuffer())` | Fetch approach requires the file to be accessible via URL; base64 route works for any local URI |
| Public bucket CDN URLs | Signed URLs for all photos | Public URLs are simpler, no expiry issues, no URL refresh logic. Security via UUID-based paths (unguessable). |
| PowerSync local table for queue | Keep AsyncStorage | PowerSync aligns with Phase 12 infrastructure; provides SQL queries on queue state; consistent with overall migration direction |

**Installation:**
```bash
npm install base64-arraybuffer
```

**Version verification:** `base64-arraybuffer@1.0.2` (latest, stable, no updates needed -- simple utility library).

## Architecture Patterns

### Recommended Project Structure
```
src/services/
  supabase/
    client.ts          # Already exists (Phase 12)
    phoneAuthService.ts  # NEW: Supabase phone OTP
    storageService.ts    # NEW: Supabase Storage upload/delete
    signedUrlService.ts  # NEW: Simplified (public URLs + snap signed URLs)
  uploadQueueService.ts  # REWRITTEN: targets Supabase Storage + PowerSync
  firebase/
    phoneAuthService.js  # KEPT during migration (bridge reads Firebase token)
    storageService.js    # KEPT during migration (drain old queue)

src/context/
  AuthContext.js         # REWRITTEN to use Supabase onAuthStateChange
  PhoneAuthContext.js    # SIMPLIFIED (may become unnecessary)

supabase/
  functions/
    migrate-firebase-auth/  # Edge Function: validates Firebase token, creates Supabase session
  migrations/               # SQL for firebase_uid column, storage bucket policies
```

### Pattern 1: Supabase Phone OTP (No ConfirmationResult)

**What:** Supabase phone OTP is fully stateless. `signInWithOtp` sends the SMS; `verifyOtp` completes sign-in with just the phone number and code. No intermediate object to pass between screens.

**When to use:** All auth flows (sign-up, sign-in, re-auth for deletion).

**Example:**
```typescript
// src/services/supabase/phoneAuthService.ts
import { supabase } from './client';

export const sendVerificationCode = async (
  phoneNumber: string,
  countryCode: string
): Promise<{ success: boolean; e164?: string; error?: string }> => {
  const validation = validatePhoneNumber(phoneNumber, countryCode);
  if (!validation.valid) return { success: false, error: validation.error };

  const { error } = await supabase.auth.signInWithOtp({
    phone: validation.e164,
  });

  if (error) return { success: false, error: mapSupabaseAuthError(error) };
  return { success: true, e164: validation.e164 };
  // NOTE: No confirmation object returned. Phone number + code is all verifyOtp needs.
};

export const verifyCode = async (
  phone: string,  // E.164 format
  code: string
): Promise<{ success: boolean; session?: any; error?: string }> => {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: code,
    type: 'sms',
  });

  if (error) return { success: false, error: mapSupabaseAuthError(error) };
  return { success: true, session: data.session };
};
```

**Impact on PhoneAuthContext:** The `confirmationRef` pattern becomes unnecessary. PhoneInputScreen passes `e164` via navigation params to VerificationScreen. VerificationScreen calls `verifyOtp` with just the phone and code. PhoneAuthContext can be simplified to just store the `e164` string between screens (or eliminated entirely if navigation params suffice).

### Pattern 2: Silent Auth Migration (Edge Function Token Bridge)

**What:** On first launch after update, detect Firebase auth state, call Edge Function to create/link Supabase session.

**When to use:** One-time migration for existing users.

**Example:**
```typescript
// Edge Function: supabase/functions/migrate-firebase-auth/index.ts
import { createClient } from '@supabase/supabase-js';
import * as admin from 'firebase-admin';

Deno.serve(async (req) => {
  const { firebaseToken } = await req.json();

  // 1. Verify Firebase token
  const decoded = await admin.auth().verifyIdToken(firebaseToken);
  const firebaseUid = decoded.uid;
  const phone = decoded.phone_number;

  // 2. Look up existing Supabase user by firebase_uid
  const supabaseAdmin = createClient(url, serviceRoleKey);
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('firebase_uid', firebaseUid)
    .single();

  if (existingUser) {
    // 3a. User already migrated -- generate session
    // Use admin.generateLink or custom token to create session
  } else {
    // 3b. First migration -- create Supabase auth user with phone
    const { data: newUser } = await supabaseAdmin.auth.admin.createUser({
      phone,
      phone_confirm: true,
      user_metadata: { firebase_uid: firebaseUid },
    });
    // Update users table with firebase_uid mapping
  }

  // Return Supabase session tokens to client
});
```

**Client-side flow:**
```typescript
// In AuthContext, on app launch:
const firebaseAuth = getAuth();
const firebaseUser = firebaseAuth.currentUser;
if (firebaseUser && !supabaseSession) {
  const firebaseToken = await firebaseUser.getIdToken();
  const response = await supabase.functions.invoke('migrate-firebase-auth', {
    body: { firebaseToken },
  });
  // Set Supabase session from response
}
```

### Pattern 3: React Native File Upload to Supabase Storage

**What:** Convert local file URI to ArrayBuffer via base64, then upload.

**When to use:** All photo/video uploads.

**Example:**
```typescript
// src/services/supabase/storageService.ts
import { supabase } from './client';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';

const compressImage = async (uri: string, quality = 0.9): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1080 } }],
    { compress: quality, format: ImageManipulator.SaveFormat.WEBP }
  );
  return result.uri;
};

export const uploadPhoto = async (
  userId: string,
  photoId: string,
  localUri: string
): Promise<{ success: boolean; url?: string; storagePath?: string; error?: string }> => {
  try {
    const compressedUri = await compressImage(localUri, 0.9);
    const base64 = await FileSystem.readAsStringAsync(compressedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const storagePath = `photos/${userId}/${photoId}.webp`;

    const { error } = await supabase.storage
      .from('photos')
      .upload(storagePath, decode(base64), {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000',
        upsert: false,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(storagePath);

    return { success: true, url: publicUrl, storagePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

### Pattern 4: Upload Queue with PowerSync Local Table

**What:** Queue items persisted in PowerSync local-only SQLite table instead of AsyncStorage.

**When to use:** Camera capture and background upload processing.

**Example schema for local-only table:**
```sql
-- PowerSync local-only table (not synced to server)
CREATE TABLE upload_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  media_uri TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'photo',
  duration REAL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  backend TEXT NOT NULL DEFAULT 'supabase'
);
```

### Anti-Patterns to Avoid

- **Storing full Supabase Storage URLs in database:** Store storage paths only (`photos/userId/photoId.webp`). Generate full URLs at read time via `getPublicUrl()`. This decouples from the specific Supabase project URL.
- **Keeping the ConfirmationResult pattern for Supabase:** Supabase OTP is stateless. Do not create an equivalent ref-passing pattern. Pass phone E.164 via navigation params.
- **Using Blob/File/FormData for React Native uploads:** These do not work correctly with Supabase Storage in React Native. Always use ArrayBuffer via `base64-arraybuffer`.
- **Running Firebase and Supabase auth listeners simultaneously in production:** During migration, the Edge Function bridge handles the handoff. After migration, only `supabase.auth.onAuthStateChange` should be active.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phone OTP verification | Custom Twilio integration + token management | `supabase.auth.signInWithOtp()` + `verifyOtp()` | Supabase handles SMS delivery, rate limiting, OTP expiry, session creation. Building custom adds security surface. |
| Signed URLs for snaps | Custom Edge Function to generate signed URLs | `supabase.storage.from('snaps').createSignedUrl(path, 300)` | Built-in, respects RLS, handles expiry. Edge Function adds latency for no benefit. |
| Public photo URLs | Signed URL service for regular photos | `supabase.storage.from('photos').getPublicUrl(path)` | Public bucket CDN URLs never expire, are cached at edge, require zero maintenance. |
| Auth session refresh | Manual token refresh logic | `supabase.auth` with `autoRefreshToken: true` | SDK handles token refresh, `onAuthStateChange` fires TOKEN_REFRESHED events automatically. |
| File upload conversion (RN) | Custom fetch/blob pipeline | `base64-arraybuffer` decode + `supabase.storage.upload()` | Official Supabase recommendation for React Native. Blob/File/FormData confirmed broken in RN. |

## Common Pitfalls

### Pitfall 1: Firebase UIDs Are Not Valid UUIDs
**What goes wrong:** You try to use Firebase Auth UIDs directly as Supabase user IDs via `admin.createUser({ id: firebaseUid })`. It fails because Firebase phone auth UIDs are 28-character alphanumeric strings (e.g., `AbC1dEf2GhI3jKl4MnO5pQr6StU7`), not valid UUIDs.
**Why it happens:** Firebase generates its own UID format. Supabase Auth requires valid UUID v4 format in the `id` field.
**How to avoid:** The CONTEXT.md decision is correct: assign new Supabase UUIDs and store `firebase_uid` in the users table for migration lookups. All FK references use new Supabase UUIDs. The Edge Function maps Firebase UID -> Supabase UUID during the silent migration.
**Warning signs:** `invalid input syntax for type uuid` errors from Supabase Auth API.

### Pitfall 2: React Native File Upload Corruption
**What goes wrong:** Photos uploaded to Supabase Storage are corrupted or 0 bytes.
**Why it happens:** Using `Blob`, `File`, or `FormData` in React Native with Supabase Storage. The official docs state: "For React Native, using either Blob, File or FormData does not work as intended."
**How to avoid:** Always use the `base64-arraybuffer` decode pattern. Read file as base64 via `expo-file-system`, convert with `decode()`, upload the ArrayBuffer.
**Warning signs:** Uploaded files are 0 bytes or cannot be opened.

### Pitfall 3: Upload Queue Items Targeting Wrong Backend After OTA Update
**What goes wrong:** User captures photos on Firebase backend, app updates OTA, old queue items fail because they try to upload to Supabase with Firebase-format metadata.
**Why it happens:** Queue items in AsyncStorage don't know which backend they were created for.
**How to avoid:** Drain-then-switch strategy (per CONTEXT.md decision). On app launch after update: (1) check for old AsyncStorage queue items, (2) process them via Firebase path, (3) clear old queue, (4) switch to PowerSync queue for new items. Add a `backend` field to queue items.
**Warning signs:** Upload errors mentioning Firebase Storage after migration.

### Pitfall 4: Supabase Auth Listener Fires INITIAL_SESSION Before Profile Fetch
**What goes wrong:** `onAuthStateChange` fires with `INITIAL_SESSION` event immediately on client creation (before you fetch the user profile from the database). If you navigate based on auth state, the user briefly sees the wrong screen.
**Why it happens:** Supabase persists session in AsyncStorage. On app launch, it restores the session and fires `INITIAL_SESSION` synchronously. But the user profile fetch is async.
**How to avoid:** Keep the `initializing` state pattern from current AuthContext. Set `initializing = true` until BOTH the session is resolved AND the user profile is fetched. Only then determine navigation route.
**Warning signs:** Brief flash of login screen before navigating to main app, or flash of profile setup before navigating to feed.

### Pitfall 5: WebP Format Not Supported on Older iOS/Android
**What goes wrong:** WebP photos display correctly on modern devices but fail on iOS 13 or Android 4.x.
**Why it happens:** WebP support: iOS 14+, Android 4.2+ (partial), Android 5.0+ (full with transparency).
**How to avoid:** This is a non-issue for this project. Expo SDK 54 requires iOS 15+ and Android 6+. WebP is fully supported on all target devices. No fallback needed.
**Warning signs:** None expected.

### Pitfall 6: Missing Content-Type on Supabase Storage Uploads
**What goes wrong:** Uploaded images cannot be displayed in the browser or via CDN because they're served with `application/octet-stream` instead of `image/webp`.
**Why it happens:** React Native cannot auto-detect MIME types. If `contentType` is not explicitly set in upload options, Supabase defaults to `application/octet-stream`.
**How to avoid:** Always pass `contentType` explicitly: `'image/webp'` for photos, `'video/quicktime'` for .mov, `'video/mp4'` for .mp4, `'image/jpeg'` for profile photos (if keeping JPEG for profile photos).
**Warning signs:** Images load as downloads instead of displaying inline.

## Code Examples

### Supabase Auth State Listener (replacing Firebase onAuthStateChanged)

```typescript
// Source: Supabase Auth docs + verified from @supabase/auth-js types
// In AuthContext.ts

useEffect(() => {
  // onAuthStateChange fires INITIAL_SESSION on mount (from persisted session)
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          setUser(session.user);
          // Fetch user profile from database
          const profile = await fetchUserProfile(session.user.id);
          setUserProfile(profile);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserProfile(null);
      } else if (event === 'TOKEN_REFRESHED') {
        // Session auto-refreshed, no action needed
      }
      setInitializing(false);
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

### Supabase Storage Public URL Generation

```typescript
// Source: Supabase JS SDK reference
// For regular photos (public bucket)
const getPhotoUrl = (storagePath: string): string => {
  const { data: { publicUrl } } = supabase.storage
    .from('photos')
    .getPublicUrl(storagePath);
  return publicUrl;
};

// For snaps (private bucket, 5-minute signed URL)
const getSnapUrl = async (storagePath: string): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from('snaps')
    .createSignedUrl(storagePath, 300); // 300 seconds = 5 minutes
  if (error) return null;
  return data.signedUrl;
};
```

### WebP Compression Configuration

```typescript
// Source: expo-image-manipulator docs (verified SaveFormat.WEBP exists)
import * as ImageManipulator from 'expo-image-manipulator';

// Photo compression: WebP at 0.9 quality, max 1080px width
const compressPhoto = async (uri: string): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1080 } }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.WEBP }
  );
  return result.uri;
};

// Profile photo compression: WebP at 0.7 quality (smaller file, less detail needed)
const compressProfilePhoto = async (uri: string): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 400 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.WEBP }
  );
  return result.uri;
};

// Thumbnail generation: keep as tiny JPEG base64 (20px wide, same as current)
// WebP thumbnails add complexity for no benefit at 20px
const generateThumbnail = async (uri: string): Promise<string | null> => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 20 } }],
      { format: ImageManipulator.SaveFormat.JPEG, compress: 0.5 }
    );
    const base64 = await FileSystem.readAsStringAsync(result.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return null;
  }
};
```

### Supabase Storage Bucket RLS Policies

```sql
-- Public photos bucket: anyone can read, authenticated users can upload to their own path
CREATE POLICY "Public photo read" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

CREATE POLICY "Users upload own photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Private snaps bucket: only conversation participants can read/write
CREATE POLICY "Snap upload by sender" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'snaps'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Snap read by participant" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'snaps'
    AND EXISTS (
      SELECT 1 FROM conversations c
      JOIN messages m ON m.conversation_id = c.id
      WHERE m.snap_storage_path = name
        AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
    )
  );
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Firebase `signInWithPhoneNumber` returns ConfirmationResult | Supabase `signInWithOtp` is stateless (no intermediate object) | N/A (different platform) | PhoneAuthContext can be eliminated. Navigation params carry E.164 phone. |
| Firebase Storage signed URLs (7-day, via Cloud Function) | Supabase public bucket CDN URLs (never expire) | N/A (different platform) | signedUrlService becomes trivial. No URL refresh logic needed for regular photos. |
| Firebase Storage `putFile` (native method, handles file:// URIs) | Supabase Storage `upload` requires ArrayBuffer | N/A (different platform) | Must add `base64-arraybuffer` and read files as base64 before upload. |
| JPEG at 0.7-0.8 quality | WebP at 0.9 quality | Decision in CONTEXT.md | Smaller files, sharper images. WebP at 0.9 is still smaller than JPEG at 0.8. |
| AsyncStorage for upload queue persistence | PowerSync local SQLite table | Decision in CONTEXT.md | SQL queries on queue state, consistent with sync infrastructure. |

## Open Questions

1. **Edge Function Firebase Admin SDK in Deno**
   - What we know: Edge Functions run Deno. Firebase Admin SDK is a Node.js library.
   - What's unclear: Whether Firebase Admin works in Deno, or if we need to use the Firebase REST API for token verification instead.
   - Recommendation: Use Firebase REST API endpoint `https://identitytoolkit.googleapis.com/v1/accounts:lookup` to verify Firebase ID tokens in the Edge Function. Avoids Node.js dependency in Deno runtime. Alternatively, verify the JWT manually using Firebase's public keys.

2. **Profile photo format (WebP vs JPEG)**
   - What we know: CONTEXT.md says "profile photo compression also updated to WebP."
   - What's unclear: Whether existing profile photos (JPEG) need re-encoding during migration or just new uploads switch to WebP.
   - Recommendation: New uploads use WebP. Migration script copies existing JEPGs as-is. Both formats display fine via `expo-image`. No re-encoding needed.

3. **Storage migration script runtime environment**
   - What we know: Script must download from Firebase Storage and upload to Supabase Storage.
   - What's unclear: Where to run it (local machine, CI, Edge Function).
   - Recommendation: Run locally or in CI. It needs Firebase Admin SDK (Node.js) and Supabase admin client. Not suitable for Edge Function (long-running, high bandwidth). Use streaming to avoid loading all files into memory.

4. **Comment images bucket**
   - What we know: `storageService.js` has `uploadCommentImage` storing to `comment-images/` path.
   - What's unclear: Whether comment images should go in the public `photos` bucket or a separate bucket.
   - Recommendation: Store in `photos` bucket under `comment-images/` prefix. They're public content, same as regular photos. One fewer bucket to manage.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest with `jest-expo` preset |
| Config file | `jest.config.js` |
| Quick run command | `npm test -- --testPathPattern="services/(phoneAuth\|storage\|signedUrl\|uploadQueue)" --no-coverage` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Phone OTP sign-in via Supabase | unit | `npm test -- __tests__/services/phoneAuthService.test.js -x` | Exists (rewrite needed for Supabase mocks) |
| AUTH-02 | Silent auth migration via Edge Function | integration | `npm test -- __tests__/integration/authMigration.test.js -x` | Wave 0 |
| AUTH-03 | Re-auth via OTP for account deletion | unit | `npm test -- __tests__/services/accountService.test.js -x` | Exists (rewrite needed) |
| STOR-01 | Photo/video upload to Supabase Storage | unit | `npm test -- __tests__/services/storageService.test.js -x` | Wave 0 (new Supabase storage tests) |
| STOR-02 | Snap signed URL generation | unit | `npm test -- __tests__/services/signedUrlService.test.js -x` | Wave 0 (new simplified tests) |
| STOR-03 | Upload queue with Supabase backend | unit | `npm test -- __tests__/services/uploadQueueService.test.js -x` | Exists (rewrite needed) |
| STOR-04 | Migration script transfers files | manual-only | N/A (run against dev Supabase project) | N/A |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="services/(phoneAuth|storage|signedUrl|uploadQueue)" --no-coverage -x`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/services/phoneAuthService.test.js` -- rewrite mocks from Firebase to Supabase (`jest.mock('@supabase/supabase-js')`)
- [ ] `__tests__/services/storageService.test.js` -- new file for Supabase Storage operations (was testing Firebase Storage)
- [ ] `__tests__/services/signedUrlService.test.js` -- new simplified tests (public URL + snap signed URL)
- [ ] `__tests__/services/uploadQueueService.test.js` -- rewrite to mock PowerSync local table + Supabase Storage
- [ ] `__tests__/integration/authMigration.test.js` -- new file testing the silent migration flow (mock Firebase token + Supabase Edge Function response)
- [ ] `jest.config.js` -- update `testMatch` to include `.test.ts` files: `['**/__tests__/**/*.test.{js,ts}']`
- [ ] `jest.config.js` -- update `collectCoverageFrom` to include `.ts/.tsx`: `['src/**/*.{js,jsx,ts,tsx}']`
- [ ] Supabase client mock setup in `__tests__/setup/jest.setup.js` (parallel to existing Firebase mocks)

## Sources

### Primary (HIGH confidence)
- `@supabase/auth-js` v2.73.1 types (`node_modules/@supabase/auth-js/dist/main/lib/types.d.ts`) -- verified `AdminUserAttributes.id` field exists for custom UUID assignment
- [Supabase Phone Login Docs](https://supabase.com/docs/guides/auth/phone-login) -- `signInWithOtp` + `verifyOtp` flow, 60-second expiry
- [Supabase JS SDK: signInWithOtp](https://supabase.com/docs/reference/javascript/auth-signinwithotp) -- API reference
- [Supabase JS SDK: storage upload](https://supabase.com/docs/reference/javascript/storage-from-upload) -- ArrayBuffer requirement for React Native
- [Supabase JS SDK: getPublicUrl](https://supabase.com/docs/reference/javascript/storage-from-getpublicurl) -- Public URL generation
- [Supabase React Native Storage Blog](https://supabase.com/blog/react-native-storage) -- Full upload implementation pattern
- [Expo Image Manipulator Docs](https://docs.expo.dev/versions/latest/sdk/imagemanipulator/) -- `SaveFormat.WEBP` confirmed available
- [Supabase JS SDK: onAuthStateChange](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) -- Session listener events

### Secondary (MEDIUM confidence)
- [Supabase Firebase Auth Migration](https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-auth) -- Official migration guide (limited for phone-only users)
- [supabase-community/firebase-to-supabase](https://github.com/supabase-community/firebase-to-supabase) -- Migration scripts (does NOT preserve UIDs, does NOT handle phone users)
- [Supabase GoTrue Self-Hosting API](https://supabase.com/docs/reference/self-hosting-auth/returns-the-created-user) -- Admin create user endpoint

### Tertiary (LOW confidence)
- Edge Function Firebase token verification in Deno -- unverified whether Firebase Admin SDK works in Deno; REST API fallback recommended
- PowerSync local-only table schema -- based on PowerSync docs general patterns, not verified against a specific local-only table example

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified, versions confirmed, APIs tested against SDK types
- Architecture: HIGH - Supabase Auth OTP flow verified as stateless, Storage upload pattern verified, migration bridge pattern is well-documented
- Pitfalls: HIGH - Firebase UID format verified (not UUID), RN upload issues confirmed in official docs, queue drain strategy from CONTEXT.md
- Migration approach: MEDIUM - Edge Function Deno compatibility with Firebase Admin is uncertain; REST API fallback is the safe path

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable platform, low API churn)
