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
import { auth, db, functions } from './firebaseConfig'; // Make sure functions is exported
import { httpsCallable } from 'firebase/functions';
import defaultProfilePhoto from './assets/default-profile-photo.png';

// Single personalized invite message
const getInviteMessage = (firstName) => 
  `${firstName} requested to follow you on Kale. Accept it: [Your App Link Here]`;

// Define cloud functions for user actions
const requestToFollowUser = httpsCallable(functions, 'requestToFollowUser');
const withdrawFollowRequest = httpsCallable(functions, 'withdrawFollowRequest');
const unfollowUser = httpsCallable(functions, 'unfollowUser');

export default function AddMoreFriendsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);

  // Refactored state to be more specific
  const [followingUids, setFollowingUids] = useState(new Set());
  const [requestedUids, setRequestedUids] = useState(new Set());
  const [invitedContactIds, setInvitedContactIds] = useState(new Set());
  
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
      if (interval) clearInterval(interval);
    };
  }, [waitingContacts]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) return;
      
      const userDoc = await db.collection('users').doc(currentUser.uid).get();
      if (userDoc.exists) {
        setUserFirstName(userDoc.data()?.firstName || '');
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
        Alert.alert("Permissions needed", "Please enable contact permissions to find friends.", [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
        return;
      }

      // Fetch all necessary data from Firestore and device
      const followingSnapshot = await db.collection('following').doc(currentUser.uid).collection('userFollowing').get();
      const followedUserIdsSet = new Set(followingSnapshot.docs.map(doc => doc.id));
      setFollowingUids(followedUserIdsSet);
      
      const invitesSnapshot = await db.collection('users').doc(currentUser.uid).collection('onboardingInvites').get();
      const initialInvitedContactIds = new Set(invitesSnapshot.docs.map(doc => doc.id));
      setInvitedContactIds(initialInvitedContactIds);

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

      // Get current user's phone number for comparison
      const currentUserDoc = await db.collection('users').doc(currentUser.uid).get();
      const currentUserData = currentUserDoc.data();
      const currentUserPhoneNumber = currentUserData?.phoneNumber ? 
        currentUserData.phoneNumber.replace(/\D/g, '').slice(-10) : null;

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

        // Skip if this is the current user's phone number
        if (currentUserPhoneNumber && key === currentUserPhoneNumber) return;

        const matchedUser = allKaleUsers[key];
        
        if (matchedUser && matchedUser.uid !== currentUser.uid) {
          if (followedUserIdsSet.has(matchedUser.uid)) {
            return; // Already following, don't show
          }

          if (initialInvitedContactIds.has(contact.id)) {
            // This person was invited and has since joined. Auto-follow them.
            const followingRef = db.collection('following').doc(currentUser.uid).collection('userFollowing').doc(matchedUser.uid);
            const followerRef = db.collection('followers').doc(matchedUser.uid).collection('userFollowers').doc(currentUser.uid);
            followBatch.set(followingRef, {});
            followBatch.set(followerRef, {});
            uidsToFollow.add(matchedUser.uid);

            const inviteRef = db.collection('users').doc(currentUser.uid).collection('onboardingInvites').doc(contact.id);
            followBatch.delete(inviteRef);
            return; // Don't add to list, just sync in background
          }
          
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
          setFollowingUids(prev => new Set([...prev, ...uidsToFollow]));
        } catch (error) {
          console.error("Error committing automatic follows: ", error);
        }
      }

      // Check for existing follow requests for the users we are about to display
      if (kaleUsers.length > 0) {
          const requestChecks = kaleUsers.map(user => 
              db.collection('users').doc(user.uid).collection('followRequests').doc(currentUser.uid).get()
          );
          try {
              const requestSnapshots = await Promise.all(requestChecks);
              const pendingRequestUids = new Set();
              requestSnapshots.forEach((snap, index) => {
                  if (snap.exists) {
                      pendingRequestUids.add(kaleUsers[index].uid);
                  }
              });
              setRequestedUids(pendingRequestUids);
          } catch (error) {
              console.error("Error checking for pending follow requests:", error);
          }
      }

      kaleUsers.sort((a, b) => (a.displayName || a.originalContactName).localeCompare(b.displayName || b.originalContactName));
      nonKaleContacts.sort((a, b) => a.name.localeCompare(b.name));

      const newSections = [];
      if (kaleUsers.length > 0) newSections.push({ title: 'Already On Kale', data: kaleUsers });
      if (nonKaleContacts.length > 0) newSections.push({ title: 'Not On Kale Yet', data: nonKaleContacts });
      
      setSections(newSections);
      setLoading(false);
    };

    fetchContactsAndUsers();
  }, [currentUser]);

  const handleRequestFollow = async (userToRequest) => {
    if (!currentUser || requestedUids.has(userToRequest.uid)) return;

    setRequestedUids(prev => new Set(prev).add(userToRequest.uid)); // Optimistic update
    try {
      await requestToFollowUser({ userIdToFollow: userToRequest.uid });
    } catch (error) {
      console.error("Error sending follow request: ", error);
      setRequestedUids(prev => {
        const newSet = new Set(prev);
        newSet.delete(userToRequest.uid);
        return newSet;
      });
      Alert.alert('Error', 'Could not send follow request. Please try again.');
    }
  };

  const handleWithdrawRequest = async (userToWithdrawFrom) => {
    if (!currentUser || !requestedUids.has(userToWithdrawFrom.uid)) return;

    setRequestedUids(prev => { // Optimistic update
        const newSet = new Set(prev);
        newSet.delete(userToWithdrawFrom.uid);
        return newSet;
    });
    try {
      await withdrawFollowRequest({ userIdToWithdrawFrom: userToWithdrawFrom.uid });
    } catch (error) {
      console.error("Error withdrawing follow request: ", error);
      setRequestedUids(prev => new Set(prev).add(userToWithdrawFrom.uid));
      Alert.alert('Error', 'Could not withdraw request. Please try again.');
    }
  };

  const handleUnfollow = async (userToUnfollow) => {
    if (!currentUser || !followingUids.has(userToUnfollow.uid)) return;

    Alert.alert(
      `Unfollow @${userToUnfollow.username || 'user'}?`,
      "You will need to request to follow them again to see their posts.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Unfollow", 
          style: "destructive", 
          onPress: async () => {
            setFollowingUids(prev => { // Optimistic update
              const newSet = new Set(prev);
              newSet.delete(userToUnfollow.uid);
              return newSet;
            });
            try {
              await unfollowUser({ userIdToUnfollow: userToUnfollow.uid });
            } catch (error) {
              console.error("Error unfollowing user: ", error);
              setFollowingUids(prev => new Set(prev).add(userToUnfollow.uid));
              Alert.alert('Error', 'Could not unfollow user. Please try again.');
            }
          }
        }
      ]
    );
  };
  
  const handleInvite = async (contactToInvite) => {
    if (invitedContactIds.has(contactToInvite.id) || !currentUser || waitingContacts.has(contactToInvite.id)) return;

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
                setInvitedContactIds(prev => new Set(prev).add(contactToInvite.id));
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

  const renderItem = ({ item, section }) => {
    const isKaleUser = section.title === 'Already On Kale';
    const id = isKaleUser ? item.uid : item.id;
    const isWaitingForSms = waitingContacts.has(id);
    
    const displayName = isKaleUser ? (item.displayName || item.username || item.originalContactName) : item.name;
    const detailText = isKaleUser ? (item.username ? `@${item.username}` : item.originalPhoneNumber) : item.phoneNumber;
    
    let buttonText, onPressAction, isDone, isDisabled = false;

    if (isKaleUser) {
        const isFollowing = followingUids.has(id);
        const hasRequested = requestedUids.has(id);
        
        if (isFollowing) {
            buttonText = 'Following';
            onPressAction = () => handleUnfollow(item);
            isDone = true;
        } else if (hasRequested) {
            buttonText = 'Requested';
            onPressAction = () => handleWithdrawRequest(item);
            isDone = true;
        } else {
            buttonText = 'Follow';
            onPressAction = () => handleRequestFollow(item);
            isDone = false;
        }
    } else { // Non-Kale contact
        const isInvited = invitedContactIds.has(id);

        if (isWaitingForSms) {
            const dots = '.'.repeat(ellipsisState);
            buttonText = `Waiting${dots}`;
            onPressAction = () => {};
            isDisabled = true;
        } else if (isInvited) {
            buttonText = 'Requested';
            onPressAction = () => {};
            isDone = true;
            isDisabled = true; // Don't allow re-inviting from this screen
        } else {
            buttonText = 'Follow';
            onPressAction = () => handleInvite(item);
            isDone = false;
        }
    }

    return (
      <View style={styles.contactRow}>
        {isKaleUser && (
          <Image 
            source={item.photoURL ? { uri: item.photoURL } : defaultProfilePhoto} 
            style={styles.profileImage} 
          />
        )}

        <View style={styles.contactInfo}>
            <Text style={styles.contactName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.contactDetail} numberOfLines={1}>{detailText}</Text>
        </View>

        <Pressable
            onPress={onPressAction}
            style={[
                styles.actionButton, 
                isDone && styles.actionButtonDone,
                isWaitingForSms && styles.actionButtonWaiting
            ]}
            disabled={isDisabled || isWaitingForSms}
        >
            <Text style={[
                styles.actionButtonText, 
                isDone && styles.actionButtonTextDone,
                isWaitingForSms && styles.actionButtonTextWaiting
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
                style={({ pressed }) => [ styles.doneButton, pressed && { opacity: 0.8 } ]}
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
        alignItems: 'center',
        justifyContent: 'center',
        height: 38,
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