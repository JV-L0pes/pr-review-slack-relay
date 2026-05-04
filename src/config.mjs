function required(name) {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

function optional(name, fallback) {
	const value = process.env[name]?.trim();
	return value ? value : fallback;
}

function parsePort(value) {
	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n) || n <= 0) {
		return 8787;
	}
	return n;
}

function parsePositiveInt(value, fallback) {
	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n) || n <= 0) {
		return fallback;
	}
	return n;
}

function loadConfig() {
	const slackPrAlertsChannelId =
		process.env.SLACK_PR_ALERTS_CHANNEL_ID?.trim() ||
		process.env.SLACK_CHANNEL_ID?.trim();
	const slackBacklogChannelId =
		process.env.SLACK_BACKLOG_CHANNEL_ID?.trim() ||
		process.env.SLACK_SYNC_CHANNEL_ID?.trim();

	if (!slackPrAlertsChannelId) {
		throw new Error(
			"Missing required environment variable: SLACK_PR_ALERTS_CHANNEL_ID (or legacy SLACK_CHANNEL_ID)",
		);
	}
	if (!slackBacklogChannelId) {
		throw new Error(
			"Missing required environment variable: SLACK_BACKLOG_CHANNEL_ID (or legacy SLACK_SYNC_CHANNEL_ID)",
		);
	}

	return {
		port: parsePort(optional("PORT", "8787")),
		webhookBearerToken: required("WEBHOOK_BEARER_TOKEN"),
		cronSecret: optional("CRON_SECRET", required("WEBHOOK_BEARER_TOKEN")),
		slackBotToken: required("SLACK_BOT_TOKEN"),
		slackPrAlertsChannelId,
		slackBacklogChannelId,
		githubRepository: optional(
			"GITHUB_REPOSITORY",
			"ErrorSquad-ABP/ABP3-Sistema-Gestao-Leads",
		),
		githubToken: optional("GITHUB_TOKEN", ""),
		trelloKey: optional("TRELLO_KEY", ""),
		trelloToken: optional("TRELLO_TOKEN", ""),
		trelloBoardId: optional("TRELLO_BOARD_ID", ""),
		vercelApiToken: optional("VERCEL_API_TOKEN", ""),
		vercelProjectId: optional("VERCEL_PROJECT_ID", ""),
		vercelTeamId: optional("VERCEL_TEAM_ID", ""),
		vercelDeployListLimit: parsePositiveInt(
			optional("VERCEL_DEPLOY_LIST_LIMIT", "8"),
			8,
		),
		deploySnapshotChannelTarget: optional(
			"DEPLOY_SNAPSHOT_CHANNEL_TARGET",
			"pr_alerts",
		),
	};
}

export { loadConfig };
