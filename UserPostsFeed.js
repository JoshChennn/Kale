import React, { useState, useEffect, useRef, useMemo } from 'react'; // ADDED: useMemo
import {
  View, StyleSheet, Image, SafeAreaView, Text, ScrollView, Dimensions, Pressable, ActivityIndicator, Animated, Modal, TextInput, KeyboardAvoidingView, Platform, FlatList, TouchableWithoutFeedback, Keyboard, PanResponder
} from 'react-native';
// ADDED: Import Swipeable from react-native-gesture-handler
import { Swipeable } from 'react-native-gesture-handler';
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
  addDoc,
  runTransaction
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
  const [replyingToComment, setReplyingToComment] = useState(null);
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const textInputRef = useRef(null);
  const [currentUserData, setCurrentUserData] = useState(null);

  const swipeableRefs = useRef(new Map()).current;
  const hapticTriggeredMap = useRef(new Map()).current;

  // MODIFIED: Pre-process comments to handle threading.
  const { topLevelComments, repliesByParent } = useMemo(() => {
    const commentsById = new Map(comments.map(c => [c.id, c]));
    const parents = [];
    const repliesMap = new Map();

    // Pass 1: Identify all top-level comments and initialize a reply list for them.
    comments.forEach(comment => {
      if (!comment.replyToCommentId) {
        parents.push(comment);
        repliesMap.set(comment.id, []);
      }
    });

    // Pass 2: Go through all replies and assign them to their ultimate top-level parent.
    comments.forEach(comment => {
      if (comment.replyToCommentId) {
        let parentId = comment.replyToCommentId;
        const visited = new Set([comment.id]); // For cycle detection

        // Traverse up the reply chain to find the root comment.
        while (parentId) {
          if (repliesMap.has(parentId)) {
            // Found the root parent, add the reply to its list and stop.
            repliesMap.get(parentId).push(comment);
            break;
          }
          if (visited.has(parentId)) break; // Cycle detected, stop.
          visited.add(parentId);

          const nextParent = commentsById.get(parentId);
          parentId = nextParent ? nextParent.replyToCommentId : null;
        }
      }
    });

    // Sort parent comments by date (newest first).
    parents.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);

    // Sort replies within each thread by date (oldest first for conversational flow).
    for (const replyList of repliesMap.values()) {
      replyList.sort((a, b) => a.createdAt.seconds - b.createdAt.seconds);
    }

    return { topLevelComments: parents, repliesByParent: repliesMap };
  }, [comments]);

  // Add useEffect to fetch current user data
  useEffect(() => {
    const fetchCurrentUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setCurrentUserData({
            uid: user.uid,
            displayName: userDoc.data().name || user.displayName,
            photoURL: userDoc.data().profilePhoto || user.photoURL
          });
        } else {
          setCurrentUserData({
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL
          });
        }
      }
    };
    fetchCurrentUserData();
  }, []);

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
      onClose();
      setReplyingToComment(null);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 0;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          handleClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const commentsPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 10;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 50) {
          Keyboard.dismiss();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true, }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true, }),
      ]).start();
    }
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
    }, (error) => { console.error("Error fetching comments:", error); setLoadingComments(false); });

    return () => unsubscribe();
  }, [post]);

  const handleSetReply = (comment) => {
    setReplyingToComment(comment);
    textInputRef.current?.focus();
  };

  const handleCancelReply = () => {
    setReplyingToComment(null);
  };

  const handlePostComment = async () => {
    if (newComment.trim() === '' || !currentUserData) return;

    Keyboard.dismiss();
    const commentText = newComment;
    const replyInfo = replyingToComment;
    setNewComment('');
    setReplyingToComment(null);

    try {
      const commentsRef = collection(db, 'posts', post.id, 'comments');

      const newCommentData = {
        text: commentText,
        userId: currentUserData.uid,
        userName: currentUserData.displayName,
        userAvatar: currentUserData.photoURL,
        createdAt: Timestamp.now(),
      };
      
      if (replyInfo) {
        newCommentData.replyToCommentId = replyInfo.id;
        newCommentData.replyToUserId = replyInfo.userId;
        newCommentData.replyToUserName = replyInfo.userName;
      }

      await addDoc(commentsRef, newCommentData);
      
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        commentsCount: increment(1)
      });
    } catch (error) {
      console.error("Error posting comment:", error);
      setNewComment(commentText);
      setReplyingToComment(replyInfo);
    }
  };

  const handleDeleteComment = async (commentToDelete) => {
    if (!currentUserData || !post) return;

    // Check permissions: user can delete their own comment OR the post owner can delete any comment.
    const isOwnerOfComment = currentUserData.uid === commentToDelete.userId;
    const isOwnerOfPost = currentUserData.uid === post.userId;

    if (!isOwnerOfComment && !isOwnerOfPost) {
      console.log("No permission to delete this comment.");
      swipeableRefs.get(commentToDelete.id)?.close();
      return;
    }

    // Identify all comments to be deleted (the comment itself + its replies if it's a parent)
    const commentsToDeleteIds = [commentToDelete.id];
    if (!commentToDelete.replyToCommentId) { // It's a parent comment
      const replies = repliesByParent.get(commentToDelete.id) || [];
      replies.forEach(reply => commentsToDeleteIds.push(reply.id));
    }
    
    const postRef = doc(db, 'posts', post.id);
    const commentsRef = collection(db, 'posts', post.id, 'comments');

    try {
      await runTransaction(db, async (transaction) => {
        // Delete all the comment documents
        for (const commentId of commentsToDeleteIds) {
          const commentDocRef = doc(commentsRef, commentId);
          transaction.delete(commentDocRef);
        }

        // Decrement the commentsCount on the post
        transaction.update(postRef, {
          commentsCount: increment(-commentsToDeleteIds.length)
        });
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error deleting comment(s):", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      // Ensure the swipeable row closes regardless of success or failure
      swipeableRefs.get(commentToDelete.id)?.close();
    }
  };

  // MODIFIED: This function now renders a single comment row (parent or reply)
  const renderSingleCommentRow = (comment, isReply = false) => {
    // Check if the current user has permission to delete the comment
    const canDelete = currentUserData && post && (currentUserData.uid === comment.userId || currentUserData.uid === post.userId);

    const renderLeftActions = (progress, dragX) => {
      const THRESHOLD = 30;
      const scale = dragX.interpolate({
        inputRange: [THRESHOLD, THRESHOLD + 10, THRESHOLD + 20],
        outputRange: [0.3, 1.2, 1.0],
        extrapolate: 'clamp',
      });
      const opacity = dragX.interpolate({
        inputRange: [THRESHOLD, THRESHOLD + 10],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      });

      return (
        <View style={styles.replyActionContainer}>
          <Animated.View style={{ transform: [{ scale }], opacity }}>
            <Ionicons name="arrow-undo" size={24} color="#8BA637" />
          </Animated.View>
        </View>
      );
    };

    const renderRightActions = (progress) => {
      const trans = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [80, 0], // Width of the action view
      });
      return (
        <View style={styles.deleteActionContainer}>
          <Animated.View style={[styles.deleteButton, { transform: [{ translateX: trans }] }]}>
            <MaterialIcons name="delete-outline" size={28} color="white" />
          </Animated.View>
        </View>
      );
    };

    return (
      <Swipeable
        key={comment.id}
        ref={(ref) => { if (ref && comment.id) { swipeableRefs.set(comment.id, ref); } }}
        renderLeftActions={renderLeftActions}
        renderRightActions={canDelete ? renderRightActions : undefined}
        onSwipeableRightOpen={() => {
          if (canDelete) {
            handleDeleteComment(comment);
          }
        }}
        rightThreshold={40}
        onSwipeableLeftDrag={({ nativeEvent }) => {
          const THRESHOLD = 30;
          if (nativeEvent.x > THRESHOLD && !hapticTriggeredMap.get(comment.id)) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            hapticTriggeredMap.set(comment.id, true);
          } else if (nativeEvent.x <= THRESHOLD && hapticTriggeredMap.get(comment.id)) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            hapticTriggeredMap.set(comment.id, false);
          }
        }}
        onSwipeableLeftOpen={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          handleSetReply(comment);
          swipeableRefs.get(comment.id)?.close();
        }}
        onSwipeableWillClose={() => {
          hapticTriggeredMap.set(comment.id, false);
        }}
        friction={2}
        leftThreshold={30}
      >
        <View style={[styles.commentItem, isReply && styles.replyCommentItem]}>
          <Image source={{ uri: comment.userAvatar }} style={styles.commentAvatar} />
          <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
              <View style={styles.commentHeaderLeft}>
                <Text style={styles.commentUsername}>{comment.userName}</Text>
                <Text style={styles.commentDate}>{comment.date.replace(' ago', '')}</Text>
              </View>
            </View>
            <Text style={styles.commentText}>
              {comment.replyToUserName && (
                <Text style={styles.replyToText}>@{comment.replyToUserName} </Text>
              )}
              {comment.text}
            </Text>
          </View>
        </View>
      </Swipeable>
    );
  };

  // MODIFIED: This function renders a parent comment and all its replies.
  const renderCommentItem = ({ item: parentComment }) => {
    const replies = repliesByParent.get(parentComment.id) || [];

    return (
      <View>
        {renderSingleCommentRow(parentComment, false)}
        {replies.map((reply) => renderSingleCommentRow(reply, true))}
      </View>
    );
  };

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={isVisible}
      onRequestClose={handleClose}
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
        >
          <View style={styles.sheetHeader} {...panResponder.panHandlers}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Comments</Text>
          </View>
          
          {loadingComments ? (
            <ActivityIndicator size="large" color="#8BA637" style={{ flex: 1 }} />
          ) : (
            <View style={{ flex: 1 }} {...commentsPanResponder.panHandlers}>
              <FlatList
                // MODIFIED: Data is now the pre-processed topLevelComments array.
                data={topLevelComments}
                renderItem={renderCommentItem}
                keyExtractor={item => item.id}
                ListEmptyComponent={<Text style={styles.noCommentsText}>No comments yet. Be the first!</Text>}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                showsVerticalScrollIndicator={true}
                scrollEnabled={true}
                nestedScrollEnabled={true}
                style={{ flex: 1 }}
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            {replyingToComment && (
              <View style={styles.replyingToContainer}>
                <Text style={styles.replyingToText}>
                  Replying to @{replyingToComment.userName}
                </Text>
                <Pressable onPress={handleCancelReply}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </Pressable>
              </View>
            )}
            <View style={styles.mainInputRow}>
              <Image 
                source={{ uri: currentUserData?.photoURL || 'https://via.placeholder.com/40' }} 
                style={styles.inputAvatar} 
              />
              <TextInput
                ref={textInputRef}
                style={styles.input}
                placeholder="Add a comment..."
                value={newComment}
                onChangeText={setNewComment}
                placeholderTextColor="#999"
                returnKeyType="send"
                returnKeyLabel="Send"
                onSubmitEditing={handlePostComment}
                blurOnSubmit={false}
              />
              <Pressable 
                onPress={handlePostComment} 
                disabled={newComment.trim() === ''}
                style={[styles.postButton, { opacity: newComment.trim() === '' ? 0.5 : 1 }]}
              >
                <Ionicons name="arrow-up" size={20} color="white" />
              </Pressable>
            </View>
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
  const scrollViewRef = useRef(null);
  const postRefs = useRef(new Map()).current;
  const hasScrolledToInitialPost = useRef(false);
  
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

  // Function to scroll to specific post instantly
  const scrollToPost = (postId) => {
    if (!scrollViewRef.current || !postRefs.has(postId)) {
      return;
    }
    
    const postRef = postRefs.get(postId);
    postRef.measureLayout(
      scrollViewRef.current,
      (x, y) => {
        scrollViewRef.current.scrollTo({
          y: Math.max(0, y), // No offset - post appears right at the top
          animated: false, // Instant scroll
        });
      },
      (error) => {
        console.error('Error measuring post position:', error);
      }
    );
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
        let likedPostIds = new Set();
        if (currentUserId) {
            const likeCheckPromises = postDocs.map(postDoc => 
              getDoc(doc(db, 'posts', postDoc.id, 'likes', currentUserId))
            );
            const likeDocs = await Promise.all(likeCheckPromises);
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
            likedByCurrentUser: likedPostIds.has(postDoc.id),
          };
        });

        // Set posts in normal chronological order
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
  }, [userId, currentUserId, initialPost]);

  // Scroll to initial post when posts are loaded
  useEffect(() => {
    if (!loading && initialPost && posts.length > 0 && !hasScrolledToInitialPost.current) {
      // Use setTimeout to ensure the layout is complete
      setTimeout(() => {
        scrollToPost(initialPost.id);
        hasScrolledToInitialPost.current = true;
      }, 100);
    }
  }, [loading, posts, initialPost]);

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
    const likeRef = doc(postRef, 'likes', currentUserId);

    try {
      await runTransaction(db, async (transaction) => {
        const likeDoc = await transaction.get(likeRef);
        
        if (likeDoc.exists()) {
          // User is unliking the post
          transaction.delete(likeRef);
          transaction.update(postRef, { likesCount: increment(-1) });
        } else {
          // User is liking the post
          transaction.set(likeRef, { createdAt: Timestamp.now(), userId: currentUserId });
          transaction.update(postRef, { likesCount: increment(1) });
        }
      });
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
        <Text style={styles.headerTitle}>All Posts</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ref={scrollViewRef}
      >
        {posts.map((post) => {
          if (!heartAnims.has(post.id)) heartAnims.set(post.id, new Animated.Value(0));
          if (!likeButtonAnims.has(post.id)) likeButtonAnims.set(post.id, new Animated.Value(1.1));
          const heartAnim = heartAnims.get(post.id);
          const likeButtonAnim = likeButtonAnims.get(post.id);

          return (
            <View 
              key={post.id} 
              style={styles.postCard}
              ref={(ref) => {
                if (ref) {
                  postRefs.set(post.id, ref);
                }
              }}
            >
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
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'PatrickHand-Regular',
    color: '#000000',
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
  },
  grabber: {
    width: 40,
    height: 5,
    backgroundColor: '#D1D1D1',
    borderRadius: 2.5,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: 'PatrickHand-Regular',
    color: '#333',
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    backgroundColor: '#FFFFFF', 
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
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', 
    marginBottom: 0,
  },
  commentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentUsername: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 15,
    color: '#8BA637',
    marginRight: 8,
    marginTop: -5,
  },
  commentDate: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 14,
    color: '#b9b9b9',
    marginTop: -5,
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
    flexDirection: 'column', 
    backgroundColor: '#fff',
  },
  mainInputRow: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    position: 'relative',
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
    paddingRight: 45,
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    letterSpacing: 0,
  },
  postButton: {
    position: 'absolute',
    right: 20,
    top: 15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#8BA637',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyActionContainer: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    width: 30,
    height: '100%',
    borderRadius: 0,
  },
  replyButton: {
    padding: 5,
  },
  replyToText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 15,
    color: '#8BA637',
    fontWeight: 'bold',
  },
  replyingToContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 8,
    paddingTop: 8,
    backgroundColor: '#f7f7f7',
  },
  replyingToText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 14,
    color: '#666',
  },
  replyCommentItem: {
    marginLeft: 48, // Indent replies
    paddingLeft: 12,
    // MODIFIED: Removed border to avoid visual artifacts with swipeable
  },
  deleteActionContainer: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    width: 80,
  },
  deleteButton: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  // --- END OF CommentsBottomSheet STYLES ---
});