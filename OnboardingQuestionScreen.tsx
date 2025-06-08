import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { auth, db } from './firebaseConfig';

// This param list should now match the OnboardingStack navigator in App.tsx
type OnboardingStackParamList = {
  OnboardingIntro: undefined;
  OnboardingQuestion: undefined;
  ConnectContacts: undefined;
  AddFriends: undefined;
};

// The component now receives navigation props from the stack navigator
type Props = StackScreenProps<OnboardingStackParamList, 'OnboardingQuestion'>;

const ONBOARDING_OPTIONS = [
  'I want to escape Instagram',
  'A friend invited me',
  'Just checking it out',
  'Other',
];

export default function OnboardingQuestionScreen({ navigation }: Props) {
  const [loading, setLoading] = React.useState(false);

  // This function now saves the user's answer and navigates to the next step
  const handleOptionSelect = async (option: string) => {
    setLoading(true);
    const currentUser = auth.currentUser;

    if (!currentUser) {
      Alert.alert(
        'Error',
        'Authentication session not found. Please try signing in again.'
      );
      setLoading(false);
      return;
    }

    try {
      // Create the user document in Firestore. This is what App.tsx checks for.
      await db.collection('users').doc(currentUser.uid).set({
        uid: currentUser.uid,
        phoneNumber: currentUser.phoneNumber,
        createdAt: new Date(),
        onboardingReason: option,
        // Add other default fields for a new profile
        displayName: '',
        username: '',
        bio: '',
        photoURL: '',
        contactsEnabled: null, // Add a placeholder for the next step
      });

      // On success, navigate to the next screen in the onboarding flow.
      navigation.navigate('ConnectContacts');
    } catch (error) {
      console.error('Failed to create user profile:', error);
      Alert.alert(
        'Error',
        'Could not complete your profile setup. Please try again.'
      );
      setLoading(false); // Stop loading only on error
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.quote}>
          Kale is Instagram without the <Text style={styles.highlightedText}>cocaine</Text>.
        </Text>
      </View>

      <View style={styles.bottomContainer}>
        {loading ? (
          <ActivityIndicator size="large" color="#8BA637" />
        ) : (
          <>
            <Text style={styles.subtitle}>Why do you want to join Kale? 🥬</Text>
            <Pressable
              key={ONBOARDING_OPTIONS[0]}
              onPress={() => handleOptionSelect(ONBOARDING_OPTIONS[0])}
              style={({ pressed }) => [
                styles.optionButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.optionButtonText}>{ONBOARDING_OPTIONS[0]}</Text>
            </Pressable>
            {ONBOARDING_OPTIONS.slice(1).map((option) => (
              <Pressable
                key={option}
                onPress={() => handleOptionSelect(option)}
                style={({ pressed }) => [
                  styles.secondaryOptionButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.secondaryOptionButtonText}>{option}</Text>
              </Pressable>
            ))}
          </>
        )}
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
  subtitle: {
    fontSize: 28,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
    textAlign: 'center',
    marginBottom: 40,
  },
  bottomContainer: {
    paddingBottom: 40,
  },
  optionButton: {
    backgroundColor: '#8BA637',
    borderRadius: 25,
    height: 48,
    justifyContent: 'center',
    marginBottom: 15,
  },
  secondaryOptionButton: {
    backgroundColor: 'rgba(139, 166, 55, 0.1)',
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
  highlightedText: {
    color: '#4F6A56',
  },
});