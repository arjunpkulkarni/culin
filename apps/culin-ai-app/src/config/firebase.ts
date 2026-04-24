import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
// Optional: Uncomment if you want to use Analytics
// import { getAnalytics } from 'firebase/analytics';

// Your Firebase configuration
// Using environment variables for security (recommended)
// If env vars are not set, fall back to direct config values
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyAuUinAVxY2BB5rF3Fe-qH-5cy_bpl0F2g",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "culinai-app.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "culinai-app",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "culinai-app.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "768641884836",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:768641884836:web:901ccd486128e29256bc31",
  // measurementId is optional and only needed for Analytics
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-G4XLPM6W9H",
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    // Persist auth state on React Native (iOS/Android); web uses default persistence
    if (Platform.OS !== 'web') {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage),
      });
    } else {
      auth = getAuth(app);
    }
    db = getFirestore(app);
  } else {
    app = getApps()[0] as FirebaseApp;
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
  // App can still start, but Firebase features won't work
}

export { app, auth, db };

