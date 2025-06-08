// StoryViewer.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  SafeAreaView,
  StyleSheet,
  Dimensions,
  Pressable,
  Animated,
  PanResponder,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const STORY_DURATION = 5000; // 5 seconds per story

export default function StoryViewer({ route, navigation }) {
  const { stories = [], initialIndex = 0 } = route.params;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef(null);
  const isPressing = useRef(false);
  const pausedProgress = useRef(0);
  const scrollRef = useRef(null);

  // scroll to initial story & start its animation
  useEffect(() => {
    const t = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ x: initialIndex * screenWidth, animated: false });
      }
      runAnimation(initialIndex, 0);
    }, 50);
    return () => clearTimeout(t);
  }, []);

  // re-run animation whenever index changes
  useEffect(() => {
    runAnimation(currentIndex, 0);
    return () => animationRef.current?.stop();
  }, [currentIndex]);

  const runAnimation = (index, startVal) => {
    progress.setValue(startVal);
    const remaining = STORY_DURATION * (1 - startVal);

    animationRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: remaining,
      useNativeDriver: false,
    });

    animationRef.current.start(({ finished }) => {
      if (finished) {
        advanceStory();
      }
    });
  };

  const pauseAnimation = () => {
    animationRef.current?.stop();
    progress.stopAnimation((val) => {
      pausedProgress.current = val;
    });
  };

  const resumeAnimation = () => {
    runAnimation(currentIndex, pausedProgress.current);
  };

  const advanceStory = () => {
    pauseAnimation();
    if (currentIndex < stories.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      scrollRef.current?.scrollTo({ x: nextIdx * screenWidth, animated: true });
      pausedProgress.current = 0;
    } else {
      navigation.goBack();
    }
  };

  const goPrev = () => {
    pauseAnimation();
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      scrollRef.current?.scrollTo({ x: prevIdx * screenWidth, animated: true });
      pausedProgress.current = 0;
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 50 && gesture.vy > 0.5) {
          pauseAnimation();
          navigation.goBack();
        }
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  const handleTap = (e) => {
    const x = e.nativeEvent.locationX;
    if (x < screenWidth / 3) goPrev();
    else advanceStory();
  };

  const onScrollEnd = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / screenWidth);
    if (idx !== currentIndex) {
      pauseAnimation();
      setCurrentIndex(idx);
      pausedProgress.current = 0;
    }
  };

  if (!stories.length) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.noStories}>no stories available</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
      {/* single progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBackground} />
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      <Pressable
        style={styles.container}
        onPress={handleTap}
        onPressIn={() => {
          isPressing.current = true;
          pauseAnimation();
        }}
        onPressOut={() => {
          isPressing.current = false;
          resumeAnimation();
        }}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          scrollEnabled={!isPressing.current}
        >
          {stories.map((s, idx) => (
            <Image
              key={s.id ?? idx}
              source={{ uri: s.uri }}
              style={styles.image}
              resizeMode="contain"
            />
          ))}
        </ScrollView>

        <Pressable style={styles.close} onPress={() => navigation.goBack()}>
          <MaterialIcons name="close" size={30} color="white" />
        </Pressable>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  image: {
    width: screenWidth,
    height: screenHeight,
  },
  close: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1,
  },
  progressContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    height: 3,
    zIndex: 1,
  },
  progressBackground: {
    position: 'absolute',
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
  },
  progressFill: {
    height: 3,
    backgroundColor: 'white',
    borderRadius: 1.5,
  },
  noStories: {
    color: 'white',
    textAlign: 'center',
    marginTop: 20,
  },
});
