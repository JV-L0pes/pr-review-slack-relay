function stripPhone(phone) {
	return phone.replace(/[^\d+]/g, '');
}

class WhatsAppCloudClient {
	constructor(config) {
		this.config = config;
	}

	endpoint() {
		return `https://graph.facebook.com/${this.config.whatsappGraphApiVersion}/${this.config.whatsappPhoneNumberId}/messages`;
	}

	headers() {
		return {
			Authorization: `Bearer ${this.config.whatsappAccessToken}`,
			'Content-Type': 'application/json',
		};
	}

	async sendReviewNotification(to, messageText) {
		const phone = stripPhone(to);
		const body =
			this.config.whatsappSendMode === 'text'
				? {
						messaging_product: 'whatsapp',
						to: phone,
						type: 'text',
						text: {
							preview_url: false,
							body: messageText,
						},
					}
				: {
						messaging_product: 'whatsapp',
						to: phone,
						type: 'template',
						template: {
							name: this.config.whatsappTemplateName,
							language: {
								code: this.config.whatsappTemplateLanguageCode,
							},
							components: [
								{
									type: 'body',
									parameters: [
										{
											type: 'text',
											text: messageText,
										},
									],
								},
							],
						},
					};

		const response = await fetch(this.endpoint(), {
			method: 'POST',
			headers: this.headers(),
			body: JSON.stringify(body),
		});

		const responseText = await response.text();
		let data;
		try {
			data = responseText ? JSON.parse(responseText) : null;
		} catch {
			data = responseText;
		}

		if (!response.ok) {
			throw new Error(
				`WhatsApp Cloud API ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`,
			);
		}

		return data;
	}
}

export { WhatsAppCloudClient };
