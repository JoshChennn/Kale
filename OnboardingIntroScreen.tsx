import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  SafeAreaView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';

// This param list should now match the OnboardingStack navigator in App.tsx
type OnboardingStackParamList = {
  OnboardingIntro: undefined;
  OnboardingQuestion: undefined;
  ConnectContacts: undefined;
  AddFriends: undefined;
};

type Props = StackScreenProps<OnboardingStackParamList, 'OnboardingIntro'>;

// A simplified "screenshot" of the feed to illustrate the point
const FakeFeedScreenshot = () => (
  <View style={styles.screenshotContainer}>
    <View style={styles.ssHeader}>
      <Text style={styles.ssLogo}>KALE</Text>
    </View>
    <View style={styles.ssStories}>
      <View style={styles.ssStoryCircle} />
      <View style={styles.ssStoryCircle} />
      <View style={styles.ssStoryCircle} />
      <View style={styles.ssStoryCircle} />
    </View>
    <View style={styles.ssPost}>
      <View style={styles.ssPostHeader} />
      <View style={styles.ssPostImage} />
    </View>
    <View style={styles.ssPost}>
      <View style={styles.ssPostHeader} />
      <View style={styles.ssPostImage} />
    </View>
  </View>
);

export default function OnboardingIntroScreen({ navigation }: Props) {
  const [isScrolledToEnd, setIsScrolledToEnd] = React.useState(false);

  // Checks if the user has scrolled to the bottom of the content
  const isCloseToBottom = ({
    layoutMeasurement,
    contentOffset,
    contentSize,
  }: NativeScrollEvent) => {
    const paddingToBottom = 40; // A small buffer
    return (
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom
    );
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isCloseToBottom(event.nativeEvent)) {
      setIsScrolledToEnd(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.logo}>KALE</Text>
        <Text style={styles.paragraph}>
          Social media is <Text style={styles.highlightedText}>designed</Text> to be addicting.
        </Text>
        <Text style={styles.paragraph}>
          Likes. Streaks. Vanishing stories.{' '}
          <Text style={styles.highlightedText}>Endless scrolling.</Text>
        </Text>
        <Text style={styles.paragraph}>
          Kale is Instagram without the{' '}
          <Text style={styles.highlightedText}>cocaine.</Text>
        </Text>

        <FakeFeedScreenshot />

        <Text style={styles.paragraph}>No dopamine. Just friends.</Text>
        <Text style={styles.paragraph}>
          And here's the best part: when you get to the end of your feed, it
          just stops. 🤯 No doomscrolling here.
        </Text>
        <Text style={styles.paragraph}>
          Kale is the first social media in the world that's designed to be{' '}
          <Text style={styles.highlightedText}>boring.</Text>
        </Text>
        <Text style={styles.paragraphSmall}>
          On the next page, you'll need to enable contacts so we can suggest
          friends and add at least 7 to start using the app (because there's nothing
          else to see here besides friends).
        </Text>
        <Text style={styles.paragraph}>Sound good?</Text>
      </ScrollView>
      <View style={styles.bottomContainer}>
        <Pressable
          onPress={() => navigation.navigate('ConnectContacts')}
          disabled={!isScrolledToEnd}
          style={({ pressed }) => [
            styles.button,
            !isScrolledToEnd && styles.buttonDisabled,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.buttonText}>Let's go!</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },
  scrollViewContent: {
    padding: 40,
    paddingBottom: 150, // Make space for the fixed button
  },
  logo: {
    fontSize: 60,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
    textAlign: 'center',
    marginBottom: 40,
  },
  paragraph: {
    fontSize: 32,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 30,
  },
  paragraphSmall: {
    fontSize: 24,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 30,
  },
  highlightedText: {
    color: '#4F6A56',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 40,
    paddingTop: 20,
    backgroundColor: '#F2F2F2',
  },
  button: {
    backgroundColor: '#8BA637',
    borderRadius: 25,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#B9B9B9',
  },
  buttonText: {
    color: '#F2F2F2',
    fontSize: 20,
    fontFamily: 'PatrickHand-Regular',
  },
  // Fake Screenshot Styles
  screenshotContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: 'white',
    padding: 10,
    marginVertical: 20,
    marginHorizontal: -20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  ssHeader: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  ssLogo: {
    fontSize: 24,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
  },
  ssStories: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingLeft: 5,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F2F2F2',
  },
  ssStoryCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(139, 166, 55, 0.1)',
    marginHorizontal: 5,
    borderWidth: 2,
    borderColor: 'rgba(139, 166, 55, 0.3)',
  },
  ssPost: {
    marginTop: 15,
  },
  ssPostHeader: {
    height: 30,
    width: '70%',
    backgroundColor: '#E9E9E9',
    borderRadius: 8,
    marginBottom: 8,
  },
  ssPostImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#E9E9E9',
    borderRadius: 8,
  },
});