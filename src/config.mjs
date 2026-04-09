import { readFileSync } from 'node:fs';

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

function parseUserMap(raw) {
	const parsed = JSON.parse(raw);
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('SLACK_USER_MAP_JSON must be a JSON object.');
	}

	const out = new Map();
	for (const [login, slackUserId] of Object.entries(parsed)) {
		if (typeof slackUserId !== 'string') {
			continue;
		}
		const normalized = slackUserId.trim();
		if (!normalized) {
			continue;
		}
		out.set(login, normalized);
	}
	return out;
}

function loadUserMap() {
	const inline = process.env.SLACK_USER_MAP_JSON?.trim();
	const fromFile = process.env.SLACK_USER_MAP_FILE?.trim();

	if (inline) {
		return parseUserMap(inline);
	}

	if (fromFile) {
		const raw = readFileSync(fromFile, 'utf8');
		return parseUserMap(raw);
	}

	return new Map();
}

function loadConfig() {
	return {
		port: parsePort(optional('PORT', '8787')),
		webhookBearerToken: required('WEBHOOK_BEARER_TOKEN'),
		slackBotToken: required('SLACK_BOT_TOKEN'),
		slackUserMap: loadUserMap(),
	};
}

export { loadConfig };
