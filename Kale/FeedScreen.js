// FeedScreen.tsx
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
import { posts } from './data';

const screenWidth = Dimensions.get('window').width;
const storySize = 70;
const CARD_RADIUS = 20;

// dummy data for stories
const stories = [
  { id: 1, name: 'Unknown', uri: 'https://placekitten.com/100/100' },
  { id: 2, name: 'Timothy', uri: 'https://randomuser.me/api/portraits/men/32.jpg' },
  { id: 3, name: 'Kale', uri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb' },
  { id: 4, name: 'Other Girl', uri: 'https://randomuser.me/api/portraits/women/44.jpg' },
  { id: 5, name: 'Some Dude', uri: 'https://randomuser.me/api/portraits/men/65.jpg' },
];

export default function FeedScreen({ navigation }) {
  // Always render the unlocked feed UI
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
            {stories.map((story) => (
              <View key={story.id} style={styles.storyItem}>
                <Image source={{ uri: story.uri }} style={styles.storyImage} />
                <Text style={styles.storyName}>{story.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* posts list */}
        {posts.map((post) => (
          <View key={post.id} style={styles.postCard}>
            <Pressable
              style={styles.postHeader}
              onPress={() => {
                const currentUserId = 1; // Assuming Big Bird's ID is 1
                if (post.user.id === currentUserId) {
                  navigation.navigate('MainTabs', { screen: 'Profile', params: { userId: currentUserId } }); // Navigate to the main Profile tab within MainTabs
                } else {
                  navigation.navigate('ProfileModal', { userId: post.user.id }); // Open ProfileModal for other users
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
              <Text style={styles.commentsText}>
                View comments ({post.commentsCount})
              </Text>
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

const modalStyles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headline: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 32,
    color: CARD_BG,
    marginTop: 57,
    marginBottom: 60,
    textAlign: 'center',
  },
  card: {
    width: width - 80,
    borderRadius: 35,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    minHeight: 500,
    marginHorizontal: 40,
    position: 'relative',
  },
  icon: {
    marginTop: 80,
    marginBottom: 30,
  },
  bodyText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 24,
    color: BG,
    textAlign: 'center',
    lineHeight: 28,
  },
  button: {
    backgroundColor: BG,
    borderRadius: 10,
    width: 135,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 80,
  },
  buttonText: {
    fontFamily: 'PatrickHand-Regular',
    fontSize: 24,
    color: CARD_BG,
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
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
