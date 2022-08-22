import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { slackNewUserNotification, slackSignupNotification } from "./slackFunctions";

import express from "express";
const router = express.Router();
const db = admin.firestore();

import { checkIfAuthenticated } from "./middleware/authMiddleware";

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  CREATE
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */

exports.sendUserDataToSlack = functions.firestore
	.document("users/{userId}")
	.onCreate(async (snapshot, context) => {
		const { email, firstName, lastName, jobTitle, schoolName, location, referral } =
			snapshot.data();
		slackSignupNotification(email, firstName, lastName, jobTitle, schoolName, location, referral);
	});

exports.handleNewUser = functions.auth.user().onCreate(async (user) => {
	functions.logger.warn("Posting Signup to Slack");
	slackNewUserNotification(user.email, user.uid);
});

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  PROFILE
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */

router.get("/profile/:uid", checkIfAuthenticated, async (req, res) => {
	const uid = req.params.uid;
	const profileData = await getUserData(uid);
	functions.logger.log(profileData);
	res.status(200).json(profileData);
});

/**
 * Gets the document in "/users" collection by uid and returns its data
 * @param {string} uid The uid of the user
 * @return {any} A JSON object of the user's data | NULL if not found
 */
export async function getUserData(uid: string): Promise<any> {
	const userDoc = await db.collection("users").doc(uid).get();
	if (userDoc.exists) {
		const userData = userDoc.data();
		if (userData) return userData;
	}
	return null;
}

router.post("/profile/:uid", checkIfAuthenticated, async (req, res) => {
	const uid = req.params.uid;
	const data = {};
	if (req.body.firstName) data["firstName"] = req.body.firstName;
	if (req.body.lastName) data["lastName"] = req.body.lastName;
	if (req.body.schoolName) data["schoolName"] = req.body.schoolName;
	if (req.body.location) data["location"] = req.body.location;
	if (req.body.jobTitle) data["jobTitle"] = req.body.jobTitle;
	if (req.body.email) data["email"] = req.body.email;

	db.collection("users")
		.doc(uid)
		.update(data)
		.then((result) => {
			console.log("Success: Updated user information", result);
			res.status(200).send("Updated profile successfully");
		})
		.catch((err) => {
			console.log("Could not update user's information", err);
			res.status(400).send("Could not update profile.");
		});
});

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  CLAIMS
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */

export async function grantClaim(uid: string, claimName: string) {
	await admin
		.auth()
		.getUser(uid)
		.then(async (user) => {
			let claims = user.customClaims;
			if (!claims) claims = {};
			claims[claimName] = true;
			await admin.auth().setCustomUserClaims(user.uid, claims);
		})
		.catch(() => {
			throw Error("Unable to grant " + claimName + " claim for user " + uid);
		});
}

export async function revokeClaim(uid: string, claimName: string) {
	await admin
		.auth()
		.getUser(uid)
		.then(async (user) => {
			let claims = user.customClaims;
			if (claims) claims[claimName] = null;
			else claims = { claimName: null };
			await admin.auth().setCustomUserClaims(user.uid, claims);
		})
		.catch(() => {
			throw Error("Unable to grant " + claimName + " claim for user " + uid);
		});
}

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  METADATA
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */

// set the user's token expiration to now so it refreshes
export async function notifyClientToRefreshToken(uid) {
	await db.collection("metadata").doc(uid).set({ refreshTime: new Date().getTime() });
}

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  DATABASE TRIGGERS
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */

/** Deletes the document in "/users" for the deleted user */
exports.deleteUser = functions.auth.user().onDelete(async (user) => {
	await db.collection("users").doc(user.uid).delete();
});

export default router;
