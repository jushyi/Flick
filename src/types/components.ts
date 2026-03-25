/**
 * Shared component prop type definitions
 *
 * Types for component props used across multiple components
 * or that are complex enough to warrant shared definitions.
 */

import type { ReactNode } from 'react';
import type { ViewStyle, TextStyle } from 'react-native';
import type { FeedPhoto } from './services';
import type { UserSummary } from './common';

/**
 * Props for FeedPhotoCard component.
 * Based on src/components/FeedPhotoCard.js.
 */
export type FeedPhotoCardProps = {
  photo: FeedPhoto;
  onPress: (photoId: string) => void;
  onUserPress?: (userId: string) => void;
  onReaction?: (photoId: string) => void;
  isViewed?: boolean;
  style?: ViewStyle;
};

/**
 * Props for FriendCard component.
 * Used in FriendsScreen, BlockedUsersScreen, etc.
 */
export type FriendCardProps = {
  user: UserSummary;
  onPress: (userId: string) => void;
  actionButton?: ReactNode;
  showBorder?: boolean;
  style?: ViewStyle;
};

/**
 * Props for PixelIcon component.
 * Based on src/components/PixelIcon.js.
 */
export type PixelIconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: ViewStyle;
};

/**
 * Props for Button component.
 * Based on src/components/Button.js.
 */
export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: string;
};

/**
 * Props for PixelSpinner component.
 */
export type PixelSpinnerProps = {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  style?: ViewStyle;
};

/**
 * Props for EmptyState component.
 * Based on src/components/EmptyState.js.
 */
export type EmptyStateProps = {
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
};

/**
 * Props for StrokedNameText component.
 */
export type StrokedNameTextProps = {
  children: string;
  fontSize?: number;
  color?: string;
  strokeColor?: string;
  style?: TextStyle;
};

/**
 * Props for ProfileSongCard component.
 */
export type ProfileSongCardProps = {
  song: {
    name: string;
    artist: string;
    preview_url: string;
    artwork_url: string;
  } | null;
  onPress?: () => void;
  onRemove?: () => void;
  editable?: boolean;
  style?: ViewStyle;
};

/**
 * Props for DropdownMenu component.
 */
export type DropdownMenuProps = {
  visible: boolean;
  onClose: () => void;
  items: Array<{
    label: string;
    icon?: string;
    onPress: () => void;
    destructive?: boolean;
  }>;
  anchorPosition?: { x: number; y: number };
};

/**
 * Props for StreakIndicator component.
 */
export type StreakIndicatorProps = {
  streakState?: 'default' | 'building' | 'pending' | 'active' | 'warning';
  dayCount?: number;
  size?: number;
};

/**
 * Props for Toast notification.
 */
export type ToastProps = {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onDismiss?: () => void;
};
