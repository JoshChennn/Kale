import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';

export default function SelectPhotoScreen({ navigation }) {
  const [selectedUris, setSelectedUris] = useState([]);

  const pickImages = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission Denied", "You've refused to allow this app to access your photos!");
      return;
    }

    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 0.7,
      });

      if (!result.canceled) {
        if (result.assets && result.assets.length > 0) {
          setSelectedUris(result.assets.map(asset => asset.uri));
        }
      }
    } catch (error) {
      console.error("Error picking images: ", error);
      Alert.alert("Error", "Could not pick images. Please try again.");
    }
  };

  const renderItem = ({ item }) => (
    <Image source={{ uri: item }} style={styles.thumbnail} />
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={28} color="#53544D" />
        </TouchableOpacity>
        <Text style={styles.title}>Select Photo(s)</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('PostDetails', { photos: selectedUris })}
          disabled={selectedUris.length === 0}
        >
          <Text style={[styles.next, { opacity: selectedUris.length > 0 ? 1 : 0.3 }]}>Next</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <TouchableOpacity style={styles.button} onPress={pickImages}>
          <MaterialIcons name="photo-library" size={22} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.buttonText}>Choose From Library</Text>
        </TouchableOpacity>
        {selectedUris.length > 0 && (
          <FlatList
            data={selectedUris}
            keyExtractor={(uri, index) => `${uri}-${index}`}
            renderItem={renderItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.list}
            contentContainerStyle={styles.listContentContainer}
          />
        )}
        {selectedUris.length === 0 && (
            <View style={styles.emptyStateContainer}>
                <MaterialIcons name="image-search" size={80} color="#e0e0e0" />
                <Text style={styles.emptyStateText}>No media selected yet.</Text>
                <Text style={styles.emptyStateSubText}>Tap the button above to choose photos or videos.</Text>
            </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 16,
    borderBottomWidth: 1,
    borderColor: '#ddd',
    height: Platform.OS === 'ios' ? 56 : 60,
    backgroundColor: '#FFFFFF',
  },
  title: { fontSize: 20, fontFamily: 'PatrickHand-Regular', color: '#53544D' },
  next: { fontSize: 18, color: '#8BA637', fontFamily: 'PatrickHand-Regular' },
  content: { flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 40, paddingHorizontal: 16 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8BA637',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
    marginBottom: 24,
  },
  buttonText: { color: '#fff', fontSize: 18, fontFamily: 'PatrickHand-Regular' },
  list: {
    maxHeight: 110,
    width: '100%',
  },
  listContentContainer: {
    paddingVertical: 5,
    alignItems: 'center',
  },
  thumbnail: {
    width: 100,
    height: 100,
    marginRight: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f0f0f0',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: 'PatrickHand-Regular',
    color: '#b9b9b9',
  },
  emptyStateSubText: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: 'PatrickHand-Regular',
    color: '#c9c9c9',
    textAlign: 'center',
  }
});