import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
const db = admin.firestore();

const mailchimpConfig = functions.config().mailchimp;
// const mcApiKeyTx = mailchimpConfig.api_key_tx;
// const mailchimpTx = require("@mailchimp/mailchimp_transactional")(mcApiKeyTx);

const md5 = require("md5");
const mcApiKey = mailchimpConfig.api_key;
const Mailchimp = require("mailchimp-api-v3");
const mailchimp = new Mailchimp(mcApiKey);
const listId = mailchimpConfig.audienceid;

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

/** +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
 * Manage Audience
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/

/**
 * Triggers when a new user signs up. This function adds them to the Mailchimp Audience.
 */
exports.addNewUserToMailChimp = functions.auth.user().onCreate(async (user) => {
  const userDoc = await db.collection("users").doc(user.uid).get();
  if (userDoc.exists) {
    const userData = userDoc.data();
    if (userData) {
      const {email, newsletter, firstName, lastName} = userData;
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

      // Add the user to Mailchimp Audience
      subscribeUser(subscriberHash, email, tags, mergeFields);
    }
  }
});

/**
 * Subscribes a user to the newsletter
 * @param {string} email The email from the signup form
 */
exports.subscribeToNewsletter = functions.https.onCall(async (data, context) => {
  if (!data.email) {
    functions.logger.error("function not called with email");
    throw new functions.https.HttpsError(
        "invalid-argument",
        "The function must be called with one argument \"email\" containing the email to subscribe."
    );
  }
  const subscriberHash = md5(data.email.toLowerCase());

  functions.logger.info("Subscribe Location: " + data.location);
  functions.logger.info("EMAIL: " + data.email);

  try {
    // If a valid response returns, this member is already in MailChimp.
    const response = await mailchimp.get(`lists/${listId}/members/${subscriberHash}`);
    // If the user isn't subscribed, subscribe them
    if (response.status !== "subscribed") {
      await mailchimp
          .patch(`lists/${listId}/members/${subscriberHash}`, {
            status: "subscribed",
          })
          .then(() => {
            functions.logger.info(
                "Updated " + response.status + " user " + data.email + " to subscribed."
            );
          })
          .catch((error: any) => {
            functions.logger.error(error);
          });
    }
    /* If the user does not have the Newsletter tag, add it.*/
    await mailchimp
        .post(`lists/${listId}/members/${subscriberHash}/tags`, {
          tags: [{name: "Newsletter", status: "active"}],
        })
        .catch((error: any) => {
          functions.logger.error(error);
        });
  } catch (error: any) {
    // if a 404 is returned, the user doesn't exist, and we can subscribe them.
    if (error.status === 404) {
      functions.logger.info("User not found. Adding them to the audience.");
      const mergeFields = {SIGNUPLOC: data.location};
      subscribeUser(subscriberHash, data.email, ["Newsletter"], mergeFields);
    }
  }
});

/**
 * Subscribes a user to the Mailchimp Audience
 * @param {any} subscriberHash The md5 hash for the user
 * @param {string} email The user's email
 * @param {string} tags An array of strings of tags
 * @param {any} mergeFields An object containing the merge fields for the user
 */
async function subscribeUser(subscriberHash: any, email: string, tags: string[], mergeFields: any) {
  await mailchimp
      .put(`lists/${listId}/members/${subscriberHash}`, {
        email_address: email,
        status: "subscribed",
        tags,
        merge_fields: mergeFields,
      })
      .catch((error: any) => {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "That email is invalid. Please a real email address."
        );
      });
}
