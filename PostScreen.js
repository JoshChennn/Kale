import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { db, auth, storage } from './firebaseConfig';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

export default function PostScreen({ route, navigation }) {
  const currentUser = auth.currentUser;
  const [mode, setMode] = useState('create'); // 'create' or 'view'
  const [post, setPost] = useState(null);
  
  // Post creation state
  const [caption, setCaption] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(null);
  
  // Comments state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    // Check if we're in view mode (post passed as param)
    if (route.params?.post) {
      setPost(route.params.post);
      setMode('view');
      loadComments(route.params.post.id);
    } else {
      setMode('create');
      loadCurrentUserData();
    }
  }, [route.params]);

  const loadCurrentUserData = async () => {
    if (currentUser) {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        setCurrentUserData(docSnap.data());
      }
    }
  };

  const loadComments = (postId) => {
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedComments = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text,
          author: data.authorName,
          date: data.createdAt?.toDate().toLocaleDateString() || 'someday',
        };
      });
      setComments(fetchedComments);
    });

    return unsubscribe;
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedPhotos(result.assets.map(asset => asset.uri));
    }
  };

  const uploadFileAsync = async (uri) => {
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
          blob.close();
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          blob.close();
          resolve(downloadURL);
        }
      );
    });
  };

  const handleCreatePost = async () => {
    if ((!caption.trim() || caption.trim().length === 0) && (!selectedPhotos || selectedPhotos.length === 0)) {
      Alert.alert("No content", "Please enter some text or select a photo/video to post.");
      return;
    }
    if (!currentUser || !currentUserData) {
      Alert.alert("Error", "User not authenticated or profile data not loaded.");
      return;
    }

    setIsUploading(true);
    try {
      let uploadedURLs = [];
      let mediaType = 'text';
      let imageUri = null;
      if (selectedPhotos && selectedPhotos.length > 0) {
        for (const photoUri of selectedPhotos) {
          const uploadedURL = await uploadFileAsync(photoUri);
          uploadedURLs.push(uploadedURL);
        }
        imageUri = uploadedURLs[0];
        mediaType = selectedPhotos[0].toLowerCase().endsWith('.mp4') || 
                   selectedPhotos[0].toLowerCase().endsWith('.mov') ? 'video' : 'image';
      }

      // Add post to Firestore
      const postDoc = await addDoc(collection(db, "posts"), {
        userId: currentUser.uid,
        userName: currentUserData.displayName,
        userUsername: currentUserData.username,
        userAvatar: currentUserData.photoURL,
        imageUri: imageUri || '',
        mediaType: mediaType,
        caption: caption.trim(),
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });

      console.log('Post created successfully!');
      setIsUploading(false);
      
      // Clear form
      setCaption('');
      setSelectedPhotos([]);
      
      // Navigate to the FeedStack tab
      navigation.navigate('MainTabs', { screen: 'FeedStack' });

    } catch (error) {
      console.error("Error posting: ", error);
      Alert.alert("Post Error", "Could not create post. Please try again. " + error.message);
      setIsUploading(false);
    }
  };

  const handleAddComment = async () => {
    if (newComment.trim().length === 0 || !currentUser || !post) return;

    const commentsRef = collection(db, 'posts', post.id, 'comments');
    await addDoc(commentsRef, {
      text: newComment.trim(),
      authorId: currentUser.uid,
      authorName: currentUser.displayName || 'Anonymous',
      createdAt: serverTimestamp(),
    });

    // Increment commentsCount on the post document
    const postRef = doc(db, 'posts', post.id);
    await updateDoc(postRef, {
      commentsCount: increment(1)
    });

    setNewComment('');
  };

  const renderComment = ({ item }) => (
    <View style={styles.commentItem}>
      <Text style={styles.commentAuthor}>{item.author}:</Text>
      <Text style={styles.commentText}>{item.text}</Text>
      <Text style={styles.commentDate}>{item.date}</Text>
    </View>
  );

  const renderCreateMode = () => (
    <ScrollView style={styles.createContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.createContent}>
        <TextInput
          placeholder="What's on your mind?"
          placeholderTextColor="#aaa"
          value={caption}
          onChangeText={setCaption}
          style={styles.captionInput}
          multiline
          editable={!isUploading}
        />
        
        {selectedPhotos.length > 0 && (
          <View style={styles.photoPreview}>
            <Image source={{ uri: selectedPhotos[0] }} style={styles.previewImage} />
            <Text style={styles.photoCount}>{selectedPhotos.length} photo{selectedPhotos.length > 1 ? 's' : ''} selected</Text>
          </View>
        )}
        
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.addPhotoButton} 
            onPress={pickImage}
            disabled={isUploading}
          >
            <MaterialIcons name="photo-camera" size={24} color="#8BA637" />
            <Text style={styles.addPhotoText}>Add Photos</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.postButton, 
              { opacity: ((caption.trim().length > 0 || selectedPhotos.length > 0) && !isUploading) ? 1 : 0.5 }
            ]} 
            onPress={handleCreatePost}
            disabled={(caption.trim().length === 0 && selectedPhotos.length === 0) || isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderViewMode = () => (
    <>
      <FlatList
        data={comments}
        keyExtractor={item => item.id}
        renderItem={renderComment}
        ListHeaderComponent={() => (
          <Image source={{ uri: post.imageUri }} style={styles.postImage} />
        )}
        ListEmptyComponent={() => (
          <Text style={styles.noCommentsText}>No comments yet. Be the first!</Text>
        )}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newComment}
            onChangeText={setNewComment}
            placeholder="Add a comment..."
            placeholderTextColor="#999"
          />
          <Pressable style={styles.sendButton} onPress={handleAddComment}>
            <MaterialIcons name="send" size={24} color="#8BA637" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#53544D" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {mode === 'create' ? 'New Post' : post?.userName || 'Post'}
        </Text>
        {mode === 'view' && (
          <Text style={styles.postDate}>{post?.date}</Text>
        )}
      </View>

      {mode === 'create' ? renderCreateMode() : renderViewMode()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* Container Styles */
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    paddingBottom: 80,
  },
  createContainer: {
    flex: 1,
  },
  createContent: {
    padding: 20,
  },

  /* Header Styles */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    color: '#53544D',
    fontFamily: 'PatrickHand-Regular',
    flex: 1,
    textAlign: 'center',
  },
  postDate: {
    fontSize: 14,
    color: '#b9b9b9',
    fontFamily: 'PatrickHand-Regular',
  },

  /* Create Mode Styles */
  captionInput: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 15,
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    marginBottom: 20,
    textAlignVertical: 'top',
    minHeight: 120,
    color: '#333',
  },
  photoPreview: {
    marginBottom: 20,
    alignItems: 'center',
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 10,
  },
  photoCount: {
    fontSize: 14,
    fontFamily: 'PatrickHand-Regular',
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#8BA637',
  },
  addPhotoText: {
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
  },
  postButton: {
    backgroundColor: '#8BA637',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  postButtonText: {
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  /* Post Styles */
  postImage: {
    width: '100%',
    aspectRatio: 1,
    marginBottom: 10,
    backgroundColor: '#ccc',
  },

  /* Comments Section */
  noCommentsText: {
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    color: '#999',
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  commentItem: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    marginHorizontal: 20,
  },
  commentAuthor: {
    fontSize: 14,
    fontFamily: 'PatrickHand-Regular',
    color: '#53544D',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    color: '#53544D',
  },
  commentDate: {
    fontSize: 12,
    fontFamily: 'PatrickHand-Regular',
    color: '#b9b9b9',
    textAlign: 'right',
    marginTop: 4,
  },

  /* Input Section */
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: '#e6e6e6',
    borderRadius: 20,
    paddingHorizontal: 15,
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#53544D',
  },
  sendButton: {
    marginLeft: 10,
  },
});