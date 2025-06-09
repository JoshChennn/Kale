import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
  Image,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator, // For loading state
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { db, storage, auth } from './firebaseConfig'; // Import Firebase config
import { addDoc, collection, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export default function CreatePostDetailsScreen({ route, navigation }) {
  const { photos } = route.params; // Expects an array of local file URIs
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (currentUser) {
      // Fetch user details from Firestore to get name/avatar for denormalization
      const userDocRef = doc(db, 'users', currentUser.uid);
      getDoc(userDocRef).then(docSnap => {
        if (docSnap.exists()) {
          setCurrentUserData(docSnap.data());
        } else {
          console.warn("User document not found for posting user.");
          Alert.alert("Error", "Could not load your user profile to create a post.");
          navigation.goBack();
        }
      });
    }
  }, [currentUser]);

  // Function to upload a single image to Firebase Storage
  const uploadImageAsync = async (uri) => {
    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        console.log(e);
        reject(new TypeError("Network request failed"));
      };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });

    if (!currentUser) {
      throw new Error("User not authenticated for upload");
    }
    const fileRef = ref(storage, `posts/${currentUser.uid}/${Date.now()}`);
    const uploadTask = uploadBytesResumable(fileRef, blob);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Optional: handle progress updates
        },
        (error) => {
          console.error("Upload error:", error);
          blob.close(); // Close the blob on error
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          blob.close(); // Close the blob on success
          resolve(downloadURL);
        }
      );
    });
  };

  const handlePost = async () => {
    if (!photos || photos.length === 0) {
      Alert.alert("No photo", "Please select a photo to post.");
      return;
    }
    if (!currentUser || !currentUserData) {
        Alert.alert("Error", "User not authenticated or profile data not loaded.");
        return;
    }

    setIsUploading(true);
    try {
      // For now, we only handle the first selected photo.
      const imageUriToUpload = photos[0];
      const uploadedImageURL = await uploadImageAsync(imageUriToUpload);

      // Add post to Firestore with correct user data fields
      await addDoc(collection(db, "posts"), {
        userId: currentUser.uid,
        userName: currentUserData.displayName, // Corrected from .name
        userAvatar: currentUserData.photoURL,   // Corrected from .avatar
        imageUri: uploadedImageURL,
        caption: caption.trim(),
        tags: tags.split(' ').filter(t => t.startsWith('@')),
        commentsCount: 0,
        createdAt: serverTimestamp(), // Use server timestamp
      });

      console.log('Post created successfully!');
      setIsUploading(false);

      // Navigate back to the main feed and reset the create post stack
      navigation.getParent()?.navigate('FeedStack', { screen: 'Feed' });
      navigation.reset({
        index: 0,
        routes: [{ name: 'SelectPhoto' }],
      });

    } catch (error) {
      console.error("Error posting: ", error);
      Alert.alert("Post Error", "Could not create post. Please try again. " + error.message);
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} disabled={isUploading}>
            <MaterialIcons name="arrow-back" size={28} color="#53544D" />
          </TouchableOpacity>
          <Text style={styles.title}>New Post</Text>
          <TouchableOpacity onPress={handlePost} disabled={!photos || photos.length === 0 || isUploading}>
            {isUploading ? (
              <ActivityIndicator size="small" color="#8BA637" />
            ) : (
              <Text style={[styles.post, { opacity: (photos && photos.length > 0 && !isUploading) ? 1 : 0.3 }]}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            {photos && photos.length > 0 ? (
              <Image source={{ uri: photos[0] }} style={styles.preview} />
            ) : (
              <View style={[styles.preview, styles.previewPlaceholder]}>
                <MaterialIcons name="image" size={80} color="#ccc" />
                <Text style={styles.previewPlaceholderText}>No photo selected</Text>
              </View>
            )}
            <TextInput
              placeholder="Write a caption..."
              placeholderTextColor="#aaa"
              value={caption}
              onChangeText={setCaption}
              style={styles.inputCaption}
              multiline
              editable={!isUploading}
            />
            <TextInput
              placeholder="Tag people (e.g. @username)"
              placeholderTextColor="#aaa"
              value={tags}
              onChangeText={setTags}
              style={styles.inputTags}
              editable={!isUploading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 16,
    borderBottomWidth: 1,
    borderColor: '#ddd',
    height: Platform.OS === 'ios' ? 56 : 60,
  },
  title: { fontSize: 20, fontFamily: 'PatrickHand-Regular', color: '#53544D' },
  post: { fontSize: 18, color: '#8BA637', fontFamily: 'PatrickHand-Regular' },
  scrollContent: {
    flexGrow: 1,
  },
  content: { flex: 1, padding: 16 },
  preview: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 20,
    backgroundColor: '#e0e0e0',
  },
  previewPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewPlaceholderText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#aaa',
    marginTop: 8,
  },
  inputCaption: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 15,
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    marginBottom: 15,
    textAlignVertical: 'top',
    minHeight: 100,
    color: '#333',
  },
  inputTags: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    marginBottom: 12,
    minHeight: 50,
    color: '#333',
  },
});