import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  Image,
} from 'react-native';
import { auth, db } from './firebaseConfig';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { StackScreenProps } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';

type OnboardingStackParamList = {
  OnboardingIntro: undefined;
  ConnectContacts: undefined;
  CreateProfileFirstName: undefined;
  CreateProfileLastName: undefined;
  CreateProfileUsername: undefined;
  CreateProfilePhoto: undefined;
  AddFriends: undefined;
};

type Props = StackScreenProps<OnboardingStackParamList, 'CreateProfilePhoto'>;

export default function CreateProfilePhotoScreen({ navigation }: Props) {
  const [imageUri, setImageUri] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const currentUser = auth.currentUser;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };
  
  const uploadImageAsync = async (uri: string) => {
    if (!currentUser) throw new Error("No user logged in");
  
    const blob: Blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        console.error(e);
        reject(new TypeError("Network request failed"));
      };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });
  
    const storage = getStorage();
    const storageRef = ref(storage, `profile_pictures/${currentUser.uid}`);
    await uploadBytes(storageRef, blob);
  
    // We're done with the blob, close and release it
    // @ts-ignore
    blob.close();
  
    return await getDownloadURL(storageRef);
  }

  const handleContinue = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'Not authenticated.');
      return;
    }
    if (!imageUri) {
        // If they press continue without a photo, it's the same as skipping
        handleSkip();
        return;
    }
    setLoading(true);

    try {
        const downloadURL = await uploadImageAsync(imageUri);
        await db.collection('users').doc(currentUser.uid).set(
            { photoURL: downloadURL },
            { merge: true }
        );
        navigation.navigate('AddFriends');
    } catch (error) {
        console.error('Failed to upload photo: ', error);
        Alert.alert('Upload Error', 'Could not upload your photo. Please try again.');
    } finally {
        setLoading(false);
    }
  };

  const handleSkip = () => {
    navigation.navigate('AddFriends');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Add a profile photo</Text>
        
        <Pressable style={styles.imagePicker} onPress={pickImage}>
            {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.profileImage} />
            ) : (
                <View style={styles.placeholder}>
                    <MaterialIcons name="add-a-photo" size={60} color="#F2F2F290" />
                    <Text style={styles.placeholderText}>Select a photo</Text>
                </View>
            )}
        </Pressable>
      </View>

      <View style={styles.bottomContainer}>
        {loading ? (
          <ActivityIndicator size="small" color="#F2F2F2" style={{ paddingVertical: 12 }} />
        ) : (
          <>
            <Pressable
              onPress={handleContinue}
              style={({ pressed }) => [
                styles.buttonContainer,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.buttonText}>{imageUri ? 'Upload & Continue' : 'Continue'}</Text>
            </Pressable>
            <Pressable onPress={handleSkip} style={styles.skipButton}>
                <Text style={styles.skipButtonText}>Skip for now</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#8BA637',
      },
      content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      },
      title: {
        fontSize: 36,
        fontFamily: 'PatrickHand-Regular',
        color: '#F2F2F2',
        textAlign: 'center',
        marginBottom: 40,
        paddingHorizontal: 20,
      },
      imagePicker: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#00000020',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#F2F2F250',
        borderStyle: 'dashed',
      },
      profileImage: {
          width: '100%',
          height: '100%',
          borderRadius: 100,
      },
      placeholder: {
        justifyContent: 'center',
        alignItems: 'center',
      },
      placeholderText: {
        marginTop: 10,
        fontFamily: 'PatrickHand-Regular',
        fontSize: 18,
        color: '#F2F2F290',
      },
      bottomContainer: {
        padding: 20,
        paddingBottom: 40,
      },
      buttonContainer: {
        backgroundColor: '#F2F2F2',
        borderRadius: 25,
        height: 48,
        justifyContent: 'center',
      },
      buttonText: {
        color: '#8BA637',
        fontSize: 20,
        fontFamily: 'PatrickHand-Regular',
        textAlign: 'center',
      },
      skipButton: {
          marginTop: 15,
          alignSelf: 'center',
      },
      skipButtonText: {
        color: '#F2F2F2',
        fontSize: 18,
        fontFamily: 'PatrickHand-Regular',
      }
});