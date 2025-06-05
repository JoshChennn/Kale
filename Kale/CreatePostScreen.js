import React, { useState } from 'react';
import {
  View,
  TextInput,
  Button,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function CreatePostScreen({ navigation }) {
  const [imageUri, setImageUri] = useState('');
  const [caption, setCaption] = useState('');

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.cancelled) {
      setImageUri(result.uri);
    }
  };

  const handlePost = () => {
    // for now just log and go back
    console.log('new post', { imageUri, caption });
    // ideally integrate with your backend or state management
    navigation.navigate('FeedStack');
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        ) : (
          <Text style={styles.imagePlaceholder}>tap to choose image</Text>
        )}
      </TouchableOpacity>
      <TextInput
        placeholder="write a caption..."
        value={caption}
        onChangeText={setCaption}
        style={styles.input}
        multiline
      />
      <Button title="post" onPress={handlePost} disabled={!imageUri} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F2F2F2' },
  imagePicker: {
    width: '100%',
    height: 300,
    backgroundColor: '#eee',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  imagePlaceholder: { color: '#999', fontSize: 18 },
  previewImage: { width: '100%', height: '100%', borderRadius: 12 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    marginBottom: 20,
    height: 100,
    textAlignVertical: 'top',
  },
});
