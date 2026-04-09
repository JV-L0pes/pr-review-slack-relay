import { parseGitHubReviewNotification } from './github-review-notification.mjs';

function normalizeSummaryLines(payload) {
	const items = Array.isArray(payload?.review?.inlineSummary)
		? payload.review.inlineSummary
		: [];
	return items
		.map((item, index) => {
			const summary =
				typeof item?.summary === 'string' ? item.summary.trim() : '';
			return summary ? `• ${index + 1}. ${summary}` : '';
		})
		.filter(Boolean);
}

function buildSlackBlocks(payload, notification) {
	const state = notification.reviewState === 'approved' ? 'APPROVED' : 'CHANGES_REQUESTED';
	const stateText =
		notification.reviewState === 'approved'
			? 'aprovado na revisão atual'
			: 'correções solicitadas na revisão atual';
	const repository =
		typeof payload?.repository?.fullName === 'string'
			? payload.repository.fullName.trim()
			: 'unknown';
	const baseRef =
		typeof payload?.pullRequest?.baseRefName === 'string'
			? payload.pullRequest.baseRefName.trim()
			: 'unknown';
	const headRef =
		typeof payload?.pullRequest?.headRefName === 'string'
			? payload.pullRequest.headRefName.trim()
			: 'unknown';
	const reviewer = notification.reviewerLogin || 'unknown';
	const observation =
		typeof payload?.review?.body === 'string' && payload.review.body.trim()
			? payload.review.body.trim()
			: notification.messageText;
	const summaryLines = normalizeSummaryLines(payload);

	const blocks = [
		{
			type: 'header',
			text: {
				type: 'plain_text',
				text: `PR ${state}`,
			},
		},
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: [
					`*Repositório:* ${repository}`,
					`*PR:* #${notification.prNumber} - ${notification.prTitle || 'sem título'}`,
					`*Autor:* ${notification.authorLogin}`,
					`*Revisor:* ${reviewer}`,
					`*Fluxo:* ${headRef} -> ${baseRef}`,
					`*Status:* ${stateText}`,
				].join('\n'),
			},
		},
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*Observação do revisor:*\n${observation}`,
			},
		},
	];

	if (summaryLines.length > 0) {
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*Pontos principais:*\n${summaryLines.join('\n')}`,
			},
		});
	}

	if (notification.prUrl) {
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*Link:* ${notification.prUrl}`,
			},
		});
	}

	return blocks;
}

async function handleGitHubPrReviewNotify(body, config, slack) {
	const notification = parseGitHubReviewNotification(body);
	const blocks = buildSlackBlocks(body, notification);
	const slackResponse = await slack.sendChannelMessage(
		config.slackChannelId,
		notification.messageText,
		blocks,
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
