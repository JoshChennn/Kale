// SearchScreen.js

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
// Import the v8 compat instances, including the 'firebase' object for FieldPath
import { db, auth, firebase } from './firebaseConfig';

const RECENTS_KEY = 'searchRecents_v1';
const MAX_RECENTS = 15;

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState([]); // userIds
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUserFollowing, setCurrentUserFollowing] = useState([]); // <-- New state for social ranking
  const currentUserId = auth.currentUser?.uid;

  // Step 1: Fetch the current user's 'following' list once when the screen loads.
  // This is essential for ranking results by social connection.
  useEffect(() => {
    if (!currentUserId) return;

    // In a real app, you might fetch this from a different collection like 'following'
    // For this example, we assume 'following' is an array on the user doc.
    const userRef = db.collection('users').doc(currentUserId);
    const unsubscribe = userRef.onSnapshot(doc => {
      if (doc.exists) {
        setCurrentUserFollowing(doc.data().following || []);
      }
    });

    return () => unsubscribe();
  }, [currentUserId]);

  // load cached recents
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(RECENTS_KEY);
        if (stored) setRecents(JSON.parse(stored));
      } catch (e) {
        console.warn('failed to load recents', e);
      }
    })();
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (query.trim().length === 0) {
        setResults([]);
        return;
      }

      setLoading(true);
      const searchTerm = query.toLowerCase().trim();

      // Because Firestore doesn't support substring searches, we fetch a broader
      // set of users (e.g., all users whose handle starts with the first letter
      // of the search term) and then filter them on the client.
      const firstLetter = searchTerm.charAt(0);
      const usersRef = db.collection('users');
      const q = usersRef
        .where('username', '>=', firstLetter)
        .where('username', '<=', `${firstLetter}\uf8ff`)
        .limit(40); // Fetch a slightly larger batch for client-side filtering

      try {
        const querySnapshot = await q.get();
        const initialResults = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Step 2: Client-side filtering for a true "contains" search.
        // This checks if the search term is in the user's name or username.
        const filteredResults = initialResults.filter(user => {
            const name = user.name ? user.name.toLowerCase() : '';
            const username = user.username ? user.username.toLowerCase() : '';
            return name.includes(searchTerm) || username.includes(searchTerm);
        });

        // Step 3: Rank the results. Users you follow are prioritized and appear first.
        const rankedResults = filteredResults.sort((a, b) => {
            const isAFollowing = currentUserFollowing.includes(a.id);
            const isBFollowing = currentUserFollowing.includes(b.id);

            if (isAFollowing && !isBFollowing) return -1; // a comes first
            if (!isAFollowing && isBFollowing) return 1;  // b comes first
            return 0; // keep original order
        });
        
        setResults(rankedResults.filter(u => u.id !== currentUserId));

      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimeout = setTimeout(() => performSearch(), 300);
    return () => clearTimeout(debounceTimeout);
  }, [query, currentUserId, currentUserFollowing]);

  const persist = async (list) => {
    setRecents(list);
    try {
      await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('failed to save recents', e);
    }
  };

  const addRecent = async (id) => {
    const list = [id, ...recents.filter((x) => x !== id)].slice(0, MAX_RECENTS);
    await persist(list);
  };

  const removeRecent = async (id) => {
    await persist(recents.filter((x) => x !== id));
  };

  const [recentsUsers, setRecentsUsers] = useState([]);
  useEffect(() => {
    const loadRecentsData = async () => {
      if (recents.length > 0) {
        const usersRef = db.collection('users');
        const q = usersRef.where(firebase.firestore.FieldPath.documentId(), 'in', recents.slice(0, 10));
        const snapshot = await q.get();
        const userMap = new Map(snapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]));
        setRecentsUsers(recents.map(id => userMap.get(id)).filter(Boolean));
      } else {
        setRecentsUsers([]);
      }
    }
    loadRecentsData();
  }, [recents]);

  const navigateToProfile = async (user) => {
    await addRecent(user.id);
    if (user.id === currentUserId) {
      navigation.navigate('Profile', { userId: currentUserId });
    } else {
      navigation.navigate('ProfileModal', { userId: user.id });
    }
  };

  // shared row renderer
  const UserRow = ({ user, showDelete }) => {
    const isFollowing = currentUserFollowing.includes(user.id);
    return (
        <View style={styles.row}>
            <Pressable
                style={styles.rowPressable}
                onPress={() => navigateToProfile(user)}
            >
                <Image 
                    source={user.avatar || user.photoURL ? { uri: user.avatar || user.photoURL } : require('./assets/default-profile-photo.png')} 
                    style={styles.avatar} 
                />
                <View style={styles.textWrap}>
                    <View style={styles.nameRow}>
                        <Text style={styles.name} numberOfLines={1}>{user.name || user.username}</Text>
                        {isFollowing && <MaterialIcons name="how-to-reg" size={16} color="#8BA637" style={styles.followingIcon} />}
                    </View>
                    <Text style={styles.handle} numberOfLines={1}>@{user.username}</Text>
                </View>
            </Pressable>
            {showDelete && (
                <Pressable
                onPress={() => removeRecent(user.id)}
                style={styles.closeBtn}
                hitSlop={8}
                >
                <MaterialIcons name="close" size={20} color="#999" />
                </Pressable>
            )}
        </View>
    );
  }

  const showResults = query.trim().length > 0;

  return (
    <View style={styles.container}>
      {/* search bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchInputContainer}>
          <MaterialIcons
            name="search"
            size={20}
            color="#999"
            style={styles.searchIcon}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or username..."
            placeholderTextColor="#999"
            style={styles.searchInput}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} style={styles.clearSearch} hitSlop={8}>
              <MaterialIcons name="close" size={18} color="#999" />
            </Pressable>
          )}
        </View>
      </View>

      {/* results vs recents */}
      {showResults ? (
        loading ? ( 
          <ActivityIndicator size="large" color="#8BA637" style={{ marginTop: 60 }} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(u) => u.id.toString()}
            renderItem={({ item }) => <UserRow user={item} showDelete={false} />}
            ListEmptyComponent={<Empty text="No results found." />}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContentContainer}
          />
        )
      ) : (
        <FlatList
            data={recentsUsers}
            keyExtractor={(u) => u.id.toString()}
            renderItem={({ item }) => <UserRow user={item} showDelete />}
            ListHeaderComponent={
                recentsUsers.length ? (
                <Text style={styles.recentsTitle}>Recents</Text>
                ) : (
                <Empty text="No recent searches." />
                )
            }
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContentContainer}
        />
      )}
    </View>
  );
}

const Empty = ({ text }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyText}>{text}</Text>
  </View>
);

// styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  searchBarWrapper: {
    paddingTop: 70,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6e6e6',
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 45,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'PatrickHand-Regular',
    color: '#53544D',
    paddingVertical: 0,
    letterSpacing: 0,
  },
  clearSearch: { marginLeft: 8 },
  listContentContainer: {
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#e6e6e6',
    borderWidth: 0.2,
    borderColor: '#b9b9b9',
  },
  textWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 20,
    fontFamily: 'PatrickHand-Regular',
    color: '#333',
    marginTop: -6,
  },
  followingIcon: {
    marginLeft: 8,
  },
  handle: {
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    color: '#888',
    marginTop: -3,
  },
  closeBtn: { padding: 8 },
  recentsTitle: {
    fontSize: 20,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
    paddingTop: 10,
    paddingBottom: 10,
  },
  empty: { marginTop: 60, alignItems: 'center' },
  emptyText: {
    fontSize: 18,
    fontFamily: 'PatrickHand-Regular',
    color: '#b9b9b9',
  },
});