import { loadConfig } from '../../src/config.mjs';
import { handleGitHubPrReviewNotify } from '../../src/handle-github-pr-review-notify.mjs';
import { SlackClient } from '../../src/slack-client.mjs';

function unauthorized(res) {
	return res.status(401).json({
		ok: false,
		error: 'unauthorized',
	});
}

function webhookAuthorized(req, config) {
	const authorization = req.headers.authorization ?? '';
	const expected = `Bearer ${config.webhookBearerToken}`;
	return authorization === expected;
}

export default async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({
			ok: false,
			error: 'method_not_allowed',
		});
	}

	const config = loadConfig();
	if (!webhookAuthorized(req, config)) {
		return unauthorized(res);
	}

	try {
		const slack = new SlackClient(config);
		const result = await handleGitHubPrReviewNotify(req.body, config, slack);
		return res.status(result.status).json(result.body);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'unknown_internal_error';
		return res.status(400).json({
			ok: false,
			error: message,
		});
	}
}
