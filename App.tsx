import * as React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createStackNavigator,
  CardStyleInterpolators,
  StackScreenProps,
} from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from './firebaseConfig';
import { User as FirebaseUser } from 'firebase/auth';
import { onSnapshot, doc } from 'firebase/firestore';

import FeedScreen from './FeedScreen';
import ProfileScreen from './ProfileScreen';
import ProfileModal from './ProfileModal.js';
import PostScreen from './PostScreen';
import StoryViewer from './StoryViewer';
import SearchScreen from './SearchScreen';
import SelectPhotoScreen from './SelectPhotoScreen';
import CreatePostDetailsScreen from './CreatePostDetailsScreen';

// Import the auth and onboarding screens
import PhoneNumberScreen from './PhoneNumberScreen';
import VerifyCodeScreen from './VerifyCodeScreen';
import OnboardingIntroScreen from './OnboardingIntroScreen';
import ConnectContactsScreen from './ConnectContactsScreen';
import AddFriendsScreen from './AddFriendsScreen';

// Import new profile creation screens
import CreateProfileFirstNameScreen from './CreateProfileFirstNameScreen';
import CreateProfileLastNameScreen from './CreateProfileLastNameScreen';
import CreateProfileUsernameScreen from './CreateProfileUsernameScreen';
import CreateProfilePhotoScreen from './CreateProfilePhotoScreen';

const Tab = createBottomTabNavigator();
const FeedStack = createStackNavigator();
const RootStack = createStackNavigator();
const CreatePostStack = createStackNavigator();
const AuthStack = createStackNavigator<AuthStackParamList>();

// Define param lists for navigators
type AuthStackParamList = {
  PhoneNumber: undefined;
  VerifyCode: {
    phoneNumber: string;
    verificationId: string;
  };
};

// Updated param list for the entire onboarding flow
type OnboardingStackParamList = {
  OnboardingIntro: undefined;
  ConnectContacts: undefined;
  CreateProfileFirstName: undefined;
  CreateProfileLastName: undefined;
  CreateProfileUsername: undefined;
  CreateProfilePhoto: undefined;
  AddFriends: undefined;
};
const OnboardingStack = createStackNavigator<OnboardingStackParamList>();

function CreatePostStackScreen() {
  return (
    <CreatePostStack.Navigator screenOptions={{ headerShown: false }}>
      <CreatePostStack.Screen name="SelectPhoto" component={SelectPhotoScreen} />
      <CreatePostStack.Screen name="PostDetails" component={CreatePostDetailsScreen} />
    </CreatePostStack.Navigator>
  );
}

function FeedStackScreen() {
  return (
    <FeedStack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureResponseDistance: 500,
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
    >
      <FeedStack.Screen name="Feed" component={FeedScreen} />
      <FeedStack.Screen name="ProfileModal" component={ProfileModal} />
      <FeedStack.Screen name="PostDetail" component={PostScreen} />
    </FeedStack.Navigator>
  );
}

function MainTabs({ currentUser }: { currentUser: FirebaseUser }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          height: 90,
          backgroundColor: '#F2F2F2',
          alignItems: 'center',
          paddingTop: 8,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarShowLabel: false,
        tabBarIcon: ({ focused }) => {
          let iconName: keyof typeof MaterialIcons.glyphMap = 'home';
          if (route.name === 'FeedStack')
            iconName = focused ? 'favorite' : 'favorite-outline';
          if (route.name === 'Search') iconName = 'search';
          if (route.name === 'CreatePost')
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          return (
            <MaterialIcons
              name={iconName}
              size={30}
              color={focused ? '#8BA637' : '#B9B9B9'}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="FeedStack"
        component={FeedStackScreen}
        options={{ title: 'Feed' }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: 'Search' }}
      />
      <Tab.Screen
        name="CreatePost"
        component={CreatePostStackScreen}
        options={{ title: 'Add Post' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        initialParams={{ userId: currentUser.uid }}
      />
    </Tab.Navigator>
  );
}

// Auth stack for phone verification flow
function AuthStackScreen() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="PhoneNumber" component={PhoneNumberScreen} />
      <AuthStack.Screen name="VerifyCode" component={VerifyCodeScreen} />
    </AuthStack.Navigator>
  );
}

