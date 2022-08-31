import { logger } from "firebase-functions";
import { slackErrorNotification } from "../slackFunctions";

/**
 * Logs an error to Cloud Functions and sends an error notification to Slack.
 * @param {string} title The title for the slack message
 * @param {string} message The message printed to the Cloud Functions logger and the slack message
 */
export async function logError(title: string, message: string) {
	logger.error(message);
	await slackErrorNotification(title, message);
	return new Error(message);
}

/**
 * Logs a message at level DEBUG to Cloud Functions
 * @param {string} title The title for the error
 * @param {string} message The message for the error
 */
export async function logMessage(title: string, message: string) {
	logger.debug(title + " " + message);
}
