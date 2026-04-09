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

function parsePhoneMap(raw) {
	const parsed = JSON.parse(raw);
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('USER_PHONE_MAP_JSON must be a JSON object.');
	}

	const out = new Map();
	for (const [login, phone] of Object.entries(parsed)) {
		if (typeof phone !== 'string') {
			continue;
		}
		const normalizedPhone = phone.replace(/\s+/g, '');
		if (!normalizedPhone) {
			continue;
		}
		out.set(login, normalizedPhone);
	}
	return out;
}

function loadPhoneMap() {
	const inline = process.env.USER_PHONE_MAP_JSON?.trim();
	const fromFile = process.env.USER_PHONE_MAP_FILE?.trim();

	if (inline) {
		return parsePhoneMap(inline);
	}

	if (fromFile) {
		const raw = readFileSync(fromFile, 'utf8');
		return parsePhoneMap(raw);
	}

	return new Map();
}

function normalizeSendMode(value) {
	return value === 'text' ? 'text' : 'template';
}

function loadConfig() {
	const sendMode = normalizeSendMode(optional('WHATSAPP_SEND_MODE', 'template'));

	return {
		port: parsePort(optional('PORT', '8787')),
		webhookBearerToken: required('WEBHOOK_BEARER_TOKEN'),
		whatsappAccessToken: required('WHATSAPP_ACCESS_TOKEN'),
		whatsappPhoneNumberId: required('WHATSAPP_PHONE_NUMBER_ID'),
		whatsappGraphApiVersion: optional('WHATSAPP_GRAPH_API_VERSION', 'v23.0'),
		whatsappSendMode: sendMode,
		whatsappTemplateName:
			sendMode === 'template'
				? required('WHATSAPP_TEMPLATE_NAME')
				: optional('WHATSAPP_TEMPLATE_NAME', ''),
		whatsappTemplateLanguageCode: optional(
			'WHATSAPP_TEMPLATE_LANGUAGE_CODE',
			'pt_BR',
		),
		userPhoneMap: loadPhoneMap(),
	};
}

export { loadConfig };
