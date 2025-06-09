import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import * as Contacts from 'expo-contacts';
import { auth, db } from './firebaseConfig';
import { User as FirebaseUser } from 'firebase/auth';

// This param list should match the one for its parent navigator in App.tsx
type OnboardingStackParamList = {
  OnboardingIntro: undefined;
  ConnectContacts: undefined;
  CreateProfileFirstName: undefined;
  AddFriends: undefined;
};

type Props = StackScreenProps<OnboardingStackParamList, 'ConnectContacts'>;

export default function ConnectContactsScreen({ navigation }: Props) {
  const [loading, setLoading] = React.useState(false);

  // This function creates the user document AFTER permission is granted.
  const createUserProfileAndProceed = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'Authentication session not found.');
      setLoading(false);
      return;
    }

    try {
      // Create or merge the user document in Firestore.
      await db
        .collection('users')
        .doc(currentUser.uid)
        .set(
          {
            uid: currentUser.uid,
            phoneNumber: currentUser.phoneNumber,
            createdAt: new Date(),
            contactsEnabled: true, // Permission is required, so this is always true
            // Add other default fields for a new profile
            onboardingReason: 'Skipped Intro Question', // Placeholder
            displayName: '',
            username: '',
            bio: '',
            photoURL: '',
            firstName: '',
            lastName: '',
          },
          { merge: true } // Use merge:true to avoid overwriting
        );

      navigation.navigate('CreateProfileFirstName');
    } catch (error) {
      console.error('Failed to create user profile:', error);
      Alert.alert('Error', 'Could not save your profile. Please try again.');
      setLoading(false);
    }
  };

  const handleAllowPress = async () => {
    // This triggers the actual system permissions dialog
    const { status } = await Contacts.requestPermissionsAsync();

    if (status === 'granted') {
      setLoading(true);
      await createUserProfileAndProceed();
    } else {
      // User denied the permission in the system dialog
      Alert.alert(
        'Permission Required',
        'Kale is a friends app and requires contacts to find people you know. Please enable contacts in your phone settings to continue.',
        [
          { text: 'Okay', style: 'cancel' },
          {
            text: 'Go to Settings',
            onPress: () => Linking.openSettings(),
          },
        ]
      );
    }
  };

  const handleDontAllowPress = () => {
    Alert.alert(
      'Contacts Are Required',
      'To find your friends, Kale needs access to your contacts. This is a core feature of the app.',
      [{ text: 'I Understand', style: 'default' }]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.quote}>
        Kale needs to suggest friends.
      </Text>

      {/* This view covers the screen to center the mock notification */}
      <View style={styles.mockNotificationOverlay}>
        {loading ? (
          <ActivityIndicator size="large" color="#8BA637" />
        ) : (
          <View style={styles.mockNotificationContainer}>
            <Text style={styles.mockNotificationTitle}>
              "Kale" Would Like to Access Your Contacts
            </Text>
            <Text style={styles.mockNotificationBody}>
              Kale uses your contacts to help you find and connect with
              friends. Your contacts are never shared or spammed.
            </Text>
            <View style={styles.mockNotificationActions}>
              <Pressable
                style={styles.mockNotificationButton}
                onPress={handleAllowPress}
              >
                <Text style={styles.mockNotificationButtonText}>
                  Allow
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
      <View style={styles.privacyNote}>
        <Text style={styles.privacyNoteText}>🔒 Kale cares about your privacy and will NEVER text or spam your contacts. Period.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 120,
    paddingHorizontal: 40,
  },
  quote: {
    fontSize: 50,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
    textAlign: 'center',
    lineHeight: 56,
  },
  highlightedText: {
    color: '#4F6A56',
  },
  // Mock Notification Styles
  mockNotificationOverlay: {
    // This makes the view take up the whole screen and center its content
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockNotificationContainer: {
    width: '85%',
    maxWidth: 300,
    backgroundColor: 'rgba(242, 242, 242, 0.95)', // Slightly transparent bg for the "glass" effect
    borderRadius: 14,
    alignItems: 'center',
    paddingTop: 20,
    // iOS-style shadow
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  mockNotificationTitle: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 20,
    color: '#000',
    fontWeight: '700', // Making it bold-like
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  mockNotificationBody: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  mockNotificationActions: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(60, 60, 67, 0.29)', // iOS-like separator color
  },
  mockNotificationButton: {
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockNotificationButtonText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 20,
    color: '#007AFF', // Standard iOS blue for action buttons
    fontWeight: '700', // Making it bold since it's the only action
  },
  mockNotificationButtonTextBold: {
    fontWeight: '700',
  },
  privacyNote: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  privacyNoteText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 18,
    color: '#B9B9B9',
    textAlign: 'center',
  },
});