import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, Image, Pressable, StyleSheet, SafeAreaView, ActivityIndicator, Alert, ScrollView, Keyboard } from 'react-native';
import { auth, db, storage } from './firebaseConfig';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import 'react-native-get-random-values'; // Required for uuid
import { v4 as uuidv4 } from 'uuid';
import defaultProfilePhoto from './assets/default-profile-photo.png';

export default function EditProfileScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [isValid, setIsValid] = useState(true);
    const [feedback, setFeedback] = useState('');
    const scrollViewRef = useRef(null);

    // Form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [imageUri, setImageUri] = useState(null); // New image URI from picker
    const [existingPhotoURL, setExistingPhotoURL] = useState(null); // Existing photo URL from Firestore

    const userId = auth.currentUser?.uid;

    const handleBioChange = (text) => {
        // Check if this is a paste operation (text is longer than current bio + 1 char)
        const isPaste = text.length > bio.length + 1;
        
        if (isPaste) {
            // For paste operations, check both line and character limits
            const lines = text.split('\n');
            if (lines.length > 3 || text.length > 120) {
                return; // Reject the paste operation
            }
        }

        // For normal typing, use existing line limit check
        const lines = text.split('\n');
        if (lines.length <= 3) {
            setBio(text);
        }
    };

    // Fetch user data on mount
    useEffect(() => {
        if (!userId) {
            navigation.goBack();
            return;
        }

        const fetchUserData = async () => {
            const userDocRef = doc(db, 'users', userId);
            try {
                const docSnap = await getDoc(userDocRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setFirstName(data.firstName || '');
                    setLastName(data.lastName || '');
                    setUsername(data.username || '');
                    setBio(data.bio || '');
                    setExistingPhotoURL(data.photoURL || null);
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                Alert.alert("Error", "Could not load your profile data.");
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [userId, navigation]);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => {
                setIsKeyboardVisible(true);
                // Small delay to ensure layout has updated with new padding
                setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
            }
        );

        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => {
                // Scroll to top first, then remove padding
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                setTimeout(() => {
                    setIsKeyboardVisible(false);
                }, 300);
            }
        );

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

    // Add username validation effect
    useEffect(() => {
        const handler = setTimeout(async () => {
            const formattedUsername = username.toLowerCase().trim();
            
            // Show minimum character message if empty
            if (!formattedUsername) {
                setFeedback('Username must be at least 4 characters.');
                setIsValid(false);
                return;
            }
            
            // Check for valid characters
            const validUsernameRegex = /^[a-z0-9._]+$/;
            if (!validUsernameRegex.test(formattedUsername)) {
                setFeedback('Username can only contain letters, numbers, periods, and underscores.');
                setIsValid(false);
                return;
            }

            if (formattedUsername.length > 3) {
                setIsChecking(true);
                setFeedback('');
                try {
                    const usersRef = collection(db, 'users');
                    const q = query(usersRef, where('username', '==', formattedUsername));
                    const querySnapshot = await getDocs(q);
                    
                    // Check if username exists and is not the current user's username
                    const usernameExists = !querySnapshot.empty && 
                        querySnapshot.docs[0].id !== userId;
                    
                    if (!usernameExists) {
                        setFeedback('');
                        setIsValid(true);
                    } else {
                        setFeedback('Username is already taken.');
                        setIsValid(false);
                    }
                } catch (error) {
                    setFeedback('Error checking username.');
                    setIsValid(false);
                } finally {
                    setIsChecking(false);
                }
            } else {
                setFeedback('Username must be at least 4 characters.');
                setIsValid(false);
            }
        }, 500); // 500ms debounce delay

        return () => {
            clearTimeout(handler);
        };
    }, [username, userId]);

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri) => {
        const response = await fetch(uri);
        const blob = await response.blob();
        const storageRef = ref(storage, `profile-photos/${userId}/${uuidv4()}`);
        await uploadBytes(storageRef, blob);
        return await getDownloadURL(storageRef);
    };

    const handleSave = useCallback(async () => {
        if (!userId) return;

        // Basic validation
        if (!firstName.trim() || !lastName.trim() || !username.trim()) {
            Alert.alert("Hold on!", "First name, last name, and username are required.");
            return;
        }

        if (!isValid) {
            Alert.alert("Invalid Username", feedback);
            return;
        }

        setSaving(true);
        try {
            let newPhotoURL = existingPhotoURL;
            if (imageUri) {
                newPhotoURL = await uploadImage(imageUri);
            }

            const displayName = `${firstName.trim()} ${lastName.trim()}`;
            
            // 1. Update Firestore document
            const userDocRef = doc(db, 'users', userId);
            const updatedData = {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                username: username.trim().toLowerCase(),
                displayName,
                bio: bio.trim(),
                photoURL: newPhotoURL,
            };
            await updateDoc(userDocRef, updatedData);

            // 2. Update Firebase Auth profile
            await updateProfile(auth.currentUser, {
                displayName,
                photoURL: newPhotoURL
            });
            
            navigation.goBack();

        } catch (error) {
            console.error("Error updating profile:", error);
            Alert.alert("Error", "Could not save your profile. Please try again.");
        } finally {
            setSaving(false);
        }
    }, [userId, firstName, lastName, username, bio, imageUri, existingPhotoURL, navigation, isValid, feedback]);

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#8BA637" />
            </SafeAreaView>
        );
    }
    
    const displayImageSource = imageUri ? { uri: imageUri } : (existingPhotoURL ? { uri: existingPhotoURL } : defaultProfilePhoto);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} disabled={saving}>
                    <Text style={styles.headerButton}>Cancel</Text>
                </Pressable>
                <Text style={styles.headerTitle}>Edit profile</Text>
                {saving ? (
                    <ActivityIndicator color="#8BA637" />
                ) : (
                    <Pressable onPress={handleSave}>
                        <Text style={[styles.headerButton, styles.headerButtonPrimary]}>Save</Text>
                    </Pressable>
                )}
            </View>

            <ScrollView 
                ref={scrollViewRef}
                contentContainerStyle={[
                    styles.container, 
                    isKeyboardVisible && { paddingBottom: 320 }
                ]}
                keyboardDismissMode="on-drag"
            >
                <View style={styles.profilePicSection}>
                    <Image
                        source={displayImageSource}
                        style={styles.profileImage}
                    />
                    <Pressable onPress={handlePickImage} disabled={saving}>
                        <Text style={styles.changePhotoText}>Change photo</Text>
                    </Pressable>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>First Name</Text>
                        <TextInput
                            style={styles.input}
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="Enter your first name"
                            editable={!saving}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Last Name</Text>
                        <TextInput
                            style={styles.input}
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="Enter your last name"
                            editable={!saving}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Username</Text>
                        <View style={styles.usernameContainer}>
                            <Text style={styles.atSymbol}>@</Text>
                            <TextInput
                                style={styles.usernameInput}
                                value={username}
                                onChangeText={setUsername}
                                placeholder="Choose a username"
                                autoCapitalize="none"
                                editable={!saving}
                            />
                        </View>
                        <View style={styles.feedbackContainer}>
                            {isChecking ? (
                                <ActivityIndicator size="small" color="#8BA637" />
                            ) : (
                                <Text style={[styles.feedbackText, { color: isValid ? '#8BA637' : '#FF6B6B' }]}>
                                    {feedback}
                                </Text>
                            )}
                        </View>
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Bio</Text>
                        <TextInput
                            style={[styles.input, styles.bioInput]}
                            value={bio}
                            onChangeText={handleBioChange}
                            placeholder="Tell us about yourself"
                            multiline
                            numberOfLines={3}
                            scrollEnabled={false}
                            maxLength={120}
                            editable={!saving}
                        />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTitle: {
        fontFamily: 'PatrickHand-Regular',
        fontSize: 20,
        color: '#53544D',
    },
    headerButton: {
        fontFamily: 'PatrickHand-Regular',
        fontSize: 18,
        color: '#53544D',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 5,
    },
    headerButtonPrimary: {
        color: '#8BA637',
        fontWeight: 'bold',
    },
    container: {
        padding: 20,
    },
    profilePicSection: {
        alignItems: 'center',
        marginBottom: 30,
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#e6e6e6',
        marginBottom: 12,
        borderWidth: 0.5,
        borderColor: '#b9b9b9',
    },
    changePhotoText: {
        fontFamily: 'PatrickHand-Regular',
        fontSize: 18,
        color: '#8BA637',
    },
    form: {},
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontFamily: 'PatrickHand-Regular',
        fontSize: 16,
        color: '#b9b9b9',
        marginBottom: 8,
    },
    input: {
        fontFamily: 'PatrickHand-Regular',
        fontSize: 18,
        color: '#53544D',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        paddingVertical: 8,
    },
    bioInput: {
        textAlignVertical: 'top',
    },
    usernameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    atSymbol: {
        fontFamily: 'PatrickHand-Regular',
        fontSize: 18,
        color: '#53544D',
        marginRight: 4,
    },
    usernameInput: {
        fontFamily: 'PatrickHand-Regular',
        fontSize: 18,
        color: '#53544D',
        flex: 1,
        paddingVertical: 8,
    },
    feedbackContainer: {
        minHeight: 15,
        marginTop: 2,
    },
    feedbackText: {
        fontFamily: 'PatrickHand-Regular',
        fontSize: 14,
    },
});