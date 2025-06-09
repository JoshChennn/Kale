import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  SectionList,
  Animated,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import * as Contacts from 'expo-contacts';
import * as SMS from 'expo-sms';
import { auth, db } from './firebaseConfig';
import { User as FirebaseUser } from 'firebase/auth';

// Param list for the OnboardingStack to match App.tsx
type OnboardingStackParamList = {
  OnboardingIntro: undefined;
  ConnectContacts: undefined;
  CreateProfileFirstName: undefined;
  CreateProfileLastName: undefined;
  CreateProfileUsername: undefined;
  CreateProfilePhoto: undefined;
  AddFriends: undefined; // This screen
};

// Props for this screen, including the function to complete onboarding
type Props = StackScreenProps<OnboardingStackParamList, 'AddFriends'> & {
  onOnboardingComplete: () => void;
};

// Types for our contact and user data
interface KaleUser {
  uid: string;
  displayName: string;
  username: string;
  photoURL: string;
  phoneNumber: string;
}

interface NonKaleContact {
  id: string;
  name: string;
  phoneNumber: string;
}

const MINIMUM_FOLLOW_INVITE = 7;

// Single personalized invite message
const getInviteMessage = (firstName: string) => 
  `${firstName} requested to follow you on Kale. Accept it: [Your App Link Here]`;

