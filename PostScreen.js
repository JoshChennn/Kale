import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Keyboard,
  PanResponder,
} from 'react-native';
import { db, auth, storage } from './firebaseConfig';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import defaultProfilePhoto from './assets/default-profile-photo.png';

const { width: screenWidth } = Dimensions.get('window');

export default function PostScreen({ navigation }) {
  const currentUser = auth.currentUser;
  
  // Post creation state
  const [caption, setCaption] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [postType, setPostType] = useState('text'); // 'text' or 'image'
  const underlineAnim = useRef(new Animated.Value(0)).current;
  const [textPositions, setTextPositions] = useState({ text: 0, image: 0 });
  const [textWidths, setTextWidths] = useState({ text: 0, image: 0 });
  const textScaleAnim = useRef(new Animated.Value(1)).current;
  const imageScaleAnim = useRef(new Animated.Value(1)).current;
  const cardScaleAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // PanResponder for swipe down to dismiss keyboard
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only set pan responder if swiping vertically
        return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderRelease: (evt, gestureState) => {
        // If swipe down with enough distance and velocity, dismiss keyboard
        if (gestureState.dy > 40 && gestureState.vy > 0.5) {
          Keyboard.dismiss();
        }
      },
    })
  ).current;

  useEffect(() => {
    loadCurrentUserData();
  }, []);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      // Smooth scroll to bottom after keyboard appears
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  const animateUnderline = (toValue) => {
    Animated.spring(underlineAnim, {
      toValue,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  };

  const bounceText = (animRef) => {
    Animated.sequence([
      Animated.timing(animRef, {
        toValue: 1.1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animRef, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animRef, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const bounceCard = () => {
    Animated.sequence([
      Animated.timing(cardScaleAnim, {
        toValue: 1.04,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(cardScaleAnim, {
        toValue: 0.97,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(cardScaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    const targetValue = postType === 'image' ? 1 : 0;
    animateUnderline(targetValue);
    
    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Bounce the active tab text
    if (postType === 'image') {
      bounceText(imageScaleAnim);
    } else {
      bounceText(textScaleAnim);
    }
  }, [postType]);

  const onTextLayout = (event, tabType) => {
    const { x, width } = event.nativeEvent.layout;
    setTextPositions(prev => ({
      ...prev,
      [tabType]: x
    }));
    setTextWidths(prev => ({
      ...prev,
      [tabType]: width
    }));
  };

  const loadCurrentUserData = async () => {
    if (currentUser) {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        setCurrentUserData(docSnap.data());
      }
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (!result.canceled) {
      const uris = result.assets.map(asset => asset.uri);
      setSelectedPhotos(uris);
      // Switch to image tab if user selects photos while on text tab
      if (postType === 'text') {
        setPostType('image');
      }
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
    if (postType === 'text' && caption.trim().length === 0) {
      Alert.alert("No Content", "Please enter some text to post.");
      return;
    }
    if (postType === 'image' && selectedPhotos.length === 0) {
      Alert.alert("No Photo", "Please select a photo to post.");
      return;
    }
    if (!currentUser || !currentUserData) {
      Alert.alert("Error", "User not authenticated or profile data not loaded.");
      return;
    }

    setIsUploading(true);
    try {
      let imageUris = [];
      let mediaType = 'text';

      if (postType === 'image' && selectedPhotos && selectedPhotos.length > 0) {
        const uploadPromises = selectedPhotos.map(uri => uploadFileAsync(uri));
        imageUris = await Promise.all(uploadPromises);
        mediaType = imageUris.length > 1 ? 'multi-image' : 'image';
      }

      await addDoc(collection(db, "posts"), {
        userId: currentUser.uid,
        userName: currentUserData.displayName,
        userUsername: currentUserData.username,
        userAvatar: currentUserData.photoURL,
        imageUris: imageUris,
        mediaType: mediaType,
        caption: caption.trim(),
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });

      console.log('Post created successfully!');
      setIsUploading(false);
      setCaption('');
      setSelectedPhotos([]);
      setPostType('text'); // Reset to default tab
      navigation.navigate('MainTabs', { screen: 'FeedStack' });

    } catch (error) {
      console.error("Error posting: ", error);
      Alert.alert("Post Error", "Could not create post. Please try again. " + error.message);
      setIsUploading(false);
    }
  };

  const handleClearPost = () => {
    Alert.alert(
      "Clear Content",
      "Are you sure you want to clear your post caption and photos?",
      [
        { text: "Cancel", style: "cancel" },
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
  
  const isPostButtonDisabled = isUploading || (postType === 'text' && caption.trim().length === 0) || (postType === 'image' && selectedPhotos.length === 0);
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={28} color="#53544D" />
        </Pressable>
        <Text style={styles.headerTitle}>Create Post</Text>
        {(caption.trim().length > 0 || selectedPhotos.length > 0) ? (
          <Pressable onPress={handleClearPost} style={styles.clearButton}>
            <MaterialIcons name="close" size={24} color="#53544D" />
          </Pressable>
        ) : (
          <View style={styles.clearButton} />
        )}
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
          <ScrollView 
            ref={scrollViewRef}
            style={styles.createContainer}
            keyboardShouldPersistTaps="handled" 
            keyboardDismissMode="none"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              keyboardVisible && styles.scrollContentWithKeyboard
            ]}
            {...panResponder.panHandlers}
          >
              {/* --- TAB SWITCHER --- */}
              <View style={styles.tabContainer}>
                  <TouchableOpacity
                      style={styles.tab}
                      onPress={() => setPostType('image')}
                      disabled={isUploading}
                      onLayout={(event) => onTextLayout(event, 'image')}
                  >
                      <Animated.Text 
                        style={[
                          styles.tabText, 
                          postType === 'image' && styles.activeTabText,
                          { transform: [{ scale: imageScaleAnim }] }
                        ]}
                      >
                        📸 &nbsp;Post
                      </Animated.Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                      style={styles.tab}
                      onPress={() => setPostType('text')}
                      disabled={isUploading}
                      onLayout={(event) => onTextLayout(event, 'text')}
                  >
                      <Animated.Text 
                        style={[
                          styles.tabText, 
                          postType === 'text' && styles.activeTabText,
                          { transform: [{ scale: textScaleAnim }] }
                        ]}
                      >
                        💬 &nbsp;Text
                      </Animated.Text>
                  </TouchableOpacity>
                  <Animated.View 
                    style={[
                      styles.animatedUnderline,
                      {
                        left: underlineAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [
                            textPositions.text + (textWidths.text / 2) - 30,
                            textPositions.image + (textWidths.image / 2) - 30,
                          ],
                        })
                      }
                    ]} 
                  />
              </View>

              <Animated.View style={[styles.postCard, { transform: [{ scale: cardScaleAnim }] }]}>
                  {/* Mock Header */}
                  <Pressable style={styles.postHeader} onPressIn={bounceCard}>
                      <View style={styles.postHeaderLeft}>
                          <Image 
                              source={currentUserData?.photoURL ? { uri: currentUserData.photoURL } : defaultProfilePhoto} 
                              style={styles.avatar} 
                          />
                          <View>
                              <Text style={styles.postUsername}>
                                  {currentUserData?.displayName || 'Your Name'}
                                  {currentUserData?.username ? ( <Text style={styles.postUsernameBracket}> (@{currentUserData.username})</Text> ) : null}
                              </Text>
                          </View>
                      </View>
                  </Pressable>

                  {/* Conditional Content Area */}
                  {postType === 'text' ? (
                      <View style={styles.textOnlyCaptionContainer}>
                          <TextInput
                              placeholder="Write anything..."
                              placeholderTextColor="#b9b9b9"
                              value={caption}
                              onChangeText={setCaption}
                              style={styles.textOnlyInput}
                              multiline
                              editable={!isUploading}
                          />
                      </View>
                  ) : (
                      <>
                          {selectedPhotos.length === 0 ? (
                              <Pressable style={styles.imagePlaceholder} onPress={pickImage} disabled={isUploading}>
                                <Ionicons name="images-outline" size={60} color="#b9b9b9" />
                                <Text style={styles.imagePlaceholderText}>Tap to select photos</Text>
                              </Pressable>
                          ) : (
                            <View style={{ position: 'relative', width: '100%', height: screenWidth - 32, backgroundColor: 'transparent' }}>
                              <FlatList
                                data={selectedPhotos}
                                renderItem={({ item }) => (
                                  <View style={{ width: screenWidth - 32 }}>
                                    <Image source={{ uri: item }} style={styles.postImage} />
                                  </View>
                                )}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                keyExtractor={(item, index) => index.toString()}
                                onViewableItemsChanged={({ viewableItems }) => {
                                  if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index || 0);
                                }}
                                viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                              />
                              {selectedPhotos.length > 1 && (
                                <View style={styles.paginationContainer}> 
                                  {selectedPhotos.map((_, index) => (
                                    <View key={index} style={[styles.paginationDot, activeIndex === index ? styles.paginationDotActive : {}]} />
                                  ))}
                                </View>
                              )}
                            </View>
                          )}
                          <View style={styles.captionContainer}>
                              <TextInput
                                  placeholder="Add a caption..."
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
              </Animated.View>
          </ScrollView>

          {/* Floating bottom buttons */}
          <View style={styles.floatingButtonContainer} pointerEvents="box-none">
            {postType === 'image' && selectedPhotos.length > 0 && (
              <TouchableOpacity style={styles.changePhotoButton} onPress={pickImage} disabled={isUploading}>
                  <MaterialIcons name="photo-camera" size={20} color="#53544D" />
                  <Text style={styles.changePhotoText}>Change Photos</Text>
              </TouchableOpacity>
            )}
            <View style={styles.postButtonContainer}>
              <TouchableOpacity 
                  style={[styles.sendButton, { opacity: isPostButtonDisabled ? 0.5 : 1 }]} 
                  onPress={handleCreatePost}
                  disabled={isPostButtonDisabled}
              >
                  {isUploading ? ( 
                    <ActivityIndicator size="small" color="#FFFFFF" /> 
                  ) : ( 
                    <View style={styles.sendButtonContent}>
                      <Text style={styles.sendButtonText}>Post</Text>
                      <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
                    </View>
                  )}
              </TouchableOpacity>
            </View>
          </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  backButton: { position: 'absolute', left: 20, zIndex: 2, padding: 4 },
  clearButton: {
    position: 'absolute',
    right: 20,
    zIndex: 2,
    padding: 4,
    width: 32,
    height: 32,
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
  createContainer: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentWithKeyboard: {
    paddingBottom: 100, // Extra padding when keyboard is visible
  },
  postCard: { 
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 100,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 5,
  },
  postHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: '#e6e6e6' },
  postUsername: { fontSize: 16, color: '#53544D', fontFamily: 'PatrickHand-Regular' },
  postUsernameBracket: { color: '#b9b9b9', fontSize: 16, fontFamily: 'PatrickHand-Regular' },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    marginHorizontal: 16,
    position: 'relative',
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginHorizontal: 15,
  },
  activeTab: { 
    borderBottomColor: '#8BA637',
  },
  tabText: { 
    fontFamily: 'PatrickHand-Regular', 
    fontSize: 16, 
    color: '#b9b9b9', 
    lineHeight: 22, 
    paddingVertical: 2 
  },
  activeTabText: { 
    color: '#53544D', 
    fontWeight: 'bold' 
  },
  textOnlyCaptionContainer: { paddingHorizontal: 30, paddingVertical: 20, minHeight: 150 },
  textOnlyInput: { fontFamily: 'PatrickHand-Regular', fontSize: 24, color: '#53544D', lineHeight: 32 },
  imagePlaceholder: {
    width: '100%',
    height: screenWidth - 32,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: { marginTop: 10, fontFamily: 'PatrickHand-Regular', fontSize: 16, color: '#b9b9b9' },
  postImage: { width: '100%', height: '100%', backgroundColor: '#e0e0e0' },
  captionContainer: { paddingHorizontal: 20, paddingVertical: 20 },
  captionInput: { fontFamily: 'PatrickHand-Regular', fontSize: 16, color: '#53544D', lineHeight: 22, padding: 0 },
  paginationContainer: { position: 'absolute', bottom: 15, flexDirection: 'row', alignSelf: 'center', zIndex: 10 },
  paginationDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255, 255, 255, 0.5)', marginHorizontal: 4 },
  paginationDotActive: { backgroundColor: 'rgba(255, 255, 255, 0.9)' },
  animatedUnderline: {
    position: 'absolute',
    bottom: 15,
    width: 60,
    height: 3,
    backgroundColor: '#8BA637',
    borderRadius: 2,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
  },
  changePhotoText: { 
    fontSize: 16, 
    fontFamily: 'PatrickHand-Regular', 
    color: '#53544D', 
    marginLeft: 8,
  },
  sendButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    fontSize: 18,
    fontFamily: 'PatrickHand-Regular',
    color: '#FFFFFF',
    marginRight: 10,
  },
  floatingButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postButtonContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  sendButton: {
    backgroundColor: '#8BA637',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});