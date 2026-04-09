import { parseGitHubReviewNotification } from './github-review-notification.mjs';

async function handleGitHubPrReviewNotify(body, config, slack) {
	const notification = parseGitHubReviewNotification(body);
	const slackUserId = config.slackUserMap.get(notification.authorLogin);

	if (!slackUserId) {
		return {
			status: 202,
			body: {
				ok: true,
				status: 'skipped',
				reason: 'author_slack_user_not_mapped',
				authorLogin: notification.authorLogin,
			},
		};
	}

	const slackResponse = await slack.sendDirectMessage(
		slackUserId,
		notification.messageText,
	);

	return {
		status: 202,
		body: {
			ok: true,
			status: 'queued',
			authorLogin: notification.authorLogin,
			to: slackUserId,
			slack: slackResponse,
		},
	};
}

export { handleGitHubPrReviewNotify };
