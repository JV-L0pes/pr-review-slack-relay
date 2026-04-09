import { parseGitHubReviewNotification } from './github-review-notification.mjs';

async function handleGitHubPrReviewNotify(body, config, slack) {
	const notification = parseGitHubReviewNotification(body);
	const slackResponse = await slack.sendChannelMessage(
		config.slackChannelId,
		notification.messageText,
	);

	return {
		status: 202,
		body: {
			ok: true,
			status: 'queued',
			authorLogin: notification.authorLogin,
			to: config.slackChannelId,
			slack: slackResponse,
		},
	};
}

export { handleGitHubPrReviewNotify };
