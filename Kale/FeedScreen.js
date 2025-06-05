import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  Dimensions,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { posts as allPosts, users } from './data';

const screenWidth = Dimensions.get('window').width;
const storySize = 70;
const CARD_RADIUS = 20;
const CURRENT_USER_ID = 1;
const FOLLOWING_KEY = 'followingUsers';

export default function FeedScreen({ navigation }) {
  // removed <number[]> type annotation since this is a .js file
  const [followingUsers, setFollowingUsers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(FOLLOWING_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        setFollowingUsers(parsed);
      } catch (e) {
        console.warn('failed to load following list', e);
      }
    })();
  }, []);

  // build stories: own user first, then followed users
  const stories = React.useMemo(() => {
    const currentUser = users.find(u => u.id === CURRENT_USER_ID);
    const followed = users.filter(u => followingUsers.includes(u.id));
    const storyEntries = [];
    if (currentUser && currentUser.stories) {
      storyEntries.push({ id: currentUser.id, name: currentUser.name, uriList: currentUser.stories });
    }
    followed.forEach(user => {
      if (user.stories) {
        storyEntries.push({ id: user.id, name: user.name, uriList: user.stories });
      }
    });
    return storyEntries;
  }, [followingUsers]);

  // build posts: only posts by followed users
  const posts = React.useMemo(() => {
    return allPosts.filter(p => followingUsers.includes(p.user.id));
  }, [followingUsers]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.postsList}
        showsVerticalScrollIndicator={false}
      >
        {/* header */}
        <Text style={styles.header}>KALE</Text>

        {/* stories bar */}
        <View style={styles.storiesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {stories.map(storyBlock => (
              <Pressable
                key={storyBlock.id}
                style={styles.storyItem}
                onPress={() => {
                  // open StoryViewer with all URIs for that user
                  navigation.navigate('StoryViewer', {
                    stories: storyBlock.uriList,
                    initialIndex: 0,
                  });
                }}
              >
                <Image source={{ uri: users.find(u => u.id === storyBlock.id)?.avatar }} style={styles.storyImage} />
                <Text style={styles.storyName}>{storyBlock.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* posts list */}
        {posts.map(post => (
          <View key={post.id} style={styles.postCard}>
            <Pressable
              style={styles.postHeader}
              onPress={() => {
                if (post.user.id === CURRENT_USER_ID) {
                  navigation.navigate('MainTabs', { screen: 'Profile', params: { userId: CURRENT_USER_ID } });
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
              <Text style={styles.commentsText}>View comments ({post.commentsCount})</Text>
            </Pressable>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const CARD_BG = '#8BA637';
const BG = '#F2F2F2';
const { width: width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // HEADER
  header: {
    fontSize: 40,
    textAlign: 'center',
    marginVertical: 30,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
  },

  // STORY BAR
  storiesContainer: {
    height: storySize + 30,
    paddingLeft: 30,
    paddingBottom: 0,
    paddingTop: 0,
    marginBottom: 20,
  },
  storyItem: {
    width: storySize,
    marginHorizontal: 10,
    alignItems: 'center',
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

  // POSTS
  postsList: {
    paddingTop: 0,
    paddingBottom: 100,
    alignItems: 'center',
  },
  postCard: {
    marginBottom: 20,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
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
    aspectRatio: '1',
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
});
