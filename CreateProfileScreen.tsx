import * as React from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { auth, db, firebase } from './firebaseConfig';

type Props = {
  onProfileCreated: () => void;
};

// Simple debounce function
function debounce(func: (...args: any[]) => void, delay: number) {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

export default function CreateProfileScreen({ onProfileCreated }: Props) {
  const [name, setName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [usernameAvailable, setUsernameAvailable] = React.useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = React.useState(false);

  // Function to check username availability
  const checkUsername = React.useCallback(
    async (text: string) => {
      if (text.length < 3) {
        setUsernameAvailable(null);
        setIsCheckingUsername(false);
        return;
      }
      const formattedUsername = text.toLowerCase();
      const usersRef = db.collection('users');
      const query = usersRef.where('username', '==', formattedUsername);
      const querySnapshot = await query.get();
      setUsernameAvailable(querySnapshot.empty);
      setIsCheckingUsername(false);
    },
    []
  );

  const debouncedCheckUsername = React.useMemo(() => debounce(checkUsername, 500), [checkUsername]);

  const handleUsernameChange = (text: string) => {
    const formatted = text.replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase();
    setUsername(formatted);
    setIsCheckingUsername(true);
    setUsernameAvailable(null); // Reset on change
    debouncedCheckUsername(formatted);
  };

  const handleCreateAccount = async () => {
    if (!name.trim()) {
      Alert.alert("Invalid Name", "Please enter your name.");
      return;
    }
    if (!username.trim() || !usernameAvailable) {
      Alert.alert("Invalid Username", "Please choose a valid and available username.");
      return;
    }
    setLoading(true);

    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Error", "No user is signed in. Please restart the app.");
      setLoading(false);
      return;
    }

    const userDocRef = db.collection('users').doc(user.uid);
    const userData = {
      name: name.trim(),
      username: username.trim().toLowerCase(),
      phoneNumber: user.phoneNumber,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      await userDocRef.set(userData);
      onProfileCreated(); // Signal to App.tsx that profile is complete
    } catch (error: any) {
      Alert.alert("Failed to create account", error.message);
      setLoading(false);
    }
  };
  
  const getUsernameFeedback = () => {
    if (isCheckingUsername) {
      return <ActivityIndicator size="small" color="#666" />;
    }
    if (username.length > 0 && username.length < 3) {
      return <Text style={styles.feedbackText}>Username must be at least 3 characters.</Text>;
    }
    if (usernameAvailable === true) {
      return <Text style={[styles.feedbackText, { color: 'green' }]}>@{username} is available!</Text>;
    }
    if (usernameAvailable === false) {
      return <Text style={[styles.feedbackText, { color: 'red' }]}>@{username} is already taken.</Text>;
    }
    return <View style={{height: 20}} />; // Placeholder for layout stability
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Your Profile</Text>
      <Text style={styles.subtitle}>This is how others will see you on KALE.</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Full Name (e.g., Bert Smith)"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <TextInput
        style={styles.input}
        placeholder="username (e.g., big_bird)"
        value={username}
        onChangeText={handleUsernameChange}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.feedbackContainer}>
        {getUsernameFeedback()}
      </View>

      <Button title={loading ? "Creating Account..." : "Finish Setup"} onPress={handleCreateAccount} color="#8BA637" disabled={loading || !usernameAvailable} />
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
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  feedbackContainer: {
    height: 25,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingHorizontal: 5
  },
  feedbackText: {
    fontSize: 14,
  }
});