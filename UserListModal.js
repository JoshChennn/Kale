import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, FlatList, Pressable, Image, ActivityIndicator, SafeAreaView, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { db, functions } from './firebaseConfig';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import defaultProfilePhoto from './assets/default-profile-photo.png';

const requestToFollowUser = httpsCallable(functions, 'requestToFollowUser');
const withdrawFollowRequest = httpsCallable(functions, 'withdrawFollowRequest');
const unfollowUser = httpsCallable(functions, 'unfollowUser');

export default function UserListModal({ isVisible, onClose, title, userIds, navigation, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [followingUids, setFollowingUids] = useState(new Set());
  const [followerUids, setFollowerUids] = useState(new Set());
  const [requestedUids, setRequestedUids] = useState(new Set());

  useEffect(() => {
    if (!currentUserId) return;

    const followingRef = collection(db, 'following', currentUserId, 'userFollowing');
    const followingUnsubscribe = onSnapshot(followingRef, (snapshot) => {
      const uids = snapshot.docs.map(doc => doc.id);
      setFollowingUids(new Set(uids));
    });

    const followersRef = collection(db, 'followers', currentUserId, 'userFollowers');
    const followersUnsubscribe = onSnapshot(followersRef, (snapshot) => {
        const uids = snapshot.docs.map(doc => doc.id);
        setFollowerUids(new Set(uids));
    });

    return () => {
      followingUnsubscribe();
      followersUnsubscribe();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (userIds.length > 0) {
      setLoading(true);
      const fetchUsersAndRequests = async () => {
        try {
          const userPromises = [];
          for (let i = 0; i < userIds.length; i += 30) {
            const chunk = userIds.slice(i, i + 30);
            if (chunk.length === 0) continue;
            const q = query(collection(db, 'users'), where('__name__', 'in', chunk));
            userPromises.push(getDocs(q));
          }
          
          const querySnapshots = await Promise.all(userPromises);
          const fetchedUsers = [];
          querySnapshots.forEach(snapshot => {
            snapshot.forEach(doc => {
              fetchedUsers.push({ id: doc.id, ...doc.data() });
            });
          });

          setUsers(fetchedUsers);

          if (fetchedUsers.length > 0 && currentUserId) {
              const requestChecks = fetchedUsers.map(user =>
                  getDoc(doc(db, 'users', user.id, 'followRequests', currentUserId))
              );
              const requestSnapshots = await Promise.all(requestChecks);
              const pendingRequestUids = new Set();
              requestSnapshots.forEach((snap, index) => {
                  if (snap.exists()) {
                      pendingRequestUids.add(fetchedUsers[index].id);
                  }
              });
              setRequestedUids(pendingRequestUids);
          } else {
              setRequestedUids(new Set());
          }

        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchUsersAndRequests();
    } else {
      setUsers([]);
      setRequestedUids(new Set());
    }
  }, [userIds, currentUserId]);

  const handleUserPress = (userId) => {
    onClose();
    navigation.push('Profile', { userId });
  };

  const handleRequestFollow = useCallback(async (userToRequest) => {
    if (!currentUserId) return;
    setRequestedUids(prev => new Set(prev).add(userToRequest.id));
    try {
      await requestToFollowUser({ userIdToFollow: userToRequest.id });
    } catch (error) {
      console.error("Error sending follow request: ", error);
      setRequestedUids(prev => {
        const newSet = new Set(prev);
        newSet.delete(userToRequest.id);
        return newSet;
      });
      Alert.alert('Error', 'Could not send follow request.');
    }
  }, [currentUserId]);

  const handleWithdrawRequest = useCallback(async (userToWithdrawFrom) => {
    if (!currentUserId) return;
    setRequestedUids(prev => {
        const newSet = new Set(prev);
        newSet.delete(userToWithdrawFrom.id);
        return newSet;
    });
    try {
      await withdrawFollowRequest({ userIdToWithdrawFrom: userToWithdrawFrom.id });
    } catch (error) {
      console.error("Error withdrawing follow request: ", error);
      setRequestedUids(prev => new Set(prev).add(userToWithdrawFrom.id));
      Alert.alert('Error', 'Could not withdraw request.');
    }
  }, [currentUserId]);

  const handleUnfollow = useCallback((userToUnfollow) => {
    if (!currentUserId) return;
    Alert.alert(
      `Unfollow @${userToUnfollow.username}?`,
      "",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Unfollow", 
          style: "destructive", 
          onPress: async () => {
            try {
              await unfollowUser({ userIdToUnfollow: userToUnfollow.id });
            } catch (e) {
              console.error('Failed to unfollow user:', e);
              Alert.alert("Error", "Could not unfollow user.");
            }
          }
        }
      ]
    );
  }, [currentUserId]);
  
  const renderUser = ({ item }) => {
    const isFollowing = followingUids.has(item.id);
    const isFollower = followerUids.has(item.id);
    const isRequested = requestedUids.has(item.id);

    const renderButton = () => {
        if (item.id === currentUserId) return null;

        if (isFollowing) {
            return (
                <Pressable style={styles.followingButton} onPress={() => handleUnfollow(item)}>
                    <Text style={styles.actionButtonText}>Following</Text>
                </Pressable>
            );
        }
        if (isRequested) {
            return (
                <Pressable style={styles.requestedButton} onPress={() => handleWithdrawRequest(item)}>
                    <Text style={styles.actionButtonText}>Requested</Text>
                </Pressable>
            );
        }
        if (isFollower && !isFollowing) {
            return (
                 <Pressable style={styles.followButton} onPress={() => handleRequestFollow(item)}>
                    <Text style={styles.followButtonText}>Follow Back</Text>
                </Pressable>
            );
        }
        return (
            <Pressable style={styles.followButton} onPress={() => handleRequestFollow(item)}>
                <Text style={styles.followButtonText}>Follow</Text>
            </Pressable>
        );
    };

    return (
        <View style={styles.userRowContainer}>
            <Pressable style={styles.userInfoContainer} onPress={() => handleUserPress(item.id)}>
                <Image
                    source={item.photoURL ? { uri: item.photoURL } : defaultProfilePhoto}
                    style={styles.profilePhoto}
                />
                <View style={styles.userInfo}>
                    <Text style={styles.displayName}>{item.displayName}</Text>
                    <Text style={styles.username}>@{item.username}</Text>
                </View>
            </Pressable>
            <View style={styles.actionContainer}>
                {renderButton()}
            </View>
        </View>
    )
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={28} color="#53544D" />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
        </View>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#8BA637" />
        ) : (
          <FlatList
            data={users}
            renderItem={renderUser}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No users to show.</Text>
                </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e6e6e6',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    left: 20,
    top: 12,
    zIndex: 1,
  },
  title: {
    fontSize: 22,
    color: '#53544D',
    fontFamily: 'PatrickHand-Regular',
  },
  userRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profilePhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    color: '#53544D',
  },
  username: {
    fontSize: 14,
    fontFamily: 'PatrickHand-Regular',
    color: '#b9b9b9',
  },
  actionContainer: {
    minWidth: 90,
    alignItems: 'flex-end',
  },
  followButton: {
    backgroundColor: '#8BA637',
    borderRadius: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followButtonText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 14,
    color: '#FFFFFF',
  },
  followingButton: {
    backgroundColor: '#e6e6e6',
    borderRadius: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestedButton: {
    backgroundColor: '#e6e6e6',
    borderRadius: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 14,
    color: '#53544D',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 18,
    color: '#b9b9b9',
  }
});
