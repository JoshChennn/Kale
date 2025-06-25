import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Image, SafeAreaView, Text, ScrollView, Dimensions, Pressable, Alert, ActivityIndicator, LayoutAnimation, UIManager, Platform, ActionSheetIOS } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { db, auth } from './firebaseConfig';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseConfig';
import defaultProfilePhoto from './assets/default-profile-photo.png';
import UserListModal from './UserListModal';
import { Ionicons } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const screenWidth = Dimensions.get('window').width;
const gridMargin = 1;
const imgSize = (screenWidth - gridMargin * 2) / 3;

export default function ProfileScreen({ navigation, route }) {
  const userId = route.params?.userId; 
  
  const currentUserId = auth.currentUser?.uid;
  const isCurrentUser = userId === currentUserId;

  const [user, setUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalUserIds, setModalUserIds] = useState([]);

  // Cloud Functions
  const requestToFollowUser = httpsCallable(functions, 'requestToFollowUser');
  const withdrawFollowRequest = httpsCallable(functions, 'withdrawFollowRequest');
  const unfollowUser = httpsCallable(functions, 'unfollowUser');

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let unsubscribeUser = () => {};
    let unsubscribeFollowing = () => {};
    let unsubscribeRequest = () => {};
    let unsubscribeFollowers = () => {};
    let unsubscribeFollowingCount = () => {};

    const userRef = doc(db, 'users', userId);
    unsubscribeUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUser({ id: docSnap.id, ...docSnap.data() });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

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

    // Listen for follower and following counts
    const followersRef = collection(db, 'followers', userId, 'userFollowers');
    unsubscribeFollowers = onSnapshot(followersRef, (snapshot) => {
      setFollowerCount(snapshot.size);
      if (isCurrentUser) {
        setFollowers(snapshot.docs.map(doc => doc.id));
      }
    });

    const followingRef = collection(db, 'following', userId, 'userFollowing');
    unsubscribeFollowingCount = onSnapshot(followingRef, (snapshot) => {
      setFollowingCount(snapshot.size);
      if (isCurrentUser) {
        setFollowing(snapshot.docs.map(doc => doc.id));
      }
    });
    
    return () => {
      unsubscribeUser();
      unsubscribeFollowing();
      unsubscribeRequest();
      unsubscribeFollowers();
      unsubscribeFollowingCount();
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const formatCount = (count) => {
    if (count < 1000) return count.toString();
    if (count < 10000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k'; // 1k - 9.9k
    if (count < 1000000) return Math.floor(count / 1000) + 'k'; // 10k - 999k
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'; // 1M+
  };

  // --- 3-dots menu handlers ---
  const handleShowMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Log out', 'Delete account', 'Cancel'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) {
            handleLogout();
          } else if (buttonIndex === 1) {
            handleDeleteAccount();
          }
        }
      );
    } else {
      Alert.alert(
        'Account',
        '',
        [
          { text: 'Log out', onPress: handleLogout },
          { text: 'Delete account', style: 'destructive', onPress: handleDeleteAccount },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (e) {
      Alert.alert('Error', 'Could not log out. Please try again.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await auth.currentUser.delete();
            } catch (e) {
              Alert.alert('Error', 'Could not delete account. You may need to log in again.');
            }
          },
        },
      ]
    );
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

  // Only show posts with image content in the grid list
  const mappedPosts = userPosts
    .filter(p => (p.imageUri && p.imageUri.trim() !== '') || (p.imageUris && p.imageUris.length > 0))
    .map(p => {
      const images = p.imageUris || (p.imageUri ? [p.imageUri] : []);
      return {
        ...p,
        // Pass the full image list to the feed screen
        imageUris: images, 
        imageUri: images[0] || '', // Ensure legacy imageUri is the first one
        // Properties for grid display
        displayImageUri: images[0],
        hasMultipleImages: images.length > 1,
      };
    });
  
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.goBack();
        }} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={28} color="#53544D" />
        </Pressable>
        <View style={styles.headerCenterWrapper}>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {user?.username ? `@${user.username}` : 'Profile'}
            </Text>
            {user?.verified && (
              <MaterialIcons name="verified" size={20} color="#8BA637" style={{ marginLeft: 4 }} />
            )}
          </View>
        </View>
        {isCurrentUser && (
          <Pressable onPress={handleShowMenu} style={styles.headerMenuButton} hitSlop={10}>
            <Ionicons name="ellipsis-horizontal" size={18} color="#53544D" />
          </Pressable>
        )}
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeaderContainer}>
          <Image
            source={user?.photoURL ? { uri: user.photoURL } : defaultProfilePhoto}
            style={styles.profileImage}
          />
          <View style={styles.profileInfoContainer}>
            <View style={{ flex: 1 }}>
              {showStats ? (
                <View style={styles.statsContainer}>
                  <Pressable
                    style={styles.statItem}
                    onPress={() => {
                      if (!isCurrentUser || followingCount === 0) return;
                      setModalTitle('Following');
                      setModalUserIds(following);
                      setIsModalVisible(true);
                    }}
                    disabled={!isCurrentUser || followingCount === 0}
                  >
                    <Text style={styles.statNumber}>{formatCount(followingCount)}</Text>
                    <Text style={styles.statLabel}>Following</Text>
                  </Pressable>
                  <Pressable
                    style={styles.statItem}
                    onPress={() => {
                      if (!isCurrentUser || followerCount === 0) return;
                      setModalTitle('Followers');
                      setModalUserIds(followers);
                      setIsModalVisible(true);
                    }}
                    disabled={!isCurrentUser || followerCount === 0}
                  >
                    <Text style={styles.statNumber}>{formatCount(followerCount)}</Text>
                    <Text style={styles.statLabel}>Followers</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{user?.displayName || 'User'}</Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={() => {
                LayoutAnimation.easeInEaseOut();
                setShowStats(!showStats);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={styles.toggleButton}
            >
              <MaterialIcons name={showStats ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={32} color="#53544D" />
            </Pressable>
          </View>
        </View>

        {user.bio && (
          <Text style={styles.bio}>
            {user.bio}
          </Text>
        )}

        <View style={styles.buttonWrapper}>
          {isCurrentUser ? (
            <>
              <Pressable style={styles.editProfileButton} onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('EditProfile');
              }}>
                <Text style={styles.editProfileText}>Edit profile</Text>
              </Pressable>
              <Pressable
                style={styles.addFriendsProfileButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate('AddMoreFriends');
                }}
              >
                <Text style={styles.addFriendsProfileButtonText}>Add friends</Text>
              </Pressable>
            </>
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
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate('UserPostsFeed', { userId: userId, initialPost: item });
                }}
              >
                <Image
                  source={{ uri: item.displayImageUri }}
                  style={[
                    styles.gridImg,
                    ((index + 1) % 3 === 0) && { marginRight: 0 }
                  ]}
                />
                {item.hasMultipleImages && (
                  <MaterialIcons name="collections" size={16} color="white" style={styles.multiImageIcon} />
                )}
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
      <UserListModal 
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        title={modalTitle}
        userIds={modalUserIds}
        navigation={navigation}
        currentUserId={currentUserId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 2,
    padding: 4,
  },
  headerCenterWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    color: '#53544D',
    fontFamily: 'PatrickHand-Regular',
  },
  headerRightPlaceholder: {
    width: 36,
    height: 36,
  },
  container: {
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    flexGrow: 1,
  },
  profileHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 35,
    marginBottom: 12,
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
    fontSize: 24,
    fontFamily: 'PatrickHand-Regular',
    color: '#53544D',
    marginLeft: 5,
  },
  handle: {
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    color: '#b9b9b9',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  toggleButton: {
    paddingLeft: 10,
  },
  bio: {
    marginTop: 15,
    marginBottom: 20,
    marginLeft: 35,
    marginRight: 35,
    color: '#53544D',
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  buttonWrapper: {
    marginTop: 18,
    marginHorizontal: 35,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  gridList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 40,
    marginHorizontal: 0,
  },
  postCard: {
    position: 'relative', // Needed to position the icon
  },
  gridImg: {
    width: imgSize,
    height: imgSize,
    borderRadius: 0,
    marginBottom: gridMargin,
    marginRight: gridMargin,
    backgroundColor: '#FFFFFF',
  },
  multiImageIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
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
  addFriendsProfileButton: {
    backgroundColor: '#8BA637',
    borderRadius: 5,
    flex: 1,
    height: 33,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFriendsProfileButtonText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#FFFFFF',
  },
  headerMenuButton: {
    position: 'absolute',
    right: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    padding: 4,
  },
});