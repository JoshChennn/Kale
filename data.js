// This file is no longer used. All data is now fetched from Firebase Firestore.
// The initial data should be seeded into your Firestore database.
// You can create users via the app's new signup screen.
// The `onUserCreate` cloud function will automatically create their user profile document.
//
// Example User Structure in Firestore (/users/{uid}):
// {
//   name: "Big Bird",
//   handle: "@bigbird",
//   avatar: "url_to_avatar",
//   bio: "...",
//   following: ["uid_of_elmo", "uid_of_cookie"],
//   followersCount: 100,
//   followingCount: 2
// }
//
// Example Post Structure in Firestore (/posts/{postId}):
// {
//   userId: "uid_of_big_bird",
//   userName: "Big Bird",
//   userAvatar: "url_to_avatar",
//   imageUri: "url_to_image",
//   caption: "A sunny day!",
//   tags: ["@elmo"],
//   commentsCount: 0,
//   createdAt: Timestamp
// }

export const users = [];
export const posts = [];