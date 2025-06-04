// App.tsx
import * as React from 'react';
import { useFonts } from 'expo-font';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import FeedScreen from './FeedScreen';
import ProfileScreen from './ProfileScreen';
import ProfileModal from './ProfileModal.js';
import PostScreen from './PostScreen';

const Tab = createBottomTabNavigator();
const FeedStack = createStackNavigator();
const RootStack = createStackNavigator();

function FeedStackScreen() {
  return (
    <FeedStack.Navigator>
      <FeedStack.Screen name="Feed" component={FeedScreen} options={{ headerShown: false }} />
      <FeedStack.Screen name="ProfileModal" component={ProfileModal} options={{ presentation: 'modal', headerShown: false }} />
    </FeedStack.Navigator>
  );
}

function MainTabs() {
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
          if (route.name === 'Profile')
            iconName = focused ? 'person' : 'person-outline';
          return (
            <MaterialIcons
              name={iconName}
              size={32}
              color={focused ? '#8BA637' : '#B9B9B9'}
            />
          );
        },
      })}
    >
      <Tab.Screen name="FeedStack" component={FeedStackScreen} options={{ title: 'Feed' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} initialParams={{ userId: 1 }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'PatrickHand-Regular': require('./assets/fonts/PatrickHand-Regular.ttf'),
  });
  if (!fontsLoaded) return null;

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="MainTabs" component={MainTabs} />
        <RootStack.Screen name="PostDetail" component={PostScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}