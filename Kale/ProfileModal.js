import React from 'react';
import { View, StyleSheet, Image, SafeAreaView, Text, ScrollView, Dimensions, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;
const gridMargin = 6;
const imgSize = (screenWidth - gridMargin * 4) / 3;

const users = [
  { id: 1, name: 'Big Bird', avatar: 'https://sesameworkshop.org/wp-content/uploads/2023/03/presskit_ss_bio_bigbird-560x420.png' },
  { id: 2, name: 'Elmo', avatar: 'https://static.wikia.nocookie.net/muppet/images/8/8f/Elmo-2017-Hi-Res.png' },
  { id: 3, name: 'Cookie Monster', avatar: 'https://static.wikia.nocookie.net/muppet/images/4/4d/CookieMonster2015.png' },
  { id: 4, name: 'Oscar', avatar: 'https://static.wikia.nocookie.net/muppet/images/6/6f/Oscar-the-Grouch.png' },
  { id: 5, name: 'Grover', avatar: 'https://static.wikia.nocookie.net/muppet/images/7/7e/Grover-2015.png' },
  { id: 6, name: 'Bert', avatar: 'https://static.wikia.nocookie.net/muppet/images/2/2c/Bert-2018.png' },
  { id: 7, name: 'Ernie', avatar: 'https://static.wikia.nocookie.net/muppet/images/6/6a/Ernie-2018.png' },
  { id: 8, name: 'Zoe', avatar: 'https://static.wikia.nocookie.net/muppet/images/2/2b/Zoe-2018.png' },
  { id: 9, name: 'Abby Cadabby', avatar: 'https://static.wikia.nocookie.net/muppet/images/2/2d/Abby-2018.png' },
  { id: 10, name: 'Rosita', avatar: 'https://static.wikia.nocookie.net/muppet/images/2/2e/Rosita-2018.png' },
  { id: 11, name: 'Count von Count', avatar: 'https://static.wikia.nocookie.net/muppet/images/2/2a/CountVonCount-2018.png' },
  { id: 12, name: 'Snuffy', avatar: 'https://static.wikia.nocookie.net/muppet/images/2/2c/Snuffy-2018.png' },
];

const posts = [
  // ... (same posts array as ProfileScreen.js)
];

export default function ProfileModal({ navigation, route }) {
  const { userId } = route.params;
  const user = users.find(u => u.id === userId);
  const userPosts = posts.filter(p => p.user.id === userId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <View style={{ flex: 1 }}>
        <Pressable style={{ alignSelf: 'flex-end', padding: 20 }} onPress={() => navigation.goBack()}>
          <MaterialIcons name="close" size={32} color="#8BA637" />
        </Pressable>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <Image source={{ uri: user.avatar }} style={styles.profileImage} />
          <View style={styles.row}>
            <Text style={styles.name}>{user.name}</Text>
            <MaterialIcons name="verified" size={20} color="#8BA637" style={{ marginLeft: 4 }} />
          </View>
          <Text style={styles.handle}>@{user.name.toLowerCase().replace(/\s/g, '')}</Text>
          <Text style={styles.bio}>This is {user.name}'s bio.</Text>
          <View style={styles.gridList}>
            {userPosts.map((item, index) => (
              <Pressable key={item.id} style={styles.postCard}>
                <Image
                  source={{ uri: item.imageUri }}
                  style={[
                    styles.gridImg,
                    ((index + 1) % 3 === 0) && { marginRight: 0 }
                  ]}
                />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 0.5,
    borderColor: '#b9b9b9',
    marginTop: 69,
    marginLeft: 35,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 128,
    marginTop: -80,
  },
  name: {
    fontSize: 20,
    fontFamily: 'PatrickHand-Regular',
    color: '#53544D',
  },
  handle: {
    fontSize: 16,
    fontFamily: 'PatrickHand-Regular',
    color: '#b9b9b9',
    marginLeft: 128,
    marginTop: 0,
  },
  bio: {
    marginTop: 28,
    marginLeft: 35,
    marginRight: 35,
    color: '#53544D',
    fontFamily: 'PatrickHand-Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  gridList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 40,
    marginHorizontal: gridMargin,
  },
  gridImg: {
    width: imgSize,
    height: imgSize,
    borderRadius: 5,
    marginBottom: gridMargin,
    marginRight: gridMargin,
    backgroundColor: '#ccc',
  },
  postCard: {},
}); 