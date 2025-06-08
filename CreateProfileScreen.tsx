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
  Platform,
  Keyboard,
  ScrollView,
  StatusBar,
} from 'react-native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { firebase } from './firebaseConfig';
import { StackScreenProps } from '@react-navigation/stack';

type RootStackParamList = {
  CreateProfile: undefined;
  VerifyCode: {
    verificationId: string;
    phoneNumber: string;
  };
};

type Props = StackScreenProps<RootStackParamList, 'CreateProfile'> & {
  onProfileCreated: () => void;
};

const PHONE_DIGITS = 10;

export default function CreateProfileScreen({ navigation, onProfileCreated }: Props) {
  const recaptchaVerifier = React.useRef<FirebaseRecaptchaVerifierModal>(null);
  const inputRef = React.useRef<TextInput>(null);

  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [countryCode] = React.useState('+1');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const handleSendVerification = async () => {
    // Basic validation
    if (phoneNumber.length !== PHONE_DIGITS) {
      Alert.alert(
        'Invalid Phone Number',
        `Please enter a full ${PHONE_DIGITS}-digit phone number.`
      );
      return;
    }
    const formattedPhoneNumber = `${countryCode}${phoneNumber}`;

    // Ensure the reCAPTCHA verifier is ready
    if (!recaptchaVerifier.current) {
      Alert.alert(
        'Error',
        'reCAPTCHA verifier not initialized. Please try again.'
      );
      return;
    }

    setLoading(true);
    setMessage(''); // Clear previous errors

    try {
      const phoneProvider = new firebase.auth.PhoneAuthProvider();
      const verificationId = await phoneProvider.verifyPhoneNumber(
        formattedPhoneNumber,
        recaptchaVerifier.current
      );

      navigation.navigate('VerifyCode', {
        verificationId,
        phoneNumber: formattedPhoneNumber,
      });
    } catch (err: any) {
      const errorMessage = err.message || 'An unknown error occurred.';
      setMessage(`Error: ${errorMessage}`);
      Alert.alert('Verification Error', errorMessage);
      console.error('Phone Verification Error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const renderDigitBoxes = () => {
    const boxes = [];
    for (let i = 0; i < PHONE_DIGITS; i++) {
      const digit = phoneNumber[i] || '';
      const isCurrent = i === phoneNumber.length;
      boxes.push(
        <View key={i} style={styles.digitBox}>
          <Text style={styles.digitText}>{digit}</Text>
          <View
            style={[
              styles.digitUnderline,
              isCurrent && styles.digitUnderlineActive,
            ]}
          />
        </View>
      );
    }
    return boxes;
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Pressable style={styles.container} onPress={Keyboard.dismiss}>
          <FirebaseRecaptchaVerifierModal
            ref={recaptchaVerifier}
            firebaseConfig={firebase.app().options}
            title="Prove you are not a robot"
            cancelLabel="Close"
          />

          <View style={styles.mainContent}>
            <Text style={styles.title}>KALE</Text>
            <Text style={styles.subtitle}>Hey, what's your number?</Text>
            <Pressable
              style={styles.phoneInputRow}
              onPress={() => inputRef.current?.focus()}
            >
              <View style={styles.countryCodeBox}>
                <Text style={styles.countryCodeText}>{countryCode}</Text>
              </View>
              {renderDigitBoxes()}
            </Pressable>
            
            {/* Hidden Input to handle keyboard and state */}
      <TextInput
                ref={inputRef}
                style={styles.hiddenInput}
                keyboardType="number-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                maxLength={PHONE_DIGITS}
                caretHidden
            />

      </View>

          <View style={styles.footer}>
            <Pressable
              onPress={handleSendVerification}
              style={({ pressed }) => [
                styles.button,
                (phoneNumber.length !== PHONE_DIGITS || loading) && styles.buttonDisabled,
                pressed && { opacity: 0.9 },
              ]}
              disabled={phoneNumber.length !== PHONE_DIGITS || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#8BA637" />
              ) : (
                <Text style={styles.buttonText}>Send verification text</Text>
              )}
            </Pressable>

            {message ? <Text style={styles.errorText}>{message}</Text> : null}
    </View>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#8BA637',
    justifyContent: 'space-between',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    paddingBottom: 20,
  },
  title: {
    fontSize: 60,
    fontFamily: 'PatrickHand-Regular',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 22,
    fontFamily: 'PatrickHand-Regular',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 60,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  countryCodeBox: {
    borderBottomWidth: 2,
    borderColor: '#FFFFFF',
    paddingBottom: 8,
    marginRight: 15,
  },
  countryCodeText: {
    fontFamily: 'PatrickHand-Regular',
    color: '#FFFFFF',
    fontSize: 30,
  },
  digitBox: {
    width: 24,
    height: 50,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginHorizontal: 3,
  },
  digitText: {
    fontFamily: 'PatrickHand-Regular',
    color: '#FFFFFF',
    fontSize: 30,
    position: 'absolute',
    top: 0,
    height: '100%',
    textAlignVertical: 'top',
  },
  digitUnderline: {
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  digitUnderlineActive: {
    backgroundColor: '#FFFFFF',
    height: 3,
    // Simple blinking effect could be done with animation, but this provides a static highlight
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  button: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#8BA637',
    fontSize: 18,
    fontFamily: 'PatrickHand-Regular',
  },
  errorText: {
    marginTop: 15,
    color: '#F2DEDE', // Lighter red for better contrast on green
    textAlign: 'center',
    fontSize: 14,
  },
});