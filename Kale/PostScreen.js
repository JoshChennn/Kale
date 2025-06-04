// PostScreen.tsx
import React from 'react';
import {
  View,
  Text,
  Image,
  SafeAreaView,
  ScrollView,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

export default function PostScreen({ route, navigation }) {
  const { post } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      {/* header: avatar / username / date */}
      <ScrollView contentContainerStyle={styles.commentsContainer}>
      <View style={styles.header}>
        <Image source={{ uri: post.user.avatar }} style={styles.avatar} />
        <View style={styles.headerText}>
          <Text style={styles.username}>{post.user.name}</Text>
          <Text style={styles.date}>{post.date}</Text>
        </View>
      </View>

      {/* full-width post image */}
      <Image source={{ uri: post.imageUri }} style={styles.postImage} />

      {/* comments section */}
        {/* example static comment */}
        <View style={styles.commentRow}>
          <MaterialIcons name="person-outline" size={24} color="#53544D" />
          <View style={styles.commentTextWrapper}>
            <Text style={styles.commentUsername}>some_user</Text>
            <Text style={styles.commentBody}>
              this is a sample comment under the post.
            </Text>
          </View>
        </View>
        {/* you can map over post.comments if you have them */}
      </ScrollView>
    </SafeAreaView>
  );
}

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

  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },
  // header row styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  headerText: {
    flex: 1,
    flexDirection: 'column',
  },
  username: {
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    color: '#53544D',
  },
  date: {
    fontSize: 14,
    fontFamily: 'PatrickHand-Regular',
    color: '#b9b9b9',
  },

  // full-width image
  postImage: {
    width: screenWidth,
    height: screenWidth, // square aspect
    resizeMode: 'cover',
  },

  // comments wrapper
  commentRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
    padding: 15,
  },
  commentTextWrapper: {
    flex: 1,
    marginLeft: 8,
  },
  commentUsername: {
    fontSize: 1,
    fontFamily: 'PatrickHand-Regular',
    fontWeight: '600',
    color: '#53544D',
  },
  commentBody: {
    fontSize: 14,
    fontFamily: 'PatrickHand-Regular',
    color: '#53544D',
  },
});
