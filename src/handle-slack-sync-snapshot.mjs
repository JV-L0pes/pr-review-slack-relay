const SNAPSHOT_PREFIX = '[BACKLOG_SNAPSHOT]';

function requiredString(value, name) {
	if (typeof value !== 'string' || !value.trim()) {
		throw new Error(`${name} is required.`);
	}
	return value.trim();
}

function normalizeList(items, name) {
	if (!Array.isArray(items)) {
		throw new Error(`${name} must be an array.`);
	}
	return items
		.map((item) => (typeof item === 'string' ? item.trim() : ''))
		.filter(Boolean);
}

function parseSnapshotPayload(payload) {
	if (!payload || typeof payload !== 'object') {
		throw new Error('Payload must be an object.');
	}

	const snapshot = payload.snapshot;
	if (!snapshot || typeof snapshot !== 'object') {
		throw new Error('snapshot is required.');
	}

	return {
		snapshotKey: requiredString(snapshot.snapshotKey, 'snapshot.snapshotKey'),
		title: requiredString(snapshot.title, 'snapshot.title'),
		statusLine: requiredString(snapshot.statusLine, 'snapshot.statusLine'),
		trelloLines: normalizeList(snapshot.trelloLines, 'snapshot.trelloLines'),
		highlightLines: normalizeList(
			snapshot.highlightLines,
			'snapshot.highlightLines',
		),
		prLines: normalizeList(snapshot.prLines, 'snapshot.prLines'),
		docLines: normalizeList(snapshot.docLines, 'snapshot.docLines'),
		operationalLines: normalizeList(
			snapshot.operationalLines,
			'snapshot.operationalLines',
		),
		generatedAt:
			typeof snapshot.generatedAt === 'string' && snapshot.generatedAt.trim()
				? snapshot.generatedAt.trim()
				: null,
	};
}

function buildSnapshotText(snapshot) {
	return `${SNAPSHOT_PREFIX}:${snapshot.snapshotKey}`;
}

function buildSection(text) {
	return {
		type: 'section',
		text: {
			type: 'mrkdwn',
			text,
		},
	};
}

function buildSnapshotBlocks(snapshot) {
	const blocks = [
		{
			type: 'header',
			text: {
				type: 'plain_text',
				text: snapshot.title,
			},
		},
		buildSection(snapshot.statusLine),
	];

	if (snapshot.trelloLines.length > 0) {
		blocks.push(
			buildSection(`*Trello*\n${snapshot.trelloLines.join('\n')}`),
		);
	}

	if (snapshot.highlightLines.length > 0) {
		blocks.push(
			buildSection(
				`*Destaques operacionais*\n${snapshot.highlightLines.join('\n')}`,
			),
		);
	}

	if (snapshot.prLines.length > 0) {
		blocks.push(buildSection(`*PRs abertos*\n${snapshot.prLines.join('\n')}`));
	}

	if (snapshot.docLines.length > 0) {
		blocks.push(
			buildSection(`*Referências*\n${snapshot.docLines.join('\n')}`),
		);
	}

	if (snapshot.operationalLines.length > 0) {
		blocks.push(
			buildSection(
				`*Leitura operacional*\n${snapshot.operationalLines.join('\n')}`,
			),
		);
	}

	if (snapshot.generatedAt) {
		blocks.push({
			type: 'context',
			elements: [
				{
					type: 'mrkdwn',
					text: `Atualizado em ${snapshot.generatedAt}`,
				},
			],
		});
	}

	return blocks;
}

function findExistingSnapshot(messages, snapshotKey) {
	const marker = `${SNAPSHOT_PREFIX}:${snapshotKey}`;
	return messages.find(
		(message) =>
			typeof message?.text === 'string' &&
			message.text.includes(marker) &&
			message.bot_id,
	);
}

async function handleSlackSyncSnapshot(body, config, slack) {
	const snapshot = parseSnapshotPayload(body);
	const text = buildSnapshotText(snapshot);
	const blocks = buildSnapshotBlocks(snapshot);
	const messages = await slack.getChannelHistory(config.slackBacklogChannelId, 50);
	const existing = findExistingSnapshot(messages, snapshot.snapshotKey);

	const slackResponse = existing
		? await slack.updateMessage(
				config.slackBacklogChannelId,
				existing.ts,
				text,
				blocks,
			)
		: await slack.sendChannelMessage(
				config.slackBacklogChannelId,
				text,
				blocks,
			);

	return {
		status: 202,
		body: {
			ok: true,
			status: existing ? 'updated' : 'created',
			snapshotKey: snapshot.snapshotKey,
			to: config.slackBacklogChannelId,
			slack: slackResponse,
		},
	};
}

export { handleSlackSyncSnapshot };
