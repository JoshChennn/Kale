// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * This function runs when a new user is created via Firebase Auth.
 * It creates a corresponding user document in Firestore.
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
    // Set the initial cleared timestamp to now, so new users don't see old posts
    lastClearedTimestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
});

/**
 * Updates the user's lastClearedTimestamp to the current time.
 * This is called when the user holds the button to clear their feed.
 */
exports.clearPosts = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    console.error("Clear posts called without authentication");
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to clear posts.");
  }
  
  const userId = context.auth.uid;
  const userRef = db.collection("users").doc(userId);

  try {
    // First check if the user document exists
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log(`Creating missing user document for userId: ${userId}`);
      // Create a basic user document if it doesn't exist
      await userRef.set({
        uid: userId,
        displayName: context.auth.token.name || 'New User',
        username: (context.auth.token.email || 'user').split('@')[0] + Math.floor(Math.random() * 900 + 100),
        photoURL: context.auth.token.picture || null,
        bio: 'Hi, I\'m new here!',
        onboardingCompleted: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastClearedTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // Update the timestamp if document exists
      await userRef.set({
        lastClearedTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    console.log(`Successfully cleared posts for user: ${userId}`);
    return { success: true, message: "Posts cleared successfully." };
  } catch (error) {
    console.error("Error in clearPosts function:", error);
    
    // Provide more specific error messages based on the error type
    if (error.code === 'permission-denied') {
      throw new functions.https.HttpsError("permission-denied", "You don't have permission to clear posts.");
    } else {
      throw new functions.https.HttpsError("internal", "Could not update your feed status. Please try again.");
    }
  }
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

  const batch = db.batch();

  // 1. Create the follow request in followRequests subcollection
  const requestRef = db.collection("users").doc(userIdToFollow)
                       .collection("followRequests").doc(requesterId);
  
  batch.set(requestRef, {
    requesterName: requesterData.displayName || "A user",
    requesterAvatar: requesterData.photoURL || null,
    requesterUsername: requesterData.username || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 2. Create a notification in notifications subcollection for the FeedScreen
  const notificationRef = db.collection("users").doc(userIdToFollow)
                            .collection("notifications").doc(requesterId);
  
  batch.set(notificationRef, {
    type: 'follow_request',
    requesterName: requesterData.displayName || "A user",
    requesterUsername: requesterData.username || null,
    requesterAvatar: requesterData.photoURL || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();

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

    const batch = db.batch();

    // 1. Delete the follow request from followRequests subcollection
    const requestRef = db.collection("users").doc(userIdToWithdrawFrom)
                         .collection("followRequests").doc(requesterId);
    batch.delete(requestRef);

    // 2. Delete the notification from notifications subcollection
    const notificationRef = db.collection("users").doc(userIdToWithdrawFrom)
                              .collection("notifications").doc(requesterId);
    batch.delete(notificationRef);
    
    await batch.commit();
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
    
    if (action === 'accept') {
        const batch = db.batch();

        const currentUserDoc = await db.collection("users").doc(currentUserId).get();
        if (!currentUserDoc.exists) {
            throw new functions.https.HttpsError("not-found", "Current user profile not found.");
        }
        const currentUserData = currentUserDoc.data();

        // Get the requester data for the notification
        const requesterDoc = await db.collection("users").doc(requestingUserId).get();
        if (!requesterDoc.exists) {
            throw new functions.https.HttpsError("not-found", "Requesting user profile not found.");
        }
        const requesterData = requesterDoc.data();

        // 1. Create following/follower relationship
        const followingRef = db.collection("following").doc(requestingUserId).collection("userFollowing").doc(currentUserId);
        batch.set(followingRef, { createdAt: admin.firestore.FieldValue.serverTimestamp() });
        
        const followerRef = db.collection("followers").doc(currentUserId).collection("userFollowers").doc(requestingUserId);
        batch.set(followerRef, { createdAt: admin.firestore.FieldValue.serverTimestamp() });

        // 2. Create a notification for the requester ("Your request was accepted")
        const notificationRef = db.collection("users").doc(requestingUserId).collection("notifications").doc(currentUserId);
        batch.set(notificationRef, {
            type: 'follow_accepted',
            acceptorName: currentUserData.displayName || "A user",
            acceptorUsername: currentUserData.username || null,
            acceptorAvatar: currentUserData.photoURL || null,
            acceptorId: currentUserId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 2b. Create a notification for the acceptor ("[username] is now following you.")
        // Only create if acceptor is NOT already following the requester
        const acceptorFollowingRequesterRef = db.collection("following").doc(currentUserId).collection("userFollowing").doc(requestingUserId);
        const acceptorFollowingRequesterDoc = await acceptorFollowingRequesterRef.get();
        if (!acceptorFollowingRequesterDoc.exists) {
          const nowFollowingNotificationRef = db.collection("users").doc(currentUserId).collection("notifications").doc(requestingUserId + "_now_following_you");
          batch.set(nowFollowingNotificationRef, {
              type: 'now_following_you',
              followerName: requesterData.displayName || "A user",
              followerUsername: requesterData.username || null,
              followerAvatar: requesterData.photoURL || null,
              followerId: requestingUserId,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        // 3. Delete the original request from the current user's followRequests
        const requestDocRef = db.collection("users").doc(currentUserId)
                              .collection("followRequests").doc(requestingUserId);
        batch.delete(requestDocRef);

        // 4. Delete the notification from the current user's notifications
        const currentUserNotificationRef = db.collection("users").doc(currentUserId)
                                            .collection("notifications").doc(requestingUserId);
        batch.delete(currentUserNotificationRef);

        await batch.commit();
        return { success: true, message: "Request accepted." };
    } else { // action === 'ignore'
        const batch = db.batch();

        // 1. Delete the request from followRequests subcollection
        const requestDocRef = db.collection("users").doc(currentUserId)
                                  .collection("followRequests").doc(requestingUserId);
        batch.delete(requestDocRef);

        // 2. Delete the notification from notifications subcollection
        const notificationRef = db.collection("users").doc(currentUserId)
                                    .collection("notifications").doc(requestingUserId);
        batch.delete(notificationRef);
        
        await batch.commit();
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