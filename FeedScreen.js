import React, { useState, useEffect, useRef } from 'react';
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
} from 'firebase/firestore';
import defaultProfilePhoto from './assets/default-profile-photo.png';
import * as Haptics from 'expo-haptics'; // --- HAPTICS: Import the library

const { width: screenWidth } = Dimensions.get('window');
const storySize = 70;

export default function FeedScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [followRequests, setFollowRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postsCleared, setPostsCleared] = useState(false);
  const [footerPosition, setFooterPosition] = useState(-250);
  const currentUser = auth.currentUser;

  // Ref for the SectionList to enable programmatic scrolling
  const listRef = useRef(null);
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const clearAnimation = useRef(new Animated.Value(0)).current; // For posts/footer exit
  const clearedOpacity = useRef(new Animated.Value(0)).current;  // For "cleared" text entrance
  const outlineOpacityAnim = useRef(new Animated.Value(0)).current; // For outline fade-in
  const holdTimeout = useRef(null);
  const hapticInterval = useRef(null); // Add reference for haptic interval

  const handleFollowRequest = httpsCallable(functions, 'handleFollowRequest');


  // --- DATA FETCHING ---
  useEffect(() => {
    if (!currentUser) return;

    const userFollowingRef = collection(db, 'following', currentUser.uid, 'userFollowing');
    const unsubscribeFollowing = onSnapshot(userFollowingRef, (followingSnap) => {
      const following = followingSnap.docs.map(doc => doc.id);
      const usersToQuery = [...new Set([currentUser.uid, ...following])];

      if (usersToQuery.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }
      
      const limitedUsersToQuery = usersToQuery.slice(0, 30);

      const postsQuery = query(
        collection(db, 'posts'),
        where('userId', 'in', limitedUsersToQuery),
        orderBy('createdAt', 'desc'),
        limit(25)
      );

      const unsubscribePosts = onSnapshot(postsQuery, (querySnapshot) => {
        const fetchedPosts = querySnapshot.docs.map(doc => {
          const postData = doc.data();
          return {
            id: doc.id,
            ...postData,
            user: { id: postData.userId, name: postData.userName, avatar: postData.userAvatar },
            date: postData.createdAt?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || 'someday',
          };
        });

        if (fetchedPosts.length > 0) {
          setPostsCleared(false); // Reset if new posts are loaded
          // Also reset animations if posts come in
          clearAnimation.setValue(0);
          clearedOpacity.setValue(0);
        }
        
        setPosts(fetchedPosts);
        setLoading(false);
      });

      const fetchStories = async () => {
        const storyUsersQuery = query(collection(db, 'users'), where('__name__', 'in', limitedUsersToQuery));
        const storyUsersSnapshot = await getDocs(storyUsersQuery);
        const userMap = new Map(storyUsersSnapshot.docs.map(d => [d.id, d.data()]));

        const storyPromises = limitedUsersToQuery.map(uid => getDocs(query(collection(db, 'users', uid, 'stories'), limit(5))));
        const storySnapshots = await Promise.all(storyPromises);

        const storyEntries = storySnapshots.map((snapshot, index) => {
          if (!snapshot.empty) {
            const userId = limitedUsersToQuery[index];
            const user = userMap.get(userId);
            if (user) {
              return {
                id: userId,
                name: user.displayName, 
                avatar: user.photoURL, 
                uriList: snapshot.docs.map(d => ({id: d.id, ...d.data()}))
              };
            }
          }
          return null;
        }).filter(Boolean);
        setStories(storyEntries);
      }
      fetchStories();
      
      return () => unsubscribePosts();
    });

    return () => unsubscribeFollowing();
  }, [currentUser]);
  
  useEffect(() => {
    if (!currentUser) return;

    const requestsQuery = query(collection(db, 'users', currentUser.uid, 'followRequests'));
    const unsubscribeRequests = onSnapshot(requestsQuery, (querySnapshot) => {
      const newRequests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFollowRequests(newRequests);
    });

    return () => unsubscribeRequests();
  }, [currentUser]);

  // --- ANIMATION EFFECT ---
  useEffect(() => {
    if (postsCleared) {
      Animated.timing(clearedOpacity, {
        toValue: 1,
        duration: 600,
        delay: 100, // Small delay for a cleaner transition
        useNativeDriver: true,
      }).start();
    } else {
      clearedOpacity.setValue(0);
    }
  }, [postsCleared]);

  // --- HANDLERS ---
  const onAcceptRequest = async (requesterId) => {
    setFollowRequests(prev => prev.filter(req => req.id !== requesterId));
    try {
      await handleFollowRequest({ requestingUserId: requesterId, action: 'accept' });
    } catch (error) {
      console.error("Error accepting request:", error);
      Alert.alert("Error", "Could not accept request. Please try again.");
    }
  };

  const onIgnoreRequest = async (requesterId) => {
    setFollowRequests(prev => prev.filter(req => req.id !== requesterId));
    try {
      await handleFollowRequest({ requestingUserId: requesterId, action: 'ignore' });
    } catch (error) {
      console.error("Error ignoring request:", error);
      Alert.alert("Error", "Could not ignore request. Please try again.");
    }
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
    
    // Check if the ref is attached and there are posts
    if (listRef.current && posts.length > 0) {
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
            setPostsCleared(true);
            scaleAnim.setValue(1); // Reset button scale
            outlineOpacityAnim.setValue(0); // Reset outline opacity
          }
        });
      }, 400); // This delay should be enough for the scroll animation.
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
    
    // If posts are cleared, set height to -150
    if (postsCleared) {
      setFooterPosition(-150);
    } else if (distanceFromBottom > 320) {
      // If the footer is below the screen, set height to 0
      setFooterPosition(-250);
    } else {
      // Otherwise, calculate inverse height
      setFooterPosition(Math.max(-250, -distanceFromBottom));
    }
  };

  if (loading) {
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
  const renderPost = ({ item: post }) => (
    <Animated.View style={{
      opacity: postAndFooterOpacity,
      transform: [{ translateY: postTranslateY }]
    }}>
      <View style={styles.postCard}>
        <Pressable
          style={styles.postHeader}
          onPress={() => {
            if (post.user.id === currentUser.uid) {
              navigation.navigate('Profile', { userId: currentUser.uid });
            } else {
              navigation.navigate('ProfileModal', { userId: post.user.id });
            }
          }}
        >
          <Image source={{ uri: post.user.avatar }} style={styles.avatar} />
          <View style={styles.postHeaderTextRow}>
            <Text style={styles.postUsername}>{post.user.name}</Text>
            <Text style={styles.postDate}>{post.date}</Text>
          </View>
        </Pressable>
        <Image source={{ uri: post.imageUri }} style={styles.postImage} />
        <Pressable
          style={styles.commentsBtn}
          onPress={() => navigation.navigate('PostDetail', { post })}
        >
          <Text style={styles.commentsText}>View comments ({post.commentsCount || 0})</Text>
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderRequest = ({ item: request }) => (
    <View style={styles.requestCard}>
      <Pressable 
        style={styles.requestUserInfo} 
        onPress={() => navigation.navigate('ProfileModal', { userId: request.id })}
      >
        <Image 
          source={request.requesterAvatar ? { uri: request.requesterAvatar } : defaultProfilePhoto}
          style={styles.requestAvatar} 
        />
        <View style={styles.requestNameContainer}>
          <Text style={styles.requestName} numberOfLines={1}>{request.requesterName || 'A user'}</Text>
          {request.requesterUsername && <Text style={styles.requestUsername} numberOfLines={1}>@{request.requesterUsername}</Text>}
        </View>
      </Pressable>

      <View style={styles.requestActions}>
        <Pressable style={styles.acceptButton} onPress={() => onAcceptRequest(request.id)}>
          <Text style={styles.acceptButtonText}>Accept</Text>
        </Pressable>
        <Pressable style={styles.ignoreButton} onPress={() => onIgnoreRequest(request.id)}>
          <Text style={styles.ignoreButtonText}>Ignore</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderStories = ({ item }) => (
    <View style={styles.storiesContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {item.storyData.map(storyBlock => (
          <Pressable key={storyBlock.id} style={styles.storyItem} onPress={() => navigation.navigate('StoryViewer', { stories: storyBlock.uriList, initialIndex: 0 })}>
            <Image source={{ uri: storyBlock.avatar }} style={styles.storyImage} />
            <Text style={styles.storyName} numberOfLines={1}>{storyBlock.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const renderItem = ({ item, section }) => {
    switch (section.type) {
      case 'requests': return renderRequest({ item });
      case 'stories': return renderStories({ item });
      case 'posts': return renderPost({ item });
      default: return null;
    }
  };

  const renderSectionHeader = ({ section: { title, type } }) => {
    if (type === 'stories' || (type === 'posts' && posts.length === 0)) return null;
    return <Text style={styles.sectionHeader}>{title}</Text>;
  };
  
  const sections = [];
  if (followRequests.length > 0) {
    sections.push({ title: 'Follow Requests', data: followRequests, type: 'requests' });
  }
  if (stories.length > 0) {
    sections.push({ title: 'Stories', data: [{ id: 'story-bar', storyData: stories }], type: 'stories' });
  }
  if (posts.length > 0) {
    sections.push({ title: 'New Posts', data: posts, type: 'posts' });
  }

  const ListFooterComponent = () => {
    if (posts.length === 0) {
      if (postsCleared) {
        const getTimeBasedMessage = () => {
          const hour = new Date().getHours();
          if (hour >= 5 && hour < 9) return "Go drink some water. 💧";
          if (hour >= 9 && hour < 15) return "Get some work done. 💼";
          if (hour >= 15 && hour < 19) return "Get some fresh air. 🌳";
          if (hour >= 19 && hour < 23) return "Go read a book. 📚";
          return "Get some sleep. 😴";
        };

        return (
          <Animated.View style={[styles.clearedContainer, { opacity: clearedOpacity }]}>
            <Text style={styles.clearedText}>That's it for today.</Text>
            <Text style={styles.clearedSubText}>{getTimeBasedMessage()}</Text>
          </Animated.View>
        );
      }
      return null;
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
          <Text style={styles.footerSubtitle}>Hold to clear posts</Text>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f2' }}>
      <View
        style={{
          position: 'absolute',
          left: 0, right: 0, bottom: 0,
          height: footerPosition > -250 ? footerPosition + 150 : 0,
          backgroundColor: '#8BA637',
        }}
      />
      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={<Text style={styles.header}>KALE</Text>}
        ListFooterComponent={ListFooterComponent}
        ListEmptyComponent={() => null}
        contentContainerStyle={styles.listContentContainer}
        stickySectionHeadersEnabled={true}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F2' },
  listContentContainer: {
    paddingBottom: 100,
  },
  header: {
    fontSize: 40,
    textAlign: 'center',
    marginVertical: 30,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
  },
  sectionHeader: {
    fontSize: 20,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
    backgroundColor: '#F2F2F2',
    paddingTop: 20,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9E9E9',
    paddingHorizontal: 20,
    backgroundColor: '#F2F2F2',
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
  },
  requestNameContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  requestName: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 20,
    color: '#333',
    marginTop: -6,
  },
  requestUsername: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#888',
    marginTop: -3,
  },
  requestActions: {
    flexDirection: 'row',
  },
  acceptButton: {
    backgroundColor: '#8BA637',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 5,
    marginRight: 8,
  },
  acceptButtonText: {
    color: '#f2f2f2',
    fontFamily: 'PatrickHand-Regular',
    fontSize: 14,
  },
  ignoreButton: {
    backgroundColor: '#e6e6e6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 5,
  },
  ignoreButtonText: {
    color: '#53544D',
    fontFamily: 'PatrickHand-Regular',
    fontSize: 14,
  },
  storiesContainer: {
    paddingVertical: 10,
    marginBottom: 10,
  },
  storyItem: {
    width: storySize + 10,
    alignItems: 'center',
    marginLeft: 15,
  },
  storyImage: {
    width: storySize,
    height: storySize,
    borderRadius: storySize / 2,
    borderWidth: 4,
    borderColor: '#8BA637',
  },
  storyName: {
    fontFamily: 'PatrickHand-Regular',
    marginTop: 6,
    fontSize: 16,
    color: '#8BA637',
    textAlign: 'center',
  },
  postCard: {
    marginBottom: 20,
    overflow: 'hidden',
    width: screenWidth,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingHorizontal: 15,
  },
  postHeaderTextRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
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
  postImage: {
    width: '100%',
    aspectRatio: 1,
    resizeMode: 'cover',
  },
  commentsBtn: {
    paddingLeft: 20,
    paddingVertical: 15,
  },
  commentsText: {
    fontSize: 16,
    color: '#b9b9b9',
    fontFamily: 'PatrickHand-Regular',
  },
  footerContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E9E9E9',
    marginTop: 20,
    backgroundColor: '#8BA637',
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
    borderColor: '#CADE81',
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
});