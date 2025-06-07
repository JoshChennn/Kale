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
  const currentUserId = auth.currentUser?.uid;

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
      const lower = query.toLowerCase();
      // Use v8 compat syntax for queries (chaining methods)
      const usersRef = db.collection('users');
      const q = usersRef
        .where('handle', '>=', lower)
        .where('handle', '<=', `${lower}\uf8ff`)
        .limit(15);

      try {
        // Use .get() instead of getDocs(q)
        const querySnapshot = await q.get();
        const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setResults(users.filter(u => u.id !== currentUserId));
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimeout = setTimeout(() => performSearch(), 300);
    return () => clearTimeout(debounceTimeout);
  }, [query, currentUserId]);

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
        // Use v8 compat syntax for 'in' queries on document IDs
        const q = usersRef.where(firebase.firestore.FieldPath.documentId(), 'in', recents.slice(0, 10));
        // Use .get()
        const snapshot = await q.get();
        const userMap = new Map(snapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]));
        setRecentsUsers(recents.map(id => userMap.get(id)).filter(Boolean));
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

  // ... (rest of the component is unchanged)

  // shared row renderer
  const UserRow = ({ user, showDelete }) => (
    <View style={styles.row}>
      <Pressable
        style={styles.rowPressable}
        onPress={() => navigateToProfile(user)}
      >
        <Image source={{ uri: user.avatar }} style={styles.avatar} />
        <View style={styles.textWrap}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.handle}>{user.handle}</Text>
          {user.bio && !showDelete && (
            <Text numberOfLines={1} style={styles.bio}>
              {user.bio}
            </Text>
          )}
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
            placeholder="Find anyone…"
            placeholderTextColor="#999"
            style={styles.searchInput}
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
                <Empty text="no recents yet" />
                )
            }
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
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
  container: { flex: 1, backgroundColor: '#f2f2f2' },
  searchBarWrapper: {
    paddingTop: 70,
    paddingHorizontal: 20,
    backgroundColor: '#f2f2f2',
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
    color: '#53544D',
    fontFamily: 'PatrickHand-Regular',
    paddingVertical: 0,
  },
  clearSearch: { marginLeft: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  rowPressable: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  textWrap: { flex: 1 },
  name: {
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    color: '#53544D',
  },
  handle: {
    fontSize: 14,
    fontFamily: 'PatrickHand-Regular',
    color: '#b9b9b9',
  },
  bio: {
    fontSize: 12,
    fontFamily: 'PatrickHand-Regular',
    color: '#777',
    marginTop: 2,
  },
  closeBtn: { padding: 8 },
  recentsTitle: {
    fontSize: 18,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
    marginTop: 20,
    marginBottom: 6,
    marginLeft: 20,
  },
  empty: { marginTop: 60, alignItems: 'center' },
  emptyText: {
    fontSize: 18,
    fontFamily: 'PatrickHand-Regular',
    color: '#b9b9b9',
  },
});