import * as React from 'react';
import { View, Text, TextInput, Button, StyleSheet, Platform, Alert } from 'react-native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { auth, firebase } from './firebaseConfig'; // Use the compat firebase instance
import { StackScreenProps } from '@react-navigation/stack';

// Define stack param types for type safety
type AuthStackParamList = {
  PhoneNumber: undefined;
  VerifyCode: {
    verificationId: string;
    phoneNumber: string;
  };
};

type Props = StackScreenProps<AuthStackParamList, 'PhoneNumber'>;

// Define your test numbers in a central place
const TEST_PHONE_NUMBERS = ['+1 650-555-3434', '+1 650-555-1234']; // Add any other test numbers here

// Helper function to check if the number is for testing
const isTestPhoneNumber = (phoneNumber: string) => {
  return TEST_PHONE_NUMBERS.includes(phoneNumber.trim());
};


export default function PhoneNumberScreen({ navigation }: Props) {
  const recaptchaVerifier = React.useRef<FirebaseRecaptchaVerifierModal>(null);
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const sendVerification = async () => {
    // Basic validation for E.164 format
    const formattedPhoneNumber = phoneNumber.trim();
    if (!/^\+[1-9]\d{1,14}$/.test(formattedPhoneNumber.replace(/\s+/g, ''))) { // Remove spaces for validation
        Alert.alert("Invalid Phone Number", "Please enter a valid phone number including the country code (e.g., +1 123 456 7890).");
        return;
    }
    setLoading(true);
    try {
      const phoneProvider = new firebase.auth.PhoneAuthProvider();
      // Conditionally use the verifier. For test numbers, the verifier must be null.
      const verifier = isTestPhoneNumber(formattedPhoneNumber) ? null : recaptchaVerifier.current;
      
      const verificationId = await phoneProvider.verifyPhoneNumber(
        formattedPhoneNumber,
        verifier!
      );
      // Pass verificationId and phone number to the next screen
      navigation.navigate('VerifyCode', { verificationId, phoneNumber: formattedPhoneNumber });
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
      Alert.alert("Verification Error", err.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* The modal is still needed for non-test numbers */}
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebase.app().options}
        // You can uncomment this for testing on physical iOS devices if needed
        // appVerificationDisabledForTesting
      />
      <Text style={styles.title}>KALE</Text>
      <Text style={styles.subtitle}>Enter your phone number to begin</Text>
      <TextInput
        style={styles.input}
        placeholder="+1 650 555 3434"
        autoFocus
        autoComplete="tel"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        onChangeText={setPhoneNumber}
        value={phoneNumber}
      />
      <View style={styles.buttonContainer}>
         <Button 
            title={loading ? "Sending..." : "Send verification text"} 
            onPress={sendVerification} 
            color="#8BA637" 
            disabled={loading}
         />
      </View>
      {message ? <Text style={styles.errorText}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#8BA637', // Green background
  },
  title: {
    fontSize: 60,
    fontFamily: 'PatrickHand-Regular',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    backgroundColor: '#fff',
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 15,
    borderRadius: 8,
    fontSize: 18,
    textAlign: 'center',
  },
  buttonContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 5,
  },
  errorText: {
    marginTop: 10,
    color: 'yellow',
    textAlign: 'center',
  },
});