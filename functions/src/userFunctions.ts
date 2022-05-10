import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
const db = admin.firestore();

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  PROFILE
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */

exports.getProfileData = functions.https.onCall(async (data, context) => {
  if (!context.auth) return null;
  const profileData = getUserData(context.auth.uid);
  return profileData;
});

exports.updateProfileData = functions.https.onCall(async (data, context) => {
  if (!context.auth) return;
  const userDocRef = db.collection("users").doc(context.auth.uid);
  userDocRef
      .update({
        firstName: data.firstName,
        lastName: data.lastName,
        schoolName: data.schoolName,
        location: data.location,
        jobTitle: data.jobTitle,
      })
      .then((result) => {
        console.log("Success: Updated user information", result);
        return null;
      })
      .catch((err) => {
        console.log("Could not update user's information", err);
        return null;
      });
});

/**
 * Provision a user. When provisioned, a user has access to Civil's content.
 * @param {string} email The email of the user who we want to provision
 * @return {Promise<void>} null
 */
export async function provisionUser(email: string): Promise<void> {
  const snapshot = await admin.firestore().collection("users").where("email", "==", email).limit(1).get();
  if (!snapshot.empty) {
    const userDoc = snapshot.docs[0].ref;
    await userDoc.update({provisioned: true});
  } else {
    functions.logger.log("No user with that email could be found.");
    return;
  }
}

/**
 * Returns the value of the "provisioned" field in the user's document, or false if not found.
 */
exports.isProvisioned = functions.https.onCall(async (data, context) => {
  if (!context.auth) return;
  const userData = await getUserData(context.auth.uid);
  if (userData && userData.provisioned) {
    return {provisioned: userData.provisioned};
  }
  return {provisioned: false};
});

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  HELPER FUNCTIONS
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */

/**
 * Gets the document in "/users" collection by uid and returns its data
 * @param {string} uid The uid of the user
 * @return {any} A JSON object of the user's data | NULL if not found
 */
async function getUserData(uid: string): Promise<any> {
  const userDoc = await db.collection("users").doc(uid).get();
  if (userDoc.exists) {
    const userData = userDoc.data();
    if (userData) return userData;
  }
  return null;
}

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  DATABASE TRIGGERS
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */

/** Sets the user to un-provisioned when they are created */
exports.initializeUserOnCreate = functions.auth.user().onCreate(async (user) => {
  const userDoc = db.collection("users").doc(user.uid);
  await userDoc.update({provisioned: false});
});

/** Deletes the document in "/users" for the deleted user */
exports.deleteUser = functions.auth.user().onDelete(async (user) => {
  await db.collection("users").doc(user.uid).delete();
});

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  ADMIN FUNCTIONS
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */

/**
 * Check all documents in "/users" that a user with that id exists, and delete if not found.
 */
exports.deleteUserDocumentIfUserNotFound = functions.https.onRequest(async (req, res) => {
  const usersSnapshot = await db.collection("users").get();
  const deletedUsers = [];
  for (let index = 0; index < usersSnapshot.docs.length; index++) {
    const doc = usersSnapshot.docs[index];
    await admin
        .auth()
        .getUser(doc.id)
        .catch((error) => {
          functions.logger.error("Deleting {" + doc.data().email + "}");
          deletedUsers.push(doc.data().email);
          doc.ref.delete();
        });
  }
  res.status(200).send("Deleted " + deletedUsers.length + " user docs.");
});

/**
 * Create documents for users that signed up with the old flow
 * https://firebase.google.com/docs/auth/admin/manage-users?hl=en#list_all_users
 */
exports.createUserDocumentIfNotFound = functions.https.onRequest(async (req, res) => {
  const allUsers = async (nextPageToken?: any) => {
    admin
        .auth()
        .listUsers(1000, nextPageToken)
        .then((listUsersResult) => {
          listUsersResult.users.forEach(async (userRecord) => {
            const userDoc = await db.collection("users").doc(userRecord.uid).get();
            if (!userDoc.exists) {
              db.collection("users").doc(userRecord.uid).set({
                email: userRecord.email,
                firstName: "",
                lastName: "",
                schoolName: "",
                location: "",
                jobTitle: "",
                referral: "",
                provisioned: true,
              });
            }
          });
          if (listUsersResult.pageToken) {
            // List next batch of users (1000)
            allUsers(listUsersResult.pageToken);
          }
        })
        .catch((err) => {
          console.log("Error listing users:", err);
        });
  };

  return await allUsers();
});
