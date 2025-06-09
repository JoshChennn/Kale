import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Image, SafeAreaView, Text, ScrollView, Dimensions, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { db, auth } from './firebaseConfig';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Alert, ActivityIndicator } from 'react-native';
import { functions } from './firebaseConfig';

const screenWidth = Dimensions.get('window').width;
const gridMargin = 6;
const imgSize = (screenWidth - gridMargin * 4) / 3;

export default function ProfileModal({ navigation, route }) {
  const { userId } = route.params;

  const currentUserId = auth.currentUser?.uid;
  const isCurrentUser = userId === currentUserId;

  const [user, setUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const toggleFollowUser = httpsCallable(functions, 'toggleFollowUser');

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

    // Check if the current user is following this profile
    let unsubscribeFollowing = () => {};
    if (!isCurrentUser && currentUserId) {
      // FIX: Updated path to check for following status based on AddFriendsScreen logic
      const followingDocRef = doc(db, 'following', currentUserId, 'userFollowing', userId);
      unsubscribeFollowing = onSnapshot(followingDocRef, (docSnap) => {
        setIsFollowing(docSnap.exists());
      });
    }

    return () => {
      unsubscribeUser();
      unsubscribeFollowing();
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


  const handleToggleFollowing = useCallback(async () => {
    if (isCurrentUser) return;
  
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
  
    try {
      await toggleFollowUser({ userIdToFollow: userId });
    } catch (e) {
      console.error('Failed to follow/unfollow user:', e);
      setIsFollowing(wasFollowing);
      Alert.alert("Error", e.message || "Could not perform action. Please try again.");
    }
  }, [isCurrentUser, userId, isFollowing, toggleFollowUser]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F2' }}>
        <ActivityIndicator size="large" color="#8BA637" />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>User not found</Text></View>
      </SafeAreaView>
    );
  }

  const mappedPosts = userPosts.map(p => ({
    ...p,
    user: { id: p.userId, name: p.userName, avatar: p.userAvatar },
    date: p.createdAt ? p.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'someday'
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
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
            {/* FIX: Use photoURL instead of avatar */}
            <Image source={{ uri: user.photoURL }} style={styles.profileImage} />
            <View style={styles.row}>
              {/* FIX: Use displayName instead of name */}
              <Text style={styles.name}>{user.displayName}</Text>
              <MaterialIcons name="verified" size={20} color="#8BA637" style={{ marginLeft: 4 }} />
            </View>
            {/* FIX: Use username instead of handle, and update fallback */}
            <Text style={styles.handle}>{user.username ? `@${user.username}` : `@${(user.displayName || '').toLowerCase().replace(/\s/g, '')}`}</Text>
            <Text style={styles.bio}>{user.bio}</Text>
          </View>

          <View style={styles.buttonWrapper}>
            {isCurrentUser ? (
              <Pressable style={styles.editProfileButton} onPress={() => { /* Handle Edit Profile */ }}>
                <Text style={styles.editProfileText}>Edit profile</Text>
              </Pressable>
            ) : (
                <Pressable
                  style={isFollowing ? styles.removeFriendButton : styles.addFriendButton}
                  onPress={handleToggleFollowing}
                >
                  <Text style={isFollowing ? styles.removeFriendText : styles.addFriendText}>
                    {isFollowing ? "Unfollow" : "Follow"}
                  </Text>
                </Pressable>
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
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// Styles remain the same...
const styles = StyleSheet.create({
  navBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 83,
    flexDirection: 'row',
    backgroundColor: '#F2F2F2',
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
    backgroundColor: '#e6e6e6', // Add a background color for when the image is loading or missing
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
    marginHorizontal: gridMargin,
  },
  gridImg: {
    width: imgSize,
    height: imgSize,
    borderRadius: 5,
    marginBottom: gridMargin,
    marginRight: gridMargin,
    backgroundColor: '#ccc',
  },
  postCard: {},
  editProfileButton: {
    backgroundColor: '#e6e6e6',
    borderRadius: 5,
    width: 150,
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
    backgroundColor: '#F2F2F2',
    paddingTop: 150,
  },
  lockText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 20,
    color: '#b9b9b9',
    marginTop: 16,
    marginBottom: 24,
  },
  addFriendButton: {
    backgroundColor: '#8BA637',
    borderRadius: 5,
    width: 113,
    height: 33,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addFriendText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: 'white',
  },
  removeFriendButton: {
    backgroundColor: '#e6e6e6',
    borderRadius: 5,
    width: 113,
    height: 33,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  removeFriendText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#53544D',
  },
  addBestieButton: {
    backgroundColor: '#8BA637',
    borderRadius: 5,
    width: 150,
    height: 33,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBestieText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: 'white',
  },
  removeBestieButton: {
    backgroundColor: '#e6e6e6',
    borderRadius: 5,
    width: 150,
    height: 33,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBestieText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#53544D',
  },
  buttonWrapper: {
    marginTop: 18,
    marginLeft: 35,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    zIndex: 1,
  },
  backButtonText: {
    marginLeft: 8,
    fontSize: 18,
    fontFamily: 'PatrickHand-Regular',
    color: '#b9b9b9',
  },
});