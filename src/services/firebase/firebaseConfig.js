import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAh25TU1FwnsFdUTpP_iVZrjaF3ATcW2CA",
  authDomain: "re-lapse-fa89b.firebaseapp.com",
  projectId: "re-lapse-fa89b",
  storageBucket: "re-lapse-fa89b.firebasestorage.app",
  messagingSenderId: "958995611148",
  appId: "1:958995611148:web:619261e38f30793a6e3829"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with AsyncStorage persistence for React Native
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

// Export Firebase services
export { app, auth, db, storage };