export default function AddFriendsScreen({ onOnboardingComplete }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [sections, setSections] = React.useState<any[]>([]);
  const [followedOrInvited, setFollowedOrInvited] = React.useState(new Set());
  const [waitingContacts, setWaitingContacts] = React.useState(new Set());
  const [userFirstName, setUserFirstName] = React.useState('');
  const currentUser = auth.currentUser as FirebaseUser;
  const [ellipsisState, setEllipsisState] = React.useState(0);

  // Animation for ellipsis
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    
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

  React.useEffect(() => {
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

  React.useEffect(() => {
    const fetchContactsAndUsers = async () => {
      if (!currentUser) return;

      const { status } = await Contacts.getPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        // If no permissions, the screen will show an empty state guiding the user.
        return;
      }

      const { data: contacts } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });

      if (contacts.length === 0) {
        setLoading(false);
        return;
      }

      // This is a simplified, inefficient way to match contacts for demonstration.
      // A production app should use a more robust, scalable solution like a cloud function.
      const usersSnapshot = await db.collection('users').get();
      const allKaleUsers: { [key: string]: KaleUser } = {};
      usersSnapshot.forEach(doc => {
        const userData = doc.data() as KaleUser;
        // Simple normalization: just keep digits.
        if (userData.phoneNumber) {
            // Use a simple key of the last 10 digits to avoid country code issues
            const key = userData.phoneNumber.replace(/\D/g, '').slice(-10);
            allKaleUsers[key] = userData;
        }
      });
      
      const kaleUsers: KaleUser[] = [];
      const nonKaleContacts: NonKaleContact[] = [];
      const processedNumbers = new Set<string>();

      contacts.forEach(contact => {
        if (!contact.name || !contact.phoneNumbers || contact.phoneNumbers.length === 0 || !contact.id) return;

        const mainPhoneNumber = contact.phoneNumbers[0].number;
        if (!mainPhoneNumber) return;
        
        const key = mainPhoneNumber.replace(/\D/g, '').slice(-10);
        if (processedNumbers.has(key) || key.length < 10) return;

        const matchedUser = allKaleUsers[key];
        
        if (matchedUser && matchedUser.uid !== currentUser.uid) {
          kaleUsers.push(matchedUser);
        } else {
          nonKaleContacts.push({
            id: contact.id,
            name: contact.name,
            phoneNumber: mainPhoneNumber,
          });
        }
        processedNumbers.add(key);
      });

      // Sort users and contacts alphabetically
      kaleUsers.sort((a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username));
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

  const handleFollow = async (userToFollow: KaleUser) => {
    // Prevent multiple clicks or following if the user is not logged in.
    if (followedOrInvited.has(userToFollow.uid) || !currentUser) {
      return;
    }

    // A batch write ensures that both database operations (creating the 'following'
    // and 'follower' records) succeed or fail together. This keeps the data consistent.
    const batch = db.batch();

    // 1. Add `userToFollow` to the current user's "following" list.
    const followingRef = db.collection('following').doc(currentUser.uid)
      .collection('userFollowing').doc(userToFollow.uid);
    batch.set(followingRef, {});

    // 2. Add the current user to `userToFollow`'s "followers" list.
    // This is the missing piece that completes the relationship.
    const followerRef = db.collection('followers').doc(userToFollow.uid)
      .collection('userFollowers').doc(currentUser.uid);
    batch.set(followerRef, {});
      
    try {
      // Optimistically update the UI first for a responsive user experience.
      // The button will immediately change to "Following".
      setFollowedOrInvited(prev => new Set(prev).add(userToFollow.uid));
      
      // Commit the batch write to Firestore.
      await batch.commit();

    } catch (error) {
      console.error("Error following user: ", error);
      
      // If the database write fails, revert the UI change.
      setFollowedOrInvited(prev => {
        const newSet = new Set(prev);
        newSet.delete(userToFollow.uid);
        return newSet;
      });

      // Inform the user that the action failed.
      Alert.alert('Error', 'Could not follow user. Please try again.');
    }
  };

  const handleInvite = async (contactToInvite: NonKaleContact) => {
    if (followedOrInvited.has(contactToInvite.id)) return;
    
    // Toggle waiting state
    if (waitingContacts.has(contactToInvite.id)) {
      setWaitingContacts(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactToInvite.id);
        return newSet;
      });
      return;
    }

    setWaitingContacts(prev => new Set(prev).add(contactToInvite.id));
    
    const inviteMessage = getInviteMessage(userFirstName);

    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) {
        const { result } = await SMS.sendSMSAsync(
            [contactToInvite.phoneNumber],
            inviteMessage
        );
        if(result === 'sent' || result === 'unknown') {
            setFollowedOrInvited(prev => new Set(prev).add(contactToInvite.id));
        }
    } else {
      Alert.alert('SMS Not Available', 'Could not open the SMS app on your device.');
    }
    
    // Remove from waiting state after SMS is sent
    setWaitingContacts(prev => {
      const newSet = new Set(prev);
      newSet.delete(contactToInvite.id);
      return newSet;
    });
  };
  
  const count = followedOrInvited.size;
  const canContinue = count >= MINIMUM_FOLLOW_INVITE;

  const renderItem = ({ item, section }: { item: any; section: { title: string } }) => {
    const isKaleUser = section.title === 'On Kale';
    const id = isKaleUser ? item.uid : item.id;
    const isDone = followedOrInvited.has(id);
    const isWaiting = waitingContacts.has(id);
    
    let buttonText = isKaleUser
      ? (isDone ? 'Following' : 'Follow')
      : (isDone ? 'Requested' : 'Invite + Follow');

    if (isWaiting) {
      const dots = '.'.repeat(ellipsisState);
      buttonText = `Waiting${dots}`;
    }

    return (
      <View style={styles.contactRow}>
        <View style={styles.contactInfo}>
            <Text style={styles.contactName} numberOfLines={1}>{isKaleUser ? item.displayName || item.username : item.name}</Text>
            <Text style={styles.contactDetail} numberOfLines={1}>{isKaleUser ? `@${item.username}` : item.phoneNumber}</Text>
        </View>
        <Pressable
            onPress={() => isKaleUser ? handleFollow(item) : handleInvite(item)}
            style={[
                styles.actionButton, 
                isDone && styles.actionButtonDone,
                isWaiting && styles.actionButtonWaiting
            ]}
            disabled={isDone}
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
            <Text style={styles.title}>Follow at least {MINIMUM_FOLLOW_INVITE} friends to get started.</Text>
            <Text style={styles.counter}>🥬 {count}/{MINIMUM_FOLLOW_INVITE}</Text>
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
                    <Text style={styles.emptyText}>No contacts found.</Text>
                    <Text style={styles.emptySubText}>Please enable contact permissions in your phone's settings to find friends.</Text>
                </View>
            )}
        />
        
        <View style={styles.bottomContainer}>
            <Pressable
                onPress={onOnboardingComplete}
                disabled={!canContinue}
                style={({ pressed }) => [
                    styles.doneButton,
                    pressed && { opacity: 0.8 },
                    !canContinue && { backgroundColor: '#B9B9B9' },
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
        fontSize: 32,
        fontFamily: 'PatrickHand-Regular',
        color: '#8BA637',
        textAlign: 'center',
        lineHeight: 38,
    },
    counter: {
        fontSize: 60,
        fontFamily: 'PatrickHand-Regular',
        color: '#4F6A56',
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
    contactInfo: {
        flex: 1,
        marginRight: 10,
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
        paddingHorizontal: 20,
        paddingVertical: 8,
        minWidth: 90,
        alignItems: 'center'
    },
    actionButtonDone: {
        backgroundColor: '#e6e6e6',
    },
    actionButtonText: {
        color: '#F2F2F2',
        fontSize: 18,
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