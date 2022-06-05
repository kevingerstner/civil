import * as express from "express";
const router = express.Router();
import { https } from "firebase-functions";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
const db = admin.firestore();
import { checkIfAuthenticated } from "./middleware/authMiddleware";
import { grantTeacherRole } from "./userFunctions";

import Stripe from "stripe";
import { Timestamp } from "firebase-admin/firestore";
const stripe = new Stripe(functions.config().stripe.key, {
	apiVersion: "2020-08-27",
});

const DOMAIN = "https://www.civilmedia.io";

const TEST_MODE = false;
const TEST_MODE_KEY = "";

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
			TEST_MODE ? TEST_MODE_KEY : functions.config().stripe.webhook_secret
		);
	} catch (err: any) {
		console.log("Webhook signature verification failed.", err.message);
		return response.sendStatus(400);
	}
	// Handle the event
	console.log("event called: ", event.type);
	switch (event.type) {
		case "checkout.session.completed": {
			await addCustomer(event);
			await giveUserAccess(event);
			break;
		}
		case "customer.subscription.created": {
			await addCustomer(event);
			break;
		}
		case "invoice.paid": {
			await giveUserAccess(event);
			break;
		}
		case "customer.subscription.deleted": {
			await revokeUserAccess(event);
			break;
		}
	}
	return response.status(200).send();
});

/**
 * Adds a new document to the "Customer" collection
 * @param {any} event the webhook event object
 */
async function addCustomer(event: any) {
	const eventData = event.data.object;
	let expires;
	// If this checkout was a subscription, set an expiration date
	// THIS IS IN PROGRESS
	if (eventData.mode === "subscription") {
		expires = await getSubscriptionExpirationDate(eventData.subscription);
	}

	// Get the UID
	let userID;
	if (eventData.client_reference_id) userID = eventData.client_reference_id;
	else {
		getUserIDByCustomerID(eventData.customer);
	}

	const customerRef = await db.collection("customers").doc(eventData.customer).get();
	if (!customerRef.exists) {
		await db.collection("customers").doc(eventData.customer).set({
			userID,
			access: true,
			expires,
		});
	}
}

/**
 * Creates a license in the database for the user
 * @param {Stripe.Event} event The stripe event from the webhook
 */
async function giveUserAccess(event: any) {
	const eventData = event.data.object;
	// Get the customer in Firebase, which stores the relationship between the customer id and user id
	const uid = await getUserIDByCustomerID(eventData.customer);
	if (uid) await grantTeacherRole(uid);

	console.log("created license and marked paid for " + uid);
}

async function revokeUserAccess(event: any) {
	const eventData = event.data.object;
	const customer = await db.collection("customers").doc(eventData.customer).get();
	if (customer.exists) {
		const data = customer.data();
		if (data) {
			data.access = false;
			data.expires = null;
		}
	}
	console.log("revoked license for " + eventData.email);
}

router.post("/checkout", async (request, response) => {
	const payload = request.body;
	console.log(payload);
	try {
		const session = await stripe.checkout.sessions.create({
			client_reference_id: payload.uid,
			customer_email: payload.email,
			line_items: payload.line_items, // in the form of [{price: '', quantity: ''}]
			mode: "subscription",
			success_url: `${DOMAIN}/pay/success`,
			cancel_url: `${DOMAIN}/pay/cancel`,
		});
		response.status(200).json({ url: session.url });
	} catch (err: any) {
		response.status(400).send("An error occurred, Kevin. It's this: " + err.message);
	}
});

/**
 * Creates a customer portal session for the user, which allows them to manage their subscription
 */
router.post("/create-customer-portal-session", checkIfAuthenticated, async (req, res) => {
	const uid = req["currentUser"];
	console.log("UID: ", uid);
	const returnUrl = "https://www.civilmedia.io";
	const customerID = await getCustomerIDbyUserID(uid);
	console.log("CUSTOMER ID: " + customerID);
	if (customerID) {
		try {
			const portalSession = await stripe.billingPortal.sessions.create({
				customer: customerID,
				return_url: returnUrl,
			});
			res.status(200).json({ url: portalSession.url });
		} catch (error) {
			console.log(error);
			res.status(400).send();
		}
	}
});

/**
 * Gets the expiration date for access for this subscription.
 * If the subscription is yearly, this will return a Timestamp for a year from now.
 * If the subscription is monthly, this will return a Timestamp for a month from now.
 * @param {string} subscriptionID the id for the subscription
 * @return {Timestamp | null} a Firestore Timestamp for either a year from now or a month, depending on the subscription recur duration
 */
async function getSubscriptionExpirationDate(subscriptionID) {
	const subscription = await stripe.subscriptions.retrieve(subscriptionID);
	const interval = subscription.items.data[0].price.recurring?.interval;
	if (interval === "year") {
		const date = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
		console.log("year from now " + date);
		return Timestamp.fromDate(date);
	}
	if (interval === "month") {
		const date = new Date(new Date().setMonth(new Date().getMonth() + 1));
		console.log("month from now: " + date);
		return Timestamp.fromDate(date);
	}
	return null;
}

/**
 * Gets the customerID from the license from the uid
 * @param {string} uid the user ID
 * @return {Promise <string | null>} a customerid or null
 */
async function getCustomerIDbyUserID(uid: string): Promise<string | null> {
	const license = await db.collection("licenses").where("userID", "==", uid).limit(1).get();
	if (license.empty) {
		console.log("no customer was found with that id.");
		return null;
	} else {
		console.log("found license");
		return license.docs[0].id;
	}
}

/**
 * Gets the uid from a customerID
 * @param {string} customerID The customerID from Stripe
 * @return {string} A userID from Firebase
 */
async function getUserIDByCustomerID(customerID): Promise<string | null> {
	if (!customerID) return null;
	const customer = await db.collection("customers").doc(customerID).get();
	if (!customer.exists) {
		const data = customer.data();
		if (data) return data.uid;
	}
	return null;
}

export default router;
