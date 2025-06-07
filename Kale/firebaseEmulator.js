import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { auth, db, storage } from './firebaseConfig'; // Import your initialized services
import { Platform } from 'react-native';

// Use 10.0.2.2 for Android, localhost for other platforms
const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const isEmulatorConnected = auth.emulatorConfig !== null;

// This function connects all services to the local emulators.
// It includes a check to prevent connecting more than once, which can cause errors.
export const connectToEmulators = () => {
  if (!isEmulatorConnected) {
    console.log(`🔌 Connecting to Firebase Emulators at ${host}`);
    
    // Connect to Auth Emulator
    connectAuthEmulator(auth, `http://${host}:9099`);

    // Connect to Firestore Emulator
    connectFirestoreEmulator(db, host, 8080);
    
    // Connect to Storage Emulator
    connectStorageEmulator(storage, host, 9199);
    
    // Connect to Functions Emulator
    const functions = getFunctions();
    connectFunctionsEmulator(functions, host, 5001); // Default port is 5001
  } else {
    console.log('✅ Emulators already connected.');
  }
};