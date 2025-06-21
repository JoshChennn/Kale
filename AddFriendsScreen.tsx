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
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import * as Contacts from 'expo-contacts';
import * as SMS from 'expo-sms';
import { auth, db } from './firebaseConfig';
import { User as FirebaseUser } from 'firebase/auth';
import { MaterialIcons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';

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

// --- Updated Type Definitions ---

// Represents a user document from Firestore. Fields can be optional.
interface KaleUser {
  uid: string;
  phoneNumber: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
  firstName?: string;
}

// A richer object used for display, combining Firestore data with local contact info.
interface DisplayUser extends KaleUser {
  originalContactName: string;
  originalPhoneNumber: string;
}

// Represents a contact from the user's phone who is not on Kale.
interface NonKaleContact {
  id: string;
  name: string;
  phoneNumber: string;
}

const MINIMUM_FOLLOW_INVITE = 0;

// Single personalized invite message
const getInviteMessage = (firstName: string) => 
  `${firstName} requested to follow you on Kale. Accept it: [Your App Link Here]`;

// Add at the top, after type definitions:
type FollowRequest = {
  id: string;
  requesterName?: string;
  requesterAvatar?: string;
  requesterUsername?: string;
};

type FriendSection = {
  title: string;
  data: (DisplayUser | NonKaleContact)[];
};

type FollowRequestSection = {
  title: string;
  data: FollowRequest[];
  isFollowRequests: true;
};

type SectionType = FriendSection | FollowRequestSection;

export default function AddFriendsScreen({ onOnboardingComplete }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [sections, setSections] = React.useState<
    { title: string; data: (DisplayUser | NonKaleContact)[] }[]
  >([]);
  const [followedOrInvited, setFollowedOrInvited] = React.useState(new Set());
  const [waitingContacts, setWaitingContacts] = React.useState(new Set());
  const [userFirstName, setUserFirstName] = React.useState('');
  const currentUser = auth.currentUser as FirebaseUser;
  const [ellipsisState, setEllipsisState] = React.useState(0);
  const [isHelpModalVisible, setHelpModalVisible] = React.useState(false);
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const [followRequests, setFollowRequests] = React.useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = React.useState(true);
  const functions = require('./firebaseConfig').functions;
  const handleFollowRequest = httpsCallable(functions, 'handleFollowRequest');

  const showHelpModal = () => {
    setHelpModalVisible(true);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  };

  const hideHelpModal = () => {
    setHelpModalVisible(false);
    Animated.spring(scaleAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  };

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

  // Listen for follow requests
  React.useEffect(() => {
    if (!currentUser) return;
    setLoadingRequests(true);
    const unsubscribe = db
      .collection('users')
      .doc(currentUser.uid)
      .collection('followRequests')
      .onSnapshot((snapshot: any) => {
        const requests = snapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setFollowRequests(requests);
        setLoadingRequests(false);
      });
    return () => unsubscribe();
  }, [currentUser]);

  // Accept/Ignore handlers
  const onAcceptRequest = async (requesterId: string) => {
    setFollowRequests(prev => prev.filter(req => req.id !== requesterId));
    try {
      await handleFollowRequest({ requestingUserId: requesterId, action: 'accept' });
    } catch (error) {
      Alert.alert('Error', 'Could not accept request. Please try again.');
    }
  };
  const onIgnoreRequest = async (requesterId: string) => {
    setFollowRequests(prev => prev.filter(req => req.id !== requesterId));
    try {
      await handleFollowRequest({ requestingUserId: requesterId, action: 'ignore' });
    } catch (error) {
      Alert.alert('Error', 'Could not ignore request. Please try again.');
    }
  };

  // Main effect to fetch contacts, sync with Firestore, and handle automatic follows
  React.useEffect(() => {
    const fetchContactsAndUsers = async () => {
      if (!currentUser) return;
      setLoading(true);

      const { status } = await Contacts.getPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        return;
      }

      // 1. Fetch all necessary data from Firestore and device
      const followingSnapshot = await db.collection('following').doc(currentUser.uid).collection('userFollowing').get();
      const followedUserIds = followingSnapshot.docs.map(doc => doc.id);
      
      const invitesSnapshot = await db.collection('users').doc(currentUser.uid).collection('onboardingInvites').get();
      const invitedContactIds = invitesSnapshot.docs.map(doc => doc.id);

      const initialFollowedOrInvited = new Set([...followedUserIds, ...invitedContactIds]);
      setFollowedOrInvited(initialFollowedOrInvited);

      const usersSnapshot = await db.collection('users').get();
      const allKaleUsers: { [key: string]: KaleUser } = {};
      
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

      // 2. Process contacts, identify users on Kale, and detect invite-to-follow conversions
      const kaleUsers: DisplayUser[] = [];
      const nonKaleContacts: NonKaleContact[] = [];
      const processedNumbers = new Set<string>();
      const followBatch = db.batch();
      const uidsToFollow = new Set<string>();

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
          // This contact is a Kale user.
          kaleUsers.push({
            ...matchedUser,
            originalContactName: contact.name,
            originalPhoneNumber: mainPhoneNumber,
          });

          // AUTOMATIC FOLLOW: Check if this user was previously invited and has now joined.
          if (initialFollowedOrInvited.has(contact.id) && !initialFollowedOrInvited.has(matchedUser.uid)) {
            const followingRef = db.collection('following').doc(currentUser.uid).collection('userFollowing').doc(matchedUser.uid);
            const followerRef = db.collection('followers').doc(matchedUser.uid).collection('userFollowers').doc(currentUser.uid);
            followBatch.set(followingRef, {});
            followBatch.set(followerRef, {});
            uidsToFollow.add(matchedUser.uid);
            
            // Clean up the old invite record.
            const inviteRef = db.collection('users').doc(currentUser.uid).collection('onboardingInvites').doc(contact.id);
            followBatch.delete(inviteRef);
          }
        } else {
          // This contact is not on Kale.
          nonKaleContacts.push({
            id: contact.id,
            name: contact.name,
            phoneNumber: mainPhoneNumber,
          });
        }
        processedNumbers.add(key);
      });

      // 3. Commit automatic follows to Firestore and update local state
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

      // 4. Sort and build the final sections for the UI
      kaleUsers.sort((a, b) => (a.displayName || a.originalContactName).localeCompare(b.displayName || b.originalContactName));
      nonKaleContacts.sort((a, b) => a.name.localeCompare(b.name));

      const newSections = [];
      if (kaleUsers.length > 0) {
        newSections.push({ title: 'Already On Kale', data: kaleUsers });
      }
      if (nonKaleContacts.length > 0) {
        newSections.push({ title: 'Not On Kale Yet', data: nonKaleContacts });
      }
      setSections(newSections);
      setLoading(false);
    };

    fetchContactsAndUsers();
  }, [currentUser]);

  const handleFollow = async (userToFollow: KaleUser) => {
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

  const handleInvite = async (contactToInvite: NonKaleContact) => {
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
            setFollowedOrInvited(prev => {
                const newSet = new Set(prev);
                newSet.delete(contactToInvite.id);
                return newSet;
            });
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

  const handleUnfollow = async (userToUnfollow: KaleUser) => {
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
  
  const count = followedOrInvited.size;
  const canContinue = count >= MINIMUM_FOLLOW_INVITE;

  const renderItem = ({ item, section }: { item: DisplayUser | NonKaleContact; section: { title: string } }) => {
    const isKaleUser = section.title === 'Already On Kale';
    const kaleItem = item as DisplayUser;
    
    const id = isKaleUser ? kaleItem.uid : (item as NonKaleContact).id;
    const isDone = followedOrInvited.has(id);
    const isWaiting = waitingContacts.has(id);
    
    // Dynamically determine what to display based on available data
    const displayName = isKaleUser ? (kaleItem.displayName || kaleItem.username || kaleItem.originalContactName) : (item as NonKaleContact).name;
    const detailText = isKaleUser ? (kaleItem.username ? `@${kaleItem.username}` : kaleItem.originalPhoneNumber) : (item as NonKaleContact).phoneNumber;

    let buttonText = isKaleUser
      ? (isDone ? 'Following' : 'Follow')
      : (isDone ? 'Requested' : 'Follow');

    if (isWaiting) {
      const dots = '.'.repeat(ellipsisState);
      buttonText = `Waiting${dots}`;
    }

    return (
      <View style={styles.contactRow}>
        {isKaleUser && (
          kaleItem.photoURL ? (
            <Image source={{ uri: kaleItem.photoURL }} style={styles.profileImage} />
          ) : (
            <Image 
              source={require('./assets/default-profile-photo.png')} 
              style={styles.profileImage} 
            />
          )
        )}
        {!isKaleUser && (
          <Image 
            source={require('./assets/default-profile-photo.png')} 
            style={styles.profileImage} 
          />
        )}

        <View style={styles.contactInfo}>
            <Text style={styles.contactName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.contactDetail} numberOfLines={1}>{detailText}</Text>
        </View>

        <Pressable
            onPress={() => isKaleUser ? (isDone ? handleUnfollow(item as DisplayUser) : handleFollow(item as DisplayUser)) : handleInvite(item as NonKaleContact)}
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

  // Filter out users from 'Already On Kale' who are in followRequests
  let filteredSections: SectionType[] = [...sections];
  if (followRequests.length > 0) {
    // Get all follow request user ids
    const followRequestIds = new Set(followRequests.map(req => req.id));
    filteredSections = sections.map(section => {
      if (section.title === 'Already On Kale') {
        return {
          ...section,
          data: section.data.filter((user: any) => {
            // Only filter DisplayUser (Kale users)
            return !(user.uid && followRequestIds.has(user.uid));
          })
        };
      }
      return section;
    });
    filteredSections = [
      { title: 'Follow Requests', data: followRequests, isFollowRequests: true },
      ...filteredSections,
    ];
  }
  let displaySections = filteredSections;

  const renderFollowRequestItem = ({ item }: { item: any }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestUserInfo}>
        <Image
          source={item.requesterAvatar ? { uri: item.requesterAvatar } : require('./assets/default-profile-photo.png')}
          style={styles.profileImage}
        />
        <View style={styles.requestTextContainer}>
          <Text style={styles.contactName} numberOfLines={1}>
            {item.requesterName || item.requesterUsername || 'A user'}
          </Text>
          {item.requesterUsername && (
            <Text style={styles.contactDetail} numberOfLines={1}>
              @{item.requesterUsername}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.requestActions}>
        <Pressable style={styles.acceptButton} onPress={() => onAcceptRequest(item.id)}>
          <Text style={styles.acceptButtonText}>Accept</Text>
        </Pressable>
        <Pressable style={styles.ignoreButton} onPress={() => onIgnoreRequest(item.id)}>
          <Text style={styles.ignoreButtonText}>Ignore</Text>
        </Pressable>
      </View>
    </View>
  );

  if (loading) {
      return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#8BA637" />
        </View>
      );
  }

  return (
    <View style={styles.container}>
        <Modal
            animationType="none"
            transparent={true}
            visible={isHelpModalVisible}
            onRequestClose={hideHelpModal}
        >
            <View style={[
                styles.modalOverlay,
                { opacity: isHelpModalVisible ? 1 : 0 }
            ]}>
                <Animated.View 
                    style={[
                        styles.modalContent,
                        {
                            transform: [
                                { scale: scaleAnim },
                                {
                                    translateY: scaleAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [50, 0]
                                    })
                                }
                            ]
                        }
                    ]}
                >
                    <ScrollView 
                        style={styles.modalScrollView}
                        contentContainerStyle={styles.modalScrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <Text style={styles.modalTitle}>
                        Since Kale is <Text style={{ color: '#4F6A56' }}>only</Text> for friends (no reels), you'll need to add some people first.
                        {'\n\n'}
                        <Text style={styles.modalEmoji}>👋👋</Text>{'\n\n'}
                        Here's how it works:
                        </Text>
                        <Text style={styles.modalStep}>1. You can follow anyone from your contacts. 📒</Text>
                        <View style={styles.mockupContainer}>
                            <View style={styles.mockupRow}>
                                <View style={styles.mockupAvatar} />
                                <View style={styles.mockupTextContainer}>
                                    <View style={styles.mockupTextLineLong} />
                                    <View style={styles.mockupTextLineShort} />
                                </View>
                                <View style={[styles.mockupFollowButton, {backgroundColor: '#e6e6e6'}]}><Text style={[styles.mockupButtonText, {color: '#53544D'}]}>Following</Text></View>
                            </View>
                            <View style={styles.mockupRow}>
                                <View style={styles.mockupAvatar} />
                                <View style={styles.mockupTextContainer}>
                                    <View style={styles.mockupTextLineLong} />
                                    <View style={styles.mockupTextLineShort} />
                                </View>
                                <View style={styles.mockupFollowButton}><Text style={styles.mockupButtonText}>Follow</Text></View>
                            </View>
                            <View style={styles.mockupRow}>
                                <View style={styles.mockupAvatar} />
                                <View style={styles.mockupTextContainer}>
                                    <View style={styles.mockupTextLineLong} />
                                    <View style={styles.mockupTextLineShort} />
                                </View>
                                <View style={styles.mockupFollowButton}><Text style={styles.mockupButtonText}>Follow</Text></View>
                            </View>
                        </View>

                        <Text style={styles.modalStep}>2. Kale will prompt you to send them a text notification so they can follow you back. 🤝</Text>
                        <View style={styles.mockupSmsContainer}>
                            <View style={styles.mockupSmsHeader}>
                                <Text style={styles.mockupSmsTo}>To: Jane Doe</Text>
                            </View>
                            <View style={styles.mockupSmsBody}>
                                <View style={styles.mockupMessageBubble}>
                                    <View style={[styles.mockupMessageBubbleInner, styles.mockupMessageBubbleInnerTall]}>
                                        <View style={styles.mockupBubbleTailLeft} />
                                        <View style={styles.mockupBubbleTailLeftInner} />
                                    </View>
                                </View>
                                <View style={[styles.mockupMessageBubble, styles.mockupMessageBubbleRight]}>
                                    <View style={[styles.mockupMessageBubbleInner, styles.mockupMessageBubbleInnerRight, styles.mockupMessageBubbleInnerLong, { minWidth: 180, height: 50 }]}>
                                        <View style={styles.mockupBubbleTailRight} />
                                        <View style={styles.mockupBubbleTailRightInner} />
                                    </View>
                                </View>
                                <View style={styles.mockupMessageBubble}>
                                    <View style={styles.mockupMessageBubbleInner}>
                                        <View style={styles.mockupBubbleTailLeft} />
                                        <View style={styles.mockupBubbleTailLeftInner} />
                                    </View>
                                </View>
                                <View style={[styles.mockupMessageBubble, styles.mockupMessageBubbleRight]}>
                                    <View style={[styles.mockupMessageBubbleInner, styles.mockupMessageBubbleInnerRight, styles.mockupMessageBubbleInnerLong, { minWidth: 180 }]}>
                                        <View style={styles.mockupBubbleTailRight} />
                                        <View style={styles.mockupBubbleTailRightInner} />
                                    </View>
                                </View>
                                <View style={[styles.mockupMessageBubble, { marginBottom: 50 }]}>
                                    <View style={[styles.mockupMessageBubbleInner, { minWidth: 140 }]}>
                                        <View style={styles.mockupBubbleTailLeft} />
                                        <View style={styles.mockupBubbleTailLeftInner} />
                                    </View>
                                </View>
                            </View>
                            <View style={styles.mockupSmsSendRow}>
                                <View style={styles.mockupSmsInputBox}>
                                    <Text style={styles.mockupSmsText}>{`${userFirstName || 'Your Name'} requested to follow you.`}</Text>
                                </View>
                                <View style={styles.mockupSmsSendButton}>
                                    <MaterialIcons name="arrow-upward" size={20} color="white" />
                                </View>
                            </View>
                        </View>
                        <View style={styles.mockupArrowContainer}>
                            <MaterialIcons name="arrow-downward" size={24} color="#888" />
                        </View>
                        <View style={styles.mockupLockScreenNotification}>
                            <Image source={require('./assets/icon.png')} style={styles.mockupKaleIcon} />
                            <View style={styles.mockupNotificationTextContainer}>
                                <View style={styles.mockupNotificationHeader}>
                                    <Text style={styles.mockupNotificationBody} numberOfLines={2}>
                                        <Text style={{fontWeight: 'bold'}}>{userFirstName || 'Your Name'}</Text> requested to follow you.
                                    </Text>
                                    <Text style={styles.mockupNotificationTime}>now</Text>
                                </View>
                            </View>
                        </View>

                        <Text style={styles.modalStep}>3. If they use your link, they'll automatically follow you back. ✅</Text>
                    </ScrollView>

                    <Pressable
                        style={styles.modalCloseButton}
                        onPress={hideHelpModal}
                    >
                        <Text style={styles.modalCloseButtonText}>Close</Text>
                    </Pressable>
                </Animated.View>
            </View>
        </Modal>

        <View style={styles.header}>
            <View style={styles.titleRow}>
                <Text style={styles.title}>
                    {count >= MINIMUM_FOLLOW_INVITE 
                        ? "The more you add, the less you'll want to check Instagram :)"
                        : `Follow at least ${MINIMUM_FOLLOW_INVITE} friends to get started.`}
                </Text>
            </View>
            <Text style={styles.counter}>🥬 {count}{count < MINIMUM_FOLLOW_INVITE ? `/${MINIMUM_FOLLOW_INVITE}` : ''}</Text>
            <Pressable onPress={showHelpModal}>
                <Text style={styles.helpText}>Why?</Text>
            </Pressable>
        </View>

        <SectionList
            sections={displaySections as any[]}
            keyExtractor={(item, index) => {
              if ('uid' in item && item.uid) return String(item.uid);
              if ('id' in item && item.id) return String(item.id);
              return String(index);
            }}
            renderItem={({ item, section }: { item: any; section: SectionType }) => {
              if ('isFollowRequests' in section && section.isFollowRequests) {
                return renderFollowRequestItem({ item });
              }
              return renderItem({ item, section });
            }}
            renderSectionHeader={({ section }: { section: SectionType }) => (
              <Text style={styles.sectionHeader}>{section.title}</Text>
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
                <Text style={styles.doneButtonText}>Continue</Text>
            </Pressable>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
    },
    header: {
        paddingTop: 80,
        paddingBottom: 20,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    title: {
        fontSize: 32,
        fontFamily: 'PatrickHand-Regular',
        color: '#8BA637',
        textAlign: 'center',
        lineHeight: 38,
        maxWidth: '85%',
    },
    helpText: {
        fontSize: 18,
        fontFamily: 'PatrickHand-Regular',
        color: '#8BA637',
        textDecorationLine: 'underline',
        marginTop: 20,
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
        backgroundColor: '#FFFFFF',
        paddingTop: 20,
        paddingBottom: 10,
    },
    contactRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 0,
        borderBottomColor: 'transparent',
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
        color: '#53544D',
        marginTop: -6,
    },
    contactDetail: {
        fontSize: 16,
        fontFamily: 'PatrickHand-Regular',
        color: '#888',
        marginTop: -3,
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
    // --- MODAL STYLES ---
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '90%',
        maxHeight: '80%',
    },
    modalScrollView: {
        width: '100%',
    },
    modalScrollContent: {
        paddingBottom: 20,
    },
    modalTitle: {
        fontSize: 28,
        fontFamily: 'PatrickHand-Regular',
        color: '#8BA637',
        textAlign: 'center',
        marginBottom: 0,
        marginTop: 10,
    },
    modalEmoji: {
        fontSize: 50,
        textAlign: 'center',
        marginBottom: 15,
    },
    modalStep: {
        fontSize: 24,
        fontFamily: 'PatrickHand-Regular',
        color: '#53544D',
        textAlign: 'left',
        alignSelf: 'flex-start',
        marginBottom: 20,
        marginTop: 50,
        lineHeight: 32,
    },
    mockupContainer: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#FFFFFF',
    },
    mockupRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    mockupAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E9E9E9',
        marginRight: 12,
    },
    mockupTextContainer: {
        flex: 1,
    },
    mockupTextLineLong: {
        height: 12,
        width: '80%',
        backgroundColor: '#E9E9E9',
        borderRadius: 4,
        marginBottom: 6,
    },
    mockupTextLineShort: {
        height: 10,
        width: '50%',
        backgroundColor: '#E9E9E9',
        borderRadius: 4,
    },
    mockupFollowButton: {
        backgroundColor: '#8BA637',
        borderRadius: 5,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    mockupButtonText: {
        color: 'white',
        fontSize: 14,
        fontFamily: 'PatrickHand-Regular',
    },
    mockupSmsContainer: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#EFEFEF',
    },
    mockupSmsHeader: {
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderColor: '#f0f0f0',
        marginBottom: 8,
    },
    mockupSmsTo: {
        fontFamily: 'PatrickHand-Regular',
        color: '#888',
        fontSize: 14
    },
    mockupSmsBody: {
        minHeight: 120,
        marginBottom: 8,
    },
    mockupMessageBubble: {
        marginBottom: 16,
        maxWidth: '80%',
    },
    mockupMessageBubbleRight: {
        alignSelf: 'flex-end',
    },
    mockupMessageBubbleInner: {
        backgroundColor: '#f0f0f0',
        borderRadius: 16,
        padding: 12,
        height: 20,
        position: 'relative',
        justifyContent: 'center',
    },
    mockupMessageBubbleInnerTall: {
        height: 40,
    },
    mockupMessageBubbleInnerLong: {
        minWidth: 120,
        maxWidth: 200,
    },
    mockupMessageBubbleInnerRight: {
        backgroundColor: '#1F8AFF',
    },
    mockupBubbleTailLeft: {
        position: 'absolute',
        left: -6,
        bottom: 0,
        width: 0,
        height: 0,
        borderTopWidth: 10,
        borderTopColor: 'transparent',
        borderRightWidth: 10,
        borderRightColor: '#f0f0f0',
        borderBottomWidth: 0,
        borderLeftWidth: 0,
        borderStyle: 'solid',
    },
    mockupBubbleTailLeftInner: {
        position: 'absolute',
        left: 2,
        bottom: 0,
        width: 0,
        height: 0,
        borderTopWidth: 10,
        borderTopColor: 'transparent',
        borderLeftWidth: 10,
        borderLeftColor: '#f0f0f0',
        borderBottomWidth: 0,
        borderRightWidth: 0,
        borderStyle: 'solid',
    },
    mockupBubbleTailRight: {
        position: 'absolute',
        right: -6,
        bottom: 0,
        width: 0,
        height: 0,
        borderTopWidth: 10,
        borderTopColor: 'transparent',
        borderLeftWidth: 10,
        borderLeftColor: '#1F8AFF',
        borderBottomWidth: 0,
        borderRightWidth: 0,
        borderStyle: 'solid',
    },
    mockupBubbleTailRightInner: {
        position: 'absolute',
        right: 2,
        bottom: 0,
        width: 0,
        height: 0,
        borderTopWidth: 10,
        borderTopColor: 'transparent',
        borderRightWidth: 10,
        borderRightColor: '#1F8AFF',
        borderBottomWidth: 0,
        borderLeftWidth: 0,
        borderStyle: 'solid',
    },
    mockupSmsInputBox: {
        flex: 1,
        height: 36,
        backgroundColor: '#f0f0f0',
        borderRadius: 18,
        marginRight: 8,
        paddingHorizontal: 12,
        justifyContent: 'center',
    },
    mockupSmsText: {
        fontFamily: 'PatrickHand-Regular',
        color: '#53544D',
        fontSize: 15,
        lineHeight: 18,
    },
    mockupSmsSendRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    mockupSmsSendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#1F8AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mockupArrowContainer: {
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 10
    },
    mockupLockScreenNotification: {
        width: '100%',
        backgroundColor: 'rgba(230, 230, 230, 0.8)',
        borderRadius: 16,
        padding: 12,
        marginBottom: 15,
        flexDirection: 'row',
        alignItems: 'center'
    },
    mockupKaleIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        marginRight: 10,
    },
    mockupNotificationTextContainer: {
        flex: 1,
    },
    mockupNotificationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    mockupNotificationBody: {
        fontFamily: 'PatrickHand-Regular',
        fontSize: 14,
        color: '#53544D',
        lineHeight: 18,
        flex: 1,
        marginRight: 15,
        marginTop: -2,
    },
    mockupNotificationTime: {
        fontFamily: 'PatrickHand-Regular',
        fontSize: 12,
        color: '#888',
        marginTop: -12,
    },
    modalCloseButton: {
        backgroundColor: '#8BA637',
        borderRadius: 25,
        paddingVertical: 12,
        paddingHorizontal: 30,
        elevation: 2,
        marginTop: 20,
        width: '100%',
    },
    modalCloseButtonText: {
        color: 'white',
        fontFamily: 'PatrickHand-Regular',
        fontSize: 20,
        textAlign: 'center',
    },
    requestCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 0,
        backgroundColor: '#FFFFFF',
        marginBottom: 2,
    },
    requestUserInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    requestTextContainer: {
        flex: 1,
        justifyContent: 'center',
        marginLeft: 4,
        paddingRight: 20,
        maxWidth: '70%',
    },
    requestActions: {
        flexDirection: 'row',
    },
    acceptButton: {
        backgroundColor: '#8BA637',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 5,
        marginRight: 8,
    },
    acceptButtonText: {
        color: '#FFFFFF',
        fontFamily: 'PatrickHand-Regular',
        fontSize: 14,
    },
    ignoreButton: {
        backgroundColor: '#e6e6e6',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 5,
    },
    ignoreButtonText: {
        color: '#53544D',
        fontFamily: 'PatrickHand-Regular',
        fontSize: 14,
    },
});