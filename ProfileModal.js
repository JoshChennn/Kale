import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Image, SafeAreaView, Text, ScrollView, Dimensions, Pressable, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { db, auth } from './firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { Alert, ActivityIndicator } from 'react-native';
import { functions } from './firebaseConfig';
import defaultProfilePhoto from './assets/default-profile-photo.png';

const screenWidth = Dimensions.get('window').width;
const gridMargin = 1;
const imgSize = (screenWidth - gridMargin * 2) / 3;

export default function ProfileModal({ navigation, route }) {
  const { userId } = route.params;

  const currentUserId = auth.currentUser?.uid;
  const isCurrentUser = userId === currentUserId;

  const [user, setUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [isFollowedBy, setIsFollowedBy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isCloseFriend, setIsCloseFriend] = useState(false);

  // For the animated popdown notification
  const [popdownMessage, setPopdownMessage] = useState('');
  const popdownAnim = useRef(new Animated.Value(-150)).current;

  // Cloud Functions
  const requestToFollowUser = httpsCallable(functions, 'requestToFollowUser');
  const withdrawFollowRequest = httpsCallable(functions, 'withdrawFollowRequest');
  const unfollowUser = httpsCallable(functions, 'unfollowUser');

  useEffect(() => {
    if (!userId) return;
    
    let unsubscribeUser = () => {};
    let unsubscribeFollowing = () => {};
    let unsubscribeRequest = () => {};
    let unsubscribeFollowedBy = () => {};
    let unsubscribeCloseFriend = () => {};


    const userRef = db.collection('users').doc(userId);
    unsubscribeUser = userRef.onSnapshot((docSnap) => {
      if (docSnap.exists) {
        setUser({ id: docSnap.id, ...docSnap.data() });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    if (!isCurrentUser && currentUserId) {
      const followingDocRef = db.collection('following').doc(currentUserId).collection('userFollowing').doc(userId);
      unsubscribeFollowing = followingDocRef.onSnapshot((docSnap) => setIsFollowing(docSnap.exists));

      const requestDocRef = db.collection('users').doc(userId).collection('followRequests').doc(currentUserId);
      unsubscribeRequest = requestDocRef.onSnapshot((docSnap) => setHasRequested(docSnap.exists));

      const followedByDocRef = db.collection('followers').doc(currentUserId).collection('userFollowers').doc(userId);
      unsubscribeFollowedBy = followedByDocRef.onSnapshot((docSnap) => setIsFollowedBy(docSnap.exists));
      
      unsubscribeCloseFriend = followingDocRef.onSnapshot((docSnap) => {
        if (docSnap.exists) {
          setIsCloseFriend(!!docSnap.data().isCloseFriend);
        } else {
          setIsCloseFriend(false);
        }
      });
    }

    return () => {
      unsubscribeUser();
      unsubscribeFollowing();
      unsubscribeRequest();
      unsubscribeFollowedBy();
      unsubscribeCloseFriend();
    };
  }, [userId, currentUserId, isCurrentUser]);

  useEffect(() => {
    if (!userId) return;
    const postsRef = db.collection('posts');
    const q = postsRef.where("userId", "==", userId).orderBy('createdAt', 'desc');
    const unsubscribe = q.onSnapshot((querySnapshot) => {
      setUserPosts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    // Listen for follower and following counts
    const followersRef = db.collection('followers').doc(userId).collection('userFollowers');
    const unsubscribeFollowersCount = followersRef.onSnapshot((snapshot) => {
      setFollowerCount(snapshot.size);
    });
    const followingRef = db.collection('following').doc(userId).collection('userFollowing');
    const unsubscribeFollowingCount = followingRef.onSnapshot((snapshot) => {
      setFollowingCount(snapshot.size);
    });
    return () => {
      unsubscribeFollowersCount();
      unsubscribeFollowingCount();
    };
  }, [userId]);

  const showPopdown = useCallback((message) => {
    setPopdownMessage(message);
    // Animate In
    Animated.spring(popdownAnim, {
      toValue: 20, // Position below the status bar, inside SafeAreaView
      useNativeDriver: true,
      tension: 100,
      friction: 12,
    }).start();

    // Set a timer to animate out
    setTimeout(() => {
      Animated.timing(popdownAnim, {
        toValue: -150, // Animate back off-screen
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 2500); // Popdown stays for 2.5 seconds
  }, [popdownAnim]);

  const handleRequestFollow = useCallback(async () => {
    if (isCurrentUser || isFollowing || hasRequested) return;
    setHasRequested(true);
    try {
      await requestToFollowUser({ userIdToFollow: userId });
    } catch (e) {
      console.error('Failed to send follow request:', e);
      setHasRequested(false);
      Alert.alert("Error", "Could not send follow request. Please try again.");
    }
  }, [isCurrentUser, userId, isFollowing, hasRequested]);

  const handleWithdrawRequest = useCallback(async () => {
    if (isCurrentUser || !hasRequested) return;
    setHasRequested(false);
    try {
      await withdrawFollowRequest({ userIdToWithdrawFrom: userId });
    } catch (e) {
      console.error('Failed to withdraw request:', e);
      setHasRequested(true);
      Alert.alert("Error", "Could not withdraw request. Please try again.");
    }
  }, [isCurrentUser, userId, hasRequested]);

  const handleUnfollow = useCallback(() => {
    if (isCurrentUser || !isFollowing) return;
    Alert.alert(
      `Unfollow @${user?.username || 'user'}?`,
      "You will need to request to follow them again to see their posts.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Unfollow", 
          style: "destructive", 
          onPress: async () => {
            setIsFollowing(false);
            try {
              await unfollowUser({ userIdToUnfollow: userId });
            } catch (e) {
              console.error('Failed to unfollow user:', e);
              setIsFollowing(true);
              Alert.alert("Error", "Could not unfollow user. Please try again.");
            }
          }
        }
      ]
    );
  }, [isCurrentUser, userId, isFollowing, user?.username]);

  const handleToggleCloseFriend = async () => {
    if (!currentUserId || !userId) return;
    const followingDocRef = db.collection('following').doc(currentUserId).collection('userFollowing').doc(userId);
    const newCloseFriendStatus = !isCloseFriend;
    
    // Show popdown with the appropriate message for the action
    showPopdown(newCloseFriendStatus ? 'Added to close friends' : 'Removed from close friends');

    try {
      // Optimistic UI update
      setIsCloseFriend(newCloseFriendStatus);
      await followingDocRef.set({ isCloseFriend: newCloseFriendStatus }, { merge: true });
    } catch (e) {
      // Revert on failure
      setIsCloseFriend(!newCloseFriendStatus);
      Alert.alert('Error', 'Could not update close friends. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#8BA637" />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>User not found</Text></View>
      </SafeAreaView>
    );
  }

  // Only show posts with a non-empty imageUri in the grid list
  const mappedPosts = userPosts
    .filter(p => p.imageUri && p.imageUri.trim() !== '')
    .map(p => ({
      ...p,
      user: { id: p.userId, name: p.userName, avatar: p.userAvatar },
      date: p.createdAt ? p.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'someday'
    }));

  const renderFollowButton = () => {
    if (isFollowing) {
      return (
        <>
          <Pressable style={styles.followingButton} onPress={handleUnfollow}>
            <Text style={styles.followingButtonText}>Following</Text>
          </Pressable>
          <Pressable style={styles.closeFriendToggleButton} onPress={handleToggleCloseFriend}>
            <MaterialIcons
              name={isCloseFriend ? 'star' : 'star-border'}
              size={36}
              color={isCloseFriend ? '#8BA637' : '#b9b9b9'}
            />
          </Pressable>
        </>
      );
    }
    if (hasRequested) {
      return <Pressable style={styles.requestedButton} onPress={handleWithdrawRequest}><Text style={styles.requestedButtonText}>Requested</Text></Pressable>;
    }
    if (isFollowedBy) {
      return <Pressable style={styles.addFriendButton} onPress={handleRequestFollow}><Text style={styles.addFriendText}>Follow Back</Text></Pressable>;
    }
    return <Pressable style={styles.addFriendButton} onPress={handleRequestFollow}><Text style={styles.addFriendText}>Follow</Text></Pressable>;
  };

  const formatCount = (count) => {
    if (count < 1000) return count.toString();
    if (count < 10000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k'; // 1k - 9.9k
    if (count < 1000000) return Math.floor(count / 1000) + 'k'; // 10k - 999k
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'; // 1M+
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <Animated.View style={[styles.popdownContainer, { transform: [{ translateY: popdownAnim }] }]}>
        <Text style={styles.popdownText}>{popdownMessage}</Text>
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#b9b9b9" />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileHeaderContainer}>
            <Image 
              source={user.photoURL ? { uri: user.photoURL } : defaultProfilePhoto} 
              style={styles.profileImage} 
            />
            <View style={styles.profileInfoContainer}>
              <View>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{user?.displayName || 'User'}</Text>
                  {user?.verified && (
                    <MaterialIcons name="verified" size={20} color="#8BA637" style={{ marginLeft: 4 }} />
                  )}
                </View>
                <Text style={styles.handle}>{user.username ? `@${user.username}` : `@${(user.displayName || '').toLowerCase().replace(/\s/g, '')}`}</Text>
              </View>
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{formatCount(followingCount)}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{formatCount(followerCount)}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.bio}>{user.bio}</Text>

          <View style={styles.buttonWrapper}>
            {isCurrentUser ? (
              <Pressable style={styles.editProfileButton} onPress={() => navigation.navigate('EditProfile')}>
                <Text style={styles.editProfileText}>Edit profile</Text>
              </Pressable>
            ) : (
                renderFollowButton()
            )}
          </View>

          {isCurrentUser || isFollowing ? (
            <View style={styles.gridList}>
              {mappedPosts.map((item, index) => (
                <Pressable
                  key={item.id}
                  style={styles.postCard}
                  onPress={() => navigation.navigate('UserPostsFeed', { userId: userId, initialPost: item })}
                >
                  <Image
                    source={{ uri: item.imageUri }}
                    style={[
                      styles.gridImg,
                      ((index + 1) % 3 === 0) && { marginRight: 0 }
                    ]}
                  />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.lockContainer}>
              <MaterialIcons name="lock" size={72} color="#b9b9b9" />
              <Text style={styles.lockText}>This account is private.</Text>
              <Text style={styles.lockSubText}>Follow them to see their posts.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    zIndex: 1,
  },
  backButtonText: {
    fontSize: 18,
    fontFamily: 'PatrickHand-Regular',
    color: '#b9b9b9',
  },
  profileHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 35,
    marginBottom: 12,
    marginTop: 20,
  },
  profileInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 15,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 0.5,
    borderColor: '#b9b9b9',
    backgroundColor: '#FFFFFF',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 20,
    fontFamily: 'PatrickHand-Regular',
    color: '#53544D',
  },
  handle: {
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    color: '#b9b9b9',
  },
  statsContainer: {
    flexDirection: 'row',
  },
  statItem: {
    alignItems: 'center',
    marginLeft: 15,
  },
  statNumber: {
    fontSize: 20,
    color: '#53544D',
    fontFamily: 'PatrickHand-Regular',
  },
  statLabel: {
    fontSize: 16,
    color: '#b9b9b9',
    fontFamily: 'PatrickHand-Regular',
    marginTop: -4,
  },
  bio: {
    marginTop: 16,
    marginLeft: 35,
    marginRight: 35,
    color: '#53544D',
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  gridList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 40,
    marginHorizontal: 0,
  },
  gridImg: {
    width: imgSize,
    height: imgSize,
    borderRadius: 0,
    marginBottom: gridMargin,
    marginRight: gridMargin,
    backgroundColor: '#FFFFFF',
  },
  postCard: {},
  editProfileButton: {
    backgroundColor: '#e6e6e6',
    borderRadius: 5,
    flex: 1,
    height: 33,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editProfileText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#53544D',
  },
  lockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingTop: 150,
  },
  lockText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 20,
    color: '#b9b9b9',
    marginTop: 16,
  },
  lockSubText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#b9b9b9',
    marginTop: 4,
  },
  addFriendButton: {
    backgroundColor: '#8BA637',
    borderRadius: 5,
    flex: 1,
    height: 33,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFriendText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#FFFFFF',
  },
  followingButton: {
    backgroundColor: '#e6e6e6',
    borderRadius: 5,
    flex: 1,
    height: 33,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followingButtonText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#53544D',
  },
  requestedButton: {
    backgroundColor: '#e6e6e6',
    borderRadius: 5,
    flex: 1,
    height: 33,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestedButtonText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#53544D',
  },
  buttonWrapper: {
    marginTop: 18,
    marginHorizontal: 35,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeFriendToggleButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  popdownContainer: {
    position: 'absolute',
    top: 30,
    left: 35,
    right: 35,
    backgroundColor: '#8BA637',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  popdownText: {
    color: 'white',
    fontFamily: 'PatrickHand-Regular',
    fontSize: 18,
  },
});