import { column, Schema, Table } from '@powersync/react-native';

const photos = new Table(
  {
    user_id: column.text,
    image_url: column.text,
    local_uri: column.text,
    thumbnail_data_url: column.text,
    status: column.text, // 'developing' | 'revealed'
    photo_state: column.text, // null | 'journal' | 'archive'
    media_type: column.text, // 'photo' | 'video'
    caption: column.text,
    reveal_at: column.text, // ISO timestamp string
    storage_path: column.text,
    comment_count: column.integer,
    reaction_count: column.integer,
    deleted_at: column.text,
    created_at: column.text,
  },
  { indexes: { user_status: ['user_id', 'status'] } },
);

const conversations = new Table({
  participant1_id: column.text,
  participant2_id: column.text,
  last_message_text: column.text,
  last_message_at: column.text,
  last_message_type: column.text,
  last_message_sender_id: column.text,
  unread_count_p1: column.integer,
  unread_count_p2: column.integer,
  deleted_at_p1: column.text,
  deleted_at_p2: column.text,
  created_at: column.text,
});

const friendships = new Table({
  user1_id: column.text,
  user2_id: column.text,
  status: column.text, // 'pending' | 'accepted'
  initiated_by: column.text,
  created_at: column.text,
});

const streaks = new Table({
  user1_id: column.text,
  user2_id: column.text,
  day_count: column.integer,
  last_snap_at_user1: column.text,
  last_snap_at_user2: column.text,
  last_mutual_at: column.text,
  expires_at: column.text,
  warning_sent: column.integer, // SQLite: 0/1 for boolean
  created_at: column.text,
});

export const AppSchema = new Schema({
  photos,
  conversations,
  friendships,
  streaks,
});

export type Database = (typeof AppSchema)['types'];
export type PhotoRow = Database['photos'];
export type ConversationRow = Database['conversations'];
export type FriendshipRow = Database['friendships'];
export type StreakRow = Database['streaks'];
