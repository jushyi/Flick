import React, { createContext, useState, useEffect, useContext } from 'react';
// Use React Native Firebase for auth and firestore (required for phone auth)
import {
  getAuth,
  onAuthStateChanged as firebaseOnAuthStateChanged,
} from '@react-native-firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import logger from '../utils/logger';

// Initialize Firestore
const db = getFirestore();

// React Native Firebase Firestore functions for phone auth users
// These use the native SDK which shares auth state with RN Firebase Auth
const createUserDocumentNative = async (userId, userData) => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      ...userData,
      createdAt: serverTimestamp(),
      dailyPhotoCount: 0,
      lastPhotoDate: new Date().toISOString().split('T')[0],
    });
    return { success: true };
  } catch (error) {
    logger.error('createUserDocumentNative: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

const getUserDocumentNative = async userId => {
  try {
    logger.debug('getUserDocumentNative: Fetching user document', { userId });
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    // Modular API uses exists() as a method
    const docExists = userDoc.exists();
    logger.debug('getUserDocumentNative: Document fetched', {
      userId,
      exists: docExists,
      hasData: !!userDoc.data(),
    });
    if (docExists) {
      const data = userDoc.data();
      logger.debug('getUserDocumentNative: User found', {
        userId,
        profileSetupCompleted: data?.profileSetupCompleted,
      });
      return { success: true, data: { id: userDoc.id, ...data } };
    }
    logger.debug('getUserDocumentNative: User not found', { userId });
    return { success: false, error: 'User not found' };
  } catch (error) {
    logger.error('getUserDocumentNative: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

const updateUserDocumentNative = async (userId, updateData) => {
  try {
    logger.debug('updateUserDocumentNative: Updating user document', {
      userId,
      fields: Object.keys(updateData),
    });
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...updateData,
      updatedAt: serverTimestamp(),
    });
    logger.info('updateUserDocumentNative: Success', { userId });
    return { success: true };
  } catch (error) {
    logger.error('updateUserDocumentNative: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

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
    const unsubscribe = firebaseOnAuthStateChanged(auth, async firebaseUser => {
      logger.debug('AuthContext: Auth state changed', {
        hasUser: !!firebaseUser,
        userId: firebaseUser?.uid,
      });

      if (firebaseUser) {
        setUser(firebaseUser);
        // Reset userProfile to null while we fetch/create it
        // This triggers loading state in AppNavigator
        setUserProfile(null);

        // Fetch user profile from Firestore using native SDK (shares auth state with RN Firebase Auth)
        logger.debug('AuthContext: Fetching user profile from Firestore (native)', {
          userId: firebaseUser.uid,
        });
        const profileResult = await getUserDocumentNative(firebaseUser.uid);
        logger.debug('AuthContext: getUserDocumentNative result', {
          success: profileResult.success,
          hasData: !!profileResult.data,
          error: profileResult.error,
        });
        if (profileResult.success) {
          logger.info('AuthContext: User profile loaded - checking profileSetupCompleted', {
            profileSetupCompleted: profileResult.data?.profileSetupCompleted,
            willShowProfileSetup: profileResult.data?.profileSetupCompleted === false,
          });
          setUserProfile(profileResult.data);
        } else {
          // New user via phone auth - create profile using native Firestore
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
          };

          const createResult = await createUserDocumentNative(firebaseUser.uid, userDoc);
          if (createResult.success) {
            const newProfile = { ...userDoc, createdAt: new Date() };
            logger.info('AuthContext: New user profile created - setting userProfile', {
              profileSetupCompleted: newProfile.profileSetupCompleted,
              willShowProfileSetup: newProfile.profileSetupCompleted === false,
            });
            setUserProfile(newProfile);
          } else {
            // Even if Firestore write fails, use the local userDoc
            // so user can still proceed to ProfileSetup
            logger.error('AuthContext: Failed to create user document in Firestore', {
              error: createResult.error,
            });
            const fallbackProfile = { ...userDoc, createdAt: new Date() };
            logger.info('AuthContext: Using fallback profile - setting userProfile', {
              profileSetupCompleted: fallbackProfile.profileSetupCompleted,
              willShowProfileSetup: fallbackProfile.profileSetupCompleted === false,
            });
            setUserProfile(fallbackProfile);
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

  const updateUserProfile = updatedProfile => {
    setUserProfile(updatedProfile);
  };

  const value = {
    user,
    userProfile,
    loading,
    initializing,
    // Phone-only auth
    signOut,
    updateUserProfile,
    // Native Firestore operations (required for phone auth users)
    updateUserDocumentNative,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
