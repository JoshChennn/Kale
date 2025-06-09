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

type Props = StackScreenProps<OnboardingStackParamList, 'CreateProfileUsername'>;

export default function CreateProfileUsernameScreen({ navigation }: Props) {
  const [username, setUsername] = React.useState('');
  const [isChecking, setIsChecking] = React.useState(false);
  const [isValid, setIsValid] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const currentUser = auth.currentUser;

  // Debounced check for username
  React.useEffect(() => {
    const handler = setTimeout(async () => {
      const formattedUsername = username.toLowerCase().trim();
      
      // Don't show any feedback if there's no input
      if (!formattedUsername) {
        setFeedback('');
        setIsValid(false);
        return;
      }
      
      // Check for valid characters
      const validUsernameRegex = /^[a-z0-9._]+$/;
      if (!validUsernameRegex.test(formattedUsername)) {
        setFeedback('⚠️ Username can only contain letters, numbers, periods, and underscores.');
        setIsValid(false);
        return;
      }

      if (formattedUsername.length > 3) {
        setIsChecking(true);
        setFeedback('');
        try {
          const usersRef = db.collection('users');
          const querySnapshot = await usersRef.where('username', '==', formattedUsername).get();
          if (querySnapshot.empty) {
            setFeedback('✅ Username available!');
            setIsValid(true);
          } else {
            setFeedback('⚠️ Username is already taken.');
            setIsValid(false);
          }
        } catch (error) {
          setFeedback('⚠️ Error checking username.');
          setIsValid(false);
        } finally {
          setIsChecking(false);
        }
      } else {
        setFeedback('⚠️ Username must be at least 4 characters.');
        setIsValid(false);
      }
    }, 500); // 500ms debounce delay

    return () => {
      clearTimeout(handler);
    };
  }, [username]);


  const handleContinue = async () => {
    if (!isValid || !username.trim()) {
      Alert.alert('Invalid Username', 'Please enter a valid and available username.');
      return;
    }
    if (!currentUser) {
      Alert.alert('Error', 'Not authenticated. Please restart the app.');
      return;
    }
    Keyboard.dismiss();
    setLoading(true);

    try {
      await db.collection('users').doc(currentUser.uid).set(
        {
          username: username.toLowerCase().trim(),
        },
        { merge: true }
      );
      navigation.navigate('CreateProfilePhoto');
    } catch (error) {
      console.error('Failed to save username: ', error);
      Alert.alert('Error', 'Could not save your username. Please try again.');
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
            <Text style={styles.title}>Choose a username</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.atSymbol}>@</Text>
              <TextInput
                style={styles.input}
                placeholder="username"
                placeholderTextColor="#F2F2F250"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
            </View>
            <View style={styles.feedbackContainer}>
                {isChecking ? (
                    <ActivityIndicator size="small" color="#F2F2F2" />
                ) : (
                    <Text style={[styles.feedbackText, { color: '#F2F2F2' }]}>{feedback}</Text>
                )}
            </View>
          </View>

          <View style={styles.bottomContainer}>
            {loading ? (
              <ActivityIndicator size="small" color="#F2F2F2" style={{ paddingVertical: 12 }} />
            ) : (
              <Pressable
                onPress={handleContinue}
                disabled={!isValid || loading}
                style={({ pressed }) => [
                  styles.buttonContainer,
                  pressed && { opacity: 0.8 },
                  !isValid && { opacity: 0.5 },
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
      inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '90%',
        borderBottomWidth: 2,
        borderBottomColor: '#F2F2F2',
        justifyContent: 'center',
      },
      atSymbol: {
        color: '#F2F2F2',
        fontSize: 30,
        fontFamily: 'PatrickHand-Regular',
        width: 30,
        textAlign: 'center',
      },
      input: {
        color: '#F2F2F2',
        fontSize: 30,
        fontFamily: 'PatrickHand-Regular',
        textAlign: 'center',
        flex: 1,
        height: 50,
        marginLeft: -30, // Offset by the @ symbol width to center the text
        letterSpacing: -0.5,
      },
      feedbackContainer: {
        minHeight: 30,
        marginTop: 15,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        width: '100%',
      },
      feedbackText: {
        fontFamily: 'PatrickHand-Regular',
        fontSize: 18,
        textAlign: 'center',
        flexWrap: 'wrap',
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