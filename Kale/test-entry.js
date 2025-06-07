import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

try {
  // Attempt to import the config file. This is the moment of truth.
  // The error happens during the import/initialization of this file.
  const { auth } = require('./firebaseConfig');

  if (auth) {
    console.log('✅✅✅ SUCCESS: Firebase config loaded and auth component is available.');
  } else {
    // This case should ideally not be hit, an error would be thrown before this.
    console.error('🔥🔥🔥 FAILURE: Firebase config loaded, but auth component is missing.');
  }

  // If the import succeeds, we render a success screen.
  const App = () => (
    <View style={styles.container}>
      <Text style={styles.text}>Firebase Loaded Successfully!</Text>
      <Text style={styles.subtext}>The auth object is ready.</Text>
    </View>
  );

  module.exports = App;

} catch (error) {
  // If the import itself throws an error, we render an error screen.
  console.error('🔥🔥🔥 CATASTROPHIC FAILURE: The import of firebaseConfig.js crashed.');
  console.error(error);

  const App = () => (
    <View style={[styles.container, { backgroundColor: '#ffcccc' }]}>
      <Text style={[styles.text, { color: '#a60000' }]}>Firebase FAILED to Load</Text>
      <Text style={styles.errorText}>Error: {error.message}</Text>
      <Text style={styles.subtext}>Check the Metro terminal logs for the full stack trace.</Text>
    </View>
  );

  module.exports = App;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#d4edda',
    padding: 20,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#155724',
    textAlign: 'center',
  },
  subtext: {
    fontSize: 16,
    color: '#155724',
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#721c24',
    marginTop: 16,
    fontFamily: 'monospace',
    textAlign: 'center',
  }
});