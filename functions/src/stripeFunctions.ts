import * as express from "express";
const router = express.Router();
import { https } from "firebase-functions";
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

const DOMAIN = "https://civilmedia.io";

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
		console.log("WEBHOOK SIG VERIFICATION FAILED");
		return response.status(400).send(`Webhook signature verification failed: ${err.message}`);
	}
	// Handle the event
	console.log("[STRIPE WEBHOOK]: ", event.type);
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
			await handleSubscriptionCreated(event);
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

	if (uid) {
		await stripe.customers.update(customer, {
			metadata: { uid },
		});
		// Create a customer document in the database
		await db.collection("customers").doc(customer).set({ uid, active: true }, { merge: true });
		notifyClientToRefreshToken(uid); // make the client refresh their token
		console.log("created a new customer: " + customer + " with uid: " + uid);
	} else {
		console.error("Error completing checkout: UID was not received.");
	}
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

async function handleSubscriptionCreated(event) {
	const eventData = event.data.object;
	if (!eventData.customer) {
		console.error("(SUBSCRIPTION): The event customer.subscription.created requires a customer ID");
	}

	await db
		.collection("customers")
		.doc(eventData.customer)
		.update({ active: true, subscription: eventData.id, joinDate: FieldValue.serverTimestamp() });

	const uid = await getUserIDByCustomerID(eventData.customer);
	// Grant the paid claim for this user
	if (uid) {
		await grantClaim(uid, "paid");
		console.log("(SUBSCRIPTION): Created license and marked paid for " + uid);
		// Post the notification to Slack
		const userData = await getUserData(uid);
		if (userData) {
			const { email, firstName, lastName, schoolName, location } = userData;
			slackSubscribeNotification(email, firstName, lastName, schoolName, location);
		}
	} else {
		console.error(
			"(SUBSCRIPTION): Could not retrieve the UID from this Customer ID: " + eventData.customer
		);
	}
}

async function handleSubscriptionUpdated(event) {
	const eventData = event.data.object;
	const customerData = await getCustomerData(eventData.customer);
	const uid = await getUserIDByCustomerID(eventData.customer);
	if (!uid) {
		return console.error("Unable to get User ID for customer " + eventData.customer);
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
}

async function handleSubscriptionDeleted(event) {
	const eventData = event.data.object;
	// Revoke the paid claim from this user
	const uid = await getUserIDByCustomerID(eventData.customer);

	if (uid) {
		await revokeClaim(uid, "paid"); // revoke the paid claim
		notifyClientToRefreshToken(uid); // set the user's token expiration to now so it refreshes
	} else {
		console.error("[ERROR] Unable to find uid associated with " + eventData.customer);
	}
	// Update the customer document with no access and clear the expiration date
	await db
		.collection("customers")
		.doc(eventData.customer)
		.update({ active: false, subscription: null });
	console.log("revoked license for " + eventData.customer);
}

/* +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
 * API ENDPOINTS
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-*/

router.post("/checkout", async (request, response) => {
	console.log("CHECKOUT API");
	try {
		if (!request.body.uid) throw new Error("Invalid request. UID not included in the request body");
		if (!request.body.email) {
			throw new Error("Invalid request. Email not included in the request body");
		}
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
		response
			.status(400)
			.send("An error occurred while creating the Checkout Session: " + err.message);
	}
});

// I think this is currently unused since subscription management is done through the Stripe Customer Portal
router.post("/cancel-subscription", checkIfAuthenticated, async (req, res) => {
	const uid = req["currentUser"];
	console.log("UID: " + uid);
	const customerID = await getCustomerIDbyUserID(uid);
	console.log("CID: " + customerID);

	if (customerID) {
		const subscription = await stripe.subscriptions.list({
			customer: customerID,
			limit: 1,
		});
		stripe.subscriptions.update(subscription.data[0].id, {
			trial_end: "now",
		});
		res.status(200).send("Subscription successfully canceled for " + req.body.email);
	}
	res
		.status(400)
		.send(
			"Unable to cancel subscription. Please contact team@civilmedia.io if you continue encountering this issue."
		);
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
			console.log(error);
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
