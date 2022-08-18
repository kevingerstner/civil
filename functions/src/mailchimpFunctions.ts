import * as express from "express";
const router = express.Router();

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
const db = admin.firestore();

const md5 = require("md5");
const mcApiKey = process.env.MAILCHIMP_API_KEY;
const Mailchimp = require("mailchimp-api-v3");
const mailchimp = new Mailchimp(mcApiKey);
const listId = process.env.MAILCHIMP_AUDIENCEID;

/* +-=+-=+-=+-=+-=+-=+-=+-=+-=+-=+-=+-=
 * SUBSCRIBE
 * +-=+-=+-=+-=+-=+-=+-=+-=+-=+-=+-=+-=*/
router.post("/subscribe", async (req, res) => {
	try {
		const email = req.body.email;
		const subscribeLocation = req.body.location;
		const subscriberHash = md5(email.toLowerCase());

		const mailchimpRoute = `lists/${listId}/members/${subscriberHash}`;

		functions.logger.info("New subscriber: " + email);

		try {
			// If a response returns, this member is already in MailChimp.
			const response = await mailchimp.get(`lists/${listId}/members/${subscriberHash}`);
			// If the user isn't subscribed, subscribe them
			if (response.status !== "subscribed") {
				await mailchimp
					.patch(mailchimpRoute, {
						status: "subscribed",
					})
					.then(() => {
						res.status(200).send("Subscribed successfully");
					});
			}
			/* If the user does not have the Newsletter tag, add it.*/
			await mailchimp
				.post(mailchimpRoute + "/tags", {
					tags: [{ name: "Newsletter", status: "active" }],
				})
				.then(() => {
					res.status(200).send();
				})
				.catch((err: any) => {
					res.status(400).send(err.message);
				});
		} catch (error: any) {
			// if a 404 is returned, the user doesn't exist, and we can subscribe them.
			if (error.status === 404) {
				await mailchimp
					.put(mailchimpRoute, {
						email_address: email,
						status: "subscribed",
						tags: ["Newsletter"],
						merge_fields: { SIGNUPLOC: subscribeLocation },
					})
					.then(() => {
						res.status(200).send("Subscribed successfully");
					})
					.catch(() => {
						res.status(400).send("That email is invalid. Please a real email address.");
					});
			}
		}
	} catch (error) {
		res.status(400).send("An email must be sent to subscribe");
	}
});

/**
 * Triggers when a new user signs up. This function adds them to the Mailchimp Audience.
 */
exports.addNewUserToMailChimp = functions.auth.user().onCreate(async (user) => {
	const userDoc = await db.collection("users").doc(user.uid).get();
	if (userDoc.exists) {
		const userData = userDoc.data();
		if (userData) {
			const { email, newsletter, firstName, lastName } = userData;
			// If the user selected the "subscribe to newsletter" when signing up, they will get the Newsletter tag.
			const tags = newsletter ? ["Civil Account", "Newsletter"] : ["Civil Account"];
			const subscriberHash = md5(email.toLowerCase());
			const mergeFields = {
				FNAME: firstName,
				LNAME: lastName,
				SIGNUPLOC: "Signup Form",
			};

			functions.logger.info(
				email + (newsletter ? " subscribed to newsletter" : "did not subscribe")
			);

			await mailchimp
				.put(`lists/${listId}/members/${subscriberHash}`, {
					email_address: email,
					status: "subscribed",
					tags,
					merge_fields: mergeFields,
				})
				.catch(() => {
					throw new functions.https.HttpsError(
						"invalid-argument",
						"That email is invalid. Please a real email address."
					);
				});
		}
	}
});

/** +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 * Send Campaigns
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/

/**
 * Send a Welcome Email when a user subscribes to the Newsletter
 * @param {string} email Email
 */
// async function sendWelcomeToNewsletter(email: string) {
//   const response = await mailchimpTx.messages.sendTemplate({
//     template_name: "newsletter-automatic-welcome-3-0",
//     template_content: [{}],
//     message: {
//       subject: "Welcome to Civil! 🎉",
//       from_email: "team@civilmedia.io",
//       from_name: "Civil",
//       to: [{email}],
//       important: true,
//     },
//   });
//   console.log(response);
// }

/**
 * Send the Welcome Email to a new User
 * @param {string} email Email
 * @param {string} name First Name
 */
// async function sendWelcomeEmail(email: string, name: string) {
//   const response = await mailchimpTx.messages.sendTemplate({
//     template_name: "user-automatic-welcome-3-0",
//     template_content: [{}],
//     message: {
//       subject: "Welcome to Civil! 🎉",
//       from_email: "team@civilmedia.io",
//       from_name: "Civil",
//       to: [{email, name}],
//       important: true,
//     },
//   });
//   console.log(response);
// }

export default router;
