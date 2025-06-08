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
  apiKey: "AIzaSyAS9ZQSJv--sieb9Nnfvz3b3FhD8JNhrWI",
  authDomain: "kale-dc816.firebaseapp.com",
  projectId: "kale-dc816",
  storageBucket: "kale-dc816.firebasestorage.app",
  messagingSenderId: "945270923941",
  appId: "1:945270923941:web:a07c1ca52ecd1ea80d234c",
  measurementId: "G-GX5BLYHQN6"
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
// auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); // ✅ REMOVED THIS LINE

// Initialize other services
const db = firebase.firestore();
const storage = firebase.storage();
const functions = firebase.functions(); // Initialize functions

export { auth, db, storage, functions, firebase }; // Export firebase as well