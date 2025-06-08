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
import { auth, db } from './firebaseConfig'; // Optional: if you want to save the choice

// This param list should match the one for its parent navigator in App.tsx
type OnboardingStackParamList = {
  OnboardingQuestion: undefined;
  ConnectContacts: undefined;
};

// Combine navigator props with the custom onOnboardingComplete prop from App.tsx
type Props = StackScreenProps<OnboardingStackParamList, 'ConnectContacts'> & {
  onOnboardingComplete: () => void;
};

export default function ConnectContactsScreen({ onOnboardingComplete }: Props) {
  const [loading, setLoading] = React.useState(false);

  const handleEnableContacts = async () => {
    setLoading(true);
    const { status } = await Contacts.requestPermissionsAsync();

    if (status === 'granted') {
      // In a real app, you might fetch/sync contacts here.
      // We can also update the user's profile to reflect this choice.
      const currentUser = auth.currentUser;
      if (currentUser) {
        await db.collection('users').doc(currentUser.uid).update({ contactsEnabled: true });
      }
      onOnboardingComplete();
    } else {
      Alert.alert(
        'Permission Denied',
        'Kale needs access to your contacts to be able to suggest friends. You can enable this later in your phone settings.',
        [
          { text: 'Okay', style: 'cancel' },
          { text: 'Go to Settings', onPress: () => Linking.openSettings() },
        ]
      );
      setLoading(false);
    }
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
          </>
        )}
      </View>
      <View style={styles.privacyContainer}>
        <Text style={styles.lockSymbol}>🔒</Text>
        <Text style={styles.privacyText}>Kale takes your privacy to the next level and will never text or spam your contacts.</Text>
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
    marginBottom: 200,
  },
  optionButton: {
    backgroundColor: '#8BA637',
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