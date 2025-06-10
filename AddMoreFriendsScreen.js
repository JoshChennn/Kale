import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  SectionList,
  Image,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import * as SMS from 'expo-sms';
import { auth, db } from './firebaseConfig'; // Assuming this provides a v8 compatible db object
import defaultProfilePhoto from './assets/default-profile-photo.png';

// Single personalized invite message
const getInviteMessage = (firstName) => 
  `${firstName} requested to follow you on Kale. Accept it: [Your App Link Here]`;

export default function AddMoreFriendsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [followedOrInvited, setFollowedOrInvited] = useState(new Set());
  const [waitingContacts, setWaitingContacts] = useState(new Set());
  const [userFirstName, setUserFirstName] = useState('');
  const currentUser = auth.currentUser;
  const [ellipsisState, setEllipsisState] = useState(0);

  // Animation for ellipsis
  useEffect(() => {
    let interval;
    
    if (waitingContacts.size > 0) {
      interval = setInterval(() => {
        setEllipsisState(prev => (prev + 1) % 4);
      }, 500);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [waitingContacts]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) return;
      
      const userDoc = await db.collection('users').doc(currentUser.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        setUserFirstName(userData?.firstName || '');
      }
    };
    
    fetchUserData();
  }, [currentUser]);

  // Main effect to fetch contacts and sync with Firestore
  useEffect(() => {
    const fetchContactsAndUsers = async () => {
      if (!currentUser) return;
      setLoading(true);

      const { status } = await Contacts.getPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        Alert.alert("Permissions needed", "Please enable contact permissions in your phone's settings to find friends.", [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
        return;
      }

      // Fetch all necessary data from Firestore and device
      const followingSnapshot = await db.collection('following').doc(currentUser.uid).collection('userFollowing').get();
      const followedUserIdsSet = new Set(followingSnapshot.docs.map(doc => doc.id));
      
      const invitesSnapshot = await db.collection('users').doc(currentUser.uid).collection('onboardingInvites').get();
      const invitedContactIds = invitesSnapshot.docs.map(doc => doc.id);

      const initialFollowedOrInvited = new Set([...followedUserIdsSet, ...invitedContactIds]);
      setFollowedOrInvited(initialFollowedOrInvited);

      const usersSnapshot = await db.collection('users').get();
      const allKaleUsers = {};
      
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data && data.phoneNumber) {
            const key = data.phoneNumber.replace(/\D/g, '').slice(-10);
            allKaleUsers[key] = {
              uid: doc.id,
              phoneNumber: data.phoneNumber,
              displayName: data.displayName,
              username: data.username,
              photoURL: data.photoURL,
              firstName: data.firstName,
            };
        }
      });
      
      const { data: contacts } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });

      if (contacts.length === 0) {
        setLoading(false);
        return;
      }

      const kaleUsers = [];
      const nonKaleContacts = [];
      const processedNumbers = new Set();
      const followBatch = db.batch();
      const uidsToFollow = new Set();

      contacts.forEach(contact => {
        if (!contact.name || !contact.phoneNumbers || contact.phoneNumbers.length === 0 || !contact.id) return;

        const mainPhoneNumber = contact.phoneNumbers[0].number;
        if (!mainPhoneNumber) return;
        
        const key = mainPhoneNumber.replace(/\D/g, '').slice(-10);
        if (processedNumbers.has(key) || key.length < 10) return;

        const matchedUser = allKaleUsers[key];
        
        if (matchedUser && matchedUser.uid !== currentUser.uid) {
          // If we are already following this user, do not show them in the list.
          if (followedUserIdsSet.has(matchedUser.uid)) {
            return;
          }

          // Auto-follow previously invited users who've since joined, and don't show them.
          if (initialFollowedOrInvited.has(contact.id)) {
            const followingRef = db.collection('following').doc(currentUser.uid).collection('userFollowing').doc(matchedUser.uid);
            const followerRef = db.collection('followers').doc(matchedUser.uid).collection('userFollowers').doc(currentUser.uid);
            followBatch.set(followingRef, {});
            followBatch.set(followerRef, {});
            uidsToFollow.add(matchedUser.uid);

            const inviteRef = db.collection('users').doc(currentUser.uid).collection('onboardingInvites').doc(contact.id);
            followBatch.delete(inviteRef);

            return; // Don't add to list, just sync in background
          }

          // If not followed and not a pending invite-to-follow conversion, show them.
          kaleUsers.push({
            ...matchedUser,
            originalContactName: contact.name,
            originalPhoneNumber: mainPhoneNumber,
          });
        } else {
          nonKaleContacts.push({
            id: contact.id,
            name: contact.name,
            phoneNumber: mainPhoneNumber,
          });
        }
        processedNumbers.add(key);
      });

      if (uidsToFollow.size > 0) {
        try {
          await followBatch.commit();
          setFollowedOrInvited(prev => {
            const newSet = new Set(prev);
            uidsToFollow.forEach(uid => newSet.add(uid));
            return newSet;
          });
        } catch (error) {
          console.error("Error committing automatic follows: ", error);
        }
      }

      kaleUsers.sort((a, b) => (a.displayName || a.originalContactName).localeCompare(b.displayName || b.originalContactName));
      nonKaleContacts.sort((a, b) => a.name.localeCompare(b.name));

      const newSections = [];
      if (kaleUsers.length > 0) {
        newSections.push({ title: 'On Kale', data: kaleUsers });
      }
      if (nonKaleContacts.length > 0) {
        newSections.push({ title: 'Invite to Kale', data: nonKaleContacts });
      }
      setSections(newSections);
      setLoading(false);
    };

    fetchContactsAndUsers();
  }, [currentUser]);

  const handleFollow = async (userToFollow) => {
    if (followedOrInvited.has(userToFollow.uid) || !currentUser) return;

    const batch = db.batch();
    const followingRef = db.collection('following').doc(currentUser.uid)
      .collection('userFollowing').doc(userToFollow.uid);
    batch.set(followingRef, {});

    const followerRef = db.collection('followers').doc(userToFollow.uid)
      .collection('userFollowers').doc(currentUser.uid);
    batch.set(followerRef, {});
      
    try {
      setFollowedOrInvited(prev => new Set(prev).add(userToFollow.uid));
      await batch.commit();
    } catch (error) {
      console.error("Error following user: ", error);
      setFollowedOrInvited(prev => {
        const newSet = new Set(prev);
        newSet.delete(userToFollow.uid);
        return newSet;
      });
      Alert.alert('Error', 'Could not follow user. Please try again.');
    }
  };

  const handleInvite = async (contactToInvite) => {
    if (followedOrInvited.has(contactToInvite.id) || !currentUser || waitingContacts.has(contactToInvite.id)) return;

    setWaitingContacts(prev => new Set(prev).add(contactToInvite.id));
    
    const inviteMessage = getInviteMessage(userFirstName);
    const isAvailable = await SMS.isAvailableAsync();
    
    if (isAvailable) {
        try {
            const { result } = await SMS.sendSMSAsync(
                [contactToInvite.phoneNumber],
                inviteMessage
            );

            if(result === 'sent' || result === 'unknown') {
                setFollowedOrInvited(prev => new Set(prev).add(contactToInvite.id));
                await db.collection('users').doc(currentUser.uid)
                    .collection('onboardingInvites').doc(contactToInvite.id)
                    .set({ invitedAt: new Date() });
            }
        } catch (error) {
            console.error("Error sending or saving invite:", error);
            Alert.alert('Error', 'Could not save your invite. Please try again.');
        }
    } else {
      Alert.alert('SMS Not Available', 'Could not open the SMS app on your device.');
    }
    
    setWaitingContacts(prev => {
      const newSet = new Set(prev);
      newSet.delete(contactToInvite.id);
      return newSet;
    });
  };

  const handleUnfollow = async (userToUnfollow) => {
    if (!currentUser) return;

    const batch = db.batch();
    const followingRef = db.collection('following').doc(currentUser.uid)
      .collection('userFollowing').doc(userToUnfollow.uid);
    batch.delete(followingRef);
    const followerRef = db.collection('followers').doc(userToUnfollow.uid)
      .collection('userFollowers').doc(currentUser.uid);
    batch.delete(followerRef);
      
    try {
      setFollowedOrInvited(prev => {
        const newSet = new Set(prev);
        newSet.delete(userToUnfollow.uid);
        return newSet;
      });
      await batch.commit();
    } catch (error) {
      console.error("Error unfollowing user: ", error);
      setFollowedOrInvited(prev => new Set(prev).add(userToUnfollow.uid));
      Alert.alert('Error', 'Could not unfollow user. Please try again.');
    }
  };
  
  const renderItem = ({ item, section }) => {
    const isKaleUser = section.title === 'On Kale';
    const kaleItem = item;
    
    const id = isKaleUser ? kaleItem.uid : item.id;
    const isDone = followedOrInvited.has(id);
    const isWaiting = waitingContacts.has(id);
    
    const displayName = isKaleUser ? (kaleItem.displayName || kaleItem.username || kaleItem.originalContactName) : item.name;
    const detailText = isKaleUser ? (kaleItem.username ? `@${kaleItem.username}` : kaleItem.originalPhoneNumber) : item.phoneNumber;

    let buttonText = isKaleUser
      ? (isDone ? 'Following' : 'Follow')
      : (isDone ? 'Requested' : 'Invite + Follow');

    if (isWaiting) {
      const dots = '.'.repeat(ellipsisState);
      buttonText = `Waiting${dots}`;
    }

    return (
      <View style={styles.contactRow}>
        {isKaleUser && (
          <Image 
            source={kaleItem.photoURL ? { uri: kaleItem.photoURL } : defaultProfilePhoto} 
            style={styles.profileImage} 
          />
        )}

        <View style={styles.contactInfo}>
            <Text style={styles.contactName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.contactDetail} numberOfLines={1}>{detailText}</Text>
        </View>

        <Pressable
            onPress={() => isKaleUser ? (isDone ? handleUnfollow(item) : handleFollow(item)) : handleInvite(item)}
            style={[
                styles.actionButton, 
                isDone && styles.actionButtonDone,
                isWaiting && styles.actionButtonWaiting
            ]}
            disabled={isWaiting}
        >
            <Text style={[
                styles.actionButtonText, 
                isDone && styles.actionButtonTextDone,
                isWaiting && styles.actionButtonTextWaiting
            ]}>
                {buttonText}
            </Text>
        </Pressable>
      </View>
    );
  };

  if (loading) {
      return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#8BA637" />
        </View>
      );
  }

  return (
    <View style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.title}>
              The more friends you have on Kale, the less you'll want to check Instagram.
            </Text>
            <Text style={styles.emoji}>🚭🥬</Text>
        </View>

        <SectionList
            sections={sections}
            keyExtractor={(item) => item.uid || item.id}
            renderItem={renderItem}
            renderSectionHeader={({ section: { title } }) => (
                <Text style={styles.sectionHeader}>{title}</Text>
            )}
            contentContainerStyle={{ paddingHorizontal: 20 }}
            ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No new contacts found.</Text>
                    <Text style={styles.emptySubText}>Looks like you're all caught up!</Text>
                </View>
            )}
        />
        
        <View style={styles.bottomContainer}>
            <Pressable
                onPress={() => navigation.goBack()}
                style={({ pressed }) => [
                    styles.doneButton,
                    pressed && { opacity: 0.8 },
                ]}
            >
                <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F2',
        justifyContent: 'center',
    },
    header: {
        paddingTop: 80,
        paddingBottom: 20,
        paddingHorizontal: 60,
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontFamily: 'PatrickHand-Regular',
        color: '#8BA637',
        textAlign: 'center',
        lineHeight: 34,
    },
    emoji: {
      fontSize: 48,
      marginTop: 10,
    },
    sectionHeader: {
        fontSize: 20,
        fontFamily: 'PatrickHand-Regular',
        color: '#8BA637',
        backgroundColor: '#F2F2F2',
        paddingTop: 20,
        paddingBottom: 10,
    },
    contactRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E9E9E9',
    },
    profileImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
        backgroundColor: '#E9E9E9',
    },
    contactInfo: {
        flex: 1,
        marginRight: 10,
        justifyContent: 'center',
    },
    contactName: {
        fontSize: 20,
        fontFamily: 'PatrickHand-Regular',
        color: '#333',
    },
    contactDetail: {
        fontSize: 16,
        fontFamily: 'PatrickHand-Regular',
        color: '#888',
    },
    actionButton: {
        backgroundColor: '#8BA637',
        borderRadius: 5,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minWidth: 120,
        alignItems: 'center'
    },
    actionButtonDone: {
        backgroundColor: '#e6e6e6',
    },
    actionButtonText: {
        color: '#F2F2F2',
        fontSize: 16,
        fontFamily: 'PatrickHand-Regular',
    },
    actionButtonTextDone: {
        color: '#53544D',
    },
    actionButtonWaiting: {
        backgroundColor: '#e6e6e6',
    },
    actionButtonTextWaiting: {
        color: '#53544D',
    },
    bottomContainer: {
        padding: 40,
        paddingTop: 20,
    },
    doneButton: {
        backgroundColor: '#8BA637',
        borderRadius: 25,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    doneButtonText: {
        color: '#F2F2F2',
        fontSize: 20,
        fontFamily: 'PatrickHand-Regular',
    },
    emptyContainer: {
        marginTop: 50,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    emptyText: {
        fontSize: 24,
        fontFamily: 'PatrickHand-Regular',
        color: '#8BA637',
        textAlign: 'center',
    },
    emptySubText: {
        fontSize: 18,
        fontFamily: 'PatrickHand-Regular',
        color: '#B9B9B9',
        textAlign: 'center',
        marginTop: 10,
    },
});