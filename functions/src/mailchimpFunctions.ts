import * as express from "express";
const router = express.Router();

import * as functions from "firebase-functions";
import { checkIfAdmin } from "./middleware/authMiddleware";
import { logError } from "./util/debug";

const md5 = require("md5");
const mcApiKey = process.env.MAILCHIMP_API_KEY;
const Mailchimp = require("mailchimp-api-v3");
const mailchimp = new Mailchimp(mcApiKey);
const listId = process.env.MAILCHIMP_AUDIENCEID;

export const MAILCHIMP_TAGS = ["Civil+", "Civil Account", "Newsletter"];

export const USER_ROLE = ["Teacher", "Student"];

/** +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 * SUBSCRIBE
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/
router.post("/subscribe", async (req, res) => {
	try {
		const subscriberHash = md5(req.body.email.toLowerCase());

		functions.logger.info("New subscriber: " + req.body.email);

		try {
			// If a response returns, this member is already in MailChimp.
			const response = await mailchimp.get(`lists/${listId}/members/${subscriberHash}`);
			// If the user isn't subscribed, subscribe them
			if (response.status !== "subscribed") {
				await mailchimp
					.patch(`lists/${listId}/members/${subscriberHash}`, {
						status: "subscribed",
					})
					.then(() => {
						res.status(200).send("Subscribed successfully");
					});
			}
			/* If the user does not have the Newsletter tag, add it.*/
			await mailchimp
				.post(`lists/${listId}/members/${subscriberHash}/tags`, {
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
					.put(`lists/${listId}/members/${subscriberHash}`, {
						email_address: req.body.email,
						status: "subscribed",
						tags: ["Newsletter"],
						merge_fields: { SIGNUPLOC: req.body.location },
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

export async function addSubscriber(userData, role) {
	const { email, newsletter, firstName, lastName } = userData;

	const subscriberHash = md5(email.toLowerCase());

	const tags = ["Civil Account"];
	// add the newsletter tag if user subscribed
	if (newsletter) tags.push("Civil+");
	// add the correct role tag for th user
	switch (role.toLowerCase()) {
		case "Student":
			tags.push("student");
			break;
		case "Teacher":
			tags.push("teacher");
			break;
	}

	functions.logger.info(email + (newsletter ? " subscribed to newsletter" : "did not subscribe"));

	await mailchimp
		.put(`lists/${listId}/members/${subscriberHash}`, {
			email_address: email,
			status: "subscribed",
			tags,
			merge_fields: {
				FNAME: firstName,
				LNAME: lastName,
				SIGNUPLOC: "Signup Form",
			},
		})
		.catch(() => {
			throw new functions.https.HttpsError(
				"invalid-argument",
				"That email is invalid. Please a real email address."
			);
		});
}

/** +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 * Edit Tags
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/

export async function addTag(email: string, tagName: string) {
	const subscriberHash = md5(email.toLowerCase());
	await mailchimp
		.post(`lists/${listId}/members/${subscriberHash}/tags`, {
			tags: [{ name: tagName, status: "active" }],
		})
		.catch(async (err) => {
			await logError("[MAILCHIMP]", "Could not add the Civil+ Tag to " + email + ": " + err);
		});
}

export async function removeTag(email: string, tagName: string) {
	const subscriberHash = md5(email.toLowerCase());
	await mailchimp
		.post(`lists/${listId}/members/${subscriberHash}/tags`, {
			tags: [{ name: tagName, status: "inactive" }],
		})
		.catch(async (err) => {
			await logError("[MAILCHIMP]", "Error removing " + tagName + " from " + email + ": " + err);
		});
}

/** +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 * Admin
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/

router.post("/addTag", checkIfAdmin, async (req, res) => {
	const email = req.body.email;
	const tagName = req.body.tagName;
	try {
		if (MAILCHIMP_TAGS.includes(tagName)) {
			await addTag(email, tagName);
			res.status(200).send("The tag " + tagName + " was added to subscriber " + email);
		} else {
			res.status(400).send("That tag doesn't exist, so it was not added to " + email);
		}
	} catch (err) {
		res.status(400).send("An error occurred: " + err);
	}
});

router.post("/removeTag", checkIfAdmin, async (req, res) => {
	const email = req.body.email;
	const tagName = req.body.tagName;
	try {
		if (MAILCHIMP_TAGS.includes(tagName)) {
			await removeTag(email, tagName);
			res.status(200).send("The tag " + tagName + " was added to subscriber " + email);
		} else {
			res.status(400).send("That tag doesn't exist, so it was not added to " + email);
		}
	} catch (err) {
		res.status(400).send("An error occurred: " + err);
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
