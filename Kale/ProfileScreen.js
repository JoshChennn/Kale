import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, SafeAreaView, Text, ScrollView, Dimensions, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { users, posts } from './data';

const screenWidth = Dimensions.get('window').width;
const gridMargin = 6;
const imgSize = (screenWidth - gridMargin * 4) / 3;

export function BottomNav({ navigation, current }) {
  return (
    <View style={styles.navBar}>
      <Pressable onPress={() => navigation.navigate('Feed')}>
        <MaterialIcons name="home" size={43} color={current === 'Feed' ? '#8BA637' : '#B9B9B9'} />
      </Pressable>
      <Pressable onPress={() => navigation.navigate('Profile')}>
        <MaterialIcons name="person" size={43} color={current === 'Profile' ? '#8BA637' : '#B9B9B9'} />
      </Pressable>
      {/* add more icons/screens as you go */}
    </View>
  );
}

export default function ProfileScreen({ navigation, route }) {
  const defaultUserId = 1; // or whatever your current user's id is
  const { userId } = route.params || { userId: defaultUserId };

  // Find the user by id
  const user = users.find(u => u.id === userId);

  // Find posts for this user
  const userPosts = posts.filter(p => p.user.id === userId);

  const [isFollowing, setisFollowing] = useState(false);
  const [isBestie, setIsBestie] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* profile image */}
          <Image
            source={{ uri: user.avatar }}
            style={styles.profileImage}
          />

          {/* name, handle, badge */}
          <View style={styles.row}>
            <Text style={styles.name}>{user.name}</Text>
            <MaterialIcons name="verified" size={20} color="#8BA637" style={{ marginLeft: 4 }} />
          </View>
          <Text style={styles.handle}>@thebiggestbird</Text>
          <Text style={styles.bio}>
            Born in 1969 / child labour advocate.{"\n"}
            As my old friend Alexander Hamilton once said, "the children are fast."
          </Text>

          <View style={styles.buttonWrapper}>
            {/* Add Friend / Remove Friend button */}
            <Pressable
              style={isFollowing ? styles.removeFriendButton : styles.addFriendButton}
              onPress={() => {
                if (isFollowing) {
                  setisFollowing(false);
                  setIsBestie(false); // also remove bestie if unfriended
                } else {
                  setisFollowing(true);
                }
              }}
            >
              <Text style={isFollowing ? styles.removeFriendText : styles.addFriendText}>
                {isFollowing ? "Unfollow" : "Follow"}
              </Text>
            </Pressable>

            {/* Bestie Button (only show if friend) */}
            {isFollowing && (
              <Pressable
                style={isBestie ? styles.removeBestieButton : styles.addBestieButton}
                onPress={() => setIsBestie(!isBestie)}
              >
                <Text style={isBestie ? styles.removeBestieText : styles.addBestieText}>
                  {isBestie ? "Remove from besties" : "Add to besties"}
                </Text>
              </Pressable>
            )}
          </View>

          {/* posts grid or lock */}
          {!isFollowing ? (
            // NOT friends: show lock + message
            <View style={styles.lockContainer}>
              <MaterialIcons name="lock" size={72} color="#b9b9b9" />
              <Text style={styles.lockText}>This account is private.</Text>
            </View>
          ) : (
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
});
