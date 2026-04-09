class SlackClient {
	constructor(config) {
		this.config = config;
	}

	headers() {
		return {
			Authorization: `Bearer ${this.config.slackBotToken}`,
			'Content-Type': 'application/json; charset=utf-8',
		};
	}

	async sendChannelMessage(channelId, messageText, blocks) {
		const response = await fetch('https://slack.com/api/chat.postMessage', {
			method: 'POST',
			headers: this.headers(),
			body: JSON.stringify({
				channel: channelId,
				text: messageText,
				mrkdwn: true,
				blocks,
				unfurl_links: false,
				unfurl_media: false,
			}),
		});

		const data = await response.json();
		if (!response.ok || !data.ok) {
			throw new Error(
				`Slack API ${response.status}: ${JSON.stringify(data)}`,
			);
		}

		return data;
	}
}

export { SlackClient };
