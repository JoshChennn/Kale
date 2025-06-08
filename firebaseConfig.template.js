// START OF FILE firebaseConfig.js

// Use the 'compat' entry points for maximum stability
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import 'firebase/compat/functions'; // Import compat functions

// This import is still necessary for Firebase to detect and use it.
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

// Initialize Firebase App (ensure it's only initialized once)
let app;
if (!firebase.apps.length) {
  app = firebase.initializeApp(firebaseConfig);
} else {
  app = firebase.app(); // Get the default app if already initialized
}

// Initialize Firebase Auth. It will automatically use AsyncStorage for persistence.
const auth = firebase.auth();

// Initialize other services
const db = firebase.firestore();
const storage = firebase.storage();
const functions = firebase.functions(); // Initialize functions

export { auth, db, storage, functions, firebase }; // Export firebase as well 