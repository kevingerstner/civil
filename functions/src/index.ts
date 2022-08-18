// Imports
import * as functions from "firebase-functions";
import express from "express";
import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import cors from "cors";

// The Environment Variables for various APIs stored in Firebase
dotenv.config();

// Database
admin.initializeApp();

// Functions
import user from "./userFunctions";
import mailchimp from "./mailchimpFunctions";
import adminFx from "./adminFunctions";
import stripe from "./stripeFunctions";
import adminSchools from "./adminSchools";
import slack from "./slackFunctions";
exports.mailchimp = require("./mailchimpFunctions");
exports.user = require("./userFunctions");
exports.database = require("./uploadSchoolsData");
exports.stripe = require("./stripeFunctions");

const app = express();
app.use("/slack/events", slack);
app.use(
	cors({
		origin: ["https://www.civilmedia.io", "https://civilmedia.webflow.io"],
		credentials: true,
		preflightContinue: true,
		allowedHeaders: ["Content-Type", "Authorization"],
	})
);
app.use("/user", user);
app.use("/mailchimp", mailchimp);
app.use("/stripe", stripe);
app.use("/admin", adminFx);
app.use("/admin-schools", adminSchools);

exports.api = functions.https.onRequest(app);
