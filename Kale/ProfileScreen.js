import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, SafeAreaView, Text, ScrollView, Dimensions, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { users, posts } from './data';
import AsyncStorage from '@react-native-async-storage/async-storage';

const screenWidth = Dimensions.get('window').width;
const gridMargin = 6;
const imgSize = (screenWidth - gridMargin * 4) / 3;

export default function ProfileScreen({ navigation, route }) {
  const defaultUserId = 1; // Assuming Big Bird's ID is 1
  const { userId } = route.params || { userId: defaultUserId };

  const isCurrentUser = userId === defaultUserId;

  // Find the user by id
  const user = users.find(u => u.id === userId);

  // Find posts for this user
  const userPosts = posts.filter(p => p.user.id === userId);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isBestie, setIsBestie] = useState(false);

  // Load following status from AsyncStorage when userId changes
  useEffect(() => {
    const loadFollowingStatus = async () => {
      if (!isCurrentUser) { // Only load for other users
        try {
          const followingUsers = JSON.parse(await AsyncStorage.getItem('followingUsers')) || [];
          const isCurrentlyFollowing = followingUsers.includes(userId);
          setIsFollowing(isCurrentlyFollowing);

          // In a real app, you'd also load bestie status here
          setIsBestie(false); // Reset bestie state for new user

        } catch (e) {
          console.error('Failed to load following status', e);
          setIsFollowing(false);
          setIsBestie(false);
        }
      } else {
        // Current user's profile - always show following true for demo purposes
        setIsFollowing(true);
        setIsBestie(false); // Assuming current user is not their own bestie
      }
    };

    loadFollowingStatus();
  }, [userId, isCurrentUser]); // Rerun when userId or isCurrentUser changes

  // Save following status to AsyncStorage
  const toggleFollowing = async () => {
    if (!isCurrentUser) { // Only toggle for other users
      try {
        const followingUsers = JSON.parse(await AsyncStorage.getItem('followingUsers')) || [];
        const newFollowingUsers = isFollowing
          ? followingUsers.filter(id => id !== userId) // Unfollow
          : [...followingUsers, userId]; // Follow

        await AsyncStorage.setItem('followingUsers', JSON.stringify(newFollowingUsers));
        setIsFollowing(!isFollowing);
        if (isFollowing) setIsBestie(false); // Unbestie if unfollowing
      } catch (e) {
        console.error('Failed to save following status', e);
      }
    }
  };

  // For demo purposes, toggle bestie status locally
  const toggleBestie = () => {
    if (isFollowing && !isCurrentUser) { // Only for other users and if following
      setIsBestie(!isBestie);
      // In a real app, save bestie status to backend/AsyncStorage
    }
  };

  // Handle case where user might be null (e.g., invalid userId)
  if (!user) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>User not found</Text></View>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* profile header: image, name, handle, badge */}
          <Pressable
            onPress={() => {
              const currentUserId = 1; // Assuming Big Bird's ID is 1
              // In ProfileScreen (the tab), this should always be the current user
              // Clicking the header should probably just stay on this page or scroll to top
              // If this screen could show other users, the logic would be different.
              // For now, let's just keep it as a no-op for the current user.
              if (isCurrentUser) {
                // Optional: scroll to top of the ScrollView
                // scrollViewRef.current?.scrollTo({ y: 0, animated: true });
              } else {
                // This case should not be reached if ProfileScreen is only for the current user
                // But if it were possible, you'd navigate to the modal:
                // navigation.navigate('ProfileModal', { userId: user.id });
              }
            }}
          >
            <Image
              source={{ uri: user.avatar }}
              style={styles.profileImage}
            />
            <View style={styles.row}>
              <Text style={styles.name}>{user.name}</Text>
              <MaterialIcons name="verified" size={20} color="#8BA637" style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.handle}>@{user.name.toLowerCase().replace(/\s/g, '')}</Text>
          </Pressable>

          <Text style={styles.bio}>
            Born in 1969 / child labour advocate.{"\n"}
            As my old friend Alexander Hamilton once said, "the children are fast."
          </Text>

          {/* Buttons */}
          <View style={styles.buttonWrapper}>
            {isCurrentUser ? (
              // Edit Profile Button for current user
              <Pressable style={styles.editProfileButton} onPress={() => { /* Handle Edit Profile */ }}>
                <Text style={styles.editProfileText}>Edit profile</Text>
              </Pressable>
            ) : (
              // Follow / Bestie Buttons for other users
              <>
                <Pressable
                  style={isFollowing ? styles.removeFriendButton : styles.addFriendButton}
                  onPress={toggleFollowing}
                >
                  <Text style={isFollowing ? styles.removeFriendText : styles.addFriendText}>
                    {isFollowing ? "Unfollow" : "Follow"}
                  </Text>
                </Pressable>

                {/* Bestie Button (only show if following) */}
                {isFollowing && (
                  <Pressable
                    style={isBestie ? styles.removeBestieButton : styles.addBestieButton}
                    onPress={toggleBestie}
                  >
                    <Text style={isBestie ? styles.removeBestieText : styles.addBestieText}>
                      {isBestie ? "Remove from besties" : "Add to besties"}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          {/* posts grid or lock */}
          {isCurrentUser || isFollowing ? (
            // Show grid if current user or following
            <View style={styles.gridList}>
              {userPosts.map((item, index) => (
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
            // NOT following: show lock + message
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },

  container: {
    paddingBottom: 32,
    backgroundColor: '#F2F2F2',
    flexGrow: 1,
  },

  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 0.5,
    borderColor: '#b9b9b9',
    marginTop: 69,
    marginLeft: 35,
    marginBottom: 12,
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

  buttonWrapper: {
    marginTop: 18,
    marginLeft: 35,
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: '#e6e6e6', // light gray
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
    color: '#53544D', // dark gray
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
    backgroundColor: '#e6e6e6', // light gray
    borderRadius: 5,
    width: 150,
    height: 33,
    justifyContent: 'center',
    alignItems: 'center',
  },

  removeBestieText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#53544D', // dark gray
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

  editProfileButton: {
    backgroundColor: '#e6e6e6', // light gray
    borderRadius: 5,
    width: 150, // Adjust width as needed
    height: 33,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editProfileText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#53544D', // dark gray
  },
});
