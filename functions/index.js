// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * This function runs when a new user is created via Firebase Auth.
 * It creates a corresponding user document in Firestore.
 * NOTE: We will keep this function as it is useful for user setup.
 */
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName, photoURL } = user;
  
  // Create a default display name and username from email if not provided
  const name = displayName || (email ? email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "") : "New User");
  const username = name.toLowerCase() + Math.floor(Math.random() * 900 + 100);

  return db.collection("users").doc(uid).set({
    // New fields based on onboarding flow
    uid: uid,
    firstName: '',
    lastName: '',
    displayName: name,
    username: username,
    photoURL: photoURL || null,
    bio: `Hi, I'm ${name}!`,
    phoneNumber: user.phoneNumber || null,
    onboardingCompleted: false, // Default to false
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});


// --- NEW PRIVATE ACCOUNT FUNCTIONS ---
// The following four functions replace the old `toggleFollowUser` logic.

/**
 * Creates a follow request document in the target user's 'followRequests' subcollection.
 * Called when a user clicks "Follow" on a private profile.
 */
exports.requestToFollowUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to follow users.");
  }

  const requesterId = context.auth.uid;
  const userIdToFollow = data.userIdToFollow;

  if (!userIdToFollow) {
    throw new functions.https.HttpsError("invalid-argument", "Missing userIdToFollow.");
  }
  if (requesterId === userIdToFollow) {
    throw new functions.https.HttpsError("invalid-argument", "You cannot follow yourself.");
  }

  const requesterDoc = await db.collection("users").doc(requesterId).get();
  if (!requesterDoc.exists) {
     throw new functions.https.HttpsError("not-found", "Requesting user profile not found.");
  }
  const requesterData = requesterDoc.data();

  const requestRef = db.collection("users").doc(userIdToFollow)
                       .collection("followRequests").doc(requesterId);
  
  await requestRef.set({
    requesterName: requesterData.displayName || "A user",
    requesterAvatar: requesterData.photoURL || null,
    requesterUsername: requesterData.username || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, message: "Follow request sent." };
});

/**
 * Deletes a follow request document.
 * Called when a user clicks "Requested" to cancel their own request.
 */
exports.withdrawFollowRequest = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }
    const requesterId = context.auth.uid;
    const userIdToWithdrawFrom = data.userIdToWithdrawFrom;

    if (!userIdToWithdrawFrom) {
        throw new functions.https.HttpsError("invalid-argument", "Missing userIdToWithdrawFrom.");
    }

    const requestRef = db.collection("users").doc(userIdToWithdrawFrom)
                         .collection("followRequests").doc(requesterId);
    
    await requestRef.delete();
    return { success: true, message: "Follow request withdrawn." };
});

/**
 * Handles an incoming follow request: "Accept" or "Ignore".
 * If "accept", creates the following/follower relationship and deletes the request.
 * If "ignore", just deletes the request.
 */
exports.handleFollowRequest = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }
    const currentUserId = context.auth.uid; // The user accepting/ignoring
    const requestingUserId = data.requestingUserId;
    const action = data.action; // 'accept' or 'ignore'

    if (!requestingUserId || !action) {
        throw new functions.https.HttpsError("invalid-argument", "Missing parameters.");
    }
    if (action !== 'accept' && action !== 'ignore') {
        throw new functions.https.HttpsError("invalid-argument", "Invalid action.");
    }

    const requestRef = db.collection("users").doc(currentUserId)
                         .collection("followRequests").doc(requestingUserId);
    
    if (action === 'accept') {
        const batch = db.batch();

        const followingRef = db.collection("following").doc(requestingUserId)
                               .collection("userFollowing").doc(currentUserId);
        batch.set(followingRef, { createdAt: admin.firestore.FieldValue.serverTimestamp() });
        
        const followerRef = db.collection("followers").doc(currentUserId)
                              .collection("userFollowers").doc(requestingUserId);
        batch.set(followerRef, { createdAt: admin.firestore.FieldValue.serverTimestamp() });

        batch.delete(requestRef);

        await batch.commit();
        return { success: true, message: "Request accepted." };
    } else { // action === 'ignore'
        await requestRef.delete();
        return { success: true, message: "Request ignored." };
    }
});

/**
 * Removes the two-way follow relationship between two users.
 * Called when a user clicks "Following" and confirms the unfollow action.
 */
exports.unfollowUser = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }
    const currentUserId = context.auth.uid;
    const userIdToUnfollow = data.userIdToUnfollow;

    if (!userIdToUnfollow) {
        throw new functions.https.HttpsError("invalid-argument", "Missing userIdToUnfollow.");
    }

    const batch = db.batch();

    // Remove from the current user's "following" list
    const followingRef = db.collection("following").doc(currentUserId)
                           .collection("userFollowing").doc(userIdToUnfollow);
    batch.delete(followingRef);

    // Remove the current user from the other user's "followers" list
    const followerRef = db.collection("followers").doc(userIdToUnfollow)
                          .collection("userFollowers").doc(currentUserId);
    batch.delete(followerRef);
    
    await batch.commit();
    return { success: true, message: "User unfollowed." };
});