import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { slackTeacherSignupNotification, slackStudentSignupNotification } from "./slackFunctions";

import express from "express";
const router = express.Router();
const db = admin.firestore();

import { checkIfAuthenticated, checkIfUser } from "./middleware/authMiddleware";
import { logError, logMessage } from "./util/debug";
import { Timestamp } from "firebase-admin/firestore";
import { getUserSubscriptionInfo as getUserSubscriptionInfo } from "./stripeFunctions";
import { addSubscriber } from "./mailchimpFunctions";

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  CREATE
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */

router.get("/checkIfApproved", async (req, res) => {
	await logMessage("(GET /checkIfApproved)", "endpoint called");
	const { email } = req.query;
	if (!email || typeof email !== "string") {
		return res.status(400).send("No email included in request body.");
	}
	const domain = email.split("@").pop();
	if (!domain) return res.status(400).send("Please enter a valid email");
	console.log(domain);
	await db
		.collection("domains")
		.where("name", "==", domain)
		.get()
		.then((domainRes) => {
			if (domainRes.empty) {
				return res
					.status(400)
					.send(
						"This email domain is not associated with a registered school. Please contact your school administrator to get your school on Civil."
					);
			} else return res.status(200).send("This domain is approved.");
		});
	return res.status(400).send();
});

router.post("/create/student/:uid", async (req, res) => {
	await logMessage("(POST /create/student/:uid)", "endpoint called");

	const uid = req.params.uid;
	const { email, firstName, lastName, grade, graduateYear, newsletter } = req.body;

	const studentData = {
		uid,
		role: "student",
		email,
		firstName,
		lastName,
		grade,
		graduateYear,
		newsletter,
	};

	await Promise.allSettled([
		grantClaims(uid, ["student", "paid"]),
		slackStudentSignupNotification(studentData),
		addSubscriber(studentData, "Student"),
		db.collection("users").doc(uid).set(studentData),
	]);
	res.status(200).send();
});

router.post("/create/teacher/:uid", async (req, res) => {
	await logMessage("(post /create/teacher/:uid)", "endpoint called");
	const uid = req.params.uid;
	const { email, firstName, lastName, jobTitle, schoolName, location, referral, newsletter } =
		req.body;

	const teacherData = {
		uid,
		role: "teacher",
		email,
		firstName,
		lastName,
		jobTitle,
		schoolName,
		location,
		referral,
		newsletter,
	};

	await Promise.allSettled([
		grantClaims(uid, ["teacher"]),
		slackTeacherSignupNotification(teacherData),
		addSubscriber(teacherData, "Teacher"),
		db.collection("users").doc(uid).set(teacherData),
	]);
	res.status(200).send();
});

exports.handleNewUser = functions.auth.user().onCreate(async (user) => {
	functions.logger.debug("New user: " + user.uid);
});

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  PROFILE
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */

router.get("/profile/:uid", checkIfAuthenticated, async (req, res) => {
	await logMessage("(get /profile/:uid)", "endpoint called");
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
	await logMessage("(post /profile/:uid)", "endpoint called");
	const uid = req.params.uid;
	const data = {};
	if (req.body.firstName) data["firstName"] = req.body.firstName;
	if (req.body.lastName) data["lastName"] = req.body.lastName;
	if (req.body.schoolName) data["schoolName"] = req.body.schoolName;
	if (req.body.email) data["email"] = req.body.email;
	// Teacher only
	if (req.body.location) data["location"] = req.body.location;
	if (req.body.jobTitle) data["jobTitle"] = req.body.jobTitle;
	// Student only
	if (req.body.grade) data["grade"] = req.body.grade;
	if (req.body.graduateYear) data["graduateYear"] = req.body.graduateYear;

	db.collection("users")
		.doc(uid)
		.update(data)
		.then(async () => {
			await notifyClientToRefreshToken(uid);
			res.status(200).send("Updated profile successfully");
		})
		.catch((err) => {
			logError("(User)", "Could not update user's information" + err);
			res.status(400).send("Could not update profile.");
		});
});

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  CLAIMS
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */

export async function grantClaims(uid: string, claimNames: string[]) {
	await admin
		.auth()
		.getUser(uid)
		.then(async (user) => {
			let claims = user.customClaims;
			if (!claims) claims = {};

			for (const claimName of claimNames) {
				claims[claimName] = true;
			}

			await admin.auth().setCustomUserClaims(user.uid, claims);
			await notifyClientToRefreshToken(user.uid);
		})
		.catch(() => {
			throw Error("Unable to grant " + claimNames + " claim for user " + uid);
		});
}

export async function revokeClaim(uid: string, claimName: string) {
	await admin
		.auth()
		.getUser(uid)
		.then(async (user) => {
			const newClaims = {};
			for (const i in user.customClaims) {
				if (i !== claimName) newClaims[i] = true;
			}
			await admin.auth().setCustomUserClaims(user.uid, newClaims);
			await notifyClientToRefreshToken(user.uid);
		})
		.catch(() => {
			throw Error("Unable to grant " + claimName + " claim for user " + uid);
		});
}

export async function setRole(uid: string, role: string) {
	try {
		const user = await admin.auth().getUser(uid);
		let oldClaims = user.customClaims;
		if (!oldClaims) oldClaims = {};

		const newClaims = {};
		if (oldClaims["paid"]) newClaims["paid"] = true;

		switch (role) {
			case "student":
				newClaims["student"] = true;
				db.collection("users").doc(uid).update({ role: "student" });
				break;
			case "teacher":
				newClaims["teacher"] = true;
				db.collection("users").doc(uid).update({ role: "teacher" });
				break;
			default:
				throw Error("This role is not supported.");
		}
		await admin.auth().setCustomUserClaims(user.uid, newClaims);
		await notifyClientToRefreshToken(user.uid);
	} catch (err) {
		throw Error("Unable to set role " + role + " for user " + uid);
	}
}

export async function revokeAllClaims(uid: string) {
	await admin.auth().setCustomUserClaims(uid, null);
	await notifyClientToRefreshToken(uid);
}

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  SUBSCRIPTION
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */
router.get("/subscription", checkIfUser, async (req, res) => {
	await logMessage("(/subscription)", "endpoint called");
	const uid = req["currentUser"];
	const subscriptionInfo = await getUserSubscriptionInfo(uid);
	return res.send(subscriptionInfo);
});

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  METADATA
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */

// set the user's token expiration to now so it refreshes
export async function notifyClientToRefreshToken(uid) {
	await db
		.collection("metadata")
		.doc(uid)
		.set({ refreshTime: Timestamp.fromDate(new Date()) }, { merge: true });
}

/* +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 *  DATABASE TRIGGERS
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+= */

/** Deletes the document in "/users" for the deleted user */
exports.deleteUser = functions.auth.user().onDelete(async (user) => {
	await db.collection("users").doc(user.uid).delete();
});

export default router;
