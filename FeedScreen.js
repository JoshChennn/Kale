import React, { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  Dimensions,
  Pressable,
  ActivityIndicator,
  Alert,
  SectionList,
  Animated,
  Platform,
  ActionSheetIOS,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Modal,
} from 'react-native';
import { db, auth, functions } from './firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  runTransaction,
  increment,
  getDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import defaultProfilePhoto from './assets/default-profile-photo.png';
import * as Haptics from 'expo-haptics'; // --- HAPTICS: Import the library
import { Ionicons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';
import CommentsBottomSheet from './CommentsBottomSheet';

const { width: screenWidth } = Dimensions.get('window');
const storySize = 85;
const STORY_VIEWED_KEY = 'viewedStories_v1';

// Helper function to format time ago
const getTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  const seconds = Math.floor((new Date() - timestamp.toDate()) / 1000);
  
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
};

const handleProfilePress = (userId, navigation) => {
  const currentUserId = auth.currentUser?.uid;
  if (userId === currentUserId) {
    navigation.navigate('ProfileStack', { screen: 'Profile', params: { userId: currentUserId } });
  } else {
    navigation.navigate('ProfileModal', { userId });
  }
};

export default function FeedScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  // --- MODIFICATION: Track cleared state for each feed type ---
  const [clearedFeeds, setClearedFeeds] = useState({
    'Close Friends': false,
    'Everyone': false,
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('Close Friends');
  const [refreshing, setRefreshing] = useState(false);
  const [filterChanging, setFilterChanging] = useState(false);
  const currentUser = auth.currentUser;

  // Refs for animations
  const listRef = useRef(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const clearAnimation = useRef(new Animated.Value(0)).current;
  const clearedOpacity = useRef(new Animated.Value(0)).current;
  const outlineOpacityAnim = useRef(new Animated.Value(0)).current;
  const holdTimeout = useRef(null);
  const hapticInterval = useRef(null);
  const lastTap = useRef(0);
  const heartAnims = useRef(new Map()).current;
  const likeButtonAnims = useRef(new Map()).current;
  const dataLoadedRef = useRef(false);

  // Add animated values for cleared text animation
  const clearedTextOpacity = useRef(new Animated.Value(0)).current;
  const clearedTextScale = useRef(new Animated.Value(0.8)).current;
  const clearedTextTranslateY = useRef(new Animated.Value(20)).current;

  // Add state for comments bottom sheet
  const [isCommentsSheetVisible, setCommentsSheetVisible] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState(null);

  // Add state to control scroll-to-top button visibility
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [headerY, setHeaderY] = useState(0);

  // Add animated value for scroll-to-top button
  const scrollTopAnim = useRef(new Animated.Value(0)).current; // 0: hidden, 1: visible

  const [activeIndexes, setActiveIndexes] = useState({});

  // Track if user is near the footer
  const [nearFooter, setNearFooter] = useState(false);

  // Add state for viewed stories
  const [viewedStories, setViewedStories] = useState({});

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

  const handleFollowRequest = httpsCallable(functions, 'handleFollowRequest');

  // --- DATA FETCHING ---
  useEffect(() => {
    if (!currentUser) return;

    // This listener fetches all notifications (requests, comments, etc.)
    const notificationsQuery = query(
      collection(db, 'users', currentUser.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const unsubscribeNotifications = onSnapshot(notificationsQuery, (querySnapshot) => {
      const newNotifications = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setNotifications(newNotifications);
    });

    // Cleanup function: This is crucial for logging in/out
    return () => unsubscribeNotifications();
  }, [currentUser]);


  // --- DATA FETCHING: Posts & Stories ---
  useEffect(() => {
    if (!currentUser) return;
    
    // --- MODIFICATION: Check if the current feed has been cleared by the user ---
    if (clearedFeeds[selectedFilter]) {
      setPosts([]);
      setLoading(false);
      return () => {}; // Return empty cleanup function
    }

    // Only set loading to true if not currently refreshing and not changing filters
    if (!refreshing && !filterChanging) {
      setLoading(true);
    }
    let unsubscribePosts = () => {}; // Holder for the nested listener

    const userFollowingRef = collection(db, 'following', currentUser.uid, 'userFollowing');
    const unsubscribeFollowing = onSnapshot(userFollowingRef, (followingSnap) => {
      // Important: Unsubscribe from the previous posts listener before creating a new one
      unsubscribePosts();

      // --- FILTER LOGIC FOR CLOSE FRIENDS ---
      // Map following docs to { id, isCloseFriend }
      const following = followingSnap.docs.map(doc => ({
        id: doc.id,
        isCloseFriend: !!doc.data().isCloseFriend,
      }));
      // Filter based on selectedFilter
      let filteredFollowingIds;
      if (selectedFilter === 'Close Friends') {
        filteredFollowingIds = following.filter(f => f.isCloseFriend).map(f => f.id);
      } else {
        filteredFollowingIds = following.map(f => f.id);
      }

      // --- POSTS LOGIC: Fetch posts from filtered users (do NOT include current user)
      if (filteredFollowingIds.length > 0) {
        const limitedFollowingIds = filteredFollowingIds.slice(0, 30);
        // Do NOT include current user's posts in the feed
        const allUserIds = [...limitedFollowingIds];

        const postsQuery = query(
          collection(db, 'posts'),
          where('userId', 'in', allUserIds), // Query for filtered users only
          orderBy('createdAt', 'desc'),
          limit(25)
        );
        
        // Assign the new listener to our holder variable
        unsubscribePosts = onSnapshot(postsQuery, async (querySnapshot) => {
          const postDocs = querySnapshot.docs;
          if (postDocs.length === 0) {
            setPosts([]);
            setLoading(false);
            
            // Stop refreshing if we're currently refreshing
            if (refreshing) {
              setRefreshing(false);
            }
            
            // Stop filter changing if we're currently changing filters
            if (filterChanging) {
              setFilterChanging(false);
            }
            return;
          }

          const postIds = postDocs.map(d => d.id);
          const likeCheckPromises = postIds.map(id =>
            getDoc(doc(db, 'posts', id, 'likes', currentUser.uid))
          );
          const likeDocs = await Promise.all(likeCheckPromises);
          const likeStatusMap = new Map();
          likeDocs.forEach((likeDoc, index) => {
            likeStatusMap.set(postIds[index], likeDoc.exists());
          });

          const fetchedPosts = postDocs.map(doc => {
            const postData = doc.data();
            return {
              id: doc.id,
              ...postData,
              user: { 
                id: postData.userId, 
                name: postData.userName, 
                username: postData.userUsername,
                avatar: postData.userAvatar 
              },
              date: getTimeAgo(postData.createdAt),
              likedByCurrentUser: likeStatusMap.get(doc.id) || false,
              likesCount: postData.likesCount || 0,
            };
          });

          if (fetchedPosts.length > 0) {
            // Reset animations if we get new posts
            clearAnimation.setValue(0);
            clearedOpacity.setValue(0);
          }
          
          setPosts(fetchedPosts);
          setLoading(false); // Stop loading once posts are processed
          
          // Stop refreshing if we're currently refreshing
          if (refreshing) {
            setRefreshing(false);
          }
          
          // Stop filter changing if we're currently changing filters
          if (filterChanging) {
            setFilterChanging(false);
          }
        });
      } else {
        // If user follows no one (or no close friends), show an empty feed
        setPosts([]);
        setLoading(false);
        
        // Stop refreshing if we're currently refreshing
        if (refreshing) {
          setRefreshing(false);
        }
        
        // Stop filter changing if we're currently changing filters
        if (filterChanging) {
          setFilterChanging(false);
        }
      }

      // --- STORIES LOGIC: Fetch stories from filtered users AND the current user
      const storyUserIds = [...new Set([currentUser.uid, ...filteredFollowingIds])];
      const fetchStories = async () => {
        const limitedStoryUserIds = storyUserIds.slice(0, 30);
        const storyUsersQuery = query(collection(db, 'users'), where('__name__', 'in', limitedStoryUserIds));
        const storyUsersSnapshot = await getDocs(storyUsersQuery);
        const userMap = new Map(storyUsersSnapshot.docs.map(d => [d.id, d.data()]));

        const storyPromises = limitedStoryUserIds.map(uid => getDocs(query(collection(db, 'users', uid, 'stories'), limit(5))));
        const storySnapshots = await Promise.all(storyPromises);

        let storyEntries = storySnapshots.map((snapshot, index) => {
          const userId = limitedStoryUserIds[index];
          const user = userMap.get(userId);
          if (user) {
            return {
              id: userId,
              name: user.displayName,
              username: user.username,
              avatar: user.photoURL,
              uriList: snapshot.empty ? [] : snapshot.docs.map(d => ({ id: d.id, ...d.data() })),
            };
          }
          return null;
        }).filter(Boolean);

        // Ensure current user is always first, even if they have no stories
        const hasCurrentUser = storyEntries.some(entry => entry.id === currentUser.uid);
        if (!hasCurrentUser) {
          storyEntries = [
            {
              id: currentUser.uid,
              name: currentUser.displayName || 'You',
              username: currentUser.username,
              avatar: currentUser.photoURL || defaultProfilePhoto,
              uriList: [],
            },
            ...storyEntries,
          ];
        } else {
          // Move current user to the front if not already
          storyEntries = [
            ...storyEntries.filter(entry => entry.id === currentUser.uid),
            ...storyEntries.filter(entry => entry.id !== currentUser.uid),
          ];
        }
        setStories(storyEntries);
        
        // Stop refreshing if we're currently refreshing and posts are also loaded
        if (refreshing && !loading) {
          setRefreshing(false);
        }
      }
      fetchStories();
      
    });

    // Cleanup function: unsubscribes from both listeners when the component unmounts
    return () => {
      unsubscribeFollowing();
      unsubscribePosts();
    };
  }, [currentUser, selectedFilter, clearedFeeds]); // --- MODIFICATION: Add clearedFeeds dependency
  
  // --- ANIMATION EFFECT ---
  useEffect(() => {
    // --- MODIFICATION: Animate based on the cleared status of the current feed ---
    if (clearedFeeds[selectedFilter]) {
      Animated.timing(clearedOpacity, {
        toValue: 1,
        duration: 600,
        delay: 100, // Small delay for a cleaner transition
        useNativeDriver: true,
      }).start();
      
      // If the feed is already cleared, animate the text immediately
      Animated.parallel([
        Animated.timing(clearedTextOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(clearedTextScale, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(clearedTextTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      clearedOpacity.setValue(0);
      // Reset cleared text animations when filter changes to ensure fresh animation
      clearedTextOpacity.setValue(0);
      clearedTextScale.setValue(0.8);
      clearedTextTranslateY.setValue(20);
    }
  }, [clearedFeeds, selectedFilter]);

  // --- HANDLERS ---
  const onAcceptRequest = async (requesterId) => {
    setNotifications(prev => prev.filter(req => req.id !== requesterId));
    try {
      await handleFollowRequest({ requestingUserId: requesterId, action: 'accept' });
      // Force refresh notifications instantly after accepting
      if (currentUser) {
        const notificationsQuery = query(
          collection(db, 'users', currentUser.uid, 'notifications'),
          orderBy('createdAt', 'desc'),
          limit(30)
        );
        const querySnapshot = await getDocs(notificationsQuery);
        const newNotifications = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNotifications(newNotifications);
      }
    } catch (error) {
      console.error("Error accepting request:", error);
      Alert.alert("Error", "Could not accept request. Please try again.");
    }
  };

  const onIgnoreRequest = async (requesterId) => {
    setNotifications(prev => prev.filter(req => req.id !== requesterId));
    try {
      await handleFollowRequest({ requestingUserId: requesterId, action: 'ignore' });
    } catch (error) {
      console.error("Error ignoring request:", error);
      Alert.alert("Error", "Could not ignore request. Please try again.");
    }
  };

  const handleLikeToggle = async (postId, currentlyLiked) => {
    if (!currentUser) return;
  
    // Optimistic UI update
    setPosts(currentPosts =>
      currentPosts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            likedByCurrentUser: !currentlyLiked,
            likesCount: currentlyLiked ? p.likesCount - 1 : p.likesCount + 1,
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
  
    // Firebase update
    const postRef = doc(db, 'posts', postId);
    const likeRef = doc(postRef, 'likes', currentUser.uid);
  
    try {
      await runTransaction(db, async (transaction) => {
        const likeDoc = await transaction.get(likeRef);
  
        if (likeDoc.exists()) {
          // User is unliking the post
          transaction.delete(likeRef);
          transaction.update(postRef, { likesCount: increment(-1) });
        } else {
          // User is liking the post
          transaction.set(likeRef, { createdAt: Timestamp.now(), userId: currentUser.uid });
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
              likesCount: currentlyLiked ? p.likesCount + 1 : p.likesCount - 1,
            };
          }
          return p;
        })
      );
      Alert.alert("Error", "Couldn't like the post. Please try again.");
    }
  };

  const handleDeletePost = async (postId) => {
    if (!currentUser) return;

    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Remove the post from the local state immediately for better UX
              setPosts(currentPosts => currentPosts.filter(p => p.id !== postId));
              
              // Delete from Firebase
              const postRef = doc(db, 'posts', postId);
              await deleteDoc(postRef);
              
              // Haptic feedback for successful deletion
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error("Error deleting post:", error);
              Alert.alert("Error", "Couldn't delete the post. Please try again.");
              
              // Refresh posts to restore the deleted post if deletion failed
              // This will be handled by the existing Firebase listener
            }
          }
        }
      ]
    );
  };

  const handleHoldComplete = () => {
    // --- HAPTICS: Trigger success feedback on hold completion
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Clear the haptic interval
    if (hapticInterval.current) {
      clearInterval(hapticInterval.current);
      hapticInterval.current = null;
    }
    
    holdTimeout.current = null;
    
    // Reset text animation values to ensure fresh animation
    clearedTextOpacity.setValue(0);
    clearedTextScale.setValue(0.8);
    clearedTextTranslateY.setValue(20);
    
    // Check if the ref is attached (allow clearing even if no posts)
    if (listRef.current) {
      // If there are posts, scroll to top first, then animate
      if (posts.length > 0) {
        // 1. Smoothly scroll to the top of the list.
        listRef.current.scrollToLocation({
          animated: true,
          sectionIndex: 0,
          itemIndex: 0,
          viewOffset: 100, // Offset to account for header
        });

        // 2. Wait for the scroll to finish before starting the fade-out.
        setTimeout(() => {
          // 3. Start the exit animation for posts and the footer.
          Animated.timing(clearAnimation, {
            toValue: 1,
            duration: 500, // Duration of the collapse animation
            useNativeDriver: true,
          }).start(({ finished }) => {
            // 4. After the animation completes, update the state.
            if (finished) {
              setPosts([]);
              // --- MODIFICATION: Set cleared state for the CURRENT filter only ---
              setClearedFeeds(prev => ({
                ...prev,
                [selectedFilter]: true,
              }));
              scaleAnim.setValue(1); // Reset button scale
              outlineOpacityAnim.setValue(0); // Reset outline opacity
              
              // 5. Animate the cleared text with a nice sequence
              Animated.sequence([
                Animated.delay(200), // Small delay for better timing
                Animated.parallel([
                  Animated.timing(clearedTextOpacity, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                  }),
                  Animated.spring(clearedTextScale, {
                    toValue: 1,
                    friction: 8,
                    tension: 100,
                    useNativeDriver: true,
                  }),
                  Animated.timing(clearedTextTranslateY, {
                    toValue: 0,
                    duration: 800,
                    useNativeDriver: true,
                  })
                ])
              ]).start();
            }
          });
        }, 400); // This delay should be enough for the scroll animation.
      } else {
        // If no posts, just set the cleared state and animate text immediately
        setClearedFeeds(prev => ({
          ...prev,
          [selectedFilter]: true,
        }));
        scaleAnim.setValue(1); // Reset button scale
        outlineOpacityAnim.setValue(0); // Reset outline opacity
        
        // Animate the cleared text immediately
        Animated.sequence([
          Animated.delay(100), // Small delay for better timing
          Animated.parallel([
            Animated.timing(clearedTextOpacity, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.spring(clearedTextScale, {
              toValue: 1,
              friction: 8,
              tension: 100,
              useNativeDriver: true,
            }),
            Animated.timing(clearedTextTranslateY, {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            })
          ])
        ]).start();
      }
    }
  };

  const handlePressIn = () => {
    // --- HAPTICS: Trigger rapid heavy feedback when press begins
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Start rapid haptic feedback
    hapticInterval.current = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 0);

    holdTimeout.current = setTimeout(handleHoldComplete, 2000);

    // Animate green circle growth and outline fade-in together
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1.8, // Scale to match outline size (100 -> 180)
        duration: 2000,
        useNativeDriver: true,
      }),
      Animated.timing(outlineOpacityAnim, {
        toValue: 1, // Fade in the outline
        duration: 2000,
        useNativeDriver: true,
      })
    ]).start();
  };

  const handlePressOut = () => {
    // This function will now be called if the press is released OR if the finger moves off the button.
    // The check for holdTimeout.current ensures this cleanup logic only runs once per press.
    if (holdTimeout.current) {
      clearTimeout(holdTimeout.current);
      holdTimeout.current = null;
      
      // Clear the haptic interval
      if (hapticInterval.current) {
        clearInterval(hapticInterval.current);
        hapticInterval.current = null;
      }
      
      // Stop any ongoing animations
      scaleAnim.stopAnimation();
      outlineOpacityAnim.stopAnimation();

      // Animate back to the initial state
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
        Animated.timing(outlineOpacityAnim, {
          toValue: 0,
          duration: 300, // Quick fade out
          useNativeDriver: true,
        })
      ]).start();
    }
  };

  const handleScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollPosition = contentOffset.y;
    const screenHeight = layoutMeasurement.height;
    const contentHeight = contentSize.height;

    // Calculate how far from the bottom we are
    const distanceFromBottom = contentHeight - (scrollPosition + screenHeight);
    
    // Show scroll-to-top button if scrolled down more than 200px and not near footer
    setShowScrollTop(scrollPosition > 200 && distanceFromBottom > 400);
    setNearFooter(distanceFromBottom <= 400);
  };

  // Add handler for scroll-to-top button
  const handleScrollToTop = () => {
    if (listRef.current) {
      listRef.current.scrollToLocation({
        animated: true,
        sectionIndex: 0,
        itemIndex: 0,
        viewOffset: 0,
      });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    
    // Haptic feedback for refresh
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Reset cleared feeds state to allow fresh data
    setClearedFeeds({
      'Close Friends': false,
      'Everyone': false,
    });
    
    // Reset animation values
    clearAnimation.setValue(0);
    clearedOpacity.setValue(0);
    clearedTextOpacity.setValue(0);
    clearedTextScale.setValue(0.8);
    clearedTextTranslateY.setValue(20);
    
    // The existing Firebase listeners will automatically fetch fresh data
    // and stop refreshing when data is loaded
  };

  // Show system menu for post actions
  const showPostActions = (postId) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Delete', 'Cancel'],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 1,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            handleDeletePost(postId);
          }
        }
      );
    } else {
      // Fallback for Android: simple Alert
      Alert.alert(
        'Post Options',
        '',
        [
          { text: 'Delete', style: 'destructive', onPress: () => handleDeletePost(postId) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const openCommentsSheet = (post) => {
    setSelectedPostForComments(post);
    setCommentsSheetVisible(true);
  };
  const closeCommentsSheet = () => {
    setCommentsSheetVisible(false);
  };

  const clearNonFollowRequestNotifications = async () => {
    if (!currentUser) return;
    try {
      // Filter out follow_request notifications
      const notificationsToDelete = notifications.filter(n => n.type !== 'follow_request');
      const batch = writeBatch(db); // Use writeBatch for v9 SDK
      notificationsToDelete.forEach(n => {
        const notifRef = doc(db, 'users', currentUser.uid, 'notifications', n.id);
        batch.delete(notifRef);
      });
      await batch.commit();
      // Update local state to only keep follow requests
      setNotifications(prev => prev.filter(n => n.type === 'follow_request'));
    } catch (error) {
      console.error('Error clearing notifications:', error);
      Alert.alert('Error', 'Could not clear notifications. Please try again.');
    }
  };

  // Animate scroll-to-top button in/out
  useEffect(() => {
    Animated.timing(scrollTopAnim, {
      toValue: showScrollTop ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showScrollTop]);

  // Ensure filterChanging doesn't get stuck
  useEffect(() => {
    if (filterChanging) {
      const timeout = setTimeout(() => {
        setFilterChanging(false);
      }, 3000); // Maximum 3 seconds for filter change
      
      return () => clearTimeout(timeout);
    }
  }, [filterChanging]);

  // Add minimum refresh time to prevent flickering
  useEffect(() => {
    if (refreshing) {
      const minRefreshTime = setTimeout(() => {
        // Only stop refreshing if data has been loaded (loading is false)
        if (!loading) {
          setRefreshing(false);
        }
      }, 800); // Minimum 800ms for refresh to feel natural
      
      return () => clearTimeout(minRefreshTime);
    }
  }, [refreshing, loading]);

  // Ensure refreshing doesn't get stuck
  useEffect(() => {
    if (refreshing) {
      const timeout = setTimeout(() => {
        setRefreshing(false);
      }, 5000); // Maximum 5 seconds for refresh
      
      return () => clearTimeout(timeout);
    }
  }, [refreshing]);

  const handleHeaderLayout = (event) => {
    const { y } = event.nativeEvent.layout;
    setHeaderY(y);
  };

  // Load viewed stories from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORY_VIEWED_KEY);
        if (stored) setViewedStories(JSON.parse(stored));
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // Helper to mark a story as viewed
  const markStoryViewed = async (userId) => {
    setViewedStories(prev => {
      const updated = { ...prev, [userId]: true };
      AsyncStorage.setItem(STORY_VIEWED_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  if (loading && !refreshing && !filterChanging) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#8BA637" />
      </SafeAreaView>
    );
  }

  // --- ANIMATION STYLES ---
  const postAndFooterOpacity = clearAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  
  const postTranslateY = clearAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 50],
  });

  const footerTranslateY = clearAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 100],
  });


  // --- RENDER COMPONENTS ---
  const renderPost = ({ item: post }) => {
    // Get or create animation values for this post
    if (!heartAnims.has(post.id)) {
      heartAnims.set(post.id, new Animated.Value(0));
    }
    if (!likeButtonAnims.has(post.id)) {
      likeButtonAnims.set(post.id, new Animated.Value(1.1));
    }
    const heartAnim = heartAnims.get(post.id);
    const likeButtonAnim = likeButtonAnims.get(post.id);

    const activeIndex = activeIndexes[post.id] || 0;
    const onViewableItemsChanged = ({ viewableItems }) => {
      if (viewableItems.length > 0) {
        const newIndex = viewableItems[0].index;
        // Only update state if the index has actually changed
        if (newIndex !== undefined && activeIndex !== newIndex) {
          setActiveIndexes(prev => ({
            ...prev,
            [post.id]: newIndex,
          }));
        }
      }
    };

    const handleDoubleTap = (event) => {
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;
      
      if (now - lastTap.current < DOUBLE_TAP_DELAY) {
        // Reset animation value
        heartAnim.setValue(0);
        
        // Start animation
        Animated.sequence([
          Animated.timing(heartAnim, {
            toValue: 1,
            duration: 400, // Faster fade in
            useNativeDriver: true,
          }),
          Animated.timing(heartAnim, {
            toValue: 0,
            duration: 400, // Faster fade out
            useNativeDriver: true,
          })
        ]).start();

        // Like the post if not already liked
        if (!post.likedByCurrentUser) {
          handleLikeToggle(post.id, post.likedByCurrentUser);
        }
      }
      lastTap.current = now;
    };
    
    const images = post.imageUris || (post.imageUri ? [post.imageUri] : []);

    if (images.length === 0) {
      // Text-only post
      return (
        <Animated.View style={{
          opacity: postAndFooterOpacity,
          transform: [{ translateY: postTranslateY }]
        }}>
          <View style={[styles.postCard, { backgroundColor: '#FFFFFF' }]}>
            <Pressable onPress={handleDoubleTap} style={styles.textPostPressable}>
              <View style={styles.postHeader}>
                <Pressable
                  style={styles.postHeaderLeft}
                  onPress={() => {
                    const postUserId = post.user.id;
                    const currentUserId = currentUser.uid;
                    if (postUserId === currentUserId) {
                      navigation.navigate('ProfileStack', { screen: 'Profile', params: { userId: currentUserId }});
                    } else {
                      navigation.navigate('ProfileModal', { userId: postUserId });
                    }
                  }}
                >
                  <Image source={{ uri: post.user.avatar }} style={styles.avatar} />
                  <View style={styles.postHeaderTextRow}>
                    <View style={styles.postHeaderNameContainer}>
                      <Text style={styles.postUsername}>{post.user.name}</Text>
                      {post.user.username && (
                        <Text style={styles.postUsernameHandle}> (@{post.user.username})</Text>
                      )}
                    </View>
                    <Text style={styles.postDate}>{post.date}</Text>
                  </View>
                </Pressable>
                {post.user.id === currentUser.uid && (
                  <Pressable 
                    style={styles.threeDotsButton}
                    onPress={() => showPostActions(post.id)}
                  >
                    <Ionicons name="ellipsis-horizontal" size={18} color="#53544D" />
                  </Pressable>
                )}
              </View>
              <View style={styles.textOnlyCaptionContainer}>
                <Text style={styles.textOnlyCaption}>{post.caption}</Text>
              </View>
              <Animated.View
                style={[
                  styles.heartContainer,
                  {
                    opacity: heartAnim,
                    transform: [
                      {
                        scale: heartAnim.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [0.5, 1.2, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Ionicons name="heart" size={90} color="#8BA637" />
              </Animated.View>
            </Pressable>
            <View style={styles.actionButtonsContainer}>
              <Pressable 
                style={styles.actionButton}
                onPress={() => handleLikeToggle(post.id, post.likedByCurrentUser)}
              >
                <Animated.View style={{ transform: [{ scale: likeButtonAnim }] }}>
                  <Ionicons 
                    name={post.likedByCurrentUser ? "heart" : "heart-outline"} 
                    size={28} 
                    color={post.likedByCurrentUser ? "#8BA637" : "#53544D"}
                  />
                </Animated.View>
              </Pressable>
              <Pressable 
                style={styles.actionButton}
                onPress={() => openCommentsSheet(post)}
              >
                <Ionicons name="chatbubble-outline" size={28} color="#53544D" />
              </Pressable>
            </View>
            <Pressable
              style={styles.commentsBtn}
              onPress={() => openCommentsSheet(post)}
            >
              <Text style={styles.commentsText}>View comments ({post.commentsCount || 0})</Text>
            </Pressable>
          </View>
        </Animated.View>
      );
    }

    return (
      <Animated.View style={{
        opacity: postAndFooterOpacity,
        transform: [{ translateY: postTranslateY }]
      }}>
        <View style={[styles.postCard, { backgroundColor: '#FFFFFF' }]}>
          <View style={styles.postHeader}>
            <Pressable
              style={styles.postHeaderLeft}
              onPress={() => {
                const postUserId = post.user.id;
                const currentUserId = currentUser.uid;
                if (postUserId === currentUserId) {
                  navigation.navigate('ProfileStack', { screen: 'Profile', params: { userId: currentUserId }});
                } else {
                  navigation.navigate('ProfileModal', { userId: postUserId });
                }
              }}
            >
              <Image source={{ uri: post.user.avatar }} style={styles.avatar} />
              <View style={styles.postHeaderTextRow}>
                <View style={styles.postHeaderNameContainer}>
                  <Text style={styles.postUsername}>{post.user.name}</Text>
                  {post.user.username && (
                    <Text style={styles.postUsernameHandle}> (@{post.user.username})</Text>
                  )}
                </View>
                <Text style={styles.postDate}>{post.date}</Text>
              </View>
            </Pressable>
            {post.user.id === currentUser.uid && (
              <Pressable 
                style={styles.threeDotsButton}
                onPress={() => showPostActions(post.id)}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#53544D" />
              </Pressable>
            )}
          </View>
          <View style={styles.postImageContainer}>
            <FlatList
              data={images}
              renderItem={({ item: imageUri }) => (
                <Pressable onPress={handleDoubleTap}>
                  <Image source={{ uri: imageUri }} style={styles.postImage} />
                </Pressable>
              )}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, index) => `${post.id}-image-${index}`}
              style={{ width: screenWidth }}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            />
            {images.length > 1 && (
              <View style={styles.paginationContainer}>
                {images.map((_, index) => (
                  <View key={index} style={[styles.paginationDot, activeIndex === index ? styles.paginationDotActive : {}]} />
                ))}
              </View>
            )}
            <Animated.View
              style={[
                styles.heartContainer,
                {
                  opacity: heartAnim,
                  transform: [
                    {
                      scale: heartAnim.interpolate({
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
            <Pressable 
              style={styles.actionButton}
              onPress={() => handleLikeToggle(post.id, post.likedByCurrentUser)}
            >
              <Animated.View style={{ transform: [{ scale: likeButtonAnim }] }}>
                <Ionicons 
                  name={post.likedByCurrentUser ? "heart" : "heart-outline"} 
                  size={28} 
                  color={post.likedByCurrentUser ? "#8BA637" : "#53544D"}
                />
              </Animated.View>
            </Pressable>
            <Pressable 
              style={styles.actionButton}
              onPress={() => openCommentsSheet(post)}
            >
              <Ionicons name="chatbubble-outline" size={28} color="#53544D" />
            </Pressable>
          </View>
          {post.caption && (
            <View style={styles.captionContainer}>
              <Text style={styles.captionText}>{post.caption}</Text>
            </View>
          )}
          <Pressable
            style={styles.commentsBtn}
            onPress={() => openCommentsSheet(post)}
          >
            <Text style={styles.commentsText}>View comments ({post.commentsCount || 0})</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  const renderNotification = ({ item: notification }) => {
    const timeAgo = getTimeAgo(notification.createdAt);

    // At the top of renderNotification (before any if/return)
    const [isFollowing, setIsFollowing] = React.useState(false);
    const [hasRequested, setHasRequested] = React.useState(false);

    React.useEffect(() => {
      if (!notification.followerId || !auth.currentUser) return;
      const followingDocRef = doc(db, 'following', auth.currentUser.uid, 'userFollowing', notification.followerId);
      const unsubscribe = onSnapshot(followingDocRef, (docSnap) => {
        setIsFollowing(docSnap.exists());
      });
      const requestDocRef = doc(db, 'users', notification.followerId, 'followRequests', auth.currentUser.uid);
      const unsubscribeRequest = onSnapshot(requestDocRef, (docSnap) => {
        setHasRequested(docSnap.exists());
      });
      return () => {
        unsubscribe();
        unsubscribeRequest();
      };
    }, [notification.followerId]);

    // --- RENDER COMMENT/REPLY NOTIFICATIONS ---
    if (['comment_on_post', 'reply_on_post', 'reply_on_comment'].includes(notification.type)) {
        let message = '';
        const commentPreview = notification.commentText ? `: "${notification.commentText}"` : '.';
        
        if (notification.type === 'reply_on_comment') {
            message = ` replied to your comment${commentPreview}`;
        } else {
            message = ` commented on your post${commentPreview}`;
        }

        return (
            <Pressable 
                style={styles.notificationCardWithImage}
                onPress={() => navigation.navigate('UserPostsFeed', { 
                    userId: notification.postOwnerId, 
                    initialPost: { id: notification.postId } 
                })}
            >
                <View style={styles.requestUserInfo}>
                    <Pressable onPress={() => navigation.navigate('ProfileModal', { userId: notification.actorId })}>
                        <Image source={notification.actorAvatar ? { uri: notification.actorAvatar } : defaultProfilePhoto} style={styles.requestAvatar} />
                    </Pressable>
                    <View style={styles.requestTextContainer}>
                        <Text style={styles.requestText} numberOfLines={2}>
                            <Text style={styles.requestName}>{notification.actorName}</Text>
                            {message}
                            <Text style={styles.requestTime}> {timeAgo}</Text>
                        </Text>
                    </View>
                </View>
                <Image source={{ uri: notification.postImageUri }} style={styles.notificationPostImage} /> 
            </Pressable>
        );
    }

    // --- RENDER "now_following_you" NOTIFICATION ---
    if (notification.type === 'now_following_you') {
      const handleFollowBack = async () => {
        if (!auth.currentUser || isFollowing || hasRequested) return;
        setHasRequested(true); // Optimistic update
        try {
          await httpsCallable(functions, 'requestToFollowUser')({ userIdToFollow: notification.followerId });
        } catch (e) {
          setHasRequested(false);
          Alert.alert('Error', 'Could not follow back. Please try again.');
        }
      };

      const handleWithdrawRequest = async () => {
        if (!auth.currentUser || !hasRequested) return;
        setHasRequested(false); // Optimistic update
        try {
          await httpsCallable(functions, 'withdrawFollowRequest')({ userIdToWithdrawFrom: notification.followerId });
        } catch (e) {
          setHasRequested(true);
          Alert.alert('Error', 'Could not withdraw request. Please try again.');
        }
      };

      return (
        <View style={styles.requestCard}>
          <Pressable
            style={styles.requestUserInfo}
            onPress={() => navigation.navigate('ProfileModal', { userId: notification.followerId })}
          >
            <Image
              source={notification.followerAvatar ? { uri: notification.followerAvatar } : defaultProfilePhoto}
              style={styles.requestAvatar}
            />
            <View style={styles.requestTextContainer}>
              <Text style={styles.requestText}>
                <Text style={styles.requestUsername}>{notification.followerUsername ? notification.followerUsername : notification.followerName || 'A user'}</Text>
                {` is now following you.`}
                <Text style={styles.requestTime}> {timeAgo}</Text>
              </Text>
            </View>
          </Pressable>
          {!isFollowing && (
            <View style={styles.requestActions}>
              {hasRequested ? (
                <Pressable style={styles.requestedButton} onPress={handleWithdrawRequest}>
                  <Text style={styles.requestedButtonText}>Requested</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.acceptButton} onPress={handleFollowBack}>
                  <Text style={styles.acceptButtonText}>Follow Back</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      );
    }

    // --- RENDER FOLLOW NOTIFICATIONS (Existing Logic, adapted) ---
    let username, profileId, avatarUri;
    const hasActions = notification.type === 'follow_request';
  
    if (notification.type === 'follow_request') {
      username = notification.requesterUsername || notification.requesterName || 'A user';
      profileId = notification.id;
      avatarUri = notification.requesterAvatar;
    } else if (notification.type === 'follow_accepted') {
      username = notification.acceptorUsername || notification.acceptorName || 'A user';
      profileId = notification.acceptorId;
      avatarUri = notification.acceptorAvatar;
    } else if (notification.type) { // Render nothing if type is unknown or missing
      return null;
    }
  
    return (
      <View style={styles.requestCard}>
        <Pressable
          style={styles.requestUserInfo}
          onPress={() => navigation.navigate('ProfileModal', { userId: profileId })}
        >
          <Image
            source={avatarUri ? { uri: avatarUri } : defaultProfilePhoto}
            style={styles.requestAvatar}
          />
          <View style={styles.requestTextContainer}>
            <Text style={styles.requestText}>
              <Text style={styles.requestUsername}>{username}</Text>
              {notification.type === 'follow_request' 
                ? ' requested to follow you.'
                : ' accepted your follow request.'}
              <Text style={styles.requestTime}> {timeAgo}</Text>
            </Text>
          </View>
        </Pressable>
  
        {hasActions && (
          <View style={styles.requestActions}>
            <Pressable style={styles.acceptButton} onPress={() => onAcceptRequest(notification.id)}>
              <Text style={styles.acceptButtonText}>Accept</Text>
            </Pressable>
            <Pressable style={styles.ignoreButton} onPress={() => onIgnoreRequest(notification.id)}>
              <Text style={styles.ignoreButtonText}>Ignore</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const renderStories = ({ item }) => {
    // Only show users with stories, except always show current user
    const filteredStories = item.storyData.filter(storyBlock =>
      storyBlock.id === currentUser.uid || (storyBlock.uriList && storyBlock.uriList.length > 0)
    );
    return (
      <View style={[styles.storiesContainer, { backgroundColor: '#FFFFFF' }]}> 
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filteredStories.map(storyBlock => {
            const isViewed = !!viewedStories[storyBlock.id];
            const hasStories = storyBlock.uriList && storyBlock.uriList.length > 0;
            const textColor = hasStories ? (isViewed ? '#b9b9b9' : '#8BA637') : '#b9b9b9';
            const borderColor = hasStories ? (isViewed ? '#b9b9b9' : '#8BA637') : '#b9b9b9';
            const isOwnStory = storyBlock.id === currentUser.uid;
            return (
              <View key={storyBlock.id} style={styles.storyItem}>
                <Pressable
                  style={{}}
                  onPress={() => {
                    if (isOwnStory && (!storyBlock.uriList || storyBlock.uriList.length === 0)) {
                      // Open create story screen
                      navigation.navigate('CreateStory');
                      return;
                    }
                    if (hasStories) markStoryViewed(storyBlock.id);
                    navigation.navigate('StoryViewer', { stories: storyBlock.uriList, initialIndex: 0 });
                  }}
                >
                  <View style={[styles.storyOuterCircle, { borderColor }]}> 
                    <Image source={storyBlock.avatar ? { uri: storyBlock.avatar } : defaultProfilePhoto} style={styles.storyImage} />
                    {/* Add green plus button for own story */}
                    {isOwnStory && (
                      <Pressable
                        style={styles.addStoryButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          navigation.navigate('CreateStory');
                        }}
                      >
                        <View style={styles.addStoryCircle}>
                          <MaterialIcons name="add" size={18} color="#fff" />
                        </View>
                      </Pressable>
                    )}
                  </View>
                  <Text
                    style={[
                      isOwnStory ? styles.storyName : styles.storyUsername,
                      { color: textColor },
                    ]}
                    numberOfLines={1}
                  >
                    {isOwnStory
                      ? 'Your Story'
                      : storyBlock.username
                        ? `${storyBlock.username}`
                        : storyBlock.name}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderItem = ({ item, section }) => {
    if (section.type === 'posts' && item.isDummyHeader) {
      return null; // This is just to force the sticky header to always show
    }
    if (section.type === 'posts' && item.isStoryBar) {
      return renderStories({ item: { storyData: stories } });
    }
    switch (section.type) {
      case 'notifications': return renderNotification({ item });
      case 'posts': return renderPost({ item });
      default: return null;
    }
  };

  const renderSectionHeader = ({ section: { title, type } }) => {
    if (type === 'posts') {
      return (
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>{title}</Text>
          <View style={styles.filterContainer}>
            <Pressable 
              style={styles.filterButton}
              onPress={() => {
                clearAnimation.setValue(0);
                setFilterChanging(true);
                setSelectedFilter(selectedFilter === 'Close Friends' ? 'Everyone' : 'Close Friends');
                setTimeout(() => setFilterChanging(false), 1000);
              }}
            >
              <Text style={styles.filterText}>{selectedFilter}</Text>
              <MaterialIcons 
                name="swap-horiz" 
                size={24} 
                color="#8BA637" 
              />
            </Pressable>
          </View>
        </View>
      );
    }
    
    // For notifications section
    if (type === 'notifications') {
      const hasNonFollowRequest = notifications.some(n => n.type !== 'follow_request');
      return (
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>{title}</Text>
          <View style={styles.filterContainer}>
            {hasNonFollowRequest && (
              <Pressable 
                style={styles.filterButton}
                onPress={clearNonFollowRequestNotifications}
              >
                <Text style={styles.filterText}>Clear</Text>
                <MaterialIcons 
                  name="clear" 
                  size={24} 
                  marginTop={3}
                  color="#8BA637" 
                />
              </Pressable>
            )}
          </View>
        </View>
      );
    }
    
    // For other sections
    return (
      <View style={styles.sectionHeaderContainer}>
        <Text style={styles.sectionHeader}>{title}</Text>
      </View>
    );
  };
  
  const postsWithStories = [
    { id: 'dummy-header', isDummyHeader: true },
    { id: 'story-bar', isStoryBar: true, storyData: stories },
    ...posts,
  ];

  const sections = [];
  if (notifications.length > 0) {
    sections.push({ title: 'Notifications', data: notifications, type: 'notifications' });
  }
  sections.push({ title: 'New Posts', data: postsWithStories, type: 'posts' });

  const ListFooterComponent = () => {
    // --- MODIFICATION: If posts are empty for any reason, show the cleared message.
    if (posts.length === 0) {
      const isCleared = clearedFeeds[selectedFilter];
      const getTimeBasedMessage = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 9) return "Go drink some water. 💧";
        if (hour >= 9 && hour < 15) return "Get some work done. 💼";
        if (hour >= 15 && hour < 19) return "Get some fresh air. 🌳";
        if (hour >= 19 && hour < 23) return "Go read a book. 📚";
        return "Get some sleep. 😴";
      };

      // If the feed was explicitly cleared, use the fade-in animation.
      if (isCleared) {
        return (
          <Animated.View style={[
            styles.clearedContainer, { backgroundColor: '#FFFFFF' }, 
            { 
              opacity: clearedTextOpacity,
              transform: [
                { scale: clearedTextScale },
                { translateY: clearedTextTranslateY }
              ]
            }
          ]}> 
            <Text style={styles.clearedText}>That's it for today.</Text>
            <Text style={styles.clearedSubText}>{getTimeBasedMessage()}</Text>
          </Animated.View>
        );
      }
      
      // If the feed is naturally empty, just show the message without animation.
      return (
        <View style={[styles.clearedContainer, { backgroundColor: '#FFFFFF' }]}> 
          <Text style={styles.clearedText}>That's it for today.</Text>
          <Text style={styles.clearedSubText}>{getTimeBasedMessage()}</Text>
        </View>
      );
    }

    // Use the width from the stylesheet to calculate the button's radius
    const buttonRadius = styles.buttonWrapper.width / 2;

    return (
      <Animated.View style={{
        opacity: postAndFooterOpacity,
        transform: [{ translateY: footerTranslateY }]
      }}>
        <View style={styles.footerContainer}>
          <Text style={styles.footerTitle}>You're all caught up.</Text>
          <Text style={styles.footerSubtitle}>Hold to clear posts:</Text>
          <View
            onStartShouldSetResponder={(evt) => {
              // Only respond to touches that start inside the circle
              const { locationX, locationY } = evt.nativeEvent;
              const distanceSquared = Math.pow(locationX - buttonRadius, 2) + Math.pow(locationY - buttonRadius, 2);
              return distanceSquared <= Math.pow(buttonRadius, 2);
            }}
            onResponderGrant={handlePressIn}
            onResponderRelease={handlePressOut}
            onResponderTerminate={handlePressOut} // Handle gesture interruptions (e.g., scrolling)
            onResponderMove={(evt) => {
              // If the press has already been cancelled, do nothing
              if (!holdTimeout.current) return;

              const { locationX, locationY } = evt.nativeEvent;
              const distanceSquared = Math.pow(locationX - buttonRadius, 2) + Math.pow(locationY - buttonRadius, 2);
              
              // If finger moves outside the circle, cancel the press
              if (distanceSquared > Math.pow(buttonRadius, 2)) {
                handlePressOut();
              }
            }}
          >
            <View style={styles.buttonWrapper} pointerEvents="none">
              <Animated.View style={[styles.outlineCircle, { opacity: outlineOpacityAnim }]} />
              <Animated.View style={[styles.clearButton, { transform: [{ scale: scaleAnim }] }]} />
              <Text style={styles.clearButtonEmoji}>🥬</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={
          <View>
            <Text style={styles.header}>KALE</Text>
          </View>
        }
        ListFooterComponent={ListFooterComponent}
        ListEmptyComponent={() => null}
        contentContainerStyle={styles.listContentContainer}
        stickySectionHeadersEnabled={true}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            progressBackgroundColor="#FFFFFF"
          />
        }
        style={{ backgroundColor: '#FFFFFF' }}
      />
      {/* Animated Floating Scroll-to-Top Button */}
      <Animated.View
        pointerEvents={showScrollTop && !isCommentsSheetVisible ? 'auto' : 'none'}
        style={[
          styles.scrollTopButtonContainer,
          {
            opacity: scrollTopAnim,
            transform: [
              {
                translateX: scrollTopAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [100, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleScrollToTop}
          activeOpacity={0.8}
          style={styles.scrollTopButton}
        >
          <Ionicons name="arrow-up" size={30} style={styles.scrollTopButtonIcon} />
        </TouchableOpacity>
      </Animated.View>
      {selectedPostForComments && (
        <CommentsBottomSheet
          isVisible={isCommentsSheetVisible}
          onClose={closeCommentsSheet}
          post={selectedPostForComments}
          navigation={navigation}
          closeCommentsSheet={closeCommentsSheet}
        />
      )}
    </SafeAreaView>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },
  listContentContainer: {
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  header: {
    fontSize: 40,
    textAlign: 'center',
    marginVertical: 30,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    fontSize: 20,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
    flex: 1, // Allow header text to shrink if needed
  },
  filterContainer: {
    position: 'relative',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingVertical: 5,
    marginRight: -5,
  },
  filterText: {
    fontSize: 20,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
    marginRight: 5,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  requestUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#e6e6e6',
    borderWidth: 0.2,
    borderColor: '#b9b9b9',
  },
  requestTextContainer: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 4,
    paddingRight: 10,
    maxWidth: '70%',
  },
  requestText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#53544D',
    flexShrink: 1,
  },
  requestUsername: {
    color: '#53544D',
  },
  requestTime: {
    color: '#b9b9b9',
  },
  requestActions: {
    flexDirection: 'row',
  },
  acceptButton: {
    backgroundColor: '#8BA637',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 5,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontFamily: 'PatrickHand-Regular',
    fontSize: 14,
  },
  ignoreButton: {
    backgroundColor: '#e6e6e6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 5,
    marginLeft: 10,
  },
  ignoreButtonText: {
    color: '#53544D',
    fontFamily: 'PatrickHand-Regular',
    fontSize: 14,
  },
  notificationCardWithImage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingLeft: 20,
    paddingRight: 20, // A bit less padding on the right for the image
    backgroundColor: '#FFFFFF',
  },
  notificationPostImage: {
    width: 44,
    height: 44,
    borderRadius: 4,
  },
  storiesContainer: {
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    paddingLeft: 15,
  },
  storyItem: {
    width: storySize + 10,
    alignItems: 'center',
    marginRight: 10,
  },
  storyOuterCircle: {
    width: storySize,
    height: storySize,
    borderRadius: storySize / 2,
    borderWidth: 3,
    borderColor: '#8BA637',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff', // ensures gap is white
  },
  storyImage: {
    width: storySize - 12,
    height: storySize - 12,
    borderRadius: (storySize - 12) / 2,
    backgroundColor: '#fff',
  },
  storyName: {
    fontFamily: 'PatrickHand-Regular',
    marginTop: 6,
    fontSize: 16,
    color: '#b9b9b9',
    textAlign: 'center',
  },
  storyUsername: {
    fontFamily: 'PatrickHand-Regular',
    marginTop: 6,
    fontSize: 16,
    color: '#b9b9b9',
    textAlign: 'center',
  },
  postCard: {
    marginBottom: 20,
    overflow: 'hidden',
    width: screenWidth,
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
  postHeaderNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postUsername: {
    fontSize: 16,
    color: '#53544D',
    fontFamily: 'PatrickHand-Regular',
  },
  postUsernameHandle: {
    fontSize: 16,
    color: '#b9b9b9',
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
    width: screenWidth,
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
  likesText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#53544D',
    fontWeight: 'bold',
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  captionContainer: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
  },
  captionText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#53544D',
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
  footerContainer: {
    paddingTop: 40,
    paddingBottom: 120,
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: '#8BA637',
    marginHorizontal: 20,
    borderRadius: 20,
  },
  footerTitle: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 36,
    color: '#FFFFFF',
  },
  footerSubtitle: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 28,
    color: '#CADE81',
    marginTop: 4,
    marginBottom: 40,
  },
  buttonWrapper: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -50,
  },
  outlineCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 4,
    borderColor: '#E0E0E0',
    position: 'absolute',
  },
  clearButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
  },
  clearButtonEmoji: {
    fontSize: 50,
    position: 'absolute',
    color: '#8BA637',
  },
  clearedContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    minHeight: 300, // Ensure it has some height
    backgroundColor: '#FFFFFF',
  },
  clearedText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 24,
    color: '#53544D',
    marginTop: 100,
  },
  clearedSubText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 18,
    color: '#b9b9b9',
    marginTop: 8,
  },
  heartContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    top: 0,
    left: 0,
  },
  threeDotsButton: {
    paddingLeft: 15,
  },
  requestedButton: {
    backgroundColor: '#e6e6e6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 5,
    marginRight: 0,
  },
  requestedButtonText: {
    color: '#53544D',
    fontFamily: 'PatrickHand-Regular',
    fontSize: 14,
  },
  textOnlyCaptionContainer: {
    paddingHorizontal: 30,
    paddingVertical: 20,
    alignItems: 'left',
    justifyContent: 'left',
  },
  textOnlyCaption: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 18,
    color: '#53544D',
    textAlign: 'left',
    lineHeight: 27,
  },
  textPostPressable: {
    flex: 1,
  },
  scrollTopButtonContainer: {
    position: 'absolute',
    bottom: 40,
    right: 30,
    zIndex: 100,
    
  },
  scrollTopButton: {
    backgroundColor: '#8BA637',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    
  },
  scrollTopButtonIcon: {
    alignSelf: 'center',
    marginTop: 0,
    color: '#fff',
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 15,
    flexDirection: 'row',
    alignSelf: 'center',
  },
  paginationDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  addStoryButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    zIndex: 2,
  },
  addStoryCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8BA637',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
});