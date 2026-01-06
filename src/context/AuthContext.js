import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase/firebaseConfig';
import {
  signUpWithEmail,
  signInWithEmail,
  signOutUser,
  signInWithApple as firebaseSignInWithApple
} from '../services/firebase/authService';
import { createUserDocument, getUserDocument } from '../services/firebase/firestoreService';

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
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // Fetch user profile from Firestore
        const profileResult = await getUserDocument(firebaseUser.uid);
        if (profileResult.success) {
          setUserProfile(profileResult.data);
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
    try {
      setLoading(true);
      const result = await signOutUser();

      if (result.success) {
        setUser(null);
        setUserProfile(null);
      }

      return result;
    } catch (error) {
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
    signUp,
    signIn,
    signInWithApple,
    signOut,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};