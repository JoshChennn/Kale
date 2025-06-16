import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Image, SafeAreaView, Text, ScrollView, Dimensions, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { db, auth } from './firebaseConfig';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Alert, ActivityIndicator } from 'react-native';
import { functions } from './firebaseConfig';

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
  const [hasRequested, setHasRequested] = useState(false); // New state for follow requests
  const [loading, setLoading] = useState(true);

  // Cloud Functions
  const requestToFollowUser = httpsCallable(functions, 'requestToFollowUser');
  const withdrawFollowRequest = httpsCallable(functions, 'withdrawFollowRequest');
  const unfollowUser = httpsCallable(functions, 'unfollowUser');

  useEffect(() => {
    if (!userId) return;
    const userRef = doc(db, 'users', userId);
    const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUser({ id: docSnap.id, ...docSnap.data() });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    let unsubscribeFollowing = () => {};
    let unsubscribeRequest = () => {};
    if (!isCurrentUser && currentUserId) {
      // Check if current user is following this profile
      const followingDocRef = doc(db, 'following', currentUserId, 'userFollowing', userId);
      unsubscribeFollowing = onSnapshot(followingDocRef, (docSnap) => {
        setIsFollowing(docSnap.exists());
      });

      // Check if current user has a pending request to this profile
      const requestDocRef = doc(db, 'users', userId, 'followRequests', currentUserId);
      unsubscribeRequest = onSnapshot(requestDocRef, (docSnap) => {
        setHasRequested(docSnap.exists());
      });
    }

    return () => {
      unsubscribeUser();
      unsubscribeFollowing();
      unsubscribeRequest();
    };
  }, [userId, currentUserId, isCurrentUser]);

  useEffect(() => {
    if (!userId) return;
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, where("userId", "==", userId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setUserPosts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [userId]);

  const handleRequestFollow = useCallback(async () => {
    if (isCurrentUser || isFollowing || hasRequested) return;
    setHasRequested(true); // Optimistic update
    try {
      await requestToFollowUser({ userIdToFollow: userId });
    } catch (e) {
      console.error('Failed to send follow request:', e);
      setHasRequested(false); // Revert on error
      Alert.alert("Error", "Could not send follow request. Please try again.");
    }
  }, [isCurrentUser, userId, isFollowing, hasRequested]);

  const handleWithdrawRequest = useCallback(async () => {
    if (isCurrentUser || !hasRequested) return;
    setHasRequested(false); // Optimistic update
    try {
      await withdrawFollowRequest({ userIdToWithdrawFrom: userId });
    } catch (e) {
      console.error('Failed to withdraw request:', e);
      setHasRequested(true); // Revert on error
      Alert.alert("Error", "Could not withdraw request. Please try again.");
    }
  }, [isCurrentUser, userId, hasRequested]);

  const handleUnfollow = useCallback(() => {
    if (isCurrentUser || !isFollowing) return;
    Alert.alert(
      `Unfollow @${user?.username || 'user'}?`,
      "You will need to request to follow them again to see their posts.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Unfollow", 
          style: "destructive", 
          onPress: async () => {
            setIsFollowing(false); // Optimistic update
            try {
              await unfollowUser({ userIdToUnfollow: userId });
            } catch (e) {
              console.error('Failed to unfollow user:', e);
              setIsFollowing(true); // Revert on error
              Alert.alert("Error", "Could not unfollow user. Please try again.");
            }
          }
        }
      ]
    );
  }, [isCurrentUser, userId, isFollowing, user?.username]);

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

  const mappedPosts = userPosts.map(p => ({
    ...p,
    user: { id: p.userId, name: p.userName, avatar: p.userAvatar },
    date: p.createdAt ? p.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'someday'
  }));

  const renderFollowButton = () => {
    if (isFollowing) {
      return (
        <Pressable style={styles.followingButton} onPress={handleUnfollow}>
          <Text style={styles.followingButtonText}>Following</Text>
        </Pressable>
      );
    }
    if (hasRequested) {
      return (
        <Pressable style={styles.requestedButton} onPress={handleWithdrawRequest}>
          <Text style={styles.requestedButtonText}>Requested</Text>
        </Pressable>
      );
    }
    return (
      <Pressable style={styles.addFriendButton} onPress={handleRequestFollow}>
        <Text style={styles.addFriendText}>Follow</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ flex: 1 }}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#b9b9b9" />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileHeader}>
            <Image 
              source={user.photoURL ? { uri: user.photoURL } : require('./assets/default-profile-photo.png')} 
              style={styles.profileImage} 
            />
            <View style={styles.row}>
              <Text style={styles.name}>{user.displayName}</Text>
              {user.verified && (
                <MaterialIcons name="verified" size={20} color="#8BA637" style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text style={styles.handle}>{user.username ? `@${user.username}` : `@${(user.displayName || '').toLowerCase().replace(/\s/g, '')}`}</Text>
            <Text style={styles.bio}>{user.bio}</Text>
          </View>

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
                  onPress={() => navigation.navigate('PostDetail', { post: item })}
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
  navBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 83,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 99,
  },
  profileHeader: {
    paddingTop: 40,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 0.5,
    borderColor: '#b9b9b9',  
    marginLeft: 35,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 128,
    marginTop: -80,
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
    marginLeft: 128,
    marginTop: 0,
  },
  bio: {
    marginTop: 28,
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    zIndex: 1,
  },
  backButtonText: {
    fontSize: 18,
    fontFamily: 'PatrickHand-Regular',
    color: '#b9b9b9',
  },
});