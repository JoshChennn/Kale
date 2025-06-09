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
  Animated,
  Dimensions,
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
  const arrowAnim = React.useRef(new Animated.Value(0)).current;
  const { height: screenHeight } = Dimensions.get('window');

  React.useEffect(() => {
    const animateArrow = () => {
      Animated.sequence([
        Animated.timing(arrowAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(arrowAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => animateArrow());
    };

    animateArrow();
  }, []);

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
        contentContainerStyle={[
          styles.scrollViewContent,
          { minHeight: screenHeight * 1.5 } // Ensure content extends well below fold
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.initialContent, { height: screenHeight }]}>
          <Text style={styles.heading}>
            Social media is <Text style={styles.highlightedText}>designed</Text> to be addicting. 🚬
          </Text>
          <Text style={styles.paragraph}>
            Likes. Streaks. Vanishing stories.{' '}
            <Text style={styles.highlightedText}>Endless scrolling</Text>.
          </Text>
          <View style={styles.scrollContainer}>
            <Animated.Text 
              style={[
                styles.arrow,
                {
                  transform: [{
                    translateY: arrowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 10]
                    })
                  }]
                }
              ]}
            >
              ↓
            </Animated.Text>
          </View>
        </View>
        <Text style={styles.paragraph}>
          Kale is Instagram without the{' '}
          <Text style={styles.highlightedText}>cocaine.</Text>
        </Text>

        <FakeFeedScreenshot />

        <Text style={styles.paragraph}>No reels. No doomscrolling. Just friends.</Text>
        <Text style={styles.paragraph}>🚭 🚭 🚭</Text>
        <Text style={styles.paragraph}>
          This is the first social app in the world that's designed to be{' '}
          <Text style={styles.highlightedText}>boring.</Text>
        </Text>
        <Text style={styles.paragraph}>🌱 🌿 🍃</Text>
        <Text style={styles.paragraph}>Sound good?</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },
  scrollViewContent: {
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  initialContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    fontSize: 50,
    fontFamily: 'PatrickHand-Regular',
    color: '#8BA637',
    textAlign: 'center',
    lineHeight: 56,
    marginTop: 60,
    marginBottom: 120,
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
  scrollContainer: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 100,
  },
  scrollText: {
    fontSize: 24,
    fontFamily: 'PatrickHand-Regular',
    color: '#B9B9B9',
    marginBottom: 5,
  },
  arrow: {
    fontSize: 40,
    color: '#B9B9B9',
    textAlign: 'center',
  },
  bottomContainer: {
    marginTop: 40,
    marginBottom: 40,
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
    fontSize: 22,
    fontFamily: 'PatrickHand-Regular',
  },
  // Fake Screenshot Styles
  screenshotContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: 'white',
    padding: 10,
    marginTop: 20,
    marginBottom: 50,
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