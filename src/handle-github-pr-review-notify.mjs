import { parseGitHubReviewNotification } from './github-review-notification.mjs';

async function handleGitHubPrReviewNotify(body, config, whatsapp) {
	const notification = parseGitHubReviewNotification(body);
	const phone = config.userPhoneMap.get(notification.authorLogin);

	if (!phone) {
		return {
			status: 202,
			body: {
				ok: true,
				status: 'skipped',
				reason: 'author_phone_not_mapped',
				authorLogin: notification.authorLogin,
			},
		};
	}

	const whatsappResponse = await whatsapp.sendReviewNotification(
		phone,
		notification.messageText,
	);

	return {
		status: 202,
		body: {
			ok: true,
			status: 'queued',
			authorLogin: notification.authorLogin,
			to: phone,
			whatsapp: whatsappResponse,
		},
	};
}

export { handleGitHubPrReviewNotify };
