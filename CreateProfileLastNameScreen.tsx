import * as React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { auth, db } from './firebaseConfig';
import { StackScreenProps } from '@react-navigation/stack';

type OnboardingStackParamList = {
  OnboardingIntro: undefined;
  ConnectContacts: undefined;
  CreateProfileFirstName: undefined;
  CreateProfileLastName: undefined;
  CreateProfileUsername: undefined;
  CreateProfilePhoto: undefined;
  AddFriends: undefined;
};

type Props = StackScreenProps<OnboardingStackParamList, 'CreateProfileLastName'>;

export default function CreateProfileLastNameScreen({ navigation }: Props) {
  const [lastName, setLastName] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const currentUser = auth.currentUser;

  const handleContinue = async () => {
    if (!lastName.trim()) {
      Alert.alert('Last Name Required', 'Please enter your last name.');
      return;
    }
    if (!currentUser) {
      Alert.alert('Error', 'Not authenticated. Please restart the app.');
      return;
    }
    Keyboard.dismiss();
    setLoading(true);

    try {
      // Get the first name to create the displayName
      const userDoc = await db.collection('users').doc(currentUser.uid).get();
      const firstName = userDoc.data()?.firstName || '';

      await db.collection('users').doc(currentUser.uid).set(
        {
          lastName: lastName.trim(),
          displayName: `${firstName} ${lastName.trim()}`.trim(),
        },
        { merge: true }
      );
      navigation.navigate('CreateProfileUsername');
    } catch (error) {
      console.error('Failed to save last name: ', error);
      Alert.alert('Error', 'Could not save your name. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={15}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>And your last name?</Text>
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              placeholderTextColor="#F2F2F250"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
            />
          </View>

          <View style={styles.bottomContainer}>
            {loading ? (
              <ActivityIndicator size="small" color="#F2F2F2" style={{ paddingVertical: 12 }} />
            ) : (
              <Pressable
                onPress={handleContinue}
                disabled={!lastName.trim()}
                style={({ pressed }) => [
                  styles.buttonContainer,
                  pressed && { opacity: 0.8 },
                  !lastName.trim() && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.buttonText}>Continue</Text>
              </Pressable>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#8BA637',
      },
      content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      },
      title: {
        fontSize: 36,
        fontFamily: 'PatrickHand-Regular',
        color: '#F2F2F2',
        textAlign: 'center',
        marginBottom: 40,
        paddingHorizontal: 20,
      },
      input: {
        color: '#F2F2F2',
        fontSize: 40,
        fontFamily: 'PatrickHand-Regular',
        textAlign: 'center',
        width: '90%',
        height: 50,
        borderBottomWidth: 2,
        borderBottomColor: '#F2F2F2',
      },
      bottomContainer: {
        padding: 20,
        paddingBottom: 60,
      },
      buttonContainer: {
        backgroundColor: '#F2F2F2',
        borderRadius: 25,
        height: 48,
        justifyContent: 'center',
      },
      buttonText: {
        color: '#8BA637',
        fontSize: 20,
        fontFamily: 'PatrickHand-Regular',
        textAlign: 'center',
      },
});