// Updated stack for the onboarding process
function OnboardingStackScreen({ 
  initialRouteName,
  setAuthStatus 
}: { 
  initialRouteName: keyof OnboardingStackParamList;
  setAuthStatus: (status: 'LOADING' | 'LOGGED_OUT' | 'ONBOARDING' | 'LOGGED_IN') => void;
}) {
    return (
      <OnboardingStack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{ headerShown: false }}
      >
        <OnboardingStack.Screen
          name="OnboardingIntro"
          component={OnboardingIntroScreen}
        />
        <OnboardingStack.Screen
          name="ConnectContacts"
          component={ConnectContactsScreen}
        />
        <OnboardingStack.Screen
          name="CreateProfileFirstName"
          component={CreateProfileFirstNameScreen}
        />
        <OnboardingStack.Screen
          name="CreateProfileLastName"
          component={CreateProfileLastNameScreen}
        />
        <OnboardingStack.Screen
          name="CreateProfileUsername"
          component={CreateProfileUsernameScreen}
        />
         <OnboardingStack.Screen
          name="CreateProfilePhoto"
          component={CreateProfilePhotoScreen}
        />
        <OnboardingStack.Screen
          name="AddFriends"
          component={(props: StackScreenProps<OnboardingStackParamList, 'AddFriends'>) => 
            <AddFriendsScreen {...props} onOnboardingComplete={() => setAuthStatus('LOGGED_IN')} />
          }
        />
      </OnboardingStack.Navigator>
    );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'PatrickHand-Regular': require('./assets/fonts/PatrickHand-Regular.ttf'),
  });

  const [authStatus, setAuthStatus] = React.useState<'LOADING' | 'LOGGED_OUT' | 'ONBOARDING' | 'LOGGED_IN'>('LOADING');
  const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(null);
  const [initialOnboardingRoute, setInitialOnboardingRoute] = React.useState<keyof OnboardingStackParamList>('OnboardingIntro');

  React.useEffect(() => {
    let firestoreUnsubscribe: () => void = () => {};

    // This single listener will manage all state transitions, preventing race conditions.
    const authUnsubscribe = auth.onAuthStateChanged(user => {
      // Unsubscribe from any previous Firestore listener when auth state changes.
      if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
      }
      
      if (user) {
        setCurrentUser(user as FirebaseUser);
        const userDocRef = doc(db, 'users', user.uid);
        
        // Listen to the user's profile document in Firestore.
        firestoreUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            if (userData.onboardingCompleted) {
              setAuthStatus('LOGGED_IN');
            } else {
              // Onboarding is in progress, figure out where to resume.
              if (!userData.firstName) {
                setInitialOnboardingRoute('CreateProfileFirstName');
              } else if (!userData.displayName) {
                setInitialOnboardingRoute('CreateProfileLastName');
              } else if (!userData.username) {
                setInitialOnboardingRoute('CreateProfileUsername');
              } else if (!userData.photoURL) { // After username, check for photo
                setInitialOnboardingRoute('CreateProfilePhoto');
              } else { // After photo, it's add friends
                setInitialOnboardingRoute('AddFriends');
              }
              setAuthStatus('ONBOARDING');
            }
          } else {
            // User is authenticated but has no Firestore document yet.
            // This is the state right after phone verification.
            setInitialOnboardingRoute('OnboardingIntro');
            setAuthStatus('ONBOARDING');
          }
        });
      } else {
        // User is not authenticated.
        setCurrentUser(null);
        setAuthStatus('LOGGED_OUT');
      }
    });

    // Cleanup on component unmount
    return () => {
      authUnsubscribe();
      if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount.

  if (!fontsLoaded || authStatus === 'LOADING') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F2' }}>
        <ActivityIndicator size="large" color="#8BA637" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {authStatus === 'LOGGED_OUT' && <AuthStackScreen />}
      {authStatus === 'ONBOARDING' && <OnboardingStackScreen initialRouteName={initialOnboardingRoute} setAuthStatus={setAuthStatus} />}
      {authStatus === 'LOGGED_IN' && currentUser && (
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="MainTabs">
            {props => <MainTabs {...props} currentUser={currentUser} />}
          </RootStack.Screen>
          <RootStack.Screen
            name="PostDetail"
            component={PostScreen}
            options={{ gestureEnabled: true, gestureResponseDistance: 500 }}
          />
          <RootStack.Screen
            name="ProfileModal"
            component={ProfileModal}
            options={{ gestureEnabled: true, gestureResponseDistance: 500 }}
          />
          <RootStack.Screen
            name="StoryViewer"
            component={StoryViewer}
            options={{ presentation: 'modal', headerShown: false }}
          />
        </RootStack.Navigator>
      )}
    </NavigationContainer>
  );
}