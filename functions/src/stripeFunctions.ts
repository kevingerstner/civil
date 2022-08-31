import * as express from "express";
const router = express.Router();
import { https } from "firebase-functions";
import { logError, logMessage } from "./util/debug";
import * as admin from "firebase-admin";
import {
	slackSubscribeNotification,
	slackSubscriptionCancelledNotification,
	slackSubscriptionRenewedNotification,
} from "./slackFunctions";
import { FieldValue } from "firebase-admin/firestore";
const db = admin.firestore();
import { checkIfAuthenticated } from "./middleware/authMiddleware";
import { grantClaim, revokeClaim, notifyClientToRefreshToken, getUserData } from "./userFunctions";

import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_KEY!, {
	apiVersion: "2020-08-27",
});

const DOMAIN = process.env.FUNCTIONS_EMULATOR
	? "https://civilmedia.webflow.io"
	: "https://civilmedia.io";

/**
 * The Stripe webhook that handles response to checkout events
 */
router.post("/webhook", async (request, response) => {
	const firebaseRequest = request as https.Request;
	const signature = request.headers["stripe-signature"];
	let event: Stripe.Event;
	// Verify the event came from Stripe
	try {
		event = stripe.webhooks.constructEvent(
			firebaseRequest.rawBody,
			signature!,
			process.env.STRIPE_WEBHOOK_SECRET!
		);
	} catch (err: any) {
		const message = "Webhook signature verification failed.";
		await logError("(💲Stripe Error💲)", message);
		return response.status(400).send(message);
	}
	// Handle the event
	switch (event.type) {
		case "checkout.session.completed": {
			await handleCheckoutComplete(event);
			break;
		}
		case "customer.created": {
			await handleCustomerCreated(event);
			break;
		}
		case "customer.deleted": {
			await handleCustomerDeleted(event);
			break;
		}
		case "customer.subscription.created": {
			await handleSubscriptionCreated();
			break;
		}
		case "customer.subscription.updated": {
			await handleSubscriptionUpdated(event);
			break;
		}
		case "customer.subscription.deleted": {
			await handleSubscriptionDeleted(event);
			break;
		}
	}
	return response.status(200).send();
});

/* +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
 * WEBHOOK EVENT HANDLERS
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-*/

/* ------------- CHECKOUT ------------------ */
async function handleCheckoutComplete(event) {
	const eventData = event.data.object;
	const uid = eventData.client_reference_id;
	const customer = eventData.customer;

	// This is enforced on the frontend, but double check
	if (!uid) throw await logError("(💲Stripe Checkout Error💲)", "UID not received.");

	// Add the uid to the customer metadata in Stripe
	const updateCustomer = async () => {
		try {
			await stripe.customers.update(customer, {
				metadata: { uid },
			});
		} catch {
			throw await logError("(💲Stripe Checkout Error💲)", "Could not add UID to metadata");
		}
	};

	// Create a customer document in Firestore
	const createCustomerDocument = async () => {
		try {
			await db.collection("customers").doc(customer).set(
				{
					uid,
					active: true,
					subscription: eventData.subscription,
					joinDate: FieldValue.serverTimestamp(),
				},
				{ merge: true }
			);
			logMessage(
				"(💲 Stripe Checkout 💲)",
				"Created a new customer: " + customer + " with uid " + uid
			);
		} catch {
			throw await logError("(Firebase)", `Could not create customer ${customer}`);
		}
	};

	// Give the user the paid claim
	const grantUserAccess = async () => {
		try {
			await grantClaim(uid, "paid");
			// Notify the client to refresh the IDToken so the paid claim propogates
			await notifyClientToRefreshToken(uid);
			logMessage(
				"(💲 Stripe Checkout 💲)",
				"Granted user access: " + customer + " with uid: " + uid
			);
		} catch {
			throw await logError("(User)", "Unable to grant user access");
		}
	};

	// Post a notification to Slack
	const postSlackNotification = async () => {
		try {
			const userData = await getUserData(uid);
			const { email, firstName, lastName, schoolName, location } = userData;
			await slackSubscribeNotification(email, firstName, lastName, schoolName, location);
		} catch (error) {
			throw await logError("(💬 Slack 💬)", "Unable to post Slack Notification");
		}
	};

	await Promise.allSettled([
		updateCustomer(),
		createCustomerDocument(),
		grantUserAccess(),
		postSlackNotification(),
	]);
}

/* ------------- CUSTOMERS ------------------ */

async function handleCustomerCreated(event) {
	const eventData = event.data.object;
	await db.collection("customers").doc(eventData.id).set(
		{
			active: true,
			email: eventData.email,
		},
		{ merge: true }
	);
}

async function handleCustomerDeleted(event) {
	await db.collection("customers").doc(event.data.object.id).delete();
}

/* ------------- SUBSCRIPTION ----------------- */

