// Imports
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {initializeApp} from "firebase/app";
import * as dotenv from "dotenv";

import {App, ExpressReceiver} from "@slack/bolt";

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

// FUNCTION IMPORTS
exports.user = require("./userFunctions");
import {provisionUser} from "./userFunctions";

// The Environment Variables for various APIs stored in Firebase
dotenv.config();

// Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseEnv = functions.config();
const firebaseConfig = {
  apiKey: firebaseEnv.fire_cfg.api_key,
  authDomain: firebaseEnv.fire_cfg.auth_domain,
  projectId: firebaseEnv.fire_cfg.project_id,
  storageBucket: firebaseEnv.fire_cfg.storage_bucket,
  messagingSenderId: firebaseEnv.fire_cfg.messaging_sender_id,
  appId: firebaseEnv.fire_cfg.app_id,
  measurementId: firebaseEnv.fire_cfg.measurement_id,
};
initializeApp(firebaseConfig);

/** -----------------------
 * MailChimp
 **-----------------------*/
exports.mailchimp = require("./mailchimpFunctions");

/** -----------------------
 * Database
 **-----------------------*/
exports.database = require("./uploadSchoolsData");

/** -----------------------
 * Stripe
 **-----------------------*/
exports.stripe = require("./stripeFunctions");

/** -----------------------
 * Slack
 **-----------------------*/
// exports.slackAPI = require("./slackFunctions");

const slackConfig = functions.config().slack;

const expressReceiver = new ExpressReceiver({
  signingSecret: slackConfig.signing_secret,
  endpoints: "/events",
  processBeforeResponse: true,
});

const slackApp = new App({
  receiver: expressReceiver,
  token: slackConfig.bot_token,
  processBeforeResponse: true,
});

slackApp.error(async (error) => {
  console.error(error);
  functions.logger.error(error);
});

slackApp.action("provision-account", async ({ack, payload, respond}) => {
  await ack();

  const fields = JSON.parse((payload as any).value);
  const email: string = fields.email;

  try {
    await provisionUser(email);

    await respond({
      replace_original: true,
      text: `Successfully provisioned the account for ${email}`,
    });
  } catch (err) {
    functions.logger.error(err);
    await respond({
      text: (err as any).message,
    });
  }
});

/**
 * Sends a post request to Slack with either a list of blocks or a simple message
 * @param {string} data The array of blocks or message to send
 * @param {string} channel The channelID of the channel to send this message to
 * @throws Errors upon either the Slack URL not existing in the environment or any failures in sending a message to the Slack workspace
 */
async function sendDataToSlack(data: string | any, channel: string) {
  try {
    if (typeof data === "string") {
      await slackApp.client.chat.postMessage({
        token: slackConfig.bot_token,
        channel,
        text: data,
      });
    } else {
      await slackApp.client.chat.postMessage({
        token: slackConfig.bot_token,
        channel,
        blocks: data,
      });
    }
  } catch (sendError) {
    throw new Error(
        `An error occurred sending a message to the Slack workspace: ${(sendError as any).message}`
    );
  }
}

/**
 * Post */
exports.postSignupNotificationToSlack = functions.auth.user().onCreate(async (user) => {
  functions.logger.warn("Post Signup Notification to Slack");
  const userDoc = await db.collection("users").doc(user.uid).get();
  if (userDoc.exists) {
    const userData = userDoc.data();
    if (userData) {
      const {email, firstName, lastName, jobTitle, schoolName, referral, location} = userData;
      const blocksToSend = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "New Signup Request!",
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Email:*\n${email}`,
            },
            {
              type: "mrkdwn",
              text: `*Name:*\n${firstName} ${lastName}`,
            },
            {
              type: "mrkdwn",
              text: `*Job Title:*\n${jobTitle}`,
            },
            {
              type: "mrkdwn",
              text: `*School Name:*\n${schoolName}`,
            },
            {
              type: "mrkdwn",
              text: `*School Location:*\n${location}`,
            },
            {
              type: "mrkdwn",
              text: `*Referral:*\n${referral}`,
            },
          ],
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Provision Account",
              },
              action_id: "provision-account",
              style: "primary",
              value: JSON.stringify({
                email,
                firstName,
                lastName,
                jobTitle,
                schoolName,
                location,
                referral,
              }),
              confirm: {
                title: {
                  type: "plain_text",
                  text: "Confirm Provision",
                },
                text: {
                  type: "plain_text",
                  text: `You're about to create an account for ${email}. Would you like to do this?`,
                },
                confirm: {
                  type: "plain_text",
                  text: "Provision Account",
                },
                deny: {
                  type: "plain_text",
                  text: "Go Back",
                },
              },
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Deny Provision",
              },
              action_id: "deny-provision",
              style: "danger",
              url: `mailto:${email}`,
            },
          ],
        },
      ];

      await sendDataToSlack(blocksToSend, slackConfig.signup_notifs_channel_id);
    }
  }
});

export const slack = functions.https.onRequest(expressReceiver.app);
