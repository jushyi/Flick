import React, { createContext, useState, useEffect, useContext, type ReactNode } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';

import { supabase } from '../lib/supabase';

import logger from '../utils/logger';
import { secureStorage } from '../services/secureStorageService';

import type { UserProfile } from '@/types/common';

// TODO(20-01): clearLocalNotificationToken - notification service needs migration to supabase
const clearLocalNotificationToken = async (): Promise<void> => { /* no-op until notification service migrated */ };

interface PendingDeletion {
  isScheduled: boolean;
  scheduledDate: Date;
}

interface AuthContextValue {
  user: { id: string; phone?: string } | null;
  userProfile: UserProfile | null;
  loading: boolean;
  initializing: boolean;
  pendingDeletion: PendingDeletion | null;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  cancelDeletion: () => Promise<{ success: boolean; error?: string }>;
  updateUserProfile: (updatedProfile: UserProfile) => void;
  refreshUserProfile: () => Promise<{ success: boolean; data?: UserProfile; error?: string }>;
  updateUserDocument: (userId: string, updateData: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const getUserProfile = async (userId: string): Promise<{ success: boolean; data?: UserProfile; error?: string }> => {
  try {
    logger.debug('AuthContext.getUserProfile: Fetching', { userId });
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();

    if (error) {
      logger.error('AuthContext.getUserProfile: Failed', { error: error.message });
      return { success: false, error: error.message };
    }

    return { success: true, data: data as UserProfile };
  } catch (err) {
    const e = err as Error;
    logger.error('AuthContext.getUserProfile: Exception', { error: e.message });
    return { success: false, error: e.message };
  }
};

const updateUserDocument = async (
  userId: string,
  updateData: Partial<UserProfile>
): Promise<{ success: boolean; error?: string }> => {
  try {
    logger.debug('AuthContext.updateUserDocument: Updating', {
      userId,
      fields: Object.keys(updateData),
    });

    const { error } = await supabase
      .from('users')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      logger.error('AuthContext.updateUserDocument: Failed', { error: error.message });
      return { success: false, error: error.message };
    }

    logger.info('AuthContext.updateUserDocument: Success', { userId });
    return { success: true };
  } catch (err) {
    const e = err as Error;
    logger.error('AuthContext.updateUserDocument: Exception', { error: e.message });
    return { success: false, error: e.message };
  }
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps): React.JSX.Element => {
  const [user, setUser] = useState<{ id: string; phone?: string } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null);

  useEffect(() => {
    logger.debug('AuthContext: Setting up Supabase auth state listener');

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.debug('AuthContext: Auth state changed', {
        event,
        hasSession: !!session,
        userId: session?.user?.id,
      });

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setUser(session.user as { id: string; phone?: string });

          const profileResult = await getUserProfile(session.user.id);

          if (profileResult.success && profileResult.data) {
            logger.info('AuthContext: User profile loaded', {
              profileSetupCompleted: profileResult.data?.profileSetupCompleted,
            });
            setUserProfile(profileResult.data);

            if ((profileResult.data as Record<string, unknown>).scheduled_for_deletion_at) {
              const scheduledDate = new Date(
                (profileResult.data as Record<string, unknown>).scheduled_for_deletion_at as string
              );
              setPendingDeletion({ isScheduled: true, scheduledDate });
              logger.info('AuthContext: User has pending deletion', {
                scheduledDate: scheduledDate.toISOString(),
              });
            } else {
              setPendingDeletion(null);
            }
          } else if (event === 'SIGNED_IN') {
            logger.debug('AuthContext: No profile found, creating for new user');
            const newProfile = {
              id: session.user.id,
              phone_number: (session.user as { phone?: string }).phone || '',
              username: `user_${Date.now()}`,
              display_name: 'New User',
              photo_url: null,
              bio: '',
              profile_setup_completed: false,
              selects_completed: false,
            } as unknown as UserProfile;
            setUserProfile(newProfile);
          }
        }
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserProfile(null);
        setPendingDeletion(null);
      }

