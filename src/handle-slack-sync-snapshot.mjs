const SNAPSHOT_PREFIX = "[BACKLOG_SNAPSHOT]";

function requiredString(value, name) {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(`${name} is required.`);
	}
	return value.trim();
}

function normalizeList(items, name) {
	if (!Array.isArray(items)) {
		throw new Error(`${name} must be an array.`);
	}
	return items
		.map((item) => (typeof item === "string" ? item.trim() : ""))
		.filter(Boolean);
}

function parseSnapshotPayload(payload) {
	if (!payload || typeof payload !== "object") {
		throw new Error("Payload must be an object.");
	}

	const snapshot = payload.snapshot;
	if (!snapshot || typeof snapshot !== "object") {
		throw new Error("snapshot is required.");
	}

	return {
		snapshotKey: requiredString(snapshot.snapshotKey, "snapshot.snapshotKey"),
		channelTarget:
			typeof snapshot.channelTarget === "string" &&
			snapshot.channelTarget.trim()
				? snapshot.channelTarget.trim()
				: "backlog",
		title: requiredString(snapshot.title, "snapshot.title"),
		statusLine: requiredString(snapshot.statusLine, "snapshot.statusLine"),
		trelloLines: normalizeList(snapshot.trelloLines, "snapshot.trelloLines"),
		highlightLines: normalizeList(
			snapshot.highlightLines,
			"snapshot.highlightLines",
		),
		assignmentLines: normalizeList(
			snapshot.assignmentLines ?? [],
			"snapshot.assignmentLines",
		),
		prLines: normalizeList(snapshot.prLines, "snapshot.prLines"),
		docLines: normalizeList(snapshot.docLines, "snapshot.docLines"),
		operationalLines: normalizeList(
			snapshot.operationalLines,
			"snapshot.operationalLines",
		),
		generatedAt:
			typeof snapshot.generatedAt === "string" && snapshot.generatedAt.trim()
				? snapshot.generatedAt.trim()
				: null,
	};
}

function resolveSnapshotChannelId(snapshot, config) {
	switch (snapshot.channelTarget) {
		case "backlog":
			return config.slackBacklogChannelId;
		case "pr_alerts":
			return config.slackPrAlertsChannelId;
		default:
			throw new Error(
				`snapshot.channelTarget must be "backlog" or "pr_alerts"; received "${snapshot.channelTarget}".`,
			);
	}
}

function buildSnapshotText(snapshot) {
	return `${SNAPSHOT_PREFIX}:${snapshot.snapshotKey}`;
}

function buildSection(text) {
	return {
		type: "section",
		text: {
			type: "mrkdwn",
			text,
		},
	};
}

function chunkLines(lines, maxChars = 2800) {
	const chunks = [];
	let current = [];
	let currentLength = 0;

	for (const line of lines) {
		const nextLength = currentLength + line.length + 1;
		if (current.length > 0 && nextLength > maxChars) {
			chunks.push(current);
			current = [line];
			currentLength = line.length + 1;
			continue;
		}
		current.push(line);
		currentLength = nextLength;
	}

	if (current.length > 0) {
		chunks.push(current);
	}

	return chunks;
}

function pushLineSections(blocks, title, lines) {
	for (const chunk of chunkLines(lines)) {
		blocks.push(buildSection(`*${title}*\n${chunk.join("\n")}`));
	}
}

function buildSnapshotBlocks(snapshot) {
	const blocks = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: snapshot.title,
			},
		},
		buildSection(snapshot.statusLine),
	];

	if (snapshot.trelloLines.length > 0) {
		pushLineSections(blocks, "Trello", snapshot.trelloLines);
	}

	if (snapshot.highlightLines.length > 0) {
		pushLineSections(blocks, "Destaques operacionais", snapshot.highlightLines);
	}

	if (snapshot.assignmentLines.length > 0) {
		pushLineSections(blocks, "Pendências mapeadas", snapshot.assignmentLines);
	}

	if (snapshot.prLines.length > 0) {
		pushLineSections(blocks, "PRs abertos", snapshot.prLines);
	}

	if (snapshot.docLines.length > 0) {
		pushLineSections(blocks, "Referências", snapshot.docLines);
	}

	if (snapshot.operationalLines.length > 0) {
		pushLineSections(blocks, "Leitura operacional", snapshot.operationalLines);
	}

	if (snapshot.generatedAt) {
		blocks.push({
			type: "context",
			elements: [
				{
					type: "mrkdwn",
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
			typeof message?.text === "string" &&
			message.text.includes(marker) &&
			message.bot_id,
	);
}

async function handleSlackSyncSnapshot(body, config, slack) {
	const snapshot = parseSnapshotPayload(body);
	const channelId = resolveSnapshotChannelId(snapshot, config);
	const text = buildSnapshotText(snapshot);
	const blocks = buildSnapshotBlocks(snapshot);
	const messages = await slack.getChannelHistory(channelId, 50);
	const existing = findExistingSnapshot(messages, snapshot.snapshotKey);

	const slackResponse = existing
		? await slack.updateMessage(channelId, existing.ts, text, blocks)
		: await slack.sendChannelMessage(channelId, text, blocks);

	return {
		status: 202,
		body: {
			ok: true,
			status: existing ? "updated" : "created",
			snapshotKey: snapshot.snapshotKey,
			to: channelId,
			slack: slackResponse,
		},
	};
}

export { handleSlackSyncSnapshot };
