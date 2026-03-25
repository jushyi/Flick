# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lapse Clone (branded as "Flick") is a friends-only social media app built with React Native and Expo. It recreates the disposable camera experience: photos are captured instantly but revealed later in batches through a "darkroom" system. The app uses Supabase for authentication (phone-only), PostgreSQL with Row Level Security, Supabase Storage, and Edge Functions. The UI uses a retro 16-bit pixel art aesthetic with CRT-inspired dark theme.

## Production Build & Deployment

**The app is on a production build (EAS).** Changes to JS/TS code are deployed as OTA updates via EAS Update — they do NOT require a new native build unless native code changes.

After completing any code changes, **the user must manually trigger** the EAS update command. Do NOT run it automatically:

```bash
# iOS only
eas update --branch production --platform ios --message "description of change"

# Android only
eas update --branch production --platform android --message "description of change"

# Both platforms at once
eas update --branch production --message "description of change"
```

Never run `eas update` autonomously. Always remind the user to run it after changes are complete.

Changes that require a full native build (NOT just `eas update`):
- Adding/removing native modules or Expo plugins
- Changes to `app.json`/`app.config.js` (icons, splash, permissions, etc.)
- Modifying native files in `ios/` or `android/`

## Android Development

The app supports both iOS and Android. Android was added after the initial iOS-only build. Keep the following in mind when working on Android.

### Supabase Config (Android)

Two Supabase projects exist — dev and prod. Config is handled via environment variables stored as EAS secrets:

- `SUPABASE_URL_DEV` / `SUPABASE_ANON_KEY_DEV` — dev Supabase project, used for development/preview builds
- `SUPABASE_URL_PROD` / `SUPABASE_ANON_KEY_PROD` — prod Supabase project, used for production builds

`app.config.js` selects between them based on `APP_ENV === 'production'`.

### EAS Build Profiles (Android)

```bash
# Dev client build — connects to expo start, for active development
eas build --platform android --profile development

# Preview build — standalone APK, no dev server needed, uses dev Supabase
eas build --platform android --profile preview

# Production build — Play Store AAB, uses prod Supabase
eas build --platform android --profile production
```

### Making Android-Only JS Changes

**Never use Android-only logic without a platform guard** — it will crash or misbehave on iOS. Always isolate it with one of these patterns:

**Option 1 — Inline guard (for small differences):**
```typescript
import { Platform } from 'react-native';

// Logic
if (Platform.OS === 'android') { /* android only */ }

// Styles
const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
});

// Platform.select (cleanest for multiple values)
const behavior = Platform.select({ ios: 'padding', android: 'height' });
```

**Option 2 — Platform file extensions (for large component differences):**
```
MyComponent.android.tsx   <- loaded only on Android
MyComponent.ios.tsx       <- loaded only on iOS
MyComponent.tsx           <- fallback for both
```
Import as normal — Metro automatically resolves the right file. No changes to import statements needed.

### Known Android Behavior Differences

| Area | Android Behavior | What to do |
|------|-----------------|------------|
| `KeyboardAvoidingView` | `behavior="padding"` doesn't work well | Use `behavior={Platform.select({ ios: 'padding', android: 'height' })}` |
| Status bar | Overlaps content unless handled | Use `<StatusBar translucent backgroundColor="transparent" />` |
| Safe area | Bottom inset includes gesture nav bar | Use `useSafeAreaInsets()` — already used project-wide |
| Back button | Hardware back button exists | Handle with `BackHandler` or `useEffect` + navigation listener for modal-like screens |
| Edge-to-edge | Enabled in `app.json` — gesture nav bar overlaps tab bar | May need extra bottom padding in tab bar on Android |
| Font rendering | Pixel/bitmap fonts render differently | Test visually; may need `fontWeight` adjustments per platform |
| Shadows | `shadow*` props don't work | Use `elevation` on Android instead of iOS shadow props |
| Overflow | `overflow: 'hidden'` clips differently | Test clipping behavior on both platforms |
| Animations | Reanimated works the same, but frame rate can differ | Test gesture animations on a real Android device |

### Screen Size & Responsive Layout

Android has hundreds of screen sizes and densities. Follow these rules to ensure the app works across all of them.

