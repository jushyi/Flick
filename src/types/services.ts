/**
 * Service layer type definitions
 *
 * Types for service responses and data models used across
 * Supabase service files, hooks, and screens.
 */

/**
 * Standard service result wrapper.
 * All service functions return this pattern.
 */
export type ServiceResult<T = void> = Promise<{
  success: boolean;
  error?: string;
  data?: T;
}>;

/**
 * Photo record matching the Supabase `photos` table.
 */
export type Photo = {
  id: string;
  user_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  status: 'developing' | 'revealed';
  photo_state: 'journal' | 'archive' | null;
  reaction_count: number;
  tagged_user_ids: string[];
  is_video: boolean;
  video_url: string | null;
  batch_reveal_at: string | null;
  created_at: string;
  revealed_at: string | null;
  deleted_at: string | null;
};

/**
 * Photo with joined user data for feed display.
 */
export type FeedPhoto = Photo & {
  user: {
    id: string;
    username: string;
    display_name: string;
    photo_url: string | null;
  };
};

/**
 * Friendship record matching the Supabase `friendships` table.
 */
export type Friendship = {
  id: string;
  user1_id: string;
  user2_id: string;
  status: 'pending' | 'accepted';
  action_user_id: string;
  created_at: string;
};

/**
 * Comment record matching the Supabase `comments` table.
 */
export type Comment = {
  id: string;
  photo_id: string;
  user_id: string;
  text: string;
  mentions: string[];
  parent_id: string | null;
  image_url: string | null;
  like_count: number;
  created_at: string;
};

/**
 * Conversation record matching the Supabase `conversations` table.
 */
export type Conversation = {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  last_message_type: MessageType | null;
  unread_count_p1: number;
  unread_count_p2: number;
  deleted_at_p1: string | null;
  deleted_at_p2: string | null;
  last_read_at_p1: string | null;
  last_read_at_p2: string | null;
  created_at: string;
};

/**
 * Message types supported by the DM system.
 */
export type MessageType = 'text' | 'reaction' | 'reply' | 'snap' | 'tagged_photo';

/**
 * Message record matching the Supabase `messages` table.
 */
export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string | null;
  gif_url: string | null;
  snap_url: string | null;
  snap_storage_path: string | null;
  type: MessageType;
  reply_to_id: string | null;
  reply_preview: string | null;
  emoji: string | null;
  tagged_photo_id: string | null;
  is_unsent: boolean;
  created_at: string;
};

/**
 * Album record matching the Supabase `albums` table.
 */
export type Album = {
  id: string;
  user_id: string;
  title: string;
  cover_photo_id: string | null;
  photo_count: number;
  created_at: string;
  updated_at: string;
};

/**
 * Notification record matching the Supabase `notifications` table.
 */
export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string | null;
  body: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
};

/**
 * Streak record matching the Supabase `streaks` table.
 */
export type Streak = {
  id: string;
  user1_id: string;
  user2_id: string;
  day_count: number;
  last_mutual_snap_at: string | null;
  last_snap_user1_at: string | null;
  last_snap_user2_at: string | null;
  expires_at: string | null;
  warning_sent: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Block record matching the Supabase `blocks` table.
 */
export type Block = {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

/**
 * Report record matching the Supabase `reports` table.
 */
export type Report = {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  details: string | null;
  created_at: string;
};
