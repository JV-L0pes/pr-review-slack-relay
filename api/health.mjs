import { loadConfig } from '../src/config.mjs';

export default async function handler(_req, res) {
	const config = loadConfig();

	return res.status(200).json({
		ok: true,
		service: 'pr-review-slack-relay',
		prAlertsChannelId: config.slackPrAlertsChannelId,
		backlogChannelId: config.slackBacklogChannelId,
		runtime: 'vercel',
	});
}
