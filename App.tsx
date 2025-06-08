import * as React from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createStackNavigator,
  CardStyleInterpolators,
} from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from './firebaseConfig';
import { User as FirebaseUser } from 'firebase/auth';

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
import OnboardingQuestionScreen from './OnboardingQuestionScreen';
import ConnectContactsScreen from './ConnectContactsScreen'; // Import the new screen

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

// New navigator and param list for the entire onboarding flow
type OnboardingStackParamList = {
  OnboardingQuestion: undefined;
  ConnectContacts: undefined;
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
              size={36}
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

// New stack for the entire onboarding process
function OnboardingStackScreen({ onOnboardingComplete }: { onOnboardingComplete: () => void }) {
    return (
      <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
        <OnboardingStack.Screen
          name="OnboardingQuestion"
          component={OnboardingQuestionScreen}
        />
        <OnboardingStack.Screen name="ConnectContacts">
          {(props) => (
            <ConnectContactsScreen
              {...props}
              onOnboardingComplete={onOnboardingComplete}
            />
          )}
        </OnboardingStack.Screen>
      </OnboardingStack.Navigator>
    );
  }

export default function App() {
  const [fontsLoaded] = useFonts({
    'PatrickHand-Regular': require('./assets/fonts/PatrickHand-Regular.ttf'),
  });
  const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isProfileComplete, setIsProfileComplete] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setLoading(true);
      if (user) {
        const userDocRef = db.collection('users').doc(user.uid);
        const docSnap = await userDocRef.get();

        setCurrentUser(user as FirebaseUser);

        // A profile is "complete" if the user document exists in Firestore.
        // The OnboardingStack will guide them through creating it.
        if (docSnap.exists) {
          setIsProfileComplete(true);
        } else {
          setIsProfileComplete(false);
        }
      } else {
        setCurrentUser(null);
        setIsProfileComplete(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (!fontsLoaded || loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#8BA637" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!currentUser ? (
        <AuthStackScreen />
      ) : isProfileComplete ? (
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
      ) : (
        <OnboardingStackScreen onOnboardingComplete={() => setIsProfileComplete(true)} />
      )}
    </NavigationContainer>
  );
}