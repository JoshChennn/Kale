import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, SafeAreaView, Text, ScrollView, Dimensions, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { users, posts } from './data';
import AsyncStorage from '@react-native-async-storage/async-storage';

const screenWidth = Dimensions.get('window').width;
const gridMargin = 6;
const imgSize = (screenWidth - gridMargin * 4) / 3;

export default function ProfileModal({ navigation, route }) {
  const defaultUserId = 1;
  const { userId } = route.params || { userId: defaultUserId };

  const isCurrentUser = userId === defaultUserId;

  const user = users.find(u => u.id === userId);
  const userPosts = posts.filter(p => p.user.id === userId);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isBestie, setIsBestie] = useState(false);

  useEffect(() => {
    const loadFollowingStatus = async () => {
      if (!isCurrentUser) {
        try {
          const followingUsers = JSON.parse(await AsyncStorage.getItem('followingUsers')) || [];
          const isCurrentlyFollowing = followingUsers.includes(userId);
          setIsFollowing(isCurrentlyFollowing);

          setIsBestie(false);

        } catch (e) {
          console.error('Failed to load following status', e);
          setIsFollowing(false);
          setIsBestie(false);
        }
      } else {
        setIsFollowing(true);
        setIsBestie(false);
      }
    };

    loadFollowingStatus();
  }, [userId, isCurrentUser]);

  const toggleFollowing = async () => {
    if (!isCurrentUser) {
      try {
        const followingUsers = JSON.parse(await AsyncStorage.getItem('followingUsers')) || [];
        const newFollowingUsers = isFollowing
          ? followingUsers.filter(id => id !== userId)
          : [...followingUsers, userId];

        await AsyncStorage.setItem('followingUsers', JSON.stringify(newFollowingUsers));
        setIsFollowing(!isFollowing);
        if (isFollowing) setIsBestie(false);
      } catch (e) {
        console.error('Failed to save following status', e);
      }
    }
  };

  const toggleBestie = () => {
    if (isFollowing && !isCurrentUser) {
      setIsBestie(!isBestie);
    }
  };

  if (!user) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>User not found</Text></View>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <View style={{ flex: 1 }}>
        <Pressable style={{ alignSelf: 'flex-end', padding: 20 }} onPress={() => navigation.goBack()}>
          <MaterialIcons name="close" size={32} color="#8BA637" />
        </Pressable>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <View>
            <Image source={{ uri: user.avatar }} style={styles.profileImage} />
            <View style={styles.row}>
              <Text style={styles.name}>{user.name}</Text>
              <MaterialIcons name="verified" size={20} color="#8BA637" style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.handle}>@{user.name.toLowerCase().replace(/\s/g, '')}</Text>
          </View>
          <Text style={styles.bio}>This is {user.name}'s bio.</Text>

          <View style={styles.buttonWrapper}>
            {isCurrentUser ? (
              <Pressable style={styles.editProfileButton} onPress={() => { /* Handle Edit Profile */ }}>
                <Text style={styles.editProfileText}>Edit profile</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  style={isFollowing ? styles.removeFriendButton : styles.addFriendButton}
                  onPress={toggleFollowing}
                >
                  <Text style={isFollowing ? styles.removeFriendText : styles.addFriendText}>
                    {isFollowing ? "Unfollow" : "Follow"}
                  </Text>
                </Pressable>

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

          {isCurrentUser || isFollowing ? (
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
    zIndex: 99, // ensure nav bar sits above everything
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
}); 