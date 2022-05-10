import * as functions from "firebase-functions";
import cors from "cors";
const corsHandler = cors({ origin: true });

import Stripe from "stripe";
const stripe = new Stripe(functions.config().stripe.key, {
	apiVersion: "2020-08-27",
});

const DOMAIN = "https://www.civilmedia.io";

exports.createCheckoutSession = functions.https.onRequest(async (req, res) => {
	corsHandler(req, res, async () => {
		const items = req.body.line_items;
		console.log(req.body.line_items);
		try {
			const session = await stripe.checkout.sessions.create({
				line_items: items, // in the form of [{price: '', quantity: ''}]
				mode: "subscription",
				success_url: `${DOMAIN}/pay/success`,
				cancel_url: `${DOMAIN}/pay/cancel`,
			});

			res.writeHead(303, { Location: `${session.url}` });
		} catch (err: any) {
			res.status(400).send("An error occurred, Kevin. It's this: " + err.message);
		}
	});
});
