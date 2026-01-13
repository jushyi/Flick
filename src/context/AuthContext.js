import React, { createContext, useState, useEffect, useContext } from 'react';
// Use React Native Firebase for auth state listener (required for phone auth)
import auth from '@react-native-firebase/auth';
// Keep Firebase JS SDK imports for email/Apple auth (will be removed in Phase 7)
import {
  signUpWithEmail,
  signInWithEmail,
  signOutUser,
  signInWithApple as firebaseSignInWithApple
} from '../services/firebase/authService';
import { createUserDocument, getUserDocument } from '../services/firebase/firestoreService';
// Phone auth service functions
import {
  sendVerificationCode,
  verifyCode,
} from '../services/firebase/phoneAuthService';
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
  // Phone auth confirmation result (used between PhoneInput and Verification screens)
  const [confirmationResult, setConfirmationResult] = useState(null);

  // Listen to React Native Firebase auth state changes (required for phone auth)
  useEffect(() => {
    logger.debug('AuthContext: Setting up auth state listener');

    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      logger.debug('AuthContext: Auth state changed', {
        hasUser: !!firebaseUser,
        userId: firebaseUser?.uid
      });

      if (firebaseUser) {
        setUser(firebaseUser);

        // Fetch user profile from Firestore
        const profileResult = await getUserDocument(firebaseUser.uid);
        if (profileResult.success) {
          logger.debug('AuthContext: User profile loaded', {
            profileSetupCompleted: profileResult.data?.profileSetupCompleted
          });
          setUserProfile(profileResult.data);
        } else {
          logger.debug('AuthContext: No user profile found (new user)');
          setUserProfile(null);
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
      // Use React Native Firebase signOut (handles both email and phone auth)
      await auth().signOut();
      setUser(null);
      setUserProfile(null);
      setConfirmationResult(null);
      logger.info('AuthContext: Sign out successful');
      return { success: true };
    } catch (error) {
      logger.error('AuthContext: Sign out failed', { error: error.message });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // ==================== Phone Authentication ====================

  /**
   * Send phone verification code
   * @param {string} phoneNumber - Phone number without country code
   * @param {string} countryCode - ISO country code (e.g., 'US', 'GB')
   */
  const sendPhoneVerification = async (phoneNumber, countryCode) => {
    logger.info('AuthContext: Send phone verification requested', { countryCode });
    setLoading(true);
    try {
      const result = await sendVerificationCode(phoneNumber, countryCode);
      if (result.success) {
        setConfirmationResult(result.confirmation);
        logger.info('AuthContext: Verification code sent successfully');
      } else {
        logger.warn('AuthContext: Send verification failed', { error: result.error });
      }
      return result;
    } catch (error) {
      logger.error('AuthContext: Send phone verification error', { error: error.message });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verify phone code and complete sign-in
   * @param {string} code - 6-digit verification code
   */
  const verifyPhoneCode = async (code) => {
    logger.info('AuthContext: Verify phone code requested');
    if (!confirmationResult) {
      logger.error('AuthContext: No confirmation result - verification session expired');
      return { success: false, error: 'Verification session expired. Please request a new code.' };
    }

    setLoading(true);
    try {
      const result = await verifyCode(confirmationResult, code);

      if (result.success) {
        logger.info('AuthContext: Phone verification successful', {
          userId: result.user?.uid,
          isNewUser: result.isNewUser
        });

        // Check if user exists in Firestore
        const profileResult = await getUserDocument(result.user.uid);

        if (!profileResult.success || !profileResult.data) {
          // New user - create basic profile document
          logger.info('AuthContext: Creating profile for new phone user');
          const userDoc = {
            uid: result.user.uid,
            phoneNumber: result.user.phoneNumber || '',
            email: '',
            username: `user_${Date.now()}`,
            displayName: 'New User',
            photoURL: null,
            bio: '',
            friends: [],
            profileSetupCompleted: false,
            createdAt: new Date(),
          };

          const createResult = await createUserDocument(result.user.uid, userDoc);
          if (createResult.success) {
            setUserProfile(userDoc);
            logger.info('AuthContext: New user profile created');
          }

          return { success: true, user: result.user, needsProfileSetup: true };
        }

        // Existing user
        setUserProfile(profileResult.data);
        return { success: true, user: result.user };
      }

      logger.warn('AuthContext: Phone verification failed', { error: result.error });
      return result;
    } catch (error) {
      logger.error('AuthContext: Verify phone code error', { error: error.message });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
      setConfirmationResult(null); // Clear confirmation after attempt
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
    // Phone auth
    sendPhoneVerification,
    verifyPhoneCode,
    confirmationResult,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};