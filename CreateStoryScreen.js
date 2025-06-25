import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const COLORS = [
  '#8BA637', // Kale green
  '#F2F2F2', // Light
  '#FFFFFF', // White
  '#4F6A56', // Dark green
  '#B9B9B9', // Gray
  '#CADE81', // Light green
  '#FFB6B6', // Soft red
  '#A3D8F4', // Soft blue
  '#F9E79F', // Soft yellow
];

export default function CreateStoryScreen({ navigation }) {
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(COLORS[0]);
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!text && !image) {
      Alert.alert('Add something!', 'Please add text or an image to your story.');
      return;
    }
    // TODO: Upload story to Firestore/Storage
    // For now, just close
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>  
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <MaterialIcons name="close" size={28} color="#53544D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Story</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
          <MaterialIcons name="check" size={28} color="#8BA637" />
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {image ? (
              <Image source={{ uri: image }} style={styles.image} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <MaterialIcons name="add-photo-alternate" size={40} color="#B9B9B9" />
                <Text style={styles.imagePlaceholderText}>Add Image</Text>
              </View>
            )}
          </TouchableOpacity>
          <TextInput
            style={[styles.textInput, { backgroundColor: bgColor, color: bgColor === '#F2F2F2' || bgColor === '#FFFFFF' ? '#53544D' : '#FFFFFF' }]}
            placeholder="Write something..."
            placeholderTextColor={bgColor === '#F2F2F2' || bgColor === '#FFFFFF' ? '#B9B9B9' : '#F2F2F2'}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={200}
          />
          <View style={styles.paletteContainer}>
            {COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[styles.colorCircle, { backgroundColor: color, borderWidth: bgColor === color ? 3 : 1, borderColor: bgColor === color ? '#53544D' : '#E0E0E0' }]}
                onPress={() => setBgColor(color)}
              />
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 22,
    color: '#53544D',
    textAlign: 'center',
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 30,
    paddingHorizontal: 20,
  },
  imagePicker: {
    width: 180,
    height: 240,
    borderRadius: 18,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    marginTop: 8,
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#B9B9B9',
  },
  textInput: {
    width: '100%',
    minHeight: 100,
    maxHeight: 180,
    borderRadius: 16,
    fontFamily: 'PatrickHand-Regular',
    fontSize: 22,
    padding: 18,
    marginBottom: 24,
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  paletteContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginHorizontal: 6,
    marginVertical: 4,
  },
}); 