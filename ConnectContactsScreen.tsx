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
  OnboardingQuestion: undefined;
  ConnectContacts: undefined;
  AddFriends: undefined;
};

type Props = StackScreenProps<OnboardingStackParamList, 'ConnectContacts'>;

export default function ConnectContactsScreen({ navigation }: Props) {
  const [loading, setLoading] = React.useState(false);

  // This function now handles BOTH creating and updating the user document.
  const handlePermissionChoice = async (enabled: boolean) => {
    setLoading(true);
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
            contactsEnabled: enabled,
            // Add other default fields for a new profile
            onboardingReason: 'Skipped Intro Question', // Placeholder
            displayName: '',
            username: '',
            bio: '',
            photoURL: '',
          },
          { merge: true }
        ); // Use merge:true to avoid overwriting if doc somehow exists

      navigation.navigate('AddFriends');
    } catch (error) {
      console.error('Failed to update user profile:', error);
      Alert.alert('Error', 'Could not save your choice. Please try again.');
      setLoading(false);
    }
  };

  const handleEnableContacts = async () => {
    setLoading(true);
    const { status } = await Contacts.requestPermissionsAsync();

    if (status === 'granted') {
      await handlePermissionChoice(true);
    } else {
      setLoading(false); // Stop loading before showing Alert
      Alert.alert(
        'Permission Denied',
        'Kale works best with friends. You can enable contacts later in your phone settings to find people you know.',
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

  const handleSkip = async () => {
    await handlePermissionChoice(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.quote}>
          Kale is a <Text style={styles.highlightedText}>friends</Text> app.
        </Text>
      </View>

      <View style={styles.bottomContainer}>
        {loading ? (
          <ActivityIndicator size="large" color="#8BA637" />
        ) : (
          <>
            <Pressable
              onPress={handleEnableContacts}
              style={({ pressed }) => [
                styles.optionButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.optionButtonText}>📒 Enable contacts</Text>
            </Pressable>
            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => [
                styles.secondaryOptionButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.secondaryOptionButtonText}>Skip for now</Text>
            </Pressable>
          </>
        )}
      </View>
      <View style={styles.privacyContainer}>
        <Text style={styles.lockSymbol}>🔒</Text>
        <Text style={styles.privacyText}>
          Kale cares about your privacy and will NEVER text or spam your
          contacts. Period.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    padding: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quote: {
    fontSize: 60,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
    textAlign: 'center',
    marginBottom: -20,
    lineHeight: 66,
  },
  bottomContainer: {
    paddingBottom: 40,
    marginBottom: 100,
  },
  optionButton: {
    backgroundColor: '#8BA637',
    borderRadius: 25,
    height: 48,
    justifyContent: 'center',
    marginBottom: 15,
  },
  secondaryOptionButton: {
    backgroundColor: 'transparent',
    borderRadius: 25,
    height: 48,
    justifyContent: 'center',
    marginBottom: 15,
  },
  optionButtonText: {
    color: '#F2F2F2',
    fontSize: 20,
    fontFamily: 'PatrickHand-Regular',
    textAlign: 'center',
  },
  secondaryOptionButtonText: {
    color: '#8BA637',
    fontSize: 20,
    fontFamily: 'PatrickHand-Regular',
    textAlign: 'center',
  },
  privacyContainer: {
    position: 'absolute',
    bottom: 60,
    left: 40,
    right: 40,
    alignItems: 'center',
  },
  lockSymbol: {
    fontSize: 24,
    marginBottom: 8,
  },
  privacyText: {
    color: '#8BA637',
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  highlightedText: {
    color: '#4F6A56',
  },
});