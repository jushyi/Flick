import React, { createContext, useState, useEffect, useContext } from 'react';
// Use React Native Firebase for auth
import { getAuth, onAuthStateChanged as firebaseOnAuthStateChanged } from '@react-native-firebase/auth';
// Keep Firebase JS SDK imports for email/Apple auth (will be removed in Phase 7)
import {
  signUpWithEmail,
  signInWithEmail,
  signOutUser,
  signInWithApple as firebaseSignInWithApple
} from '../services/firebase/authService';
import { createUserDocument, getUserDocument } from '../services/firebase/firestoreService';
import logger from '../utils/logger';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Listen to React Native Firebase auth state changes
  useEffect(() => {
    logger.debug('AuthContext: Setting up auth state listener');

    const auth = getAuth();
    const unsubscribe = firebaseOnAuthStateChanged(auth, async (firebaseUser) => {
      logger.debug('AuthContext: Auth state changed', {
        hasUser: !!firebaseUser,
        userId: firebaseUser?.uid
      });

      if (firebaseUser) {
        setUser(firebaseUser);
        // Reset userProfile to null while we fetch/create it
        // This triggers loading state in AppNavigator
        setUserProfile(null);

        // Fetch user profile from Firestore
        logger.debug('AuthContext: Fetching user profile from Firestore');
        const profileResult = await getUserDocument(firebaseUser.uid);
        if (profileResult.success) {
          logger.debug('AuthContext: User profile loaded', {
            profileSetupCompleted: profileResult.data?.profileSetupCompleted
          });
          setUserProfile(profileResult.data);
        } else {
          // New user via phone auth - create profile
          logger.debug('AuthContext: No user profile found, creating for new user');
          const userDoc = {
            uid: firebaseUser.uid,
            phoneNumber: firebaseUser.phoneNumber || '',
            email: firebaseUser.email || '',
            username: `user_${Date.now()}`,
            displayName: firebaseUser.displayName || 'New User',
            photoURL: firebaseUser.photoURL || null,
            bio: '',
            friends: [],
            profileSetupCompleted: false,
            createdAt: new Date(),
          };

          const createResult = await createUserDocument(firebaseUser.uid, userDoc);
          if (createResult.success) {
            setUserProfile(userDoc);
            logger.info('AuthContext: New user profile created', {
              profileSetupCompleted: userDoc.profileSetupCompleted
            });
          } else {
            // Even if Firestore write fails, use the local userDoc
            // so user can still proceed to ProfileSetup
            logger.error('AuthContext: Failed to create user document in Firestore', {
              error: createResult.error
            });
            setUserProfile(userDoc);
          }
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }

      if (initializing) {
        setInitializing(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signUp = async (email, password, username) => {
    try {
      setLoading(true);

      // Create Firebase Auth account
      const result = await signUpWithEmail(email, password);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Create user document in Firestore
      const userDoc = {
        uid: result.user.uid,
        email: email.toLowerCase(),
        username: username,
        displayName: username,
        photoURL: null,
        bio: '',
        friends: [],
        profileSetupCompleted: false,
        createdAt: new Date(),
      };

      const createDocResult = await createUserDocument(result.user.uid, userDoc);

      if (!createDocResult.success) {
        return { success: false, error: 'Account created but profile setup failed' };
      }

      return { success: true, user: result.user, needsProfileSetup: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      setLoading(true);
      const result = await signInWithEmail(email, password);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signInWithApple = async () => {
    try {
      setLoading(true);
      const result = await firebaseSignInWithApple();

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Check if user document exists
      const profileResult = await getUserDocument(result.user.uid);

      // If first-time Apple user, create profile
      if (!profileResult.success) {
        const userDoc = {
          uid: result.user.uid,
          email: result.user.email || '',
          username: result.user.displayName?.replace(/\s+/g, '_').toLowerCase() || `user_${Date.now()}`,
          displayName: result.user.displayName || 'Apple User',
          photoURL: result.user.photoURL || null,
          bio: '',
          friends: [],
          createdAt: new Date(),
        };

        await createUserDocument(result.user.uid, userDoc);
        return { success: true, user: result.user, needsProfileSetup: true };
      }

      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    logger.info('AuthContext: Sign out requested');
    try {
      setLoading(true);
      // Use React Native Firebase signOut
      const auth = getAuth();
      await auth.signOut();
      setUser(null);
      setUserProfile(null);
      logger.info('AuthContext: Sign out successful');
      return { success: true };
    } catch (error) {
      logger.error('AuthContext: Sign out failed', { error: error.message });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const updateUserProfile = (updatedProfile) => {
    setUserProfile(updatedProfile);
  };

  const value = {
    user,
    userProfile,
    loading,
    initializing,
    // Email auth (will be removed in Phase 7)
    signUp,
    signIn,
    signInWithApple,
    // Common
    signOut,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
