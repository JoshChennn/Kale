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
  Dimensions,
} from 'react-native';
import { db, auth, storage } from './firebaseConfig';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import defaultProfilePhoto from './assets/default-profile-photo.png';

const { width: screenWidth } = Dimensions.get('window');

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Only images for simplicity in this flow
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedPhotos([result.assets[0].uri]); // Only handle one photo for this UI
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
        (snapshot) => {},
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
      Alert.alert("No content", "Please enter some text or select a photo to post.");
      return;
    }
    if (!currentUser || !currentUserData) {
      Alert.alert("Error", "User not authenticated or profile data not loaded.");
      return;
    }

    setIsUploading(true);
    try {
      let imageUri = null;
      let mediaType = 'text';

      if (selectedPhotos && selectedPhotos.length > 0) {
        imageUri = await uploadFileAsync(selectedPhotos[0]);
        mediaType = 'image';
      }

      await addDoc(collection(db, "posts"), {
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
      setCaption('');
      setSelectedPhotos([]);
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

    const postRef = doc(db, 'posts', post.id);
    await updateDoc(postRef, {
      commentsCount: increment(1)
    });

    setNewComment('');
  };

  const handleClearPost = () => {
    Alert.alert(
      "Clear Content",
      "Are you sure you want to clear your post caption and photo?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Clear",
          onPress: () => {
            setCaption('');
            setSelectedPhotos([]);
          },
          style: 'destructive'
        }
      ],
      { cancelable: true }
    );
  };

  const renderComment = ({ item }) => (
    <View style={styles.commentItem}>
      <Text style={styles.commentAuthor}>{item.author}:</Text>
      <Text style={styles.commentText}>{item.text}</Text>
      <Text style={styles.commentDate}>{item.date}</Text>
    </View>
  );

  const renderCreateMode = () => (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
        <ScrollView style={styles.createContainer} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            {/* --- MOCK POST CARD START --- */}
            <View style={styles.postCard}>
                {/* Mock Header */}
                <View style={styles.postHeader}>
                    <View style={styles.postHeaderLeft}>
                        <Image 
                            source={currentUserData?.photoURL ? { uri: currentUserData.photoURL } : defaultProfilePhoto} 
                            style={styles.avatar} 
                        />
                        <View>
                            <Text style={styles.postUsername}>
                                {currentUserData?.displayName || 'Your Name'}
                                {currentUserData?.username ? (
                                    <Text style={styles.postUsernameBracket}> (@{currentUserData.username})</Text>
                                ) : null}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Conditional Content Area */}
                {selectedPhotos.length === 0 ? (
                    // Text-only Post Mockup
                    <View style={styles.textOnlyCaptionContainer}>
                        <TextInput
                            placeholder="What's on your mind?"
                            placeholderTextColor="#b9b9b9"
                            value={caption}
                            onChangeText={setCaption}
                            style={styles.textOnlyInput}
                            multiline
                            editable={!isUploading}
                        />
                    </View>
                ) : (
                    // Image Post Mockup
                    <>
                        <Image source={{ uri: selectedPhotos[0] }} style={styles.postImage} />
                        <View style={styles.captionContainer}>
                            <TextInput
                                placeholder="Write a caption..."
                                placeholderTextColor="#b9b9b9"
                                value={caption}
                                onChangeText={setCaption}
                                style={styles.captionInput}
                                multiline
                                editable={!isUploading}
                            />
                        </View>
                    </>
                )}

                {/* Mock Action Bar */}
                <View style={styles.actionButtonsContainer}>
                    <Pressable style={styles.actionButton}>
                        <Ionicons name="heart-outline" size={28} color="#b9b9b9" />
                    </Pressable>
                    <Pressable style={styles.actionButton}>
                        <Ionicons name="chatbubble-outline" size={28} color="#b9b9b9" />
                    </Pressable>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity 
                        style={styles.addPhotoButton} 
                        onPress={pickImage}
                        disabled={isUploading}
                    >
                        <MaterialIcons name="photo-camera" size={24} color="#fff" />
                        <Text style={styles.addPhotoText}>
                            {selectedPhotos.length > 0 ? 'Change Photo' : 'Add Photo'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
            {/* --- MOCK POST CARD END --- */}
        </ScrollView>

        {/* --- ACTUAL CONTROLS AT THE BOTTOM --- */}
        <View style={styles.bottomControlsContainer}>
            <TouchableOpacity 
                style={[
                    styles.postButton,
                    { 
                        opacity: ((caption.trim().length > 0 || selectedPhotos.length > 0) && !isUploading) ? 1 : 0.5,
                        width: '100%',
                        alignSelf: 'center',
                    }
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
    </KeyboardAvoidingView>
  );

  const renderViewMode = () => (
    <>
      <FlatList
        data={comments}
        keyExtractor={item => item.id}
        renderItem={renderComment}
        ListHeaderComponent={() => (
          post?.imageUri ? <Image source={{ uri: post.imageUri }} style={styles.postImage} /> : null
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
            placeholderTextColor="#b9b9b9"
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
          <MaterialIcons name="chevron-left" size={28} color="#53544D" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {mode === 'create' ? 'Create Post' : post?.userName || 'Post'}
        </Text>
        {mode === 'create' && (caption.trim().length > 0 || selectedPhotos.length > 0) ? (
          <Pressable onPress={handleClearPost} style={styles.clearButton}>
            <MaterialIcons name="close" size={24} color="#53544D" />
          </Pressable>
        ) : mode === 'view' ? (
          <Text style={styles.postDate}>{post?.date}</Text>
        ) : (
          <View style={styles.clearButton} /> // Placeholder to keep title centered
        )}
      </View>

      {mode === 'create' ? renderCreateMode() : renderViewMode()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    zIndex: 2,
    padding: 4,
  },
  clearButton: {
    position: 'absolute',
    right: 20,
    zIndex: 2,
    padding: 4,
    // ensure it has a size to not mess up layout
    width: 28 + 8, // icon size + padding
    height: 28 + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
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

  /* --- Create Mode Styles (New) --- */
  createContainer: {
    flex: 1,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  postHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#e6e6e6',
  },
  postUsername: {
    fontSize: 16,
    color: '#53544D',
    fontFamily: 'PatrickHand-Regular',
  },
  postUsernameBracket: {
    color: '#b9b9b9',
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
  },
  textOnlyCaptionContainer: {
    paddingHorizontal: 30,
    paddingVertical: 20,
    minHeight: 150,
  },
  textOnlyInput: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 24,
    color: '#53544D',
    lineHeight: 32,
  },
  postImage: {
    width: screenWidth,
    height: screenWidth,
    backgroundColor: '#e0e0e0',
  },
  captionContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  captionInput: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#53544D',
    lineHeight: 22,
    padding: 0, // Remove default padding
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  actionButton: {
    marginRight: 16,
  },
  bottomControlsContainer: {
    padding: 20,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8BA637',
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 25,
    marginLeft: 8,
    alignSelf: 'flex-start',
    marginTop: -8,
  },
  addPhotoText: {
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    color: '#fff',
    fontWeight: 'bold',
  },
  postButton: {
    backgroundColor: '#8BA637',
    paddingVertical: 10,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 120,
    width: '100%',
    alignSelf: 'center',
  },
  postButtonText: {
    fontSize: 18,
    fontFamily: 'PatrickHand-Regular',
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  /* --- View Mode / Comments Styles --- */
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