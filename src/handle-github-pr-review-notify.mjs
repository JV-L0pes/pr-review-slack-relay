import { parseGitHubReviewNotification } from "./github-review-notification.mjs";

function normalizeSummaryLines(payload) {
	const items = Array.isArray(payload?.review?.inlineSummary)
		? payload.review.inlineSummary
		: [];
	return items
		.map((item, index) => {
			const summary =
				typeof item?.summary === "string" ? item.summary.trim() : "";
			return summary ? `• ${index + 1}. ${summary}` : "";
		})
		.filter(Boolean);
}

function buildSlackBlocks(payload, notification) {
	const isApproved = notification.reviewState === "approved";
	const isChangesRequested = notification.reviewState === "changes_requested";
	const isComment = notification.reviewState === "commented";
	const state = isApproved
		? "APPROVED"
		: isChangesRequested
			? "CHANGES_REQUESTED"
			: "COMMENT";
	const stateText = isApproved
		? "aprovado na revisão atual"
		: isChangesRequested
			? "correções solicitadas na revisão atual"
			: "novo comentário registrado no PR";
	const repository =
		typeof payload?.repository?.fullName === "string"
			? payload.repository.fullName.trim()
			: "unknown";
	const baseRef =
		typeof payload?.pullRequest?.baseRefName === "string"
			? payload.pullRequest.baseRefName.trim()
			: "unknown";
	const headRef =
		typeof payload?.pullRequest?.headRefName === "string"
			? payload.pullRequest.headRefName.trim()
			: "unknown";
	const reviewer = notification.reviewerLogin || "unknown";
	const observation =
		typeof payload?.review?.body === "string" && payload.review.body.trim()
			? payload.review.body.trim()
			: notification.messageText;
	const summaryLines = normalizeSummaryLines(payload);
	const commentLocation =
		notification.commentKind === "inline" && notification.commentPath
			? notification.commentLine
				? `${notification.commentPath}:${notification.commentLine}`
				: notification.commentPath
			: "";
	const typeLine = isComment
		? notification.commentKind === "inline"
			? commentLocation
				? `comentário inline em ${commentLocation}`
				: "comentário inline no PR"
			: "comentário geral no PR"
		: "";
	const actorLabel = isComment ? "Comentou" : "Revisor";
	const observationLabel = isComment ? "Comentário" : "Observação do revisor";

	const blocks = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: `PR ${state}`,
			},
		},
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: [
					`*Repositório:* ${repository}`,
					`*PR:* #${notification.prNumber} - ${notification.prTitle || "sem título"}`,
					`*Autor:* ${notification.authorLogin}`,
					`*${actorLabel}:* ${reviewer}`,
					...(typeLine ? [`*Tipo:* ${typeLine}`] : []),
					`*Fluxo:* ${headRef} -> ${baseRef}`,
					`*Status:* ${stateText}`,
				].join("\n"),
			},
		},
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*${observationLabel}:*\n${observation}`,
			},
		},
	];

	if (!isComment && summaryLines.length > 0) {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*Pontos principais:*\n${summaryLines.join("\n")}`,
			},
		});
	}

	if (notification.prUrl) {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
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
		config.slackPrAlertsChannelId,
		notification.messageText,
		blocks,
	);

	return {
		status: 202,
		body: {
			ok: true,
			status: "queued",
			authorLogin: notification.authorLogin,
			to: config.slackPrAlertsChannelId,
			slack: slackResponse,
		},
	};
}

export { handleGitHubPrReviewNotify };
