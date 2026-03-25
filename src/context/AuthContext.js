import React, { createContext, useState, useEffect, useContext } from 'react';

import { getAuth } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';

import { supabase } from '../lib/supabase';

import logger from '../utils/logger';
// TODO(20-01): clearLocalNotificationToken - notification service needs migration to supabase
const clearLocalNotificationToken = async () => { /* no-op until notification service migrated */ };
import { secureStorage } from '../services/secureStorageService';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Fetch user profile from Supabase users table
 */
const getUserProfile = async userId => {
  try {
    logger.debug('AuthContext.getUserProfile: Fetching', { userId });
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();

    if (error) {
      logger.error('AuthContext.getUserProfile: Failed', { error: error.message });
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    logger.error('AuthContext.getUserProfile: Exception', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Update user document in Supabase users table
 */
const updateUserDocument = async (userId, updateData) => {
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
  } catch (error) {
    logger.error('AuthContext.updateUserDocument: Exception', { error: error.message });
    return { success: false, error: error.message };
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [pendingDeletion, setPendingDeletion] = useState(null);

  // Listen to Supabase auth state changes
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
          setUser(session.user);

          // Fetch user profile from Supabase
          const profileResult = await getUserProfile(session.user.id);

          if (profileResult.success) {
            logger.info('AuthContext: User profile loaded', {
              profileSetupCompleted: profileResult.data?.profile_setup_completed,
            });
            setUserProfile(profileResult.data);

            // Check for pending deletion
            if (profileResult.data?.scheduled_for_deletion_at) {
              const scheduledDate = new Date(profileResult.data.scheduled_for_deletion_at);
              setPendingDeletion({
                isScheduled: true,
                scheduledDate,
              });
              logger.info('AuthContext: User has pending deletion', {
                scheduledDate: scheduledDate.toISOString(),
              });
            } else {
              setPendingDeletion(null);
            }
          } else if (event === 'SIGNED_IN') {
            // New user - create minimal profile
            logger.debug('AuthContext: No profile found, creating for new user');
            const newProfile = {
              id: session.user.id,
              phone_number: session.user.phone || '',
              username: `user_${Date.now()}`,
              display_name: 'New User',
              photo_url: null,
              bio: '',
              profile_setup_completed: false,
              selects_completed: false,
            };
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

  // Silent migration bridge: detect Firebase token on mount, call Edge Function, call setSession
  useEffect(() => {
    const attemptMigration = async () => {
      try {
        const firebaseAuth = getAuth();
        const firebaseUser = firebaseAuth.currentUser;
        if (firebaseUser) {
          logger.info('AuthContext: Firebase user detected, attempting migration', {
            uid: firebaseUser.uid,
          });

          const firebaseToken = await firebaseUser.getIdToken();
          const { data, error } = await supabase.functions.invoke('migrate-firebase-auth', {
            body: { firebaseToken },
          });

          if (error) {
            logger.warn('AuthContext: Migration failed, user will re-verify', {
              error: error.message,
            });
          } else if (data?.access_token && data?.refresh_token) {
            // CRITICAL: Set the Supabase session with real tokens from Edge Function
            await supabase.auth.setSession({
              access_token: data.access_token,
              refresh_token: data.refresh_token,
            });
            // onAuthStateChange will fire SIGNED_IN -> AuthContext picks up session
            logger.info('AuthContext: Silent migration completed', { migrated: data.migrated });
          }

          // Sign out of Firebase after migration attempt (success or failure)
          await firebaseAuth.signOut();
          logger.info('AuthContext: Firebase sign out after migration');
        }
      } catch (error) {
        logger.warn('AuthContext: Migration attempt failed', { error: error.message });
      }
    };

    attemptMigration();
  }, []);

  const signOut = async () => {
    logger.info('AuthContext: Sign out requested - starting comprehensive cleanup');
    try {
      setLoading(true);
      const userId = user?.id;

      // Step 1: Clear FCM token from Supabase (while still authenticated)
      if (userId) {
        try {
          logger.debug('AuthContext: Clearing FCM token from Supabase', { userId });
          await supabase
            .from('users')
            .update({ fcm_token: null, updated_at: new Date().toISOString() })
            .eq('id', userId);
          logger.info('AuthContext: FCM token cleared');
        } catch (fcmError) {
          logger.warn('AuthContext: Failed to clear FCM token', {
            error: fcmError.message,
          });
        }
      }

      // Step 2: Clear SecureStore items
      try {
        await secureStorage.clearAll();
        logger.info('AuthContext: SecureStore cleared');
      } catch (secureStoreError) {
        logger.warn('AuthContext: Failed to clear SecureStore', {
          error: secureStoreError.message,
        });
      }

      // Step 3: Clear local notification token reference
      try {
        await clearLocalNotificationToken();
        logger.info('AuthContext: Local notification token cleared');
      } catch (tokenError) {
        logger.warn('AuthContext: Failed to clear local notification token', {
          error: tokenError.message,
        });
      }

      // Step 4: Clear AsyncStorage
      try {
        await AsyncStorage.clear();
        logger.info('AuthContext: AsyncStorage cleared');
      } catch (asyncStorageError) {
        logger.warn('AuthContext: Failed to clear AsyncStorage', {
          error: asyncStorageError.message,
        });
      }

      // Step 5: Clear expo-image cache
      try {
        await Image.clearMemoryCache();
        await Image.clearDiskCache();
        logger.info('AuthContext: expo-image cache cleared');
      } catch (imageCacheError) {
        logger.warn('AuthContext: Failed to clear expo-image cache', {
          error: imageCacheError.message,
        });
      }

      // Step 6: Sign out from Supabase Auth (LAST - after all cleanup)
      await supabase.auth.signOut();

      setUser(null);
      setUserProfile(null);
      logger.info('AuthContext: Sign out successful - all cleanup complete');
      return { success: true };
    } catch (error) {
      logger.error('AuthContext: Sign out failed', { error: error.message });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const cancelDeletion = async () => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ scheduled_for_deletion_at: null, deletion_reason: null })
        .eq('id', user.id);

      if (error) {
        logger.error('AuthContext: Failed to cancel deletion', { error: error.message });
        return { success: false, error: error.message };
      }

      setPendingDeletion(null);
      // Refresh user profile
      const refreshedProfile = await getUserProfile(user.id);
      if (refreshedProfile.success) {
        setUserProfile(refreshedProfile.data);
      }
      logger.info('AuthContext: Deletion canceled');
      return { success: true };
    } catch (error) {
      logger.error('AuthContext: Failed to cancel deletion', { error: error.message });
      return { success: false, error: error.message };
    }
  };

  const updateUserProfile = updatedProfile => {
    setUserProfile(updatedProfile);
  };

  const refreshUserProfile = async () => {
    if (!user?.id) {
      logger.warn('refreshUserProfile: No user to refresh');
      return { success: false, error: 'No user' };
    }
    try {
      logger.debug('refreshUserProfile: Fetching latest user profile', { userId: user.id });
      const profileResult = await getUserProfile(user.id);
      if (profileResult.success) {
        logger.info('refreshUserProfile: Profile refreshed');
        setUserProfile(profileResult.data);
        return { success: true, data: profileResult.data };
      }
      logger.error('refreshUserProfile: Failed to fetch', { error: profileResult.error });
      return profileResult;
    } catch (error) {
      logger.error('refreshUserProfile: Error', { error: error.message });
      return { success: false, error: error.message };
    }
  };

  const value = {
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