async function handleSubscriptionCreated() {
	logMessage("(SUBSCRIPTION)", "Subscription created");
}

async function handleSubscriptionUpdated(event) {
	const eventData = event.data.object;
	const customerData = await getCustomerData(eventData.customer);
	const uid = await getUserIDByCustomerID(eventData.customer);
	if (!uid) {
		return await logError(
			"(Subscription Updated)",
			"Unable to get UID for customer" + eventData.customer
		);
	}
	const userData = await getUserData(uid);
	// If the user canceled their subscription at the end of the current period, send a notification
	if (eventData.cancel_at_period_end) {
		updateCustomer(eventData.customer, { active: false }); // set the customer's active to false
		if (uid) {
			await slackSubscriptionCancelledNotification(
				userData.email,
				userData.firstName,
				userData.lastName,
				new Date(eventData.current_period_end * 1000).toLocaleString("en-US", {
					timeZoneName: "short",
				})
			);
		}
	} else {
		// If cancel_at_period_end is false and active is false, the subscription was previously cancelled
		if (customerData && customerData.active === false) {
			updateCustomer(eventData.customer, { active: true });
			await slackSubscriptionRenewedNotification(
				userData.email,
				userData.firstName,
				userData.lastName
			);
		}
	}
	return;
}

async function handleSubscriptionDeleted(event) {
	const eventData = event.data.object;
	// Revoke the paid claim from this user
	const uid = await getUserIDByCustomerID(eventData.customer);

	if (uid) {
		await revokeClaim(uid, "paid"); // revoke the paid claim
		notifyClientToRefreshToken(uid); // set the user's token expiration to now so it refreshes
	} else {
		logError("(Subscription Deleted)", "Unable to find uid associated with " + eventData.customer);
	}
	// Update the customer document with no access and clear the expiration date
	await db
		.collection("customers")
		.doc(eventData.customer)
		.update({ active: false, subscription: null });
	await logMessage("(Subscription Deleted)", "Revoked License for " + eventData.customer);
}

/* +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
 * API ENDPOINTS
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-*/

router.post("/checkout", async (request, response) => {
	try {
		if (!request.body.uid) {
			throw await logError("(🛒Checkout)", "UID Not included in request body.");
		}
		await logMessage("(🛒Checkout)", `User ${request.body.uid} created a checkout session`);

		const session = await stripe.checkout.sessions.create({
			client_reference_id: request.body.uid,
			customer_email: request.body.email,
			line_items: request.body.line_items, // in the form of [{price: '', quantity: ''}]
			mode: "subscription",
			success_url: `${DOMAIN}/pay/success`,
			cancel_url: `${DOMAIN}/pay/cancel`,
			subscription_data: {
				trial_period_days: 14,
			},
		});
		response.status(200).json({ url: session.url });
	} catch (err: any) {
		await logError(
			"(🛒Checkout)",
			"An error occurred creating the checkout session: " + err.message
		);
		response.status(400).send(err.message);
	}
});

/**
 * Creates a customer portal session for the user, which allows them to manage their subscription
 */
router.post("/create-customer-portal-session", checkIfAuthenticated, async (req, res) => {
	const uid = req["currentUser"];
	const customerID = await getCustomerIDbyUserID(uid);
	if (customerID) {
		try {
			const portalSession = await stripe.billingPortal.sessions.create({
				customer: customerID,
				return_url: DOMAIN,
			});
			res.status(200).json({ url: portalSession.url });
		} catch (error) {
			await logError(
				"(Customer Portal)",
				"An error occurred creating a customer portal for: " + error
			);
			res.status(400).send(error);
		}
	}
});

/* +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
 * HELPER FUNCTIONS
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-*/

/**
 * Gets the customerID from the license from the uid
 * @param {string} uid the user ID
 * @return {Promise <string | null>} a customerid or null
 */
async function getCustomerIDbyUserID(uid: string): Promise<string | null> {
	const customer = await db.collection("customers").where("uid", "==", uid).limit(1).get();
	if (customer.empty) return null;
	else return customer.docs[0].id;
}

/**
 * Gets the uid from a customerID
 * @param {string} customerID The customerID from Stripe
 * @return {string} A userID from Firebase
 */
async function getUserIDByCustomerID(customerID): Promise<string | null> {
	if (!customerID) return null;
	const customer = await db.collection("customers").doc(customerID).get();
	if (customer.exists) {
		const data = customer.data();
		if (data) return data.uid;
	}
	return null;
}

async function getCustomerData(customer: string) {
	const customerDoc = await db.collection("customers").doc(customer).get();
	if (!customerDoc.exists) return null;
	else return customerDoc.data();
}

async function updateCustomer(customer: string, fields) {
	await db.collection("customers").doc(customer).update(fields);
	await db
		.collection("customers")
		.doc(customer)
		.update({ lastUpdated: FieldValue.serverTimestamp() });
}

export default router;
