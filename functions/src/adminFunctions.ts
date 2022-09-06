import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as express from "express";
const router = express.Router();
const db = admin.firestore();

import { checkIfAdmin } from "./middleware/authMiddleware";
import { grantClaims, revokeClaim, getUserData, revokeAllClaims } from "./userFunctions";
import { logError } from "./util/debug";

router.post("/grantAdmin", checkIfAdmin, async (req, res) => {
	const userToGrantAdmin = req.body.email;
	const user = await admin.auth().getUserByEmail(userToGrantAdmin);

	await admin.auth().setCustomUserClaims(user.uid, {
		admin: true,
		paid: true,
	});

	await db.collection("admins").doc(user.uid).set({ email: user.email });
	res.status(200).send("Granted admin privilege");
});

router.post("/revokeAdmin", checkIfAdmin, async (req) => {
	const userToGrantAdmin = req.body.email;
	const user = await admin.auth().getUserByEmail(userToGrantAdmin);

	await admin.auth().setCustomUserClaims(user.uid, {
		admin: false,
		paid: false,
	});
});

router.post("/provisionUser", checkIfAdmin, async (req, res) => {
	const userToProvision = req.body.user;
	const user = await admin.auth().getUserByEmail(userToProvision);
	if (!user) {
		return res.status(404).send("Could not find user with email " + userToProvision);
	}
	await grantClaims(user.uid, ["paid"]);
	return res.status(200).send("Provisioned " + userToProvision);
});

router.post("/unprovisionUser", checkIfAdmin, async (req, res) => {
	const userEmail = req.body.user;
	const user = await admin.auth().getUserByEmail(userEmail);
	if (!user) {
		return res.status(404).send("Could not find user with email " + userEmail);
	}
	await revokeClaim(user.uid, "paid");
	return res.status(200).send("Unprovisioned " + userEmail);
});

router.post("/makeStudent", checkIfAdmin, async (req, res) => {
	const userEmail = req.body.user;
	const user = await admin.auth().getUserByEmail(userEmail);
	if (!user) return res.status(404).send("Could not find a user with that email");
	await revokeAllClaims(user.uid);
	await grantClaims(user.uid, ["student", "paid"]);
	return res.status(200).send("Made " + userEmail + " a student");
});

router.post("/makeTeacher", checkIfAdmin, async (req, res) => {
	const userEmail = req.body.user;
	const user = await admin.auth().getUserByEmail(userEmail);
	if (!user) return res.status(404).send("Could not find a user with that email");
	await revokeAllClaims(user.uid);
	await grantClaims(user.uid, ["teacher"]);
	return res.status(200).send("Made " + userEmail + " a teacher");
});

router.get("/user", checkIfAdmin, async (req, res) => {
	const uid = req.query.uid;
	const email = req.query.email;

	let user;
	if (uid) {
		if (typeof uid !== "string") return res.status(400).send("Incorrect param type for uid");
		user = await admin.auth().getUser(uid);
		if (!user) return res.status(404).send("Could not find user with id " + uid);
	}
	if (email) {
		if (typeof email !== "string") return res.status(400).send("Incorrect param type for email");
		user = await admin.auth().getUserByEmail(email);
		if (!user) return res.status(404).send("Could not find user with email " + email);
	}
	const userData = await getUserData(user.uid);
	userData.uid = user.uid; // add in the user id
	userData.claims = user.customClaims;
	return res.status(200).send(userData);
});

/**
 * Create documents for users that signed up with the old flow
 * https://firebase.google.com/docs/auth/admin/manage-users?hl=en#list_all_users
 */
exports.createUserDocumentIfNotFound = functions.https.onRequest(async () => {
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
				logError("(ADMIN)", "Error listing users: " + err);
			});
	};

	return await allUsers();
});

export default router;