**Never hardcode pixel dimensions for layout:**
```typescript
// Bad — assumes a specific screen size
<View style={{ width: 390, height: 844 }} />

// Good — percentage or flex
<View style={{ width: '100%', flex: 1 }} />
```

**Use `useWindowDimensions()` for anything size-dependent** (better than `Dimensions.get()` which is a static snapshot and doesn't update on orientation change):
```typescript
import { useWindowDimensions } from 'react-native';
const { width, height } = useWindowDimensions();
```

**Trust flexbox** — it scales to any screen automatically. Most Android layout issues come from fighting flexbox rather than using it.

**Safe areas already handle notches and punch-holes** — `useSafeAreaInsets()` covers every Android camera cutout, status bar height, and gesture nav bar shape. The project already uses this everywhere.

**Camera screen** — `CAMERA_HEIGHT` in `useCamera()` is calculated from screen dimensions. Verify it looks correct on tall phones (20:9 ratio, the most common modern Android ratio) vs wider ones.

**Photo aspect ratios in feed** — Use `aspectRatio` style rather than fixed heights for photo cards so they adapt to different screen widths.

**Pixel art assets** — Android has more density buckets than iOS (mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi). Use `PixelRatio.get()` if pixel art elements need precise scaling per density.

**Testing target** — If the layout looks correct at 360dp wide (small/budget phone) and 430dp wide (large flagship), it will work for ~95% of Android users. Use Android Studio emulator presets to test both.

### Android-Specific `app.json` Fields

```json
"android": {
  "package": "com.spoodsjs.flick",
  "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png", "backgroundColor": "#0A0A1A" },
  "permissions": ["android.permission.CAMERA", "android.permission.RECORD_AUDIO"],
  "edgeToEdgeEnabled": true
}
```

## Development Commands

### Running the App
```bash
npx expo start        # Start development server
npx expo start --web  # Run in web browser
npm run ios           # Run on iOS simulator
npm run android       # Run on Android emulator
```

### Code Quality
```bash
npm run lint         # Check for linting errors
npm run lint:fix     # Auto-fix linting errors
npm run format       # Format with Prettier
```

### Testing
```bash
npm test                       # Run all tests once
npm run test:watch             # Run tests in watch mode
npm run test:coverage          # Run tests with coverage report
npm test -- path/to/test.test.ts  # Run a single test file
```

Tests use Jest with `jest-expo` preset. Supabase modules are mocked via `global.__supabaseMocks` in `__tests__/setup/jest.setup.ts`. Mock functions are defined outside `jest.mock()` blocks and referenced inside mock returns. Coverage is collected from `src/` only.

### Edge Functions
```bash
supabase functions serve       # Local development
supabase functions deploy      # Deploy all functions
supabase functions deploy <name>  # Deploy a single function
```

Edge Functions use Deno, Supabase Admin SDK, Expo Server SDK, and Zod for request validation.

### Pre-commit Hooks
The project uses husky + lint-staged. Commits automatically run linting and formatting on staged files. `patch-package` runs on `npm install` via postinstall script.

## Architecture

### Core Stack
- **React Native + Expo (SDK 54)** - Cross-platform mobile framework
- **Supabase JS SDK** (`@supabase/supabase-js`) - Auth, PostgreSQL, Storage, Realtime
- **PowerSync** - Offline-first sync with local SQLite, bidirectional sync with Supabase PostgreSQL
- **TanStack Query** (`@tanstack/react-query`) - Server state caching, background refetching, optimistic updates
- **React Navigation 7** - Nested navigators (Native Stack + Bottom Tabs)
- **Context API** - Global state management (Auth, PhoneAuth, PhotoDetail, Theme)
- **Custom Hooks** - Business logic abstraction (camera, darkroom, feed, comments)
- **react-native-reanimated** - Gesture animations (swipe, card stacks)

### Type System

All code is TypeScript (`.ts`/`.tsx`). Shared types live in `src/types/`:

- `src/types/database.ts` - Generated Supabase database types (tables, views, enums)
- `src/types/models.ts` - Domain model interfaces (User, Photo, Friendship, etc.)
- `src/types/navigation.ts` - React Navigation param lists
- `src/types/api.ts` - Edge Function request/response types

Regenerate database types after schema changes:
```bash
supabase gen types typescript --project-id <project-id> > src/types/database.ts
```

### Service Layer Pattern

All Supabase operations are abstracted into service modules in `src/services/supabase/`. Each service exports functions that return `{ success, error }` objects:

```typescript
export const uploadPhoto = async (userId: string, photoUri: string) => {
  try {
    // ... upload logic
    return { success: true, photoId: result.id };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};
```

Key services:
- `photoService.ts` - Photo upload, deletion, reveal, triage (journal/archive)
- `darkroomService.ts` - Darkroom state, reveal scheduling
- `feedService.ts` - Real-time feed subscriptions via Supabase Realtime
- `friendshipService.ts` - Friend requests, relationships
- `phoneAuthService.ts` - Phone number authentication via Supabase Auth
- `notificationService.ts` - Push notifications via Expo
- `storageService.ts` - Supabase Storage operations (public/signed URLs)
- `commentService.ts` - Photo comments with @mentions
- `albumService.ts` / `monthlyAlbumService.ts` - User-created and auto-generated albums
- `accountService.ts` - Account deletion scheduling and recovery
- `uploadQueueService.ts` - Photo upload queue with retry, persists across restarts
- `blockService.ts` / `reportService.ts` - User blocking and reporting
- `messageService.ts` - Direct messaging: conversation CRUD, message sending, subscriptions, pagination, soft deletion

Additional non-Supabase services exist at `src/services/` root level: `iapService.ts` (in-app purchases), `iTunesService.ts` / `searchService.ts` (music search), `audioPlayer.ts`, `secureStorageService.ts`.

### Authentication Flow

Phone-only authentication using Supabase Auth OTP:

1. **PhoneInputScreen** - User enters phone number, Supabase sends OTP via `supabase.auth.signInWithOtp()`
2. **VerificationScreen** - User enters 6-digit code, verified via `supabase.auth.verifyOtp()`
3. **ProfileSetupScreen** - New users set username, display name, profile photo
4. **SelectsScreen** - New users pick 3 content preferences
5. **ContactsSyncScreen** - Optional contact sync for friend suggestions
6. **NotificationPermissionScreen** - Optional push notification permission
7. **MainTabs** - Main app (Feed, Messages, Camera, Profile)

AuthContext manages user state and profile via `supabase.auth.onAuthStateChange()`. PhoneAuthContext is no longer needed since Supabase OTP is stateless (no non-serializable confirmation object).

### Navigation Structure

```
NavigationContainer (DarkTheme + custom colors)
+-- Stack.Navigator (root)
    +-- PhoneInput / Verification (unauthenticated)
    +-- Onboarding Stack (authenticated, profile incomplete)
    |   +-- ProfileSetup, Selects, ContactsSync, NotificationPermission
    |   +-- SongSearch (card modal)
    |   +-- ProfilePhotoCrop (fullScreenModal)
    +-- Main App (authenticated, profile complete)
        +-- MainTabs (BottomTabNavigator)
        |   +-- Feed
        |   +-- Messages (MessagesStackNavigator)
        |   |   +-- MessagesList, Conversation, NewMessage
        |   +-- Camera
        |   +-- Profile (ProfileStackNavigator)
        |       +-- ProfileMain, Settings, EditProfile, CreateAlbum
        |       +-- AlbumPhotoPicker, AlbumGrid, MonthlyAlbumGrid
        |       +-- NotificationSettings, SoundSettings, Contributions
        |       +-- PrivacyPolicy, TermsOfService, DeleteAccount
        |       +-- RecentlyDeleted, BlockedUsers, ProfilePhotoCrop
        |       +-- SongSearch
        +-- PhotoDetail (transparentModal, swipe-dismissible)
        +-- ProfileFromPhotoDetail (fullScreenModal, nested navigation)
        +-- Darkroom (slide_from_bottom)
        +-- Success, Activity, FriendsList, OtherUserProfile (slide_from_right)
        +-- AlbumGrid, MonthlyAlbumGrid (top-level card)
        +-- ReportUser, HelpSupport (modal)
```

Deep linking: `lapse://` and `com.lapseclone.app://` prefixes with routes for feed, messages, camera, profile, darkroom, notifications, friends, and auth flows.

Use `navigationRef` (exported from AppNavigator) for programmatic navigation outside components (e.g., notification handlers in App.tsx).

### Photo Lifecycle

1. **Capture** - CameraScreen captures photo, queued via `uploadQueueService`
2. **Developing** - Photo row in PostgreSQL with `status: 'developing'`, visible in DarkroomScreen
3. **Reveal** - After a random 0-5 minute developing period, `revealPhotos()` changes `status: 'revealed'`, triggers push notifications
4. **Feed** - Revealed photos appear in FeedScreen for user and friends
5. **Triage** - User can set `photo_state: 'journal'` (keep), `'archive'` (hide), or delete permanently

The darkroom uses a rolling random reveal system:
- `calculateNextRevealTime()` - Returns a timestamp 0-5 random minutes from now
- `scheduleNextReveal(userId)` - Sets `next_reveal_at` in the users table
- `isDarkroomReadyToReveal(userId)` - Checks if current time >= `next_reveal_at`
- `revealPhotos(userId)` - Updates all developing photos to revealed status
- Three reveal triggers: App.tsx on foreground, DarkroomScreen on focus, `process-darkroom-reveals` Edge Function via pg_cron every 2 minutes

### Custom Hooks

- `useCamera()` - Camera permissions, capture, flash, facing, zoom levels, upload queue. Exports layout constants: `TAB_BAR_HEIGHT`, `FOOTER_HEIGHT`, `CAMERA_HEIGHT`
- `useDarkroom()` - Developing/revealed photos subscription, countdown timer, reveal logic
- `useFeedPhotos()` - Real-time feed subscription via Supabase Realtime, photo grouping by user
- `useComments()` - Comment CRUD, real-time subscriptions, mention parsing
- `useMentionSuggestions()` - Autocomplete for @mentions in comments
- `usePhotoDetailModal()` - Modal state, swipe navigation, photo context
- `useSwipeableCard()` - Gesture handling for tinder-style swiping
- `useViewedStories()` - Track which users' photos have been viewed
- `useScreenTrace()` - Sentry performance transaction traces
- `useMessages()` - Conversation list subscription, friend data joining, unread count aggregation, optimistic delete
- `useConversation()` - Individual conversation messages subscription, cursor pagination, send, read tracking

### Context Providers

- **AuthContext** - Supabase user session, userProfile (from `users` table), `signOut()`, `updateProfile()`, `cancelDeletion()`
- **PhotoDetailContext** - Two hooks: `usePhotoDetail()` for full state + actions, `usePhotoDetailActions()` for actions only (avoids re-renders). Supports two modes: `'feed'` and `'stories'` (with friend-to-friend navigation)
- **ThemeProvider** - Dark mode toggle (currently unused, app is dark-only)

### Offline Support (PowerSync)

PowerSync provides offline-first capabilities with local SQLite:

- Reads go through the local PowerSync database (instant, works offline)
- Writes are queued locally and synced to Supabase PostgreSQL when online
- Sync rules define which rows each user receives (replaces Firestore security rules)
- PowerSync schema mirrors the PostgreSQL schema for type safety

### Caching (TanStack Query)

TanStack Query manages server state caching:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Cached query with background refetch
const { data: photos } = useQuery({
  queryKey: ['photos', userId],
  queryFn: () => photoService.getPhotos(userId),
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Mutation with optimistic update
const mutation = useMutation({
  mutationFn: photoService.deletePhoto,
  onMutate: async (photoId) => {
    await queryClient.cancelQueries({ queryKey: ['photos'] });
    // optimistic remove...
  },
});
```

### Logging

**Never use `console.log()` directly.** Always use the logger utility:

```typescript
import logger from '../utils/logger';

logger.debug('Detailed info', { userId, count }); // Dev only
logger.info('Important events', { photoId });     // Production
logger.warn('Recoverable issues', { error });     // Production
logger.error('Failures', { error: error.message }); // Production
```

Logger redacts sensitive data (tokens, passwords, keys). `console.log` is stripped from production builds via babel `transform-remove-console`.

### Import Organization

Organize imports in this exact order with blank lines between groups:

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';

import { feedService } from '../services/supabase/feedService';

import { FeedPhotoCard } from '../components';

import { useAuth } from '../context/AuthContext';

import { logger } from '../utils/logger';

import type { Photo } from '../types/models';
```

1. React and React Native core
2. Third-party packages (Supabase, TanStack Query, navigation, etc.)
3. Internal services
4. Components
5. Context and hooks
6. Utilities
7. Type imports

## Supabase Specifics

### Supabase Client Setup

This project uses the **Supabase JS SDK** (`@supabase/supabase-js`) with `@react-native-async-storage/async-storage` for session persistence:

```typescript
// CORRECT - Supabase JS SDK
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '../types/database';

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Query example
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();
```

### PostgreSQL Tables (with RLS)

- `users` - User profiles (id, username, display_name, photo_url, friends, fcm_token, next_reveal_at, etc.)
- `photos` - All photos (user_id, photo_url, status: `'developing'`|`'revealed'`, photo_state: `'journal'`|`'archive'`|null, created_at)
- `friendships` - Friend relationships (user1_id, user2_id, status: `'pending'`|`'accepted'`)
- `comments` - Photo comments (photo_id, user_id, text, mentions, created_at)
- `albums` - User-created albums (user_id, title, photo_ids, cover_photo_id)
- `notifications` - In-app notifications (user_id, type, read, created_at). Auto-deleted after 30 days via pg_cron.
- `blocks` - User blocking relationships (blocker_id, blocked_id)
- `reports` - User reports (reporter_id, reported_id, reason)
- `reaction_batches` - Batched reaction notifications (photo_id, reactor_id, reactions, status, sent_at). Auto-deleted 7 days after sending via pg_cron.
- `conversations` - Direct messaging conversations (participants, last_message, deleted_at, unread_count). Primary key: composite of sorted user IDs.
- `messages` - Individual messages (conversation_id, sender_id, text, gif_url, type, created_at). Messages are permanent (never deleted, retained for moderation).

All tables use Row Level Security (RLS) policies. Users can only read/write data they are authorized to access. RLS replaces the need for most server-side authorization checks.

### Edge Functions Structure

Edge Functions live in `supabase/functions/` and run on Deno:

```
supabase/functions/
+-- process-darkroom-reveals/   # Scheduled via pg_cron every 2 minutes
+-- send-notification/          # Push notification sending
+-- batch-reactions/            # Reaction debouncing/batching
+-- cleanup-expired/            # Delete old notifications, reaction batches
+-- process-account-deletion/   # Account deletion after recovery period
+-- dm-metadata/                # DM metadata updates
+-- _shared/                    # Shared utilities
    +-- supabaseAdmin.ts        # Admin client (bypasses RLS)
    +-- validation.ts           # Zod schemas for request validation
    +-- notifications/
        +-- batching.ts         # Reaction debouncing/batching
        +-- receipts.ts         # Reaction receipts
        +-- sender.ts           # Push notification sending
```

Notification templates are randomized for a non-robotic feel (e.g., "X tagged you in a photo", "You're in X's latest snap").

### Environment Variables

Supabase config is provided via environment variables, NOT native config files. Required env vars via `react-native-dotenv` (imported from `@env`):

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous/public key
- `GIPHY_API_KEY` - Giphy API key (optional)

Edge Functions access secrets via `Deno.env.get()`:
- `SUPABASE_SERVICE_ROLE_KEY` - Admin access (bypasses RLS)
- `EXPO_ACCESS_TOKEN` - For sending push notifications

## Code Conventions

### File Naming
- Components: PascalCase (`FeedPhotoCard.tsx`)
- Services/Utilities: camelCase (`feedService.ts`, `timeUtils.ts`)
- Screens: PascalCase with `Screen` suffix (`FeedScreen.tsx`)
- Hooks: camelCase with `use` prefix (`useCamera.ts`)
- Types: PascalCase in `src/types/` (`database.ts`, `models.ts`, `navigation.ts`)

### Function Naming
- All functions: camelCase (`uploadPhoto`, `sendFriendRequest`)
- Event handlers: `handle` prefix (`handleCapturePhoto`, `handleLogin`)
- Boolean returns: `is`/`has` prefix (`isDarkroomReady`, `hasPermission`)

### Commit Messages

Format: `type(scope): description`

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

After completing each plan or phase of work, commit the changes before moving on. Do not batch multiple plans into a single commit.

## Common Gotchas

1. **Supabase Auth Session** - Use `supabase.auth.onAuthStateChange()` to listen for auth events. The session is automatically persisted in AsyncStorage. Always check `session?.user` before accessing user data.

2. **PostgreSQL Timestamps** - Use `now()` in SQL or omit `created_at`/`updated_at` columns (use database defaults). When reading, timestamps come as ISO 8601 strings — no `.toDate()` conversion needed.

3. **Darkroom Reveal Timing** - After each reveal, `calculateNextRevealTime()` schedules the next reveal 0-5 random minutes in the future. Reveals are triggered three ways: App.tsx checks on foreground, DarkroomScreen checks on focus, and `process-darkroom-reveals` Edge Function runs every 2 minutes via pg_cron as a background catch-all.

4. **Navigation Params in Nested Navigators** - When navigating to a tab screen with params, use a two-step approach:
   ```typescript
   navigationRef.current.navigate('MainTabs', { screen: 'Camera' });
   setTimeout(() => {
     navigationRef.current.navigate('MainTabs', {
       screen: 'Camera',
       params: { openDarkroom: true }
     });
   }, 100);
   ```

5. **Image Caching** - Use `expo-image` (not `react-native` Image) for automatic caching. Set `cachePolicy="memory-disk"` for profile photos.

6. **Push Notifications** - The app uses `expo-notifications`. Push tokens are stored in user rows and sent to Edge Functions for delivery via Expo's push service.

7. **Storage URLs** - Photos use Supabase Storage. Public buckets use permanent public URLs. Private buckets use signed URLs with configurable expiry. `storageService` handles URL generation.

8. **Account Deletion** - Soft delete with recovery period via `accountService`. `DeletionRecoveryModal` shows countdown. `cancelDeletion()` in AuthContext to recover.

9. **PhotoDetail Modes** - PhotoDetailContext supports `'feed'` mode (single user's photos) and `'stories'` mode (swipe between friends). Use `usePhotoDetailActions()` when you only need to trigger actions without subscribing to state changes.

10. **Performance Monitoring** - Sentry is integrated via `useScreenTrace()` hook and transaction-based tracing in `performanceService`. Disabled in `__DEV__` to avoid polluting production metrics.

11. **Android Platform Guards** - Always wrap Android-only code in `Platform.OS === 'android'` checks or use `.android.tsx` file extensions. Never apply Android-specific styles (e.g. `elevation`) unconditionally — they are ignored on iOS but can cause unexpected layout on Android if misused.

12. **Android Shadows** - iOS uses `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`. Android uses `elevation`. Use `Platform.select` when shadows are needed on both platforms.

13. **Android Back Button** - Android has a hardware/gesture back button. For screens that are modals or overlays, add a `BackHandler` listener (or `useFocusEffect` + `BackHandler`) to prevent unexpected back navigation. React Navigation handles this for standard stack screens automatically.

14. **Edge-to-Edge on Android** - `edgeToEdgeEnabled: true` in `app.json` means the app draws behind the system gesture navigation bar. Use `useSafeAreaInsets()` bottom inset to add padding where needed (tab bar, bottom sheets, fixed footers).

15. **RLS Policies** - All database access goes through RLS. When debugging "no rows returned" issues, check RLS policies first. Use the Supabase dashboard SQL editor with `set role authenticated; set request.jwt.claims = '...'` to test policies.

16. **PowerSync Sync Rules** - When adding new tables or columns, update both the PowerSync sync rules (which rows sync to which users) and the PowerSync client schema. Mismatched schemas cause silent sync failures.

17. **TanStack Query Keys** - Use consistent, hierarchical query keys (e.g., `['photos', userId]`, `['photos', photoId, 'comments']`). Invalidate parent keys to refresh all child queries. Always invalidate after mutations.
