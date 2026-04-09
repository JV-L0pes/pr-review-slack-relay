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

function loadConfig() {
	return {
		port: parsePort(optional('PORT', '8787')),
		webhookBearerToken: required('WEBHOOK_BEARER_TOKEN'),
		slackBotToken: required('SLACK_BOT_TOKEN'),
		slackChannelId: required('SLACK_CHANNEL_ID'),
	};
}

export { loadConfig };
