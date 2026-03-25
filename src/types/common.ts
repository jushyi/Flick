/**
 * Common utility types used across the codebase
 *
 * Shared type definitions for general patterns.
 */

import type { ReactNode } from 'react';

/** Adds a `children` prop to any type */
export type WithChildren<T = object> = T & { children: ReactNode };

/**
 * Discriminated union for async operation results.
 * Used by service functions that return success/error outcomes.
 */
export type AsyncResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Shorthand for nullable values */
export type Nullable<T> = T | null;

/**
 * User profile shape matching the Supabase `users` table.
 * Field names use snake_case to match database columns.
 */
export type UserProfile = {
  id: string;
  username: string;
  display_name: string;
  phone_number: string;
  photo_url: string | null;
  friend_count: number;
  daily_photo_count: number;
  selects: string[] | null;
  song: {
    name: string;
    artist: string;
    preview_url: string;
    artwork_url: string;
  } | null;
  pinned_snap_data: Record<string, unknown> | null;
  fcm_token: string | null;
  bio: string | null;
  profile_color: string | null;
  profileSetupCompleted: boolean;
  selectsCompleted: boolean;
  contactsSyncCompleted: boolean | undefined;
  notificationPermissionCompleted: boolean;
  created_at: string;
  updated_at: string;
  deletion_scheduled_at: string | null;
  readReceiptsEnabled?: boolean;
  read_receipts_enabled?: boolean;
  notificationPreferences?: {
    enabled: boolean;
    likes: boolean;
    comments: boolean;
    follows: boolean;
    friendRequests: boolean;
    mentions: boolean;
    tags: boolean;
    streakWarnings?: boolean;
  };
  soundPreferences?: {
    shutter: boolean;
    notifications: boolean;
    haptics: boolean;
  };
  is_contributor?: boolean;
};

/**
 * Minimal user info used for display in lists, cards, etc.
 */
export type UserSummary = Pick<
  UserProfile,
  'id' | 'username' | 'display_name' | 'photo_url'
>;
