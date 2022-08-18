import { App, ExpressReceiver } from "@slack/bolt";

const slackReceiver = new ExpressReceiver({
	signingSecret: process.env.signing_secret!,
	endpoints: "/",
});

const slackApp = new App({
	token: process.env.SLACK_BOT_TOKEN,
	signingSecret: process.env.SLACK_SIGNING_SECRET,
	receiver: slackReceiver,
});

slackApp.error(async (error) => {
	console.error(error);
});

export async function slackSubscriptionCancelledNotification(
	email: string,
	firstName: string,
	lastName: string,
	lastDay: string
) {
	const blocks = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: `😥 ${firstName} Cancelled their Subscription 😥`,
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
					text: `*Last Day:*\n${lastDay}`,
				},
			],
		},
	];
	const message = `😥 ${firstName} Cancelled their subscription 😥`;
	postBlocksToSlack(blocks, message, process.env.SLACK_SIGNUP_NOTIFS_CHANNEL_ID!);
}

export async function slackSubscriptionRenewedNotification(
	email: string,
	firstName: string,
	lastName: string
) {
	const blocks = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: `😅 ${firstName} Renewed their Subscription 😅`,
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
			],
		},
	];
	const message = `😅 ${firstName} Renewed their Subscription 😅`;
	postBlocksToSlack(blocks, message, process.env.SLACK_SIGNUP_NOTIFS_CHANNEL_ID!);
}

export async function slackSubscribeNotification(
	email: string,
	firstName: string,
	lastName: string,
	schoolName: string,
	location: string
) {
	const blocks = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: "💲 New Subscriber 💲",
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
					text: `*School Name:*\n${schoolName}`,
				},
				{
					type: "mrkdwn",
					text: `*School Location:*\n${location}`,
				},
			],
		},
	];
	const message =
		`💸 New Subscriber 💸 ${firstName} ${lastName} (${email})` + (schoolName && location)
			? `from ${schoolName} in ${location}`
			: "";
	postBlocksToSlack(blocks, message, process.env.SLACK_SIGNUP_NOTIFS_CHANNEL_ID!);
}

export async function slackNewUserNotification(email: string | undefined, uid: string) {
	const blocks = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: "👋 New User",
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
					text: `*User ID:*\n${uid}`,
				},
			],
		},
	];
	const message = `👋 New User ${email} (UID: ${uid}))`;

	postBlocksToSlack(blocks, message, process.env.SLACK_SIGNUP_NOTIFS_CHANNEL_ID!);
}

export async function slackSignupNotification(
	email: string,
	firstName: string,
	lastName: string,
	jobTitle: string,
	schoolName: string,
	location: string,
	referral: string
) {
	const blocks = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: "🥳 New Signup!",
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
	];
	const message = `New Signup! 🥳 ${firstName} ${lastName} (${email})`;
	await postBlocksToSlack(blocks, message, process.env.SLACK_SIGNUP_NOTIFS_CHANNEL_ID!);
}

/**
 * Sends a post request to Slack with either a list of blocks or a simple message
 * @param {any} blocks The array of blocks or message to send
 * @param {string} text The message used as a text summary
 * @param {string} channel The channelID of the channel to send this message to
 * @throws Errors upon either the Slack URL not existing in the environment or any failures in sending a message to the Slack workspace
 */
export async function postBlocksToSlack(blocks: any, text: string, channel: string) {
	try {
		await slackApp.client.chat.postMessage({
			token: process.env.SLACK_BOT_TOKEN,
			channel,
			text,
			blocks,
		});
	} catch (sendError) {
		throw new Error(
			`An error occurred sending a message to the Slack workspace: ${(sendError as any).message}`
		);
	}
}

export default slackReceiver.router;
