import express from 'express';

import { loadConfig } from './config.mjs';
import { parseGitHubReviewNotification } from './github-review-notification.mjs';
import { WhatsAppCloudClient } from './whatsapp-cloud-client.mjs';

const config = loadConfig();
const app = express();
const whatsapp = new WhatsAppCloudClient(config);

app.use(express.json({ limit: '256kb' }));

function unauthorized(res) {
	return res.status(401).json({
		ok: false,
		error: 'unauthorized',
	});
}

function webhookAuthorized(req) {
	const authorization = req.get('authorization') ?? '';
	const expected = `Bearer ${config.webhookBearerToken}`;
	return authorization === expected;
}

app.get('/health', (_req, res) => {
	res.json({
		ok: true,
		service: 'pr-review-whatsapp-relay',
		sendMode: config.whatsappSendMode,
		mappedUsers: config.userPhoneMap.size,
	});
});

app.post('/github/pr-review-notify', async (req, res) => {
	if (!webhookAuthorized(req)) {
		return unauthorized(res);
	}

	try {
		const notification = parseGitHubReviewNotification(req.body);
		const phone = config.userPhoneMap.get(notification.authorLogin);

		if (!phone) {
			return res.status(202).json({
				ok: true,
				status: 'skipped',
				reason: 'author_phone_not_mapped',
				authorLogin: notification.authorLogin,
			});
		}

		const whatsappResponse = await whatsapp.sendReviewNotification(
			phone,
			notification.messageText,
		);

		return res.status(202).json({
			ok: true,
			status: 'queued',
			authorLogin: notification.authorLogin,
			to: phone,
			whatsapp: whatsappResponse,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'unknown_internal_error';
		return res.status(400).json({
			ok: false,
			error: message,
		});
	}
});

app.listen(config.port, () => {
	console.log(
		`pr-review-whatsapp-relay listening on http://localhost:${config.port}`,
	);
});
