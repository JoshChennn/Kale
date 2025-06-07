// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
// REMOVED: const { onCall, HttpsError } = require("firebase-functions/v2/https");

admin.initializeApp();

const db = admin.firestore();

// This function is fine as it is (v1 trigger)
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName, photoURL } = user;
  const name = displayName || email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
  const atHandle = name.toLowerCase();
  const searchableName = atHandle;

  return db.collection("users").doc(uid).set({
    name: name,
    handle: `@${atHandle}`,
    searchableName: searchableName,
    avatar: photoURL || `https://i.pravatar.cc/150?u=${uid}`,
    bio: `Hi, I'm ${name}!`,
    following: [],
    followersCount: 0,
    followingCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});

// ✅ REWRITTEN using v1 syntax to match the client
exports.toggleFollowUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to follow users."
    );
  }
  const currentUserId = context.auth.uid;
  const { userIdToFollow } = data;

  if (!userIdToFollow || currentUserId === userIdToFollow) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid request.");
  }
  const currentUserRef = db.collection("users").doc(currentUserId);
  const userToFollowRef = db.collection("users").doc(userIdToFollow);

  return db.runTransaction(async (transaction) => {
    const currentUserDoc = await transaction.get(currentUserRef);
    if (!currentUserDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Current user not found.");
    }
    const following = currentUserDoc.data().following || [];
    if (following.includes(userIdToFollow)) {
      transaction.update(currentUserRef, {
        following: admin.firestore.FieldValue.arrayRemove(userIdToFollow),
        followingCount: admin.firestore.FieldValue.increment(-1),
      });
      transaction.update(userToFollowRef, {
        followersCount: admin.firestore.FieldValue.increment(-1),
      });
      return { status: "unfollowed" }; // Return a success message
    } else {
      transaction.update(currentUserRef, {
        following: admin.firestore.FieldValue.arrayUnion(userIdToFollow),
        followingCount: admin.firestore.FieldValue.increment(1),
      });
      transaction.update(userToFollowRef, {
        followersCount: admin.firestore.FieldValue.increment(1),
      });
      return { status: "followed" }; // Return a success message
    }
  });
});