      if (initializing) {
        setInitializing(false);
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // NOTE: Firebase migration bridge removed — all users now authenticate via Supabase directly.

  const signOut = async (): Promise<{ success: boolean; error?: string }> => {
    logger.info('AuthContext: Sign out requested - starting comprehensive cleanup');
    try {
      setLoading(true);
      const userId = user?.id;

      if (userId) {
        try {
          logger.debug('AuthContext: Clearing FCM token from Supabase', { userId });
          await supabase
            .from('users')
            .update({ fcm_token: null, updated_at: new Date().toISOString() })
            .eq('id', userId);
          logger.info('AuthContext: FCM token cleared');
        } catch (fcmError) {
          const e = fcmError as Error;
          logger.warn('AuthContext: Failed to clear FCM token', { error: e.message });
        }
      }

      try {
        await secureStorage.clearAll();
        logger.info('AuthContext: SecureStore cleared');
      } catch (secureStoreError) {
        const e = secureStoreError as Error;
        logger.warn('AuthContext: Failed to clear SecureStore', { error: e.message });
      }

      try {
        await clearLocalNotificationToken();
        logger.info('AuthContext: Local notification token cleared');
      } catch (tokenError) {
        const e = tokenError as Error;
        logger.warn('AuthContext: Failed to clear local notification token', { error: e.message });
      }

      try {
        await AsyncStorage.clear();
        logger.info('AuthContext: AsyncStorage cleared');
      } catch (asyncStorageError) {
        const e = asyncStorageError as Error;
        logger.warn('AuthContext: Failed to clear AsyncStorage', { error: e.message });
      }

      try {
        await Image.clearMemoryCache();
        await Image.clearDiskCache();
        logger.info('AuthContext: expo-image cache cleared');
      } catch (imageCacheError) {
        const e = imageCacheError as Error;
        logger.warn('AuthContext: Failed to clear expo-image cache', { error: e.message });
      }

      await supabase.auth.signOut();

      setUser(null);
      setUserProfile(null);
      logger.info('AuthContext: Sign out successful - all cleanup complete');
      return { success: true };
    } catch (err) {
      const error = err as Error;
      logger.error('AuthContext: Sign out failed', { error: error.message });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const cancelDeletion = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ scheduled_for_deletion_at: null, deletion_reason: null })
        .eq('id', user!.id);

      if (error) {
        logger.error('AuthContext: Failed to cancel deletion', { error: error.message });
        return { success: false, error: error.message };
      }

      setPendingDeletion(null);
      const refreshedProfile = await getUserProfile(user!.id);
      if (refreshedProfile.success && refreshedProfile.data) {
        setUserProfile(refreshedProfile.data);
      }
      logger.info('AuthContext: Deletion canceled');
      return { success: true };
    } catch (err) {
      const e = err as Error;
      logger.error('AuthContext: Failed to cancel deletion', { error: e.message });
      return { success: false, error: e.message };
    }
  };

  const updateUserProfile = (updatedProfile: UserProfile): void => {
    setUserProfile(updatedProfile);
  };

  const refreshUserProfile = async (): Promise<{ success: boolean; data?: UserProfile; error?: string }> => {
    if (!user?.id) {
      logger.warn('refreshUserProfile: No user to refresh');
      return { success: false, error: 'No user' };
    }
    try {
      logger.debug('refreshUserProfile: Fetching latest user profile', { userId: user.id });
      const profileResult = await getUserProfile(user.id);
      if (profileResult.success && profileResult.data) {
        logger.info('refreshUserProfile: Profile refreshed');
        setUserProfile(profileResult.data);
        return { success: true, data: profileResult.data };
      }
      logger.error('refreshUserProfile: Failed to fetch', { error: profileResult.error });
      return profileResult;
    } catch (err) {
      const error = err as Error;
      logger.error('refreshUserProfile: Error', { error: error.message });
      return { success: false, error: error.message };
    }
  };

  const value: AuthContextValue = {
    user,
    userProfile,
    loading,
    initializing,
    pendingDeletion,
    signOut,
    cancelDeletion,
    updateUserProfile,
    refreshUserProfile,
    updateUserDocument,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
