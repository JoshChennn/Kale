import * as React from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { auth, firebase } from './firebaseConfig';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

// Must match the types in PhoneNumberScreen
type RootStackParamList = {
  PhoneNumber: undefined;
  VerifyCode: { 
    phoneNumber: string;
    verificationId: string;
  };
};

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'VerifyCode'>;
  route: RouteProp<RootStackParamList, 'VerifyCode'>;
};

export default function VerifyCodeScreen({ navigation, route }: Props) {
  const { verificationId, phoneNumber } = route.params;
  const [verificationCode, setVerificationCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const confirmCode = async () => {
    if (loading || verificationCode.length < 6) return;

    setLoading(true);
    try {
      const credential = firebase.auth.PhoneAuthProvider.credential(
        verificationId,
        verificationCode
      );
      await auth.signInWithCredential(credential);
      // On success, the onAuthStateChanged listener in App.tsx will handle navigation.
      // We don't need to navigate from here or set loading to false.
    } catch (err: any) {
      Alert.alert("Verification Failed", "The code you entered is incorrect. Please try again.");
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify your number</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to {phoneNumber}</Text>
      <TextInput
        style={styles.input}
        placeholder="123456"
        value={verificationCode}
        onChangeText={setVerificationCode}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        textContentType="oneTimeCode"
      />
      {loading ? (
         <ActivityIndicator size="large" color="#8BA637" />
      ) : (
        <Button title="Verify & Sign In" onPress={confirmCode} color="#8BA637" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F2F2F2',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#fff',
    height: 60,
    borderColor: '#ddd',
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 15,
    borderRadius: 8,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 10,
  },
});