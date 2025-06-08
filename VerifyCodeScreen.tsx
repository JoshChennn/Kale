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
import { auth, firebase } from './firebaseConfig';
import { StackScreenProps } from '@react-navigation/stack';

// Corrected type definitions for the Auth stack
type AuthStackParamList = {
  PhoneNumber: undefined;
  VerifyCode: {
    phoneNumber: string;
    verificationId: string;
  };
};

type Props = StackScreenProps<AuthStackParamList, 'VerifyCode'>;

export default function VerifyCodeScreen({ route, navigation }: Props) {
  const { verificationId, phoneNumber } = route.params;
  const [verificationCode, setVerificationCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const confirmCode = async () => {
    if (loading || verificationCode.length < 6) return;
    Keyboard.dismiss();
    setLoading(true);
    try {
      const credential = firebase.auth.PhoneAuthProvider.credential(
        verificationId,
        verificationCode
      );
      // Signing in will trigger the onAuthStateChanged listener in App.tsx,
      // which handles switching to the correct screen.
      await auth.signInWithCredential(credential);
      // The manual navigation call is no longer needed.
    } catch (err: any) {
      Alert.alert(
        'Verification Failed',
        'The code you entered is incorrect. Please try again.'
      );
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
            <Text style={styles.title}>Verify your number</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to {phoneNumber}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="123456"
              placeholderTextColor="#F2F2F250"
              value={verificationCode}
              onChangeText={setVerificationCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              textContentType="oneTimeCode"
            />
          </View>

          <View style={styles.bottomContainer}>
            {loading ? (
              <ActivityIndicator
                size="small"
                color="#F2F2F2"
                style={{ paddingVertical: 12 }}
              />
            ) : (
              <Pressable
                onPress={confirmCode}
                disabled={verificationCode.length < 6}
                style={({ pressed }) => [
                  styles.buttonContainer,
                  pressed && { opacity: 0.8 },
                  verificationCode.length < 6 && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.buttonText}>Verify & Sign In</Text>
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
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 20,
    fontFamily: 'PatrickHand-Regular',
    color: '#F2F2F2',
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    color: '#F2F2F2',
    fontSize: 40,
    letterSpacing: 10,
    fontFamily: 'PatrickHand-Regular',
    textAlign: 'center',
    width: '90%',
    height: 50,
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