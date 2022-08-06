import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import express from "express";
const router = express.Router();
const db = admin.firestore();

import { checkIfAuthenticated } from "./middleware/authMiddleware";

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  READ
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */
router.get("/profile/:uid", checkIfAuthenticated, async (req, res) => {
	const uid = req.params.uid;
	const profileData = await getUserData(uid);
	functions.logger.log(profileData);
	res.status(200).json(profileData);
});

/**
 * Checks if this user has a Civil License
 */
router.get("/authorizing", checkIfAuthenticated, async (req, res) => {
	const license = await db
		.collection("licenses")
		.where("userID", "==", req["currentUser"])
		.limit(1)
		.get();
	if (license.empty) {
		return res.status(401).send("Access denied");
	} else {
		return res.status(200).send("Authorized");
	}
});

/**
 * Returns the value of the "provisioned" field in the user's document, or false if not found.
 */
exports.isProvisioned = functions.https.onCall(async (data, context) => {
	if (!context.auth) return;
	const userData = await getUserData(context.auth.uid);
	if (userData && userData.provisioned) {
		return { provisioned: userData.provisioned };
	}
	return { provisioned: false };
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

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  UPDATE
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */
router.post("/profile/:uid", checkIfAuthenticated, async (req, res) => {
	const uid = req.params.uid;

	db.collection("users")
		.doc(uid)
		.update({
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			schoolName: req.body.schoolName,
			location: req.body.location,
			jobTitle: req.body.jobTitle,
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

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  CLAIMS
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */
export async function grantTeacherRole(uid: string) {
	console.log("UID", uid);
	// set the claim for the user
	const user = await admin.auth().getUser(uid);
	let claims = user.customClaims;
	if (claims) {
		claims.teacher = true;
		claims.paid = true;
	} else {
		claims = { teacher: true, paid: true };
	}

	await admin.auth().setCustomUserClaims(user.uid, claims);
}

export async function revokeTeacherRole(uid: string) {
	// revoke teacher and paid claims
	const user = await admin.auth().getUser(uid);
	await admin.auth().setCustomUserClaims(user.uid, {
		teacher: null,
		paid: null,
	});
}

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  DATABASE TRIGGERS
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */

/** Deletes the document in "/users" for the deleted user */
exports.deleteUser = functions.auth.user().onDelete(async (user) => {
	await db.collection("users").doc(user.uid).delete();
});

export default router;
