import * as React from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createStackNavigator,
  CardStyleInterpolators,
} from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from './firebaseConfig';
import { User } from 'firebase/auth';

import FeedScreen from './FeedScreen';
import ProfileScreen from './ProfileScreen';
import ProfileModal from './ProfileModal.js';
import PostScreen from './PostScreen';
import StoryViewer from './StoryViewer';
import SearchScreen from './SearchScreen';
// Import both screens in the posting flow:
import SelectPhotoScreen from './SelectPhotoScreen';
import CreatePostDetailsScreen from './CreatePostDetailsScreen';


const Tab = createBottomTabNavigator();
const FeedStack = createStackNavigator();
const RootStack = createStackNavigator();

// New stack for creating a post:
const CreatePostStack = createStackNavigator();
const AuthStack = createStackNavigator();

function CreatePostStackScreen() {
  return (
    <CreatePostStack.Navigator
      screenOptions={{ headerShown: false }}
    >
      {/* First screen: select photos */}
      <CreatePostStack.Screen
        name="SelectPhoto"
        component={SelectPhotoScreen}
      />
      {/* Second screen: enter caption/tags */}
      <CreatePostStack.Screen
        name="PostDetails"
        component={CreatePostDetailsScreen}
      />
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

function MainTabs({ currentUser }: { currentUser: User }) {
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
      {/* Use the new CreatePostStackScreen here */}
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

function AuthStackScreen() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Auth" component={AuthScreen} />
    </AuthStack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'PatrickHand-Regular': require('./assets/fonts/PatrickHand-Regular.ttf'),
  });
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Use the v8 compat syntax for onAuthStateChanged
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user as any);
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
      {currentUser ? (
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
        <AuthStackScreen />
      )}
    </NavigationContainer>
  );
}

function AuthScreen() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');

  const handleSignUp = async () => {
    setError('');
    try {
      // Use the v8 compat syntax
      await auth.createUserWithEmailAndPassword(email, password);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSignIn = async () => {
    setError('');
    try {
      // Use the v8 compat syntax
      await auth.signInWithEmailAndPassword(email, password);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={styles.authContainer}>
      <Text style={styles.authTitle}>KALE</Text>
      <TextInput
        style={styles.authInput}
        placeholder="Email (e.g., bigbird@sesame.com)"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.authInput}
        placeholder="Password (e.g., 123456)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error ? <Text style={styles.authError}>{error}</Text> : null}
      <Button title="Sign In" onPress={handleSignIn} color="#8BA637" />
      <View style={{height: 10}} />
      <Button title="Sign Up" onPress={handleSignUp} color="#53544D" />
    </View>
  );
}

const styles = StyleSheet.create({
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F2F2F2',
  },
  authTitle: {
    fontSize: 60,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
    textAlign: 'center',
    marginBottom: 40,
  },
  authInput: {
    backgroundColor: '#fff',
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  authError: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },
});