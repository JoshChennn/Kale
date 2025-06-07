import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { db, auth } from './firebaseConfig';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons';

export default function PostScreen({ route, navigation }) {
  const { post } = route.params;
  const currentUser = auth.currentUser;

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    const commentsRef = collection(db, 'posts', post.id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedComments = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text,
          author: data.authorName,
          date: data.createdAt?.toDate().toLocaleDateString() || 'someday',
        };
      });
      setComments(fetchedComments);
    });

    return () => unsubscribe();
  }, [post.id]);

  const handleAddComment = async () => {
    if (newComment.trim().length === 0 || !currentUser) return;

    const commentsRef = collection(db, 'posts', post.id, 'comments');
    await addDoc(commentsRef, {
      text: newComment.trim(),
      authorId: currentUser.uid,
      authorName: currentUser.displayName || 'Anonymous',
      createdAt: serverTimestamp(),
    });

    // Increment commentsCount on the post document
    const postRef = doc(db, 'posts', post.id);
    await updateDoc(postRef, {
      commentsCount: increment(1)
    });

    setNewComment('');
  };

  const renderComment = ({ item }) => (
    <View style={styles.commentItem}>
      <Text style={styles.commentAuthor}>{item.author}:</Text>
      <Text style={styles.commentText}>{item.text}</Text>
      <Text style={styles.commentDate}>{item.date}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#53544D" />
        </Pressable>
        <Text style={styles.headerTitle}>Comments</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Image source={{ uri: post.imageUri }} style={styles.postImage} />
        <Text style={styles.postUsername}>{post.user.name}</Text>
        <Text style={styles.postDate}>{post.date}</Text>

        <View style={styles.commentsSection}>
          {comments.length === 0 ? (
            <Text style={styles.noCommentsText}>No comments yet. Be the first!</Text>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={item => item.id}
              renderItem={renderComment}
              style={styles.commentsList}
            />
          )}
        </View>
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newComment}
            onChangeText={setNewComment}
            placeholder="add a comment..."
            placeholderTextColor="#999"
          />
          <Pressable style={styles.sendButton} onPress={handleAddComment}>
            <MaterialIcons name="send" size={24} color="#8BA637" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* Container Styles */
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },
  container: {
    padding: 20,
    paddingBottom: 80,
  },

  /* Header Styles */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e6e6e6',
  },
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'PatrickHand-Regular',
    color: '#53544D',
  },

  /* Post Styles */
  postImage: {
    width: '100%',
    height: 300,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#ccc',
  },
  postUsername: {
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    color: '#53544D',
  },
  postDate: {
    fontSize: 14,
    fontFamily: 'PatrickHand-Regular',
    color: '#b9b9b9',
    marginBottom: 20,
  },

  /* Comments Section */
  commentsSection: {
    flex: 1,
  },
  noCommentsText: {
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    color: '#999',
    textAlign: 'center',
    marginTop: 40,
  },
  commentsList: {
    marginBottom: 10,
  },
  commentItem: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  commentAuthor: {
    fontSize: 14,
    fontFamily: 'PatrickHand-Regular',
    color: '#53544D',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    color: '#53544D',
  },
  commentDate: {
    fontSize: 12,
    fontFamily: 'PatrickHand-Regular',
    color: '#b9b9b9',
    textAlign: 'right',
    marginTop: 4,
  },

  /* Input Section */
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#e6e6e6',
    backgroundColor: '#F2F2F2',
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: '#e6e6e6',
    borderRadius: 20,
    paddingHorizontal: 15,
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    color: '#53544D',
  },
  sendButton: {
    marginLeft: 10,
  },
});