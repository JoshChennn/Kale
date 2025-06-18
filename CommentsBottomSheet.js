import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, StyleSheet, Image, Text, ActivityIndicator, Animated, Modal, TextInput, KeyboardAvoidingView, Platform, FlatList, TouchableWithoutFeedback, Keyboard, PanResponder, Alert, Dimensions, Pressable
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { db, auth } from './firebaseConfig';
import { 
  collection, 
  query, 
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

const getTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  const seconds = Math.floor((new Date() - timestamp.toDate()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
};

const CommentsBottomSheet = ({ isVisible, onClose, post, navigation, closeCommentsSheet }) => {
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

  const { topLevelComments, repliesByParent } = useMemo(() => {
    const commentsById = new Map(comments.map(c => [c.id, c]));
    const parents = [];
    const repliesMap = new Map();
    comments.forEach(comment => {
      if (!comment.replyToCommentId) {
        parents.push(comment);
        repliesMap.set(comment.id, []);
      }
    });
    comments.forEach(comment => {
      if (comment.replyToCommentId) {
        let parentId = comment.replyToCommentId;
        const visited = new Set([comment.id]);
        while (parentId) {
          if (repliesMap.has(parentId)) {
            repliesMap.get(parentId).push(comment);
            break;
          }
          if (visited.has(parentId)) break;
          visited.add(parentId);
          const nextParent = commentsById.get(parentId);
          parentId = nextParent ? nextParent.replyToCommentId : null;
        }
      }
    });
    parents.sort((a, b) => {
      const aReplies = repliesMap.get(a.id) || [];
      const bReplies = repliesMap.get(b.id) || [];
      const aLatestReply = aReplies.length > 0 
        ? Math.max(...aReplies.map(reply => reply.createdAt.seconds))
        : 0;
      const bLatestReply = bReplies.length > 0 
        ? Math.max(...bReplies.map(reply => reply.createdAt.seconds))
        : 0;
      const aMostRecent = Math.max(a.createdAt.seconds, aLatestReply);
      const bMostRecent = Math.max(b.createdAt.seconds, bLatestReply);
      return bMostRecent - aMostRecent;
    });
    for (const replyList of repliesMap.values()) {
      replyList.sort((a, b) => a.createdAt.seconds - b.createdAt.seconds);
    }
    return { topLevelComments: parents, repliesByParent: repliesMap };
  }, [comments]);

  useEffect(() => {
    const fetchCurrentUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setCurrentUserData({
            uid: user.uid,
            displayName: userDoc.data().name || user.displayName,
            username: userDoc.data().username,
            photoURL: userDoc.data().profilePhoto || user.photoURL
          });
        } else {
          setCurrentUserData({
            uid: user.uid,
            displayName: user.displayName,
            username: null,
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
    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const fetchedComments = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: getTimeAgo(doc.data().createdAt),
        }));
        setComments(fetchedComments);
        setLoadingComments(false);
      }, 
      (error) => { 
        console.error("Error fetching comments:", error);
        setLoadingComments(false);
        Alert.alert(
          "Connection Error",
          "There was an issue loading comments. Please try again.",
          [{ text: "OK" }]
        );
      }
    );
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
        userName: currentUserData.username || currentUserData.displayName,
        userAvatar: currentUserData.photoURL,
        createdAt: Timestamp.now(),
      };
      if (replyInfo) {
        newCommentData.replyToCommentId = replyInfo.id;
        newCommentData.replyToUserId = replyInfo.userId;
        newCommentData.replyToUserName = replyInfo.userName;
      }
      const newCommentRef = await addDoc(commentsRef, newCommentData);
      const newCommentId = newCommentRef.id;
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        commentsCount: increment(1)
      });
      const postOwnerId = post.userId;
      const commenterId = currentUserData.uid;
      const createNotification = async (recipientId, type) => {
        if (recipientId === commenterId) return;
        const notificationsColRef = collection(db, 'users', recipientId, 'notifications');
        await addDoc(notificationsColRef, {
          type,
          actorId: commenterId,
          actorName: currentUserData.username || currentUserData.displayName,
          actorAvatar: currentUserData.photoURL,
          postId: post.id,
          postOwnerId: postOwnerId,
          postImageUri: post.imageUri,
          commentId: newCommentId,
          commentText: commentText.substring(0, 100),
          createdAt: Timestamp.now(),
          read: false
        });
      };
      await createNotification(postOwnerId, replyInfo ? 'reply_on_post' : 'comment_on_post');
      if (replyInfo && replyInfo.userId !== postOwnerId) {
        await createNotification(replyInfo.userId, 'reply_on_comment');
      }
    } catch (error) {
      console.error("Error posting comment:", error);
      setNewComment(commentText);
      setReplyingToComment(replyInfo);
    }
  };

  const handleDeleteComment = async (commentToDelete) => {
    if (!currentUserData || !post) return;
    const isOwnerOfComment = currentUserData.uid === commentToDelete.userId;
    const isOwnerOfPost = currentUserData.uid === post.userId;
    if (!isOwnerOfComment && !isOwnerOfPost) {
      swipeableRefs.get(commentToDelete.id)?.close();
      return;
    }
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            swipeableRefs.get(commentToDelete.id)?.close();
          }
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const commentsToDeleteIds = [commentToDelete.id];
            if (!commentToDelete.replyToCommentId) {
              const replies = repliesByParent.get(commentToDelete.id) || [];
              replies.forEach(reply => commentsToDeleteIds.push(reply.id));
            }
            const postRef = doc(db, 'posts', post.id);
            const commentsRef = collection(db, 'posts', post.id, 'comments');
            try {
              await runTransaction(db, async (transaction) => {
                for (const commentId of commentsToDeleteIds) {
                  const commentDocRef = doc(commentsRef, commentId);
                  transaction.delete(commentDocRef);
                }
                transaction.update(postRef, {
                  commentsCount: increment(-commentsToDeleteIds.length)
                });
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              swipeableRefs.get(commentToDelete.id)?.close();
            }
          }
        }
      ]
    );
  };

  const handleProfilePress = (userId) => {
    closeCommentsSheet && closeCommentsSheet();
    if (userId === currentUserData?.uid) {
      navigation.navigate('MainTabs', { screen: 'Profile' });
    } else {
      navigation.navigate('ProfileModal', { userId, presentation: 'modal' });
    }
  };

  const renderSingleCommentRow = (comment, isReply = false) => {
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
      return (
        <View style={styles.deleteActionContainer}>
          <View style={styles.deleteButton}>
            <MaterialIcons name="delete-outline" size={28} color="white" />
          </View>
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
        friction={3}
        rightSwipeThreshold={0.3}
        leftSwipeThreshold={30}
        onSwipeableRightDrag={({ nativeEvent }) => {
          const THRESHOLD = 30;
          if (nativeEvent.x < -THRESHOLD && !hapticTriggeredMap.get(`delete-${comment.id}`)) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            hapticTriggeredMap.set(`delete-${comment.id}`, true);
          } else if (nativeEvent.x >= -THRESHOLD && hapticTriggeredMap.get(`delete-${comment.id}`)) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            hapticTriggeredMap.set(`delete-${comment.id}`, false);
          }
        }}
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
          hapticTriggeredMap.set(`delete-${comment.id}`, false);
        }}
      >
        <View style={[styles.commentItem, isReply && styles.replyCommentItem]}>
          <Pressable onPress={() => handleProfilePress(comment.userId)}>
            <Image source={{ uri: comment.userAvatar }} style={styles.commentAvatar} />
          </Pressable>
          <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
              <View style={styles.commentHeaderLeft}>
                <Pressable onPress={() => handleProfilePress(comment.userId)}>
                  <Text style={styles.commentUsername}>{comment.userName}</Text>
                </Pressable>
                <Text style={styles.commentDate}>{comment.date.replace(' ago', '')}</Text>
              </View>
            </View>
            <Text style={styles.commentText}>
              {comment.replyToUserName && (
                <Text 
                  style={styles.replyToText} 
                  onPress={() => handleProfilePress(comment.replyToUserId)}
                >
                  @{comment.replyToUserName}{' '}
                </Text>
              )}
              {comment.text}
            </Text>
          </View>
        </View>
      </Swipeable>
    );
  };

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
                data={topLevelComments}
                renderItem={renderCommentItem}
                keyExtractor={item => item.id}
                ListEmptyComponent={<Text style={styles.noCommentsText}>No comments yet. Be the first!</Text>}
                contentContainerStyle={{ paddingBottom: 20 }}
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
              <Pressable onPress={() => handleProfilePress(currentUserData?.uid)}>
                <Image 
                  source={{ uri: currentUserData?.photoURL || 'https://via.placeholder.com/40' }} 
                  style={styles.inputAvatar} 
                />
              </Pressable>
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

const styles = StyleSheet.create({
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
    paddingVertical: 8,
    backgroundColor: '#FFFFFF', 
    paddingHorizontal: 20,
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
    fontSize: 18,
    color: '#333',
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
    lineHeight: 20,
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
    marginLeft: 20,
  },
  replyButton: {
    padding: 5,
  },
  replyToText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 15,
    color: '#8BA629',
    fontWeight: 'bold',
  },
  replyingToContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: '#f7f7f7',
  },
  replyingToText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 14,
    color: '#666',
  },
  replyCommentItem: {
    paddingLeft: 68,
  },
  deleteActionContainer: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  deleteButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 30,
  },
});

export default CommentsBottomSheet; 