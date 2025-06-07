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
  ActivityIndicator,
} from 'react-native';
import { db, auth } from './firebaseConfig';
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

const screenWidth = Dimensions.get('window').width;
const storySize = 70;

export default function FeedScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;

    // 1. Get the list of users the current user is following.
    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (userSnap) => {
      const userData = userSnap.data();
      const following = userData?.following || [];
      // Include current user's posts in the feed
      const usersToQuery = [...new Set([currentUser.uid, ...following])]; 

      if (usersToQuery.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      // 2. Query for posts where the userId is in the `usersToQuery` list.
      // Firestore 'in' queries are limited to 30 items. For this app, it's fine.
      const postsQuery = query(
        collection(db, 'posts'),
        where('userId', 'in', usersToQuery.slice(0, 30)),
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
        setPosts(fetchedPosts);
        setLoading(false);
      });

      // Fetch stories for the same users
      const fetchStories = async () => {
        const storyPromises = usersToQuery.map(uid => getDocs(query(collection(db, 'users', uid, 'stories'), limit(5))));
        const storySnapshots = await Promise.all(storyPromises);
        
        const storyUsers = await getDocs(query(collection(db, 'users'), where('__name__', 'in', usersToQuery.slice(0, 30))));
        const userMap = new Map(storyUsers.docs.map(d => [d.id, d.data()]));

        const storyEntries = storySnapshots.map((snapshot, index) => {
          if (!snapshot.empty) {
            const userId = usersToQuery[index];
            const user = userMap.get(userId);
            return {
              id: userId,
              name: user.name,
              avatar: user.avatar,
              uriList: snapshot.docs.map(d => ({id: d.id, ...d.data()}))
            };
          }
          return null;
        }).filter(Boolean);
        setStories(storyEntries);
      }
      fetchStories();
      
      return () => unsubscribePosts();
    });

    return () => unsubscribeUser();
  }, [currentUser]);


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#8BA637" />
      </SafeAreaView>
    );
  }

  const renderPost = (post) => (
           <View key={post.id} style={styles.postCard}>
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
               <Text style={styles.commentsText}>View comments ({post.commentsCount})</Text>
             </Pressable>
           </View>
  );

  return (
    <SafeAreaView style={styles.container}>
       <Text style={styles.header}>KALE</Text>
      {posts.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Your feed is empty.</Text>
          <Text style={styles.emptySubText}>Follow some people to see their posts!</Text>
          <Pressable onPress={() => navigation.navigate('Search')} style={styles.findFriendsButton}>
            <Text style={styles.findFriendsButtonText}>Find Friends</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.postsList}
          showsVerticalScrollIndicator={false}
        >
          {stories.length > 0 &&
            <View style={styles.storiesContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {stories.map(storyBlock => (
                  <Pressable key={storyBlock.id} style={styles.storyItem} onPress={() => navigation.navigate('StoryViewer', { stories: storyBlock.uriList, initialIndex: 0 })}>
                    <Image source={{ uri: storyBlock.avatar }} style={styles.storyImage} />
                    <Text style={styles.storyName}>{storyBlock.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          }

          {posts.map(renderPost)}

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const CARD_BG = '#8BA637';
const BG = '#F2F2F2';
const { width: width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 24,
    color: '#53544D',
  },
  emptySubText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 18,
    color: '#b9b9b9',
    marginTop: 8,
    marginBottom: 24,
  },
  findFriendsButton: {
    backgroundColor: '#8BA637',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  findFriendsButtonText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 18,
    color: 'white',
  },
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