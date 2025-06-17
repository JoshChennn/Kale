import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, Image, SafeAreaView, Text, ScrollView, Dimensions, Pressable, ActivityIndicator, Animated, Modal, TextInput, KeyboardAvoidingView, Platform, FlatList, TouchableWithoutFeedback, Keyboard, PanResponder
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { db, auth } from './firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc, 
  increment, 
  Timestamp,
  setDoc,
  deleteDoc,
  updateDoc,
  addDoc
} from 'firebase/firestore';
import * as Haptics from 'expo-haptics';

const screenWidth = Dimensions.get('window').width;

// Helper function to format time ago
const getTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  const seconds = Math.floor((new Date() - timestamp.toDate()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
};


// --- START OF NEW CommentsBottomSheet COMPONENT ---
const CommentsBottomSheet = ({ isVisible, onClose, post }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current; // For overlay fade
  const currentUser = auth.currentUser;

  // New function to handle closing animation
  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: Dimensions.get('window').height,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose(); // Call parent's close function AFTER animation completes
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 0; // Only respond to downward gestures
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) { // Only allow downward movement
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) { // If dragged down more than 100 units
          handleClose(); // Use new close handler
        } else {
          // Reset position if not dragged enough
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (isVisible) {
      // Animate in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // The `else` block that handled animation is removed.
    // The `handleClose` function now manages the closing animation.
  }, [isVisible]);

  useEffect(() => {
    if (!post) return;

    setLoadingComments(true);
    const commentsRef = collection(db, 'posts', post.id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedComments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: getTimeAgo(doc.data().createdAt),
      }));
      setComments(fetchedComments);
      setLoadingComments(false);
    }, (error) => {
      console.error("Error fetching comments:", error);
      setLoadingComments(false);
    });

    return () => unsubscribe();
  }, [post]);

  const handlePostComment = async () => {
    if (newComment.trim() === '' || !currentUser) return;

    Keyboard.dismiss();
    const commentText = newComment;
    setNewComment('');

    try {
      // 1. Add the comment to the subcollection
      const commentsRef = collection(db, 'posts', post.id, 'comments');
      await addDoc(commentsRef, {
        text: commentText,
        userId: currentUser.uid,
        userName: currentUser.displayName,
        userAvatar: currentUser.photoURL,
        createdAt: Timestamp.now(),
      });
      
      // 2. Increment the commentsCount on the post
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        commentsCount: increment(1)
      });
    } catch (error) {
      console.error("Error posting comment:", error);
      // Optional: Show an error message to the user
      setNewComment(commentText); // Restore the text on error
    }
  };

  const renderCommentItem = ({ item }) => (
    <View style={styles.commentItem}>
      <Image source={{ uri: item.userAvatar }} style={styles.commentAvatar} />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <View style={styles.commentHeaderLeft}>
            <Text style={styles.commentUsername}>{item.userName}</Text>
            <Text style={styles.commentDate}>{item.date.replace(' ago', '')}</Text>
          </View>
        </View>
        <Text style={styles.commentText}>{item.text}</Text>
      </View>
    </View>
  );

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={isVisible}
      onRequestClose={handleClose} // Use new close handler
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <Animated.View 
          style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.sheetHeader}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Comments</Text>
          </View>
          
          {loadingComments ? (
            <ActivityIndicator size="large" color="#8BA637" style={{ flex: 1 }} />
          ) : (
            <FlatList
              data={comments}
              renderItem={renderCommentItem}
              keyExtractor={item => item.id}
              ListEmptyComponent={<Text style={styles.noCommentsText}>No comments yet. Be the first!</Text>}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            />
          )}

          <View style={styles.inputContainer}>
            <Image source={{ uri: currentUser?.photoURL }} style={styles.inputAvatar} />
            <TextInput
              style={styles.input}
              placeholder="Add a comment..."
              value={newComment}
              onChangeText={setNewComment}
              placeholderTextColor="#999"
            />
            <Pressable onPress={handlePostComment} disabled={newComment.trim() === ''}>
              <Text style={[styles.postButton, { opacity: newComment.trim() === '' ? 0.5 : 1 }]}>
                Post
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
// --- END OF NEW CommentsBottomSheet COMPONENT ---

