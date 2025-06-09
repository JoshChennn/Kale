import * as React from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { firebase } from './firebaseConfig';
import { StackScreenProps } from '@react-navigation/stack';
import CountryPicker, {
  Country,
  CountryCode,
} from 'react-native-country-picker-modal';

// --- Type definitions (Updated for clarity) ---
type AuthStackParamList = {
  PhoneNumber: undefined;
  VerifyCode: {
    verificationId: string;
    phoneNumber: string;
  };
};
type Props = StackScreenProps<AuthStackParamList, 'PhoneNumber'>;

type CountryPickerTheme = {
  fontFamily?: string;
  backgroundColor?: string;
  onBackgroundTextColor?: string;
  primaryColor?: string;
  primaryColorVariant?: string;
  filterPlaceholderTextColor?: string;
};

// 1. Define a custom theme for the country picker modal
const pickerTheme: CountryPickerTheme = {
  fontFamily: 'PatrickHand-Regular',
  backgroundColor: '#F2F2F2', // Modal background
  onBackgroundTextColor: '#53544D', // Text color in modal
  primaryColor: '#8BA637', // Color of the selected country's checkmark
  primaryColorVariant: '#F2F2F2', // Background color of pressed list items
  filterPlaceholderTextColor: '#b9b9b9',
};

export default function PhoneNumberScreen({ navigation }: Props) {
  const recaptchaVerifier = React.useRef<FirebaseRecaptchaVerifierModal>(null);

  const [countryCode, setCountryCode] = React.useState<CountryCode>('US');
  const [callingCode, setCallingCode] = React.useState('1');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [showCountryPicker, setShowCountryPicker] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const onSelectCountry = (country: Country) => {
    setCountryCode(country.cca2);
    setCallingCode(country.callingCode[0] ?? '1');
    setShowCountryPicker(false);
  };

  const handleSendVerification = async () => {
    Keyboard.dismiss();
    const fullPhoneNumber = `+${callingCode}${phoneNumber.trim()}`;

    if (phoneNumber.trim().length < 8) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid phone number.');
      return;
    }
    if (!recaptchaVerifier.current) {
      Alert.alert('Error', 'reCAPTCHA verifier not initialized.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const phoneProvider = new firebase.auth.PhoneAuthProvider();
      const verificationId = await phoneProvider.verifyPhoneNumber(
        fullPhoneNumber,
        recaptchaVerifier.current
      );
      navigation.navigate('VerifyCode', {
        verificationId,
        phoneNumber: fullPhoneNumber,
      });
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
      Alert.alert('Verification Error', err.message);
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
          <FirebaseRecaptchaVerifierModal
            ref={recaptchaVerifier}
            firebaseConfig={firebase.app().options}
            title="I'm not a robot (Loading...)"
            cancelLabel="Close"
          />

          <View style={styles.content}>
            <Text style={styles.title}>KALE</Text>
            <Text style={styles.subtitle}>Hey, what's your number?</Text>

            <View style={styles.phoneInputContainer}>
              <Pressable
                onPress={() => setShowCountryPicker(true)}
                style={styles.flagButton}
              >
                <CountryPicker
                  countryCode={countryCode}
                  withFilter
                  withFlag
                  withCallingCode
                  onSelect={onSelectCountry}
                  onClose={() => setShowCountryPicker(false)}
                  visible={showCountryPicker}
                  theme={pickerTheme}
                  containerButtonStyle={{ padding: 0 }}
                />
                <Text style={styles.callingCodeText}>+{callingCode}</Text>
              </Pressable>

              <TextInput
                style={styles.input}
                placeholder="123 456 7890"
                placeholderTextColor="#F2F2F250"
                autoFocus
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                onChangeText={setPhoneNumber}
                value={phoneNumber}
              />
            </View>
          </View>

          <View style={styles.bottomContainer}>
            {loading ? (
              <ActivityIndicator
                size="small"
                color="#8BA637"
                style={{ paddingVertical: 12 }}
              />
            ) : (
              <Pressable
                onPress={handleSendVerification}
                disabled={!phoneNumber}
                style={({ pressed }) => [
                  styles.buttonContainer,
                  pressed && { opacity: 0.8 },
                  !phoneNumber && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.buttonText}>Send verification text</Text>
              </Pressable>
            )}
            {message ? <Text style={styles.errorText}>{message}</Text> : null}
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
    fontSize: 60,
    fontFamily: 'PatrickHand-Regular',
    color: '#F2F2F2',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 24,
    fontFamily: 'PatrickHand-Regular',
    color: '#F2F2F2',
    marginBottom: 40,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  flagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F2F2F2',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  callingCodeText: {
    color: '#F2F2F2',
    fontSize: 20,
    fontFamily: 'PatrickHand-Regular',
  },
  input: {
    flex: 1,
    color: '#F2F2F2',
    fontSize: 40,
    letterSpacing: 2,
    fontFamily: 'PatrickHand-Regular',
    height: 50,
    marginLeft: 15,
    marginBottom: 4,
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
  errorText: {
    marginTop: 15,
    color: 'yellow',
    textAlign: 'center',
    fontSize: 14,
  },
});