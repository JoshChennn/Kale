/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onRequest, onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// --- Find Users By Phone Number ---
export const findUsersByPhoneNumbers = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const phoneNumbers = request.data.phoneNumbers;
    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        throw new HttpsError('invalid-argument', 'The function must be called with an array of phone numbers.');
    }

    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('phoneNumber', 'in', phoneNumbers).get();

        if (snapshot.empty) {
            return { users: [] };
        }

        const users: any[] = [];
        snapshot.forEach(doc => {
            const userData = doc.data();
            users.push({
                uid: doc.id,
                phoneNumber: userData.phoneNumber,
                displayName: userData.displayName,
                username: userData.username,
                photoURL: userData.photoURL,
                firstName: userData.firstName,
            });
        });

        return { users };
    } catch (error) {
        logger.error('Error finding users by phone numbers:', error);
        throw new HttpsError('internal', 'An error occurred while fetching users.');
    }
});

// --- Handle Follow Request ---
export const handleFollowRequest = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const currentUserId = request.auth.uid;
    const { requestingUserId, action } = request.data;
    if (!requestingUserId || !action) {
        throw new HttpsError('invalid-argument', 'The function must be called with a "requestingUserId" and "action".');
    }

    const currentUserRef = db.doc(`users/${currentUserId}`);
    const requestingUserRef = db.doc(`users/${requestingUserId}`);
    const requestDocRef = currentUserRef.collection('followRequests').doc(requestingUserId);

    const batch = db.batch();

    if (action === 'accept') {
        const followingRef = db.doc(`following/${currentUserId}/userFollowing/${requestingUserId}`);
        const followerRef = db.doc(`followers/${requestingUserId}/userFollowers/${currentUserId}`);

        batch.set(followingRef, { createdAt: admin.firestore.FieldValue.serverTimestamp() });
        batch.set(followerRef, { createdAt: admin.firestore.FieldValue.serverTimestamp() });
        batch.delete(requestDocRef);

        const notificationRef = requestingUserRef.collection('notifications').doc();
        batch.set(notificationRef, {
            type: 'follow_accepted',
            acceptorId: currentUserId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

    } else if (action === 'ignore') {
        batch.delete(requestDocRef);
    } else {
        throw new HttpsError('invalid-argument', 'Invalid action provided. Must be "accept" or "ignore".');
    }

    try {
        await batch.commit();
        return { success: true };
    } catch (error) {
        logger.error(`Error handling follow request for user ${currentUserId}:`, error);
        throw new HttpsError('internal', 'An error occurred while handling the follow request.');
    }
});