export default function UserPostsFeed({ navigation, route }) {
  const { userId, initialPost } = route.params;
  const currentUserId = auth.currentUser?.uid;
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState(new Set());
  const lastTap = useRef(0);
  const heartAnims = useRef(new Map()).current;
  const likeButtonAnims = useRef(new Map()).current;
  
  // State for comments bottom sheet
  const [isCommentsSheetVisible, setCommentsSheetVisible] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState(null);

  const openCommentsSheet = (post) => {
    setSelectedPostForComments(post);
    setCommentsSheetVisible(true);
  };

  const closeCommentsSheet = () => {
    setCommentsSheetVisible(false);
  };

  // Initialize heart animations for posts
  useEffect(() => {
    posts.forEach(post => {
      if (!heartAnims.has(post.id)) {
        heartAnims.set(post.id, new Animated.Value(0));
      }
      if (!likeButtonAnims.has(post.id)) {
        likeButtonAnims.set(post.id, new Animated.Value(1.1));
      }
    });
  }, [posts]);

  useEffect(() => {
    if (!userId) return;

    // Fetch user data
    const userRef = doc(db, 'users', userId);
    const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUser({ id: docSnap.id, ...docSnap.data() });
      } else {
        setUser(null);
        setLoading(false);
      }
    }, (error) => {
      console.error("Error fetching user:", error);
      setLoading(false);
    });

    // Fetch posts
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, where("userId", "==", userId), orderBy('createdAt', 'desc'));
    const unsubscribePosts = onSnapshot(q, async (querySnapshot) => {
      try {
        const postDocs = querySnapshot.docs;
        
        // Check which posts are liked by current user
        if (currentUserId) {
            const likeCheckPromises = postDocs.map(postDoc => 
              getDoc(doc(db, 'posts', postDoc.id, 'likes', currentUserId))
            );
            const likeDocs = await Promise.all(likeCheckPromises);
            const likedPostIds = new Set();
            likeDocs.forEach((likeDoc, index) => {
              if (likeDoc.exists()) {
                likedPostIds.add(postDocs[index].id);
              }
            });
            setLikedPosts(likedPostIds);
        }

        const fetchedPosts = postDocs.map(postDoc => {
          const postData = postDoc.data();
          return {
            id: postDoc.id,
            ...postData,
            user: { id: postData.userId, name: postData.userName, avatar: postData.userAvatar },
            date: getTimeAgo(postData.createdAt).replace(' ago', ''),
            likedByCurrentUser: likedPosts.has(postDoc.id),
          };
        });

        setPosts(fetchedPosts);
      } catch (error) {
        console.error("Error processing posts:", error);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Error fetching posts:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeUser();
      unsubscribePosts();
    };
  }, [userId, currentUserId]);

  const handleLikeToggle = async (postId, currentlyLiked) => {
    if (!currentUserId) return;
    
    // Optimistic update
    setPosts(currentPosts =>
      currentPosts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            likedByCurrentUser: !currentlyLiked,
            likesCount: currentlyLiked ? (p.likesCount || 0) - 1 : (p.likesCount || 0) + 1,
          };
        }
        return p;
      })
    );

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Heart bounce animation
    if (!currentlyLiked) {
      const likeButtonAnim = likeButtonAnims.get(postId);
      Animated.spring(likeButtonAnim, {
        toValue: 1.3,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }).start(() => {
        Animated.spring(likeButtonAnim, {
          toValue: 1.1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }).start();
      });
    }

    // Update liked posts set
    setLikedPosts(prev => {
      const newSet = new Set(prev);
      if (currentlyLiked) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });

    // Firebase update
    const postRef = doc(db, 'posts', postId);
    const likeRef = doc(db, 'posts', postId, 'likes', currentUserId);

    try {
      if (currentlyLiked) {
        await deleteDoc(likeRef);
        await updateDoc(postRef, { likesCount: increment(-1) });
      } else {
        await setDoc(likeRef, { createdAt: Timestamp.now(), userId: currentUserId });
        await updateDoc(postRef, { likesCount: increment(1) });
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      // Revert optimistic update on error
      setPosts(currentPosts =>
        currentPosts.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              likedByCurrentUser: currentlyLiked,
              likesCount: currentlyLiked ? (p.likesCount || 0) + 1 : (p.likesCount || 0) - 1,
            };
          }
          return p;
        })
      );
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        if (!currentlyLiked) {
          newSet.delete(postId);
        } else {
          newSet.add(postId);
        }
        return newSet;
      });
    }
  };

  const handleDoubleTap = (post) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      if (!heartAnims.has(post.id)) {
        heartAnims.set(post.id, new Animated.Value(0));
      }
      const heartAnim = heartAnims.get(post.id);
      
      heartAnim.setValue(0);
      
      Animated.sequence([
        Animated.timing(heartAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(heartAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        })
      ]).start();

      if (!post.likedByCurrentUser) {
        handleLikeToggle(post.id, post.likedByCurrentUser);
      }
    }
    lastTap.current = now;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#b9b9b9" />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>
        <ActivityIndicator size="large" color="#8BA637" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#b9b9b9" />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{user?.displayName}'s Posts</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {posts.map((post) => {
          if (!heartAnims.has(post.id)) heartAnims.set(post.id, new Animated.Value(0));
          if (!likeButtonAnims.has(post.id)) likeButtonAnims.set(post.id, new Animated.Value(1.1));
          const heartAnim = heartAnims.get(post.id);
          const likeButtonAnim = likeButtonAnims.get(post.id);

          return (
            <View key={post.id} style={styles.postCard}>
              <Pressable
                style={styles.postHeader}
                onPress={() => navigation.navigate('ProfileModal', { userId: post.user.id })}
              >
                <Image source={{ uri: post.user.avatar }} style={styles.avatar} />
                <View style={styles.postHeaderTextRow}>
                  <Text style={styles.postUsername}>{post.user.name}</Text>
                  <Text style={styles.postDate}>{post.date}</Text>
                </View>
              </Pressable>
              <View style={styles.postImageContainer}>
                <Pressable onPress={() => handleDoubleTap(post)}>
                  <Image source={{ uri: post.imageUri }} style={styles.postImage} />
                </Pressable>
                <Animated.View
                  style={[ styles.heartContainer, {
                      opacity: heartAnim,
                      transform: [
                        { scale: heartAnim.interpolate({
                            inputRange: [0, 0.5, 1],
                            outputRange: [0.5, 1.2, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Ionicons name="heart" size={100} color="#8BA637" />
                </Animated.View>
              </View>
              <View style={styles.actionButtonsContainer}>
                <Pressable style={styles.actionButton} onPress={() => handleLikeToggle(post.id, post.likedByCurrentUser)} >
                  <Animated.View style={{ transform: [{ scale: likeButtonAnim }] }}>
                    <Ionicons 
                      name={post.likedByCurrentUser ? "heart" : "heart-outline"} 
                      size={28} 
                      color={post.likedByCurrentUser ? "#8BA637" : "#333"}
                    />
                  </Animated.View>
                </Pressable>
                <Pressable style={styles.actionButton} onPress={() => openCommentsSheet(post)} >
                  <Ionicons name="chatbubble-outline" size={28} color="#333" />
                </Pressable>
              </View>
              {post.caption && (
                <View style={styles.captionContainer}>
                  <Text style={styles.captionText}>{post.caption}</Text>
                </View>
              )}
              <Pressable style={styles.commentsBtn} onPress={() => openCommentsSheet(post)} >
                <Text style={styles.commentsText}>View comments ({post.commentsCount || 0})</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      {selectedPostForComments && (
        <CommentsBottomSheet
          isVisible={isCommentsSheetVisible}
          onClose={closeCommentsSheet}
          post={selectedPostForComments}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E9E9E9',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
    textAlign: 'center',
    marginTop: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    position: 'absolute',
    left: 0,
    zIndex: 1,
  },
  backButtonText: {
    fontSize: 18,
    fontFamily: 'PatrickHand-Regular',
    color: '#b9b9b9',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  postCard: {
    marginBottom: 20,
    overflow: 'hidden',
    width: screenWidth,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  postHeaderTextRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#e6e6e6',
    borderWidth: 0.2,
    borderColor: '#b9b9b9',
  },
  postUsername: {
    fontSize: 16,
    color: '#53544D',
    fontFamily: 'PatrickHand-Regular',
  },
  postDate: {
    fontSize: 16,
    color: '#b9b9b9',
    fontFamily: 'PatrickHand-Regular',
    textAlign: 'right',
  },
  postImageContainer: {
    position: 'relative',
  },
  postImage: {
    width: '100%',
    aspectRatio: 1,
    resizeMode: 'cover',
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
  captionContainer: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
  },
  captionText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  commentsBtn: {
    paddingLeft: 20,
    paddingBottom: 15,
  },
  commentsText: {
    fontSize: 16,
    color: '#b9b9b9',
    fontFamily: 'PatrickHand-Regular',
  },
  heartContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  // --- START OF CommentsBottomSheet STYLES ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  keyboardAvoidingView: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    height: '85%',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9E9E9',
  },
  grabber: {
    width: 40,
    height: 5,
    backgroundColor: '#D1D1D1',
    borderRadius: 2.5,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: 'PatrickHand-Regular',
    color: '#333',
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#e6e6e6',
  },
  commentContent: {
    flex: 1,
    paddingTop: 2,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  commentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentUsername: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 15,
    color: '#53544D',
    marginRight: 8,
  },
  commentDate: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 14,
    color: '#b9b9b9',
  },
  commentText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 15,
    color: '#333',
    lineHeight: 18,
    marginTop: 1,
  },
  noCommentsText: {
    textAlign: 'center',
    marginTop: 50,
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E9E9E9',
    backgroundColor: '#fff',
  },
  inputAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#e6e6e6',
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 15,
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    letterSpacing: 0,
  },
  postButton: {
    marginLeft: 10,
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#8BA637',
    fontWeight: 'bold',
  },
  // --- END OF CommentsBottomSheet STYLES ---
});